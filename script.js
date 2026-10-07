// =====================================================
// CONFIGURAZIONE
// =====================================================
const MARGINE_MS = 0;
const FINESTRA_HERO_MS = 48 * 60 * 60 * 1000; // 48 ore

// Durata partita calcio (in secondi) — usata solo per Inter
const DURATA_CALCIO = 3 * 60 * 60; // 3 ore

// =====================================================
// ELEMENTI
// =====================================================
const elStato = document.getElementById("stato");
const elErrore = document.getElementById("errore");
const elErrDettaglio = document.getElementById("errore-dettaglio");
const elHero = document.getElementById("hero");
const elHeroList = document.getElementById("hero-list");
const elSezioneInter = document.getElementById("sezione-inter");
const elSezioneF1 = document.getElementById("sezione-f1");
const elCardInter = document.getElementById("card-inter");
const elCardF1 = document.getElementById("card-f1");

// Traccia lo stato degli elementi countdown (per evitare re-render inutili)
const statoElementi = new WeakMap();

// Flag globale: se true, il redirect automatico è già stato fatto
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

  const parti = [];
  if (g > 0) parti.push(`${g}g`);
  parti.push(`${String(h).padStart(2, "0")}h`);
  parti.push(`${String(m).padStart(2, "0")}m`);
  parti.push(`${String(s).padStart(2, "0")}s`);
  return parti.join(" ");
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

    // ---- Prossima partita Inter ----
    const prossimaInter = calcio.find(p => p.startTimestamp > adessoSecondi);

    // ---- Prossima sessione F1 ----
    const prossimaF1 = f1.find(s => s.startTimestamp > adessoSecondi);

    // ---- HERO: eventi nelle prossime 48 ore ----
    const eventiHero = [];

    if (prossimaInter) {
      eventiHero.push({
        tipo: "calcio",
        titolo: `${prossimaInter.home_team} – ${prossimaInter.away_team}`,
        sottotitolo: prossimaInter.competizione,
        timestamp: prossimaInter.startTimestamp,
        durata: DURATA_CALCIO,
        url: prossimaInter.destinazione?.tipo === "sito"
          ? prossimaInter.destinazione.url
          : "",
      });
    }

    f1.forEach(s => {
      const diff = s.startTimestamp * 1000 - Date.now();
      if (diff > 0 && diff <= FINESTRA_HERO_MS) {
        eventiHero.push({
          tipo: "f1",
          titolo: `${s.gp} – ${s.sessione}`,
          sottotitolo: `${s.circuito}${s.localita ? ", " + s.localita : ""}`,
          timestamp: s.startTimestamp,
          durata: s.durata || 2 * 60 * 60,
          url: s.destinazione?.url || "",
        });
      }
    });

    eventiHero.sort((a, b) => a.timestamp - b.timestamp);

    if (eventiHero.length > 0) {
      elHero.hidden = false;
      elHeroList.innerHTML = eventiHero.map(e => `
        <div class="hero-item ${e.tipo === "f1" ? "f1" : ""}">
          <div class="info">
            <div class="titolo">${e.titolo}</div>
            <div class="sottotitolo">${e.sottotitolo}</div>
          </div>
          <div class="countdown"
               data-ts="${e.timestamp}"
               data-durata="${e.durata}"
               data-url="${e.url}"></div>
        </div>
      `).join("");
    }

    // ---- SEZIONE INTER ----
    if (prossimaInter) {
      elSezioneInter.hidden = false;
      elCardInter.innerHTML = renderCardInter(prossimaInter);
    }

    // ---- SEZIONE F1 ----
    if (prossimaF1) {
      elSezioneF1.hidden = false;
      elCardF1.innerHTML = renderCardF1(prossimaF1);
    }

    elStato.hidden = true;
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
    ${d.servizio ? `<div class="tv">📺 ${d.servizio}</div>` : ""}
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
    <div class="f1-header">
      <div class="f1-sessione">${s.sessione}</div>
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
    ${d.servizio ? `<div class="tv">📺 ${d.servizio}</div>` : ""}
    ${risultatiHtml}
  `;
}

// =====================================================
// COUNTDOWN CON LOGICA EVENTI IN CORSO
// =====================================================
function avviaTuttiCountdown() {
  function tick() {
    const adesso = Date.now();

    // Prendi tutti gli elementi countdown
    const elementi = Array.from(document.querySelectorAll("[data-ts]"));

    // Prima passata: quanti eventi sono in corso?
    const eventiInCorso = elementi.filter(el => {
      const ts = parseInt(el.dataset.ts, 10) * 1000;
      const durata = parseInt(el.dataset.durata, 10) * 1000;
      return adesso >= ts && adesso < ts + durata;
    });

    // Seconda passata: aggiorna ogni elemento
    elementi.forEach(el => {
      const ts = parseInt(el.dataset.ts, 10) * 1000;
      const durata = parseInt(el.dataset.durata, 10) * 1000;
      const url = el.dataset.url || "";
      const diff = ts - adesso;
      const statoPrecedente = statoElementi.get(el) || "";

      if (diff > 0) {
        // ---- In attesa ----
        el.textContent = formattaCountdown(ts);
        statoElementi.set(el, "attesa");

      } else if (adesso < ts + durata) {
        // ---- In corso ----

        // Caso 1: unico evento in corso con redirect → redirect automatico
        if (eventiInCorso.length === 1 && url && !redirectEffettuato) {
          redirectEffettuato = true;
          window.location.replace(url);
          return;
        }

        // Caso 2: più eventi in corso, oppure evento senza redirect
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
