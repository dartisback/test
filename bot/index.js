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
  if (fs.existsSync(GREETING_FILE)) return;
  const url = googleTTS.getAudioUrl(GREETING_TEXT, {
    lang: 'it',
    slow: false,
    host: 'https://translate.google.com',
  });
  const res = await fetch(url);
  if (!res.ok) throw new Error(`TTS HTTP ${res.status}`);
  fs.writeFileSync(GREETING_FILE, Buffer.from(await res.arrayBuffer()));
}

/* ---------- Connessione al canale (mutato/deaf) ---------- */

async function joinChannel() {
  const channel = await client.channels.fetch(CHANNEL_ID);
  if (!channel || !channel.isVoiceBased()) {
    throw new Error('VOICE_CHANNEL_ID non è un canale vocale valido.');
  }

  connection = joinVoiceChannel({
    channelId: channel.id,
    guildId: channel.guild.id,
    adapterCreator: channel.guild.voiceAdapterCreator,
    selfDeaf: true, // icona cuffie barrate: il bot appare "mutato"
    selfMute: false,
  });
  connection.subscribe(player);

  connection.on(VoiceConnectionStatus.Disconnected, async () => {
    try {
      await Promise.race([
        entersState(connection, VoiceConnectionStatus.Signalling, 5_000),
        entersState(connection, VoiceConnectionStatus.Connecting, 5_000),
      ]);
    } catch {
      connection.destroy();
      setTimeout(() => joinChannel().catch(console.error), 5_000);
    }
  });

  await entersState(connection, VoiceConnectionStatus.Ready, 30_000);
  console.log(`Connesso (deaf) a "${channel.name}".`);
  return channel;
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

function startWaitingSequence() {
  if (phase !== 'idle') return; // già in corso per qualcuno in attesa

  if (fs.existsSync(GREETING_FILE)) {
    phase = 'greeting';
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
  if (newState.member?.user.bot) return;

  const joined = newState.channelId === CHANNEL_ID && oldState.channelId !== CHANNEL_ID;
  const left = oldState.channelId === CHANNEL_ID && newState.channelId !== CHANNEL_ID;

  if (joined) {
    startWaitingSequence();
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
  await joinChannel();
});

process.on('unhandledRejection', (e) => console.error('Errore non gestito:', e));

client.login(TOKEN);
