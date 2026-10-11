const API = 'https://discord.com/api/v10';

const cfg = () => ({
  clientId: process.env.DISCORD_CLIENT_ID,
  clientSecret: process.env.DISCORD_CLIENT_SECRET,
  botToken: process.env.DISCORD_BOT_TOKEN,
  guildId: process.env.DISCORD_GUILD_ID,
  baseUrl: process.env.BASE_URL || 'http://localhost:3000',
});

const redirectUri = () => `${cfg().baseUrl}/auth/discord/callback`;

function authorizeUrl(state) {
  const p = new URLSearchParams({
    client_id: cfg().clientId,
    redirect_uri: redirectUri(),
    response_type: 'code',
    scope: 'identify',
    state,
    prompt: 'none',
  });
  return `https://discord.com/oauth2/authorize?${p}`;
}

async function exchangeCode(code) {
  const c = cfg();
  const res = await fetch(`${API}/oauth2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: c.clientId,
      client_secret: c.clientSecret,
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri(),
    }),
  });
  if (!res.ok) throw new Error(`Discord token exchange fallito (${res.status})`);
  return res.json();
}

async function fetchUser(accessToken) {
  const res = await fetch(`${API}/users/@me`, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!res.ok) throw new Error(`Discord /users/@me fallito (${res.status})`);
  return res.json();
}

// Ruoli del membro nella guild, letti con il token del bot.
// Ritorna null se l'utente non è nel server. Lancia in caso di errore di rete/permessi.
async function fetchMemberRoles(userId) {
  const c = cfg();
  const res = await fetch(`${API}/guilds/${c.guildId}/members/${userId}`, {
    headers: { Authorization: `Bot ${c.botToken}` },
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Lettura membro fallita (${res.status}). Il bot è nel server con l'intent "Server Members"?`);
  const m = await res.json();
  return { roles: m.roles || [], nick: m.nick || null };
}

module.exports = { authorizeUrl, exchangeCode, fetchUser, fetchMemberRoles, redirectUri };
