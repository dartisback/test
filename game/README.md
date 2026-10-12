# Napoli Emergency

Prototipo **singleplayer in terza persona** ambientato a **Napoli** (mappa stilizzata e compressa).
Scegli un corpo e vivi il tuo turno: **Polizia di Stato**, **Arma dei Carabinieri**, **Croce Rossa Italiana** o **Vigili del Fuoco**.

## Come giocare (Windows / Mac / Linux)

1. Scarica il progetto (su GitHub: **Code → Download ZIP**) ed estrailo.
2. Apri la cartella `game` e **fai doppio clic su `index.html`** (consigliato Chrome o Edge).
3. *Nuova partita* → scegli il corpo → scegli dove iniziare → *Gioca*.

Non serve installare niente. Alternativa: `npm install && npm start` e apri http://localhost:8080.
Se scatta: *Impostazioni → Grafica* (ombre, risoluzione, distanza visiva).

## La città

Lungomare Caracciolo e Castel dell'Ovo · Piazza del Plebiscito (colonnato, basilica, Palazzo Reale) · Maschio Angioino ·
**Quartieri Spagnoli** (vicoli stretti, bucato steso, murales con Diego) · **Piazza Mercato** (bancarelle, campanile del Carmine) ·
Porto · **San Giovanni a Teduccio** (murales giganti) · **Vele di Scampia** · Secondigliano · **Vomero** (collina, Castel Sant'Elmo) ·
Capodimonte · **Torre del Greco** · il **Vesuvio** che domina il golfo. Giorno e notte, ospedali (Cardarelli, del Mare).

La città è piena di **pedoni** sui marciapiedi e di **traffico** che ti cede il passo quando usi la sirena.

## Percorso del turno (uguale per tutti i corpi)

1. Raggiungi la **sede** (Questura, Caserma, Comitato CRI, Comando VVF) – segnale giallo
2. **Banco accoglienza** → entra in servizio
3. **Spogliatoio** → divisa
4. **Armeria / magazzino / deposito** → attrezzatura
5. **Bacheca chiavi** → scegli il veicolo
6. Esci dal retro, sali sul mezzo (**F**) e pattuglia: la **Centrale** ti manda le chiamate (**Y** accetta, **N** rifiuta)

## Missioni per corpo

| Corpo | Veicoli | Chiamate |
|---|---|---|
| **Polizia di Stato** | Alfa Romeo Giulia, Giulietta | Scippo · **Inseguimento in auto** · Rapina · Controllo veicolo · Rissa |
| **Carabinieri** | Giulia e Giulietta "Radiomobile" | Le stesse del comparto sicurezza |
| **Croce Rossa** | Ambulanza (Fiat Ducato) | Malore · Incidente con feriti · Trasporto urgente in ospedale |
| **Vigili del Fuoco** | Autopompa serbatoio | Incendio in un appartamento (+ salvataggio) · Auto in fiamme |

**Arresti**: grida «Fermo!» (**X**), usa il taser (**2**), placca (**E**), ammanetta (**E**), metti il sospetto in auto e portalo in sede.
**Inseguimenti**: resta dietro l'auto con la sirena per aumentare la "pressione", o speronala; scappa a piedi se ferma.
**Colleghi**: premi **R** per la radio e chiama **rinforzi** (altre pattuglie ti raggiungono e inseguono), **ambulanza** o **Vigili del Fuoco**.

## Comandi

| A piedi | |
|---|---|
| W A S D / Mouse | Muovi / guarda |
| Shift · Spazio · C | Corri · Salta · Accovacciati |
| E | Interagisci (tieni premuto per soccorrere) |
| F | Sali / scendi dal veicolo |
| 1 · 2 · 3 · 0 | Equipaggiamento / riponi |
| Tasto destro / sinistro | Mira / usa (spara, spruzza acqua) |
| X · R · Y/N | «Fermo!» · Radio · Accetta/rifiuta chiamata |
| M · F1 · F2 | Mappa · Menu Admin · Aiuto |

| In veicolo | |
|---|---|
| W / S · A / D | Accelera-frena-retro · Sterza |
| Spazio | Freno a mano |
| Q | **Sirena italiana** (campione reale con effetto "deep") |
| H · L · V | Clacson · Fari · Riallinea camera |

Il controller (Xbox/PlayStation) è supportato.

## Menu

Home · Scelta corpo · Scelta spawn con mappa di Napoli · Caricamento · Impostazioni · Pausa · Comandi · Crediti ·
**Menu Admin** (F1): cambia corpo, teletrasporto, genera chiamate di test, kit completo, ora del giorno, noclip, veicoli…

## Sviluppo

```
npm install
npm run build   # bundle -> dist/game.js (da committare)
npm run dev     # watch
```

Struttura: `src/napoli.js` (dati della città), `src/world.js` + `landmarks.js` + `props.js` (3D), `hq.js` (sedi),
`roadgraph.js` + `ai.js` (strade e guida IA), `crowd.js` (pedoni), `traffic.js` (auto civili), `npc.js` (sospetti/pazienti),
`calls.js` (chiamate e missioni), `vehicle.js`, `character.js`, `player.js`, `ui.js`, `audio.js`.

## Note

- La mappa è una **Napoli compressa e stilizzata**: non usa dati di Google Maps (i termini d'uso non lo consentono).
  Il passo successivo naturale è importare dati OpenStreetMap + quote del terreno.
- Modelli, divise e livree sono procedurali/provvisori (non sono modelli 3D realistici). Per grafica "stile GTA 5" serve il passaggio a Unreal Engine 5.
- Stemmi, livree e divise dei corpi sono riprodotti solo a scopo personale: non pubblicare o vendere senza autorizzazione.
