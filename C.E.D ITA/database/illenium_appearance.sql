-- =====================================================================
--  C.E.D ITA - TABELLE DI ILLENIUM-APPEARANCE (ESX)
--
--  Come importarlo:
--   1) apri HeidiSQL (o phpMyAdmin) e seleziona il TUO database
--      (quello scritto in server.cfg, di default `ced_ita`)
--   2) esegui questo file
--
--  Si puo' eseguire piu' volte: non cancella e non duplica niente.
--  Con ESX l'aspetto del personaggio e' salvato nella colonna users.skin;
--  queste tabelle servono per i vestiti salvati, i codici outfit e le divise dei lavori.
--  (La tabella `playerskins` serve solo a QBCore: con ESX non va creata.)
-- =====================================================================

-- colonna dell'aspetto (di solito c'e' gia', la creava esx_skin)
ALTER TABLE `users` ADD COLUMN IF NOT EXISTS `skin` LONGTEXT NULL DEFAULT NULL;

-- vestiti salvati dai giocatori
CREATE TABLE IF NOT EXISTS `player_outfits` (
    `id`         INT(11)       NOT NULL AUTO_INCREMENT,
    `citizenid`  VARCHAR(50)   DEFAULT NULL,
    `outfitname` VARCHAR(50)   NOT NULL DEFAULT '0',
    `model`      VARCHAR(50)   DEFAULT NULL,
    `props`      VARCHAR(1000) DEFAULT NULL,
    `components` VARCHAR(1500) DEFAULT NULL,
    PRIMARY KEY (`id`),
    UNIQUE KEY `citizenid_outfitname_model` (`citizenid`, `outfitname`, `model`),
    KEY `citizenid` (`citizenid`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- codici per condividere un outfit con altri giocatori
CREATE TABLE IF NOT EXISTS `player_outfit_codes` (
    `id`       INT(11)     NOT NULL AUTO_INCREMENT,
    `outfitid` INT(11)     NOT NULL,
    `code`     VARCHAR(50) NOT NULL DEFAULT '',
    PRIMARY KEY (`id`),
    KEY `FK_player_outfit_codes_player_outfits` (`outfitid`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- divise dei lavori (es. Polizia Di Stato, Carabinieri) gestite dai capi
CREATE TABLE IF NOT EXISTS `management_outfits` (
    `id`         INT(11)       NOT NULL AUTO_INCREMENT,
    `job_name`   VARCHAR(50)   NOT NULL,
    `type`       VARCHAR(50)   NOT NULL,
    `minrank`    INT(11)       NOT NULL DEFAULT 0,
    `name`       VARCHAR(50)   NOT NULL DEFAULT 'Cool Outfit',
    `gender`     VARCHAR(50)   NOT NULL DEFAULT 'male',
    `model`      VARCHAR(50)   DEFAULT NULL,
    `props`      VARCHAR(1000) DEFAULT NULL,
    `components` VARCHAR(1500) DEFAULT NULL,
    PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
