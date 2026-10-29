-- =====================================================================
--  C.E.D ITA - DATABASE COMPLETO
--  ESX Legacy (core + identity + multicharacter + skin) + job FdO
--
--  NON serve importarlo a mano: AVVIA_SERVER.bat (o CREA_DATABASE.bat)
--  lo esegue da solo usando il nome del database scritto in server.cfg.
--  Se vuoi importarlo a mano (HeidiSQL / phpMyAdmin) crea il database `ced_ita`.
--  Tabelle ESX tratte da esx-framework/esx_core (GPL-3.0).
-- =====================================================================

CREATE DATABASE IF NOT EXISTS `ced_ita`
    DEFAULT CHARACTER SET utf8mb4
    DEFAULT COLLATE utf8mb4_unicode_ci;

USE `ced_ita`;

-- ---------------------------------------------------------------------
--  GIOCATORI
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `users` (
    `identifier`  VARCHAR(60)  NOT NULL,
    `ssn`         VARCHAR(11)  NOT NULL,
    `accounts`    LONGTEXT     NULL DEFAULT NULL,
    `group`       VARCHAR(50)  NULL DEFAULT 'user',
    `inventory`   LONGTEXT     NULL DEFAULT NULL,
    `job`         VARCHAR(20)  NULL DEFAULT 'unemployed',
    `job_grade`   INT          NULL DEFAULT 0,
    `loadout`     LONGTEXT     NULL DEFAULT NULL,
    `metadata`    LONGTEXT     NULL DEFAULT NULL,
    `position`    LONGTEXT     NULL DEFAULT NULL,
    -- esx_identity
    `firstname`   VARCHAR(16)  NULL DEFAULT NULL,
    `lastname`    VARCHAR(16)  NULL DEFAULT NULL,
    `dateofbirth` VARCHAR(10)  NULL DEFAULT NULL,
    `sex`         VARCHAR(1)   NULL DEFAULT NULL,
    `height`      INT          NULL DEFAULT NULL,
    -- esx_skin
    `skin`        LONGTEXT     NULL DEFAULT NULL,
    -- esx_multicharacter
    `disabled`    TINYINT(1)   NULL DEFAULT '0',

    PRIMARY KEY (`identifier`),
    UNIQUE KEY `unique_ssn` (`ssn`)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS `multicharacter_slots` (
    `identifier` VARCHAR(60) NOT NULL,
    `slots`      INT(11)     NOT NULL,
    PRIMARY KEY (`identifier`) USING BTREE,
    INDEX `slots` (`slots`) USING BTREE
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
--  OGGETTI
--  Con ox_inventory gli oggetti si gestiscono in
--  resources/[ox]/ox_inventory/data/items.lua: questa tabella resta vuota.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `items` (
    `name`       VARCHAR(50) NOT NULL,
    `label`      VARCHAR(50) NOT NULL,
    `weight`     INT         NOT NULL DEFAULT 1,
    `rare`       TINYINT     NOT NULL DEFAULT 0,
    `can_remove` TINYINT     NOT NULL DEFAULT 1,
    PRIMARY KEY (`name`)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
--  VEICOLI DI PROPRIETA' (ox_inventory la usa per bagagliaio e cruscotto)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `owned_vehicles` (
    `owner`    VARCHAR(60) DEFAULT NULL,
    `plate`    VARCHAR(12) NOT NULL,
    `vehicle`  LONGTEXT    DEFAULT NULL,
    `type`     VARCHAR(20) NOT NULL DEFAULT 'car',
    `job`      VARCHAR(20) DEFAULT NULL,
    `stored`   TINYINT(4)  NOT NULL DEFAULT 0,
    `parking`  VARCHAR(60) DEFAULT NULL,
    `pound`    VARCHAR(60) DEFAULT NULL,
    `glovebox` LONGTEXT    NULL,
    `trunk`    LONGTEXT    NULL,
    PRIMARY KEY (`plate`),
    KEY `esx_owned_vehicles_owner` (`owner`)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
--  OX_INVENTORY (depositi / stash)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `ox_inventory` (
    `owner`       VARCHAR(60)  DEFAULT NULL,
    `name`        VARCHAR(100) NOT NULL,
    `data`        LONGTEXT     DEFAULT NULL,
    `lastupdated` TIMESTAMP    NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY `owner` (`owner`, `name`)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
--  LAVORI
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `jobs` (
    `name`  VARCHAR(50) NOT NULL,
    `label` VARCHAR(50) DEFAULT NULL,
    `type`  VARCHAR(50) NOT NULL DEFAULT 'civ',
    PRIMARY KEY (`name`)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS `job_grades` (
    `id`          INT         NOT NULL AUTO_INCREMENT,
    `job_name`    VARCHAR(50) DEFAULT NULL,
    `grade`       INT         NOT NULL,
    `name`        VARCHAR(50) NOT NULL,
    `label`       VARCHAR(50) NOT NULL,
    `salary`      INT         NOT NULL,
    `skin_male`   LONGTEXT    NOT NULL,
    `skin_female` LONGTEXT    NOT NULL,
    PRIMARY KEY (`id`),
    UNIQUE KEY `job_grade_unique` (`job_name`, `grade`)
) ENGINE=InnoDB;

-- Si puo' rieseguire quante volte vuoi: non crea doppioni.

-- database creati con gli SQL ufficiali ESX non hanno ancora la colonna `type`
SET @ced_col := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'jobs' AND COLUMN_NAME = 'type');
SET @ced_sql := IF(@ced_col = 0,
    'ALTER TABLE `jobs` ADD COLUMN `type` VARCHAR(50) NOT NULL DEFAULT ''civ'' AFTER `label`',
    'DO 0');
PREPARE ced_stmt FROM @ced_sql;
EXECUTE ced_stmt;
DEALLOCATE PREPARE ced_stmt;

INSERT IGNORE INTO `jobs` (`name`, `label`) VALUES
    ('unemployed',  'Disoccupato'),
    ('polizia',     'Polizia Di Stato'),
    ('carabinieri', 'Arma Dei Carabinieri');

UPDATE `jobs` SET `label` = 'Disoccupato' WHERE `name` = 'unemployed';
UPDATE `jobs` SET `type` = 'leo' WHERE `name` IN ('polizia', 'carabinieri');

INSERT INTO `job_grades` (`job_name`, `grade`, `name`, `label`, `salary`, `skin_male`, `skin_female`)
    SELECT 'unemployed', 0, 'unemployed', 'Disoccupato', 200, '{}', '{}' FROM DUAL
    WHERE NOT EXISTS (SELECT 1 FROM `job_grades` WHERE `job_name` = 'unemployed' AND `grade` = 0);

INSERT INTO `job_grades` (`job_name`, `grade`, `name`, `label`, `salary`, `skin_male`, `skin_female`)
    SELECT 'polizia', 0, 'operatore', 'Operatore', 800, '{}', '{}' FROM DUAL
    WHERE NOT EXISTS (SELECT 1 FROM `job_grades` WHERE `job_name` = 'polizia' AND `grade` = 0);

INSERT INTO `job_grades` (`job_name`, `grade`, `name`, `label`, `salary`, `skin_male`, `skin_female`)
    SELECT 'carabinieri', 0, 'operatore', 'Operatore', 800, '{}', '{}' FROM DUAL
    WHERE NOT EXISTS (SELECT 1 FROM `job_grades` WHERE `job_name` = 'carabinieri' AND `grade` = 0);

UPDATE `job_grades` SET `label` = 'Disoccupato' WHERE `job_name` = 'unemployed' AND `grade` = 0;

-- ---------------------------------------------------------------------
--  Vuoi aggiungere altri gradi? Esempio (togli i -- per attivarlo):
-- ---------------------------------------------------------------------
-- INSERT INTO `job_grades` (`job_name`, `grade`, `name`, `label`, `salary`, `skin_male`, `skin_female`) VALUES
--     ('polizia',     1, 'boss', 'Commissario', 1500, '{}', '{}'),
--     ('carabinieri', 1, 'boss', 'Maresciallo', 1500, '{}', '{}');
