Config = {}

-- Personaggi per giocatore (per un giocatore specifico: /setslot [id] [numero], solo admin)
Config.Slot = 3

-- Prefisso dell'identificativo ESX (char1:licenza, char2:licenza, ...). NON cambiarlo dopo l'apertura.
Config.Prefisso = 'char'

-- I giocatori possono eliminare i propri personaggi
Config.PuoiEliminare = true

-- Comando per tornare alla selezione personaggi senza uscire dal server ('' per disattivarlo)
Config.ComandoCambio = 'cambiapersonaggio'

-- Scena della selezione: dove sta il personaggio in anteprima (x, y, z, direzione)
Config.Scena = vector4(-284.2856, 562.4627, 172.9182, 19.9895)

-- Dove compaiono i personaggi appena creati
Config.SpawnNuovi = vector4(222.2027, -864.0162, 30.2922, 1.0)

-- Regole della carta d'identita'
Config.Identita = {
    lunghezzaNome = { min = 2, max = 16 },  -- il database accetta al massimo 16 caratteri
    eta = { min = 18, max = 90 },
    altezza = { min = 140, max = 210 },     -- in centimetri
}

-- Dati "di colore" mostrati sulla carta d'identita' (non salvati nel database)
Config.Documento = {
    comune = 'LOS SANTOS',
    cittadinanza = 'ITALIANA',
}
