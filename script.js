// =====================================================
// CONFIGURAZIONE
// =====================================================

// Dove reindirizzare quando la partita inizia.
// ⚠️ SOSTITUISCI con il tuo URL reale!
const URL_DESTINAZIONE = "https://il-tuo-sito-di-streaming.example";

// Se il countdown arriva a 0 ma per qualche motivo non vogliamo
// reindirizzare subito, mettiamo un piccolo margine (in ms).
// Utile per evitare redirect a partita non ancora iniziata per piccoli ritardi.
const MARGINE_MS = 0;

// =====================================================
// RIFERIMENTI AGLI ELEMENTI DELLA PAGINA
// =====================================================

const elStato       = document.getElementById("stato");
const elPartita     = document.getElementById("partita");
const elErrore      = document.getElementById("errore");
const elErrDettaglio = document.getElementById("errore-dettaglio");

const elCompetizione = document.getElementById("competizione");
const elHomeLogo     = document.getElementById("home-logo");
const elHomeNome     = document.getElementById("home-nome");
const elAwayLogo     = document.getElementById("away-logo");
const elAwayNome     = document.getElementById("away-nome");
const elDataOra      = document.getElementById("data-ora");
const elCountdown    = document.getElementById("countdown");
const elTv           = document.getElementById("tv");

// =====================================================
// FUNZIONE PRINCIPALE
// =====================================================

async function init() {
  try {
    // 1. Scarica il file calendar.json generato dalla GitHub Action.
    //    Aggiungiamo "?t=" + Date.now() per forzare il browser a NON usare
    //    una versione in cache vecchia.
    const risposta = await fetch("calendar.json?t=" + Date.now());

    if (!risposta.ok) {
      throw new Error(`HTTP ${risposta.status}`);
    }

    const partite = await risposta.json();

    if (!Array.isArray(partite) || partite.length === 0) {
      throw new Error("Nessuna partita nel calendario.");
    }

    // 2. Trova la prossima partita.
    //    Il calendario è già ordinato per timestamp crescente,
    //    quindi la prima partita con startTimestamp futuro è la prossima.
    const adessoSecondi = Date.now() / 1000;
    const prossima = partite.find(p => p.startTimestamp > adessoSecondi);

    if (!prossima) {
      throw new Error("Nessuna partita futura in calendario.");
    }

    // 3. Popola la pagina
    mostraPartita(prossima);

    // 4. Avvia il countdown
    avviaCountdown(prossima.startTimestamp);

  } catch (err) {
    console.error(err);
    mostraErrore(err.message);
  }
}

// =====================================================
// MOSTRA I DATI DELLA PARTITA
// =====================================================

function mostraPartita(p) {
  elCompetizione.textContent = p.competizione || "";
  elHomeNome.textContent = p.home_team || "";
  elAwayNome.textContent = p.away_team || "";
  elHomeLogo.src = p.home_logo || "";
  elHomeLogo.alt = p.home_team || "";
  elAwayLogo.src = p.away_logo || "";
  elAwayLogo.alt = p.away_team || "";

  // Data/ora formattata in italiano, nel fuso orario locale dell'utente
  const data = new Date(p.startTimestamp * 1000);
  elDataOra.textContent = data.toLocaleString("it-IT", {
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  });

  elTv.textContent = p.servizio ? `📺 ${p.servizio}` : "";

  // Nascondi lo stato "caricamento" e mostra la card
  elStato.hidden = true;
  elPartita.hidden = false;
}

// =====================================================
// COUNTDOWN
// =====================================================

function avviaCountdown(startTimestampSecondi) {
  const inizioMs = startTimestampSecondi * 1000;

  function tick() {
    const diff = inizioMs - Date.now() - MARGINE_MS;

    // Partita iniziata → redirect immediato
    if (diff <= 0) {
      window.location.replace(URL_DESTINAZIONE);
      return;
    }

    // Calcolo giorni/ore/minuti/secondi
    const giorni   = Math.floor(diff / (1000 * 60 * 60 * 24));
    const ore      = Math.floor((diff / (1000 * 60 * 60)) % 24);
    const minuti   = Math.floor((diff / (1000 * 60)) % 60);
    const secondi  = Math.floor((diff / 1000) % 60);

    elCountdown.textContent = formatta(giorni, ore, minuti, secondi);
  }

  // Esegui subito, poi ogni secondo
  tick();
  setInterval(tick, 1000);
}

function formatta(g, h, m, s) {
  const parti = [];
  if (g > 0) parti.push(`${g}g`);
  parti.push(`${String(h).padStart(2, "0")}h`);
  parti.push(`${String(m).padStart(2, "0")}m`);
  parti.push(`${String(s).padStart(2, "0")}s`);
  return parti.join(" ");
}

// =====================================================
// ERRORE
// =====================================================

function mostraErrore(dettaglio) {
  elStato.hidden = true;
  elPartita.hidden = true;
  elErrore.hidden = false;
  elErrDettaglio.textContent = dettaglio;
}

// =====================================================
// VIA!
// =====================================================

init();
