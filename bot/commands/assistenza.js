const { SlashCommandBuilder } = require('discord.js');
const { COLORI, EPH, needRole, postTo, dm, riepilogo, embed } = require('../util');
const store = require('../store');
const tickets = require('../tickets');

const chiaveGiocatore = (s) => s.trim().toLowerCase();

const ticketpanel = {
  data: new SlashCommandBuilder().setName('ticketpanel').setDescription('Pubblica il pannello per aprire i ticket'),
  async run(i) {
    if (!(await needRole(i, 'assistenza'))) return;
    await i.channel.send(tickets.pannello());
    await i.reply({ content: '✅ Pannello ticket pubblicato.', flags: EPH });
  },
};

const warnplayer = {
  data: new SlashCommandBuilder()
    .setName('warnplayer')
    .setDescription('Dai un warn a un giocatore')
    .addStringOption((o) => o.setName('giocatore').setDescription('Nome o ID in-game del giocatore').setRequired(true))
    .addStringOption((o) => o.setName('motivo').setDescription('Motivo del warn').setRequired(true))
    .addUserOption((o) => o.setName('utente').setDescription('Il suo account Discord (riceve un DM)')),
  async run(i) {
    if (!(await needRole(i, 'assistenza'))) return;
    await i.deferReply({ flags: EPH });
    const giocatore = i.options.getString('giocatore');
    const motivo = i.options.getString('motivo');
    const utente = i.options.getUser('utente');

    let totale = 0;
    store.update((db) => {
      db.warns ??= {};
      const lista = (db.warns[chiaveGiocatore(giocatore)] ??= []);
      lista.push({ motivo, staff: i.user.id, ts: Date.now() });
      totale = lista.length;
    });

    const e = embed('⚠️ WARN Giocatore', COLORI.warn)
      .addFields(
        { name: 'Giocatore', value: giocatore, inline: true },
        { name: 'Warn totali', value: `${totale}`, inline: true },
        { name: 'Staff', value: `<@${i.user.id}>`, inline: true },
        { name: 'Motivo', value: motivo },
      );
    if (utente) e.addFields({ name: 'Discord', value: `<@${utente.id}>` });

    const righe = [`warn registrato (totale ${totale})`];
    if (totale >= 3) righe.push(`🚨 **${giocatore}** ha raggiunto ${totale} warn`);
    const post = await postTo(i.guild, 'logWarn', { embeds: [e] });
    righe.push(post.ok ? 'pubblicato nel log' : `⚠️ log non pubblicato: ${post.why}`);
    if (utente) righe.push((await dm(utente, { embeds: [e] })) ? 'DM inviato' : 'DM non inviato (chiusi)');
    await i.editReply(riepilogo(`Warn a ${giocatore}`, righe));
  },
};

const banplayer = {
  data: new SlashCommandBuilder()
    .setName('banplayer')
    .setDescription('Registra il ban di un giocatore')
    .addStringOption((o) => o.setName('giocatore').setDescription('Nome o ID in-game del giocatore').setRequired(true))
    .addStringOption((o) => o.setName('motivo').setDescription('Motivo del ban').setRequired(true))
    .addStringOption((o) => o.setName('durata').setDescription('Durata (es. 7 giorni, permanente)'))
    .addUserOption((o) => o.setName('utente').setDescription('Il suo account Discord (riceve un DM)')),
  async run(i) {
    if (!(await needRole(i, 'assistenza'))) return;
    await i.deferReply({ flags: EPH });
    const giocatore = i.options.getString('giocatore');
    const motivo = i.options.getString('motivo');
    const durata = i.options.getString('durata') ?? 'Permanente';
    const utente = i.options.getUser('utente');

    store.update((db) => {
      db.bans ??= {};
      (db.bans[chiaveGiocatore(giocatore)] ??= []).push({ motivo, durata, staff: i.user.id, ts: Date.now() });
    });

    const e = embed('🔨 BAN Giocatore', COLORI.ban)
      .addFields(
        { name: 'Giocatore', value: giocatore, inline: true },
        { name: 'Durata', value: durata, inline: true },
        { name: 'Staff', value: `<@${i.user.id}>`, inline: true },
        { name: 'Motivo', value: motivo },
      );
    if (utente) e.addFields({ name: 'Discord', value: `<@${utente.id}>` });

    const righe = ['ban registrato', 'ℹ️ il ban sul server FiveM va applicato a parte (il bot registra e annuncia)'];
    const post = await postTo(i.guild, 'logBan', { embeds: [e] });
    righe.push(post.ok ? 'pubblicato nel log' : `⚠️ log non pubblicato: ${post.why}`);
    if (utente) righe.push((await dm(utente, { embeds: [e] })) ? 'DM inviato' : 'DM non inviato (chiusi)');
    await i.editReply(riepilogo(`Ban a ${giocatore}`, righe));
  },
};

const warnfazioni = {
  data: new SlashCommandBuilder()
    .setName('warnfazioni')
    .setDescription('Dai un warn a una fazione')
    .addStringOption((o) => o.setName('fazione').setDescription('Nome della fazione').setRequired(true))
    .addStringOption((o) => o.setName('motivo').setDescription('Motivo del warn').setRequired(true)),
  async run(i) {
    if (!(await needRole(i, 'assistenza'))) return;
    await i.deferReply({ flags: EPH });
    const fazione = i.options.getString('fazione');
    const motivo = i.options.getString('motivo');

    let totale = 0;
    store.update((db) => {
      db.warnFazioni ??= {};
      const lista = (db.warnFazioni[chiaveGiocatore(fazione)] ??= []);
      lista.push({ motivo, staff: i.user.id, ts: Date.now() });
      totale = lista.length;
    });

    const e = embed('⚠️ WARN Fazione', COLORI.warn)
      .addFields(
        { name: 'Fazione', value: fazione, inline: true },
        { name: 'Warn totali', value: `${totale}`, inline: true },
        { name: 'Staff', value: `<@${i.user.id}>`, inline: true },
        { name: 'Motivo', value: motivo },
      );
    const post = await postTo(i.guild, 'logFazioni', { embeds: [e] });
    await i.editReply(riepilogo(`Warn alla fazione ${fazione}`, [`warn registrato (totale ${totale})`, post.ok ? 'pubblicato nel log' : `⚠️ log non pubblicato: ${post.why}`]));
  },
};

const ESITI = {
  vittoria: { nome: 'Vittoria', colore: COLORI.ok, emoji: '🏆' },
  sconfitta: { nome: 'Sconfitta', colore: COLORI.no, emoji: '💀' },
  pareggio: { nome: 'Pareggio', colore: COLORI.warn, emoji: '🤝' },
  annullata: { nome: 'Annullata', colore: 0x95a5a6, emoji: '🚫' },
};

const esitiazioni = {
  data: new SlashCommandBuilder()
    .setName('esitiazioni')
    .setDescription("Pubblica l'esito di un'azione di una fazione")
    .addStringOption((o) => o.setName('fazione').setDescription('Fazione che ha fatto l\'azione').setRequired(true))
    .addStringOption((o) => o.setName('azione').setDescription('Che azione era (es. rapina banca)').setRequired(true))
    .addStringOption((o) =>
      o
        .setName('esito')
        .setDescription("Com'è andata")
        .setRequired(true)
        .addChoices(...Object.entries(ESITI).map(([value, v]) => ({ name: v.nome, value }))),
    )
    .addStringOption((o) => o.setName('note').setDescription('Note facoltative')),
  async run(i) {
    if (!(await needRole(i, 'assistenza'))) return;
    await i.deferReply({ flags: EPH });
    const esito = ESITI[i.options.getString('esito')];
    const note = i.options.getString('note');

    const e = embed(`${esito.emoji} Esito azione: ${esito.nome}`, esito.colore)
      .addFields(
        { name: 'Fazione', value: i.options.getString('fazione'), inline: true },
        { name: 'Azione', value: i.options.getString('azione'), inline: true },
        { name: 'Staff', value: `<@${i.user.id}>`, inline: true },
      );
    if (note) e.addFields({ name: 'Note', value: note });
    const post = await postTo(i.guild, 'esitiAzioni', { embeds: [e] });
    await i.editReply(riepilogo('Esito azione', [post.ok ? 'pubblicato' : `⚠️ non pubblicato: ${post.why}`]));
  },
};

// Conteggio di quante volte lo staff ha eseguito una cosa (assistenze / report)
function contaStaff(campo, staffId) {
  let totale = 0;
  let settimana = 0;
  store.update((db) => {
    db[campo] ??= {};
    (db[campo][staffId] ??= []).push(Date.now());
    totale = db[campo][staffId].length;
    const inizio = store.startOfWeek();
    settimana = db[campo][staffId].filter((t) => t >= inizio).length;
  });
  return { totale, settimana };
}

const asseseguite = {
  data: new SlashCommandBuilder()
    .setName('asseseguite')
    .setDescription('Registra un\'assistenza che hai eseguito')
    .addUserOption((o) => o.setName('utente').setDescription('Il giocatore assistito'))
    .addStringOption((o) => o.setName('note').setDescription("Cosa hai fatto / di cosa aveva bisogno")),
  async run(i) {
    if (!(await needRole(i, 'assistenza'))) return;
    await i.deferReply({ flags: EPH });
    const utente = i.options.getUser('utente');
    const note = i.options.getString('note');
    const { totale, settimana } = contaStaff('assistenze', i.user.id);

    const e = embed('🛠️ Assistenza eseguita', COLORI.info)
      .addFields({ name: 'Staff', value: `<@${i.user.id}>`, inline: true }, { name: 'Totale / settimana', value: `${totale} / ${settimana}`, inline: true });
    if (utente) e.addFields({ name: 'Giocatore', value: `<@${utente.id}>`, inline: true });
    if (note) e.addFields({ name: 'Note', value: note });
    const post = await postTo(i.guild, 'logAssistenze', { embeds: [e] });
    await i.editReply(riepilogo('Assistenza registrata', [`le tue assistenze: **${totale}** totali, **${settimana}** questa settimana`, post.ok ? 'pubblicata nel log' : `⚠️ log non pubblicato: ${post.why}`]));
  },
};

const reporteseguiti = {
  data: new SlashCommandBuilder()
    .setName('reporteseguiti')
    .setDescription('Registra un report che hai gestito')
    .addStringOption((o) => o.setName('giocatore').setDescription('Giocatore segnalato').setRequired(true))
    .addStringOption((o) =>
      o
        .setName('esito')
        .setDescription('Esito del report')
        .setRequired(true)
        .addChoices(
          { name: 'Sanzionato', value: 'Sanzionato' },
          { name: 'Archiviato', value: 'Archiviato' },
          { name: 'Non valido', value: 'Non valido' },
        ),
    )
    .addStringOption((o) => o.setName('note').setDescription('Note facoltative')),
  async run(i) {
    if (!(await needRole(i, 'assistenza'))) return;
    await i.deferReply({ flags: EPH });
    const note = i.options.getString('note');
    const { totale, settimana } = contaStaff('report', i.user.id);

    const e = embed('📋 Report eseguito', COLORI.viola)
      .addFields(
        { name: 'Giocatore segnalato', value: i.options.getString('giocatore'), inline: true },
        { name: 'Esito', value: i.options.getString('esito'), inline: true },
        { name: 'Staff', value: `<@${i.user.id}>`, inline: true },
        { name: 'Totale / settimana', value: `${totale} / ${settimana}`, inline: true },
      );
    if (note) e.addFields({ name: 'Note', value: note });
    const post = await postTo(i.guild, 'logReport', { embeds: [e] });
    await i.editReply(riepilogo('Report registrato', [`i tuoi report: **${totale}** totali, **${settimana}** questa settimana`, post.ok ? 'pubblicato nel log' : `⚠️ log non pubblicato: ${post.why}`]));
  },
};

module.exports = [ticketpanel, warnplayer, banplayer, warnfazioni, esitiazioni, asseseguite, reporteseguiti];
