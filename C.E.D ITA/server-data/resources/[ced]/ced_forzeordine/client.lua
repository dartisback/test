local Dipartimenti = Config.Dipartimenti

CreateThread(function()
    for _, dip in pairs(Dipartimenti) do
        local b = dip.blip
        local blip = AddBlipForCoord(b.coords.x, b.coords.y, b.coords.z)

        SetBlipSprite(blip, b.sprite)
        SetBlipColour(blip, b.colore)
        SetBlipScale(blip, b.scala)
        SetBlipAsShortRange(blip, true)
        BeginTextCommandSetBlipName('STRING')
        AddTextComponentSubstringPlayerName(b.nome)
        EndTextCommandSetBlipName(blip)
    end
end)

TriggerEvent('chat:addSuggestion', '/' .. Config.ComandoServizio, Config.Testi.suggerimento_servizio)
TriggerEvent('chat:addSuggestion', '/' .. Config.ComandoColleghi, Config.Testi.suggerimento_colleghi)

-- Punto di servizio: visibile solo a chi ha il job del dipartimento
CreateThread(function()
    local mostrandoAiuto = false

    while true do
        local attesa = 1000
        local job = ESX.PlayerData and ESX.PlayerData.job
        local dip = job and Dipartimenti[job.name]

        if dip then
            local coords = GetEntityCoords(PlayerPedId())
            local distanza = #(coords - dip.puntoServizio)

            if distanza < 15.0 then
                attesa = 0
                local m = dip.marker
                DrawMarker(27, dip.puntoServizio.x, dip.puntoServizio.y, dip.puntoServizio.z - 0.97,
                    0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 1.2, 1.2, 1.0, m.r, m.g, m.b, 160,
                    false, false, 2, true, nil, nil, false)

                if distanza < 1.5 then
                    if not mostrandoAiuto then
                        ESX.TextUI(Config.Testi.aiuto_punto, 'info')
                        mostrandoAiuto = true
                    end

                    if IsControlJustReleased(0, Config.TastoInterazione) then
                        TriggerServerEvent('ced_forzeordine:cambiaServizio')
                    end
                elseif mostrandoAiuto then
                    ESX.HideUI()
                    mostrandoAiuto = false
                end
            end
        end

        if attesa > 0 and mostrandoAiuto then
            ESX.HideUI()
            mostrandoAiuto = false
        end

        Wait(attesa)
    end
end)
