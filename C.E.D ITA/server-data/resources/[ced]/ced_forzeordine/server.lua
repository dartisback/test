local Dipartimenti = Config.Dipartimenti

-- [source] = { principal = 'identifier.license:...', gruppo = 'group.polizia' }
local assegnati = {}

local function getPrincipal(source)
    local license = GetPlayerIdentifierByType(source, 'license')
    return license and ('identifier.%s'):format(license) or nil
end

local function togliGruppo(source)
    local attuale = assegnati[source]
    if not attuale then return end

    ExecuteCommand(('remove_principal %s %s'):format(attuale.principal, attuale.gruppo))
    assegnati[source] = nil
end

-- Allinea gruppo ace e state bag al job ESX del giocatore
local function sincronizza(source, job)
    local dip = job and Dipartimenti[job.name]
    local inServizio = job and job.onDuty == true
    local gruppo = dip and (inServizio or not Config.AceSoloInServizio) and dip.gruppoAce or nil

    local attuale = assegnati[source]
    if not (attuale and attuale.gruppo == gruppo) then
        togliGruppo(source)

        local principal = gruppo and getPrincipal(source)
        if principal then
            ExecuteCommand(('add_principal %s %s'):format(principal, gruppo))
            assegnati[source] = { principal = principal, gruppo = gruppo }
        end
    end

    Player(source).state:set('ced_fdo', dip and {
        dipartimento = job.name,
        nome = dip.nome,
        sigla = dip.sigla,
        servizio = inServizio,
    } or nil, true)
end

AddEventHandler('esx:playerLoaded', function(source, xPlayer)
    sincronizza(source, xPlayer.job)
end)

AddEventHandler('esx:setJob', function(source, job)
    sincronizza(source, job)
end)

AddEventHandler('playerDropped', function()
    togliGruppo(source)
end)

-- cambio personaggio (multicharacter): il gruppo si riassegna al prossimo esx:playerLoaded
AddEventHandler('esx:playerLogout', function(source)
    togliGruppo(source)
    Player(source).state:set('ced_fdo', nil, true)
end)

AddEventHandler('onResourceStart', function(resource)
    if resource ~= GetCurrentResourceName() then return end

    for _, xPlayer in pairs(ESX.GetExtendedPlayers()) do
        sincronizza(xPlayer.source, xPlayer.job)
    end
end)

AddEventHandler('onResourceStop', function(resource)
    if resource ~= GetCurrentResourceName() then return end

    for source in pairs(assegnati) do
        togliGruppo(source)
    end
end)

local function cambiaServizio(source)
    local xPlayer = ESX.GetPlayerFromId(source)
    if not xPlayer then return end

    local job = xPlayer.job
    local dip = Dipartimenti[job.name]

    if not dip then
        return xPlayer.showNotification(Config.Testi.non_fdo, 'error')
    end

    if Config.ServizioSoloAlPunto then
        local coords = GetEntityCoords(GetPlayerPed(source))
        if #(coords - dip.puntoServizio) > 3.0 then
            return xPlayer.showNotification(Config.Testi.troppo_lontano, 'warning')
        end
    end

    local nuovoStato = not job.onDuty
    xPlayer.setJob(job.name, job.grade, nuovoStato)

    local testo = nuovoStato
        and Config.Testi.in_servizio:format(job.grade_label)
        or Config.Testi.fuori_servizio

    xPlayer.showNotification(testo, dip.notifica, 5000)
end

RegisterCommand(Config.ComandoServizio, function(source)
    if source > 0 then
        cambiaServizio(source)
    end
end, false)

RegisterNetEvent('ced_forzeordine:cambiaServizio', function()
    local source = source
    local xPlayer = ESX.GetPlayerFromId(source)
    if not xPlayer or not Dipartimenti[xPlayer.job.name] then return end

    -- il punto con il marker richiede sempre di essere vicini
    local coords = GetEntityCoords(GetPlayerPed(source))
    if #(coords - Dipartimenti[xPlayer.job.name].puntoServizio) > 3.0 then return end

    cambiaServizio(source)
end)

RegisterCommand(Config.ComandoColleghi, function(source)
    if source <= 0 then return end

    local xPlayer = ESX.GetPlayerFromId(source)
    if not xPlayer then return end

    local conta = { polizia = 0, carabinieri = 0 }
    for _, other in pairs(ESX.GetExtendedPlayers()) do
        local nome = other.job.name
        if conta[nome] and other.job.onDuty then
            conta[nome] = conta[nome] + 1
        end
    end

    local dip = Dipartimenti[xPlayer.job.name]
    xPlayer.showNotification(
        Config.Testi.colleghi:format(conta.polizia, conta.carabinieri),
        dip and dip.notifica or 'info',
        6000
    )
end, false)

-- Export utili per altri script (es. FivePD, MDT, dispatch)
exports('IsInServizio', function(source)
    local xPlayer = ESX.GetPlayerFromId(source)
    return xPlayer ~= nil and Dipartimenti[xPlayer.job.name] ~= nil and xPlayer.job.onDuty == true
end)

exports('GetDipartimento', function(source)
    local xPlayer = ESX.GetPlayerFromId(source)
    if xPlayer and Dipartimenti[xPlayer.job.name] then
        return xPlayer.job.name, Dipartimenti[xPlayer.job.name]
    end
    return nil
end)
