/* storage.js
 * Livello dati dell'app: schema, valori di default, persistenza su localStorage,
 * funzioni di calcolo dei totali/soglie di un mese.
 *
 * Modello dati:
 * {
 *   version: 1,
 *   settings: {
 *     budgetSplit: { necessarie: 65, svago: 20, risparmi: 15 },   // percentuali, devono sommare a 100
 *     thresholdBase: "totale",                                    // "totale" (stipendio+entrate extra) | "stipendio"
 *     categories: {
 *       necessarie: [...nomi], svago: [...nomi], entrate: [...nomi], investimenti: [...nomi]
 *     },
 *     recurringExpenses: [
 *       { id, bucket: "necessarie"|"svago"|"investimenti", amount, note, category }
 *     ],
 *     bonifico: {
 *       fromLabel: "TR", toLabel: "CA",
 *       monthly: [{ id, amount, note }]    // spese mensili trasferite da un conto all'altro
 *     },
 *     installments: [
 *       // spesa a rate: si inserisce da sola per "totalInstallments" mesi
 *       // consecutivi a partire da "startMonthKey", poi si ferma
 *       { id, bucket, amount, note, category, totalInstallments, startMonthKey }
 *     ]
 *   },
 *   months: {
 *     "2026-04": {
 *       stipendio: 2080,
 *       entrate:      [{ id, amount, note, category, date }],
 *       investimenti: [{ id, amount, note, category, date }],
 *       necessarie:   [{ id, amount, note, category, date }],
 *       svago:        [{ id, amount, note, category, date }]
 *     }
 *   }
 * }
 */

const STORAGE_KEY = "budget-tracker-data-v1";

const DEFAULT_DATA = {
  version: 1,
  settings: {
    budgetSplit: { necessarie: 65, svago: 20, risparmi: 15 },
    thresholdBase: "totale",
    categories: {
      necessarie: ["Mutuo/Affitto", "Bollette", "Rata auto", "Assicurazioni", "Abbonamenti", "Spesa alimentare", "Salute", "Altro"],
      svago: ["Ristoranti/Bar", "Uscite", "Shopping", "Viaggi", "Abbonamenti svago", "Altro"],
      entrate: ["Rimborso", "Vendita", "Incasso extra", "Altro"],
      investimenti: ["PAC/ETF", "Altro"]
    },
    recurringExpenses: [],
    bonifico: {
      fromLabel: "TR",
      toLabel: "CA",
      monthly: [
        { id: "b-mutuo", amount: 413.24, note: "Mutuo" },
        { id: "b-cpi", amount: 22.32, note: "Assicurazione CPI" },
        { id: "b-fibra", amount: 23.99, note: "Fibra WindTre" },
        { id: "b-mobile", amount: 9.99, note: "Mobile WindTre" }
      ]
    },
    installments: []
  },
  months: {}
};

function emptyMonth(stipendio = 0) {
  return { stipendio, entrate: [], investimenti: [], necessarie: [], svago: [] };
}

function monthKey(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

function monthLabel(key) {
  const [y, m] = key.split("-").map(Number);
  const d = new Date(y, m - 1, 1);
  const label = d.toLocaleDateString("it-IT", { month: "long", year: "numeric" });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function shiftMonthKey(key, delta) {
  const [y, m] = key.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return monthKey(d);
}

/** Converte "YYYY-MM" in un indice assoluto crescente, comodo per calcolare
 * quante rate sono passate da un mese di partenza. */
function absMonthIndex(key) {
  const [y, m] = key.split("-").map(Number);
  return y * 12 + (m - 1);
}

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

/** Fonde le impostazioni del bonifico salvate con i default, campo per campo,
 * così un backup vecchio (senza questo campo) o parziale non rompe nulla. */
function mergeBonificoSettings(parsedSettings) {
  const saved = (parsedSettings && parsedSettings.bonifico) || {};
  return {
    fromLabel: saved.fromLabel || DEFAULT_DATA.settings.bonifico.fromLabel,
    toLabel: saved.toLabel || DEFAULT_DATA.settings.bonifico.toLabel,
    monthly: Array.isArray(saved.monthly) ? saved.monthly : structuredClone(DEFAULT_DATA.settings.bonifico.monthly)
  };
}

const Store = {
  data: null,

  load() {
    let raw = null;
    try {
      raw = localStorage.getItem(STORAGE_KEY);
    } catch (e) {
      console.warn("localStorage non disponibile", e);
    }
    if (!raw) {
      this.data = structuredClone(DEFAULT_DATA);
      return this.data;
    }
    try {
      const parsed = JSON.parse(raw);
      this.data = Object.assign(structuredClone(DEFAULT_DATA), parsed);
      this.data.settings = Object.assign(structuredClone(DEFAULT_DATA.settings), parsed.settings || {});
      this.data.settings.categories = Object.assign(
        structuredClone(DEFAULT_DATA.settings.categories),
        (parsed.settings && parsed.settings.categories) || {}
      );
      this.data.settings.recurringExpenses = (parsed.settings && parsed.settings.recurringExpenses) || [];
      this.data.settings.bonifico = mergeBonificoSettings(parsed.settings);
      this.data.settings.installments = (parsed.settings && parsed.settings.installments) || [];
      this.data.months = parsed.months || {};
    } catch (e) {
      console.error("Dati corrotti, ripristino i valori di default", e);
      this.data = structuredClone(DEFAULT_DATA);
    }
    return this.data;
  },

  save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data));
    } catch (e) {
      console.error("Impossibile salvare i dati", e);
      alert("Attenzione: non è stato possibile salvare i dati nel browser (spazio esaurito o storage disabilitato).");
    }
  },

  getMonth(key) {
    if (!this.data.months[key]) {
      this.data.months[key] = emptyMonth();
      // Un mese "nuovo" (mai aperto prima) viene popolato di default con le
      // spese fisse e le rate configurate nelle impostazioni. Succede una
      // volta sola, qui: le chiamate successive trovano il mese già
      // esistente e non rientrano in questo ramo, quindi modificare/
      // eliminare una spesa fissa o un piano di rate dopo non tocca
      // retroattivamente i mesi già creati.
      this.seedRecurringInto(this.data.months[key]);
      this.seedInstallmentsInto(this.data.months[key], key);
    }
    return this.data.months[key];
  },

  ensureMonth(key) {
    this.getMonth(key);
    this.save();
  },

  seedRecurringInto(month) {
    const recurring = this.data.settings.recurringExpenses || [];
    recurring.forEach((r) => {
      if (!month[r.bucket]) return;
      month[r.bucket].push({
        id: uid(),
        recurringId: r.id,
        amount: r.amount,
        note: r.note,
        category: r.category,
        date: new Date().toISOString()
      });
    });
  },

  /** Aggiunge al mese indicato le spese fisse non ancora presenti (utile per il mese
   * corrente, già esistente prima che l'utente configurasse le spese fisse).
   * Ritorna quante voci sono state aggiunte. */
  applyMissingRecurring(key) {
    const month = this.getMonth(key);
    const recurring = this.data.settings.recurringExpenses || [];
    let added = 0;
    recurring.forEach((r) => {
      if (!month[r.bucket]) return;
      const already = month[r.bucket].some((i) => i.recurringId === r.id);
      if (already) return;
      month[r.bucket].push({
        id: uid(),
        recurringId: r.id,
        amount: r.amount,
        note: r.note,
        category: r.category,
        date: new Date().toISOString()
      });
      added++;
    });
    this.save();
    return added;
  },

  /** Calcola, per un piano di rate, quale numero di rata (1-based) cade nel mese
   * indicato: null se quel mese è fuori dal piano (prima dell'inizio o dopo l'ultima rata). */
  installmentIndexForMonth(inst, key) {
    const idx = absMonthIndex(key) - absMonthIndex(inst.startMonthKey);
    if (idx < 0 || idx >= inst.totalInstallments) return null;
    return idx + 1; // 1-based
  },

  seedInstallmentsInto(month, key) {
    const installments = this.data.settings.installments || [];
    installments.forEach((inst) => {
      if (!month[inst.bucket]) return;
      const n = this.installmentIndexForMonth(inst, key);
      if (n === null) return;
      month[inst.bucket].push({
        id: uid(),
        installmentId: inst.id,
        installmentIndex: n,
        installmentTotal: inst.totalInstallments,
        amount: inst.amount,
        note: `${inst.note} (${n}/${inst.totalInstallments})`,
        category: inst.category,
        date: new Date().toISOString()
      });
    });
  },

  /** Come applyMissingRecurring, ma per le rate: aggiunge al mese indicato solo
   * le rate che dovrebbero cadere in quel mese e non sono già presenti. */
  applyMissingInstallments(key) {
    const month = this.getMonth(key);
    const installments = this.data.settings.installments || [];
    let added = 0;
    installments.forEach((inst) => {
      if (!month[inst.bucket]) return;
      const n = this.installmentIndexForMonth(inst, key);
      if (n === null) return;
      const already = month[inst.bucket].some((i) => i.installmentId === inst.id);
      if (already) return;
      month[inst.bucket].push({
        id: uid(),
        installmentId: inst.id,
        installmentIndex: n,
        installmentTotal: inst.totalInstallments,
        amount: inst.amount,
        note: `${inst.note} (${n}/${inst.totalInstallments})`,
        category: inst.category,
        date: new Date().toISOString()
      });
      added++;
    });
    this.save();
    return added;
  },

  addInstallmentPlan(item) {
    this.data.settings.installments.push({ id: uid(), ...item });
    this.save();
  },

  updateInstallmentPlan(id, patch) {
    const item = this.data.settings.installments.find((i) => i.id === id);
    if (item) Object.assign(item, patch);
    this.save();
  },

  removeInstallmentPlan(id) {
    this.data.settings.installments = this.data.settings.installments.filter((i) => i.id !== id);
    this.save();
  },

  addRecurring(item) {
    this.data.settings.recurringExpenses.push({ id: uid(), ...item });
    this.save();
  },

  updateRecurring(id, patch) {
    const item = this.data.settings.recurringExpenses.find((r) => r.id === id);
    if (item) Object.assign(item, patch);
    this.save();
  },

  removeRecurring(id) {
    this.data.settings.recurringExpenses = this.data.settings.recurringExpenses.filter((r) => r.id !== id);
    this.save();
  },

  /* --- Bonifico ricorrente tra conti (es. TR -> CA) --------------- */

  setBonificoLabel(which, value) {
    this.data.settings.bonifico[which] = value; // which: "fromLabel" | "toLabel"
    this.save();
  },

  addBonificoItem(item) {
    this.data.settings.bonifico.monthly.push({ id: uid(), ...item });
    this.save();
  },

  updateBonificoItem(id, patch) {
    const item = this.data.settings.bonifico.monthly.find((i) => i.id === id);
    if (item) Object.assign(item, patch);
    this.save();
  },

  removeBonificoItem(id) {
    this.data.settings.bonifico.monthly = this.data.settings.bonifico.monthly.filter((i) => i.id !== id);
    this.save();
  },

  addItem(monthKey, bucket, item) {
    const month = this.getMonth(monthKey);
    month[bucket].push({ id: uid(), date: new Date().toISOString(), ...item });
    this.save();
  },

  updateItem(monthKey, bucket, id, patch) {
    const month = this.getMonth(monthKey);
    const item = month[bucket].find((i) => i.id === id);
    if (item) Object.assign(item, patch);
    this.save();
  },

  removeItem(monthKey, bucket, id) {
    const month = this.getMonth(monthKey);
    month[bucket] = month[bucket].filter((i) => i.id !== id);
    this.save();
  },

  setStipendio(monthKey, value) {
    const month = this.getMonth(monthKey);
    month.stipendio = value;
    this.save();
  },

  monthsSortedKeys() {
    return Object.keys(this.data.months).sort();
  },

  exportJSON() {
    return JSON.stringify(this.data, null, 2);
  },

  importJSON(json) {
    const parsed = JSON.parse(json);
    if (!parsed || typeof parsed !== "object" || !parsed.months) {
      throw new Error("Formato file non valido");
    }
    this.data = Object.assign(structuredClone(DEFAULT_DATA), parsed);
    this.data.settings = Object.assign(structuredClone(DEFAULT_DATA.settings), parsed.settings || {});
    this.data.settings.categories = Object.assign(
      structuredClone(DEFAULT_DATA.settings.categories),
      (parsed.settings && parsed.settings.categories) || {}
    );
    this.data.settings.recurringExpenses = (parsed.settings && parsed.settings.recurringExpenses) || [];
    this.data.settings.bonifico = mergeBonificoSettings(parsed.settings);
    this.data.settings.installments = (parsed.settings && parsed.settings.installments) || [];
    this.save();
  },

  resetAll() {
    this.data = structuredClone(DEFAULT_DATA);
    this.save();
  }
};

function sum(items) {
  return items.reduce((acc, i) => acc + (Number(i.amount) || 0), 0);
}

/** Calcola tutti i totali e le soglie per un mese. */
function computeMonthStats(month, settings) {
  const stipendio = Number(month.stipendio) || 0;
  const entrateExtra = sum(month.entrate);
  const investimenti = sum(month.investimenti);
  const necessarie = sum(month.necessarie);
  const svago = sum(month.svago);

  const totaleEntrate = stipendio + entrateExtra;
  const totaleNecessarie = necessarie + investimenti; // gli investimenti pesano come uscita "necessaria"
  const totaleSvago = svago;
  const risparmi = totaleEntrate - totaleNecessarie - totaleSvago;

  const base = settings.thresholdBase === "stipendio" ? stipendio : totaleEntrate;
  const split = settings.budgetSplit;
  const sogliaNecessarie = base * (split.necessarie / 100);
  const sogliaSvago = base * (split.svago / 100);
  const sogliaRisparmiMin = base * (split.risparmi / 100);

  return {
    stipendio,
    entrateExtra,
    investimenti,
    necessarie,
    svago,
    totaleEntrate,
    totaleNecessarie,
    totaleSvago,
    risparmi,
    base,
    sogliaNecessarie,
    sogliaSvago,
    sogliaRisparmiMin,
    pctNecessarie: totaleEntrate > 0 ? (totaleNecessarie / totaleEntrate) * 100 : 0,
    pctSvago: totaleEntrate > 0 ? (totaleSvago / totaleEntrate) * 100 : 0,
    pctRisparmi: totaleEntrate > 0 ? (risparmi / totaleEntrate) * 100 : 0
  };
}

/** Calcola l'importo del bonifico ricorrente: somma delle spese mensili
 * trasferite da un conto all'altro. */
function computeBonifico(bonifico) {
  const totalMonthly = sum(bonifico.monthly);
  return {
    totalMonthly,
    total: totalMonthly
  };
}

function formatEUR(value) {
  return (Number(value) || 0).toLocaleString("it-IT", { style: "currency", currency: "EUR" });
}
