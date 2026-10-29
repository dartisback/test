-- C.E.D ITA - controllo database a ogni avvio
-- Crea le tabelle e le colonne che mancano (aggiunte dagli aggiornamenti), senza toccare i dati.
-- I job (Disoccupato, Polizia, Carabinieri) li controlla ced_forzeordine.

local tabelle = {
    [[CREATE TABLE IF NOT EXISTS `multicharacter_slots` (
        `identifier` VARCHAR(60) NOT NULL,
        `slots` INT(11) NOT NULL,
        PRIMARY KEY (`identifier`) USING BTREE,
        INDEX `slots` (`slots`) USING BTREE
    ) ENGINE=InnoDB]],

    [[CREATE TABLE IF NOT EXISTS `owned_vehicles` (
        `owner` VARCHAR(60) DEFAULT NULL,
        `plate` VARCHAR(12) NOT NULL,
        `vehicle` LONGTEXT DEFAULT NULL,
        `type` VARCHAR(20) NOT NULL DEFAULT 'car',
        `job` VARCHAR(20) DEFAULT NULL,
        `stored` TINYINT(4) NOT NULL DEFAULT 0,
        `parking` VARCHAR(60) DEFAULT NULL,
        `pound` VARCHAR(60) DEFAULT NULL,
        `glovebox` LONGTEXT NULL,
        `trunk` LONGTEXT NULL,
        PRIMARY KEY (`plate`),
        KEY `esx_owned_vehicles_owner` (`owner`)
    ) ENGINE=InnoDB]],

    [[CREATE TABLE IF NOT EXISTS `player_outfits` (
        `id` INT(11) NOT NULL AUTO_INCREMENT,
        `citizenid` VARCHAR(50) DEFAULT NULL,
        `outfitname` VARCHAR(50) NOT NULL DEFAULT '0',
        `model` VARCHAR(50) DEFAULT NULL,
        `props` VARCHAR(1000) DEFAULT NULL,
        `components` VARCHAR(1500) DEFAULT NULL,
        PRIMARY KEY (`id`),
        UNIQUE KEY `citizenid_outfitname_model` (`citizenid`, `outfitname`, `model`),
        KEY `citizenid` (`citizenid`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4]],

    [[CREATE TABLE IF NOT EXISTS `player_outfit_codes` (
        `id` INT(11) NOT NULL AUTO_INCREMENT,
        `outfitid` INT(11) NOT NULL,
        `code` VARCHAR(50) NOT NULL DEFAULT '',
        PRIMARY KEY (`id`),
        KEY `FK_player_outfit_codes_player_outfits` (`outfitid`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4]],

    [[CREATE TABLE IF NOT EXISTS `management_outfits` (
        `id` INT(11) NOT NULL AUTO_INCREMENT,
        `job_name` VARCHAR(50) NOT NULL,
        `type` VARCHAR(50) NOT NULL,
        `minrank` INT(11) NOT NULL DEFAULT 0,
        `name` VARCHAR(50) NOT NULL DEFAULT 'Cool Outfit',
        `gender` VARCHAR(50) NOT NULL DEFAULT 'male',
        `model` VARCHAR(50) DEFAULT NULL,
        `props` VARCHAR(1000) DEFAULT NULL,
        `components` VARCHAR(1500) DEFAULT NULL,
        PRIMARY KEY (`id`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4]],
}

-- colonne di `users` usate da ced_personaggi e illenium-appearance
local colonneUtenti = {
    { 'firstname', 'VARCHAR(16) NULL DEFAULT NULL' },
    { 'lastname', 'VARCHAR(16) NULL DEFAULT NULL' },
    { 'dateofbirth', 'VARCHAR(10) NULL DEFAULT NULL' },
    { 'sex', 'VARCHAR(1) NULL DEFAULT NULL' },
    { 'height', 'INT NULL DEFAULT NULL' },
    { 'skin', 'LONGTEXT NULL DEFAULT NULL' },
    { 'disabled', 'TINYINT(1) NULL DEFAULT 0' },
}

MySQL.ready(function()
    local create = 0
    for _, query in ipairs(tabelle) do
        local ok, errore = pcall(MySQL.query.await, query)
        if not ok then print(('^1[ced_database] errore: %s^7'):format(errore)) end
    end

    local esistenti = {}
    local righe = MySQL.query.await([[
        SELECT COLUMN_NAME FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users'
    ]]) or {}
    for _, r in ipairs(righe) do esistenti[r.COLUMN_NAME] = true end

    if next(esistenti) then
        for _, colonna in ipairs(colonneUtenti) do
            if not esistenti[colonna[1]] then
                local ok = pcall(MySQL.query.await, ('ALTER TABLE `users` ADD COLUMN `%s` %s'):format(colonna[1], colonna[2]))
                if ok then create = create + 1 end
            end
        end
    end

    if create > 0 then
        print(('^2[ced_database]^7 aggiunte %d colonne mancanti alla tabella users'):format(create))
    end
end)
