fx_version 'cerulean'
game 'gta5'
lua54 'yes'

name 'ced_personaggi'
author 'C.E.D ITA'
description 'Selezione personaggi e registrazione anagrafica (multicharacter + identity) per ESX Legacy'
version '1.0.0'

shared_scripts {
    '@ox_lib/init.lua',
    '@es_extended/imports.lua',
    'config.lua',
}

server_scripts {
    '@oxmysql/lib/MySQL.lua',
    'server.lua',
}

client_script 'client.lua'

ui_page 'html/index.html'

files {
    'html/index.html',
    'html/style.css',
    'html/app.js',
}

dependencies {
    'oxmysql',
    'ox_lib',
    'es_extended',
    'illenium-appearance',
}
