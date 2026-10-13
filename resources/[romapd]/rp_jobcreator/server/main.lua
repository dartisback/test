local function isAllowed(source)
    local xPlayer = ESX.GetPlayerFromId(source)
    return xPlayer and Config.AllowedGroups[xPlayer.getGroup()] or false
end

local function validName(name)
    return type(name) == 'string' and #name >= 2 and #name <= 30 and name:match('^[a-z0-9_]+$') ~= nil
end

local function validLabel(label)
    return type(label) == 'string' and #label >= 1 and #label <= 50
end

-- Ricarica ESX.Jobs dal database (usa ESX.RefreshJobs se presente, altrimenti fallback manuale)
local function refreshJobs()
    if ESX.RefreshJobs then
        ESX.RefreshJobs()
        return
    end

    local jobs = {}
    for _, row in ipairs(MySQL.query.await('SELECT * FROM jobs')) do
        jobs[row.name] = { name = row.name, label = row.label, whitelisted = row.whitelisted == 1, grades = {} }
    end
    for _, row in ipairs(MySQL.query.await('SELECT * FROM job_grades')) do
        if jobs[row.job_name] then
            jobs[row.job_name].grades[tostring(row.grade)] = {
                job_name = row.job_name, grade = row.grade, name = row.name, label = row.label,
                salary = row.salary, skin_male = json.decode(row.skin_male or '{}'), skin_female = json.decode(row.skin_female or '{}'),
            }
        end
    end
    ESX.Jobs = jobs
end

local function log(source, text)
    print(('^3[rp_jobcreator]^7 %s (%s): %s'):format(GetPlayerName(source), source, text))
end

lib.callback.register('rp_jobcreator:canUse', function(source)
    return isAllowed(source)
end)

lib.callback.register('rp_jobcreator:getJobs', function(source)
    if not isAllowed(source) then return {} end
    local jobs = MySQL.query.await('SELECT name, label, whitelisted FROM jobs ORDER BY label')
    local grades = MySQL.query.await('SELECT job_name, grade, name, label, salary FROM job_grades ORDER BY job_name, grade')
    local byJob = {}
    for _, g in ipairs(grades) do
        byJob[g.job_name] = byJob[g.job_name] or {}
        table.insert(byJob[g.job_name], g)
    end
    for _, j in ipairs(jobs) do j.grades = byJob[j.name] or {} end
    return jobs
end)

lib.callback.register('rp_jobcreator:createJob', function(source, name, label, whitelisted)
    if not isAllowed(source) then return false, 'Permessi insufficienti.' end
    if not validName(name) then return false, 'Nome non valido (solo a-z, 0-9, _ ; 2-30 caratteri).' end
    if not validLabel(label) then return false, 'Etichetta non valida.' end

    if MySQL.scalar.await('SELECT 1 FROM jobs WHERE name = ?', { name }) then
        return false, 'Esiste già un lavoro con questo nome.'
    end

    MySQL.insert.await('INSERT INTO jobs (name, label, whitelisted) VALUES (?, ?, ?)', { name, label, whitelisted and 1 or 0 })
    MySQL.insert.await(
        'INSERT INTO job_grades (job_name, grade, name, label, salary, skin_male, skin_female) VALUES (?, 0, ?, ?, ?, ?, ?), (?, 1, ?, ?, ?, ?, ?)',
        { name, 'dipendente', 'Dipendente', 500, '{}', '{}', name, 'boss', 'Capo', 1000, '{}', '{}' }
    )
    refreshJobs()
    log(source, ('ha creato il lavoro %s'):format(name))
    return true, ('Lavoro "%s" creato con i gradi Dipendente e Capo.'):format(label)
end)

lib.callback.register('rp_jobcreator:deleteJob', function(source, name)
    if not isAllowed(source) then return false, 'Permessi insufficienti.' end
    if not validName(name) or Config.ProtectedJobs[name] then return false, 'Questo lavoro è protetto.' end

    MySQL.update.await('UPDATE users SET job = ?, job_grade = 0 WHERE job = ?', { 'unemployed', name })
    MySQL.update.await('DELETE FROM job_grades WHERE job_name = ?', { name })
    MySQL.update.await('DELETE FROM jobs WHERE name = ?', { name })
    refreshJobs()

    for _, playerId in ipairs(ESX.GetPlayers()) do
        local xPlayer = ESX.GetPlayerFromId(playerId)
        if xPlayer and xPlayer.job.name == name then xPlayer.setJob('unemployed', 0) end
    end
    log(source, ('ha eliminato il lavoro %s'):format(name))
    return true, 'Lavoro eliminato; i dipendenti sono ora disoccupati.'
end)

lib.callback.register('rp_jobcreator:setWhitelist', function(source, name, whitelisted)
    if not isAllowed(source) or not validName(name) then return false, 'Richiesta non valida.' end
    MySQL.update.await('UPDATE jobs SET whitelisted = ? WHERE name = ?', { whitelisted and 1 or 0, name })
    refreshJobs()
    return true, 'Whitelist aggiornata.'
end)

lib.callback.register('rp_jobcreator:saveGrade', function(source, jobName, grade, name, label, salary)
    if not isAllowed(source) then return false, 'Permessi insufficienti.' end
    grade, salary = tonumber(grade), tonumber(salary)
    if not validName(jobName) or not grade or grade < 0 or grade > 99 or not salary or salary < 0 then
        return false, 'Dati del grado non validi.'
    end
    if not validName(name) or not validLabel(label) then return false, 'Nome o etichetta del grado non validi.' end
    if not MySQL.scalar.await('SELECT 1 FROM jobs WHERE name = ?', { jobName }) then return false, 'Lavoro inesistente.' end

    grade = math.floor(grade)
    if MySQL.scalar.await('SELECT 1 FROM job_grades WHERE job_name = ? AND grade = ?', { jobName, grade }) then
        MySQL.update.await('UPDATE job_grades SET name = ?, label = ?, salary = ? WHERE job_name = ? AND grade = ?', { name, label, salary, jobName, grade })
    else
        MySQL.insert.await(
            'INSERT INTO job_grades (job_name, grade, name, label, salary, skin_male, skin_female) VALUES (?, ?, ?, ?, ?, ?, ?)',
            { jobName, grade, name, label, salary, '{}', '{}' }
        )
    end
    refreshJobs()
    log(source, ('ha salvato il grado %s di %s'):format(grade, jobName))
    return true, 'Grado salvato.'
end)

lib.callback.register('rp_jobcreator:deleteGrade', function(source, jobName, grade)
    if not isAllowed(source) or not validName(jobName) then return false, 'Richiesta non valida.' end
    grade = tonumber(grade)
    if not grade then return false, 'Grado non valido.' end
    if MySQL.scalar.await('SELECT COUNT(*) FROM job_grades WHERE job_name = ?', { jobName }) <= 1 then
        return false, 'Un lavoro deve avere almeno un grado.'
    end
    if MySQL.scalar.await('SELECT 1 FROM users WHERE job = ? AND job_grade = ? LIMIT 1', { jobName, grade }) then
        return false, 'Ci sono giocatori con questo grado: spostali prima.'
    end
    MySQL.update.await('DELETE FROM job_grades WHERE job_name = ? AND grade = ?', { jobName, grade })
    refreshJobs()
    return true, 'Grado eliminato.'
end)

lib.callback.register('rp_jobcreator:assignJob', function(source, targetId, jobName, grade)
    if not isAllowed(source) then return false, 'Permessi insufficienti.' end
    local xTarget = ESX.GetPlayerFromId(tonumber(targetId))
    if not xTarget then return false, 'Giocatore non trovato.' end
    grade = tonumber(grade)
    if not grade or not ESX.DoesJobExist(jobName, grade) then return false, 'Lavoro o grado inesistente.' end
    xTarget.setJob(jobName, grade)
    log(source, ('ha assegnato %s:%s a %s'):format(jobName, grade, targetId))
    return true, ('%s ora è %s.'):format(GetPlayerName(xTarget.source), jobName)
end)
