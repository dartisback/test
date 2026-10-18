local isOpen      = false
local uiReady     = false
local allowed     = nil   -- nomi dei comandi che il giocatore puo' usare (nil = tutti)
local external    = {}    -- suggerimenti aggiunti da altre risorse (chat:addSuggestion)
local aliasMap    = {}

for name, cmd in pairs(Config.Commands) do
    aliasMap[name] = name
    for _, alias in ipairs(cmd.aliases or {}) do aliasMap[alias] = name end
end

-- ================================================================
--  SUGGERIMENTI
-- ================================================================
local function pushSuggestions()
    if not uiReady then return end

    local list = {}
    for name, cmd in pairs(Config.Commands) do
        local ok = true
        if allowed then
            ok = false
            for _, a in ipairs(allowed) do
                if a == name then ok = true break end
            end
        end
        if ok then
            list[#list + 1] = {
                name   = name,
                help   = cmd.help,
                params = cmd.params,
                color  = cmd.color or '#38bdf8',
                icon   = cmd.icon or 'img/chat.svg',
            }
        end
    end
    for _, s in pairs(external) do list[#list + 1] = s end

    table.sort(list, function(a, b) return a.name < b.name end)
    SendNUIMessage({ action = 'suggestions', list = list })
end

local function addSuggestion(name, help, params)
    if type(name) ~= 'string' then return end
    name = name:gsub('^/', '')
    if aliasMap[name] then return end
    external[name] = { name = name, help = help or '', params = params or {}, color = '#94a3b8', icon = 'img/chat.svg' }
end

-- ================================================================
--  APERTURA / CHIUSURA
-- ================================================================
local function setOpen(state)
    if state == isOpen then return end
    isOpen = state
    SetNuiFocus(state, false)
    SendNUIMessage({ action = state and 'open' or 'close' })
    if state then TriggerServerEvent('fancy_chat:requestAllowed') end
end

RegisterCommand('fancy_chat_open', function()
    if uiReady and not isOpen then setOpen(true) end
end, false)
RegisterKeyMapping('fancy_chat_open', 'Apri la chat', 'keyboard', Config.OpenKey)

RegisterNUICallback('ready', function(_, cb)
    uiReady = true
    SendNUIMessage({
        action = 'config',
        maxLength = Config.MaxLength,
        displayTime = Config.DisplayTime,
        maxMessages = Config.MaxMessages,
        neon = Config.NeonTricolore,
    })
    pushSuggestions()
    cb('ok')
end)

RegisterNUICallback('close', function(_, cb)
    setOpen(false)
    cb('ok')
end)

RegisterNUICallback('submit', function(data, cb)
    cb('ok')
    setOpen(false)

    local text = type(data) == 'table' and data.text
    if type(text) ~= 'string' or text == '' then return end

    if text:sub(1, 1) == '/' then
        local name = text:match('^/(%S+)')
        if name and aliasMap[name:lower()] then
            TriggerServerEvent('fancy_chat:submit', text)
        elseif name then
            -- comando di un'altra risorsa (es. /car, /revive...)
            ExecuteCommand(text:sub(2))
        end
    else
        TriggerServerEvent('fancy_chat:submit', text)
    end
end)

-- ================================================================
--  EVENTI
-- ================================================================
RegisterNetEvent('fancy_chat:message', function(payload)
    if type(payload) ~= 'table' then return end
    SendNUIMessage({ action = 'add', msg = payload })
end)

RegisterNetEvent('fancy_chat:allowed', function(list)
    allowed = list
    pushSuggestions()
end)

for _, ev in ipairs({ 'esx:playerLoaded', 'esx:setJob' }) do
    RegisterNetEvent(ev, function()
        Wait(1000)
        TriggerServerEvent('fancy_chat:requestAllowed')
    end)
end

-- ----------------------------------------------------------------
--  Compatibilita' con la chat standard di FiveM (chat:addMessage ecc.)
-- ----------------------------------------------------------------
local function stripColors(s)
    return (tostring(s or ''):gsub('%^%d', ''))
end

AddEventHandler('chat:addMessage', function(msg)
    if type(msg) ~= 'table' then return end
    local args = msg.args or {}
    local author, text
    if #args >= 2 then
        author, text = stripColors(args[1]), stripColors(table.concat(args, ' ', 2))
    else
        text = stripColors(args[1] or msg.template or '')
    end

    local c = msg.color
    local color = type(c) == 'table' and ('#%02x%02x%02x'):format(c[1] or 255, c[2] or 255, c[3] or 255) or '#38bdf8'

    SendNUIMessage({
        action = 'add',
        msg = { type = 'system', title = author and 'MESSAGGIO' or 'SISTEMA', author = author, text = text,
                color = color, icon = 'img/system.svg' },
    })
end)

AddEventHandler('chat:addSuggestion', function(name, help, params)
    addSuggestion(name, help, params)
    pushSuggestions()
end)

AddEventHandler('chat:addSuggestions', function(list)
    for _, s in ipairs(list or {}) do addSuggestion(s.name, s.help, s.params) end
    pushSuggestions()
end)

AddEventHandler('chat:removeSuggestion', function(name)
    external[(tostring(name):gsub('^/', ''))] = nil
    pushSuggestions()
end)

AddEventHandler('chat:clear', function()
    SendNUIMessage({ action = 'clear' })
end)

-- Nasconde la chat quando e' aperto il menu di pausa
CreateThread(function()
    local hidden = false
    while true do
        Wait(500)
        local pause = IsPauseMenuActive()
        if pause ~= hidden then
            hidden = pause
            SendNUIMessage({ action = 'visible', state = not hidden })
        end
    end
end)

AddEventHandler('onResourceStop', function(res)
    if res == GetCurrentResourceName() then SetNuiFocus(false, false) end
end)
