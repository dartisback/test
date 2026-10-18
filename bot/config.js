// Tutti gli ID (ruoli e canali) si impostano nel file .env — vedi .env.example
require('dotenv').config();

const env = (k) => (process.env[k] || '').trim();

const RUOLI = {
  assistenza: 'RUOLO_ASSISTENZA', // staff assistenza: usa i comandi assistenza e vede i ticket
  whitelistStaff: 'RUOLO_STAFF_WHITELIST', // staff whitelist: usa i comandi whitelist
  direzione: 'RUOLO_DIREZIONE', // direzione: comandi direzione e gestione candidature
  whitelistOk: 'RUOLO_WHITELIST', // ruolo dato a chi passa la whitelist
  nonWhitelist: 'RUOLO_NON_WHITELIST', // ruolo tolto quando passa la whitelist (facoltativo)
};

const CANALI = {
  esitiWhitelist: 'CANALE_ESITI_WHITELIST',
  convocazioniWl: 'CANALE_CONVOCAZIONI_WL',
  moduliWhitelist: 'CANALE_MODULI_WHITELIST',
  categoriaTicket: 'CATEGORIA_TICKET',
  logTicket: 'CANALE_LOG_TICKET',
  logWarn: 'CANALE_LOG_WARN',
  logBan: 'CANALE_LOG_BAN',
  logFazioni: 'CANALE_WARN_FAZIONI',
  esitiAzioni: 'CANALE_ESITI_AZIONI',
  logAssistenze: 'CANALE_ASSISTENZE',
  logReport: 'CANALE_REPORT',
  moduliDirezione: 'CANALE_MODULI_DIREZIONE',
  candidatureStaff: 'CANALE_CANDIDATURE_STAFF',
  candidatureTeamac: 'CANALE_CANDIDATURE_TEAMAC',
  candidatureCreator: 'CANALE_CANDIDATURE_CREATOR',
};

module.exports = {
  ruolo: (key) => ({ id: env(RUOLI[key]), env: RUOLI[key] }),
  canale: (key) => ({ id: env(CANALI[key]), env: CANALI[key] }),
  RUOLI,
  CANALI,
};
