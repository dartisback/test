-- FLUX BOT ITA - connettore di TEST.
-- Si collega al pannello (POST /api/fivem/poll), cosi la dashboard mostra "connesso",
-- e tiene una copia della lista di bot SIMULATI che il pannello gestisce.
-- NON aggiunge giocatori: non modifica GetPlayers(), la lista del server, txAdmin o il server browser.

local simulated = {}
local lastCount = -1

local function log(msg)
    print(('^5[flux_connector]^7 %s'):format(msg))
end

local function poll()
    PerformHttpRequest(Config.PanelUrl .. '/api/fivem/poll', function(status, body)
        if status == 403 then
            return log('Licenza non valida o scaduta: controlla Config.License')
        elseif status ~= 200 or not body then
            return log(('Pannello non raggiungibile (HTTP %s)'):format(tostring(status)))
        end

        local data = json.decode(body)
        if not data or not data.ok then return end

        for _, c in ipairs(data.commands or {}) do
            log(('comando dal pannello: %s'):format(c.cmd))
        end

        simulated = data.bots or {}
        if #simulated ~= lastCount then
            lastCount = #simulated
            log(('bot simulati: %d/%d'):format(#simulated, data.max or 0))
            TriggerEvent('flux_connector:botsUpdated', simulated)
        end
    end, 'POST', '{}', {
        ['Content-Type'] = 'application/json',
        ['x-license'] = Config.License,
    })
end

CreateThread(function()
    if Config.License == 'FLUX-XXXX-XXXX-XXXX-XXXX' then
        return log('Imposta la tua licenza in config.lua')
    end
    log('avviato, collegamento a ' .. Config.PanelUrl)
    while true do
        poll()
        Wait(math.max(Config.PollSeconds, 2) * 1000)
    end
end)

-- Console del server: elenca i bot simulati
RegisterCommand('flux_bots', function(source)
    if source ~= 0 then return end -- solo console
    log(('%d bot simulati'):format(#simulated))
    for _, b in ipairs(simulated) do
        print(('  #%d  %s'):format(b.id, b.name))
    end
end, true)

exports('GetSimulatedBots', function() return simulated end)
