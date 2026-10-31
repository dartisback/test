Config = {}

-- Oggetto di ox_inventory necessario per usare la radio
Config.Oggetto = 'radio'

-- true = i canali delle Forze dell'Ordine funzionano solo se sei IN SERVIZIO (/servizio)
Config.SoloInServizio = false

-- Volume iniziale (0 - 100)
Config.VolumeIniziale = 40

-- Frequenze libere: chiunque abbia la radio puo' usarle (civili, aziende, bande...)
Config.Libere = { min = 200.0, max = 999.9 }

-- Frequenze riservate: tra 100.0 e 199.9 funzionano SOLO i canali elencati qui sotto
Config.Riservate = { min = 100.0, max = 199.9 }

-- Sigla mostrata accanto ai nomi nella lista "in ascolto"
Config.SiglaLavoro = {
    polizia = 'PS',
    carabinieri = 'CC',
    guardiadifinanza = 'GdF',
    polizialocale = 'PL',
    poliziapenitenziaria = 'PolPen',
    vigilidelfuoco = 'VVF',
    ambulance = '118',
}

local FDO = { 'polizia', 'carabinieri', 'guardiadifinanza', 'polizialocale', 'poliziapenitenziaria' }
local TUTTI = { 'polizia', 'carabinieri', 'guardiadifinanza', 'polizialocale', 'poliziapenitenziaria', 'vigilidelfuoco', 'ambulance' }

-- Canali riservati. "lavori" = nomi dei job ESX che possono entrare.
-- I job che non esistono ancora nel server (es. guardiadifinanza) sono gia' pronti: basta crearli.
Config.Canali = {
    { frequenza = 100.0, nome = 'Interforze - Coordinamento', sigla = 'INT', colore = '#a78bfa', lavori = TUTTI },
    { frequenza = 100.1, nome = 'Interforze - Operazioni FdO', sigla = 'INT', colore = '#a78bfa', lavori = FDO },

    { frequenza = 113.0, nome = 'Polizia Di Stato - Sala Operativa', sigla = 'PS', colore = '#60a5fa', lavori = { 'polizia' } },
    { frequenza = 113.1, nome = 'Polizia Di Stato - Volanti', sigla = 'PS', colore = '#60a5fa', lavori = { 'polizia' } },
    { frequenza = 113.2, nome = 'Polizia Di Stato - Squadra Mobile', sigla = 'PS', colore = '#60a5fa', lavori = { 'polizia' } },

    { frequenza = 112.0, nome = 'Arma Dei Carabinieri - Centrale Operativa', sigla = 'CC', colore = '#fb7185', lavori = { 'carabinieri' } },
    { frequenza = 112.1, nome = 'Arma Dei Carabinieri - Nucleo Radiomobile', sigla = 'CC', colore = '#fb7185', lavori = { 'carabinieri' } },
    { frequenza = 112.2, nome = 'Arma Dei Carabinieri - Stazione', sigla = 'CC', colore = '#fb7185', lavori = { 'carabinieri' } },

    { frequenza = 117.0, nome = 'Guardia Di Finanza - Sala Operativa', sigla = 'GdF', colore = '#facc15', lavori = { 'guardiadifinanza' } },
    { frequenza = 120.0, nome = 'Polizia Locale - Centrale', sigla = 'PL', colore = '#22d3ee', lavori = { 'polizialocale' } },
    { frequenza = 121.0, nome = 'Polizia Penitenziaria', sigla = 'PolPen', colore = '#94a3b8', lavori = { 'poliziapenitenziaria' } },
    { frequenza = 115.0, nome = 'Vigili Del Fuoco - Sala Operativa', sigla = 'VVF', colore = '#fb923c', lavori = { 'vigilidelfuoco' } },
    { frequenza = 118.0, nome = 'Emergenza Sanitaria 118', sigla = '118', colore = '#4ade80', lavori = { 'ambulance' } },
}
