// =====================================================
// CONFIGURAZIONE
// =====================================================
const MARGINE_MS = 0;
const DURATA_CALCIO = 3 * 60 * 60; // 3 ore (in secondi)

// =====================================================
// ELEMENTI
// =====================================================
const elStato = document.getElementById("stato");
const elErrore = document.getElementById("errore");
const elErrDettaglio = document.getElementById("errore-dettaglio");
const elGriglia = document.getElementById("griglia");
const elCardInter = document.getElementById("card-inter");
const elCardF1 = document.getElementById("card-f1");

// Stato degli elementi countdown
const statoElementi = new WeakMap();

// Se true, il redirect automatico è già stato fatto (per non rifarlo)
let redirectEffettuato = false;

// =====================================================
// UTILS
// =====================================================
function formattaCountdown(tsMs) {
  const diff = tsMs - Date.now();
  if (diff <= 0) return "in corso";

  const g = Math.floor(diff / (1000 * 60 * 60 * 24));
  const h = Math.floor((diff / (1000 * 60 * 60)) % 24);
  const m = Math.floor((diff / (1000 * 60)) % 60);
  const s = Math.floor((diff / 1000) % 60);

  // Se manca almeno 1 giorno: niente secondi
  if (g > 0) {
    return `${g}g ${String(h).padStart(2, "0")}h ${String(m).padStart(2, "0")}m`;
  }

  // Sotto le 24 ore: ore + minuti + secondi
  return `${String(h).padStart(2, "0")}h ${String(m).padStart(2, "0")}m ${String(s).padStart(2, "0")}s`;
}

function formattaDataOra(tsSecondi) {
  const data = new Date(tsSecondi * 1000);
  return data.toLocaleString("it-IT", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// =====================================================
// INIT
// =====================================================
async function init() {
  try {
    const [calcio, f1] = await Promise.all([
      fetch("calendar.json?t=" + Date.now()).then(r => r.json()),
      fetch("calendar_f1.json?t=" + Date.now()).then(r => r.json()),
    ]);

    const adessoSecondi = Date.now() / 1000;

    const prossimaInter = calcio.find(p => p.startTimestamp > adessoSecondi);
    const prossimaF1 = f1.find(s => s.startTimestamp > adessoSecondi);

    if (prossimaInter) {
      elCardInter.innerHTML = renderCardInter(prossimaInter);
    } else {
      elCardInter.innerHTML = `<p class="nota info">Nessuna partita in programma</p>`;
    }

    if (prossimaF1) {
      elCardF1.innerHTML = renderCardF1(prossimaF1);
    } else {
      elCardF1.innerHTML = `<p class="nota info">Nessuna sessione in programma</p>`;
    }

    elStato.hidden = true;
    elGriglia.hidden = false;

    avviaTuttiCountdown();

  } catch (err) {
    console.error(err);
    elStato.hidden = true;
    elErrore.hidden = false;
    elErrDettaglio.textContent = err.message;
  }
}

// =====================================================
// RENDER CARD INTER
// =====================================================
function renderCardInter(p) {
  const d = p.destinazione || {};
  let notaHtml = "";
  if (d.tipo === "esterno") {
    notaHtml = `<div class="nota">⚠️ ${d.messaggio || "Non disponibile sul nostro sito"}</div>`;
  } else if (d.tipo === "tv") {
    notaHtml = `<div class="nota tv">📡 ${d.messaggio || "In chiaro in TV"}</div>`;
  } else if (d.tipo === "sconosciuto") {
    notaHtml = `<div class="nota info">ℹ️ ${d.messaggio || "Non disponibile sul nostro sito"}</div>`;
  }

  const url = d.tipo === "sito" ? (d.url || "") : "";

  return `
    <div class="competizione">${p.competizione}</div>
    <div class="squadre">
      <div class="squadra">
        <img class="logo" src="${p.home_logo}" alt="${p.home_team}">
        <span class="nome">${p.home_team}</span>
      </div>
      <span class="vs">VS</span>
      <div class="squadra">
        <img class="logo" src="${p.away_logo}" alt="${p.away_team}">
        <span class="nome">${p.away_team}</span>
      </div>
    </div>
    <div class="data-ora">${formattaDataOra(p.startTimestamp)}</div>
    <div class="countdown-box">
      <div class="label">Manca</div>
      <div class="countdown"
           data-ts="${p.startTimestamp}"
           data-durata="${DURATA_CALCIO}"
           data-url="${url}"></div>
    </div>
    ${notaHtml}
  `;
}

// =====================================================
// RENDER CARD F1
// =====================================================
function renderCardF1(s) {
  let risultatiHtml = "";
  if (s.risultatiFerrari && s.risultatiFerrari.length > 0) {
    risultatiHtml = `
      <div class="f1-risultati">
        <div class="f1-risultati-titolo">Ferrari</div>
        ${s.risultatiFerrari.map(f => `
          <div class="ferrari-row">
            <span>${f.pilota}</span>
            <span class="pos">P${f.posizione}</span>
          </div>
        `).join("")}
      </div>
    `;
  }

  const d = s.destinazione || {};
  const url = d.url || "";
  const durata = s.durata || 2 * 60 * 60;

  return `
    <div class="f1-sessione">${s.sessione}</div>
    <div class="f1-header">
      <div class="f1-gp">${s.gp}</div>
      <div class="f1-luogo">${s.circuito}${s.localita ? ", " + s.localita : ""}</div>
    </div>
    <div class="data-ora">${formattaDataOra(s.startTimestamp)}</div>
    <div class="countdown-box">
      <div class="label">Manca</div>
      <div class="countdown"
           data-ts="${s.startTimestamp}"
           data-durata="${durata}"
           data-url="${url}"></div>
    </div>
    ${risultatiHtml}
  `;
}

// =====================================================
// COUNTDOWN CON LOGICA "EVENTI IN CORSO"
// =====================================================
function avviaTuttiCountdown() {
  function tick() {
    const adesso = Date.now();
    const elementi = Array.from(document.querySelectorAll("[data-ts]"));

    // Quanti eventi sono in corso in questo momento?
    const eventiInCorso = elementi.filter(el => {
      const ts = parseInt(el.dataset.ts, 10) * 1000;
      const durata = parseInt(el.dataset.durata, 10) * 1000;
      return adesso >= ts && adesso < ts + durata;
    });

    // Se ci sono 2+ eventi in corso, marca TUTTI come "no redirect auto"
    // Il flag resta per tutta la durata dell'evento, anche se poi l'altro finisce
    if (eventiInCorso.length > 1) {
      eventiInCorso.forEach(e => {
        e.dataset.noAutoRedirect = "true";
      });
    }

    elementi.forEach(el => {
      const ts = parseInt(el.dataset.ts, 10) * 1000;
      const durata = parseInt(el.dataset.durata, 10) * 1000;
      const url = el.dataset.url || "";
      const noAuto = el.dataset.noAutoRedirect === "true";
      const diff = ts - adesso;
      const statoPrecedente = statoElementi.get(el) || "";

      if (diff > 0) {
        // ---- In attesa ----
        el.textContent = formattaCountdown(ts);
        statoElementi.set(el, "attesa");

      } else if (adesso < ts + durata) {
        // ---- In corso ----

        // Redirect automatico SOLO se:
        //   - è l'unico evento in corso
        //   - non è mai stato in sovrapposizione
        //   - il redirect non è già stato fatto
        //   - l'evento ha un URL
        const puoRedirectAuto = (
          eventiInCorso.length === 1 &&
          !noAuto &&
          url &&
          !redirectEffettuato
        );

        if (puoRedirectAuto) {
          redirectEffettuato = true;
          window.location.replace(url);
          return;
        }

        // Altrimenti: mostra bottone (se c'è URL) o "in corso"
        if (url) {
          if (statoPrecedente !== "bottone") {
            el.innerHTML = `<button class="btn-guarda">Guarda ora</button>`;
            el.querySelector(".btn-guarda").addEventListener("click", () => {
              window.location.href = url;
            });
            statoElementi.set(el, "bottone");
          }
        } else {
          if (statoPrecedente !== "in-corso") {
            el.textContent = "in corso";
            statoElementi.set(el, "in-corso");
          }
        }

      } else {
        // ---- Terminato ----
        if (statoPrecedente !== "terminato") {
          el.textContent = "terminato";
          statoElementi.set(el, "terminato");
        }
      }
    });
  }

  tick();
  setInterval(tick, 1000);
}

// =====================================================
// VIA!
// =====================================================
init();
