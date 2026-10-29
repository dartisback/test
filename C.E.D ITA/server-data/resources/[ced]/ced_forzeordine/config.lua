Config = {}

-- Comando per entrare/uscire dal servizio
Config.ComandoServizio = 'servizio'

-- Comando per vedere quanti colleghi sono in servizio
Config.ComandoColleghi = 'colleghi'

-- true = si puo' prendere servizio solo al punto di servizio (Questura / Caserma)
-- false = il comando /servizio funziona ovunque (il punto con il marker funziona comunque)
Config.ServizioSoloAlPunto = false

-- true = il gruppo ace per FivePD viene dato solo quando sei IN SERVIZIO
-- false = viene dato a chiunque abbia il job, anche fuori servizio
Config.AceSoloInServizio = true

-- Tasto per il punto di servizio (38 = E)
Config.TastoInterazione = 38

-- Le coordinate si possono prendere in gioco con il comando ESX /coords (da admin)
Config.Dipartimenti = {
    polizia = {
        nome = 'Polizia Di Stato',
        sigla = 'PS',
        notifica = 'polizia',            -- tipo di notifica esx_notify
        gruppoAce = 'group.polizia',     -- vedi server-data/permessi.cfg
        blip = {
            coords = vector3(428.2, -981.0, 30.7),
            sprite = 60,
            colore = 3,
            scala = 0.9,
            nome = 'Questura - Polizia Di Stato',
        },
        puntoServizio = vector3(441.3, -981.9, 30.69),
        marker = { r = 30, g = 110, b = 255 },
    },

    carabinieri = {
        nome = 'Arma Dei Carabinieri',
        sigla = 'CC',
        notifica = 'carabinieri',
        gruppoAce = 'group.carabinieri',
        blip = {
            coords = vector3(1853.4, 3686.8, 34.3),
            sprite = 60,
            colore = 1,
            scala = 0.9,
            nome = 'Caserma - Arma Dei Carabinieri',
        },
        puntoServizio = vector3(1853.2, 3689.6, 34.27),
        marker = { r = 200, g = 20, b = 50 },
    },
}

-- Lavori che devono SEMPRE esistere nel database: se mancano vengono ricreati all'avvio
Config.LavoriDatabase = {
    {
        name = 'unemployed', label = 'Disoccupato', type = 'civ',
        gradi = { { grado = 0, nome = 'unemployed', label = 'Disoccupato', stipendio = 200 } },
    },
    {
        name = 'polizia', label = 'Polizia Di Stato', type = 'leo',
        gradi = { { grado = 0, nome = 'operatore', label = 'Operatore', stipendio = 800 } },
    },
    {
        name = 'carabinieri', label = 'Arma Dei Carabinieri', type = 'leo',
        gradi = { { grado = 0, nome = 'operatore', label = 'Operatore', stipendio = 800 } },
    },
}

Config.Testi = {
    in_servizio = 'Sei ora ~g~in servizio~s~ come %s.',
    fuori_servizio = 'Sei ora ~r~fuori servizio~s~.',
    non_fdo = 'Non fai parte delle Forze dell\'Ordine.',
    troppo_lontano = 'Devi essere al punto di servizio per farlo.',
    aiuto_punto = '[E] Entra / esci dal servizio',
    colleghi = '~b~Polizia Di Stato~s~: %d in servizio<br>~r~Arma Dei Carabinieri~s~: %d in servizio',
    suggerimento_servizio = 'Entra o esci dal servizio (Polizia / Carabinieri)',
    suggerimento_colleghi = 'Mostra quanti agenti sono in servizio',
}
