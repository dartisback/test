fx_version 'cerulean'
game 'gta5'
lua54 'yes'

name 'ced_forzeordine'
author 'C.E.D ITA'
description 'Polizia Di Stato e Arma Dei Carabinieri per ESX Legacy, con ponte permessi per FivePD'
version '1.0.0'

shared_scripts {
    '@es_extended/imports.lua',
    'config.lua',
}

server_scripts {
    '@oxmysql/lib/MySQL.lua',
    'database.lua',
    'server.lua',
}

client_script 'client.lua'

dependencies {
    'oxmysql',
    'es_extended',
}
