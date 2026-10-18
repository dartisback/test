// Sistema ticket: pannello con bottoni, canale privato per ogni ticket, chiusura con trascrizione
const {
  ActionRowBuilder,
  AttachmentBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  EmbedBuilder,
  PermissionFlagsBits,
} = require('discord.js');
const cfg = require('./config');
const { EPH, COLORI, hasRole, postTo } = require('./util');

const TIPI = {
  assistenza: { nome: 'Assistenza', emoji: '🎫', descrizione: 'Hai bisogno di aiuto dallo staff.' },
  report: { nome: 'Report giocatore', emoji: '🚨', descrizione: 'Vuoi segnalare un giocatore (porta prove!).' },
};

function pannello() {
  const embed = new EmbedBuilder()
    .setTitle('🎫 Assistenza – Next Rome RP')
    .setColor(COLORI.info)
    .setDescription(
      Object.values(TIPI).map((t) => `${t.emoji} **${t.nome}** — ${t.descrizione}`).join('\n') +
        '\n\nPremi il bottone giusto per aprire un ticket privato con lo staff.',
    );
  const row = new ActionRowBuilder().addComponents(
    ...Object.entries(TIPI).map(([k, t]) =>
      new ButtonBuilder().setCustomId(`ticket:open:${k}`).setLabel(t.nome).setEmoji(t.emoji).setStyle(ButtonStyle.Primary),
    ),
  );
  return { embeds: [embed], components: [row] };
}

async function apri(i, tipo) {
  const t = TIPI[tipo];
  if (!t) return;
  const guild = i.guild;
  const marker = `ticket:${i.user.id}:${tipo}`;

  const esistente = guild.channels.cache.find((c) => c.type === ChannelType.GuildText && c.topic === marker);
  if (esistente) {
    return i.reply({ content: `Hai già un ticket aperto: ${esistente}`, flags: EPH });
  }

  const ruolo = cfg.ruolo('assistenza');
  const categoria = cfg.canale('categoriaTicket').id || null;
  const permessi = [
    { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
    {
      id: i.user.id,
      allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.AttachFiles],
    },
    {
      id: i.client.user.id,
      allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageChannels, PermissionFlagsBits.ReadMessageHistory],
    },
  ];
  if (ruolo.id) {
    permessi.push({
      id: ruolo.id,
      allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.AttachFiles],
    });
  }

  let canale;
  try {
    canale = await guild.channels.create({
      name: `${tipo}-${i.user.username}`.toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 90) || `${tipo}-ticket`,
      type: ChannelType.GuildText,
      parent: categoria,
      topic: marker,
      permissionOverwrites: permessi,
    });
  } catch (e) {
    return i.reply({ content: `❌ Non riesco a creare il ticket (${e.message}). Avvisa lo staff.`, flags: EPH });
  }

  const embed = new EmbedBuilder()
    .setTitle(`${t.emoji} ${t.nome}`)
    .setColor(COLORI.ok)
    .setDescription(`Ciao <@${i.user.id}>, descrivi il problema: lo staff ti risponderà a breve.`);
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('ticket:close').setLabel('Chiudi ticket').setEmoji('🔒').setStyle(ButtonStyle.Danger),
  );
  await canale.send({
    content: `<@${i.user.id}>${ruolo.id ? ` <@&${ruolo.id}>` : ''}`,
    embeds: [embed],
    components: [row],
    allowedMentions: { users: [i.user.id], roles: ruolo.id ? [ruolo.id] : [] },
  });
  await i.reply({ content: `✅ Ticket aperto: ${canale}`, flags: EPH });
}

async function trascrizione(canale) {
  const righe = [];
  let before;
  for (let n = 0; n < 10; n++) {
    const batch = await canale.messages.fetch({ limit: 100, before });
    if (!batch.size) break;
    righe.push(...batch.values());
    before = batch.last().id;
  }
  righe.reverse();
  return righe
    .map((m) => {
      const allegati = m.attachments.size ? ` [allegati: ${[...m.attachments.values()].map((a) => a.url).join(', ')}]` : '';
      return `[${m.createdAt.toLocaleString('it-IT')}] ${m.author.tag}: ${m.content}${allegati}`;
    })
    .join('\n');
}

async function chiudi(i) {
  const canale = i.channel;
  const [, openerId, tipo] = (canale.topic || '').split(':');
  if (!openerId) return;
  if (i.user.id !== openerId && !hasRole(i, 'assistenza')) {
    return i.reply({ content: '❌ Solo chi ha aperto il ticket o lo staff può chiuderlo.', flags: EPH });
  }
  await i.reply({ content: '🔒 Ticket in chiusura tra 5 secondi...' });

  try {
    const testo = await trascrizione(canale);
    const file = new AttachmentBuilder(Buffer.from(testo || '(nessun messaggio)', 'utf8'), { name: `${canale.name}.txt` });
    await postTo(i.guild, 'logTicket', {
      embeds: [
        new EmbedBuilder()
          .setTitle('🔒 Ticket chiuso')
          .setColor(COLORI.warn)
          .addFields(
            { name: 'Tipo', value: TIPI[tipo]?.nome ?? tipo, inline: true },
            { name: 'Aperto da', value: `<@${openerId}>`, inline: true },
            { name: 'Chiuso da', value: `<@${i.user.id}>`, inline: true },
          )
          .setTimestamp(),
      ],
      files: [file],
    });
  } catch (e) {
    console.error('Trascrizione ticket fallita:', e.message);
  }
  setTimeout(() => canale.delete('Ticket chiuso').catch(() => {}), 5_000);
}

async function onButton(i) {
  const [, azione, tipo] = i.customId.split(':');
  if (azione === 'open') return apri(i, tipo);
  if (azione === 'close') return chiudi(i);
}

module.exports = { pannello, onButton };
