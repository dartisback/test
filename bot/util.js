const { EmbedBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const cfg = require('./config');

const EPH = MessageFlags.Ephemeral;
const COLORI = { ok: 0x2ecc71, no: 0xe74c3c, warn: 0xf1c40f, info: 0x3498db, ban: 0x992d22, viola: 0x9b59b6 };

function hasRole(interaction, roleKey) {
  const m = interaction.member;
  if (m.permissions.has(PermissionFlagsBits.Administrator)) return true;
  const { id } = cfg.ruolo(roleKey);
  return !!id && m.roles.cache.has(id);
}

// Risponde con un errore e ritorna false se l'utente non ha il ruolo richiesto
async function needRole(interaction, roleKey) {
  if (hasRole(interaction, roleKey)) return true;
  const { id, env } = cfg.ruolo(roleKey);
  await interaction.reply({
    content: id
      ? `❌ Non hai il permesso per usare questo comando (serve <@&${id}>).`
      : `❌ Comando non ancora configurato: l'admin deve impostare ${env} nel file .env.`,
    flags: EPH,
  });
  return false;
}

// Scrive in un canale configurato. Ritorna {ok, message} oppure {ok:false, why}
async function postTo(guild, key, payload) {
  const { id, env } = cfg.canale(key);
  if (!id) return { ok: false, why: `manca ${env} nel file .env` };
  try {
    const ch = await guild.channels.fetch(id);
    return { ok: true, message: await ch.send(payload) };
  } catch (e) {
    return { ok: false, why: `non riesco a scrivere nel canale ${env} (${e.message})` };
  }
}

async function dm(user, payload) {
  try {
    await user.send(payload);
    return true;
  } catch {
    return false;
  }
}

// Risposta finale (privata) con l'elenco di quello che è successo
function riepilogo(titolo, righe) {
  return { content: `${titolo}\n${righe.map((r) => `• ${r}`).join('\n')}`, flags: EPH };
}

// Dà il ruolo whitelist (e toglie quello "non whitelist"). Ritorna le righe di esito.
async function applicaWhitelist(guild, userId) {
  const out = [];
  const ok = cfg.ruolo('whitelistOk');
  const no = cfg.ruolo('nonWhitelist');
  if (!ok.id) return [`⚠️ ruolo whitelist non assegnato: manca ${ok.env} nel file .env`];
  try {
    const member = await guild.members.fetch(userId);
    await member.roles.add(ok.id, 'Whitelist accettata');
    out.push(`ruolo <@&${ok.id}> assegnato`);
    if (no.id && member.roles.cache.has(no.id)) {
      await member.roles.remove(no.id, 'Whitelist accettata');
      out.push(`ruolo <@&${no.id}> rimosso`);
    }
  } catch (e) {
    out.push(`⚠️ non sono riuscito a gestire i ruoli (${e.message}) — il ruolo del bot deve stare sopra ai ruoli whitelist`);
  }
  return out;
}

function embed(titolo, colore, descrizione) {
  return new EmbedBuilder().setTitle(titolo).setColor(colore).setDescription(descrizione ?? null).setTimestamp();
}

module.exports = { EPH, COLORI, hasRole, needRole, postTo, dm, riepilogo, applicaWhitelist, embed };
