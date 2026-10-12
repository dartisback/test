# Belluno Patrol

Prototipo **singleplayer in terza persona** ambientato a Belluno (quartiere Questura / Piazza dei Martiri).
Parti come cittadino, vai in Questura, entri in servizio, prendi divisa e armi, scegli la volante e vai in pattuglia.

## Come giocare (Windows / Mac / Linux)

1. Scarica il progetto (su GitHub: **Code → Download ZIP**) ed estrailo.
2. Apri la cartella `game` e **fai doppio clic su `index.html`** (consigliato Chrome o Edge).
3. *Nuova partita* → scegli lo spawn → *Gioca*.

Non serve installare niente. (Alternativa: `npm install && npm start` e apri http://localhost:8080)

> Se la grafica scatta: *Impostazioni → Grafica* (ombre, risoluzione, distanza visiva).

## Comandi

| A piedi | |
|---|---|
| W A S D / Mouse | Muovi / guarda |
| Shift · Spazio · C (o Ctrl) | Corri · Salta · Accovacciati |
| E | Interagisci (banco, spogliatoio, armeria, chiavi) |
| F | Sali / scendi dall'auto |
| 1 · 2 · 3 · 0 | Pistola · Taser · Manganello · Riponi |
| Tasto destro / sinistro | Mira / Spara |
| M | Mappa · F1 Menu Admin · F2 Aiuto |

| In auto | |
|---|---|
| W / S · A / D | Accelera-frena-retro · Sterza |
| Spazio | Freno a mano |
| Q | **Sirena italiana** (campione reale con effetto "deep") |
| H · L · V | Clacson · Fari · Riallinea camera |

Il controller (Xbox/PlayStation) è supportato: stick, RT/LT, A/B/X/Y, LB sirena, RB fari.

## Percorso di gioco

1. Raggiungi la **Questura** (segnale giallo + minimappa)
2. **Banco accoglienza** → entra in servizio
3. **Spogliatoio** → divisa
4. **Armeria** → pistola, taser, manganello
5. **Bacheca chiavi** (sala operativa) → scegli Giulia o Giulietta
6. Esci dal retro, **sali sulla volante** (F) e pattuglia: la Centrale ti manda in giro per Belluno

## Menu

Home · Selezione spawn con mappa · Schermata di caricamento · Impostazioni (generale, grafica, audio) · Pausa · Comandi · Crediti · **Menu Admin** (teletrasporto, ora del giorno, kit divisa/armi, genera auto, noclip, fasi missione…).

## Sviluppo

```
npm install
npm run build   # bundle -> dist/game.js (da committare)
npm run dev     # watch
```

Struttura: `src/layout.js` (città), `src/world.js` (3D), `src/questura.js` (edificio e interni), `src/vehicle.js` (auto), `src/character.js` + `src/player.js`, `src/missions.js`, `src/ui.js`, `src/audio.js`.

## Note

- La mappa è un **layout stilizzato** ispirato a Belluno, non usa dati di Google Maps (i termini d'uso non lo consentono). Il passo successivo è importare dati OpenStreetMap + quote del terreno.
- Modelli, divise e livree sono procedurali/provvisori. Stemmi e livrea della Polizia di Stato sono riprodotti solo a scopo personale: non pubblicare o vendere senza autorizzazione.
- Prossimo passo consigliato per grafica "stile GTA 5": portare il progetto su Unreal Engine 5 (MetaHuman, veicoli Chaos).
