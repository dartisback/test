fx_version 'cerulean'
game 'gta5'
lua54 'yes'

name 'nr_chat'
description 'Chat animata in stile okokChat: /anon /staff /staffo /twitter /pds /cc'
version '1.0.0'

-- sostituisce la risorsa "chat" di default: NON avviare "chat", avvia solo nr_chat
provide 'chat'

dependencies {
    'es_extended',
    'ox_inventory',
}

shared_script 'config.lua'

client_script 'client/main.lua'
server_script 'server/main.lua'

ui_page 'html/index.html'

files {
    'html/index.html',
    'html/style.css',
    'html/script.js',
}
