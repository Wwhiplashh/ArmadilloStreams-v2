from datetime import datetime, timezone
import json
import os
import requests

RAPIDAPI_KEY = os.getenv("RAPIDAPI_KEY")
RAPIDAPI_HOST = "sportapi7.p.rapidapi.com"
INTER_TEAM_ID = 2697

# --- CONFIGURAZIONE: URL DEL TUO SITO ---
URL_SERIE_A   = "https://tuo-sito.example/serie-a"
URL_CHAMPIONS = "https://tuo-sito.example/champions"

# --- Cartella dei loghi scaricati ---
LOGOS_DIR = "logos"
os.makedirs(LOGOS_DIR, exist_ok=True)


def determina_destinazione(competizione, data_dt):
    comp = competizione.lower()

    if "serie a" in comp:
        return {
            "tipo": "sito",
            "servizio": "DAZN",
            "url": URL_SERIE_A,
            "messaggio": "",
        }

    if "coppa italia" in comp or "supercoppa" in comp or "super cup" in comp:
        # Entrambe in chiaro su Mediaset, nessun redirect
        return {
            "tipo": "tv",
            "servizio": "Mediaset",
            "url": "",
            "messaggio": "In chiaro su Mediaset: potrai guardarla in TV",
        }

    if "champions league" in comp:
        if data_dt.weekday() == 2:  # mercoledì
            return {
                "tipo": "esterno",
                "servizio": "Prime Video",
                "url": "",
                "messaggio": "Esclusiva Prime Video: non sarà trasmessa sul nostro sito",
            }
        return {
            "tipo": "sito",
            "servizio": "Sky Sport Uno",
            "url": URL_CHAMPIONS,
            "messaggio": "",
        }

    # Fallback: competizione non riconosciuta → nessun redirect, solo avviso
    return {
        "tipo": "sconosciuto",
        "servizio": "",
        "url": "",
        "messaggio": "Questa partita non è disponibile sul nostro sito",
    }


def scarica_logo(team_id, team_name):
    """Scarica il logo di una squadra e restituisce il percorso locale."""
    if not team_id:
        return ""

    filename = f"team_{team_id}.png"
    local_path = os.path.join(LOGOS_DIR, filename)

    # Se il file esiste già, non riscaricarlo (risparmia tempo e banda)
    if os.path.exists(local_path):
        return local_path

    url = f"https://img.sofascore.com/api/v1/team/{team_id}/image"
    try:
        resp = requests.get(url, timeout=10)
        if resp.status_code == 200:
            with open(local_path, "wb") as f:
                f.write(resp.content)
            print(f"✅ Scaricato logo: {team_name} ({filename})")
            return local_path
        else:
            print(f"⚠️ Impossibile scaricare logo per {team_name}: HTTP {resp.status_code}")
    except Exception as e:
        print(f"❌ Errore scaricando logo per {team_name}: {e}")

    return ""


def fetch_inter_matches():
    if not RAPIDAPI_KEY:
        print("❌ Errore: RAPIDAPI_KEY non impostata!")
        return

    url = f"https://sportapi7.p.rapidapi.com/api/v1/team/{INTER_TEAM_ID}/events/next/0"
    headers = {
        "X-RapidAPI-Key": RAPIDAPI_KEY,
        "X-RapidAPI-Host": RAPIDAPI_HOST,
    }

    try:
        response = requests.get(url, headers=headers, timeout=10)
    except requests.RequestException as e:
        print(f"❌ Errore di connessione: {e}")
        return

    if response.status_code != 200:
        print(f"❌ Errore HTTP {response.status_code}: {response.text}")
        return

    data = response.json()
    events = data.get("events", [])
    print(f"ℹ️ Partite trovate: {len(events)}")

    partite = []
    for event in events:
        tournament = event.get("tournament", {})
        home = event.get("homeTeam", {})
        away = event.get("awayTeam", {})
        timestamp = event.get("startTimestamp")
        if not timestamp:
            continue

        data_dt_utc = datetime.fromtimestamp(timestamp, tz=timezone.utc)
        data_dt_locale = datetime.fromtimestamp(timestamp)  # per il calcolo TV

        competition = tournament.get("name", "Competizione sconosciuta")
        destinazione = determina_destinazione(competition, data_dt_locale)

        # Scarica i loghi localmente (evita il blocco CORS di Sofascore)
        home_id = home.get("id")
        away_id = away.get("id")
        home_logo = scarica_logo(home_id, home.get("name", "Sconosciuta"))
        away_logo = scarica_logo(away_id, away.get("name", "Sconosciuta"))

        partite.append({
            "startTimestamp": timestamp,
            "startIso": data_dt_utc.isoformat(),
            "home_team": home.get("name", ""),
            "away_team": away.get("name", ""),
            "home_logo": home_logo,
            "away_logo": away_logo,
            "competizione": competition,
            "destinazione": destinazione,
        })

    partite.sort(key=lambda x: x["startTimestamp"])

    with open("calendar.json", "w", encoding="utf-8") as f:
        json.dump(partite, f, indent=2, ensure_ascii=False)

    print(f"✅ Generate {len(partite)} partite.")


if __name__ == "__main__":
    fetch_inter_matches()
