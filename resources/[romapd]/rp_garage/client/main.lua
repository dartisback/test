local function requestModelSafe(model)
    local hash = type(model) == 'number' and model or joaat(model)
    if not IsModelInCdimage(hash) or not IsModelAVehicle(hash) then return nil end
    local ok = pcall(lib.requestModel, hash, 10000)
    return ok and hash or nil
end

local function spawnAreaFree(spawn)
    if lib.getClosestVehicle(spawn.xyz, 2.5, true) then
        lib.notify({ type = 'error', description = 'Il punto di uscita è occupato.' })
        return false
    end
    return true
end

local function spawnVehicle(hash, spawn, props)
    if not hash then return nil end
    local veh = CreateVehicle(hash, spawn.x, spawn.y, spawn.z, spawn.w, true, false)
    SetModelAsNoLongerNeeded(hash)
    if props then lib.setVehicleProperties(veh, props) end
    SetVehicleOnGroundProperly(veh)
    TaskWarpPedIntoVehicle(cache.ped, veh, -1)
    return veh
end

----------------------------------------------------------------
-- Garage personali
----------------------------------------------------------------
local function openGarage(garage)
    local options = {}

    if cache.vehicle and cache.seat == -1 then
        options[#options + 1] = {
            title = 'Deposita veicolo', icon = 'square-parking',
            onSelect = function()
                local veh = cache.vehicle
                local props = lib.getVehicleProperties(veh)
                local ok, msg = lib.callback.await('rp_garage:store', false, garage.id, NetworkGetNetworkIdFromEntity(veh), props)
                lib.notify({ type = ok and 'success' or 'error', description = msg })
            end,
        }
    else
        local vehicles = lib.callback.await('rp_garage:getVehicles', false, garage.id)
        if #vehicles == 0 then
            options[#options + 1] = { title = 'Nessun veicolo parcheggiato', icon = 'ban', disabled = true }
        end
        for _, v in ipairs(vehicles) do
            local name = v.model and GetLabelText(GetDisplayNameFromVehicleModel(v.model)) or 'Veicolo'
            options[#options + 1] = {
                title = name ~= 'NULL' and name or 'Veicolo', description = 'Targa: ' .. v.plate, icon = 'car',
                onSelect = function()
                    -- controlli PRIMA di segnare il veicolo come "fuori"
                    if not spawnAreaFree(garage.spawn) then return end
                    if not v.model or not IsModelInCdimage(v.model) then
                        return lib.notify({ type = 'error', description = 'Modello del veicolo non valido.' })
                    end
                    local props = lib.callback.await('rp_garage:takeOut', false, garage.id, v.plate)
                    if not props then
                        return lib.notify({ type = 'error', description = 'Impossibile ritirare il veicolo.' })
                    end
                    spawnVehicle(requestModelSafe(props.model), garage.spawn, props)
                end,
            }
        end
    end

    lib.registerContext({ id = 'rp_garage_menu', title = garage.label, options = options })
    lib.showContext('rp_garage_menu')
end

----------------------------------------------------------------
-- Garage di servizio
----------------------------------------------------------------
local function openJobGarage(jobName, garage)
    local job = ESX.GetPlayerData().job
    local options = {}

    if cache.vehicle and cache.seat == -1 then
        options[#options + 1] = {
            title = 'Riconsegna veicolo di servizio', icon = 'square-parking',
            onSelect = function()
                local model = GetEntityModel(cache.vehicle)
                for _, v in ipairs(garage.vehicles) do
                    if joaat(v.model) == model then
                        DeleteEntity(cache.vehicle)
                        return lib.notify({ type = 'success', description = 'Veicolo riconsegnato.' })
                    end
                end
                lib.notify({ type = 'error', description = 'Non è un veicolo di servizio.' })
            end,
        }
    else
        for _, v in ipairs(garage.vehicles) do
            local locked = job.grade < v.minGrade
            options[#options + 1] = {
                title = v.label, icon = 'car-side', disabled = locked,
                description = locked and ('Richiede grado %d'):format(v.minGrade) or v.model,
                onSelect = function()
                    local plate = lib.callback.await('rp_garage:requestJobVehicle', false, jobName, v.model)
                    if not plate then
                        return lib.notify({ type = 'error', description = 'Non puoi prelevare questo veicolo.' })
                    end
                    if not spawnAreaFree(garage.spawn) then return end
                    local veh = spawnVehicle(requestModelSafe(v.model), garage.spawn)
                    if veh then SetVehicleNumberPlateText(veh, plate) end
                end,
            }
        end
    end

    lib.registerContext({ id = 'rp_garage_job', title = garage.label, options = options })
    lib.showContext('rp_garage_job')
end

----------------------------------------------------------------
-- Punti, blip e interazione (E)
----------------------------------------------------------------
local function makeBlip(coords, blip, label)
    local b = AddBlipForCoord(coords.x, coords.y, coords.z)
    SetBlipSprite(b, blip.sprite)
    SetBlipColour(b, blip.color)
    SetBlipScale(b, blip.scale or 0.8)
    SetBlipAsShortRange(b, true)
    BeginTextCommandSetBlipName('STRING')
    AddTextComponentSubstringPlayerName(label)
    EndTextCommandSetBlipName(b)
end

local function registerPoint(coords, radius, label, onUse, canUse)
    local point = lib.points.new({ coords = coords, distance = radius + 6.0 })

    function point:nearby()
        if canUse and not canUse() then
            if self.shown then lib.hideTextUI(); self.shown = false end
            return
        end
        DrawMarker(36, coords.x, coords.y, coords.z + 0.3, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.8, 0.8, 0.8, 50, 120, 255, 150, false, true, 2, false, nil, nil, false)
        if self.currentDistance <= radius then
            if not self.shown then lib.showTextUI(('[E] %s'):format(label)); self.shown = true end
            if IsControlJustReleased(0, 38) and not lib.getOpenContextMenu() then onUse() end
        elseif self.shown then
            lib.hideTextUI(); self.shown = false
        end
    end

    function point:onExit()
        if self.shown then lib.hideTextUI(); self.shown = false end
    end
end

CreateThread(function()
    for _, garage in ipairs(Config.Garages) do
        makeBlip(garage.coords, garage.blip, garage.label)
        registerPoint(garage.coords, garage.radius, garage.label, function() openGarage(garage) end)
    end

    for jobName, garage in pairs(Config.JobGarages) do
        makeBlip(garage.coords, garage.blip, garage.label)
        registerPoint(garage.coords, garage.radius, garage.label, function() openJobGarage(jobName, garage) end, function()
            local job = ESX.GetPlayerData().job
            return job and job.name == jobName
        end)
    end
end)
