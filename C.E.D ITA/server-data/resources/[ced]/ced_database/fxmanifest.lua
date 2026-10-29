fx_version 'cerulean'
game 'gta5'
lua54 'yes'

name 'ced_database'
author 'C.E.D ITA'
description 'Controlla a ogni avvio che nel database ci siano le tabelle e colonne di C.E.D ITA'
version '1.0.0'

server_scripts {
    '@oxmysql/lib/MySQL.lua',
    'server.lua',
}

dependency 'oxmysql'
