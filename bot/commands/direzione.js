const { SlashCommandBuilder } = require('discord.js');
const forms = require('../forms');

module.exports = [
  {
    data: new SlashCommandBuilder().setName('modulodirezione').setDescription('Compila il modulo per la direzione'),
    run: (i) => forms.apri(i, 'direzione'),
  },
];
