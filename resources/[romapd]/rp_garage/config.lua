Config = {}

-- Al riavvio del server rimette tutti i veicoli "fuori" nel garage
Config.ParkAllOnStart = true

-- Garage pubblici (veicoli di proprietà, tabella owned_vehicles)
Config.Garages = {
    {
        id = 'legion', label = 'Garage Legion Square', type = 'car',
        coords = vec3(215.8, -810.1, 30.7), radius = 3.0,
        spawn = vec4(223.6, -804.9, 30.0, 248.0),
        blip = { sprite = 357, color = 3, scale = 0.8 },
    },
    {
        id = 'vespucci', label = 'Garage Vespucci', type = 'car',
        coords = vec3(-1184.4, -1494.5, 4.4), radius = 3.0,
        spawn = vec4(-1178.3, -1488.0, 4.0, 215.0),
        blip = { sprite = 357, color = 3, scale = 0.8 },
    },
    {
        id = 'sandy', label = 'Garage Sandy Shores', type = 'car',
        coords = vec3(1737.6, 3710.2, 34.1), radius = 3.0,
        spawn = vec4(1731.5, 3714.9, 34.1, 20.0),
        blip = { sprite = 357, color = 3, scale = 0.8 },
    },
}

-- Garage di servizio: veicoli temporanei per grado minimo
Config.JobGarages = {
    police = {
        label = 'Garage Polizia di Stato',
        coords = vec3(454.6, -1017.4, 28.4), radius = 3.0,
        spawn = vec4(438.4, -1018.3, 28.7, 90.0),
        blip = { sprite = 60, color = 3, scale = 0.8 },
        platePrefix = 'PS',
        vehicles = {
            { model = 'police',  label = 'Volante (Giulia)',   minGrade = 0 },
            { model = 'police2', label = 'Volante (Gazzella)', minGrade = 0 },
            { model = 'police3', label = 'Volante Cruiser',    minGrade = 1 },
            { model = 'fbi2',    label = 'SUV Funzionario',    minGrade = 3 },
            { model = 'policeb', label = 'Moto Polizia',       minGrade = 1 },
        },
    },
    carabinieri = {
        label = 'Garage Carabinieri',
        coords = vec3(-1108.3, -845.5, 19.3), radius = 3.0,
        spawn = vec4(-1113.6, -850.4, 13.5, 305.0),
        blip = { sprite = 60, color = 29, scale = 0.8 },
        platePrefix = 'CC',
        vehicles = {
            { model = 'sheriff',  label = 'Gazzella Carabinieri', minGrade = 0 },
            { model = 'sheriff2', label = 'SUV Carabinieri',      minGrade = 1 },
            { model = 'policeb',  label = 'Moto Carabinieri',     minGrade = 1 },
            { model = 'fbi',      label = 'Auto Ufficiali',       minGrade = 3 },
        },
    },
    ambulance = {
        label = 'Garage Croce Rossa',
        coords = vec3(294.6, -600.7, 43.3), radius = 3.0,
        spawn = vec4(290.7, -611.3, 43.4, 70.0),
        blip = { sprite = 61, color = 1, scale = 0.8 },
        platePrefix = 'CRI',
        vehicles = {
            { model = 'ambulance', label = 'Ambulanza',         minGrade = 0 },
            { model = 'lguard',    label = 'Mezzo di soccorso', minGrade = 1 },
            { model = 'fbi2',      label = 'Auto Medica',       minGrade = 3 },
        },
    },
}
