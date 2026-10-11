try { process.loadEnvFile(); } catch { /* .env opzionale */ }

const path = require('path');
const crypto = require('crypto');
const express = require('express');
const cookieSession = require('cookie-session');
const store = require('./lib/store');
const discord = require('./lib/discord');

const PORT = Number(process.env.PORT) || 3000;
const ROLES = {
  owner: process.env.ROLE_OWNER,
  staff: process.env.ROLE_STAFF,
  user: process.env.ROLE_USER,
};
const DEV_LOGIN = process.env.DEV_LOGIN === '1';
const ROLE_RECHECK_MS = 60_000;
const POLL_STALE_MS = 15_000;

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '10kb' }));
app.use(
  cookieSession({
    name: 'flux_session',
    secret: process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex'),
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 7 * 24 * 3600e3,
  })
);
app.use((req, res, next) => {
  res.set({
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'same-origin',
  });
  next();
});

// ---------- util ----------
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

function roleFromIds(ids) {
  if (ids.includes(ROLES.owner)) return 'owner';
  if (ids.includes(ROLES.staff)) return 'staff';
  if (ids.includes(ROLES.user)) return 'user';
  return null;
}

const buckets = new Map();
function rateLimit(name, max, windowMs) {
  return (req, res, next) => {
    const k = `${name}:${req.ip}`;
    const now = Date.now();
    const b = (buckets.get(k) || []).filter((t) => now - t < windowMs);
    if (b.length >= max) return res.status(429).json({ error: 'Troppe richieste, riprova tra poco.' });
    b.push(now);
    buckets.set(k, b);
    next();
  };
}

// CSRF: le chiamate che modificano dati devono arrivare da fetch() dello stesso sito.
function csrf(req, res, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  if (req.path.startsWith('/api/fivem/')) return next(); // autenticato con la license, no cookie
  if (req.get('x-requested-with') !== 'fetch') return res.status(403).json({ error: 'Richiesta non valida' });
  next();
}
app.use(csrf);

// Carica l'utente dalla sessione e ri-verifica i ruoli Discord ogni minuto.
const loadUser = wrap(async (req, res, next) => {
  const u = req.session.user;
  if (!u) return next();
  if (!u.dev && Date.now() - u.checkedAt > ROLE_RECHECK_MS) {
    try {
      const member = await discord.fetchMemberRoles(u.id);
      const role = member && roleFromIds(member.roles);
      if (!role) {
        req.session = null;
        return next();
      }
      u.role = role;
      u.checkedAt = Date.now();
      req.session.user = u;
    } catch (e) {
      console.warn('[roles] ricontrollo fallito, uso ruolo in cache:', e.message);
    }
  }
  req.user = u;
  if (u.role === 'staff') store.ensureStaffKey(u.id); // la staff ha sempre una key lifetime
  next();
});
app.use(loadUser);

const requireAuth = (req, res, next) => (req.user ? next() : res.status(401).json({ error: 'Non autenticato' }));
const requireOwner = (req, res, next) =>
  req.user?.role === 'owner' ? next() : res.status(403).json({ error: 'Solo owner' });

// ---------- auth Discord ----------
app.get('/auth/discord', (req, res) => {
  if (!process.env.DISCORD_CLIENT_ID || !process.env.DISCORD_CLIENT_SECRET) {
    return res.redirect('/?error=discord_not_configured');
  }
  const state = crypto.randomBytes(16).toString('hex');
  req.session.oauthState = state;
  res.redirect(discord.authorizeUrl(state));
});

app.get(
  '/auth/discord/callback',
  wrap(async (req, res) => {
    const { code, state } = req.query;
    if (!code || !state || state !== req.session?.oauthState) return res.redirect('/?error=state');
    req.session.oauthState = null;
    try {
      const token = await discord.exchangeCode(String(code));
      const du = await discord.fetchUser(token.access_token);
      const member = await discord.fetchMemberRoles(du.id);
      if (!member) return res.redirect('/?error=not_in_guild');
      const role = roleFromIds(member.roles);
      if (!role) return res.redirect('/?error=no_role');
      const user = {
        id: du.id,
        username: member.nick || du.global_name || du.username,
        avatar: du.avatar ? `https://cdn.discordapp.com/avatars/${du.id}/${du.avatar}.png?size=128` : null,
        role,
        checkedAt: Date.now(),
      };
      store.upsertUser({ id: user.id, username: user.username, role });
      req.session.user = user;
      res.redirect('/');
    } catch (e) {
      console.error('[auth]', e.message);
      res.redirect('/?error=auth_failed');
    }
  })
);

// Login finto SOLO per provare il sito in locale senza app Discord (DEV_LOGIN=1).
if (DEV_LOGIN) {
  console.warn('⚠  DEV_LOGIN attivo: /auth/dev permette login senza Discord. Non usare in produzione.');
  app.get('/auth/dev', (req, res) => {
    if (!['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.socket.remoteAddress)) return res.sendStatus(403);
    const role = ['owner', 'staff', 'user'].includes(req.query.role) ? req.query.role : 'user';
    const user = { id: `dev-${role}`, username: `Dev ${role}`, avatar: null, role, checkedAt: Date.now(), dev: true };
    store.upsertUser({ id: user.id, username: user.username, role });
    req.session.user = user;
    res.redirect('/');
  });
}

app.post('/auth/logout', (req, res) => {
  req.session = null;
  res.json({ ok: true });
});

// ---------- API pubblica ----------
app.get('/api/health', (req, res) => {
  res.json({ online: true, servers: Object.keys(store.db().licenses).length });
});

app.get('/api/me', (req, res) => {
  if (!req.user) return res.json({ user: null, discordConfigured: !!process.env.DISCORD_CLIENT_ID, devLogin: DEV_LOGIN });
  const { id, username, avatar, role } = req.user;
  res.json({ user: { id, username, avatar, role }, devLogin: DEV_LOGIN });
});

// ---------- licenza dell'utente ----------
function describe(lic) {
  const connected = !!lic.lastPoll && Date.now() - lic.lastPoll < POLL_STALE_MS;
  return {
    ...store.publicLicense(lic),
    botList: lic.bots,
    pending: lic.queue.length,
    log: lic.log.slice(-30),
    connected,
  };
}

app.get('/api/license', requireAuth, (req, res) => {
  const lic = store.activeLicenseOf(req.user.id);
  const all = store.licensesOf(req.user.id).map(store.publicLicense);
  res.json({ license: lic ? describe(lic) : null, all });
});

app.post('/api/redeem', requireAuth, rateLimit('redeem', 10, 60_000), (req, res) => {
  const key = String(req.body?.key || '').trim().toUpperCase();
  try {
    const lic = store.redeem(key, req.user.id);
    res.json({ ok: true, license: store.publicLicense(lic) });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

const FIRST = ['Marco', 'Luca', 'Giorgio', 'Matteo', 'Andrea', 'Simone', 'Davide', 'Stefano', 'Alessio', 'Gabriele', 'Fede', 'Nico', 'Ale', 'Dani', 'Fra', 'Giulia', 'Sara', 'Chiara'];
const TAGS = ['RP', 'V', 'OFF', 'IT', 'Real', 'Pro', 'Gaming', 'YT', 'Drift', 'Boss', 'Wolf', 'Ghost'];
function generateNames(n) {
  const out = new Set();
  const pick = (a) => a[crypto.randomInt(a.length)];
  while (out.size < n) {
    const r = crypto.randomInt(4);
    const f = pick(FIRST);
    out.add(r === 0 ? `${f}_${pick(TAGS)}` : r === 1 ? `${f}${pick(TAGS)}${crypto.randomInt(10, 99)}` : r === 2 ? `xX${f}Xx` : `${f}.${crypto.randomInt(1, 999)}`);
  }
  return [...out];
}

app.get('/api/names', requireAuth, (req, res) => {
  const n = Math.min(Math.max(parseInt(req.query.count, 10) || 8, 1), 64);
  res.json({ names: generateNames(n) });
});

// Coda comandi: eseguiti al prossimo poll del server FiveM (~5s).
app.post('/api/license/cmd', requireAuth, rateLimit('cmd', 60, 60_000), (req, res) => {
  const lic = store.activeLicenseOf(req.user.id);
  if (!lic) return res.status(403).json({ error: 'Nessuna licenza attiva' });
  const b = req.body || {};
  let cmd;
  switch (b.cmd) {
    case 'add_bot': {
      const n = Math.floor(Number(b.count));
      if (!(n >= 1 && n <= lic.maxBots)) return res.status(400).json({ error: `Numero tra 1 e ${lic.maxBots}` });
      cmd = { cmd: 'add_bot', count: n };
      break;
    }
    case 'remove_bot': {
      const id = Math.floor(Number(b.id));
      if (!id) return res.status(400).json({ error: 'ID bot non valido' });
      cmd = { cmd: 'remove_bot', id };
      break;
    }
    case 'remove_all':
      cmd = { cmd: 'remove_all' };
      break;
    case 'set_names': {
      const names = String(b.names || '')
        .split(',')
        .map((s) => s.trim().replace(/[^\w .\-]/g, '').slice(0, 24))
        .filter(Boolean)
        .slice(0, 64);
      if (!names.length) return res.status(400).json({ error: 'Inserisci almeno un nome' });
      cmd = { cmd: 'set_names', names };
      break;
    }
    default:
      return res.status(400).json({ error: 'Comando sconosciuto' });
  }
  if (lic.queue.length >= 50) return res.status(429).json({ error: 'Coda piena, attendi il prossimo poll' });
  lic.queue.push(cmd);
  store.save();
  res.json({ ok: true, license: describe(lic) });
});

// ---------- admin (solo owner) ----------
app.get('/api/admin/licenses', requireAuth, requireOwner, (req, res) => {
  const users = store.db().users;
  const list = Object.values(store.db().licenses)
    .sort((a, b) => b.createdAt - a.createdAt)
    .map((l) => ({ ...store.publicLicense(l), redeemedByName: l.redeemedBy ? users[l.redeemedBy]?.username || l.redeemedBy : null, note: l.note }));
  res.json({ licenses: list });
});

app.post('/api/admin/licenses', requireAuth, requireOwner, (req, res) => {
  const { type, note } = req.body || {};
  const count = Math.min(Math.max(parseInt(req.body?.count, 10) || 1, 1), 50);
  if (!['day', 'week', 'lifetime'].includes(type)) return res.status(400).json({ error: 'Tipo non valido (day, week, lifetime)' });
  const created = [];
  for (let i = 0; i < count; i++) created.push(store.publicLicense(store.createLicense({ type, note, createdBy: req.user.id })));
  res.json({ ok: true, licenses: created });
});

app.delete('/api/admin/licenses/:key', requireAuth, requireOwner, (req, res) => {
  res.json({ ok: store.deleteLicense(String(req.params.key).toUpperCase()) });
});

// ---------- endpoint per la risorsa sul server FiveM ----------
// Il server FiveM chiama questo endpoint ogni ~5s con la license; riceve i comandi in coda
// e riporta quanti giocatori sono attivi.
function applyCommand(lic, c) {
  const log = (m) => lic.log.push({ t: Date.now(), m });
  if (c.cmd === 'add_bot') {
    const room = lic.maxBots - lic.bots.length;
    const n = Math.min(c.count, room);
    const names = generateNames(n);
    for (let i = 0; i < n; i++) lic.bots.push({ id: lic.nextBotId++, name: lic.customNames?.length ? lic.customNames[crypto.randomInt(lic.customNames.length)] + crypto.randomInt(1, 99) : names[i] });
    log(`add_bot ${c.count} → +${n}${n < c.count ? ' (limite licenza)' : ''}`);
  } else if (c.cmd === 'remove_bot') {
    const before = lic.bots.length;
    lic.bots = lic.bots.filter((b) => b.id !== c.id);
    log(`remove_bot ${c.id} → ${before - lic.bots.length ? 'ok' : 'non trovato'}`);
  } else if (c.cmd === 'remove_all') {
    log(`remove_all → -${lic.bots.length}`);
    lic.bots = [];
  } else if (c.cmd === 'set_names') {
    lic.customNames = c.names;
    lic.bots.forEach((b, i) => (b.name = c.names[i % c.names.length] + (i >= c.names.length ? crypto.randomInt(1, 99) : '')));
    log(`set_names ${c.names.length} nomi applicati`);
  }
  lic.log = lic.log.slice(-100);
}

function processQueue(lic) {
  const cmds = lic.queue.splice(0);
  cmds.forEach((c) => applyCommand(lic, c));
  if (cmds.length) store.save();
  return cmds;
}

app.post('/api/fivem/poll', rateLimit('poll', 60, 60_000), (req, res) => {
  const key = String(req.get('x-license') || req.body?.license || '').trim().toUpperCase();
  const lic = store.db().licenses[key];
  if (!lic || !lic.redeemedBy || store.isExpired(lic)) return res.status(403).json({ error: 'Licenza non valida' });
  lic.lastPoll = Date.now();
  const commands = processQueue(lic);
  res.json({ ok: true, commands, bots: lic.bots, max: lic.maxBots });
});

// Su localhost non c'è un server FiveM vero: se nessuno fa poll da >15s,
// simula il poll ogni 5s così la dashboard mostra l'effetto dei comandi.
setInterval(() => {
  for (const lic of Object.values(store.db().licenses)) {
    if (lic.queue.length && (!lic.lastPoll || Date.now() - lic.lastPoll > POLL_STALE_MS)) processQueue(lic);
  }
}, 5000).unref();

// ---------- pagine ----------
const pub = path.join(__dirname, 'public');
app.get('/dashboard', (req, res) => (req.user ? res.sendFile(path.join(pub, 'dashboard.html')) : res.redirect('/')));
app.use(express.static(pub, { index: 'index.html' }));

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Errore interno' });
});

app.listen(PORT, () => {
  console.log(`FLUX BOT ITA → ${process.env.BASE_URL || `http://localhost:${PORT}`}`);
  if (!process.env.DISCORD_CLIENT_ID || !process.env.DISCORD_CLIENT_SECRET)
    console.warn('⚠  DISCORD_CLIENT_ID / DISCORD_CLIENT_SECRET mancanti nel .env: il login Discord non funzionerà.');
  if (!process.env.DISCORD_BOT_TOKEN) console.warn('⚠  DISCORD_BOT_TOKEN mancante: impossibile leggere i ruoli.');
});
