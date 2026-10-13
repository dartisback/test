local function trimPlate(plate)
    return (tostring(plate or ''):gsub('^%s+', ''):gsub('%s+$', ''))
end

local function getGarage(id)
    for _, g in ipairs(Config.Garages) do
        if g.id == id then return g end
    end
end

CreateThread(function()
    if Config.ParkAllOnStart then
        MySQL.update.await('UPDATE owned_vehicles SET `stored` = 1 WHERE `stored` = 0')
    end
end)

-- Lista veicoli parcheggiati dal giocatore
lib.callback.register('rp_garage:getVehicles', function(source, garageId)
    local xPlayer = ESX.GetPlayerFromId(source)
    local garage = getGarage(garageId)
    if not xPlayer or not garage then return {} end

    local rows = MySQL.query.await(
        'SELECT plate, vehicle FROM owned_vehicles WHERE owner = ? AND `stored` = 1 AND type = ?',
        { xPlayer.identifier, garage.type }
    )
    local list = {}
    for _, row in ipairs(rows) do
        local props = json.decode(row.vehicle or '{}') or {}
        list[#list + 1] = { plate = row.plate, model = props.model }
    end
    return list
end)

-- Ritira: segna il veicolo come fuori e restituisce le proprietà salvate
lib.callback.register('rp_garage:takeOut', function(source, garageId, plate)
    local xPlayer = ESX.GetPlayerFromId(source)
    if not xPlayer or not getGarage(garageId) then return false end

    local affected = MySQL.update.await(
        'UPDATE owned_vehicles SET `stored` = 0 WHERE owner = ? AND plate = ? AND `stored` = 1',
        { xPlayer.identifier, plate }
    )
    if affected ~= 1 then return false end

    local raw = MySQL.scalar.await('SELECT vehicle FROM owned_vehicles WHERE plate = ?', { plate })
    return json.decode(raw or '{}')
end)

-- Deposita: salva proprietà e rimuove il veicolo
lib.callback.register('rp_garage:store', function(source, garageId, netId, props)
    local xPlayer = ESX.GetPlayerFromId(source)
    if not xPlayer or not getGarage(garageId) or type(props) ~= 'table' then return false, 'Richiesta non valida.' end

    local vehicle = NetworkGetEntityFromNetworkId(netId)
    if not vehicle or vehicle == 0 or not DoesEntityExist(vehicle) then return false, 'Veicolo non trovato.' end

    local plate = trimPlate(GetVehicleNumberPlateText(vehicle))
    local owned = MySQL.scalar.await(
        'SELECT plate FROM owned_vehicles WHERE owner = ? AND TRIM(plate) = ?', { xPlayer.identifier, plate }
    )
    if not owned then return false, 'Questo veicolo non è di tua proprietà.' end

    props.plate = owned
    MySQL.update.await('UPDATE owned_vehicles SET vehicle = ?, `stored` = 1 WHERE owner = ? AND plate = ?',
        { json.encode(props), xPlayer.identifier, owned })
    DeleteEntity(vehicle)
    return true, 'Veicolo depositato.'
end)

-- Garage di servizio: verifica job + grado e restituisce la targa assegnata
lib.callback.register('rp_garage:requestJobVehicle', function(source, jobName, model)
    local xPlayer = ESX.GetPlayerFromId(source)
    local garage = Config.JobGarages[jobName]
    if not xPlayer or not garage or xPlayer.job.name ~= jobName then return false end

    for _, v in ipairs(garage.vehicles) do
        if v.model == model and xPlayer.job.grade >= v.minGrade then
            return ('%s%04d'):format(garage.platePrefix, math.random(0, 9999))
        end
    end
    return false
end)

lib.callback.register('rp_garage:getPlayerJob', function(source)
    local xPlayer = ESX.GetPlayerFromId(source)
    return xPlayer and xPlayer.job or nil
end)

-- Staff: /givecar [id] [modello] -> aggiunge un veicolo di proprietà al giocatore
ESX.RegisterCommand('givecar', 'admin', function(xPlayer, args)
    local target = args.player
    local model = args.model:lower()
    local plate
    repeat
        plate = ('RP%s%03d'):format(string.char(math.random(65, 90), math.random(65, 90)), math.random(0, 999))
    until not MySQL.scalar.await('SELECT 1 FROM owned_vehicles WHERE plate = ?', { plate })

    MySQL.insert.await(
        'INSERT INTO owned_vehicles (owner, plate, vehicle, type, `stored`) VALUES (?, ?, ?, ?, 1)',
        { target.identifier, plate, json.encode({ model = joaat(model), plate = plate }), 'car' }
    )
    local msg = ('Veicolo %s (targa %s) consegnato a %s.'):format(model, plate, GetPlayerName(target.source))
    if xPlayer then xPlayer.showNotification(msg) else print(msg) end
end, true, {
    help = 'Dai un veicolo a un giocatore',
    validate = true,
    arguments = {
        { name = 'player', help = 'ID giocatore', type = 'player' },
        { name = 'model', help = 'Modello veicolo', type = 'string' },
    },
})
