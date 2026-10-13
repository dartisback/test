local function notify(ok, msg)
    lib.notify({ type = ok and 'success' or 'error', description = msg })
end

local openMain

local function openGrade(job, grade)
    local fields = {
        { type = 'number', label = 'Numero grado', default = grade and grade.grade or #job.grades, min = 0, max = 99, required = true, disabled = grade ~= nil },
        { type = 'input', label = 'Nome interno (a-z, 0-9, _)', default = grade and grade.name or nil, required = true, min = 2, max = 30 },
        { type = 'input', label = 'Etichetta', default = grade and grade.label or nil, required = true, max = 50 },
        { type = 'number', label = 'Stipendio', default = grade and grade.salary or 500, min = 0, required = true },
    }
    local input = lib.inputDialog(grade and 'Modifica grado' or 'Nuovo grado', fields)
    if not input then return end
    local gradeNum = grade and grade.grade or input[1]
    notify(lib.callback.await('rp_jobcreator:saveGrade', false, job.name, gradeNum, input[2], input[3], input[4]))
end

local function openJob(job)
    local options = {
        {
            title = 'Aggiungi grado', icon = 'plus',
            onSelect = function() openGrade(job); openMain() end,
        },
        {
            title = job.whitelisted == 1 and 'Disattiva whitelist' or 'Attiva whitelist',
            description = 'Stato attuale: ' .. (job.whitelisted == 1 and 'whitelist' or 'libero'), icon = 'lock',
            onSelect = function()
                notify(lib.callback.await('rp_jobcreator:setWhitelist', false, job.name, job.whitelisted ~= 1))
                openMain()
            end,
        },
    }

    for _, g in ipairs(job.grades) do
        options[#options + 1] = {
            title = ('%d - %s'):format(g.grade, g.label),
            description = ('Stipendio $%s | click: modifica'):format(g.salary),
            icon = 'layer-group',
            onSelect = function()
                local choice = lib.inputDialog(g.label, {
                    { type = 'select', label = 'Azione', required = true, options = {
                        { value = 'edit', label = 'Modifica' }, { value = 'delete', label = 'Elimina' },
                    } },
                })
                if not choice then return end
                if choice[1] == 'edit' then
                    openGrade(job, g)
                else
                    notify(lib.callback.await('rp_jobcreator:deleteGrade', false, job.name, g.grade))
                end
                openMain()
            end,
        }
    end

    options[#options + 1] = {
        title = 'Elimina lavoro', icon = 'trash', iconColor = 'red',
        onSelect = function()
            if lib.alertDialog({ header = 'Elimina ' .. job.label, content = 'I dipendenti diventeranno disoccupati. Confermi?', centered = true, cancel = true }) == 'confirm' then
                notify(lib.callback.await('rp_jobcreator:deleteJob', false, job.name))
            end
            openMain()
        end,
    }

    lib.registerContext({ id = 'rp_jc_job', title = job.label .. ' (' .. job.name .. ')', menu = 'rp_jc_main', options = options })
    lib.showContext('rp_jc_job')
end

openMain = function()
    local jobs = lib.callback.await('rp_jobcreator:getJobs', false)
    local options = {
        {
            title = 'Crea nuovo lavoro', icon = 'plus',
            onSelect = function()
                local input = lib.inputDialog('Nuovo lavoro', {
                    { type = 'input', label = 'Nome interno (a-z, 0-9, _)', required = true, min = 2, max = 30 },
                    { type = 'input', label = 'Etichetta', required = true, max = 50 },
                    { type = 'checkbox', label = 'Whitelist (assunzione solo da staff/boss)' },
                })
                if input then notify(lib.callback.await('rp_jobcreator:createJob', false, input[1], input[2], input[3] == true)) end
                openMain()
            end,
        },
        {
            title = 'Assegna lavoro a giocatore', icon = 'user-tag',
            onSelect = function()
                local input = lib.inputDialog('Assegna lavoro', {
                    { type = 'number', label = 'ID giocatore', required = true, min = 1 },
                    { type = 'input', label = 'Nome lavoro (es. police)', required = true },
                    { type = 'number', label = 'Grado', default = 0, min = 0, required = true },
                })
                if input then notify(lib.callback.await('rp_jobcreator:assignJob', false, input[1], input[2], input[3])) end
                openMain()
            end,
        },
    }

    for _, job in ipairs(jobs) do
        options[#options + 1] = {
            title = job.label, description = ('%s | %d gradi%s'):format(job.name, #job.grades, job.whitelisted == 1 and ' | whitelist' or ''),
            icon = 'briefcase', onSelect = function() openJob(job) end,
        }
    end

    lib.registerContext({ id = 'rp_jc_main', title = 'Job Creator', options = options })
    lib.showContext('rp_jc_main')
end

RegisterCommand(Config.Command, function()
    if not lib.callback.await('rp_jobcreator:canUse', false) then
        return notify(false, 'Non hai i permessi per usare il Job Creator.')
    end
    openMain()
end, false)
