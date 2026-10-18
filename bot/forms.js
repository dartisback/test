// Moduli a finestra (whitelist, direzione, candidature): l'utente compila, lo staff accetta/rifiuta.
const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} = require('discord.js');
const cfg = require('./config');
const { EPH, COLORI, hasRole, postTo, dm, applicaWhitelist, riepilogo } = require('./util');

const FORMS = {
  whitelist: {
    title: 'Modulo Whitelist',
    canale: 'moduliWhitelist',
    reviewer: 'whitelistStaff',
    onAccept: (guild, userId) => applicaWhitelist(guild, userId),
    domande: [
      { label: 'Nome e cognome del personaggio' },
      { label: 'Età del personaggio' },
      { label: 'La tua età reale' },
      { label: 'Storia del personaggio', lungo: true },
      { label: 'Esperienza nel Roleplay', lungo: true },
    ],
  },
  direzione: {
    title: 'Modulo Direzione',
    canale: 'moduliDirezione',
    reviewer: 'direzione',
    domande: [
      { label: 'Nome e ruolo attuale nello staff' },
      { label: 'Esperienza precedente in direzione', lungo: true },
      { label: 'Perché vuoi entrare in direzione?', lungo: true },
      { label: 'Cosa porteresti al server?', lungo: true },
      { label: 'Disponibilità oraria' },
    ],
  },
  staff: {
    title: 'Candidatura Staff',
    canale: 'candidatureStaff',
    reviewer: 'direzione',
    domande: [
      { label: 'Nome e età' },
      { label: 'Esperienza staff precedente', lungo: true },
      { label: 'Perché vuoi entrare nello staff?', lungo: true },
      { label: 'Cosa faresti in caso di rissa in città?', lungo: true },
      { label: 'Disponibilità oraria' },
    ],
  },
  teamac: {
    title: 'Candidatura Team AC',
    canale: 'candidatureTeamac',
    reviewer: 'direzione',
    domande: [
      { label: 'Nome e età' },
      { label: 'Esperienza con anticheat/controlli', lungo: true },
      { label: 'Come riconosci un cheater?', lungo: true },
      { label: 'Perché vuoi entrare nel Team AC?', lungo: true },
      { label: 'Disponibilità oraria' },
    ],
  },
  creator: {
    title: 'Candidatura Creator',
    canale: 'candidatureCreator',
    reviewer: 'direzione',
    domande: [
      { label: 'Link al tuo canale (Twitch/YouTube/TikTok)' },
      { label: 'Spettatori/follower medi' },
      { label: 'Che contenuti fai?', lungo: true },
      { label: 'Con che frequenza trasmetti?' },
      { label: 'Perché vuoi essere Creator?', lungo: true },
    ],
  },
};

function buildModal(formId) {
  const f = FORMS[formId];
  const modal = new ModalBuilder().setCustomId(`formsubmit:${formId}`).setTitle(f.title);
  f.domande.forEach((q, i) => {
    modal.addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId(`q${i}`)
          .setLabel(q.label)
          .setStyle(q.lungo ? TextInputStyle.Paragraph : TextInputStyle.Short)
          .setRequired(true)
          .setMaxLength(q.lungo ? 1000 : 200),
      ),
    );
  });
  return modal;
}

// Comando /modulo...: apre direttamente la finestra da compilare
async function apri(interaction, formId) {
  const f = FORMS[formId];
  const { id, env } = cfg.canale(f.canale);
  if (!id) {
    return interaction.reply({ content: `❌ Modulo non ancora configurato: l'admin deve impostare ${env} nel file .env.`, flags: EPH });
  }
  return interaction.showModal(buildModal(formId));
}

async function onSubmit(i) {
  const formId = i.customId.split(':')[1];
  const f = FORMS[formId];
  if (!f) return;

  const embed = new EmbedBuilder()
    .setTitle(`📝 ${f.title}`)
    .setColor(COLORI.info)
    .setDescription(`Inviato da <@${i.user.id}> (${i.user.tag})`)
    .setThumbnail(i.user.displayAvatarURL())
    .setTimestamp();
  f.domande.forEach((q, n) => {
    embed.addFields({ name: q.label, value: i.fields.getTextInputValue(`q${n}`).slice(0, 1024) || '—' });
  });

  const rev = cfg.ruolo(f.reviewer);
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`form:accept:${formId}:${i.user.id}`).setLabel('Accetta').setStyle(ButtonStyle.Success).setEmoji('✅'),
    new ButtonBuilder().setCustomId(`form:reject:${formId}:${i.user.id}`).setLabel('Rifiuta').setStyle(ButtonStyle.Danger).setEmoji('❌'),
  );
  const res = await postTo(i.guild, f.canale, {
    content: rev.id ? `<@&${rev.id}>` : undefined,
    embeds: [embed],
    components: [row],
    allowedMentions: { roles: rev.id ? [rev.id] : [] },
  });
  await i.reply({
    content: res.ok ? `✅ **${f.title}** inviato! Lo staff lo valuterà il prima possibile.` : `❌ Non sono riuscito a inviare il modulo: ${res.why}`,
    flags: EPH,
  });
}

// Bottoni Accetta / Rifiuta
async function onButton(i) {
  const [, azione, formId, userId] = i.customId.split(':');
  const f = FORMS[formId];
  if (!f) return;
  if (!hasRole(i, f.reviewer)) {
    return i.reply({ content: '❌ Non puoi valutare questo modulo.', flags: EPH });
  }

  if (azione === 'reject') {
    const modal = new ModalBuilder().setCustomId(`formreject:${formId}:${userId}`).setTitle('Motivo del rifiuto');
    modal.addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder().setCustomId('motivo').setLabel('Motivo').setStyle(TextInputStyle.Paragraph).setRequired(true).setMaxLength(500),
      ),
    );
    return i.showModal(modal);
  }

  await i.deferUpdate();
  const embed = EmbedBuilder.from(i.message.embeds[0]).setColor(COLORI.ok).setFooter({ text: `✅ Accettata da ${i.user.tag}` });
  await i.message.edit({ embeds: [embed], components: [] });

  const note = f.onAccept ? await f.onAccept(i.guild, userId) : [];
  const user = await i.client.users.fetch(userId).catch(() => null);
  const inviato = user ? await dm(user, `✅ La tua richiesta **${f.title}** su Next Rome RP è stata **accettata**!`) : false;
  await i.followUp(riepilogo(`Accettata la richiesta di <@${userId}>`, [...note, inviato ? 'DM inviato' : 'DM non inviato (chiusi)']));
}

// Finestra col motivo del rifiuto
async function onRejectSubmit(i) {
  const [, formId, userId] = i.customId.split(':');
  const f = FORMS[formId];
  const motivo = i.fields.getTextInputValue('motivo');
  const embed = EmbedBuilder.from(i.message.embeds[0])
    .setColor(COLORI.no)
    .setFooter({ text: `❌ Rifiutata da ${i.user.tag}` })
    .addFields({ name: 'Motivo del rifiuto', value: motivo.slice(0, 1024) });
  await i.update({ embeds: [embed], components: [] });

  const user = await i.client.users.fetch(userId).catch(() => null);
  const inviato = user ? await dm(user, `❌ La tua richiesta **${f.title}** su Next Rome RP è stata **rifiutata**.\n**Motivo:** ${motivo}`) : false;
  await i.followUp(riepilogo(`Rifiutata la richiesta di <@${userId}>`, [inviato ? 'DM inviato' : 'DM non inviato (chiusi)']));
}

module.exports = { FORMS, apri, onSubmit, onButton, onRejectSubmit, buildModal };
