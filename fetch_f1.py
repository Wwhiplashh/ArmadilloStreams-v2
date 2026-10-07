from datetime import datetime, timezone
import json
import os
import requests

# Jolpica F1 richiede uno User-Agent personalizzato
HEADERS = {"User-Agent": "InterNextMatch/1.0"}
BASE_URL = "https://api.jolpi.ca"
ANNO = 2026

# --- CONFIGURAZIONE ---
URL_F1 = "https://tuo-sito.example/f1"  # ⚠️ SOSTITUISCI con l'URL giusto

# Durate sessioni (in secondi)
DURATA_QUALIFICA = 90 * 60   # 1h 30m
DURATA_SPRINT = 60 * 60      # 1h
DURATA_GARA = 2 * 60 * 60    # 2h


def determina_destinazione_f1(codice_sessione):
    """Restituisce la destinazione per una sessione F1."""
    return {
        "tipo": "sito",
        "servizio": "Sky Sport F1",
        "url": URL_F1,
        "messaggio": "",
    }


def durata_sessione(codice):
    return {
        "QUALIFYING": DURATA_QUALIFICA,
        "SPRINT": DURATA_SPRINT,
        "RACE": DURATA_GARA,
    }.get(codice, DURATA_GARA)


def fetch_calendario_f1():
    """Scarica il calendario F1 con tutte le sessioni."""
    url = f"{BASE_URL}/f1/alpha/schedules/{ANNO}/"
    try:
        r = requests.get(url, headers=HEADERS, timeout=15)
    except requests.RequestException as e:
        print(f"❌ Errore di connessione: {e}")
        return []

    if r.status_code != 200:
        print(f"❌ Errore HTTP {r.status_code}: {r.text[:200]}")
        return []

    data = r.json()
    events = data.get("data", {}).get("events", [])
    print(f"ℹ️ Round F1 trovati: {len(events)}")
    return events


def fetch_risultati_ferrari(round_number, sessione):
    """Scarica i risultati Ferrari per una sessione."""
    url = (
        f"{BASE_URL}/ergast/f1/{ANNO}/{round_number}"
        f"/constructors/ferrari/{sessione}/"
    )
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
        for r in risultati:
            driver = r.get("Driver", {})
            out.append({
                "pilota": f"{driver.get('givenName', '')} {driver.get('familyName', '')}".strip(),
                "posizione": r.get("position", ""),
            })
        return out
    except Exception as e:
        print(f"⚠️ Errore risultati Ferrari round {round_number} ({sessione}): {e}")
        return []


def determina_tipo_sessione(codice):
    """Mappa i codici sessione Jolpica in etichette leggibili."""
    return {
        "RACE": "Gara",
        "QUALIFYING": "Qualifica",
        "SPRINT": "Sprint",
    }.get(codice, codice)


def fetch_f1():
    events = fetch_calendario_f1()
    if not events:
        print("❌ Nessun evento F1 trovato.")
        return

    adesso = datetime.now(timezone.utc)
    sessioni = []

    for event in events:
        round_data = event.get("round", {})
        round_number = round_data.get("number")
        round_name = round_data.get("name", "GP")
        circuit = event.get("circuit", {})

        schedule = event.get("schedule", [])
        for sess in schedule:
            code = sess.get("code", "")
            if code not in ("QUALIFYING", "SPRINT", "RACE"):
                continue

            timestamp_str = sess.get("timestamp")
            if not timestamp_str:
                continue

            dt = datetime.fromisoformat(timestamp_str.replace("Z", "+00:00"))
            ts = int(dt.timestamp())

            endpoint = {
                "QUALIFYING": "qualifying",
                "SPRINT": "sprint",
                "RACE": "results",
            }[code]

            risultati_ferrari = []
            if ts <= adesso.timestamp():
                risultati_ferrari = fetch_risultati_ferrari(round_number, endpoint)

            sessioni.append({
                "tipo": "f1",
                "sessione": determina_tipo_sessione(code),
                "codiceSessione": code,
                "round": round_number,
                "gp": round_name,
                "circuito": circuit.get("name", ""),
                "localita": circuit.get("locality", ""),
                "paese": circuit.get("country", ""),
                "startTimestamp": ts,
                "startIso": dt.isoformat(),
                "durata": durata_sessione(code),
                "risultatiFerrari": risultati_ferrari,
                "destinazione": determina_destinazione_f1(code),
            })

    sessioni.sort(key=lambda x: x["startTimestamp"])

    with open("calendar_f1.json", "w", encoding="utf-8") as f:
        json.dump(sessioni, f, indent=2, ensure_ascii=False)

    print(f"✅ Generate {len(sessioni)} sessioni F1.")


if __name__ == "__main__":
    fetch_f1()
