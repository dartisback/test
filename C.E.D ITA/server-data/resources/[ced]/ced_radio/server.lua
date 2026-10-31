-- C.E.D ITA - radio (lato server)
-- I canali sono numeri interi per pma-voice: 113.0 MHz -> canale 1130

local function chiave(frequenza)
    return math.floor(frequenza * 10 + 0.5)
end

local canali = {}
for _, c in ipairs(Config.Canali) do
    c.chiave = chiave(c.frequenza)
    c.ammessi = {}
    for _, lavoro in ipairs(c.lavori) do c.ammessi[lavoro] = true end
    canali[c.chiave] = c
end

local function haRadio(source)
    return (exports.ox_inventory:Search(source, 'count', Config.Oggetto) or 0) > 0
end

local function autorizzato(source, canale)
    local xPlayer = ESX.GetPlayerFromId(source)
    if not xPlayer or not canale or not canale.ammessi[xPlayer.job.name] then return false end
    if Config.SoloInServizio and not xPlayer.job.onDuty then return false end
    return true
end

-- pma-voice chiede a noi se un giocatore puo' entrare in una frequenza riservata
CreateThread(function()
    while GetResourceState('pma-voice') ~= 'started' do Wait(500) end

    for k = chiave(Config.Riservate.min), chiave(Config.Riservate.max) do
        local canale = canali[k]
        exports['pma-voice']:addChannelCheck(k, function(source)
            return canale ~= nil and haRadio(source) and autorizzato(source, canale)
        end)
    end
end)

local function membri(k)
    local lista = {}
    for source in pairs(exports['pma-voice']:getPlayersInRadioChannel(k)) do
        local xPlayer = ESX.GetPlayerFromId(source)
        if xPlayer then
            lista[#lista + 1] = { nome = xPlayer.getName(), sigla = Config.SiglaLavoro[xPlayer.job.name] or '' }
        end
    end
    table.sort(lista, function(a, b) return a.nome < b.nome end)
    return lista
end

lib.callback.register('ced_radio:dati', function(source)
    local disponibili = {}
    for _, c in ipairs(Config.Canali) do
        if autorizzato(source, c) then
            local presenti = 0
            for _ in pairs(exports['pma-voice']:getPlayersInRadioChannel(c.chiave)) do presenti = presenti + 1 end
            disponibili[#disponibili + 1] = {
                frequenza = c.frequenza, chiave = c.chiave, nome = c.nome,
                sigla = c.sigla, colore = c.colore, presenti = presenti,
            }
        end
    end

    return {
        haRadio = haRadio(source),
        canali = disponibili,
        libere = Config.Libere,
        riservate = Config.Riservate,
    }
end)

-- elenco di chi e' in ascolto: solo per chi e' sintonizzato su quel canale
lib.callback.register('ced_radio:membri', function(source, k)
    k = tonumber(k)
    if not k or exports['pma-voice']:getPlayersInRadioChannel(k)[source] == nil then return {} end
    return membri(k)
end)

-- cambio lavoro / fine servizio: fuori dai canali riservati non piu' permessi
local function ricontrolla(source)
    local attuale = Player(source).state.radioChannel
    local canale = attuale and canali[attuale]
    local riservato = attuale and attuale >= chiave(Config.Riservate.min) and attuale <= chiave(Config.Riservate.max)
    if riservato and not autorizzato(source, canale) then
        exports['pma-voice']:setPlayerRadio(source, 0)
        TriggerClientEvent('ced_radio:espulso', source)
    end
end

AddEventHandler('esx:setJob', function(source)
    ricontrolla(source)
end)
