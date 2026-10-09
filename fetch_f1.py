from datetime import datetime, timezone
import json
import requests

HEADERS = {"User-Agent": "InterNextMatch/1.0"}
BASE_URL = "https://api.jolpi.ca/ergast/f1"
ANNO = 2026

URL_F1 = "https://tuo-sito.example/f1"  # ⚠️ SOSTITUISCI con l'URL giusto

# Durate sessioni (in secondi)
DURATA_QUALIFICA = 90 * 60
DURATA_SPRINT = 60 * 60
DURATA_GARA = 2 * 60 * 60
DURATA_QUALIFICA_SPRINT = 60 * 60


def determina_destinazione_f1():
    return {
        "tipo": "sito",
        "servizio": "Sky Sport F1",
        "url": URL_F1,
        "messaggio": "",
    }


def combina_data_ora(date_str, time_str):
    """Combina data ('2026-03-15') e ora ('14:00:00Z') in un datetime UTC."""
    if not date_str or not time_str:
        return None
    time_clean = time_str.replace("Z", "+00:00")
    iso = f"{date_str}T{time_clean}"
    try:
        return datetime.fromisoformat(iso)
    except ValueError as e:
        print(f"⚠️ Data non valida: {iso} ({e})")
        return None


def fetch_risultati_ferrari(round_number, sessione, estrai_griglia=False):
    """
    Scarica i risultati Ferrari per una sessione.

    estrai_griglia: se True, aggiunge anche il campo 'griglia' a ogni pilota.
                    Serve per ricavare la posizione di partenza della Sprint
                    (che è il risultato della Qualifica Sprint) dai risultati
                    della Sprint stessa.
    """
    url = f"{BASE_URL}/{ANNO}/{round_number}/constructors/ferrari/{sessione}/"
    try:
        r = requests.get(url, headers=HEADERS, timeout=10)
        if r.status_code != 200:
            return []
        data = r.json()
        races = data.get("MRData", {}).get("RaceTable", {}).get("Races", [])
        if not races:
            return []

        campo = {
            "qualifying": "QualifyingResults",
            "sprint": "SprintResults",
            "results": "Results",
        }.get(sessione, "Results")

        risultati = races[0].get(campo, [])
        out = []
        for res in risultati:
            driver = res.get("Driver", {})
            voce = {
                "pilota": f"{driver.get('givenName', '')} {driver.get('familyName', '')}".strip(),
                "posizione": res.get("position", ""),
            }
            if estrai_griglia:
                voce["griglia"] = res.get("grid", "")
            out.append(voce)
        return out
    except Exception as e:
        print(f"⚠️ Errore risultati Ferrari round {round_number} ({sessione}): {e}")
        return []


def aggiungi_sessione(sessioni, race, circuit, round_number, race_name,
                      nome_sessione, data_str, ora_str, durata,
                      endpoint_risultati, adesso, estrai_griglia=False):
    """Helper per aggiungere una sessione alla lista."""
    dt = combina_data_ora(data_str, ora_str)
    if not dt:
        return
    ts = int(dt.timestamp())

    risultati = []
    if ts <= adesso.timestamp() and endpoint_risultati:
        risultati = fetch_risultati_ferrari(round_number, endpoint_risultati,
                                            estrai_griglia=estrai_griglia)

    sessioni.append({
        "tipo": "f1",
        "sessione": nome_sessione,
        "codiceSessione": nome_sessione.upper().replace(" ", "_"),
        "round": int(round_number) if round_number else 0,
        "gp": race_name,
        "circuito": circuit.get("circuitName", ""),
        "localita": circuit.get("Location", {}).get("locality", ""),
        "paese": circuit.get("Location", {}).get("country", ""),
        "startTimestamp": ts,
        "startIso": dt.isoformat(),
        "durata": durata,
        "risultatiFerrari": risultati,
        "destinazione": determina_destinazione_f1(),
    })


def fetch_f1():
    url = f"{BASE_URL}/{ANNO}/races/"
    try:
        r = requests.get(url, headers=HEADERS, timeout=15)
    except requests.RequestException as e:
        print(f"❌ Errore di connessione: {e}")
        return

    if r.status_code != 200:
        print(f"❌ Errore HTTP {r.status_code}: {r.text[:200]}")
        return

    data = r.json()
    races = data.get("MRData", {}).get("RaceTable", {}).get("Races", [])
    print(f"ℹ️ Round F1 trovati: {len(races)}")

    adesso = datetime.now(timezone.utc)
    sessioni = []

    for race in races:
        round_number = race.get("round")
        race_name = race.get("raceName", "GP")
        circuit = race.get("Circuit", {})

        # --- Gara ---
        aggiungi_sessione(
            sessioni, race, circuit, round_number, race_name,
            "Gara", race.get("date"), race.get("time", "00:00:00Z"),
            DURATA_GARA, "results", adesso
        )

        # --- Qualifica normale ---
        qual = race.get("Qualifying", {})
        aggiungi_sessione(
            sessioni, race, circuit, round_number, race_name,
            "Qualifica", qual.get("date"), qual.get("time", "00:00:00Z"),
            DURATA_QUALIFICA, "qualifying", adesso
        )

        # --- Sprint (con griglia di partenza dalla Qualifica Sprint) ---
        sprint = race.get("Sprint", {})
        aggiungi_sessione(
            sessioni, race, circuit, round_number, race_name,
            "Sprint", sprint.get("date"), sprint.get("time", "00:00:00Z"),
            DURATA_SPRINT, "sprint", adesso,
            estrai_griglia=True
        )

        # --- Qualifica Sprint (sessione informativa, senza risultati) ---
        sq = race.get("SprintQualifying") or race.get("SprintShootout")
        if sq:
            aggiungi_sessione(
                sessioni, race, circuit, round_number, race_name,
                "Qualifica Sprint", sq.get("date"), sq.get("time", "00:00:00Z"),
                DURATA_QUALIFICA_SPRINT, None, adesso
            )

    sessioni.sort(key=lambda x: x["startTimestamp"])

    with open("calendar_f1.json", "w", encoding="utf-8") as f:
        json.dump(sessioni, f, indent=2, ensure_ascii=False)

    print(f"✅ Generate {len(sessioni)} sessioni F1.")


if __name__ == "__main__":
    fetch_f1()
