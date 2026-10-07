// =====================================================
// CONFIGURAZIONE
// =====================================================

// Margine (in ms) prima del calcio d'inizio.
// 0 = reindirizza esattamente al calcio d'inizio.
const MARGINE_MS = 0;

// =====================================================
// RIFERIMENTI AGLI ELEMENTI DELLA PAGINA
// =====================================================

const elStato         = document.getElementById("stato");
const elPartita       = document.getElementById("partita");
const elErrore        = document.getElementById("errore");
const elErrDettaglio  = document.getElementById("errore-dettaglio");

const elCompetizione  = document.getElementById("competizione");
const elHomeLogo      = document.getElementById("home-logo");
const elHomeNome      = document.getElementById("home-nome");
const elAwayLogo      = document.getElementById("away-logo");
const elAwayNome      = document.getElementById("away-nome");
const elDataOra       = document.getElementById("data-ora");
const elCountdown     = document.getElementById("countdown");
const elTv            = document.getElementById("tv");
const elNota          = document.getElementById("nota");

// =====================================================
// FUNZIONE PRINCIPALE
// =====================================================

async function init() {
  try {
    // 1. Scarica il file calendar.json generato dalla GitHub Action.
    //    "?t=" + Date.now() evita la cache del browser dopo l'aggiornamento.
    const risposta = await fetch("calendar.json?t=" + Date.now());

    if (!risposta.ok) {
      throw new Error(`HTTP ${risposta.status}`);
    }

    const partite = await risposta.json();

    if (!Array.isArray(partite) || partite.length === 0) {
      throw new Error("Nessuna partita nel calendario.");
    }

    // 2. Trova la prossima partita futura.
    //    L'array è già ordinato per startTimestamp crescente.
    const adessoSecondi = Date.now() / 1000;
    const prossima = partite.find(p => p.startTimestamp > adessoSecondi);

    if (!prossima) {
      throw new Error("Nessuna partita futura in calendario.");
    }

    // 3. Popola la pagina
    mostraPartita(prossima);

    // 4. Avvia il countdown
    avviaCountdown(prossima);

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

  const d = p.destinazione || {};

  elTv.textContent = d.servizio ? `📺 ${d.servizio}` : "";

  // Avviso (se la partita NON sarà trasmessa sul nostro sito)
  if (d.tipo === "esterno") {
    elNota.textContent = "⚠️ " + (d.messaggio || "Non disponibile sul nostro sito");
    elNota.className = "nota";
    elNota.hidden = false;
  } else if (d.tipo === "tv") {
    elNota.textContent = "📡 " + (d.messaggio || "In chiaro in TV");
    elNota.className = "nota tv";
    elNota.hidden = false;
  } else if (d.tipo === "sconosciuto") {
    elNota.textContent = "ℹ️ " + (d.messaggio || "Partita non disponibile sul nostro sito");
    elNota.className = "nota info";
    elNota.hidden = false;
  } else {
    elNota.hidden = true;
  }

  // Nascondi "caricamento" e mostra la card
  elStato.hidden = true;
  elPartita.hidden = false;
}

// =====================================================
// COUNTDOWN
// =====================================================

function avviaCountdown(partita) {
  const inizioMs = partita.startTimestamp * 1000;
  const d = partita.destinazione || {};

  // Salviamo l'id dell'intervallo per poterlo fermare
  const intervalId = setInterval(tick, 1000);

  function tick() {
    const diff = inizioMs - Date.now() - MARGINE_MS;

    // Fine del countdown: o redirect o avviso
    if (diff <= 0) {
      clearInterval(intervalId);   // ⬅️ fermiamo il tick, non serve più

      if (d.tipo === "sito" && d.url) {
        window.location.replace(d.url);
      } else {
        mostraAvvisoFinale(d);
      }
      return;
    }

    // Calcolo giorni/ore/minuti/secondi
    const giorni  = Math.floor(diff / (1000 * 60 * 60 * 24));
    const ore     = Math.floor((diff / (1000 * 60 * 60)) % 24);
    const minuti  = Math.floor((diff / (1000 * 60)) % 60);
    const secondi = Math.floor((diff / 1000) % 60);

    elCountdown.textContent = formatta(giorni, ore, minuti, secondi);
  }

  // Esegui subito, poi ogni secondo
  tick();
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
// AVVISO FINALE (partita iniziata ma niente redirect)
// =====================================================

function mostraAvvisoFinale(d) {
  const box = document.querySelector(".countdown-box");
  box.classList.add("avviso");

  const label = box.querySelector(".label");
  const countEl = document.getElementById("countdown");

  label.textContent = "La partita è iniziata!";
  countEl.textContent = d.messaggio || "Non disponibile sul nostro sito";
  countEl.style.fontSize = "1.05rem";
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
