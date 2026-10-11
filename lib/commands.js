// Slash command del bot: /crealicense e /rimuovilicense (solo ruoli abilitati).
const store = require('./store');

const API = 'https://discord.com/api/v10';
const TYPES = [
  { name: 'Day (24 ore)', value: 'day' },
  { name: 'Week (7 giorni)', value: 'week' },
  { name: 'Lifetime', value: 'lifetime' },
];
const LABEL = { day: 'Day (24h)', week: 'Week (7 giorni)', lifetime: 'Lifetime' };

const DEFINITIONS = [
  {
    name: 'crealicense',
    description: 'Crea una licenza FLUX BOT ITA (staff / owner)',
    dm_permission: false,
    options: [
      { type: 3, name: 'tipo', description: 'Durata della licenza', required: true, choices: TYPES },
      { type: 4, name: 'quantita', description: 'Quante licenze creare (1-10)', min_value: 1, max_value: 10 },
      { type: 6, name: 'utente', description: 'Assegnala subito a questo utente (attiva subito)' },
    ],
  },
  {
    name: 'rimuovilicense',
    description: 'Elimina una licenza FLUX BOT ITA (staff / owner)',
    dm_permission: false,
    options: [{ type: 3, name: 'chiave', description: 'Chiave da eliminare (FLUX-XXXX-XXXX-XXXX-XXXX)', required: true }],
  },
];

const allowedRoleIds = () => {
  const names = (process.env.COMMAND_ROLES || 'owner,staff').split(',').map((s) => s.trim().toLowerCase());
  const map = { owner: process.env.ROLE_OWNER, staff: process.env.ROLE_STAFF, user: process.env.ROLE_USER };
  return names.map((n) => map[n]).filter(Boolean);
};

async function registerCommands(appId, guildId, token) {
  const res = await fetch(`${API}/applications/${appId}/guilds/${guildId}/commands`, {
    method: 'PUT',
    headers: { Authorization: `Bot ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(DEFINITIONS),
  });
  if (res.ok) return console.log('✅ Comandi registrati: /crealicense, /rimuovilicense');
  const body = await res.text();
  console.error(`❌ Registrazione comandi fallita (${res.status}): ${body}`);
  if (res.status === 403 || res.status === 404)
    console.error(`   Il bot va re-invitato con lo scope "applications.commands":\n   https://discord.com/oauth2/authorize?client_id=${appId}&scope=bot%20applications.commands&permissions=0`);
}

const reply = (i, content) =>
  fetch(`${API}/interactions/${i.id}/${i.token}/callback`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 4, data: { content, flags: 64 } }), // 64 = visibile solo a chi esegue il comando
  });

async function handleInteraction(i) {
  if (i.type !== 2 || !['crealicense', 'rimuovilicense'].includes(i.data?.name)) return;
  if (i.guild_id !== process.env.DISCORD_GUILD_ID) return reply(i, '❌ Comando non disponibile in questo server.');

  const roles = i.member?.roles || [];
  if (!allowedRoleIds().some((r) => roles.includes(r))) return reply(i, '⛔ Non hai il permesso di usare questo comando.');

  const opt = Object.fromEntries((i.data.options || []).map((o) => [o.name, o.value]));
  const actor = i.member.user?.id || i.user?.id;

  if (i.data.name === 'crealicense') {
    if (!['day', 'week', 'lifetime'].includes(opt.tipo)) return reply(i, '❌ Tipo non valido.');
    const n = Math.min(Math.max(opt.quantita || 1, 1), 10);
    let target = null;
    if (opt.utente) {
      const u = i.data.resolved?.users?.[opt.utente];
      target = { id: opt.utente, name: u?.global_name || u?.username || opt.utente };
      store.upsertUser({ id: target.id, username: target.name });
    }
    const keys = [];
    for (let k = 0; k < n; k++)
      keys.push(store.createLicense({ type: opt.tipo, createdBy: actor, redeemedBy: target?.id || null }).key);
    const where = target
      ? `assegnate e **già attive** per <@${target.id}>`
      : 'libere: l\'utente le riscatta dal sito (menu → Attiva licenza)';
    return reply(i, `✅ ${n} licenza/e **${LABEL[opt.tipo]}** creata/e, ${where}:\n${keys.map((k) => `\`${k}\``).join('\n')}`);
  }

  const key = String(opt.chiave || '').trim().toUpperCase();
  const lic = store.db().licenses[key];
  if (!lic) return reply(i, `❌ Licenza \`${key}\` non trovata.`);
  store.deleteLicense(key);
  return reply(i, `🗑 Licenza \`${key}\` (${LABEL[lic.type]}) eliminata${lic.redeemedBy ? ` — era di <@${lic.redeemedBy}>` : ''}.`);
}

module.exports = { registerCommands, handleInteraction };
