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
  if (view === "analisi") renderAnalisi();
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
    summaryCellHTML("risparmi", "Risparmi del mese", stats.risparmi, stats.sogliaRisparmiMin, true);

  drawPieChart(document.getElementById("pie-chart"), [
    { label: "Necessarie", value: stats.necessarie, color: COLORS.necessarie },
    { label: "Investimenti", value: stats.investimenti, color: COLORS.investimenti },
    { label: "Svago", value: stats.totaleSvago, color: COLORS.svago },
    { label: "Risparmi", value: Math.max(stats.risparmi, 0), color: COLORS.risparmi }
  ]);

  renderBucketList("necessarie");
  renderBucketList("svago");
  renderBucketList("entrate");
  renderBucketList("investimenti");
}

function summaryCellHTML(type, label, value, soglia, isMin) {
  let pct = soglia > 0 ? (value / soglia) * 100 : 0;
  pct = Math.max(0, Math.min(100, pct));
  const over = soglia > 0 && (isMin ? value < soglia - 0.001 : value > soglia + 0.001);
  const subLabel = isMin ? "Minimo" : "Massimo";
  return `
    <div class="summary-cell ${type} ${over ? "over-limit" : ""}">
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
          <span class="item-note">${escapeHTML(item.note || "—")}${item.recurringId ? '<span class="fisso-badge">fisso</span>' : ""}${item.installmentId ? `<span class="rata-badge">${item.installmentIndex}/${item.installmentTotal}</span>` : ""}</span>
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

  // "Rateizza" ha senso solo per una spesa nuova (necessarie/investimenti/svago),
  // non quando si modifica una voce già esistente né per le entrate.
  const rateizzaApplicabile = !isEdit && bucket !== "entrate";
  document.getElementById("modal-rateizza-row").classList.toggle("hidden", !rateizzaApplicabile);
  document.getElementById("modal-rateizza").checked = false;
  document.getElementById("modal-installments-row").classList.add("hidden");
  document.getElementById("modal-installments-count").value = 2;
  document.getElementById("modal-amount-label").textContent = "Importo";
  document.getElementById("modal-rate-preview").classList.add("hidden");

  document.getElementById("modal-delete").classList.toggle("hidden", !isEdit);
  document.getElementById("modal-note-suggestions").classList.add("hidden");
  document.getElementById("item-modal").classList.remove("hidden");
  setTimeout(() => document.getElementById("modal-amount").focus(), 50);
}

function closeModal() {
  document.getElementById("item-modal").classList.add("hidden");
  document.getElementById("modal-note-suggestions").classList.add("hidden");
  state.modal = { bucket: null, itemId: null };
}

/* Autocompletamento del campo "Nota": suggerisce nomi già usati in precedenza
 * per lo stesso bucket (es. digitando "Li" suggerisce "Lidl" se già inserito
 * in un mese passato), cliccabili per completare il campo. */
function initNoteAutocomplete() {
  const noteInput = document.getElementById("modal-note");
  const suggBox = document.getElementById("modal-note-suggestions");

  function showSuggestions() {
    const bucket = state.modal.bucket;
    const q = noteInput.value.trim();
    if (!bucket || !q) {
      hideSuggestions();
      return;
    }
    const suggestions = Store.getNoteSuggestions(bucket, q);
    // Non proporre come suggerimento il testo già identico a quanto scritto.
    const filtered = suggestions.filter((s) => s.toLowerCase() !== q.toLowerCase());
    if (filtered.length === 0) {
      hideSuggestions();
      return;
    }
    suggBox.innerHTML = filtered
      .map((s) => `<div class="suggestion-item" data-value="${escapeHTML(s)}">${escapeHTML(s)}</div>`)
      .join("");
    suggBox.classList.remove("hidden");
  }

  function hideSuggestions() {
    suggBox.classList.add("hidden");
    suggBox.innerHTML = "";
  }

  noteInput.addEventListener("input", showSuggestions);
  noteInput.addEventListener("focus", showSuggestions);
  // "mousedown"/"touchstart" invece di "click": scattano PRIMA del blur
  // dell'input, altrimenti il blur nasconderebbe la tendina prima del click.
  suggBox.addEventListener("mousedown", (e) => {
    const item = e.target.closest(".suggestion-item");
    if (!item) return;
    e.preventDefault();
    noteInput.value = item.dataset.value;
    hideSuggestions();
  });
  noteInput.addEventListener("blur", () => {
    setTimeout(hideSuggestions, 150);
  });
}

/* Calcola come viene diviso un importo TOTALE in N rate: la stessa logica di
 * Store.installmentAmountForIndex, usata qui solo per mostrare un'anteprima
 * dal vivo mentre si compila il modulo (l'ultima rata assorbe il resto). */
function computeInstallmentSplit(totalAmount, count) {
  if (!totalAmount || totalAmount <= 0 || !count || count < 2) return null;
  const base = Math.round((totalAmount / count) * 100) / 100;
  const last = Math.round((totalAmount - base * (count - 1)) * 100) / 100;
  return { base, last, count };
}

function formatInstallmentPreview(split) {
  if (!split) return "";
  const { base, last, count } = split;
  if (base === last) return `${count} rate da ${formatEUR(base)} al mese.`;
  return `${count - 1} rate da ${formatEUR(base)} + 1 rata finale da ${formatEUR(last)}.`;
}

function initModal() {
  document.getElementById("modal-cancel").addEventListener("click", closeModal);
  document.querySelector("#item-modal .modal-backdrop").addEventListener("click", closeModal);

  function updateRatePreview() {
    const rateizzaOn = document.getElementById("modal-rateizza").checked;
    const preview = document.getElementById("modal-rate-preview");
    if (!rateizzaOn) {
      preview.classList.add("hidden");
      return;
    }
    const amount = parseFloat(document.getElementById("modal-amount").value);
    const count = parseInt(document.getElementById("modal-installments-count").value, 10);
    const split = computeInstallmentSplit(amount, count);
    if (!split) {
      preview.classList.add("hidden");
      return;
    }
    preview.textContent = formatInstallmentPreview(split);
    preview.classList.remove("hidden");
  }

  document.getElementById("modal-rateizza").addEventListener("change", (e) => {
    document.getElementById("modal-installments-row").classList.toggle("hidden", !e.target.checked);
    document.getElementById("modal-amount-label").textContent = e.target.checked ? "Importo totale" : "Importo";
    updateRatePreview();
  });
  document.getElementById("modal-amount").addEventListener("input", updateRatePreview);
  document.getElementById("modal-installments-count").addEventListener("input", updateRatePreview);

  document.getElementById("item-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const { bucket, itemId } = state.modal;
    const amount = parseFloat(document.getElementById("modal-amount").value);
    const note = document.getElementById("modal-note").value.trim();
    const category = document.getElementById("modal-category").value;
    if (!amount || amount <= 0 || !note) return;

    const rateizzaRowVisibile = !document.getElementById("modal-rateizza-row").classList.contains("hidden");
    const rateizza = rateizzaRowVisibile && document.getElementById("modal-rateizza").checked;

    if (rateizza) {
      const totalInstallments = parseInt(document.getElementById("modal-installments-count").value, 10);
      if (!totalInstallments || totalInstallments < 2) {
        alert("Il numero di rate deve essere almeno 2.");
        return;
      }
      // Crea il piano di rate a partire dal mese corrente. Applica subito le rate
      // mancanti a TUTTI i mesi già aperti (non solo quello corrente): se il mese
      // di partenza è nel passato, i mesi successivi già esistenti (es. quello
      // corrente reale) devono ricevere subito la rata che gli spetta, non solo
      // al prossimo giro di navigazione.
      Store.addInstallmentPlan({ bucket, amount, note, category, totalInstallments, startMonthKey: state.currentMonthKey });
      Store.applyMissingInstallmentsToAllMonths();
    } else if (itemId) {
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
    const added = Store.applyMissingRecurringToAllMonths();
    alert(added === 0 ? "Tutte le spese fisse sono già presenti in tutti i mesi già aperti." : `Aggiunte ${added} voci mancanti nei mesi già aperti.`);
    renderRiepilogo();
  });
}

/* ---------------------------------------------------------------- */
/* BONIFICO RICORRENTE TRA CONTI (impostazioni)                      */
/* ---------------------------------------------------------------- */

let bonificoModalState = { itemId: null };

function renderBonifico() {
  const b = Store.data.settings.bonifico;
  const totals = computeBonifico(b);

  document.getElementById("bonifico-from-label").value = b.fromLabel;
  document.getElementById("bonifico-to-label").value = b.toLabel;

  document.getElementById("bonifico-total-value").textContent = formatEUR(totals.total);
  document.getElementById("bonifico-total-sub").textContent = `${b.fromLabel} → ${b.toLabel}`;

  const items = b.monthly;
  const list = document.getElementById("list-bonifico-monthly");
  if (items.length === 0) {
    list.innerHTML = `<li class="item-empty">Nessuna voce</li>`;
  } else {
    list.innerHTML = items
      .map(
        (item) => `
        <li data-id="${item.id}">
          <span class="item-note">${escapeHTML(item.note || "—")}</span>
          <span class="item-amount">${formatEUR(item.amount)}</span>
        </li>`
      )
      .join("");
    list.querySelectorAll("li[data-id]").forEach((li) => {
      li.addEventListener("click", () => openBonificoModal(li.dataset.id));
    });
  }
}

function openBonificoModal(itemId = null) {
  bonificoModalState = { itemId };
  const isEdit = !!itemId;
  const item = isEdit ? Store.data.settings.bonifico.monthly.find((i) => i.id === itemId) : null;

  document.getElementById("bonifico-modal-title").textContent = isEdit ? "Modifica spesa" : "Aggiungi spesa mensile";
  document.getElementById("bonifico-amount").value = item ? item.amount : "";
  document.getElementById("bonifico-note").value = item ? item.note : "";
  document.getElementById("bonifico-delete").classList.toggle("hidden", !isEdit);
  document.getElementById("bonifico-modal").classList.remove("hidden");
  setTimeout(() => document.getElementById("bonifico-amount").focus(), 50);
}

function closeBonificoModal() {
  document.getElementById("bonifico-modal").classList.add("hidden");
  bonificoModalState = { itemId: null };
}

function initBonificoModal() {
  document.querySelectorAll("[data-bonifico-add]").forEach((btn) => {
    btn.addEventListener("click", () => openBonificoModal());
  });
  document.getElementById("bonifico-cancel").addEventListener("click", closeBonificoModal);
  document.querySelector("#bonifico-modal .modal-backdrop").addEventListener("click", closeBonificoModal);

  document.getElementById("bonifico-from-label").addEventListener("change", (e) => {
    Store.setBonificoLabel("fromLabel", e.target.value.trim() || "TR");
    renderBonifico();
  });
  document.getElementById("bonifico-to-label").addEventListener("change", (e) => {
    Store.setBonificoLabel("toLabel", e.target.value.trim() || "CA");
    renderBonifico();
  });

  document.getElementById("bonifico-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const { itemId } = bonificoModalState;
    const amount = parseFloat(document.getElementById("bonifico-amount").value);
    const note = document.getElementById("bonifico-note").value.trim();
    if (!amount || amount <= 0 || !note) return;

    if (itemId) {
      Store.updateBonificoItem(itemId, { amount, note });
    } else {
      Store.addBonificoItem({ amount, note });
    }
    closeBonificoModal();
    renderBonifico();
  });

  document.getElementById("bonifico-delete").addEventListener("click", () => {
    const { itemId } = bonificoModalState;
    if (!itemId) return;
    if (!confirm("Eliminare questa voce dal calcolo del bonifico?")) return;
    Store.removeBonificoItem(itemId);
    closeBonificoModal();
    renderBonifico();
  });
}

/* ---------------------------------------------------------------- */
/* SPESE RATEALI (impostazioni)                                      */
/* ---------------------------------------------------------------- */

let installmentModalState = { itemId: null };

function renderInstallmentsList() {
  const list = document.getElementById("list-installments");
  const items = Store.data.settings.installments || [];
  if (items.length === 0) {
    list.innerHTML = `<li class="item-empty">Nessuna spesa rateale configurata</li>`;
    return;
  }
  list.innerHTML = items
    .map((item) => {
      const endKey = shiftMonthKey(item.startMonthKey, item.totalInstallments - 1);
      const split = computeInstallmentSplit(item.amount, item.totalInstallments);
      const perRata = split
        ? split.base === split.last
          ? ` · ${formatEUR(split.base)}/rata`
          : ` · da ${formatEUR(split.base)}/rata`
        : "";
      return `
      <li data-id="${item.id}">
        <div>
          <span class="item-note">${escapeHTML(item.note || "—")}</span>
          <span class="item-category">${RECURRING_BUCKET_LABELS[item.bucket] || item.bucket} · ${item.totalInstallments} rate da ${monthLabel(item.startMonthKey)} a ${monthLabel(endKey)}${perRata}</span>
        </div>
        <span class="item-amount">${formatEUR(item.amount)}</span>
      </li>`;
    })
    .join("");
  list.querySelectorAll("li[data-id]").forEach((li) => {
    li.addEventListener("click", () => openInstallmentModal(li.dataset.id));
  });
}

function openInstallmentModal(itemId = null) {
  installmentModalState = { itemId };
  const isEdit = !!itemId;
  const item = isEdit ? Store.data.settings.installments.find((i) => i.id === itemId) : null;

  document.getElementById("installment-modal-title").textContent = isEdit ? "Modifica spesa rateale" : "Aggiungi spesa rateale";

  const bucketSelect = document.getElementById("installment-bucket");
  bucketSelect.value = item ? item.bucket : "necessarie";
  populateInstallmentCategorySelect(bucketSelect.value, item ? item.category : null);

  document.getElementById("installment-amount").value = item ? item.amount : "";
  document.getElementById("installment-note").value = item ? item.note : "";
  document.getElementById("installment-count").value = item ? item.totalInstallments : 2;
  document.getElementById("installment-start").value = item ? item.startMonthKey : state.currentMonthKey;

  document.getElementById("installment-delete").classList.toggle("hidden", !isEdit);
  document.getElementById("installment-modal").classList.remove("hidden");
  updateInstallmentRatePreview();
  setTimeout(() => document.getElementById("installment-amount").focus(), 50);
}

function updateInstallmentRatePreview() {
  const preview = document.getElementById("installment-rate-preview");
  const amount = parseFloat(document.getElementById("installment-amount").value);
  const count = parseInt(document.getElementById("installment-count").value, 10);
  const split = computeInstallmentSplit(amount, count);
  if (!split) {
    preview.classList.add("hidden");
    return;
  }
  preview.textContent = formatInstallmentPreview(split);
  preview.classList.remove("hidden");
}

function populateInstallmentCategorySelect(bucket, selected) {
  const select = document.getElementById("installment-category");
  select.innerHTML = categoriesForBucket(bucket)
    .map((c) => `<option value="${escapeHTML(c)}">${escapeHTML(c)}</option>`)
    .join("");
  if (selected) select.value = selected;
}

function closeInstallmentModal() {
  document.getElementById("installment-modal").classList.add("hidden");
  installmentModalState = { itemId: null };
}

function initInstallmentModal() {
  document.getElementById("btn-add-installment").addEventListener("click", () => openInstallmentModal());
  document.getElementById("installment-cancel").addEventListener("click", closeInstallmentModal);
  document.querySelector("#installment-modal .modal-backdrop").addEventListener("click", closeInstallmentModal);

  document.getElementById("installment-bucket").addEventListener("change", (e) => {
    populateInstallmentCategorySelect(e.target.value);
  });
  document.getElementById("installment-amount").addEventListener("input", updateInstallmentRatePreview);
  document.getElementById("installment-count").addEventListener("input", updateInstallmentRatePreview);

  document.getElementById("installment-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const bucket = document.getElementById("installment-bucket").value;
    const amount = parseFloat(document.getElementById("installment-amount").value);
    const note = document.getElementById("installment-note").value.trim();
    const category = document.getElementById("installment-category").value;
    const totalInstallments = parseInt(document.getElementById("installment-count").value, 10);
    const startMonthKey = document.getElementById("installment-start").value;
    if (!amount || amount <= 0 || !note || !totalInstallments || totalInstallments < 2 || !startMonthKey) return;

    const payload = { bucket, amount, note, category, totalInstallments, startMonthKey };
    if (installmentModalState.itemId) {
      Store.updateInstallmentPlan(installmentModalState.itemId, payload);
    } else {
      Store.addInstallmentPlan(payload);
    }
    // Applica subito le rate mancanti a tutti i mesi già aperti, così non serve
    // ricordarsi di premere il pulsante "Applica" qui sotto dopo ogni modifica.
    Store.applyMissingInstallmentsToAllMonths();
    closeInstallmentModal();
    renderInstallmentsList();
    renderRiepilogo();
  });

  document.getElementById("installment-delete").addEventListener("click", () => {
    if (!installmentModalState.itemId) return;
    if (!confirm("Eliminare questo piano di rate? Le rate già inserite nei mesi non verranno rimosse.")) return;
    Store.removeInstallmentPlan(installmentModalState.itemId);
    closeInstallmentModal();
    renderInstallmentsList();
  });

}

/* ---------------------------------------------------------------- */
/* STORICO                                                            */
/* ---------------------------------------------------------------- */

function renderStorico() {
  // Esclude i mesi futuri (oltre il mese corrente reale, non quello eventualmente
  // aperto nel Riepilogo): possono essere stati creati per sbaglio/curiosità
  // navigando avanti, ma non ha senso includerli nello storico/trend.
  const realCurrentKey = monthKey(new Date());
  const realCurrentYear = new Date().getFullYear();
  const yearStr = String(state.currentHistoryYear);

  document.getElementById("current-history-year").textContent = yearStr;
  document.getElementById("btn-next-year").disabled = state.currentHistoryYear >= realCurrentYear;

  const keys = Store.monthsSortedKeys().filter((k) => k <= realCurrentKey && k.startsWith(yearStr));
  const settings = Store.data.settings;

  if (keys.length === 0) {
    document.getElementById("trend-chart").getContext("2d").clearRect(0, 0, 9999, 9999);
    document.getElementById("averages-grid").innerHTML = `<p class="hint">Nessun dato storico per il ${yearStr}.</p>`;
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
/* ANALISI                                                            */
/* ---------------------------------------------------------------- */

const ANALISI_BUCKETS = ["necessarie", "svago", "investimenti", "entrate"];
const ANALISI_BUCKET_LABELS = { necessarie: "Necessaria", svago: "Svago", investimenti: "Investimento", entrate: "Entrata" };

let analisiState = {
  from: null,
  to: null,
  query: "",
  category: "",
  tipi: new Set(ANALISI_BUCKETS)
};

/* Filtro di default quando si apre la scheda senza aver ancora toccato nulla:
 * l'anno corrente, fino al mese reale in corso (i mesi futuri eventualmente
 * aperti navigando in avanti nel Riepilogo non hanno senso in un report). */
function defaultAnalisiRange() {
  const year = new Date().getFullYear();
  return { from: `${year}-01`, to: monthKey(new Date()) };
}

/* Appiattisce tutte le voci di tutti i mesi in un unico elenco, ciascuna
 * arricchita con "bucket" e "monthKey" (informazioni implicite nella
 * struttura a mesi/bucket dei dati, ma necessarie qui per filtrare/mostrare
 * voci provenienti da mesi e tipi diversi fianco a fianco). */
function getAllItemsFlat() {
  const out = [];
  Object.keys(Store.data.months).forEach((mk) => {
    const month = Store.data.months[mk];
    ANALISI_BUCKETS.forEach((bucket) => {
      (month[bucket] || []).forEach((item) => {
        out.push(Object.assign({}, item, { bucket, monthKey: mk }));
      });
    });
  });
  return out;
}

function analisiCategoriesForSelectedTipi() {
  const set = new Set();
  analisiState.tipi.forEach((b) => categoriesForBucket(b).forEach((c) => set.add(c)));
  return Array.from(set).sort((a, b) => a.localeCompare(b, "it", { sensitivity: "base" }));
}

function populateAnalisiCategorySelect() {
  const select = document.getElementById("analisi-category");
  const cats = analisiCategoriesForSelectedTipi();
  select.innerHTML =
    `<option value="">Tutte le categorie</option>` +
    cats.map((c) => `<option value="${escapeHTML(c)}">${escapeHTML(c)}</option>`).join("");
  if (!cats.includes(analisiState.category)) analisiState.category = "";
  select.value = analisiState.category;
}

function filteredAnalisiItems() {
  const q = analisiState.query.trim().toLowerCase();
  return getAllItemsFlat().filter((item) => {
    if (!analisiState.tipi.has(item.bucket)) return false;
    if (analisiState.from && item.monthKey < analisiState.from) return false;
    if (analisiState.to && item.monthKey > analisiState.to) return false;
    if (analisiState.category && item.category !== analisiState.category) return false;
    if (q && !(item.note || "").toLowerCase().includes(q)) return false;
    return true;
  });
}

function describeAnalisiFilters(count) {
  const parts = [];
  if (analisiState.from || analisiState.to) {
    const fromLabel = analisiState.from ? monthLabel(analisiState.from) : "inizio";
    const toLabel = analisiState.to ? monthLabel(analisiState.to) : "oggi";
    parts.push(`${fromLabel} – ${toLabel}`);
  }
  if (analisiState.tipi.size < ANALISI_BUCKETS.length) {
    parts.push(Array.from(analisiState.tipi).map((b) => ANALISI_BUCKET_LABELS[b]).join(", ") || "nessun tipo");
  }
  if (analisiState.category) parts.push(`categoria "${analisiState.category}"`);
  if (analisiState.query.trim()) parts.push(`nota contiene "${analisiState.query.trim()}"`);
  const filtersStr = parts.length ? parts.join(" · ") : "nessun filtro attivo";
  return `${count} ${count === 1 ? "voce trovata" : "voci trovate"} — ${filtersStr}`;
}

function analisiKpiCellHTML(label, value, opts) {
  opts = opts || {};
  const valueClass = opts.tone ? ` ${opts.tone}` : "";
  return `
    <div class="summary-cell neutral">
      <div class="label">${label}</div>
      <div class="value${valueClass}">${value}</div>
      ${opts.sub ? `<div class="sub">${opts.sub}</div>` : ""}
    </div>`;
}

/* Legge un mese senza crearlo se non esiste ancora: a differenza di
 * Store.getMonth(), che seeda spese fisse/rate e salva la prima volta che un
 * mese viene "aperto", qui vogliamo solo leggere per calcolare una card di
 * riepilogo — non ha senso che il solo fatto di guardare la scheda Analisi
 * crei silenziosamente un mese nuovo (es. il mese precedente, se l'utente ha
 * appena iniziato a usare l'app questo mese). */
function monthOrEmpty(key) {
  return Store.data.months[key] || emptyMonth();
}

/* Calcola tutte le "card KPI" della Panoramica: alcune sull'anno corrente
 * (da gennaio al mese reale in corso, mesi futuri esclusi), altre sul solo
 * mese corrente. Sono indipendenti dai filtri della sezione sottostante. */
function computeAnalisiOverview() {
  const settings = Store.data.settings;
  const year = new Date().getFullYear();
  const realCurrentKey = monthKey(new Date());
  const yearKeys = Store.monthsSortedKeys().filter((k) => k.startsWith(String(year)) && k <= realCurrentKey);
  const perMonth = yearKeys.map((k) => ({ key: k, stats: computeMonthStats(Store.data.months[k], settings) }));

  const saldoNetto = perMonth.reduce((acc, m) => acc + m.stats.risparmi, 0);

  const pctRisparmi = perMonth.map((m) => (m.stats.totaleEntrate > 0 ? (m.stats.risparmi / m.stats.totaleEntrate) * 100 : 0));
  const tassoRisparmioMedio = average(pctRisparmi);

  const catTotals = new Map();
  let maxItem = null;
  yearKeys.forEach((k) => {
    const month = Store.data.months[k];
    ["necessarie", "svago", "investimenti"].forEach((bucket) => {
      (month[bucket] || []).forEach((item) => {
        const amt = Number(item.amount) || 0;
        const cat = item.category || "Senza categoria";
        catTotals.set(cat, (catTotals.get(cat) || 0) + amt);
        if (!maxItem || amt > maxItem.amount) maxItem = { amount: amt, note: item.note, monthKey: k };
      });
    });
  });
  let topCategoria = null;
  catTotals.forEach((val, cat) => {
    if (!topCategoria || val > topCategoria.val) topCategoria = { cat, val };
  });

  let meseCaro = null, meseLeggero = null;
  perMonth.forEach((m) => {
    const totUscite = m.stats.totaleNecessarie + m.stats.totaleSvago;
    if (!meseCaro || totUscite > meseCaro.tot) meseCaro = { key: m.key, tot: totUscite };
    if (!meseLeggero || totUscite < meseLeggero.tot) meseLeggero = { key: m.key, tot: totUscite };
  });

  const transazioniPerMese = yearKeys.map((k) => {
    const month = Store.data.months[k];
    return ANALISI_BUCKETS.reduce((acc, b) => acc + (month[b] || []).length, 0);
  });
  const mediaTransazioni = average(transazioniPerMese);

  const totUsciteAnno = perMonth.reduce((acc, m) => acc + m.stats.totaleNecessarie + m.stats.totaleSvago, 0);
  const startOfYear = new Date(year, 0, 1);
  const daysElapsed = Math.floor((new Date() - startOfYear) / 86400000) + 1;
  const spesaGiornaliera = daysElapsed > 0 ? totUsciteAnno / daysElapsed : 0;

  const totaleInvestito = perMonth.reduce((acc, m) => acc + m.stats.investimenti, 0);

  const curMonth = monthOrEmpty(realCurrentKey);
  let totaleMeseCorrente = 0, fissoMeseCorrente = 0;
  ["necessarie", "svago", "investimenti"].forEach((bucket) => {
    (curMonth[bucket] || []).forEach((item) => {
      const amt = Number(item.amount) || 0;
      totaleMeseCorrente += amt;
      if (item.recurringId || item.installmentId) fissoMeseCorrente += amt;
    });
  });
  const pctFisso = totaleMeseCorrente > 0 ? (fissoMeseCorrente / totaleMeseCorrente) * 100 : 0;

  const prevKey = shiftMonthKey(realCurrentKey, -1);
  const prevStats = computeMonthStats(monthOrEmpty(prevKey), settings);
  const curStats = computeMonthStats(curMonth, settings);
  const curTotUscite = curStats.totaleNecessarie + curStats.totaleSvago;
  const prevTotUscite = prevStats.totaleNecessarie + prevStats.totaleSvago;
  const deltaUscite = curTotUscite - prevTotUscite;
  const deltaPct = prevTotUscite > 0 ? (deltaUscite / prevTotUscite) * 100 : 0;

  return {
    year, realCurrentKey, prevKey,
    saldoNetto, tassoRisparmioMedio, topCategoria, meseCaro, meseLeggero,
    mediaTransazioni, spesaGiornaliera, daysElapsed, maxItem, totaleInvestito,
    pctFisso, fissoMeseCorrente, totaleMeseCorrente,
    curTotUscite, prevTotUscite, deltaUscite, deltaPct
  };
}

function renderAnalisiOverview() {
  const o = computeAnalisiOverview();
  document.getElementById("analisi-overview-year").textContent = String(o.year);

  document.getElementById("analisi-overview-year-grid").innerHTML =
    analisiKpiCellHTML("Saldo netto", formatEUR(o.saldoNetto), { tone: o.saldoNetto >= 0 ? "good" : "bad" }) +
    analisiKpiCellHTML("Tasso risparmio medio", `${o.tassoRisparmioMedio.toFixed(1)}%`, { tone: o.tassoRisparmioMedio >= 0 ? "good" : "bad" }) +
    analisiKpiCellHTML("Categoria top spesa", o.topCategoria ? formatEUR(o.topCategoria.val) : "—", { sub: o.topCategoria ? escapeHTML(o.topCategoria.cat) : "" }) +
    analisiKpiCellHTML("Mese più caro", o.meseCaro ? formatEUR(o.meseCaro.tot) : "—", { sub: o.meseCaro ? monthLabel(o.meseCaro.key) : "" }) +
    analisiKpiCellHTML("Mese più leggero", o.meseLeggero ? formatEUR(o.meseLeggero.tot) : "—", { sub: o.meseLeggero ? monthLabel(o.meseLeggero.key) : "" }) +
    analisiKpiCellHTML("Transazioni medie/mese", o.mediaTransazioni.toFixed(1)) +
    analisiKpiCellHTML("Spesa media giornaliera", formatEUR(o.spesaGiornaliera), { sub: `su ${o.daysElapsed} giorni` }) +
    analisiKpiCellHTML("Spesa più alta", o.maxItem ? formatEUR(o.maxItem.amount) : "—", { sub: o.maxItem ? `${escapeHTML(o.maxItem.note || "")} · ${monthLabel(o.maxItem.monthKey)}` : "" }) +
    analisiKpiCellHTML("Investito nell'anno", formatEUR(o.totaleInvestito));

  document.getElementById("analisi-overview-month-grid").innerHTML =
    analisiKpiCellHTML("Spese fisse/rate", `${o.pctFisso.toFixed(1)}%`, { sub: `${formatEUR(o.fissoMeseCorrente)} su ${formatEUR(o.totaleMeseCorrente)}` }) +
    analisiKpiCellHTML("Rispetto al mese scorso", formatEUR(o.curTotUscite), {
      tone: o.deltaUscite > 0 ? "bad" : o.deltaUscite < 0 ? "good" : "",
      sub: `${o.deltaUscite >= 0 ? "▲" : "▼"} ${Math.abs(o.deltaPct).toFixed(1)}% vs ${monthLabel(o.prevKey)}`
    });
}

function renderAnalisiBreakdown(items) {
  const container = document.getElementById("analisi-category-breakdown");
  if (items.length === 0) {
    container.innerHTML = `<p class="hint">Nessuna voce corrisponde ai filtri.</p>`;
    return;
  }
  const map = new Map();
  items.forEach((i) => {
    const key = i.category || "Senza categoria";
    map.set(key, (map.get(key) || 0) + (Number(i.amount) || 0));
  });
  const rows = Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  const maxVal = rows[0][1];
  container.innerHTML = rows
    .map(
      ([cat, val]) => `
      <div class="breakdown-row">
        <div class="breakdown-label">
          <span>${escapeHTML(cat)}</span>
          <span class="breakdown-value">${formatEUR(val)}</span>
        </div>
        <div class="progress-track"><div class="progress-fill" style="width:${maxVal > 0 ? (val / maxVal) * 100 : 0}%; background: var(--accent)"></div></div>
      </div>`
    )
    .join("");
}

function renderAnalisiList(items) {
  const list = document.getElementById("analisi-item-list");
  if (items.length === 0) {
    list.innerHTML = `<li class="item-empty">Nessuna voce corrisponde ai filtri</li>`;
    return;
  }
  // Più recenti prima: per mese decrescente, e a parità di mese nell'ordine in
  // cui compaiono nel bucket (che è già l'ordine di inserimento).
  const sorted = items.slice().sort((a, b) => b.monthKey.localeCompare(a.monthKey));
  list.innerHTML = sorted
    .map(
      (item) => `
      <li data-id="${item.id}" data-bucket="${item.bucket}" data-month="${item.monthKey}">
        <div>
          <span class="item-note">${escapeHTML(item.note || "—")}</span>
          <span class="item-category">${ANALISI_BUCKET_LABELS[item.bucket]} · ${escapeHTML(item.category || "")} · ${monthLabel(item.monthKey)}</span>
        </div>
        <span class="item-amount">${formatEUR(item.amount)}</span>
      </li>`
    )
    .join("");

  list.querySelectorAll("li[data-id]").forEach((li) => {
    li.addEventListener("click", () => {
      state.currentMonthKey = li.dataset.month;
      Store.ensureMonth(state.currentMonthKey);
      switchView("riepilogo");
      openModal(li.dataset.bucket, li.dataset.id);
    });
  });
}

function renderAnalisi() {
  renderAnalisiOverview();
  populateAnalisiCategorySelect();
  document.getElementById("analisi-from").value = analisiState.from || "";
  document.getElementById("analisi-to").value = analisiState.to || "";
  document.getElementById("analisi-query").value = analisiState.query;
  document.querySelectorAll("#analisi-tipo-checks input").forEach((cb) => {
    cb.checked = analisiState.tipi.has(cb.value);
  });

  const items = filteredAnalisiItems();
  const amounts = items.map((i) => Number(i.amount) || 0);
  const totale = amounts.reduce((a, b) => a + b, 0);
  const count = items.length;
  const media = count > 0 ? totale / count : 0;
  const max = count > 0 ? Math.max(...amounts) : 0;
  const min = count > 0 ? Math.min(...amounts) : 0;

  document.getElementById("analisi-summary-line").textContent = describeAnalisiFilters(count);
  document.getElementById("analisi-kpi-grid").innerHTML =
    analisiKpiCellHTML("Totale", formatEUR(totale)) +
    analisiKpiCellHTML("N. transazioni", String(count)) +
    analisiKpiCellHTML("Media per transazione", formatEUR(media)) +
    analisiKpiCellHTML("Più alta", formatEUR(max)) +
    analisiKpiCellHTML("Più bassa", formatEUR(min));

  renderAnalisiBreakdown(items);
  renderAnalisiList(items);
  document.getElementById("analisi-count").textContent = String(count);
}

function initAnalisi() {
  const range = defaultAnalisiRange();
  analisiState.from = range.from;
  analisiState.to = range.to;

  document.getElementById("analisi-from").addEventListener("change", (e) => {
    analisiState.from = e.target.value || null;
    renderAnalisi();
  });
  document.getElementById("analisi-to").addEventListener("change", (e) => {
    analisiState.to = e.target.value || null;
    renderAnalisi();
  });
  document.getElementById("analisi-query").addEventListener("input", (e) => {
    analisiState.query = e.target.value;
    renderAnalisi();
  });
  document.getElementById("analisi-category").addEventListener("change", (e) => {
    analisiState.category = e.target.value;
    renderAnalisi();
  });
  document.querySelectorAll("#analisi-tipo-checks input").forEach((cb) => {
    cb.addEventListener("change", () => {
      if (cb.checked) analisiState.tipi.add(cb.value);
      else analisiState.tipi.delete(cb.value);
      renderAnalisi();
    });
  });
  document.getElementById("btn-analisi-reset").addEventListener("click", () => {
    const r = defaultAnalisiRange();
    analisiState = { from: r.from, to: r.to, query: "", category: "", tipi: new Set(ANALISI_BUCKETS) };
    renderAnalisi();
  });
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
  renderInstallmentsList();
  renderBonifico();
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

/* Ordina alfabeticamente (locale italiano) tenendo "Altro" sempre come ultima
 * voce, dato che è la categoria "jolly" e ha senso resti in fondo. */
function sortCategoriesKeepingAltroLast(list) {
  const altro = list.filter((c) => c.trim().toLowerCase() === "altro");
  const rest = list.filter((c) => c.trim().toLowerCase() !== "altro");
  rest.sort((a, b) => a.localeCompare(b, "it", { sensitivity: "base" }));
  return rest.concat(altro);
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
      <p class="hint cat-drag-hint">Tieni premuto <span aria-hidden="true">⠿</span> e trascina per riordinare.</p>
      <div class="cat-tags">
        ${categoriesForBucket(t.key)
          .map(
            (c) => `<span class="cat-tag" data-cat="${escapeHTML(c)}">
              <span class="cat-drag-handle" aria-hidden="true">⠿</span>
              <span class="cat-tag-label">${escapeHTML(c)}</span>
              <button data-remove="${escapeHTML(c)}" aria-label="Rimuovi ${escapeHTML(c)}">×</button>
            </span>`
          )
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
        Store.data.settings.categories[type] = sortCategoriesKeepingAltroLast(list);
        Store.save();
      }
      renderCategoriesEditor();
    });

    initCategoryDragReorder(group.querySelector(".cat-tags"), type);
  });
}

/* Riordino a trascinamento delle "bolle" categoria: tocca/trascina l'iconcina
 * "⠿" di una categoria per spostarla. Implementato a mano con i Pointer Events
 * (il drag&drop nativo HTML5 non funziona col touch su iOS Safari). Durante il
 * trascinamento la bolla esce dal flusso normale (position:fixed) e segue il
 * dito; un segnaposto nella lista indica dove finirà. Al rilascio l'ordine del
 * DOM viene salvato come nuovo ordine dell'array in Store. */
function initCategoryDragReorder(container, type) {
  container.querySelectorAll(".cat-tag").forEach((tag) => {
    const handle = tag.querySelector(".cat-drag-handle");
    if (!handle) return;

    handle.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      const pointerId = e.pointerId;
      const startRect = tag.getBoundingClientRect();
      const offsetX = e.clientX - startRect.left;
      const offsetY = e.clientY - startRect.top;

      const placeholder = document.createElement("span");
      placeholder.className = "cat-tag-placeholder";
      placeholder.style.width = `${startRect.width}px`;
      placeholder.style.height = `${startRect.height}px`;
      tag.after(placeholder);

      tag.classList.add("dragging");
      tag.style.width = `${startRect.width}px`;
      tag.style.left = `${startRect.left}px`;
      tag.style.top = `${startRect.top}px`;
      document.body.appendChild(tag);

      try {
        handle.setPointerCapture(pointerId);
      } catch (err) {
        /* alcuni browser potrebbero rifiutare la capture: il drag funziona comunque */
      }

      function onMove(ev) {
        tag.style.left = `${ev.clientX - offsetX}px`;
        tag.style.top = `${ev.clientY - offsetY}px`;

        const siblings = Array.from(container.querySelectorAll(".cat-tag")).filter((el) => el !== tag);
        for (const sib of siblings) {
          const r = sib.getBoundingClientRect();
          if (ev.clientX > r.left && ev.clientX < r.right && ev.clientY > r.top && ev.clientY < r.bottom) {
            const before = ev.clientX < r.left + r.width / 2;
            container.insertBefore(placeholder, before ? sib : sib.nextSibling);
            break;
          }
        }
      }

      function onUp() {
        try {
          handle.releasePointerCapture(pointerId);
        } catch (err) {
          /* no-op */
        }
        handle.removeEventListener("pointermove", onMove);
        handle.removeEventListener("pointerup", onUp);
        handle.removeEventListener("pointercancel", onUp);

        container.insertBefore(tag, placeholder);
        placeholder.remove();
        tag.classList.remove("dragging");
        tag.style.width = "";
        tag.style.left = "";
        tag.style.top = "";

        const order = Array.from(container.querySelectorAll(".cat-tag")).map((el) => el.dataset.cat);
        Store.data.settings.categories[type] = order;
        Store.save();
      }

      handle.addEventListener("pointermove", onMove);
      handle.addEventListener("pointerup", onUp);
      handle.addEventListener("pointercancel", onUp);
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

function initHistoryYearSwitcher() {
  document.getElementById("btn-prev-year").addEventListener("click", () => {
    state.currentHistoryYear -= 1;
    renderStorico();
  });
  document.getElementById("btn-next-year").addEventListener("click", () => {
    if (state.currentHistoryYear >= new Date().getFullYear()) return;
    state.currentHistoryYear += 1;
    renderStorico();
  });
}

/* ---------------------------------------------------------------- */
/* ELIMINA TUTTI I DATI DEL MESE (Riepilogo)                         */
/* ---------------------------------------------------------------- */

function initDeleteMonth() {
  document.getElementById("btn-delete-month").addEventListener("click", () => {
    const label = monthLabel(state.currentMonthKey);
    if (!confirm(`Eliminare tutte le voci di ${label}? L'azione non può essere annullata.`)) return;
    Store.clearMonth(state.currentMonthKey);
    renderRiepilogo();
  });
}

/* ---------------------------------------------------------------- */
/* SEZIONI/CARD CONTRAIBILI (Riepilogo + Impostazioni)                */
/* ---------------------------------------------------------------- */

function initCollapsibles() {
  // Card dei bucket nel Riepilogo: cliccando sull'header si mostra/nasconde
  // l'elenco delle voci (il bottone "+ Aggiungi..." resta sempre visibile).
  document.querySelectorAll(".bucket-card > .bucket-header[data-toggle]").forEach((header) => {
    header.addEventListener("click", () => {
      header.closest(".bucket-card").classList.toggle("expanded");
    });
  });

  // Card delle Impostazioni (tranne il Bonifico, che non è contraibile).
  document.querySelectorAll(".card.collapsible > .card-header[data-toggle]").forEach((header) => {
    header.addEventListener("click", () => {
      header.closest(".card").classList.toggle("expanded");
    });
  });
}

function init() {
  Store.load();
  state.currentMonthKey = monthKey(new Date());
  state.currentHistoryYear = new Date().getFullYear();
  Store.ensureMonth(state.currentMonthKey);

  initTabs();
  initMonthSwitcher();
  initHistoryYearSwitcher();
  initDeleteMonth();
  initModal();
  initNoteAutocomplete();
  initRecurringModal();
  initInstallmentModal();
  initBonificoModal();
  initSettingsHandlers();
  initCollapsibles();
  initAnalisi();

  registerChartRedraw(() => {
    if (state.currentView === "riepilogo") renderRiepilogo();
    if (state.currentView === "storico") renderStorico();
  });

  switchView("riepilogo");
}

document.addEventListener("DOMContentLoaded", init);
