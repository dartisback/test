# Bot Assistenza – Next Rome RP

Appena parte, il bot entra nel canale vocale d'attesa (non mutato, così può parlare e suonare).
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
3. Il bot deve avere i permessi *Connetti* e *Parla* sul canale vocale.
4. Avvia con `avvia-bot.bat` (la prima volta installa da solo le dipendenze; serve Node.js 18+).

## Avvio insieme al server FiveM
Nel tuo `start.bat`, aggiungi questa riga (adatta il percorso):
```
start "Bot Assistenza" /min cmd /c "C:\percorso\bot\avvia-bot.bat"
```

## Musica d'attesa
Di default usa `attesa.wav` (generata da `genera-attesa.js`). Per usare la tua, metti un
file `attesa.mp3` nella cartella: ha la precedenza.
