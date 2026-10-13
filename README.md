# RomaPD 2.0 – Server FiveM RP (ESX Legacy + ox)

Server roleplay italiano basato su **ESX Legacy** con **ox_lib**, **ox_inventory** e **oxmysql**.

## Contenuto del repository

| Percorso | Descrizione |
|---|---|
| `server.cfg` | Configurazione server e ordine di avvio delle risorse |
| `sql/romapd.sql` | Tabelle di supporto + lavori **Polizia di Stato**, **Carabinieri**, **Croce Rossa** con gradi e stipendi |
| `resources/[romapd]/rp_f5menu` | Menu **F5**: Documenti (carta d'identità, patenti, mostra a un giocatore vicino) e **Seleziona lavoro** |
| `resources/[romapd]/rp_jobcreator` | **Job Creator** per lo staff (`/jobcreator`, o dal menu F5): crea/elimina lavori, gradi, whitelist, assegna lavoro |
| `resources/[romapd]/rp_garage` | **Garage** personali (owned_vehicles) + garage di servizio per i 3 corpi, `/givecar` per lo staff |

## Lavori (SQL)

| Nome interno | Etichetta | Gradi |
|---|---|---|
| `police` | Polizia di Stato | Agente → Assistente Capo → Sovrintendente → Ispettore → Commissario → **Questore** (boss) |
| `carabinieri` | Carabinieri | Carabiniere → Appuntato Scelto → Maresciallo → Tenente → Capitano → **Colonnello** (boss) |
| `ambulance` | Croce Rossa | Volontario → Soccorritore → Infermiere → Medico → **Direttore Sanitario** (boss) |

`ambulance` è il nome interno standard ESX: mantiene la compatibilità con gli script medici/society esistenti.

## Installazione

1. **Scarica le dipendenze** nella cartella `resources/` (non incluse):
   - [oxmysql](https://github.com/overextended/oxmysql/releases)
   - [ox_lib](https://github.com/overextended/ox_lib/releases)
   - [es_extended](https://github.com/esx-framework/esx_core) (ESX Legacy 1.10+, con `esx_identity` o simile per nome/cognome/data di nascita)
   - [ox_inventory](https://github.com/overextended/ox_inventory/releases) (build release; richiede ox_lib e oxmysql)
2. **Database**: crea il DB `romapd`, importa prima lo schema base di ESX (`es_extended.sql`) e poi `sql/romapd.sql`.
3. **server.cfg**: inserisci `sv_licenseKey`, `steam_webApiKey` e la `mysql_connection_string`; aggiungi il tuo account admin con
   `add_principal identifier.license:XXXX group.admin`.
4. In `es_extended/config.lua` ox_inventory viene rilevato automaticamente; verifica `Config.CustomInventory` secondo la guida di ox_inventory.
5. Avvia il server.

## Uso

- **F5** → menu principale (Documenti, Seleziona lavoro, Job Creator se staff).
- **Seleziona lavoro**: lavori elencati in `rp_f5menu/config.lua` → `Config.SelectableJobs`. I tre corpi sono selezionabili al grado iniziale; **rimuovili dalla lista** per renderli whitelist (assunzione solo da staff via Job Creator).
- **Job Creator** (`/jobcreator`, gruppi `admin`/`superadmin`): crea lavori (con gradi Dipendente/Capo), aggiunge/modifica/elimina gradi, attiva whitelist, assegna il lavoro a un giocatore.
- **Garage**: marker blu `[E]` nei garage pubblici (ritira/deposita i propri veicoli); marker nei garage di servizio visibili solo ai membri del corpo, con veicoli per grado minimo. Lo staff può dare un veicolo con `/givecar [id] [modello]`.
- Le coordinate (Los Santos) e i modelli dei veicoli si cambiano in `rp_garage/config.lua`; per le livree italiane servono veicoli addon.
