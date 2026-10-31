fx_version 'cerulean'
game 'gta5'
lua54 'yes'

name 'ced_radio'
author 'C.E.D ITA'
description 'Radio italiana con canali interforze (Polizia Di Stato, Carabinieri, ...) - funziona con l\'oggetto radio'
version '1.0.0'

shared_scripts {
    '@ox_lib/init.lua',
    '@es_extended/imports.lua',
    'config.lua',
}

server_script 'server.lua'
client_script 'client.lua'

ui_page 'html/index.html'

files {
    'html/index.html',
    'html/style.css',
    'html/app.js',
}

dependencies {
    'es_extended',
    'ox_lib',
    'ox_inventory',
    'pma-voice',
}
