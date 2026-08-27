/* app.js
 * Logica UI: navigazione tra le view, rendering del riepilogo mensile,
 * dello storico e delle impostazioni, gestione del modale aggiungi/modifica voce.
 */

const COLORS = {
  necessarie: "#e8a33d",
  svago: "#4caf7d",
  risparmi: "#8a5fd6",
  investimenti: "#4a90d9",
  entrate: "#c9b400"
};

const BUCKET_LABELS = {
  necessarie: "spesa necessaria",
  investimenti: "investimento",
  svago: "spesa svago",
  entrate: "entrata extra"
};

let state = {
  currentMonthKey: null,
  currentView: "riepilogo",
  modal: { bucket: null, itemId: null }
};

function categoriesForBucket(bucket) {
  return Store.data.settings.categories[bucket] || [];
}

function currentMonth() {
  return Store.getMonth(state.currentMonthKey);
}

/* ---------------------------------------------------------------- */
/* Navigazione tab                                                   */
/* ---------------------------------------------------------------- */

function switchView(view) {
  state.currentView = view;
  document.querySelectorAll(".view").forEach((el) => el.classList.add("hidden"));
  document.getElementById(`view-${view}`).classList.remove("hidden");
  document.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.view === view);
  });
  if (view === "riepilogo") renderRiepilogo();
  if (view === "storico") renderStorico();
  if (view === "impostazioni") renderImpostazioni();
}

/* ---------------------------------------------------------------- */
/* RIEPILOGO MESE CORRENTE                                           */
/* ---------------------------------------------------------------- */

function renderRiepilogo() {
  const month = currentMonth();
  const settings = Store.data.settings;
  const stats = computeMonthStats(month, settings);

  document.getElementById("current-month-label").textContent = monthLabel(state.currentMonthKey);
  document.getElementById("input-stipendio").value = month.stipendio || "";

  document.getElementById("summary-grid").innerHTML =
    summaryCellHTML("necessarie", "Spese necessarie", stats.totaleNecessarie, stats.sogliaNecessarie, false) +
    summaryCellHTML("svago", "Spese per svago", stats.totaleSvago, stats.sogliaSvago, false) +
    summaryCellHTML("risparmi", "Risparmi", stats.risparmi, stats.sogliaRisparmiMin, true);

  drawPieChart(document.getElementById("pie-chart"), [
    { label: "Necessarie", value: stats.necessarie, color: COLORS.necessarie },
    { label: "Investimenti", value: stats.investimenti, color: COLORS.investimenti },
    { label: "Svago", value: stats.totaleSvago, color: COLORS.svago },
    { label: "Risparmi", value: Math.max(stats.risparmi, 0), color: COLORS.risparmi }
  ]);

  renderBucketList("necessarie");
  renderBucketList("investimenti");
  renderBucketList("svago");
  renderBucketList("entrate");
}

function summaryCellHTML(type, label, value, soglia, isMin) {
  let pct = soglia > 0 ? (value / soglia) * 100 : 0;
  pct = Math.max(0, Math.min(100, pct));
  const over = isMin ? value < soglia - 0.001 : value > soglia + 0.001;
  const subLabel = isMin ? "Minimo" : "Massimo";
  return `
    <div class="summary-cell ${type}">
      <div class="label">${label}</div>
      <div class="value">${formatEUR(value)}</div>
      <div class="sub">${subLabel}: ${formatEUR(soglia)}</div>
      <div class="progress-track">
        <div class="progress-fill ${over ? "over" : ""}" style="width:${pct}%; background:${COLORS[type]}"></div>
      </div>
    </div>`;
}

function renderBucketList(bucket) {
  const month = currentMonth();
  const items = month[bucket];
  const total = sum(items);
  document.getElementById(`total-${bucket}`).textContent = formatEUR(total);

  const list = document.getElementById(`list-${bucket}`);
  if (items.length === 0) {
    list.innerHTML = `<li class="item-empty">Nessuna voce questo mese</li>`;
    return;
  }
  list.innerHTML = items
    .slice()
    .reverse()
    .map(
      (item) => `
      <li data-id="${item.id}" data-bucket="${bucket}">
        <div>
          <span class="item-note">${escapeHTML(item.note || "—")}${item.recurringId ? '<span class="fisso-badge">fisso</span>' : ""}</span>
          <span class="item-category">${escapeHTML(item.category || "")}</span>
        </div>
        <span class="item-amount">${formatEUR(item.amount)}</span>
      </li>`
    )
    .join("");

  list.querySelectorAll("li[data-id]").forEach((li) => {
    li.addEventListener("click", () => openModal(bucket, li.dataset.id));
  });
}

function escapeHTML(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

/* ---------------------------------------------------------------- */
/* MODALE AGGIUNGI / MODIFICA VOCE                                   */
/* ---------------------------------------------------------------- */

function openModal(bucket, itemId = null) {
  state.modal = { bucket, itemId };
  const month = currentMonth();
  const isEdit = !!itemId;
  const item = isEdit ? month[bucket].find((i) => i.id === itemId) : null;

  document.getElementById("modal-title").textContent = isEdit
    ? `Modifica ${BUCKET_LABELS[bucket]}`
    : `Aggiungi ${BUCKET_LABELS[bucket]}`;

  const select = document.getElementById("modal-category");
  select.innerHTML = categoriesForBucket(bucket)
    .map((c) => `<option value="${escapeHTML(c)}">${escapeHTML(c)}</option>`)
    .join("");

  document.getElementById("modal-amount").value = item ? item.amount : "";
  document.getElementById("modal-note").value = item ? item.note : "";
  if (item && item.category) select.value = item.category;

  document.getElementById("modal-delete").classList.toggle("hidden", !isEdit);
  document.getElementById("item-modal").classList.remove("hidden");
  setTimeout(() => document.getElementById("modal-amount").focus(), 50);
}

function closeModal() {
  document.getElementById("item-modal").classList.add("hidden");
  state.modal = { bucket: null, itemId: null };
}

function initModal() {
  document.getElementById("modal-cancel").addEventListener("click", closeModal);
  document.querySelector("#item-modal .modal-backdrop").addEventListener("click", closeModal);

  document.getElementById("item-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const { bucket, itemId } = state.modal;
    const amount = parseFloat(document.getElementById("modal-amount").value);
    const note = document.getElementById("modal-note").value.trim();
    const category = document.getElementById("modal-category").value;
    if (!amount || amount <= 0 || !note) return;

    if (itemId) {
      Store.updateItem(state.currentMonthKey, bucket, itemId, { amount, note, category });
    } else {
      Store.addItem(state.currentMonthKey, bucket, { amount, note, category });
    }
    closeModal();
    renderRiepilogo();
  });

  document.getElementById("modal-delete").addEventListener("click", () => {
    const { bucket, itemId } = state.modal;
    if (!itemId) return;
    if (!confirm("Eliminare questa voce?")) return;
    Store.removeItem(state.currentMonthKey, bucket, itemId);
    closeModal();
    renderRiepilogo();
  });

  document.querySelectorAll("[data-add]").forEach((btn) => {
    btn.addEventListener("click", () => openModal(btn.dataset.add));
  });
}

/* ---------------------------------------------------------------- */
/* MODALE SPESE FISSE (impostazioni)                                 */
/* ---------------------------------------------------------------- */

const RECURRING_BUCKET_LABELS = {
  necessarie: "Necessaria",
  svago: "Svago",
  investimenti: "Investimento"
};

let recurringModalState = { itemId: null };

function populateRecurringCategorySelect(bucket, selected) {
  const select = document.getElementById("recurring-category");
  select.innerHTML = categoriesForBucket(bucket)
    .map((c) => `<option value="${escapeHTML(c)}">${escapeHTML(c)}</option>`)
    .join("");
  if (selected) select.value = selected;
}

function openRecurringModal(itemId = null) {
  recurringModalState = { itemId };
  const isEdit = !!itemId;
  const item = isEdit ? Store.data.settings.recurringExpenses.find((r) => r.id === itemId) : null;

  document.getElementById("recurring-modal-title").textContent = isEdit ? "Modifica spesa fissa" : "Aggiungi spesa fissa";

  const bucketSelect = document.getElementById("recurring-bucket");
  bucketSelect.value = item ? item.bucket : "necessarie";
  populateRecurringCategorySelect(bucketSelect.value, item ? item.category : null);

  document.getElementById("recurring-amount").value = item ? item.amount : "";
  document.getElementById("recurring-note").value = item ? item.note : "";

  document.getElementById("recurring-delete").classList.toggle("hidden", !isEdit);
  document.getElementById("recurring-modal").classList.remove("hidden");
  setTimeout(() => document.getElementById("recurring-amount").focus(), 50);
}

function closeRecurringModal() {
  document.getElementById("recurring-modal").classList.add("hidden");
  recurringModalState = { itemId: null };
}

function renderRecurringList() {
  const list = document.getElementById("list-recurring");
  const items = Store.data.settings.recurringExpenses || [];
  if (items.length === 0) {
    list.innerHTML = `<li class="item-empty">Nessuna spesa fissa configurata</li>`;
    return;
  }
  list.innerHTML = items
    .map(
      (item) => `
      <li data-id="${item.id}">
        <div>
          <span class="item-note">${escapeHTML(item.note || "—")}</span>
          <span class="item-category">${RECURRING_BUCKET_LABELS[item.bucket] || item.bucket} · ${escapeHTML(item.category || "")}</span>
        </div>
        <span class="item-amount">${formatEUR(item.amount)}</span>
      </li>`
    )
    .join("");

  list.querySelectorAll("li[data-id]").forEach((li) => {
    li.addEventListener("click", () => openRecurringModal(li.dataset.id));
  });
}

function initRecurringModal() {
  document.getElementById("btn-add-recurring").addEventListener("click", () => openRecurringModal());
  document.getElementById("recurring-cancel").addEventListener("click", closeRecurringModal);
  document.querySelector("#recurring-modal .modal-backdrop").addEventListener("click", closeRecurringModal);

  document.getElementById("recurring-bucket").addEventListener("change", (e) => {
    populateRecurringCategorySelect(e.target.value);
  });

  document.getElementById("recurring-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const bucket = document.getElementById("recurring-bucket").value;
    const amount = parseFloat(document.getElementById("recurring-amount").value);
    const note = document.getElementById("recurring-note").value.trim();
    const category = document.getElementById("recurring-category").value;
    if (!amount || amount <= 0 || !note) return;

    if (recurringModalState.itemId) {
      Store.updateRecurring(recurringModalState.itemId, { bucket, amount, note, category });
    } else {
      Store.addRecurring({ bucket, amount, note, category });
    }
    closeRecurringModal();
    renderRecurringList();
  });

  document.getElementById("recurring-delete").addEventListener("click", () => {
    if (!recurringModalState.itemId) return;
    if (!confirm("Eliminare questa spesa fissa? Le voci già inserite nei mesi non verranno rimosse.")) return;
    Store.removeRecurring(recurringModalState.itemId);
    closeRecurringModal();
    renderRecurringList();
  });

  document.getElementById("btn-apply-recurring").addEventListener("click", () => {
    const added = Store.applyMissingRecurring(state.currentMonthKey);
    alert(added === 0 ? "Tutte le spese fisse sono già presenti in questo mese." : `Aggiunte ${added} spese fisse al mese corrente (${monthLabel(state.currentMonthKey)}).`);
  });
}

/* ---------------------------------------------------------------- */
/* STORICO                                                            */
/* ---------------------------------------------------------------- */

function renderStorico() {
  const keys = Store.monthsSortedKeys();
  const settings = Store.data.settings;

  if (keys.length === 0) {
    document.getElementById("trend-chart").getContext("2d").clearRect(0, 0, 9999, 9999);
    document.getElementById("averages-grid").innerHTML = `<p class="hint">Nessun dato storico ancora disponibile.</p>`;
    document.getElementById("history-table-body").innerHTML = `<tr><td colspan="5" class="item-empty">Nessun mese registrato</td></tr>`;
    return;
  }

  const statsPerMonth = keys.map((k) => ({ key: k, stats: computeMonthStats(Store.getMonth(k), settings) }));

  const labels = keys.map((k) => {
    const [y, m] = k.split("-").map(Number);
    const d = new Date(y, m - 1, 1);
    return d.toLocaleDateString("it-IT", { month: "short", year: "2-digit" });
  });

  drawTrendChart(
    document.getElementById("trend-chart"),
    [
      { name: "Necessarie", color: COLORS.necessarie, values: statsPerMonth.map((s) => s.stats.totaleNecessarie) },
      { name: "Svago", color: COLORS.svago, values: statsPerMonth.map((s) => s.stats.totaleSvago) },
      { name: "Risparmi", color: COLORS.risparmi, values: statsPerMonth.map((s) => s.stats.risparmi) }
    ],
    labels
  );

  const avgNecessarie = average(statsPerMonth.map((s) => s.stats.totaleNecessarie));
  const avgSvago = average(statsPerMonth.map((s) => s.stats.totaleSvago));
  const avgRisparmi = average(statsPerMonth.map((s) => s.stats.risparmi));

  document.getElementById("averages-grid").innerHTML = `
    <div class="summary-cell necessarie">
      <div class="label">Media necessarie</div>
      <div class="value">${formatEUR(avgNecessarie)}</div>
    </div>
    <div class="summary-cell svago">
      <div class="label">Media svago</div>
      <div class="value">${formatEUR(avgSvago)}</div>
    </div>
    <div class="summary-cell risparmi">
      <div class="label">Media risparmi</div>
      <div class="value">${formatEUR(avgRisparmi)}</div>
    </div>`;

  const rows = statsPerMonth
    .slice()
    .reverse()
    .map(
      ({ key, stats }) => `
      <tr data-key="${key}">
        <td>${monthLabel(key)}</td>
        <td>${formatEUR(stats.totaleEntrate)}</td>
        <td>${formatEUR(stats.totaleNecessarie)}</td>
        <td>${formatEUR(stats.totaleSvago)}</td>
        <td>${formatEUR(stats.risparmi)}</td>
      </tr>`
    )
    .join("");
  document.getElementById("history-table-body").innerHTML = rows;

  document.querySelectorAll("#history-table-body tr[data-key]").forEach((tr) => {
    tr.addEventListener("click", () => {
      state.currentMonthKey = tr.dataset.key;
      switchView("riepilogo");
      document.querySelectorAll(".tab-btn").forEach((b) => b.classList.toggle("active", b.dataset.view === "riepilogo"));
    });
  });
}

function average(arr) {
  if (arr.length === 0) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

/* ---------------------------------------------------------------- */
/* IMPOSTAZIONI                                                       */
/* ---------------------------------------------------------------- */

function renderImpostazioni() {
  const settings = Store.data.settings;
  document.getElementById("split-necessarie").value = settings.budgetSplit.necessarie;
  document.getElementById("split-svago").value = settings.budgetSplit.svago;
  document.getElementById("split-risparmi").value = settings.budgetSplit.risparmi;
  document.querySelectorAll('input[name="threshold-base"]').forEach((r) => {
    r.checked = r.value === settings.thresholdBase;
  });
  checkSplitSum();
  renderCategoriesEditor();
  renderRecurringList();
}

function checkSplitSum() {
  const n = parseFloat(document.getElementById("split-necessarie").value) || 0;
  const s = parseFloat(document.getElementById("split-svago").value) || 0;
  const r = parseFloat(document.getElementById("split-risparmi").value) || 0;
  const total = n + s + r;
  document.getElementById("split-warning").classList.toggle("hidden", Math.abs(total - 100) < 0.01);
  return { n, s, r, valid: Math.abs(total - 100) < 0.01 };
}

function initSettingsHandlers() {
  ["split-necessarie", "split-svago", "split-risparmi"].forEach((id) => {
    document.getElementById(id).addEventListener("input", () => {
      const { n, s, r } = checkSplitSum();
      Store.data.settings.budgetSplit = { necessarie: n, svago: s, risparmi: r };
      Store.save();
    });
  });

  document.querySelectorAll('input[name="threshold-base"]').forEach((r) => {
    r.addEventListener("change", (e) => {
      Store.data.settings.thresholdBase = e.target.value;
      Store.save();
    });
  });

  document.getElementById("btn-export").addEventListener("click", () => {
    const blob = new Blob([Store.exportJSON()], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const stamp = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `budget-tracker-backup-${stamp}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  });

  document.getElementById("btn-import").addEventListener("click", () => {
    document.getElementById("input-import-file").click();
  });

  document.getElementById("input-import-file").addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        Store.importJSON(reader.result);
        state.currentMonthKey = Store.monthsSortedKeys().slice(-1)[0] || monthKey(new Date());
        Store.ensureMonth(state.currentMonthKey);
        alert("Backup importato con successo.");
        switchView("riepilogo");
      } catch (err) {
        alert("Impossibile importare il file: " + err.message);
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  });

  document.getElementById("btn-reset").addEventListener("click", () => {
    if (!confirm("Sei sicuro? Tutti i dati salvati in questo browser verranno cancellati definitivamente.")) return;
    Store.resetAll();
    state.currentMonthKey = monthKey(new Date());
    Store.ensureMonth(state.currentMonthKey);
    switchView("riepilogo");
  });
}

function renderCategoriesEditor() {
  const types = [
    { key: "necessarie", label: "Spese necessarie" },
    { key: "svago", label: "Spese per svago" },
    { key: "entrate", label: "Entrate extra" },
    { key: "investimenti", label: "Investimenti" }
  ];
  const container = document.getElementById("categories-editor");
  container.innerHTML = types
    .map(
      (t) => `
    <div class="cat-group" data-type="${t.key}">
      <h4>${t.label}</h4>
      <div class="cat-tags">
        ${categoriesForBucket(t.key)
          .map((c) => `<span class="cat-tag">${escapeHTML(c)}<button data-remove="${escapeHTML(c)}">×</button></span>`)
          .join("")}
      </div>
      <div class="cat-add-row">
        <input type="text" placeholder="Nuova categoria…" />
        <button data-add-cat>Aggiungi</button>
      </div>
    </div>`
    )
    .join("");

  container.querySelectorAll(".cat-group").forEach((group) => {
    const type = group.dataset.type;
    group.querySelectorAll("[data-remove]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const list = Store.data.settings.categories[type];
        if (list.length <= 1) {
          alert("Deve rimanere almeno una categoria.");
          return;
        }
        Store.data.settings.categories[type] = list.filter((c) => c !== btn.dataset.remove);
        Store.save();
        renderCategoriesEditor();
      });
    });
    const input = group.querySelector("input");
    group.querySelector("[data-add-cat]").addEventListener("click", () => {
      const val = input.value.trim();
      if (!val) return;
      const list = Store.data.settings.categories[type];
      if (!list.includes(val)) {
        list.push(val);
        Store.save();
      }
      renderCategoriesEditor();
    });
  });
}

/* ---------------------------------------------------------------- */
/* INIT                                                               */
/* ---------------------------------------------------------------- */

function initTabs() {
  document.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => switchView(btn.dataset.view));
  });
}

function initMonthSwitcher() {
  document.getElementById("btn-prev-month").addEventListener("click", () => {
    state.currentMonthKey = shiftMonthKey(state.currentMonthKey, -1);
    Store.ensureMonth(state.currentMonthKey);
    renderRiepilogo();
  });
  document.getElementById("btn-next-month").addEventListener("click", () => {
    state.currentMonthKey = shiftMonthKey(state.currentMonthKey, 1);
    Store.ensureMonth(state.currentMonthKey);
    renderRiepilogo();
  });
  document.getElementById("input-stipendio").addEventListener("input", (e) => {
    const value = parseFloat(e.target.value) || 0;
    Store.setStipendio(state.currentMonthKey, value);
    renderRiepilogo();
  });
}

function init() {
  Store.load();
  state.currentMonthKey = monthKey(new Date());
  Store.ensureMonth(state.currentMonthKey);

  initTabs();
  initMonthSwitcher();
  initModal();
  initRecurringModal();
  initSettingsHandlers();

  registerChartRedraw(() => {
    if (state.currentView === "riepilogo") renderRiepilogo();
    if (state.currentView === "storico") renderStorico();
  });

  switchView("riepilogo");
}

document.addEventListener("DOMContentLoaded", init);
