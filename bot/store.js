// Piccolo database su file (data/db.json): warn, ban, assistenze, report...
const fs = require('fs');
const path = require('path');

const DIR = path.join(__dirname, 'data');
const FILE = path.join(DIR, 'db.json');

function load() {
  try {
    return JSON.parse(fs.readFileSync(FILE, 'utf8'));
  } catch {
    return {};
  }
}

// update(fn): fn riceve il db, lo modifica; poi viene salvato. Ritorna il db aggiornato.
function update(fn) {
  const db = load();
  fn(db);
  fs.mkdirSync(DIR, { recursive: true });
  const tmp = FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(db, null, 1));
  fs.renameSync(tmp, FILE);
  return db;
}

// Inizio della settimana (lunedì 00:00)
function startOfWeek() {
  const d = new Date();
  const day = (d.getDay() + 6) % 7;
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - day);
  return d.getTime();
}

module.exports = { load, update, startOfWeek };
