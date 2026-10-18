const { SlashCommandBuilder, ChannelType } = require('discord.js');
const { COLORI, needRole, postTo, dm, riepilogo, applicaWhitelist, embed } = require('../util');
const forms = require('../forms');

const whitelistaccettata = {
  data: new SlashCommandBuilder()
    .setName('whitelistaccettata')
    .setDescription('Accetta la whitelist di un giocatore')
    .addUserOption((o) => o.setName('utente').setDescription('Il giocatore').setRequired(true))
    .addStringOption((o) => o.setName('note').setDescription('Note facoltative per il giocatore')),
  async run(i) {
    if (!(await needRole(i, 'whitelistStaff'))) return;
    await i.deferReply({ flags: 64 });
    const user = i.options.getUser('utente');
    const note = i.options.getString('note');

    const righe = await applicaWhitelist(i.guild, user.id);
    const e = embed('✅ Whitelist ACCETTATA', COLORI.ok, `<@${user.id}> ha superato la whitelist di **Next Rome RP**! Benvenuto in città 🎉`)
      .addFields({ name: 'Staff', value: `<@${i.user.id}>`, inline: true });
    if (note) e.addFields({ name: 'Note', value: note });

    const post = await postTo(i.guild, 'esitiWhitelist', { content: `<@${user.id}>`, embeds: [e], allowedMentions: { users: [user.id] } });
    righe.push(post.ok ? 'esito pubblicato' : `⚠️ esito non pubblicato: ${post.why}`);
    righe.push((await dm(user, { embeds: [e] })) ? 'DM inviato' : 'DM non inviato (chiusi)');
    await i.editReply(riepilogo(`Whitelist accettata per <@${user.id}>`, righe));
  },
};

const whitelistrimandata = {
  data: new SlashCommandBuilder()
    .setName('whitelistrimandata')
    .setDescription('Rimanda la whitelist di un giocatore')
    .addUserOption((o) => o.setName('utente').setDescription('Il giocatore').setRequired(true))
    .addStringOption((o) => o.setName('motivo').setDescription('Perché viene rimandata').setRequired(true)),
  async run(i) {
    if (!(await needRole(i, 'whitelistStaff'))) return;
    await i.deferReply({ flags: 64 });
    const user = i.options.getUser('utente');
    const motivo = i.options.getString('motivo');

    const e = embed('🔁 Whitelist RIMANDATA', COLORI.no, `<@${user.id}> la tua whitelist è stata **rimandata**. Puoi riprovare dopo aver sistemato quanto indicato.`)
      .addFields({ name: 'Motivo', value: motivo }, { name: 'Staff', value: `<@${i.user.id}>`, inline: true });

    const righe = [];
    const post = await postTo(i.guild, 'esitiWhitelist', { content: `<@${user.id}>`, embeds: [e], allowedMentions: { users: [user.id] } });
    righe.push(post.ok ? 'esito pubblicato' : `⚠️ esito non pubblicato: ${post.why}`);
    righe.push((await dm(user, { embeds: [e] })) ? 'DM inviato' : 'DM non inviato (chiusi)');
    await i.editReply(riepilogo(`Whitelist rimandata a <@${user.id}>`, righe));
  },
};

const convocanowl = {
  data: new SlashCommandBuilder()
    .setName('convocanowl')
    .setDescription('Convoca un giocatore per il colloquio whitelist')
    .addUserOption((o) => o.setName('utente').setDescription('Il giocatore da convocare').setRequired(true))
    .addStringOption((o) => o.setName('quando').setDescription('Data e ora del colloquio (es. oggi alle 21:30)'))
    .addChannelOption((o) =>
      o.setName('stanza').setDescription('Stanza vocale del colloquio').addChannelTypes(ChannelType.GuildVoice, ChannelType.GuildStageVoice),
    ),
  async run(i) {
    if (!(await needRole(i, 'whitelistStaff'))) return;
    await i.deferReply({ flags: 64 });
    const user = i.options.getUser('utente');
    const quando = i.options.getString('quando');
    const stanza = i.options.getChannel('stanza');

    const e = embed('📞 Convocazione Whitelist', COLORI.viola, `<@${user.id}> sei stato **convocato** per il colloquio whitelist di **Next Rome RP**.`)
      .addFields({ name: 'Quando', value: quando ?? 'Appena possibile', inline: true }, { name: 'Dove', value: stanza ? `${stanza}` : 'Attesa whitelist', inline: true })
      .addFields({ name: 'Staff', value: `<@${i.user.id}>`, inline: true });

    const righe = [];
    const post = await postTo(i.guild, 'convocazioniWl', { content: `<@${user.id}>`, embeds: [e], allowedMentions: { users: [user.id] } });
    righe.push(post.ok ? 'convocazione pubblicata' : `⚠️ convocazione non pubblicata: ${post.why}`);
    righe.push((await dm(user, { embeds: [e] })) ? 'DM inviato' : 'DM non inviato (chiusi)');
    await i.editReply(riepilogo(`Convocato <@${user.id}>`, righe));
  },
};

const modulowl = {
  data: new SlashCommandBuilder().setName('modulowl').setDescription('Compila il modulo per la whitelist'),
  run: (i) => forms.apri(i, 'whitelist'),
};

module.exports = [whitelistaccettata, whitelistrimandata, convocanowl, modulowl];
