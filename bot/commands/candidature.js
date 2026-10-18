const { SlashCommandBuilder } = require('discord.js');
const forms = require('../forms');

const cand = (name, desc, formId) => ({
  data: new SlashCommandBuilder().setName(name).setDescription(desc),
  run: (i) => forms.apri(i, formId),
});

module.exports = [
  cand('candidaturastaff', 'Candidati per entrare nello staff', 'staff'),
  cand('candidaturateamac', 'Candidati per entrare nel Team AC', 'teamac'),
  cand('candidaturacreator', 'Candidati come Creator', 'creator'),
];
