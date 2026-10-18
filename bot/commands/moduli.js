const { ActionRowBuilder, SlashCommandBuilder, StringSelectMenuBuilder } = require('discord.js');
const { EPH } = require('../util');
const { FORMS } = require('../forms');

const DESCRIZIONI = {
  whitelist: 'Richiedi la whitelist per entrare in città',
  direzione: 'Candidati per la direzione',
  staff: 'Candidati per entrare nello staff',
  teamac: 'Candidati per il Team AC',
  creator: 'Candidati come Creator',
};

module.exports = [
  {
    data: new SlashCommandBuilder().setName('moduli').setDescription('Mostra tutti i moduli disponibili e compilane uno'),
    async run(i) {
      const menu = new StringSelectMenuBuilder()
        .setCustomId('moduli:scelta')
        .setPlaceholder('Scegli il modulo da compilare')
        .addOptions(
          Object.entries(FORMS).map(([id, f]) => ({
            label: f.title,
            value: id,
            description: DESCRIZIONI[id],
          })),
        );
      await i.reply({
        content: '📋 **Moduli disponibili** — scegli quale vuoi compilare:',
        components: [new ActionRowBuilder().addComponents(menu)],
        flags: EPH,
      });
    },
  },
];
