fx_version 'cerulean'
game 'gta5'
lua54 'yes'

name 'rp_jobcreator'
description 'RomaPD 2.0 - Job Creator (staff)'
version '1.0.0'

shared_scripts {
    '@ox_lib/init.lua',
    '@es_extended/imports.lua',
    'config.lua',
}

client_script 'client/main.lua'

server_scripts {
    '@oxmysql/lib/MySQL.lua',
    'server/main.lua',
}

dependencies {
    'ox_lib',
    'es_extended',
    'oxmysql',
}
