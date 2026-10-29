-- Controllo di sicurezza: all'avvio verifica che nel database ci siano i lavori
-- di Config.LavoriDatabase (Disoccupato, Polizia Di Stato, Arma Dei Carabinieri)
-- e li ricrea se mancano, senza toccare quelli gia' presenti.

local function esiste(query, params)
    return MySQL.scalar.await(query, params) ~= nil
end

MySQL.ready(function()
    local hasType = MySQL.scalar.await([[
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'jobs' AND COLUMN_NAME = 'type'
    ]]) > 0

    local aggiunti = {}

    for _, lavoro in ipairs(Config.LavoriDatabase) do
        if not esiste('SELECT 1 FROM `jobs` WHERE `name` = ?', { lavoro.name }) then
            if hasType then
                MySQL.insert.await('INSERT INTO `jobs` (`name`, `label`, `type`) VALUES (?, ?, ?)', { lavoro.name, lavoro.label, lavoro.type })
            else
                MySQL.insert.await('INSERT INTO `jobs` (`name`, `label`) VALUES (?, ?)', { lavoro.name, lavoro.label })
            end
            aggiunti[#aggiunti + 1] = lavoro.label
        end

        for _, g in ipairs(lavoro.gradi) do
            if not esiste('SELECT 1 FROM `job_grades` WHERE `job_name` = ? AND `grade` = ?', { lavoro.name, g.grado }) then
                MySQL.insert.await(
                    'INSERT INTO `job_grades` (`job_name`, `grade`, `name`, `label`, `salary`, `skin_male`, `skin_female`) VALUES (?, ?, ?, ?, ?, ?, ?)',
                    { lavoro.name, g.grado, g.nome, g.label, g.stipendio, '{}', '{}' }
                )
                aggiunti[#aggiunti + 1] = ('%s - %s'):format(lavoro.label, g.label)
            end
        end
    end

    if #aggiunti > 0 then
        print(('^2[ced_forzeordine]^7 Aggiunti al database: ^5%s^7'):format(table.concat(aggiunti, ', ')))
        ESX.RefreshJobs()
    end
end)
