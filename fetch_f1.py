from datetime import datetime, timezone
import json
import requests

# Jolpica F1 richiede uno User-Agent personalizzato
HEADERS = {"User-Agent": "InterNextMatch/1.0"}
BASE_URL = "https://api.jolpi.ca/ergast/f1"
ANNO = 2026

# --- CONFIGURAZIONE ---
URL_F1 = "https://tuo-sito.example/f1"  # ⚠️ SOSTITUISCI con l'URL giusto

# Durate sessioni (in secondi)
DURATA_QUALIFICA = 90 * 60   # 1h 30m
DURATA_SPRINT = 60 * 60      # 1h
DURATA_GARA = 2 * 60 * 60    # 2h


def determina_destinazione_f1():
    """Restituisce la destinazione per una sessione F1."""
    return {
        "tipo": "sito",
        "servizio": "Sky Sport F1",
        "url": URL_F1,
        "messaggio": "",
    }


def durata_sessione(tipo):
    return {
        "Qualifica": DURATA_QUALIFICA,
        "Sprint": DURATA_SPRINT,
        "Gara": DURATA_GARA,
    }.get(tipo, DURATA_GARA)


def combina_data_ora(date_str, time_str):
    """
    Combina data ('2026-03-15') e ora ('14:00:00Z') in un datetime UTC.
    Restituisce None se manca uno dei due.
    """
    if not date_str or not time_str:
        return None
    # time_str di solito finisce con "Z"; lo convertiamo in +00:00
    time_clean = time_str.replace("Z", "+00:00")
    iso = f"{date_str}T{time_clean}"
    try:
        return datetime.fromisoformat(iso)
    except ValueError as e:
        print(f"⚠️ Data non valida: {iso} ({e})")
        return None


def fetch_calendario_f1():
    """Scarica il calendario F1 con date delle sessioni."""
    url = f"{BASE_URL}/{ANNO}/races/"
    try:
        r = requests.get(url, headers=HEADERS, timeout=15)
    except requests.RequestException as e:
        print(f"❌ Errore di connessione: {e}")
        return []

    if r.status_code != 200:
        print(f"❌ Errore HTTP {r.status_code}: {r.text[:200]}")
        return []

    data = r.json()
    races = data.get("MRData", {}).get("RaceTable", {}).get("Races", [])
    print(f"ℹ️ Round F1 trovati: {len(races)}")
    return races


def fetch_risultati_ferrari(round_number, sessione):
    """Scarica i risultati Ferrari per una sessione."""
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
            out.append({
                "pilota": f"{driver.get('givenName', '')} {driver.get('familyName', '')}".strip(),
                "posizione": res.get("position", ""),
            })
        return out
    except Exception as e:
        print(f"⚠️ Errore risultati Ferrari round {round_number} ({sessione}): {e}")
        return []


def fetch_f1():
    races = fetch_calendario_f1()
    if not races:
        print("❌ Nessun evento F1 trovato.")
        return

    adesso = datetime.now(timezone.utc)
    sessioni = []

    for race in races:
        round_number = race.get("round")
        race_name = race.get("raceName", "GP")
        circuit = race.get("Circuit", {})

        # Sessione di Gara (sempre presente)
        race_date = race.get("date")
        race_time = race.get("time", "00:00:00Z")
        race_dt = combina_data_ora(race_date, race_time)
        if race_dt:
            sessioni.append({
                "tipo": "f1",
                "sessione": "Gara",
                "codiceSessione": "RACE",
                "round": int(round_number) if round_number else 0,
                "gp": race_name,
                "circuito": circuit.get("circuitName", ""),
                "localita": circuit.get("Location", {}).get("locality", ""),
                "paese": circuit.get("Location", {}).get("country", ""),
                "startTimestamp": int(race_dt.timestamp()),
                "startIso": race_dt.isoformat(),
                "durata": DURATA_GARA,
                "risultatiFerrari": (
                    fetch_risultati_ferrari(round_number, "results")
                    if race_dt.timestamp() <= adesso.timestamp()
                    else []
                ),
                "destinazione": determina_destinazione_f1(),
            })

        # Qualifica
        qual = race.get("Qualifying", {})
        qual_dt = combina_data_ora(qual.get("date"), qual.get("time", "00:00:00Z"))
        if qual_dt:
            sessioni.append({
                "tipo": "f1",
                "sessione": "Qualifica",
                "codiceSessione": "QUALIFYING",
                "round": int(round_number) if round_number else 0,
                "gp": race_name,
                "circuito": circuit.get("circuitName", ""),
                "localita": circuit.get("Location", {}).get("locality", ""),
                "paese": circuit.get("Location", {}).get("country", ""),
                "startTimestamp": int(qual_dt.timestamp()),
                "startIso": qual_dt.isoformat(),
                "durata": DURATA_QUALIFICA,
                "risultatiFerrari": (
                    fetch_risultati_ferrari(round_number, "qualifying")
                    if qual_dt.timestamp() <= adesso.timestamp()
                    else []
                ),
                "destinazione": determina_destinazione_f1(),
            })

        # Sprint (solo per weekend sprint)
        sprint = race.get("Sprint", {})
        sprint_dt = combina_data_ora(sprint.get("date"), sprint.get("time", "00:00:00Z"))
        if sprint_dt:
            sessioni.append({
                "tipo": "f1",
                "sessione": "Sprint",
                "codiceSessione": "SPRINT",
                "round": int(round_number) if round_number else 0,
                "gp": race_name,
                "circuito": circuit.get("circuitName", ""),
                "localita": circuit.get("Location", {}).get("locality", ""),
                "paese": circuit.get("Location", {}).get("country", ""),
                "startTimestamp": int(sprint_dt.timestamp()),
                "startIso": sprint_dt.isoformat(),
                "durata": DURATA_SPRINT,
                "risultatiFerrari": (
                    fetch_risultati_ferrari(round_number, "sprint")
                    if sprint_dt.timestamp() <= adesso.timestamp()
                    else []
                ),
                "destinazione": determina_destinazione_f1(),
            })

    sessioni.sort(key=lambda x: x["startTimestamp"])

    with open("calendar_f1.json", "w", encoding="utf-8") as f:
        json.dump(sessioni, f, indent=2, ensure_ascii=False)

    print(f"✅ Generate {len(sessioni)} sessioni F1.")


if __name__ == "__main__":
    fetch_f1()
