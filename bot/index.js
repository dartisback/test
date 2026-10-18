require('dotenv').config();

const fs = require('fs');
const path = require('path');
const {
  Client,
  GatewayIntentBits,
  Events,
} = require('discord.js');
const {
  joinVoiceChannel,
  createAudioPlayer,
  createAudioResource,
  entersState,
  AudioPlayerStatus,
  VoiceConnectionStatus,
  NoSubscriberBehavior,
} = require('@discordjs/voice');
const googleTTS = require('google-tts-api');

// Usa il ffmpeg incluso nel pacchetto (non serve installarlo a mano)
process.env.FFMPEG_PATH = require('ffmpeg-static');

// Controllo librerie: se sono vecchie l'audio NON funziona (Discord richiede DAVE)
try {
  const v = require('@discordjs/voice/package.json').version;
  require('@snazzah/davey');
  console.log(`Librerie voce OK (@discordjs/voice ${v}, DAVE presente).`);
} catch {
  console.error('!! Librerie vocali vecchie o mancanti: chiudi il bot, cancella la cartella node_modules e rilancia avvia-bot.bat');
}

const TOKEN = process.env.DISCORD_TOKEN;
const CHANNEL_ID = process.env.VOICE_CHANNEL_ID;
const STAFF_ROLE_ID = process.env.STAFF_ROLE_ID;

if (!TOKEN || !CHANNEL_ID || !STAFF_ROLE_ID) {
  console.error('Manca qualcosa nel file .env (DISCORD_TOKEN, VOICE_CHANNEL_ID, STAFF_ROLE_ID).');
  process.exit(1);
}

const GREETING_TEXT = 'Ciao! Benvenuto nella Assistenza di Next Rome RP, ho appena avvisato uno staff!';
const GREETING_FILE = path.join(__dirname, 'tts-benvenuto.mp3');
const MUSIC_FILE = ['attesa.mp3', 'attesa.wav']
  .map((f) => path.join(__dirname, f))
  .find((f) => fs.existsSync(f));

// Anti-spam: non rimandare il DM allo staff se la stessa persona rientra entro 60s
const DM_COOLDOWN_MS = 60 * 1000;
const lastNotified = new Map();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMembers, // serve per leggere chi ha il ruolo staff (da attivare nel Developer Portal)
  ],
});

const player = createAudioPlayer({
  behaviors: { noSubscriber: NoSubscriberBehavior.Play },
});

let connection = null;
let phase = 'idle'; // idle | greeting | music

/* ---------- Voce (TTS) ---------- */

async function prepareGreeting() {
  if (fs.existsSync(GREETING_FILE)) {
    if (fs.statSync(GREETING_FILE).size > 2000) return true;
    fs.unlinkSync(GREETING_FILE); // file corrotto: rigenera
  }
  try {
    const url = googleTTS.getAudioUrl(GREETING_TEXT, {
      lang: 'it',
      slow: false,
      host: 'https://translate.google.com',
    });
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length < 2000) throw new Error('risposta audio vuota');
    fs.writeFileSync(GREETING_FILE, buf);
    console.log('Saluto vocale generato.');
    return true;
  } catch (e) {
    console.warn('!! Saluto vocale NON generato (serve internet):', e.message);
    return false;
  }
}

/* ---------- Connessione al canale (mutato/deaf) ---------- */

let joining = false;
let rejoinTimer = null;

async function joinChannel() {
  if (joining) return;
  joining = true;
  try {
    const channel = await client.channels.fetch(CHANNEL_ID);
    if (!channel || !channel.isVoiceBased()) {
      throw new Error('VOICE_CHANNEL_ID non è un canale vocale valido.');
    }

    if (connection) {
      try { connection.destroy(); } catch {}
      connection = null;
    }

    const conn = joinVoiceChannel({
      channelId: channel.id,
      guildId: channel.guild.id,
      adapterCreator: channel.guild.voiceAdapterCreator,
      selfDeaf: false, // non mutato: deve poter parlare e suonare
      selfMute: false,
    });
    connection = conn;
    conn.subscribe(player);

    conn.on('stateChange', (o, n) => {
      console.log(`[voce] ${o.status} -> ${n.status}${n.closeCode ? ` (codice ${n.closeCode})` : ''}`);
    });
    conn.on('error', (e) => console.error('[voce] errore:', e.message));

    conn.on(VoiceConnectionStatus.Disconnected, async () => {
      try {
        // se è solo uno spostamento/riconnessione si riprende da solo
        await Promise.race([
          entersState(conn, VoiceConnectionStatus.Signalling, 3_000),
          entersState(conn, VoiceConnectionStatus.Connecting, 3_000),
        ]);
      } catch {
        // kickato / disconnesso: rientra subito
        if (conn.state.status !== VoiceConnectionStatus.Destroyed) conn.destroy();
        if (connection === conn) scheduleRejoin(500);
      }
    });

    await entersState(conn, VoiceConnectionStatus.Ready, 30_000);
    console.log(`Connesso a "${channel.name}".`);
    phase = 'idle';
    if (humansInChannel() > 0) playMusic(); // c'è già gente in attesa
  } finally {
    joining = false;
  }
}

// Riprova finché non riesce a rientrare nel canale
function scheduleRejoin(delay = 1_000) {
  if (rejoinTimer) return;
  rejoinTimer = setTimeout(async () => {
    rejoinTimer = null;
    try {
      await joinChannel();
    } catch (e) {
      console.error('Rientro fallito, riprovo tra 5s:', e.message);
      scheduleRejoin(5_000);
    }
  }, delay);
}

/* ---------- Riproduzione: saluto -> musichetta in loop ---------- */

function humansInChannel() {
  const channel = client.channels.cache.get(CHANNEL_ID);
  if (!channel) return 0;
  return channel.members.filter((m) => !m.user.bot).size;
}

function playMusic() {
  if (!MUSIC_FILE) {
    phase = 'idle';
    console.warn('Nessun file attesa.mp3 / attesa.wav trovato: niente musichetta.');
    return;
  }
  phase = 'music';
  player.play(createAudioResource(MUSIC_FILE));
}

async function startWaitingSequence() {
  if (phase !== 'idle') return; // già in corso per qualcuno in attesa
  phase = 'greeting';

  // se manca il file del saluto prova a rigenerarlo al volo
  const ok = await prepareGreeting();
  if (phase !== 'greeting') return; // nel frattempo tutti sono usciti

  if (ok) {
    console.log('Riproduco il saluto...');
    player.play(createAudioResource(GREETING_FILE));
  } else {
    playMusic();
  }
}

player.on(AudioPlayerStatus.Idle, () => {
  if (humansInChannel() === 0) {
    phase = 'idle';
    return;
  }
  playMusic(); // dopo il saluto parte la musichetta, e poi si ripete in loop
});

player.on('stateChange', (o, n) => console.log(`[audio] ${o.status} -> ${n.status}`));

player.on('error', (err) => {
  console.error('Errore player:', err.message);
  phase = 'idle';
});

/* ---------- Avviso staff in DM ---------- */

async function notifyStaff(member, channel) {
  const last = lastNotified.get(member.id) ?? 0;
  if (Date.now() - last < DM_COOLDOWN_MS) return;
  lastNotified.set(member.id, Date.now());

  const guild = channel.guild;
  await guild.members.fetch(); // aggiorna la cache dei membri
  const role = await guild.roles.fetch(STAFF_ROLE_ID);
  if (!role) {
    console.error('Ruolo staff non trovato.');
    return;
  }

  const text =
    `🚨 **${member.displayName}** (<@${member.id}>) è in attesa nel canale ` +
    `**${channel.name}**. Entra nell'assistenza vocale: <#${channel.id}>`;

  for (const staff of role.members.values()) {
    if (staff.user.bot || staff.id === member.id) continue;
    staff.send(text).catch(() => {
      console.warn(`Impossibile mandare DM a ${staff.user.tag} (DM chiusi).`);
    });
  }
}

/* ---------- Eventi ---------- */

client.on(Events.VoiceStateUpdate, async (oldState, newState) => {
  // il bot è stato kickato o spostato: torna nel canale d'attesa
  if (newState.id === client.user.id) {
    if (newState.channelId !== CHANNEL_ID && !joining) {
      console.log('Il bot è stato disconnesso/spostato, rientro...');
      phase = 'idle';
      player.stop(true);
      scheduleRejoin(500);
    }
    return;
  }
  if (newState.member?.user.bot) return;

  const joined = newState.channelId === CHANNEL_ID && oldState.channelId !== CHANNEL_ID;
  const left = oldState.channelId === CHANNEL_ID && newState.channelId !== CHANNEL_ID;

  if (joined) {
    console.log(`${newState.member.displayName} è entrato in attesa.`);
    startWaitingSequence().catch(console.error);
    notifyStaff(newState.member, newState.channel).catch(console.error);
  } else if (left && humansInChannel() === 0) {
    phase = 'idle';
    player.stop(true);
  }
});

client.once(Events.ClientReady, async (c) => {
  console.log(`Bot online come ${c.user.tag}`);
  try {
    await prepareGreeting();
  } catch (e) {
    console.warn('Saluto vocale non generato (controlla la connessione):', e.message);
  }
  try {
    await joinChannel();
  } catch (e) {
    console.error('Connessione iniziale fallita, riprovo:', e.message);
    scheduleRejoin(5_000);
  }
});

process.on('unhandledRejection', (e) => console.error('Errore non gestito:', e));

client.login(TOKEN);
