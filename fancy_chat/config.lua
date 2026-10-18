Config = {}

-- ================================================================
--  GENERALE
-- ================================================================
Config.OpenKey       = 'T'      -- tasto per aprire la chat (cambiabile da Impostazioni > Tasti > FiveM)
Config.DisplayTime   = 9000     -- ms in cui un messaggio resta visibile a chat chiusa
Config.MaxMessages   = 100      -- messaggi massimi conservati nella cronologia
Config.MaxLength     = 200      -- lunghezza massima di un messaggio

-- Chat locale: un messaggio senza "/" viene letto solo dai giocatori vicini
Config.LocalChat = {
    enabled  = true,
    distance = 20.0,
    title    = 'LOCALE',
    color    = '#94a3b8',
    icon     = 'img/chat.svg',
}

-- Gruppi ESX considerati "staff"
Config.AdminGroups = { 'admin', 'superadmin', 'mod', 'moderator', 'god' }

-- Ferma da sola la risorsa "chat" di default se risulta avviata (evita le due chat sovrapposte)
Config.StopDefaultChat = true

-- Stampa in console il vero nome di chi scrive con /anon
Config.LogAnon = true

-- ================================================================
--  LAVORI (usati da /annuncio e dai comandi di categoria)
--  Non serve elencare i lavori: vengono letti da soli da ESX.
--  - Icona: metti un file in html/img/jobs/<nome_lavoro>.png (o .webp/.jpg/.gif/.svg)
--           e verra' usato in automatico. Se non c'e' viene usata l'icona di default.
--  - Colore: se non e' indicato qui sotto, viene generato in automatico dal nome del lavoro.
-- ================================================================
Config.JobColors = {
    police      = '#2563eb',
    carabinieri = '#1d4ed8',
    ambulance   = '#ef4444',
    mechanic    = '#f59e0b',
    taxi        = '#eab308',
}

-- Immagini forzate (opzionale), es: unemployed = 'img/jobs/custom.png'
Config.JobImages = {}

-- ================================================================
--  COMANDI
--  cooldown   : secondi di attesa tra un messaggio e l'altro (gli staff lo ignorano)
--  aliases    : altri nomi del comando
--  groups     : solo questi gruppi ESX possono usarlo
--  jobs       : solo questi lavori possono usarlo
--  recipients : 'all' = tutti | 'groups' = solo i gruppi in "groups"
-- ================================================================
Config.Commands = {

    anon = {
        kind       = 'anon',
        help       = 'Invia un messaggio anonimo',
        params     = { { name = 'messaggio', help = 'Testo da inviare' } },
        cooldown   = 15,
        title      = 'ANONIMO',
        color      = '#8b5cf6',
        icon       = 'img/anon.svg',
        fx         = 'glitch',
        recipients = 'all',
    },

    twitter = {
        kind       = 'twitter',
        aliases    = { 'twt' },
        help       = 'Pubblica un tweet',
        params     = { { name = 'messaggio', help = 'Testo del tweet' } },
        cooldown   = 10,
        title      = 'TWITTER',
        color      = '#1d9bf0',
        icon       = 'img/twitter.svg',
        fx         = 'wobble',
        recipients = 'all',
    },

    -- Funziona con TUTTI i lavori: prende da solo lavoro, grado, icona e colore
    annuncio = {
        kind          = 'announce',
        aliases       = { 'ad' },
        help          = 'Annuncio ufficiale del tuo lavoro',
        params        = { { name = 'messaggio', help = 'Testo dell\'annuncio' } },
        cooldown      = 60,
        title         = 'ANNUNCIO',
        fx            = 'shake',
        recipients    = 'all',
        blacklistJobs = { 'unemployed' }, -- questi lavori non possono fare annunci
    },

    -- Chat privata dello staff (la vedono solo gli admin)
    staff = {
        kind       = 'staff',
        help       = 'Chat privata dello staff',
        params     = { { name = 'messaggio', help = 'Messaggio per lo staff' } },
        cooldown   = 0,
        title      = 'STAFF',
        color      = '#ef4444',
        icon       = 'img/staff.svg',
        fx         = 'pulse',
        groups     = Config.AdminGroups,
        recipients = 'groups',
    },

    -- Comunicazione ufficiale dello staff a tutti i giocatori (solo gli admin possono scriverla)
    staffo = {
        kind       = 'staff',
        help       = 'Comunicazione ufficiale dello staff a tutti',
        params     = { { name = 'messaggio', help = 'Messaggio per tutti' } },
        cooldown   = 0,
        title      = 'STAFF',
        color      = '#f43f5e',
        icon       = 'img/staffo.svg',
        fx         = 'pulse',
        groups     = Config.AdminGroups,
        recipients = 'all',
    },

    -- Comunicazione Polizia di Stato (solo job police)
    pds = {
        kind       = 'job',
        help       = 'Comunicazione Polizia di Stato',
        params     = { { name = 'messaggio', help = 'Testo della comunicazione' } },
        cooldown   = 10,
        title      = 'POLIZIA DI STATO',
        color      = '#2563eb',
        icon       = 'img/jobs/police.svg',
        fx         = 'siren',
        jobs       = { 'police' },
        recipients = 'all',
    },

    -- Comunicazione Carabinieri (solo job carabinieri)
    cc = {
        kind       = 'job',
        help       = 'Comunicazione Carabinieri',
        params     = { { name = 'messaggio', help = 'Testo della comunicazione' } },
        cooldown   = 10,
        title      = 'CARABINIERI',
        color      = '#1d4ed8',
        icon       = 'img/jobs/carabinieri.svg',
        fx         = 'siren',
        jobs       = { 'carabinieri', 'carabineri' }, -- nome del job nel DB (metti qui il tuo)
        recipients = 'all',
    },
}
