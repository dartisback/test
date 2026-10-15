local isOpen = false

local function openChat(prefill)
    if isOpen then return end
    isOpen = true
    SetNuiFocus(true, true)
    TriggerServerEvent('nr_chat:requestChannels')
    SendNUIMessage({ action = 'open', prefill = prefill })
end

local function closeChat()
    isOpen = false
    SetNuiFocus(false, false)
end

RegisterCommand('nr_chat_open', function() openChat() end, false)
RegisterCommand('nr_chat_open_cmd', function() openChat('/') end, false)
RegisterKeyMapping('nr_chat_open', 'Apri la chat', 'keyboard', 'T')
RegisterKeyMapping('nr_chat_open_cmd', 'Apri la chat (comando)', 'keyboard', 'SLASH')

RegisterNUICallback('ready', function(_, cb)
    SendNUIMessage({ action = 'config', config = Config.UI, maxLength = Config.MaxLength })
    TriggerServerEvent('nr_chat:requestChannels')
    cb('ok')
end)

RegisterNUICallback('close', function(_, cb)
    closeChat()
    cb('ok')
end)

RegisterNUICallback('chatResult', function(data, cb)
    closeChat()
    local message = data and data.message
    if message and message ~= '' then
        if message:sub(1, 1) == '/' then
            ExecuteCommand(message:sub(2))
        else
            SendNUIMessage({ action = 'addMessage', message = {
                channel = 'system', style = 'system', label = 'SISTEMA', icon = '💡',
                color = '#f59e0b', text = 'Usa un canale: /anon /twitter /pds /cc ...',
                time = '',
            } })
        end
    end
    cb('ok')
end)

RegisterNetEvent('nr_chat:addMessage', function(message)
    SendNUIMessage({ action = 'addMessage', message = message })
end)

RegisterNetEvent('nr_chat:setChannels', function(channels)
    SendNUIMessage({ action = 'channels', channels = channels })
end)

-- compatibilita' con la chat standard: altre risorse possono continuare a usare questi eventi
local function toHex(c)
    if type(c) ~= 'table' then return '#e5e7eb' end
    return ('#%02x%02x%02x'):format(c[1] or 255, c[2] or 255, c[3] or 255)
end

RegisterNetEvent('chat:addMessage', function(m)
    if type(m) == 'string' then m = { args = { m } } end
    local args = m.args or {}
    local author, text = nil, nil
    if #args >= 2 then
        author = tostring(args[1])
        text = table.concat(args, ' ', 2)
    else
        text = tostring(args[1] or '')
    end
    SendNUIMessage({ action = 'addMessage', message = {
        channel = 'system', style = 'system', label = 'SISTEMA', icon = '💬',
        color = toHex(m.color), author = author, text = text, time = '',
    } })
end)

RegisterNetEvent('chat:addSuggestion', function(name, help)
    SendNUIMessage({ action = 'suggestions', list = { { name = name, help = help or '' } } })
end)

RegisterNetEvent('chat:addSuggestions', function(list)
    SendNUIMessage({ action = 'suggestions', list = list })
end)

RegisterNetEvent('chat:clear', function()
    SendNUIMessage({ action = 'clear' })
end)

-- nasconde la chat quando e' aperto il menu di pausa
CreateThread(function()
    local hidden = false
    while true do
        local paused = IsPauseMenuActive()
        if paused ~= hidden then
            hidden = paused
            SendNUIMessage({ action = 'visible', value = not paused })
        end
        Wait(500)
    end
end)
