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
      <div class="label">Inizio ${s.sessione} tra:</div>
      <div class="countdown"
           data-ts="${s.startTimestamp}"
           data-durata="${durata}"
           data-url="${url}"></div>
    </div>
    ${risultatiHtml}
  `;
}
