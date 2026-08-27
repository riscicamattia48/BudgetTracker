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
- **Grafico a torta** della ripartizione del mese corrente (necessarie,
  investimenti, svago, risparmi).
- **Storico**: grafico di andamento nel tempo (necessarie / svago / risparmi),
  medie storiche e tabella di tutti i mesi registrati (tocca una riga per
  aprire quel mese).
- **Analisi**: filtra tutte le voci per periodo (mese di inizio/fine), parola
  nella nota, categoria e tipo (necessarie/svago/investimenti/entrate) — senza
  filtri mostra l'anno corrente. Mostra totale, numero di transazioni, media,
  voce più alta/più bassa, ripartizione per categoria ed elenco delle voci
  trovate (tocca una voce per aprirla e modificarla).
- **Impostazioni**: percentuali di budget, base di calcolo delle soglie
  (stipendio da solo oppure stipendio + entrate extra), categorie
  personalizzabili, export/import di un backup JSON, reset dati.
- **Spese fisse mensili**: configura una volta le spese ricorrenti (mutuo,
  abbonamenti, ecc.) scegliendo se sono necessarie, svago o investimenti:
  vengono inserite automaticamente in ogni mese, sia in quelli aperti per la
  prima volta sia in quelli già esistenti.
- **Spese rateali**: per un acquisto pagato in più mensilità, imposta
  importo, numero di rate e mese di partenza — vengono inserite da sole,
  una al mese con l'indicazione "n/totale", e si fermano da sole alla fine.
- **Bonifico ricorrente tra conti**: calcola l'importo da trasferire ogni
  mese da un conto all'altro, sommando le spese mensili fisse pagate da
  quel conto (es. mutuo, assicurazione, fibra).
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
3. Trascina dentro **tutti i file** di questo progetto in un colpo solo
   (`index.html`, `manifest.json`, `README.md`, `style.css`, `app.js`,
   `charts.js`, `storage.js`, `icon-180.png`, `icon-192.png`,
   `icon-512.png`). Sono tutti allo stesso livello, **senza sottocartelle**,
   apposta per evitare che il drag-and-drop del browser perda la struttura
   delle cartelle (un problema comune con questa finestra di GitHub). Poi
   clicca **Commit changes**.
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

Tutti i file sono volutamente nella stessa cartella, senza sottocartelle:
in questo modo puoi sempre selezionarli/trascinarli tutti insieme su GitHub
senza il rischio che la struttura si perda in fase di upload.

```
budget-tracker/
├── index.html         markup dell'app (le quattro schermate: Riepilogo, Storico, Analisi, Impostazioni)
├── manifest.json       configurazione PWA (icona, nome, colori)
├── style.css            stile mobile-first, dark mode inclusa
├── storage.js            modello dati + salvataggio in localStorage + calcoli
├── charts.js              grafico a torta e grafico di andamento (su <canvas>, senza librerie esterne)
├── app.js                  logica dell'interfaccia (rendering, eventi, navigazione)
├── icon-180.png             icona per "Aggiungi a Home" su iPhone
├── icon-192.png              icona PWA
└── icon-512.png               icona PWA (alta risoluzione)
```

Se in futuro il progetto cresce e vuoi riorganizzare i file in sottocartelle
(es. `css/`, `js/`), ricordati che la via più affidabile per farlo su GitHub
è **Add file → Create new file** scrivendo il percorso completo nel nome
(es. `css/style.css`), oppure lavorare in locale con git/GitHub Desktop:
il drag-and-drop diretto nel browser non garantisce sempre di mantenere le
sottocartelle.

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
