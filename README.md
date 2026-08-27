# Budget Tracker

Web app personale per tracciare entrate e uscite mensili, dividendole tra **spese
necessarie**, **investimenti**, **spese per svago** e **risparmi**, con soglie
target configurabili (di default 65% / 20% / 15%), grafici e storico multi-mese.

È una "bozza v1" pensata per essere rifinita nel tempo: nessun framework,
nessun passaggio di build — solo HTML, CSS e JavaScript puri, così è facile
da capire, modificare e pubblicare gratis su GitHub Pages.

## Caratteristiche

- **Riepilogo mese corrente**: naviga tra i mesi, inserisci stipendio, entrate
  extra, spese necessarie, investimenti e spese per svago. Ogni voce ha un
  importo, una nota e una categoria.
- **Soglie di budget**: percentuali target modificabili (default 65/20/15),
  con indicatori visivi quando superi il massimo o non raggiungi il minimo di
  risparmio.
- **Grafico a torta** della ripartizione del mese corrente.
- **Storico**: grafico di andamento nel tempo (necessarie / svago / risparmi),
  medie storiche e tabella di tutti i mesi registrati (tocca una riga per
  aprire quel mese).
- **Impostazioni**: percentuali di budget, base di calcolo delle soglie
  (stipendio da solo oppure stipendio + entrate extra), categorie
  personalizzabili, export/import di un backup JSON, reset dati.
- **Pensata per iPhone**: layout mobile-first con tab bar in basso, supporto
  "Aggiungi a Home" (si comporta come un'app quasi a schermo intero) e
  dark mode automatica.

## Dove sono salvati i dati

Tutto viene salvato **solo nel browser** (`localStorage`), sul dispositivo
che stai usando: non c'è un server, un account o una sincronizzazione tra
dispositivi. Questo significa massima privacy, ma anche che:

- se usi Safari su iPhone e poi apri l'app da un Mac, i dati **non** sono
  condivisi (sono due "localStorage" separati);
- se cancelli i dati di navigazione del sito, i dati dell'app vengono persi.

Per questo, dalla sezione **Impostazioni → Backup dati** puoi esportare un
file JSON con tutti i tuoi dati e reimportarlo quando vuoi (anche su un altro
dispositivo/browser, per "trasferire" manualmente lo storico).

> Se in futuro vuoi la sincronizzazione automatica tra più dispositivi, si
> può aggiungere un piccolo backend gratuito (es. Supabase) — è un'estensione
> naturale di questa bozza, ma richiede un account e un minimo di
> configurazione, per questo non è incluso nella v1.

## Come pubblicarla su GitHub Pages (gratis)

Non serve installare nulla sul computer: puoi fare tutto dal sito di GitHub.

1. Vai su [github.com](https://github.com) e crea un nuovo repository
   (es. `budget-tracker`), pubblico, **senza** aggiungere file di esempio.
2. Apri il repository appena creato e clicca **Add file → Upload files**.
3. Trascina dentro tutti i file e le cartelle di questo progetto
   (`index.html`, `manifest.json`, `README.md`, le cartelle `css/`, `js/`,
   `icons/`) mantenendo la stessa struttura, poi clicca **Commit changes**.
4. Vai su **Settings → Pages** (nel menu laterale del repository).
5. In **Build and deployment → Source** scegli **Deploy from a branch**,
   branch **main**, cartella **/ (root)**, poi **Save**.
6. Dopo circa un minuto, in cima alla stessa pagina comparirà l'indirizzo
   pubblico dell'app, del tipo:
   `https://<tuo-utente-github>.github.io/budget-tracker/`

Da lì in poi, ogni volta che modifichi i file nel repository (anche
direttamente dal sito di GitHub, con la matita ✏️ su ogni file), la webapp si
aggiorna da sola in un minuto o due.

### Aggiungerla alla schermata Home dell'iPhone

1. Apri il link pubblicato sopra con **Safari** su iPhone.
2. Tocca l'icona di condivisione (il quadrato con la freccia in su).
3. Scegli **Aggiungi a Home**.

Da quel momento l'app si apre a schermo intero, con la sua icona, come una
vera app.

## Struttura del progetto

```
budget-tracker/
├── index.html          markup dell'app (le tre schermate: Riepilogo, Storico, Impostazioni)
├── manifest.json        configurazione PWA (icona, nome, colori)
├── css/
│   └── style.css        stile mobile-first, dark mode inclusa
├── js/
│   ├── storage.js        modello dati + salvataggio in localStorage + calcoli
│   ├── charts.js          grafico a torta e grafico di andamento (su <canvas>, senza librerie esterne)
│   └── app.js              logica dell'interfaccia (rendering, eventi, navigazione)
└── icons/                icone dell'app (per la schermata Home dell'iPhone)
```

## Nota sulla logica delle soglie

Nel foglio Google originale, le soglie massime di "spese necessarie" e
"spese per svago" erano calcolate solo sullo stipendio, mentre la soglia
minima di risparmio era calcolata su stipendio + entrate extra. In questa
app le tre soglie usano per default **la stessa base di calcolo**
(stipendio + entrate extra, per coerenza), ma puoi tornare al comportamento
originale (solo stipendio) da **Impostazioni → Base di calcolo delle
soglie**.

## Prossimi sviluppi possibili

Alcune idee per le prossime iterazioni, da discutere:

- Ricerca/filtro delle voci per categoria all'interno di un mese.
- Spese ricorrenti (es. mutuo, abbonamenti) precompilate ogni mese.
- Sincronizzazione cloud multi-dispositivo.
- Notifiche quando si supera una soglia.
- Esportazione dello storico in CSV/Excel.
