/* charts.js
 * Piccole utility di disegno su <canvas>, senza dipendenze esterne:
 * - drawPieChart: grafico a torta (usato nel riepilogo mensile)
 * - drawTrendChart: grafico a barre/linee per lo storico multi-mese
 * Gestiscono devicePixelRatio per rendere bene su schermi retina (iPhone).
 */

/* Le variabili CSS (--text, --muted, --border, ...) cambiano automaticamente
 * tra chiaro/scuro, ma un <canvas> non le legge da solo: i colori vanno letti
 * "a mano" dal DOM ad ogni disegno con getComputedStyle, così i grafici
 * seguono il tema invece di restare fissi sui toni pensati per la modalità
 * chiara (bug: testo quasi nero illeggibile su sfondo scuro). */
function cssVar(name, fallback) {
  const v = getComputedStyle(document.body).getPropertyValue(name).trim();
  return v || fallback;
}

function setupCanvasDPR(canvas) {
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  // Nota: la dimensione "logica" va presa SOLO dal layout CSS (getBoundingClientRect),
  // mai dalle proprietà canvas.width/canvas.height: quelle vengono riscritte qui sotto
  // a ogni disegno, quindi rileggerle come fallback farebbe crescere il canvas
  // ad ogni redraw (bug corretto: prima si "auto-ingrandiva" ad ogni ridisegno).
  const width = rect.width > 0 ? rect.width : 300;
  const height = rect.height > 0 ? rect.height : 220;
  canvas.width = width * dpr;
  canvas.height = height * dpr;
  const ctx = canvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { ctx, width, height };
}

function drawPieChart(canvas, slices) {
  // slices: [{ label, value, color }]
  const { ctx, width, height } = setupCanvasDPR(canvas);
  ctx.clearRect(0, 0, width, height);

  const total = slices.reduce((a, s) => a + Math.max(s.value, 0), 0);
  const cx = width * 0.32;
  const cy = height / 2;
  const radius = Math.min(cx, cy) - 10;

  if (total <= 0) {
    ctx.strokeStyle = cssVar("--muted", "#7a8291");
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = cssVar("--muted", "#7a8291");
    ctx.font = "13px -apple-system, system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Nessun dato", cx, cy + 4);
    return;
  }

  let start = -Math.PI / 2;
  slices.forEach((s) => {
    if (s.value <= 0) return;
    const angle = (Math.max(s.value, 0) / total) * Math.PI * 2;
    ctx.beginPath();
    // Una singola categoria al 100% (sweep = giro completo) va disegnata come
    // cerchio pieno esplicito: alcuni motori di rendering non riempiono
    // correttamente un arco il cui angolo finale coincide con quello iniziale.
    if (angle >= Math.PI * 2 - 0.001) {
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    } else {
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, radius, start, start + angle);
      ctx.closePath();
    }
    ctx.fillStyle = s.color;
    ctx.fill();
    start += angle;
  });

  // buco centrale per stile "donut"
  ctx.beginPath();
  ctx.arc(cx, cy, radius * 0.55, 0, Math.PI * 2);
  ctx.fillStyle = cssVar("--card-bg", "#fff");
  ctx.fill();

  // legenda a destra
  const legendX = width * 0.58;
  let legendY = cy - (slices.length * 22) / 2 + 8;
  const legendTextColor = cssVar("--text", "#1c1e21");
  ctx.textAlign = "left";
  ctx.font = "13px -apple-system, system-ui, sans-serif";
  slices.forEach((s) => {
    const pct = total > 0 ? (s.value / total) * 100 : 0;
    ctx.fillStyle = s.color;
    ctx.fillRect(legendX, legendY - 10, 12, 12);
    ctx.fillStyle = legendTextColor;
    ctx.fillText(`${s.label} ${pct.toFixed(1)}%`, legendX + 18, legendY);
    legendY += 22;
  });
}

function drawTrendChart(canvas, series, labels) {
  // series: [{ name, color, values: number[] }], labels: string[] (stesso length dei values)
  const { ctx, width, height } = setupCanvasDPR(canvas);
  ctx.clearRect(0, 0, width, height);

  const padding = { top: 16, right: 20, bottom: 28, left: 48 };
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;

  const allValues = series.flatMap((s) => s.values);
  const maxVal = Math.max(...allValues, 1);
  const minVal = Math.min(...allValues, 0);
  const range = maxVal - minVal || 1;

  const n = labels.length;
  const stepX = n > 1 ? chartW / (n - 1) : 0;

  function xFor(i) {
    return padding.left + (n > 1 ? i * stepX : chartW / 2);
  }
  function yFor(v) {
    return padding.top + chartH - ((v - minVal) / range) * chartH;
  }

  // riga dello zero: sempre presente quando lo zero cade STRETTAMENTE dentro il
  // range (se minVal o maxVal coincidono già con 0, è già una delle griglie sotto),
  // così il grafico ha sempre un riferimento visibile tra valori positivi/negativi.
  // Calcolata prima delle griglie normali per poter evitare che le due etichette
  // (es. "-59" e "0") finiscano troppo vicine e si sovrappongano.
  const hasZeroLine = minVal < 0 && maxVal > 0;
  const y0 = hasZeroLine ? yFor(0) : null;
  const MIN_LABEL_GAP = 12; // px minimi tra due etichette sull'asse Y

  // griglia orizzontale + etichette asse Y
  const gridColor = cssVar("--border", "#e6e8ec");
  const labelColor = cssVar("--muted", "#7a8291");
  ctx.strokeStyle = gridColor;
  ctx.fillStyle = labelColor;
  ctx.font = "11px -apple-system, system-ui, sans-serif";
  ctx.textAlign = "right";
  const gridLines = 4;
  for (let g = 0; g <= gridLines; g++) {
    const v = minVal + (range * g) / gridLines;
    const y = yFor(v);
    ctx.beginPath();
    ctx.moveTo(padding.left, y);
    ctx.lineTo(width - padding.right, y);
    ctx.stroke();
    // Salta l'etichetta numerica se cade troppo vicina a quella dello zero (sotto):
    // la riga dello zero ha sempre la priorità, evita così testi sovrapposti/illeggibili.
    if (hasZeroLine && Math.abs(y - y0) < MIN_LABEL_GAP) continue;
    ctx.fillStyle = labelColor;
    ctx.fillText(Math.round(v).toLocaleString("it-IT"), padding.left - 6, y + 3);
  }

  if (hasZeroLine) {
    ctx.strokeStyle = labelColor;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(padding.left, y0);
    ctx.lineTo(width - padding.right, y0);
    ctx.stroke();
    ctx.fillStyle = labelColor;
    ctx.textAlign = "right";
    ctx.fillText("0", padding.left - 6, y0 + 3);
  }

  // etichette asse X (mostra al massimo ~6 etichette per non affollare).
  // La prima/ultima etichetta sono allineate rispettivamente a sinistra/destra
  // (non centrate) così non escono dal bordo del canvas e non vengono tagliate.
  // L'ultima etichetta (mese corrente) viene sempre mostrata: se quella "di turno"
  // per la spaziatura le cade troppo vicina, viene saltata per non sovrapporsi.
  const labelEvery = Math.ceil(n / 6) || 1;
  labels.forEach((lab, i) => {
    const isLast = i === n - 1;
    const isScheduled = i % labelEvery === 0;
    if (!isScheduled && !isLast) return;
    if (!isLast && n - 1 - i < labelEvery) return;
    if (i === 0) ctx.textAlign = "left";
    else if (isLast) ctx.textAlign = "right";
    else ctx.textAlign = "center";
    ctx.fillText(lab, xFor(i), height - 8);
  });

  // linee serie
  series.forEach((s) => {
    ctx.beginPath();
    s.values.forEach((v, i) => {
      const x = xFor(i);
      const y = yFor(v);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.strokeStyle = s.color;
    ctx.lineWidth = 2.5;
    ctx.stroke();

    s.values.forEach((v, i) => {
      ctx.beginPath();
      ctx.arc(xFor(i), yFor(v), 3.5, 0, Math.PI * 2);
      ctx.fillStyle = s.color;
      ctx.fill();
    });
  });
}

// Ridisegna tutti i canvas registrati quando la finestra viene ridimensionata
const chartRedrawCallbacks = [];
function registerChartRedraw(fn) {
  chartRedrawCallbacks.push(fn);
}
window.addEventListener("resize", () => {
  clearTimeout(window.__chartResizeTimer);
  window.__chartResizeTimer = setTimeout(() => {
    chartRedrawCallbacks.forEach((fn) => fn());
  }, 150);
});
