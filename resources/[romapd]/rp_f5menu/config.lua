Config = {}

Config.Key = 'F5'
Config.JobChangeCooldown = 30 -- secondi tra un cambio lavoro e l'altro
Config.ShowDistance = 3.0     -- distanza massima per mostrare un documento

-- Lavori selezionabili liberamente dal menu F5.
-- Per rendere un lavoro whitelist (assunzione solo da boss/admin) RIMUOVILO da questa lista.
Config.SelectableJobs = {
    { job = 'unemployed',  grade = 0, icon = 'user' },
    { job = 'police',      grade = 0, icon = 'shield-halved' },
    { job = 'carabinieri', grade = 0, icon = 'shield' },
    { job = 'ambulance',   grade = 0, icon = 'truck-medical' },
}

-- Tipi di licenza (tabella user_licenses) mostrati nei documenti
Config.LicenseLabels = {
    drive       = 'Patente B',
    drive_bike  = 'Patente A',
    drive_truck = 'Patente C',
    weapon      = 'Porto d\'armi',
}
