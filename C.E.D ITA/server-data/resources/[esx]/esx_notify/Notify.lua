-- SPDX-License-Identifier: GPL-3.0-only
-- Copyright (C) 2022-2026 ESX Framework

local Debug = ESX.GetConfig().EnableDebug

local possiblePosition = {
    ["top-right"] = true,
    ["top-left"] = true,
    ["top-middle"] = true,
    ["bottom-right"] = true,
    ["bottom-left"] = true,
    ["bottom-middle"] = true,
    ["middle-left"] = true,
    ["middle-right"] = true
}

---@param notificatonType string the notification type: success, error, info, warning, polizia, carabinieri
---@param length number the length of the notification
---@param message any the message :D
---@param title string optional title for the notification (default: the type's title)
---@param position string optional position for the notification
local function Notify(notificatonType, length, message, title, position)
    if type(notificatonType) ~= "string" then
        notificatonType = "info"
    end

    if
        type(length) ~= "number"
        or length ~= length
        or length < 0
        or length == math.huge
    then
        length = 4000
    end

    if not possiblePosition[position] then
        position = Config.position or "top-right"
    end

    if message ~= nil then
        message = tostring(message)
        message = message:gsub("~br~", "<br>")
    end

    if Debug then
        print(("[esx_notify] %s | %s | %s | %s | %s"):format(notificatonType, length, tostring(message), tostring(title), position))
    end

    SendNuiMessage(json.encode({
        type = notificatonType,
        length = length,
        message = message or "",
        title = type(title) == "string" and title or false,
        position = position,
        notificationSoundEnabled = Config.notificationSoundEnabled or false
    }))
end

exports('Notify', Notify)
RegisterNetEvent("ESX:Notify", Notify)

if Config.testCommand or Debug then
    RegisterCommand("testnotifiche", function()
        local tests = {
            { "success", "Hai ricevuto ~g~1x~s~ radio di servizio.", false },
            { "info", "Benvenuto su ~b~C.E.D ITA~s~!<br>Buon servizio.", false },
            { "warning", "Il veicolo ha ~y~poco carburante~s~.", false },
            { "error", "Non hai i ~r~permessi~s~ per farlo.", false },
            { "polizia", "Sei ora ~b~in servizio~s~.", false },
            { "carabinieri", "Pattuglia assegnata: ~r~Sandy Shores~s~.", false },
        }

        CreateThread(function()
            for i = 1, #tests do
                Notify(tests[i][1], 6000, tests[i][2], tests[i][3])
                Wait(350)
            end
        end)
    end, false)
end
