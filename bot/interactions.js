// Smista comandi slash, bottoni e finestre (modal) al codice giusto
const { Events, MessageFlags } = require('discord.js');
const commands = require('./commands');
const forms = require('./forms');
const tickets = require('./tickets');

async function registraComandi(guild) {
  await guild.commands.set(commands.json());
  console.log(`Registrati ${commands.list.length} comandi slash in "${guild.name}".`);
}

function ascolta(client) {
  client.on(Events.InteractionCreate, async (i) => {
    try {
      if (i.isChatInputCommand()) {
        await commands.map.get(i.commandName)?.run(i);
      } else if (i.isButton()) {
        if (i.customId.startsWith('ticket:')) await tickets.onButton(i);
        else if (i.customId.startsWith('form:')) await forms.onButton(i);
      } else if (i.isStringSelectMenu()) {
        if (i.customId === 'moduli:scelta') await forms.apri(i, i.values[0]);
      } else if (i.isModalSubmit()) {
        if (i.customId.startsWith('formsubmit:')) await forms.onSubmit(i);
        else if (i.customId.startsWith('formreject:')) await forms.onRejectSubmit(i);
      }
    } catch (e) {
      console.error(`Errore interazione (${i.commandName ?? i.customId}):`, e);
      const msg = { content: '❌ Si è verificato un errore. Riprova o avvisa un admin.', flags: MessageFlags.Ephemeral };
      try {
        if (i.deferred || i.replied) await i.followUp(msg);
        else await i.reply(msg);
      } catch {}
    }
  });
}

module.exports = { registraComandi, ascolta };
