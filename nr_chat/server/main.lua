local ESX = exports['es_extended']:getSharedObject()
local cooldowns = {}

-- trasforma le liste dei valori in set per controlli veloci
for _, ch in ipairs(Config.Channels) do
    for _, rule in pairs({ ch.access, ch.audience }) do
        if rule.values then
            local set = {}
            for _, v in ipairs(rule.values) do set[v] = true end
            rule.set = set
        end
    end
end

local staffSet = {}
for _, g in ipairs(Config.StaffGroups) do staffSet[g] = true end

local function jobName(xPlayer)
    if xPlayer.job and xPlayer.job.name then return xPlayer.job.name end
    return xPlayer.getJob().name
end

local function hasItem(src, item)
    local count = exports.ox_inventory:Search(src, 'count', item)
    return type(count) == 'number' and count > 0
end

local function matches(rule, src, xPlayer)
    if rule.type == 'all' then return true end
    if not xPlayer then return false end
    if rule.type == 'group' then return rule.set[xPlayer.getGroup()] == true end
    if rule.type == 'job' then return rule.set[jobName(xPlayer)] == true end
    if rule.type == 'item' then return hasItem(src, rule.item) end
    return false
end

local function now() return os.date('%H:%M') end

local function system(src, text)
    TriggerClientEvent('nr_chat:addMessage', src, {
        channel = 'system', style = 'system', label = 'SISTEMA', icon = '⚠️',
        color = '#f59e0b', text = text, time = now(),
    })
end

local function characterName(src, xPlayer)
    local name = xPlayer and xPlayer.getName and xPlayer.getName()
    if not name or name == '' then name = GetPlayerName(src) end
    return name
end

local function sanitize(text)
    text = text:gsub('%c', ' '):gsub('%s+', ' ')
    return (text:gsub('^%s+', ''):gsub('%s+$', ''))
end

local function handle(ch, src, args)
    if src == 0 then return print(('[nr_chat] /%s e\' utilizzabile solo in gioco'):format(ch.command)) end
    local xPlayer = ESX.GetPlayerFromId(src)
    if not xPlayer then return end

    if not matches(ch.access, src, xPlayer) then
        local why = {
            item  = 'Ti serve un telefono per usare /' .. ch.command .. '.',
            group = 'Non hai i permessi per usare /' .. ch.command .. '.',
            job   = 'Non fai parte del corpo richiesto per /' .. ch.command .. '.',
        }
        return system(src, why[ch.access.type] or 'Non puoi usare questo comando.')
    end

    local text = sanitize(table.concat(args, ' '))
    if text == '' then return system(src, ('Uso: /%s <messaggio>'):format(ch.command)) end
    text = text:sub(1, Config.MaxLength)

    local key = src .. ':' .. ch.command
    local t = GetGameTimer()
    if ch.cooldown > 0 and cooldowns[key] and t - cooldowns[key] < ch.cooldown * 1000 then
        local left = math.ceil((ch.cooldown * 1000 - (t - cooldowns[key])) / 1000)
        return system(src, ('Attendi %ds prima di usare di nuovo /%s.'):format(left, ch.command))
    end
    cooldowns[key] = t

    local realName = characterName(src, xPlayer)
    local author = realName
    if ch.author == 'anon' then author = 'Anonimo'
    elseif ch.author == 'handle' then author = '@' .. realName:gsub('%s+', '_'):lower() end

    local msg = {
        channel = ch.command, style = ch.style, label = ch.label, icon = ch.icon,
        color = ch.color, author = author, text = text, time = now(), banner = ch.banner,
    }

    for _, id in ipairs(ESX.GetPlayers()) do
        local xTarget = ESX.GetPlayerFromId(id)
        if id == src or matches(ch.audience, id, xTarget) then
            local out = msg
            if ch.author == 'anon' and Config.StaffSeesAnon and xTarget and staffSet[xTarget.getGroup()] then
                out = {}
                for k, v in pairs(msg) do out[k] = v end
                out.real = realName
            end
            TriggerClientEvent('nr_chat:addMessage', id, out)
        end
    end

    print(('[nr_chat] [%s] %s (%d): %s'):format(ch.command, realName, src, text))
end

for _, ch in ipairs(Config.Channels) do
    RegisterCommand(ch.command, function(src, args) handle(ch, src, args) end, false)
end

-- elenco dei comandi disponibili per il giocatore (suggerimenti e colori nella UI)
RegisterNetEvent('nr_chat:requestChannels', function()
    local src = source
    local xPlayer = ESX.GetPlayerFromId(src)
    local list = {}
    for _, ch in ipairs(Config.Channels) do
        if matches(ch.access, src, xPlayer) then
            list[#list + 1] = {
                command = ch.command, label = ch.label, icon = ch.icon,
                color = ch.color, help = ch.help, style = ch.style,
            }
        end
    end
    TriggerClientEvent('nr_chat:setChannels', src, list)
end)

AddEventHandler('playerDropped', function()
    local prefix = tostring(source) .. ':'
    for k in pairs(cooldowns) do
        if k:sub(1, #prefix) == prefix then cooldowns[k] = nil end
    end
end)

-- export: exports.nr_chat:SendSystem(target, 'testo')
exports('SendSystem', system)
