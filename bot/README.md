# Bot Assistenza – Next Rome RP

Appena parte, il bot entra nel canale vocale d'attesa con le **cuffie barrate** (si mette da solo in "Silenzia server": non ascolta ma può parlare e suonare). Se uno staff lo muta di microfono, si smuta da solo.
Quando un utente entra:
1. dice *"Ciao! Benvenuto nella Assistenza di Next Rome RP, ho appena avvisato uno staff!"*
2. parte la musichetta d'attesa in loop (si ferma quando il canale resta vuoto)
   - se entra un'altra persona mentre qualcuno sta già ascoltando la musica, la musica **non si ferma e non riparte**: il saluto di chi è entrato si sovrappone (musica abbassata per qualche secondo)
   - nota: un bot Discord manda un solo audio per canale, quindi il saluto lo sentono anche gli altri già presenti
3. manda un DM a tutti quelli che hanno il ruolo staff

## Setup
1. **Resetta il token** nel Developer Portal (Bot → Reset Token) e mettilo solo nel file `.env`
   (copia `.env.example` in `.env`).
2. Developer Portal → Bot → attiva **Server Members Intent** (serve per trovare chi ha il ruolo staff).
3. Il bot deve avere i permessi *Connetti*, *Parla*, **Silenzia membri** e **Escludi l'audio dei membri** (Rendi sordi) sul canale vocale: servono per mettersi le cuffie barrate e per smutarsi da solo.
4. Avvia con `avvia-bot.bat` (la prima volta installa da solo le dipendenze; serve Node.js 18+).

## Avvio (anche senza finestra)
- `avvia-bot.bat` → avvia il bot in una finestra cmd. **Se chiudi la finestra il bot va offline.**
- `avvia-bot-nascosto.vbs` → avvia il bot **in background**, senza finestra: resta online anche se chiudi tutto.
- `ferma-bot.bat` → ferma il bot (quello nascosto o quello in finestra).

Per avviarlo insieme al server FiveM, nel tuo `start.bat` aggiungi (adatta il percorso):
```
wscript "C:\percorso\bot\avvia-bot-nascosto.vbs"
```
Se riavvii il PC il bot deve essere riavviato (cioè basta rilanciare il tuo `start.bat`).
Il log non si vede più: per vederlo usa `avvia-bot.bat`.

## Musica d'attesa
Di default usa `attesa.wav` (generata da `genera-attesa.js`). Per usare la tua, metti un
file `attesa.mp3` nella cartella: ha la precedenza.

## Comandi slash
Gli ID di ruoli e canali si mettono nel `.env` (vedi `.env.example`). Se manca un ID, il comando te lo dice.
Al primo avvio il bot registra i comandi da solo: il bot deve essere stato invitato con lo scope **applications.commands**
(altrimenti nel log vedi "Missing Access": rigenera il link d'invito con `bot` + `applications.commands`).

| Comando | Chi lo usa | Cosa fa |
|---|---|---|
| `/whitelistaccettata` | staff whitelist | dà il ruolo whitelist, pubblica l'esito e manda DM |
| `/whitelistrimandata` | staff whitelist | pubblica l'esito con motivo e manda DM |
| `/convocanowl` | staff whitelist | convoca al colloquio (data/ora/stanza), pubblica e manda DM |
| `/modulowl` | tutti | apre il modulo whitelist; lo staff accetta/rifiuta coi bottoni |
| `/ticketpanel` | assistenza | pubblica il pannello ticket (Assistenza / Report) |
| `/warnplayer` | assistenza | warn a un giocatore, conta i warn, log + DM facoltativo |
| `/banplayer` | assistenza | registra il ban (il ban in-game va fatto a parte), log + DM |
| `/warnfazioni` | assistenza | warn a una fazione, con conteggio |
| `/esitiazioni` | assistenza | pubblica l'esito di un'azione (vittoria/sconfitta/pareggio/annullata) |
| `/asseseguite` | assistenza | registra un'assistenza eseguita, con conteggio totale e settimanale |
| `/reporteseguiti` | assistenza | registra un report gestito, con conteggio totale e settimanale |
| `/modulodirezione` | tutti | modulo per la direzione; la direzione accetta/rifiuta |
| `/candidaturastaff` `/candidaturateamac` `/candidaturacreator` | tutti | candidature con modulo; la direzione accetta/rifiuta e il candidato riceve il DM |

I ruoli admin del server possono usare tutti i comandi. I dati (warn, ban, conteggi) sono salvati in `data/db.json`.
