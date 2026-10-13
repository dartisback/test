-- ============================================================
--  RomaPD 2.0 - Database (ESX Legacy + oxmysql)
--  Importa DOPO lo schema base di es_extended (users, jobs, ...)
-- ============================================================

-- ---------- Tabelle di supporto ----------
CREATE TABLE IF NOT EXISTS `jobs` (
  `name` varchar(50) NOT NULL,
  `label` varchar(50) DEFAULT NULL,
  `whitelisted` tinyint(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `job_grades` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `job_name` varchar(50) DEFAULT NULL,
  `grade` int(11) NOT NULL,
  `name` varchar(50) NOT NULL,
  `label` varchar(50) NOT NULL,
  `salary` int(11) NOT NULL,
  `skin_male` longtext NOT NULL,
  `skin_female` longtext NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `licenses` (
  `type` varchar(60) NOT NULL,
  `label` varchar(60) NOT NULL,
  PRIMARY KEY (`type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `user_licenses` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `type` varchar(60) NOT NULL,
  `owner` varchar(60) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `owned_vehicles` (
  `owner` varchar(60) NOT NULL,
  `plate` varchar(12) NOT NULL,
  `vehicle` longtext DEFAULT NULL,
  `type` varchar(20) NOT NULL DEFAULT 'car',
  `job` varchar(20) DEFAULT NULL,
  `stored` tinyint(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (`plate`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------- Patenti / licenze ----------
INSERT INTO `licenses` (`type`, `label`) VALUES
  ('dmv',     'Teoria patente'),
  ('drive',   'Patente B'),
  ('drive_bike', 'Patente A'),
  ('drive_truck', 'Patente C'),
  ('weapon',  'Porto d''armi')
ON DUPLICATE KEY UPDATE `label` = VALUES(`label`);

-- ---------- LAVORI ----------
-- Nomi interni mantenuti compatibili con gli script ESX standard:
--   police     = Polizia di Stato
--   carabinieri= Arma dei Carabinieri
--   ambulance  = Croce Rossa
INSERT INTO `jobs` (`name`, `label`, `whitelisted`) VALUES
  ('unemployed',  'Disoccupato',      0),
  ('police',      'Polizia di Stato', 1),
  ('carabinieri', 'Carabinieri',      1),
  ('ambulance',   'Croce Rossa',      1)
ON DUPLICATE KEY UPDATE `label` = VALUES(`label`), `whitelisted` = VALUES(`whitelisted`);

DELETE FROM `job_grades` WHERE `job_name` IN ('unemployed', 'police', 'carabinieri', 'ambulance');

INSERT INTO `job_grades` (`job_name`, `grade`, `name`, `label`, `salary`, `skin_male`, `skin_female`) VALUES
  ('unemployed', 0, 'unemployed', 'Disoccupato', 200, '{}', '{}'),

  -- Polizia di Stato
  ('police', 0, 'agente',         'Agente',                  600,  '{}', '{}'),
  ('police', 1, 'assistente',     'Assistente Capo',         750,  '{}', '{}'),
  ('police', 2, 'sovrintendente', 'Sovrintendente',          900,  '{}', '{}'),
  ('police', 3, 'ispettore',      'Ispettore',               1100, '{}', '{}'),
  ('police', 4, 'commissario',    'Commissario',             1300, '{}', '{}'),
  ('police', 5, 'boss',           'Questore',                1600, '{}', '{}'),

  -- Carabinieri
  ('carabinieri', 0, 'carabiniere', 'Carabiniere',           600,  '{}', '{}'),
  ('carabinieri', 1, 'appuntato',   'Appuntato Scelto',      750,  '{}', '{}'),
  ('carabinieri', 2, 'maresciallo', 'Maresciallo',           900,  '{}', '{}'),
  ('carabinieri', 3, 'tenente',     'Tenente',               1100, '{}', '{}'),
  ('carabinieri', 4, 'capitano',    'Capitano',              1300, '{}', '{}'),
  ('carabinieri', 5, 'boss',        'Colonnello',            1600, '{}', '{}'),

  -- Croce Rossa
  ('ambulance', 0, 'volontario',  'Volontario',              500,  '{}', '{}'),
  ('ambulance', 1, 'soccorritore','Soccorritore',            700,  '{}', '{}'),
  ('ambulance', 2, 'infermiere',  'Infermiere',              900,  '{}', '{}'),
  ('ambulance', 3, 'medico',      'Medico',                  1200, '{}', '{}'),
  ('ambulance', 4, 'boss',        'Direttore Sanitario',     1500, '{}', '{}');
