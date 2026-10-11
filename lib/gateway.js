// Collega il bot al gateway Discord così risulta ONLINE nel server.
// (Il resto del sito usa il token solo via REST per leggere i ruoli.)
const WebSocket = require('ws');

const GATEWAY = process.env.DISCORD_GATEWAY_URL || 'wss://gateway.discord.gg/?v=10&encoding=json';
const FATAL = { 4004: 'token non valido', 4010: 'shard non valido', 4011: 'sharding richiesto', 4012: 'versione API non valida', 4013: 'intents non validi', 4014: 'intents non consentiti' };

function startBot(token, { status = 'FLUX BOT ITA' } = {}) {
  if (!token) return console.warn('⚠  Bot Discord non avviato: DISCORD_BOT_TOKEN mancante.');

  let ws, hb, seq = null, sessionId = null, resumeUrl = null, ackd = true, stopped = false;

  const send = (op, d) => ws?.readyState === WebSocket.OPEN && ws.send(JSON.stringify({ op, d }));
  const identify = () =>
    send(2, {
      token,
      intents: 0, // nessun intent privilegiato necessario per la presenza
      properties: { os: process.platform, browser: 'flux-bot', device: 'flux-bot' },
      presence: { status: 'online', afk: false, activities: [{ name: status, type: 3 }] }, // "Sta guardando ..."
    });

  function connect(resume = false) {
    ws = new WebSocket(resume && resumeUrl ? `${resumeUrl}/?v=10&encoding=json` : GATEWAY);

    ws.on('message', (raw) => {
      const p = JSON.parse(raw);
      if (p.s != null) seq = p.s;
      switch (p.op) {
        case 10: {
          const ms = p.d.heartbeat_interval;
          ackd = true;
          clearInterval(hb);
          setTimeout(() => send(1, seq), ms * Math.random());
          hb = setInterval(() => {
            if (!ackd) return ws.terminate(); // connessione zombie → riconnetti
            ackd = false;
            send(1, seq);
          }, ms);
          if (resume && sessionId) send(6, { token, session_id: sessionId, seq });
          else identify();
          break;
        }
        case 11: ackd = true; break;
        case 1: send(1, seq); break;
        case 7: ws.close(4000); break; // Discord chiede di riconnettere
        case 9: setTimeout(() => (p.d && sessionId ? send(6, { token, session_id: sessionId, seq }) : identify()), 1000 + Math.random() * 4000); if (!p.d) sessionId = null; break;
        case 0:
          if (p.t === 'READY') {
            sessionId = p.d.session_id;
            resumeUrl = p.d.resume_gateway_url;
            console.log(`🤖 Bot online come ${p.d.user.username} (${p.d.guilds.length} server)`);
          }
          break;
      }
    });

    ws.on('close', (code) => {
      clearInterval(hb);
      if (stopped) return;
      if (FATAL[code]) {
        stopped = true;
        return console.error(`❌ Bot Discord fermato: ${FATAL[code]} (codice ${code}). Controlla DISCORD_BOT_TOKEN.`);
      }
      const canResume = sessionId && code !== 4007 && code !== 4009;
      setTimeout(() => connect(canResume), 3000);
    });
    ws.on('error', (e) => console.warn('[bot] errore gateway:', e.message));
  }

  connect();
  return { stop: () => { stopped = true; clearInterval(hb); ws?.close(1000); } };
}

module.exports = { startBot };
