local cooldowns = {}

local function trim(s)
    return (tostring(s or ''):gsub('^%s+', ''):gsub('%s+$', ''))
end

local function getDocuments(source)
    local xPlayer = ESX.GetPlayerFromId(source)
    if not xPlayer then return nil end

    local licenses = {}
    local ok, rows = pcall(MySQL.query.await, 'SELECT `type` FROM `user_licenses` WHERE `owner` = ?', { xPlayer.identifier })
    if ok and rows then
        for _, row in ipairs(rows) do
            licenses[#licenses + 1] = Config.LicenseLabels[row.type] or row.type
        end
    end

    local sex = xPlayer.get('sex')
    return {
        firstName = xPlayer.get('firstName') or 'N/D',
        lastName  = xPlayer.get('lastName') or 'N/D',
        dob       = xPlayer.get('dateofbirth') or 'N/D',
        sex       = (sex == 'm' or sex == 'M') and 'M' or 'F',
        height    = xPlayer.get('height') or 'N/D',
        job       = xPlayer.job and xPlayer.job.label or 'Disoccupato',
        licenses  = licenses,
    }
end

lib.callback.register('rp_f5menu:getDocuments', function(source)
    return getDocuments(source)
end)

lib.callback.register('rp_f5menu:isAdmin', function(source)
    local xPlayer = ESX.GetPlayerFromId(source)
    if not xPlayer then return false end
    local group = xPlayer.getGroup()
    return group == 'admin' or group == 'superadmin'
end)

lib.callback.register('rp_f5menu:getJobs', function(source)
    local list = {}
    for _, entry in ipairs(Config.SelectableJobs) do
        local job = ESX.Jobs[entry.job]
        local grade = job and job.grades[tostring(entry.grade)]
        if job and grade then
            list[#list + 1] = {
                job = entry.job,
                grade = entry.grade,
                icon = entry.icon,
                label = job.label,
                gradeLabel = grade.label,
                salary = grade.salary,
            }
        end
    end
    return list
end)

lib.callback.register('rp_f5menu:setJob', function(source, jobName)
    local xPlayer = ESX.GetPlayerFromId(source)
    if not xPlayer or type(jobName) ~= 'string' then return false, 'Richiesta non valida.' end

    local now = os.time()
    if cooldowns[source] and now - cooldowns[source] < Config.JobChangeCooldown then
        return false, ('Attendi %d secondi prima di cambiare di nuovo lavoro.'):format(Config.JobChangeCooldown - (now - cooldowns[source]))
    end

    for _, entry in ipairs(Config.SelectableJobs) do
        if entry.job == jobName then
            if not ESX.DoesJobExist(entry.job, entry.grade) then
                return false, 'Questo lavoro non esiste nel database.'
            end
            xPlayer.setJob(entry.job, entry.grade)
            cooldowns[source] = now
            return true, ('Ora lavori come %s.'):format(ESX.Jobs[entry.job].label)
        end
    end
    return false, 'Questo lavoro non è selezionabile (serve essere assunti).'
end)

-- Mostra il proprio documento a un giocatore vicino (il contenuto è generato lato server)
RegisterNetEvent('rp_f5menu:showDocument', function(targetId, docType)
    local src = source
    targetId = tonumber(targetId)
    if not targetId or src == targetId then return end
    if docType ~= 'id' and docType ~= 'licenses' then return end

    local srcPed, tgtPed = GetPlayerPed(src), GetPlayerPed(targetId)
    if srcPed == 0 or tgtPed == 0 then return end
    if #(GetEntityCoords(srcPed) - GetEntityCoords(tgtPed)) > Config.ShowDistance + 2.0 then return end

    local doc = getDocuments(src)
    if doc then
        TriggerClientEvent('rp_f5menu:receiveDocument', targetId, docType, doc, trim(doc.firstName .. ' ' .. doc.lastName))
    end
end)

AddEventHandler('playerDropped', function()
    cooldowns[source] = nil
end)
