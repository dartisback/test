# FLUX BOT ITA — pannello licenze (localhost)

Sito + dashboard con login Discord, gestione licenze per ruolo e coda comandi per i bot.

## Avvio

```bash
npm install
cp .env.example .env     # poi compila i valori (vedi sotto)
npm start                # sito → http://localhost:3000
npm run bot              # bot Discord online (in un secondo terminale)
```

## Configurazione Discord

1. https://discord.com/developers/applications → la tua app → **OAuth2**
   - copia **Client ID** e **Client Secret** in `.env`
   - aggiungi il redirect: `http://localhost:3000/auth/discord/callback`
2. **Bot** → copia il token in `DISCORD_BOT_TOKEN` e attiva **Server Members Intent**.
   Il bot deve essere nel server (`DISCORD_GUILD_ID`) per leggere i ruoli.
3. Il bot si avvia **a parte** dal sito: `start-bot.bat` (o `npm run bot`) lo mette online nel server.
   Se vedi `❌ Bot Discord fermato` nel terminale, il token è sbagliato.
   Il sito funziona anche a bot spento: il token serve solo per leggere i ruoli.
4. `.env` è in `.gitignore`: **non committarlo mai**.

## Ruoli

| Ruolo | Cosa può fare |
|-------|---------------|
| **owner** | crea ed elimina licenze `day` / `week` / `lifetime` (anche in blocco), vede tutte le licenze |
| **staff** | riceve automaticamente una key **lifetime** al login |
| **user** | riscatta una chiave ricevuta dall'owner e usa i controlli |

Chi non ha nessuno dei tre ruoli (o non è nel server) non può entrare. I ruoli vengono ricontrollati ogni 60s.
Le licenze `day`/`week` iniziano a scadere dal momento del **riscatto**.

## Endpoint per la risorsa FiveM

Il server interroga il pannello ogni ~5s:

```
POST /api/fivem/poll
x-license: FLUX-XXXX-XXXX-XXXX-XXXX
→ { ok, commands: [...], bots: [{id,name}], max }
```

La risorsa lato server FiveM **non** è inclusa in questo repo. Su localhost, se nessun server fa poll da >15s,
il pannello simula il poll così vedi l'effetto dei comandi nella dashboard.

## Test locale senza Discord

Metti `DEV_LOGIN=1` e apri `/auth/dev?role=owner|staff|user` (solo da 127.0.0.1). Lascia `DEV_LOGIN=0` altrove.

## Struttura

`server.js` (API/auth) · `lib/store.js` (DB su `data/db.json`) · `lib/discord.js` · `public/` (landing + dashboard)
