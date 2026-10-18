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
(`fx`: `glitch`, `wobble`, `shake`, `pulse`, `siren` = lampeggiante blu).

Grafica tricolore neon (verde/bianco/rosso): `Config.NeonTricolore = true` (mettilo a `false` per il look classico).

## Se la chat di default parte lo stesso (metodo sicuro, consigliato)
Fai cosi', in questo ordine:
1. **Tieni UNA sola copia di questa chat.** Se in `resources` ne hai due (es. `fancy_chat` e `chat`) cancellane una.
2. **Cancella la chat originale**: di solito e' `resources/[cfx-default]/[gameplay]/chat`.
   (Se vuoi tenerla di scorta, spostala fuori da `resources`, non basta rinominarla con "ensure chat" ancora nel cfg.)
3. Nel `server.cfg` togli `ensure chat`, `start chat` e `ensure chat-theme-gtao`, lascia solo `ensure fancy_chat`.
4. Riavvia il server (non basta il restart della risorsa).

All'avvio la console dice da sola dove si trova la chat di default che ha fermato
e quali script hanno `dependency 'chat'`.
Altre chat da fermare (es. `okokChat`) vanno aggiunte in `Config.StopResources`.
