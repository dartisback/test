-- C.E.D ITA - radio (lato client)
-- Usa pma-voice: per parlare tieni premuto il tasto radio (di default ALT SINISTRO,
-- si cambia da Impostazioni > Tasti > FiveM > "Talk over Radio").

local stato = {
    accesa = false,
    chiave = 0,          -- canale pma-voice (113.0 MHz -> 1130)
    ultima = nil,        -- ultima frequenza usata, per riaccendere sulla stessa
    volume = Config.VolumeIniziale,
    aperta = false,
}

local voce = exports['pma-voice']

local function chiave(frequenza)
    return math.floor(frequenza * 10 + 0.5)
end

local function invia(azione, dati)
    SendNUIMessage({ azione = azione, dati = dati })
end

local function inviaStato()
    invia('stato', { accesa = stato.accesa, chiave = stato.chiave, volume = stato.volume })
end

local function sintonizza(k)
    voce:setRadioChannel(k)
    stato.chiave = k
    if k ~= 0 then stato.ultima = k end
    inviaStato()
end

local function spegni(motivo, tipo)
    if stato.chiave ~= 0 then voce:setRadioChannel(0) end
    stato.accesa = false
    stato.chiave = 0
    voce:setVoiceProperty('radioEnabled', false)
    inviaStato()
    if motivo then ESX.ShowNotification(motivo, tipo or 'warning', 4000, 'Radio') end
end

local function apri()
    if stato.aperta then return end
    local dati = lib.callback.await('ced_radio:dati', false)
    if not dati or not dati.haRadio then
        return ESX.ShowNotification('Non hai una radio con te.', 'error', 3000, 'Radio')
    end

    stato.aperta = true
    invia('apri', {
        canali = dati.canali,
        libere = dati.libere,
        riservate = dati.riservate,
        stato = { accesa = stato.accesa, chiave = stato.chiave, volume = stato.volume },
    })
    SetNuiFocus(true, true)
end

-- uso dell'oggetto "radio" da ox_inventory (non viene consumato)
exports('usaRadio', function()
    apri()
end)

RegisterCommand('radio', apri, false)
TriggerEvent('chat:addSuggestion', '/radio', 'Apri la radio (serve l\'oggetto Radio)')

-- ---------------------------------------------------------------------
--  callback dall'interfaccia
-- ---------------------------------------------------------------------
RegisterNUICallback('chiudi', function(_, cb)
    stato.aperta = false
    SetNuiFocus(false, false)
    cb('ok')
end)

RegisterNUICallback('accendi', function(_, cb)
    stato.accesa = true
    voce:setVoiceProperty('radioEnabled', true)
    voce:setRadioVolume(stato.volume)
    if stato.ultima then sintonizza(stato.ultima) else inviaStato() end
    cb('ok')
end)

RegisterNUICallback('spegni', function(_, cb)
    spegni()
    cb('ok')
end)

RegisterNUICallback('sintonizza', function(dati, cb)
    local frequenza = tonumber(dati.frequenza)
    if not stato.accesa or not frequenza then return cb(false) end

    local libera = frequenza >= Config.Libere.min and frequenza <= Config.Libere.max
    local riservata = frequenza >= Config.Riservate.min and frequenza <= Config.Riservate.max
    if not libera and not riservata then
        ESX.ShowNotification(('Frequenza non valida (libere: %.1f - %.1f).'):format(Config.Libere.min, Config.Libere.max), 'error', 3500, 'Radio')
        return cb(false)
    end

    -- il server (pma-voice) decide se puoi entrare nei canali riservati
    sintonizza(chiave(frequenza))
    cb(true)
end)

RegisterNUICallback('volume', function(dati, cb)
    stato.volume = math.max(0, math.min(100, math.floor(tonumber(dati.valore) or stato.volume)))
    voce:setRadioVolume(stato.volume)
    cb('ok')
end)

RegisterNUICallback('membri', function(_, cb)
    if stato.chiave == 0 then return cb({}) end
    cb(lib.callback.await('ced_radio:membri', false, stato.chiave) or {})
end)

-- ---------------------------------------------------------------------
--  eventi
-- ---------------------------------------------------------------------
RegisterNetEvent('pma-voice:radioChangeRejected', function()
    stato.chiave = 0
    inviaStato()
    ESX.ShowNotification('Accesso negato: frequenza riservata.', 'error', 3500, 'Radio')
end)

RegisterNetEvent('ced_radio:espulso', function()
    stato.chiave = 0
    inviaStato()
    ESX.ShowNotification('Non sei piu\' autorizzato su questa frequenza.', 'warning', 4000, 'Radio')
end)

-- quando parli in radio il display mostra "TX"
AddEventHandler('pma-voice:radioActive', function(attivo)
    invia('trasmissione', attivo)
end)

-- radio persa, data via o buttata: si spegne
AddEventHandler('ox_inventory:itemCount', function(nome, quantita)
    if nome == Config.Oggetto and (quantita or 0) <= 0 and stato.accesa then
        spegni('Non hai piu\' la radio: si e\' spenta.')
    end
end)

RegisterNetEvent('esx:onPlayerLogout', function()
    spegni()
end)

AddEventHandler('onResourceStop', function(risorsa)
    if risorsa == GetCurrentResourceName() and stato.accesa then
        voce:setRadioChannel(0)
    end
end)
