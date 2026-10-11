// Avvia SOLO il bot Discord (online + comandi /crealicense e /rimuovilicense).
// Il sito si avvia a parte con start.bat. Condividono data/db.json.
try { process.loadEnvFile(); } catch { /* .env opzionale */ }
const { startBot } = require('./lib/gateway');
const { registerCommands, handleInteraction } = require('./lib/commands');

console.log('FLUX BOT ITA — avvio bot Discord...');
const bot = startBot(process.env.DISCORD_BOT_TOKEN, {
  onReady: () => registerCommands(process.env.DISCORD_CLIENT_ID, process.env.DISCORD_GUILD_ID, process.env.DISCORD_BOT_TOKEN),
  onInteraction: handleInteraction,
});
if (!bot) process.exit(1);

process.on('SIGINT', () => { bot.stop(); process.exit(0); });
