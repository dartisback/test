-- C.E.D ITA - selezione personaggi e registrazione anagrafica (lato server)
--
-- Parla con ESX come il multicharacter ufficiale:
--   personaggio esistente -> TriggerEvent('esx:onPlayerJoined', source, 'charN')
--   personaggio nuovo     -> TriggerEvent('esx:onPlayerJoined', source, 'charN', datiAnagrafici)

local sessioni = {}   -- [source] = { licenza, slot, personaggi = { [id] = riga }, stato }
local ultimaAzione = {}

CreateThread(function()
    if not ESX.GetConfig().Multichar then
        print('^1[ced_personaggi] ESX non e\' in modalita\' multicharacter: controlla es_extended/shared/config/main.lua^7')
    end
end)

local function prefissoDi(id)
    return ('%s%d'):format(Config.Prefisso, id)
end

local function troppoVeloce(source)
    local adesso = GetGameTimer()
    if ultimaAzione[source] and adesso - ultimaAzione[source] < 800 then return true end
    ultimaAzione[source] = adesso
    return false
end

local function slotValido(sessione, id)
    id = tonumber(id)
    if not id or id ~= math.floor(id) or id < 1 or id > sessione.slot then return nil end
    return id
end

-- ---------------------------------------------------------------------
--  lettura personaggi
-- ---------------------------------------------------------------------
local function leggiPersonaggi(licenza)
    local righe = MySQL.query.await([[
        SELECT u.identifier, u.accounts, u.firstname, u.lastname, u.dateofbirth, u.sex, u.height,
               u.skin, u.disabled, u.job, j.label AS job_label, g.label AS grade_label
        FROM users u
        LEFT JOIN jobs j ON j.name = u.job
        LEFT JOIN job_grades g ON g.job_name = u.job AND g.grade = u.job_grade
        WHERE u.identifier LIKE ?
    ]], { Config.Prefisso .. '%:' .. licenza }) or {}

    local personaggi = {}
    for _, r in ipairs(righe) do
        local id = tonumber(r.identifier:match('^' .. Config.Prefisso .. '(%d+):'))
        if id and r.identifier == prefissoDi(id) .. ':' .. licenza then
            local conti = r.accounts and json.decode(r.accounts) or {}
            personaggi[id] = {
                id = id,
                nome = r.firstname or '',
                cognome = r.lastname or '',
                nascita = r.dateofbirth or '',
                sesso = r.sex == 'f' and 'f' or 'm',
                altezza = tonumber(r.height) or 0,
                lavoro = r.job_label or r.job or 'Disoccupato',
                grado = (r.job ~= 'unemployed' and r.grade_label) or '',
                contanti = conti.money or 0,
                banca = conti.bank or 0,
                skin = r.skin and json.decode(r.skin) or nil,
                disabilitato = r.disabled == 1 or r.disabled == true,
            }
        end
    end
    return personaggi
end

local function elenco(sessione)
    local lista = {}
    for _, p in pairs(sessione.personaggi) do lista[#lista + 1] = p end
    table.sort(lista, function(a, b) return a.id < b.id end)
    return lista
end

lib.callback.register('ced_personaggi:carica', function(source)
    if ESX.GetPlayerFromId(source) then return nil end

    local licenza = ESX.GetIdentifier(source)
    if not licenza then return nil end

    local slot = tonumber(MySQL.scalar.await('SELECT slots FROM multicharacter_slots WHERE identifier = ?', { licenza }))
        or Config.Slot

    local sessione = { licenza = licenza, slot = math.max(1, math.min(slot, 20)), stato = 'pronto' }
    sessione.personaggi = leggiPersonaggi(licenza)
    sessioni[source] = sessione

    -- durante la selezione ogni giocatore e' in una "stanza" privata
    SetPlayerRoutingBucket(source, source)

    return {
        personaggi = elenco(sessione),
        slot = sessione.slot,
        puoiEliminare = Config.PuoiEliminare,
        documento = Config.Documento,
        regole = Config.Identita,
    }
end)

-- ---------------------------------------------------------------------
--  entra con un personaggio esistente
-- ---------------------------------------------------------------------
lib.callback.register('ced_personaggi:gioca', function(source, id)
    local sessione = sessioni[source]
    if not sessione or sessione.stato ~= 'pronto' or troppoVeloce(source) then return false end

    id = slotValido(sessione, id)
    local personaggio = id and sessione.personaggi[id]
    if not personaggio or personaggio.disabilitato then return false end

    if ESX.GetPlayerFromIdentifier(prefissoDi(id) .. ':' .. sessione.licenza) then
        DropPlayer(source, 'C.E.D ITA: questo personaggio risulta gia\' in gioco.')
        return false
    end

    sessione.stato = 'ingresso'
    SetPlayerRoutingBucket(source, 0)
    TriggerEvent('esx:onPlayerJoined', source, prefissoDi(id))
    return true
end)

-- ---------------------------------------------------------------------
--  registrazione anagrafica (nuovo personaggio)
-- ---------------------------------------------------------------------
local function pulisciNome(testo)
    if type(testo) ~= 'string' then return nil end
    testo = testo:gsub('%s+', ' '):gsub('^ ', ''):gsub(' $', '')
    -- lettere (anche accentate), spazi, apostrofo e trattino
    if testo == '' or not testo:match("^[%a\128-\255' %-]+$") then return nil end

    local lunghezza = utf8.len(testo)
    local regole = Config.Identita.lunghezzaNome
    if not lunghezza or lunghezza < regole.min or lunghezza > regole.max then return nil end

    -- Maiuscola iniziale per ogni parola: "mario rossi" -> "Mario Rossi", "d'angelo" -> "D'Angelo"
    testo = testo:lower():gsub("^%l", string.upper)
    testo = testo:gsub("([ '%-])(%l)", function(sep, c) return sep .. c:upper() end)
    return testo
end

local function bisestile(anno)
    return (anno % 4 == 0 and anno % 100 ~= 0) or anno % 400 == 0
end

-- niente os.time: su Windows non gestisce le date prima del 1970
local function giorniNelMese(mese, anno)
    if mese == 2 then return bisestile(anno) and 29 or 28 end
    if mese == 4 or mese == 6 or mese == 9 or mese == 11 then return 30 end
    return 31
end

local function validaData(testo)
    if type(testo) ~= 'string' then return nil, 'Data di nascita non valida.' end
    local g, m, a = testo:match('^(%d%d)/(%d%d)/(%d%d%d%d)$')
    g, m, a = tonumber(g), tonumber(m), tonumber(a)
    if not g then return nil, 'Scrivi la data come gg/mm/aaaa.' end

    if m < 1 or m > 12 or g < 1 or g > giorniNelMese(m, a) then
        return nil, 'Questa data non esiste.'
    end

    local oggi = os.date('*t')
    local eta = oggi.year - a
    if oggi.month < m or (oggi.month == m and oggi.day < g) then eta = eta - 1 end

    local regole = Config.Identita.eta
    if eta < regole.min or eta > regole.max then
        return nil, ('L\'eta\' deve essere tra %d e %d anni.'):format(regole.min, regole.max)
    end

    return ('%02d/%02d/%04d'):format(g, m, a)
end

local function validaIdentita(dati)
    if type(dati) ~= 'table' then return nil, 'Dati non validi.' end

    local nome = pulisciNome(dati.nome)
    if not nome then return nil, 'Il nome non e\' valido.' end

    local cognome = pulisciNome(dati.cognome)
    if not cognome then return nil, 'Il cognome non e\' valido.' end

    local nascita, errore = validaData(dati.nascita)
    if not nascita then return nil, errore end

    local sesso = dati.sesso
    if sesso ~= 'm' and sesso ~= 'f' then return nil, 'Scegli il sesso.' end

    local altezza = tonumber(dati.altezza)
    local regole = Config.Identita.altezza
    if not altezza or altezza ~= math.floor(altezza) or altezza < regole.min or altezza > regole.max then
        return nil, ('La statura deve essere tra %d e %d cm.'):format(regole.min, regole.max)
    end

    return { firstname = nome, lastname = cognome, dateofbirth = nascita, sex = sesso, height = altezza }
end

lib.callback.register('ced_personaggi:crea', function(source, id, dati)
    local sessione = sessioni[source]
    if not sessione or sessione.stato ~= 'pronto' or troppoVeloce(source) then
        return { ok = false, errore = 'Attendi un attimo e riprova.' }
    end

    id = slotValido(sessione, id)
    if not id or sessione.personaggi[id] then
        return { ok = false, errore = 'Questo spazio personaggio non e\' disponibile.' }
    end

    local identita, errore = validaIdentita(dati)
    if not identita then return { ok = false, errore = errore } end

    -- controllo finale direttamente sul database
    if MySQL.scalar.await('SELECT 1 FROM users WHERE identifier = ?', { prefissoDi(id) .. ':' .. sessione.licenza }) then
        return { ok = false, errore = 'Questo spazio personaggio e\' gia\' occupato.' }
    end

    sessione.stato = 'ingresso'
    SetPlayerRoutingBucket(source, 0)
    TriggerEvent('esx:onPlayerJoined', source, prefissoDi(id), identita)
    return { ok = true }
end)

-- ---------------------------------------------------------------------
--  eliminazione personaggio (tutte le tabelle collegate)
-- ---------------------------------------------------------------------
local function eliminaDalDatabase(identificativo)
    local colonne = MySQL.query.await([[
        SELECT c.TABLE_NAME, c.COLUMN_NAME
        FROM information_schema.COLUMNS c
        JOIN information_schema.TABLES t ON t.TABLE_SCHEMA = c.TABLE_SCHEMA AND t.TABLE_NAME = c.TABLE_NAME
        WHERE c.TABLE_SCHEMA = DATABASE() AND t.TABLE_TYPE = 'BASE TABLE'
          AND c.DATA_TYPE = 'varchar' AND c.COLUMN_NAME IN ('identifier', 'owner', 'citizenid')
    ]]) or {}

    local query = {}
    for _, c in ipairs(colonne) do
        if c.TABLE_NAME ~= 'users' and c.TABLE_NAME ~= 'multicharacter_slots' then
            query[#query + 1] = {
                query = ('DELETE FROM `%s` WHERE `%s` = ?'):format(c.TABLE_NAME, c.COLUMN_NAME),
                values = { identificativo },
            }
        end
    end
    query[#query + 1] = { query = 'DELETE FROM `users` WHERE `identifier` = ?', values = { identificativo } }

    return MySQL.transaction.await(query)
end

lib.callback.register('ced_personaggi:elimina', function(source, id)
    local sessione = sessioni[source]
    if not Config.PuoiEliminare or not sessione or sessione.stato ~= 'pronto' or troppoVeloce(source) then return nil end

    id = slotValido(sessione, id)
    if not id or not sessione.personaggi[id] then return nil end

    sessione.stato = 'eliminazione'
    local ok = eliminaDalDatabase(prefissoDi(id) .. ':' .. sessione.licenza)
    sessione.stato = 'pronto'

    if ok then
        print(('[ced_personaggi] %s ha eliminato il personaggio %s'):format(GetPlayerName(source), prefissoDi(id)))
        sessione.personaggi = leggiPersonaggi(sessione.licenza)
    end
    return elenco(sessione)
end)

-- ---------------------------------------------------------------------
--  cambio personaggio, pulizia, comandi admin
-- ---------------------------------------------------------------------
if Config.ComandoCambio ~= '' then
    RegisterCommand(Config.ComandoCambio, function(source)
        if source <= 0 or not ESX.GetPlayerFromId(source) or troppoVeloce(source) then return end
        -- ESX salva il personaggio e manda al client 'esx:onPlayerLogout': il client riapre la selezione
        TriggerEvent('esx:playerLogout', source)
    end, false)
end

AddEventHandler('esx:playerLoaded', function(source)
    sessioni[source] = nil
end)

AddEventHandler('playerDropped', function()
    sessioni[source] = nil
    ultimaAzione[source] = nil
end)

ESX.RegisterCommand('setslot', 'admin', function(xPlayer, args, showError)
    local licenza = ESX.GetIdentifier(args.playerId.source)
    args.numero = math.max(1, math.min(math.floor(args.numero), 20))
    MySQL.prepare.await('INSERT INTO multicharacter_slots (identifier, slots) VALUES (?, ?) ON DUPLICATE KEY UPDATE slots = VALUES(slots)',
        { licenza, args.numero })
    local messaggio = ('Slot personaggi di %s impostati a %d.'):format(GetPlayerName(args.playerId.source), args.numero)
    if xPlayer then xPlayer.showNotification(messaggio, 'success') else print(messaggio) end
end, true, {
    help = 'Imposta quanti personaggi puo\' avere un giocatore',
    validate = true,
    arguments = {
        { name = 'playerId', help = 'ID del giocatore', type = 'player' },
        { name = 'numero', help = 'Numero di personaggi (1-20)', type = 'number' },
    },
})
