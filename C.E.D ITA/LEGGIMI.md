# C.E.D ITA – Server FiveM

ESX Legacy + ox_inventory con grafica nuova + notifiche animate + FivePD
Job: **Polizia Di Stato – Operatore** e **Arma Dei Carabinieri – Operatore**

| Inventario (ox_inventory con tema C.E.D ITA) | Notifiche animate |
|---|---|
| ![inventario](anteprime/inventario.png) | ![notifiche](anteprime/notifiche.png) |

---

## Cosa c'è dentro

```
C.E.D ITA/
├── AVVIA_SERVER.bat          ← avvia il server
├── AVVIA_TXADMIN.bat         ← (facoltativo) avvia con il pannello txAdmin
├── CREA_DATABASE.bat         ← crea il database (lo fa già AVVIA_SERVER.bat)
├── INSTALLA_RISORSE.bat      ← aggiorna ox_* (-Aggiorna) e riapplica il tema
├── artifacts/                ← QUI metti gli artifacts (FXServer.exe)
├── database/ced_ita.sql      ← tabelle + job (usato in automatico)
├── anteprime/                ← immagini della grafica
├── strumenti/                ← script di installazione + tema ox_inventory
└── server-data/
    ├── server.cfg            ← configurazione (qui va la key)
    ├── permessi.cfg          ← admin e permessi
    └── resources/
        ├── [cfx]/            spawnmanager
        ├── [ox]/             oxmysql, ox_lib, cfxlua-require, ox_inventory (già con tema)
        ├── [esx]/            ESX Legacy 1.16 (esx_notify con le notifiche nuove)
        ├── [ced]/            ced_forzeordine (Polizia / Carabinieri / ponte FivePD)
        └── [fivepd]/         QUI metti FivePD
```

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
| `/colleghi` | Mostra quanti agenti sono in servizio |
| `/testnotifiche` | Mostra tutti i tipi di notifica (disattivalo in `esx_notify/Config.lua`) |
| **F2** / **TAB** | Inventario / barra rapida |

Punti di servizio con marker (tasto **E**):
- **Questura – Polizia Di Stato**: Mission Row
- **Caserma – Arma Dei Carabinieri**: Sandy Shores

---

## Personalizzare

| Cosa | Dove |
|---|---|
| Nome server, slot, porta | `server-data/server.cfg` |
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

## Problemi comuni

- **"Couldn't find resource fivepd"** → non hai ancora messo FivePD (passo 4).
- **"Impossibile collegarsi a MySQL"** → MySQL non è avviato in XAMPP, oppure la password nella `mysql_connection_string` è sbagliata.
- **"Non trovo mysql.exe"** → installa XAMPP oppure usa `CREA_DATABASE.bat -MySql "C:\percorso\mysql.exe"`.
- **"ESX Requires a minimum Artifact version"** → scarica artifacts più recenti.
- **Server che non parte da una cartella con spazi** → se capita, sposta la cartella in un percorso semplice, es. `C:\CED_ITA\`.

---

## Crediti e licenze

- [ESX Legacy](https://github.com/esx-framework/esx_core) – GPL-3.0
- [oxmysql](https://github.com/overextended/oxmysql), [ox_lib](https://github.com/overextended/ox_lib), [ox_inventory](https://github.com/overextended/ox_inventory) – LGPL-3.0 / GPL-3.0, [cfxlua-require](https://github.com/overextended/cfxlua-require) – MPL-2.0
- spawnmanager – [cfx-server-data](https://github.com/citizenfx/cfx-server-data)
- FivePD – da scaricare dal sito ufficiale (non incluso)
- Notifiche, tema inventario e `ced_forzeordine`: C.E.D ITA
