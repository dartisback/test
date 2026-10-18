# fancy_chat — chat animata per ESX (stile okokChat)

## Installazione
1. Copia la cartella `fancy_chat` in `resources/`.
2. Nel `server.cfg` **togli** `ensure chat` / `start chat` (e anche `chat-theme-gtao`) e aggiungi `ensure fancy_chat` (dopo `es_extended`).
   Se la chat di default parte lo stesso, fancy_chat la ferma da sola (`Config.StopDefaultChat`);
   controlla comunque che nessun altro script abbia `dependency 'chat'` nel suo fxmanifest.
3. Riavvia il server. Si apre con **T** (tasto cambiabile in Config.OpenKey / impostazioni tasti FiveM).

## Comandi
| Comando | Chi lo usa | Chi lo vede |
|---|---|---|
| `/anon <msg>` | tutti | tutti (il nome reale va solo nella console del server) |
| `/twitter <msg>` (`/twt`) | tutti | tutti — #hashtag e @menzioni evidenziati |
| `/annuncio <msg>` (`/ad`) | **qualsiasi lavoro** (tranne `unemployed`) | tutti — lavoro, grado, icona e colore presi in automatico |
| `/staff <msg>` | gruppi admin | solo gli admin |
| `/staffo <msg>` | gruppi admin | tutti |
| `/pds <msg>` | job `police` | tutti |
| `/cc <msg>` | job `carabinieri` | tutti |
| *(testo senza `/`)* | tutti | giocatori vicini (chat locale) |

Tutto si configura in `config.lua` (cooldown, colori, icone, gruppi, lavori, destinatari).

## Immagini dei lavori
Per `/annuncio` basta mettere un file in `html/img/jobs/<nome_lavoro>.png` (anche `.webp .jpg .gif .svg`):
viene trovato da solo. Senza file si usa l'icona di default e un colore generato dal nome del lavoro.

## Compatibilita'
Supporta `chat:addMessage`, `chat:addSuggestion(s)`, `chat:removeSuggestion`, `chat:clear`.
Export server: `exports.fancy_chat:sendMessage(target, { title=, author=, text=, color=, icon=, fx= })`
(`fx`: `glitch`, `wobble`, `shake`, `pulse`, `siren`).
