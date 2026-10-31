# C.E.D ITA – Server FiveM

ESX Legacy + ox_inventory con grafica nuova + notifiche animate + FivePD
Selezione personaggi e carta d'identità italiana fatte da zero + illenium-appearance con tema C.E.D ITA
Job: **Polizia Di Stato – Operatore** e **Arma Dei Carabinieri – Operatore**
Si aggiorna da solo a ogni avvio (tiene key, database e le tue modifiche).

| Radio interforze | |
|---|---|
| ![radio](anteprime/radio.png) | |

| Selezione personaggi | Ufficio Anagrafe (identity) |
|---|---|
| ![personaggi](anteprime/personaggi.png) | ![anagrafe](anteprime/anagrafe.png) |

| Aspetto (illenium-appearance) | Inventario (ox_inventory) | Notifiche animate |
|---|---|---|
| ![aspetto](anteprime/aspetto.png) | ![inventario](anteprime/inventario.png) | ![notifiche](anteprime/notifiche.png) |

---

## Cosa c'è dentro

```
C.E.D ITA/
├── AVVIA_SERVER.bat          ← aggiorna (da GitHub) e avvia il server
├── AGGIORNA.bat              ← solo aggiornamento, senza avviare
├── AVVIA_TXADMIN.bat         ← (facoltativo) avvia con il pannello txAdmin
├── CREA_DATABASE.bat         ← crea il database (lo fa già AVVIA_SERVER.bat)
├── AVVIA_XAMPP.bat           ← apre XAMPP controllando/riparando MySQL da solo
├── RIPARA_MYSQL_XAMPP.bat    ← ripara "MySQL shutdown unexpectedly" senza perdere i dati
├── INSTALLA_RISORSE.bat      ← aggiorna ox_* (-Aggiorna) e riapplica il tema
├── artifacts/                ← QUI metti gli artifacts (FXServer.exe)
├── database/ced_ita.sql      ← tabelle + job (usato in automatico)
├── database/illenium_appearance.sql ← solo le tabelle di illenium-appearance (da importare a mano se serve)
├── anteprime/                ← immagini della grafica
├── strumenti/                ← script (avvio, aggiornamento, database, XAMPP, temi)
└── server-data/
    ├── server.cfg            ← configurazione (qui va la key)
    ├── permessi.cfg          ← admin e permessi
    └── resources/
        ├── [cfx]/            spawnmanager
        ├── [ox]/             oxmysql, ox_lib, cfxlua-require, ox_inventory (già con tema)
        ├── [esx]/            ESX Legacy 1.16 (esx_notify con le notifiche nuove)
        ├── [aspetto]/        illenium-appearance (tema C.E.D ITA, in italiano)
        ├── [ced]/            ced_personaggi (selezione personaggi + anagrafe)
        │                     ced_forzeordine (Polizia / Carabinieri / ponte FivePD)
        │                     ced_radio (radio interforze con l'oggetto Radio)
        ├── [voce]/           pma-voice (voce di prossimità + radio)
        └── [fivepd]/         QUI metti FivePD
```

---

## Aggiornamenti automatici

Il server **si aggiorna da solo quando parte**, sia se lo avvii da **FXServer / txAdmin** sia con
`AVVIA_SERVER.bat`: in `server.cfg` la risorsa `ced_aggiornamenti` parte per prima, controlla GitHub
e, se c'è una versione nuova, la applica prima che partano le altre risorse.

- aggiorna **solo i file che non hai modificato tu**;
- `server.cfg`, `risorse.cfg` e `permessi.cfg` vengono uniti: restano **la tua key, il database,
  il nome del server** e tutte le righe che hai aggiunto o cambiato tu (in fondo, sotto "RIGHE AGGIUNTE DA TE");
- se hai modificato un altro file, tiene il **tuo** e mette quello nuovo in `backup\aggiornamento_<data>\nuove_versioni`;
- non tocca mai `artifacts`, `backup`, la cache e le risorse che hai aggiunto tu;
- se manca internet il server parte normalmente con i file attuali.

`server.cfg` contiene solo le tue impostazioni; l'elenco delle risorse è in `risorse.cfg`.
Puoi aggiornare anche a server spento con `AGGIORNA.bat`.
Per disattivare gli aggiornamenti crea un file vuoto `NON_AGGIORNARE.txt` nella cartella principale.

> **Passo da fare una volta sola** (se la tua cartella non ha ancora `ced_aggiornamenti`):
> scarica lo ZIP, copia nella tua cartella `AGGIORNA.bat` e la cartella `strumenti` (sovrascrivi),
> poi fai doppio clic su `AGGIORNA.bat`. Da quel momento basta avviare il server come fai sempre.

---

## Installazione (passo passo)

### 1. Database (si crea da solo)
1. Installa **XAMPP** (https://www.apachefriends.org) e nel pannello premi **Start** su **MySQL**.
   Va bene anche MariaDB o MySQL installati a parte.
2. Fine: quando lanci `AVVIA_SERVER.bat` il database viene **creato in automatico** con il nome
   scritto in `server-data/server.cfg` (di default `ced_ita`), con tutte le tabelle e i lavori:

   | Lavoro | Grado |
   |---|---|
   | Disoccupato | Disoccupato |
   | Polizia Di Stato | Operatore |
   | Arma Dei Carabinieri | Operatore |

   Puoi farlo anche a parte con `CREA_DATABASE.bat`. Rilanciarlo non crea doppioni e non cancella nulla.
3. Se il tuo MySQL ha una password, scrivila in `server-data/server.cfg`:
   ```
   set mysql_connection_string "mysql://root:LATUAPASSWORD@localhost/ced_ita?charset=utf8mb4"
   ```
4. Se `mysql.exe` non viene trovato (installazione in una cartella strana), indicalo tu:
   ```
   CREA_DATABASE.bat -MySql "C:\percorso\mysql.exe"
   ```

In più la risorsa `ced_forzeordine` a ogni avvio controlla che i tre lavori esistano e, se qualcuno
li ha cancellati, li ricrea da sola.

### 2. Artifacts
Scarica gli artifacts Windows (*Recommended*) da
https://runtime.fivem.net/artifacts/fivem/build_server_windows/master/
ed estrai il file `server.7z` dentro la cartella `artifacts`, in modo che esista `artifacts/FXServer.exe`.

### 3. Key (keymaster)
Crea la key su https://keymaster.fivem.net e incollala in `server-data/server.cfg`:
```
sv_licenseKey "INSERISCI_QUI_LA_TUA_KEY"
```

### 4. FivePD
Scarica FivePD da https://fivepd.net ed estrailo in
`server-data/resources/[fivepd]/fivepd/` (deve esserci `fivepd/fxmanifest.lua`).
Dettagli e collegamento con i job in `server-data/resources/[fivepd]/LEGGIMI.txt`.

### 5. Avvio
Doppio clic su **AVVIA_SERVER.bat**.
Poi apri FiveM, premi **F8** e scrivi: `connect localhost`

> **Primo avvio:** ESX controlla il database e a volte scrive
> *"Server restart required"*. È normale: chiudi e riavvia il server una volta.

---

## Diventare admin e dare i job

Scrivi questi comandi nella **console del server** (la finestra nera), usando l'ID del giocatore (il primo che entra è di solito `1`):

```
setgroup 1 admin
setjob 1 polizia 0
setjob 1 carabinieri 0
```

Per rendere l'admin permanente puoi anche aggiungere il tuo identificativo in `server-data/permessi.cfg`.

---

## Comandi in gioco

| Comando | Cosa fa |
|---|---|
| `/servizio` | Entra/esce dal servizio (solo Polizia e Carabinieri) |
| `/cambiapersonaggio` | Torna alla selezione personaggi senza uscire dal server |
| `/reloadskin` | Ricarica il tuo aspetto (se il personaggio si vede male) |
| `/setslot [id] [numero]` | (admin) Quanti personaggi può avere un giocatore |
| `/pedmenu` | (admin) Apre il menu aspetto completo |
| `/migrateskins` | (admin, console) Converte gli aspetti salvati col vecchio esx_skin |
| `/colleghi` | Mostra quanti agenti sono in servizio |
| `/testnotifiche` | Mostra tutti i tipi di notifica (disattivalo in `esx_notify/Config.lua`) |
| **F2** / **TAB** | Inventario / barra rapida |

Punti di servizio con marker (tasto **E**):
- **Questura Di Roma – Polizia Di Stato**: alle coordinate 248.32, -344.58 (con stemma 3D all'ingresso)
- **Caserma – Arma Dei Carabinieri**: Sandy Shores

---

## Personalizzare

| Cosa | Dove |
|---|---|
| Nome server, slot, porta | `server-data/server.cfg` |
| Personaggi per giocatore, punto di spawn, regole carta d'identità | `resources/[ced]/ced_personaggi/config.lua` |
| Grafica selezione personaggi / anagrafe | `resources/[ced]/ced_personaggi/html/style.css` |
| Colori menu aspetto | `resources/[aspetto]/illenium-appearance/shared/theme.lua` (tema `ced-ita`) |
| Negozi di vestiti, barbieri, prezzi | `resources/[aspetto]/illenium-appearance/shared/config.lua` |
| Posizione e suono notifiche | `resources/[esx]/esx_notify/Config.lua` |
| Colori/stile notifiche | `resources/[esx]/esx_notify/nui/css/style.css` |
| Colori inventario | `strumenti/tema_ox_inventory/ced-theme.css` → poi lancia `INSTALLA_RISORSE.bat` |
| Oggetti inventario | `resources/[ox]/ox_inventory/data/items.lua` |
| Stipendi e gradi | tabella `job_grades` nel database (esempio in fondo a `ced_ita.sql`) |
| Blip, punti servizio, testi FdO | `resources/[ced]/ced_forzeordine/config.lua` |
| Gruppi permessi FivePD | `server-data/permessi.cfg` |

Le notifiche si usano da qualsiasi script ESX:
```lua
ESX.ShowNotification("Messaggio", "success")          -- success, error, info, warning
ESX.ShowNotification("Sei in servizio", "polizia")    -- stile Polizia Di Stato
ESX.ShowNotification("Pattuglia", "carabinieri", 5000, "Centrale Operativa")
```

---

## Radio interforze

Usa l'oggetto **Radio** dall'inventario (oppure `/radio` se ce l'hai addosso): si apre una radio portatile
con display, tastierino e l'elenco dei canali a cui hai accesso.

| Frequenza | Canale | Chi entra |
|---|---|---|
| 100.0 | Interforze - Coordinamento | tutte le Forze dell'Ordine + Vigili del Fuoco + 118 |
| 100.1 | Interforze - Operazioni FdO | Forze dell'Ordine |
| 113.0 / 113.1 / 113.2 | Polizia Di Stato - Sala Operativa / Volanti / Squadra Mobile | `polizia` |
| 112.0 / 112.1 / 112.2 | Arma Dei Carabinieri - Centrale Operativa / Radiomobile / Stazione | `carabinieri` |
| 117.0 | Guardia Di Finanza | `guardiadifinanza` |
| 120.0 · 121.0 | Polizia Locale · Polizia Penitenziaria | `polizialocale` · `poliziapenitenziaria` |
| 115.0 · 118.0 | Vigili Del Fuoco · Emergenza Sanitaria 118 | `vigilidelfuoco` · `ambulance` |
| 200.0 - 999.9 | Frequenze libere (si digitano col tastierino) | chiunque abbia la radio |

- Per parlare tieni premuto **ALT SINISTRO** (si cambia in Impostazioni → Tasti → FiveM → "Talk over Radio").
- Tutto tra 100.0 e 199.9 è riservato: il **server** controlla lavoro e radio, non si può forzare.
- Se perdi/dai via la radio si spegne; se cambi lavoro vieni tolto dai canali non più tuoi.
- I job che non esistono ancora (Guardia di Finanza, 118...) sono già pronti: basta crearli.
- Canali, colori e regole (es. solo in servizio) in `resources/[ced]/ced_radio/config.lua`.

---

## Personaggi e aspetto

- All'ingresso si apre la **selezione personaggi** C.E.D ITA: scegli un cittadino e premi *Entra in città*.
- Uno spazio libero apre l'**Ufficio Anagrafe**: nome, cognome, data di nascita (gg/mm/aaaa),
  sesso e statura; la carta d'identità si compila mentre scrivi. Poi si apre **illenium-appearance**
  per creare l'aspetto (viso, capelli, vestiti, tatuaggi).
- I personaggi creati prima di questo aggiornamento restano (nome, soldi, lavoro, oggetti):
  al primo ingresso ti verrà chiesto di rifare l'aspetto, perché il vecchio esx_skin salvava in un
  formato diverso. In alternativa un admin può convertirli dalla console con `migrateskins`.
- In città trovi negozi di vestiti, barbieri e tatuatori con le icone sulla mappa (illenium-appearance).

---

## Problemi comuni

- **"Couldn't find resource fivepd"** → non hai ancora messo FivePD (passo 4).
- **XAMPP: "Error: MySQL shutdown unexpectedly"** → apri XAMPP con `AVVIA_XAMPP.bat` (o con il collegamento
  "XAMPP (auto-riparazione)" sul Desktop): controlla MySQL e, se crasha, lo ripara da solo prima di aprire il pannello.
  - *Livello 1*: ricrea i file di sistema di MySQL e tiene i tuoi database.
  - *Livello 2*: se i database stessi sono rovinati, li salva in `.sql` (modalità recupero), rimette MySQL
    **come appena scaricato** e li reimporta: come reinstallare XAMPP, ma senza perdere i dati.
  - I file originali restano sempre in `xampp\mysql\data_old_...`.
  - Per evitarlo: installa MySQL come servizio (lo script te lo propone) o premi **Stop** prima di spegnere il PC.
- **"Impossibile collegarsi a MySQL"** → MySQL non è avviato in XAMPP, oppure la password nella `mysql_connection_string` è sbagliata.
- **"Non trovo mysql.exe"** → installa XAMPP oppure usa `CREA_DATABASE.bat -MySql "C:\percorso\mysql.exe"`.
- **"ESX Requires a minimum Artifact version"** → scarica artifacts più recenti.
- **Server che non parte da una cartella con spazi** → se capita, sposta la cartella in un percorso semplice, es. `C:\CED_ITA\`.

---

## Crediti e licenze

- [ESX Legacy](https://github.com/esx-framework/esx_core) – GPL-3.0
- [oxmysql](https://github.com/overextended/oxmysql), [ox_lib](https://github.com/overextended/ox_lib), [ox_inventory](https://github.com/overextended/ox_inventory) – LGPL-3.0 / GPL-3.0, [cfxlua-require](https://github.com/overextended/cfxlua-require) – MPL-2.0
- spawnmanager – [cfx-server-data](https://github.com/citizenfx/cfx-server-data)
- [illenium-appearance](https://github.com/iLLeniumStudios/illenium-appearance) – MIT
- [pma-voice](https://github.com/AvarianKnight/pma-voice) – MIT
- FivePD – da scaricare dal sito ufficiale (non incluso)
- Notifiche, tema inventario, `ced_personaggi` e `ced_forzeordine`: C.E.D ITA
