// Mini database su file JSON (scrittura atomica). Sufficiente per localhost.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const FILE = path.join(__dirname, '..', 'data', 'db.json');
const MAX_BOTS = 64;
const DURATIONS = { day: 24 * 3600e3, week: 7 * 24 * 3600e3, lifetime: null };

let db = { licenses: {}, users: {} };
try {
  db = JSON.parse(fs.readFileSync(FILE, 'utf8'));
} catch {
  /* primo avvio */
}

function save() {
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  const tmp = FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(db, null, 2));
  fs.renameSync(tmp, FILE);
}

function randomKey() {
  const part = () => crypto.randomBytes(2).toString('hex').toUpperCase();
  return `FLUX-${part()}-${part()}-${part()}-${part()}`;
}

function isExpired(lic) {
  return !!lic.expiresAt && lic.expiresAt <= Date.now();
}

function publicLicense(lic) {
  return {
    key: lic.key,
    type: lic.type,
    createdAt: lic.createdAt,
    createdBy: lic.createdBy,
    redeemedBy: lic.redeemedBy,
    redeemedAt: lic.redeemedAt,
    expiresAt: lic.expiresAt,
    expired: isExpired(lic),
    staffKey: !!lic.staffKey,
    bots: lic.bots.length,
    maxBots: lic.maxBots,
  };
}

function createLicense({ type, createdBy, staffKey = false, redeemedBy = null, note = '' }) {
  if (!(type in DURATIONS)) throw new Error('Tipo licenza non valido');
  const lic = {
    key: randomKey(),
    type,
    createdAt: Date.now(),
    createdBy,
    note: String(note).slice(0, 80),
    staffKey,
    redeemedBy,
    redeemedAt: redeemedBy ? Date.now() : null,
    // day/week partono dal riscatto; lifetime non scade mai
    expiresAt: redeemedBy && DURATIONS[type] ? Date.now() + DURATIONS[type] : null,
    maxBots: MAX_BOTS,
    bots: [], // [{ id, name }]
    queue: [], // comandi in attesa del prossimo poll del server FiveM
    log: [],
    lastPoll: null,
    nextBotId: 100001,
  };
  db.licenses[lic.key] = lic;
  save();
  return lic;
}

function redeem(key, userId) {
  const lic = db.licenses[key];
  if (!lic) throw new Error('Licenza non trovata');
  if (lic.redeemedBy) throw new Error('Licenza già riscattata');
  lic.redeemedBy = userId;
  lic.redeemedAt = Date.now();
  lic.expiresAt = DURATIONS[lic.type] ? Date.now() + DURATIONS[lic.type] : null;
  save();
  return lic;
}

function deleteLicense(key) {
  if (!db.licenses[key]) return false;
  delete db.licenses[key];
  save();
  return true;
}

function licensesOf(userId) {
  return Object.values(db.licenses).filter((l) => l.redeemedBy === userId);
}

// La licenza "attiva" di un utente: staff key o la più lunga non scaduta.
function activeLicenseOf(userId) {
  const list = licensesOf(userId).filter((l) => !isExpired(l));
  list.sort((a, b) => (b.expiresAt ?? Infinity) - (a.expiresAt ?? Infinity));
  return list[0] || null;
}

function ensureStaffKey(userId) {
  const existing = Object.values(db.licenses).find((l) => l.staffKey && l.redeemedBy === userId);
  return existing || createLicense({ type: 'lifetime', createdBy: 'system', staffKey: true, redeemedBy: userId });
}

function upsertUser(u) {
  db.users[u.id] = { ...(db.users[u.id] || {}), ...u, lastLogin: Date.now() };
  save();
}

module.exports = {
  db: () => db,
  save,
  MAX_BOTS,
  isExpired,
  publicLicense,
  createLicense,
  redeem,
  deleteLicense,
  licensesOf,
  activeLicenseOf,
  ensureStaffKey,
  upsertUser,
};
