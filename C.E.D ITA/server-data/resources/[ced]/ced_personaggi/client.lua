-- C.E.D ITA - selezione personaggi e registrazione anagrafica (lato client)

local inSelezione = false
local camera = nil
local personaggi = {}

local ANIM_DICT = 'anim@heists@heist_corona@single_team'
local ANIM_NAME = 'single_team_loop_boss'

local function trovaPersonaggio(id)
    for _, p in ipairs(personaggi) do
        if p.id == id then return p end
    end
end

local function nascondiHud(nascondi)
    DisplayRadar(not nascondi)
    if nascondi then
        CreateThread(function()
            while inSelezione do
                HideHudAndRadarThisFrame()
                Wait(0)
            end
        end)
    end
end

-- ---------------------------------------------------------------------
--  scena: personaggio in posa davanti alla telecamera
-- ---------------------------------------------------------------------
local function posizionaPed()
    local ped = PlayerPedId()
    local s = Config.Scena

    RequestCollisionAtCoord(s.x, s.y, s.z)
    SetEntityCoordsNoOffset(ped, s.x, s.y, s.z, false, false, false)
    SetEntityHeading(ped, s.w)
    FreezeEntityPosition(ped, true)
    SetEntityInvincible(ped, true)
    ClearPedTasksImmediately(ped)

    local limite = GetGameTimer() + 5000
    while not HasCollisionLoadedAroundEntity(ped) and GetGameTimer() < limite do Wait(0) end

    if lib.requestAnimDict(ANIM_DICT, 3000) then
        TaskPlayAnim(ped, ANIM_DICT, ANIM_NAME, 8.0, -8.0, -1, 1, 0, false, false, false)
    end
end

local function puntaCamera()
    local ped = PlayerPedId()
    local posizione = GetOffsetFromEntityInWorldCoords(ped, 0.0, 3.1, 0.35)
    local bersaglio = GetOffsetFromEntityInWorldCoords(ped, 0.0, 0.0, 0.05)

    if not camera then
        camera = CreateCamWithParams('DEFAULT_SCRIPTED_CAMERA', posizione.x, posizione.y, posizione.z, 0.0, 0.0, 0.0, 38.0, false, 0)
        SetCamActive(camera, true)
        RenderScriptCams(true, false, 0, true, true)
    else
        SetCamCoord(camera, posizione.x, posizione.y, posizione.z)
    end
    PointCamAtCoord(camera, bersaglio.x, bersaglio.y, bersaglio.z)
end

local function distruggiCamera()
    if camera then
        RenderScriptCams(false, false, 0, true, true)
        DestroyCam(camera, false)
        camera = nil
    end
end

-- mostra il personaggio scelto (o un cittadino "base" del sesso indicato)
local function anteprima(p, sesso)
    if p and p.skin and p.skin.model then
        exports['illenium-appearance']:setPlayerAppearance(p.skin)
    else
        local femmina = (p and p.sesso == 'f') or sesso == 'f'
        exports['illenium-appearance']:setPlayerModel(femmina and 'mp_f_freemode_01' or 'mp_m_freemode_01')
        SetPedDefaultComponentVariation(PlayerPedId())
    end

    posizionaPed()
    SetEntityVisible(PlayerPedId(), p ~= nil or sesso ~= nil, false)
    puntaCamera()
end

-- ---------------------------------------------------------------------
--  apertura selezione
-- ---------------------------------------------------------------------
local function apriSelezione()
    if inSelezione then return end
    inSelezione = true

    DoScreenFadeOut(0)
    if GetResourceState('spawnmanager') == 'started' then
        exports.spawnmanager:setAutoSpawn(false)
    end
    ShutdownLoadingScreen()
    ShutdownLoadingScreenNui()
    TriggerEvent('esx:loadingScreenOff')

    nascondiHud(true)
    SetPlayerControl(PlayerId(), false, 0)
    posizionaPed()

    local dati
    for _ = 1, 10 do
        dati = lib.callback.await('ced_personaggi:carica', false)
        if dati then break end
        Wait(2000)
    end

    if not dati then
        inSelezione = false
        return print('^1[ced_personaggi] impossibile caricare i personaggi^7')
    end

    personaggi = dati.personaggi
    anteprima(personaggi[1])

    SendNUIMessage({ azione = 'apri', dati = dati })
    SetNuiFocus(true, true)
    DoScreenFadeIn(800)
end

CreateThread(function()
    while not NetworkIsPlayerActive(PlayerId()) do Wait(100) end
    if not ESX.IsPlayerLoaded() then
        apriSelezione()
    end
end)

-- /cambiapersonaggio: ESX salva e scarica il personaggio, poi si torna qui
RegisterNetEvent('esx:onPlayerLogout', function()
    DoScreenFadeOut(500)
    Wait(600)
    apriSelezione()
end)

-- ---------------------------------------------------------------------
--  callback dall'interfaccia
-- ---------------------------------------------------------------------
RegisterNUICallback('anteprima', function(dati, cb)
    anteprima(trovaPersonaggio(tonumber(dati.id)), dati.sesso)
    cb('ok')
end)

RegisterNUICallback('gioca', function(dati, cb)
    cb(lib.callback.await('ced_personaggi:gioca', false, tonumber(dati.id)) == true)
end)

RegisterNUICallback('crea', function(dati, cb)
    cb(lib.callback.await('ced_personaggi:crea', false, tonumber(dati.id), dati.identita) or { ok = false })
end)

RegisterNUICallback('elimina', function(dati, cb)
    local lista = lib.callback.await('ced_personaggi:elimina', false, tonumber(dati.id))
    if lista then
        personaggi = lista
        anteprima(personaggi[1])
    end
    cb(lista or false)
end)

-- ---------------------------------------------------------------------
--  personaggio caricato da ESX: creazione aspetto (se nuovo) e ingresso in citta'
-- ---------------------------------------------------------------------
local function spawnaPersonaggio(skin, coords)
    ESX.SpawnPlayer(skin, coords, function()
        local ped = PlayerPedId()
        ClearPedTasksImmediately(ped)
        SetEntityCollision(ped, true, true)
        FreezeEntityPosition(ped, false)
        SetEntityInvincible(ped, false)
        SetEntityVisible(ped, true, false)
        SetPlayerControl(PlayerId(), true, 0)
        nascondiHud(false)

        DoScreenFadeIn(800)

        TriggerServerEvent('esx:onPlayerSpawn')
        TriggerEvent('esx:onPlayerSpawn')
        TriggerEvent('esx:restoreLoadout')
    end)
end

RegisterNetEvent('esx:playerLoaded', function(playerData, isNew, skin)
    if not inSelezione then return end

    SendNUIMessage({ azione = 'chiudi' })
    SetNuiFocus(false, false)
    DoScreenFadeOut(600)
    Wait(700)

    local s = Config.SpawnNuovi
    local coords = { x = s.x, y = s.y, z = s.z, heading = s.w }
    if not isNew and playerData.coords then coords = playerData.coords end

    if type(skin) ~= 'table' or not skin.model then
        -- nuovo cittadino: prima l'aspetto, con illenium-appearance
        local limite = GetGameTimer() + 10000
        while not ESX.GetPlayerData().sex and GetGameTimer() < limite do Wait(50) end

        distruggiCamera()
        posizionaPed()
        SetEntityVisible(PlayerPedId(), true, false)
        DoScreenFadeIn(600)

        local fatto = promise.new()
        TriggerEvent('esx_skin:openSaveableMenu', function() fatto:resolve(true) end, function() fatto:resolve(false) end)
        Citizen.Await(fatto)

        skin = exports['illenium-appearance']:getPedAppearance(PlayerPedId())
        DoScreenFadeOut(600)
        Wait(700)
    end

    inSelezione = false
    distruggiCamera()
    spawnaPersonaggio(skin, coords)
end)

AddEventHandler('onResourceStop', function(risorsa)
    if risorsa == GetCurrentResourceName() and inSelezione then
        distruggiCamera()
        SetNuiFocus(false, false)
    end
end)
