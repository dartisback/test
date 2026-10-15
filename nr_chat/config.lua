Config = {}

-- Gruppi ESX considerati staff (usati da /staff e /staffo)
Config.StaffGroups = { 'admin', 'superadmin' }

-- Item ox_inventory richiesto per /twitter
Config.PhoneItem = 'phone'

Config.MaxLength = 200       -- caratteri massimi per messaggio
Config.StaffSeesAnon = true  -- lo staff vede chi ha scritto in /anon (tra parentesi)

-- Impostazioni interfaccia
Config.UI = {
    fadeTime    = 8000,  -- ms prima che i messaggi spariscano a chat chiusa
    maxMessages = 100,   -- messaggi tenuti in memoria
    bannerTime  = 7000,  -- ms di durata del banner /staffo
}

-- Regole (access = chi puo' scrivere, audience = chi riceve):
--   { type = 'all' }
--   { type = 'group', values = { 'admin' } }   gruppo ESX
--   { type = 'job',   values = { 'police' } }  job ESX
--   { type = 'item',  item = 'phone' }         item in ox_inventory (solo access)
Config.Channels = {
    {
        command  = 'anon',
        label    = 'ANON',
        icon     = '🎭',
        color    = '#a3a3b2',
        help     = 'Scrivi un messaggio anonimo',
        cooldown = 10,
        style    = 'anon',
        author   = 'anon', -- nome nascosto
        access   = { type = 'all' },
        audience = { type = 'all' },
    },
    {
        command  = 'staff',
        label    = 'STAFF',
        icon     = '🛡️',
        color    = '#f43f5e',
        help     = 'Chat privata riservata allo staff',
        cooldown = 0,
        style    = 'staff',
        author   = 'name',
        access   = { type = 'group', values = Config.StaffGroups },
        audience = { type = 'group', values = Config.StaffGroups },
    },
    {
        command  = 'staffo',
        label    = 'STAFF',
        icon     = '📢',
        color    = '#fbbf24',
        help     = 'Annuncio ufficiale dello staff a tutti i giocatori',
        cooldown = 5,
        style    = 'announce',
        banner   = true, -- mostra anche il banner animato in alto
        author   = 'name',
        access   = { type = 'group', values = Config.StaffGroups },
        audience = { type = 'all' },
    },
    {
        command  = 'twitter',
        label    = 'TWITTER',
        icon     = '🐦',
        color    = '#38a9ff',
        help     = 'Pubblica un tweet (serve un telefono)',
        cooldown = 15,
        style    = 'twitter',
        author   = 'handle', -- @nome
        access   = { type = 'item', item = Config.PhoneItem },
        audience = { type = 'all' },
    },
    {
        command  = 'pds',
        label    = 'POLIZIA DI STATO',
        icon     = '🚓',
        color    = '#3b82f6',
        help     = 'Radio della Polizia di Stato',
        cooldown = 0,
        style    = 'pds',
        author   = 'name',
        access   = { type = 'job', values = { 'police' } },
        audience = { type = 'job', values = { 'police' } },
    },
    {
        command  = 'cc',
        label    = 'CARABINIERI',
        icon     = '🚔',
        color    = '#e11d48',
        help     = "Radio dell'Arma dei Carabinieri",
        cooldown = 0,
        style    = 'cc',
        author   = 'name',
        access   = { type = 'job', values = { 'carabinieri' } },
        audience = { type = 'job', values = { 'carabinieri' } },
    },
}
