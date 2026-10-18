local ESX = exports['es_extended']:getSharedObject()

local resource  = GetCurrentResourceName()
local cooldowns = {}
local aliasMap  = {}
local imageCache = {}

local function toSet(list)
    local set = {}
    for _, v in ipairs(list or {}) do set[v] = true end
    return set
end

local adminSet = toSet(Config.AdminGroups)

for name, cmd in pairs(Config.Commands) do
    aliasMap[name] = name
    for _, alias in ipairs(cmd.aliases or {}) do aliasMap[alias] = name end
    cmd._groupSet = toSet(cmd.groups)
    cmd._jobSet   = toSet(cmd.jobs)
    cmd._blackSet = toSet(cmd.blacklistJobs)
end

-- ================================================================
--  UTILITY
-- ================================================================
local function now()
    return os.date('%H:%M')
end

local function clean(text)
    text = tostring(text or '')
    text = text:gsub('[%c]', ' '):gsub('%s+', ' '):gsub('^%s+', ''):gsub('%s+$', '')
    if utf8.len(text) and utf8.len(text) > Config.MaxLength then
        text = text:sub(1, (utf8.offset(text, Config.MaxLength + 1) or (#text + 1)) - 1)
    elseif #text > Config.MaxLength * 4 then
        text = text:sub(1, Config.MaxLength)
    end
    return text
end

local function system(target, text, kind)
    TriggerClientEvent('fancy_chat:message', target, {
        type  = 'system',
        title = kind == 'error' and 'ERRORE' or 'SISTEMA',
        text  = text,
        color = kind == 'error' and '#ef4444' or '#38bdf8',
        icon  = 'img/system.svg',
        fx    = kind == 'error' and 'shake' or nil,
        time  = now(),
    })
end

local function isAdmin(xPlayer)
    return xPlayer and adminSet[xPlayer.getGroup()] == true
end

local function canUse(xPlayer, cmd)
    if not xPlayer then return false end
    if next(cmd._groupSet) and not cmd._groupSet[xPlayer.getGroup()] then return false end
    if next(cmd._jobSet) and not cmd._jobSet[xPlayer.job.name] then return false end
    if next(cmd._blackSet) and cmd._blackSet[xPlayer.job.name] then return false end
    return true
end

-- Cerca da solo l'immagine del lavoro in html/img/jobs/<job>.<ext>
local function jobImage(jobName)
    if Config.JobImages[jobName] then return Config.JobImages[jobName] end
    if imageCache[jobName] ~= nil then return imageCache[jobName] end

    local found = 'img/jobs/default.svg'
    for _, ext in ipairs({ 'png', 'webp', 'jpg', 'jpeg', 'gif', 'svg' }) do
        local path = ('img/jobs/%s.%s'):format(jobName, ext)
        if LoadResourceFile(resource, 'html/' .. path) then
            found = path
            break
        end
    end
    imageCache[jobName] = found
    return found
end

local function playersWithPermission(cmd)
    local list = {}
    for _, id in ipairs(ESX.GetPlayers()) do
        local xPlayer = ESX.GetPlayerFromId(id)
        if xPlayer and (cmd.recipients ~= 'groups' or cmd._groupSet[xPlayer.getGroup()]) then
            list[#list + 1] = id
        end
    end
    return list
end

local function broadcast(cmd, payload)
    if cmd.recipients == 'groups' then
        for _, id in ipairs(playersWithPermission(cmd)) do
            TriggerClientEvent('fancy_chat:message', id, payload)
        end
    else
        TriggerClientEvent('fancy_chat:message', -1, payload)
    end
end

local function handleOf(name)
    local handle = tostring(name):lower():gsub('[^%w]', '')
    return '@' .. (handle ~= '' and handle or 'utente')
end

-- ================================================================
--  COSTRUTTORI DEI MESSAGGI (uno per "kind" in config.lua)
-- ================================================================
local Builders = {}

function Builders.anon(src, xPlayer, cmd, text)
    if Config.LogAnon then
        print(('[%s] /anon di %s (id %s, %s): %s'):format(resource, xPlayer.getName(), src, xPlayer.identifier, text))
    end
    return {
        type = 'anon', title = cmd.title, author = 'Anonimo',
        text = text, icon = cmd.icon, color = cmd.color, fx = cmd.fx, time = now(),
    }
end

function Builders.twitter(src, xPlayer, cmd, text)
    local name = xPlayer.getName()
    return {
        type = 'twitter', title = cmd.title, author = name, handle = handleOf(name), rich = true,
        text = text, icon = cmd.icon, color = cmd.color, fx = cmd.fx, time = now(),
    }
end

-- Funziona con qualsiasi lavoro: icona, nome e colore arrivano dal job del giocatore
function Builders.announce(src, xPlayer, cmd, text)
    local job = xPlayer.job
    return {
        type = 'announce',
        title = cmd.title .. ' · ' .. (job.label or job.name),
        author = xPlayer.getName(),
        subtitle = job.grade_label,
        text = text,
        icon = jobImage(job.name),
        color = Config.JobColors[job.name],
        colorSeed = job.name, -- se manca il colore lo genera il client dal nome del lavoro
        fx = cmd.fx, time = now(),
    }
end

function Builders.staff(src, xPlayer, cmd, text)
    return {
        type = 'staff', title = cmd.title, author = xPlayer.getName(),
        subtitle = cmd.recipients == 'groups' and 'Solo staff' or 'Comunicazione ufficiale',
        text = text, icon = cmd.icon, color = cmd.color, fx = cmd.fx, time = now(),
    }
end

function Builders.job(src, xPlayer, cmd, text)
    return {
        type = 'job', title = cmd.title, author = xPlayer.getName(),
        subtitle = xPlayer.job.grade_label,
        text = text, icon = cmd.icon, color = cmd.color, fx = cmd.fx, time = now(),
    }
end

-- ================================================================
--  RICEZIONE MESSAGGI
-- ================================================================
local function checkCooldown(src, xPlayer, name, cmd)
    local seconds = cmd.cooldown or 0
    if seconds <= 0 or isAdmin(xPlayer) then return true end

    cooldowns[src] = cooldowns[src] or {}
    local last = cooldowns[src][name] or 0
    local left = math.ceil((last + seconds * 1000 - GetGameTimer()) / 1000)
    if left > 0 then
        system(src, ('Aspetta ancora %d secondi prima di usare /%s'):format(left, name), 'error')
        return false
    end
    cooldowns[src][name] = GetGameTimer()
    return true
end

local function sendLocal(src, xPlayer, text)
    local lc = Config.LocalChat
    local name = xPlayer.getName()
    local payload = {
        type = 'local', title = lc.title, author = name, text = text,
        icon = lc.icon, color = lc.color, time = now(), compact = true,
    }
    local origin = GetEntityCoords(GetPlayerPed(src))
    for _, id in ipairs(ESX.GetPlayers()) do
        local ped = GetPlayerPed(id)
        if ped ~= 0 and #(GetEntityCoords(ped) - origin) <= lc.distance then
            TriggerClientEvent('fancy_chat:message', id, payload)
        end
    end
end

RegisterNetEvent('fancy_chat:submit', function(raw)
    local src = source
    local xPlayer = ESX.GetPlayerFromId(src)
    if not xPlayer or type(raw) ~= 'string' then return end

    raw = raw:sub(1, Config.MaxLength * 4)

    -- Messaggio normale -> chat locale
    if raw:sub(1, 1) ~= '/' then
        if not Config.LocalChat.enabled then return end
        local text = clean(raw)
        if text == '' then return end
        return sendLocal(src, xPlayer, text)
    end

    local name, rest = raw:match('^/(%S+)%s*(.*)$')
    name = name and name:lower()
    local realName = name and aliasMap[name]
    if not realName then return end

    local cmd = Config.Commands[realName]
    if not canUse(xPlayer, cmd) then
        return system(src, 'Non hai il permesso di usare /' .. name, 'error')
    end

    local text = clean(rest)
    if text == '' then
        return system(src, ('Uso corretto: /%s <messaggio>'):format(name), 'error')
    end

    if not checkCooldown(src, xPlayer, realName, cmd) then return end

    local builder = Builders[cmd.kind]
    if not builder then return end
    broadcast(cmd, builder(src, xPlayer, cmd, text))
end)

-- Il client chiede quali comandi puo' usare (per i suggerimenti)
RegisterNetEvent('fancy_chat:requestAllowed', function()
    local src = source
    local xPlayer = ESX.GetPlayerFromId(src)
    if not xPlayer then return end

    local allowed = {}
    for name, cmd in pairs(Config.Commands) do
        if canUse(xPlayer, cmd) then allowed[#allowed + 1] = name end
    end
    TriggerClientEvent('fancy_chat:allowed', src, allowed)
end)

AddEventHandler('playerDropped', function()
    cooldowns[source] = nil
end)

-- ================================================================
--  Ferma le chat concorrenti (la risorsa "chat" di default di FiveM ecc.)
--  Controlla di continuo, cosi' se un altro script la riavvia viene rifermata.
--  Una copia di fancy_chat (anche se rinominata "chat") NON viene fermata.
-- ================================================================
local warned = {}

local function isOurs(name)
    return GetResourceMetadata(name, 'name', 0) == 'fancy_chat'
end

-- Trova gli script che hanno "dependency 'chat'" (sono loro a far ripartire la chat di default)
local function findDependents(target)
    local found = {}
    for i = 0, GetNumResources() - 1 do
        local res = GetResourceByFindIndex(i)
        for _, key in ipairs({ 'dependency', 'dependencies' }) do
            for n = 0, GetNumResourceMetadata(res, key) - 1 do
                if GetResourceMetadata(res, key, n) == target and res ~= resource then
                    found[#found + 1] = res
                end
            end
        end
    end
    return found
end

local function stopOtherChats()
    for _, name in ipairs(Config.StopResources) do
        local state = GetResourceState(name)
        if name ~= resource and (state == 'started' or state == 'starting') then
            if isOurs(name) then
                if not warned['dup:' .. name] then
                    warned['dup:' .. name] = true
                    print(('^3[%s] ATTENZIONE: esiste una COPIA di fancy_chat chiamata "%s" (%s). Tieni UNA sola cartella: cancella l\'altra e toglila dal server.cfg.^7'):format(resource, name, GetResourcePath(name)))
                end
            else
                StopResource(name)
                if not warned[name] then
                    warned[name] = true
                    local deps = findDependents(name)
                    print(('^3[%s] la chat di default "%s" era avviata ed e\' stata fermata.^7'):format(resource, name))
                    print(('^3[%s]   cartella da cancellare: %s^7'):format(resource, GetResourcePath(name)))
                    print(('^3[%s]   tolta dal server.cfg? cerca "ensure %s" / "start %s"^7'):format(resource, name, name))
                    if #deps > 0 then
                        print(('^3[%s]   script che la richiamano (dependency \'%s\'): %s^7'):format(resource, name, table.concat(deps, ', ')))
                    end
                end
            end
        end
    end
end

CreateThread(function()
    while Config.StopDefaultChat do
        stopOtherChats()
        Wait(1000)
    end
end)

AddEventHandler('onResourceStart', function(name)
    for _, blocked in ipairs(Config.StopResources) do
        if name == blocked and name ~= resource then
            CreateThread(function()
                Wait(0)
                stopOtherChats()
            end)
        end
    end
end)

-- Export per gli altri script:  exports.fancy_chat:sendMessage(-1, { title=..., text=..., color=..., icon=... })
exports('sendMessage', function(target, payload)
    payload.time = payload.time or now()
    TriggerClientEvent('fancy_chat:message', target, payload)
end)

CreateThread(function()
    Wait(2000)
    local jobs = ESX.GetJobs and ESX.GetJobs() or {}
    local count, withImage = 0, 0
    for jobName in pairs(jobs) do
        count = count + 1
        if jobImage(jobName) ~= 'img/jobs/default.svg' then withImage = withImage + 1 end
    end
    print(('[%s] pronta - %d lavori trovati (%d con immagine personalizzata) - /annuncio attivo per tutti'):format(resource, count, withImage))
end)
