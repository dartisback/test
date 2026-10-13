local function buildDocText(docType, doc)
    if docType == 'id' then
        return ('**Nome:** %s  \n**Cognome:** %s  \n**Data di nascita:** %s  \n**Sesso:** %s  \n**Altezza:** %s cm  \n**Professione:** %s')
            :format(doc.firstName, doc.lastName, doc.dob, doc.sex, doc.height, doc.job)
    end

    local header = ('**Intestatario:** %s %s  \n\n'):format(doc.firstName, doc.lastName)
    if #doc.licenses == 0 then
        return header .. 'Nessuna patente o licenza posseduta.'
    end
    return header .. '- ' .. table.concat(doc.licenses, '\n- ')
end

local function showDocument(docType, doc)
    lib.alertDialog({
        header = docType == 'id' and 'Carta d\'Identità' or 'Patenti e licenze',
        content = buildDocText(docType, doc),
        centered = true,
        cancel = false,
        labels = { confirm = 'Chiudi' },
    })
end

local function showToNearby(docType)
    local playerId = lib.getClosestPlayer(GetEntityCoords(cache.ped), Config.ShowDistance, false)
    if not playerId then
        return lib.notify({ type = 'error', description = 'Nessun giocatore vicino.' })
    end
    TriggerServerEvent('rp_f5menu:showDocument', GetPlayerServerId(playerId), docType)
    lib.notify({ type = 'success', description = 'Documento mostrato.' })
end

RegisterNetEvent('rp_f5menu:receiveDocument', function(docType, doc, name)
    lib.notify({ type = 'inform', description = ('%s ti sta mostrando un documento.'):format(name) })
    showDocument(docType, doc)
end)

local function openDocuments()
    lib.registerContext({
        id = 'rp_f5_docs',
        title = 'Documenti',
        menu = 'rp_f5_main',
        options = {
            {
                title = 'Carta d\'Identità', description = 'Guarda il tuo documento', icon = 'id-card',
                onSelect = function()
                    local doc = lib.callback.await('rp_f5menu:getDocuments', false)
                    if doc then showDocument('id', doc) end
                end,
            },
            {
                title = 'Patenti e licenze', description = 'Guarda le tue patenti', icon = 'car',
                onSelect = function()
                    local doc = lib.callback.await('rp_f5menu:getDocuments', false)
                    if doc then showDocument('licenses', doc) end
                end,
            },
            {
                title = 'Mostra Carta d\'Identità', description = 'Al giocatore più vicino', icon = 'hand-holding',
                onSelect = function() showToNearby('id') end,
            },
            {
                title = 'Mostra Patenti', description = 'Al giocatore più vicino', icon = 'hand-holding',
                onSelect = function() showToNearby('licenses') end,
            },
        },
    })
    lib.showContext('rp_f5_docs')
end

local function openJobs()
    local jobs = lib.callback.await('rp_f5menu:getJobs', false)
    local current = ESX.GetPlayerData().job and ESX.GetPlayerData().job.name
    local options = {}

    for _, j in ipairs(jobs or {}) do
        options[#options + 1] = {
            title = j.label,
            description = ('Grado iniziale: %s | Stipendio: $%s'):format(j.gradeLabel, j.salary),
            icon = j.icon,
            disabled = current == j.job,
            onSelect = function()
                local ok, msg = lib.callback.await('rp_f5menu:setJob', false, j.job)
                lib.notify({ type = ok and 'success' or 'error', description = msg })
            end,
        }
    end

    lib.registerContext({ id = 'rp_f5_jobs', title = 'Seleziona lavoro', menu = 'rp_f5_main', options = options })
    lib.showContext('rp_f5_jobs')
end

local function openMain()
    local job = ESX.GetPlayerData().job
    local options = {
        {
            title = 'Documenti', description = 'Carta d\'identità, patenti, mostra a un giocatore',
            icon = 'id-card', onSelect = openDocuments,
        },
        {
            title = 'Seleziona lavoro', description = ('Lavoro attuale: %s - %s'):format(job and job.label or '-', job and job.grade_label or '-'),
            icon = 'briefcase', onSelect = openJobs,
        },
    }

    if lib.callback.await('rp_f5menu:isAdmin', false) then
        options[#options + 1] = {
            title = 'Job Creator', description = 'Crea e gestisci i lavori (staff)',
            icon = 'screwdriver-wrench', onSelect = function() ExecuteCommand('jobcreator') end,
        }
    end

    lib.registerContext({ id = 'rp_f5_main', title = 'RomaPD 2.0', options = options })
    lib.showContext('rp_f5_main')
end

RegisterCommand('rp_f5menu', function()
    if IsPauseMenuActive() or lib.getOpenContextMenu() then return end
    openMain()
end, false)
RegisterKeyMapping('rp_f5menu', 'Apri il menu F5', 'keyboard', Config.Key)
