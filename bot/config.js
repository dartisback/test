// ID di ruoli e canali del server. Si possono cambiare qui oppure sovrascrivere dal file .env
// (es. RUOLO_ASSISTENZA=123 nel .env ha la precedenza su quello scritto qui).
require('dotenv').config();

const env = (k) => (process.env[k] || '').trim();

const RUOLI = {
  assistenza: { env: 'RUOLO_ASSISTENZA', id: '1561443733344624770' }, // staff assistenza: comandi assistenza e ticket
  whitelistStaff: { env: 'RUOLO_STAFF_WHITELIST', id: '1561050593018249356' }, // staff whitelist: comandi whitelist
  direzione: { env: 'RUOLO_DIREZIONE', id: '1561444302989566063' }, // direzione: comandi direzione e candidature
  whitelistOk: { env: 'RUOLO_WHITELIST', id: '1561417095151886376' }, // ruolo dato a chi passa la whitelist
  nonWhitelist: { env: 'RUOLO_NON_WHITELIST', id: '1561417231957762262' }, // ruolo tolto quando passa la whitelist
};

const CANALI = {
  esitiWhitelist: { env: 'CANALE_ESITI_WHITELIST', id: '1561410860864503978' },
  convocazioniWl: { env: 'CANALE_CONVOCAZIONI_WL', id: '1561473889379295232' },
  moduliWhitelist: { env: 'CANALE_MODULI_WHITELIST', id: '1561410559432200273' },
  categoriaTicket: { env: 'CATEGORIA_TICKET', id: '1561475370585432145' },
  logTicket: { env: 'CANALE_LOG_TICKET', id: '1561409398700769463' },
  logWarn: { env: 'CANALE_LOG_WARN', id: '1561409728301637703' },
  logBan: { env: 'CANALE_LOG_BAN', id: '1561409728301637703' },
  logFazioni: { env: 'CANALE_WARN_FAZIONI', id: '1561409784559960105' },
  esitiAzioni: { env: 'CANALE_ESITI_AZIONI', id: '1561410357640171741' },
  logAssistenze: { env: 'CANALE_ASSISTENZE', id: '1561476371191169206' },
  logReport: { env: 'CANALE_REPORT', id: '1561476459954970664' },
  moduliDirezione: { env: 'CANALE_MODULI_DIREZIONE', id: '1561412640931061800' },
  candidatureStaff: { env: 'CANALE_CANDIDATURE_STAFF', id: '1561414390966788126' },
  candidatureTeamac: { env: 'CANALE_CANDIDATURE_TEAMAC', id: '1561414544260202516' },
  candidatureCreator: { env: 'CANALE_CANDIDATURE_CREATOR', id: '1561414668063481936' },
};

const risolvi = (tabella, key) => {
  const v = tabella[key];
  return { id: env(v.env) || v.id, env: v.env };
};

module.exports = {
  ruolo: (key) => risolvi(RUOLI, key),
  canale: (key) => risolvi(CANALI, key),
  RUOLI,
  CANALI,
};
