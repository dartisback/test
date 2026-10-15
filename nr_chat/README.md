# nr_chat — chat animata in stile okokChat (ESX + ox_inventory)

| Comando    | Chi scrive                       | Chi legge                  |
|------------|----------------------------------|----------------------------|
| `/anon`    | tutti                            | tutti (nome nascosto, lo staff vede chi e')|
| `/staff`   | gruppo ESX `admin` / `superadmin`| solo staff                 |
| `/staffo`  | gruppo ESX `admin` / `superadmin`| tutti + banner animato     |
| `/twitter` | chi ha l'item `phone` in ox_inventory | tutti               |
| `/pds`     | job `police`                     | solo job `police`          |
| `/cc`      | job `carabinieri`                | solo job `carabinieri`     |

Tasti: `T` apre la chat, `/` la apre gia' col comando. `Invio` invia, `Tab` completa il comando,
`↑ ↓` cronologia, `Esc` chiude.

## Installazione
1. Copia la cartella `nr_chat` in `resources/`.
2. Nel `server.cfg` **togli `ensure chat`** (nr_chat la sostituisce, `provide 'chat'`) e aggiungi
   dopo `es_extended` e `ox_inventory`:
   ```
   ensure nr_chat
   ```
3. Modifica `config.lua`: gruppi staff, nome dell'item telefono, nomi dei job
   (`police`, `carabinieri`), colori, cooldown. I job devono esistere con quel nome nel database.

Le altre risorse continuano a funzionare: `chat:addMessage`, `chat:addSuggestion(s)`, `chat:clear`
sono supportati. Da script: `exports.nr_chat:SendSystem(source, 'testo')`.

## Note
- `/staffo` e' interpretato come annuncio ufficiale dello staff visibile a tutti; per cambiare
  comportamento modifica `audience` nel canale in `config.lua`.
- Per spostare la chat cambia `top`/`left` di `#chat` in `html/style.css`.
