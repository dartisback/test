fx_version 'cerulean'
game 'gta5'
lua54 'yes'

name 'fancy_chat'
description 'Chat animata in stile okokChat per ESX (/anon /twitter /annuncio /staff /staffo /pds /cc)'
version '1.0.0'

-- Sostituisce la risorsa "chat" di default: toglila dal server.cfg
provide 'chat'

dependency 'es_extended'

shared_script 'config.lua'

client_script 'client/main.lua'
server_script 'server/main.lua'

ui_page 'html/index.html'

files {
    'html/index.html',
    'html/style.css',
    'html/script.js',
    'html/img/**/*',
}
