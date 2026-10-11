// Avvia SOLO il bot Discord (lo mette online). Il sito si avvia a parte con start.bat.
try { process.loadEnvFile(); } catch { /* .env opzionale */ }
const { startBot } = require('./lib/gateway');

console.log('FLUX BOT ITA — avvio bot Discord...');
const bot = startBot(process.env.DISCORD_BOT_TOKEN);
if (!bot) process.exit(1);

process.on('SIGINT', () => { bot.stop(); process.exit(0); });
