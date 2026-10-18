// Genera una semplice musichetta d'attesa (attesa.wav).
// Se vuoi una musica tua, metti un file "attesa.mp3" in questa cartella: ha la precedenza.
const fs = require('fs');

const RATE = 44100;
const BPM = 84;
const beat = 60 / BPM;

// Progressione Do - La min - Fa - Sol, arpeggiata
const chords = [
  [261.63, 329.63, 392.0, 523.25],
  [220.0, 261.63, 329.63, 440.0],
  [174.61, 220.0, 261.63, 349.23],
  [196.0, 246.94, 293.66, 392.0],
];
const bars = 8; // 2 giri di progressione
const notesPerBar = 8;
const noteLen = (beat * 4) / notesPerBar;
const total = Math.floor(RATE * noteLen * notesPerBar * bars);
const samples = new Float32Array(total);

for (let bar = 0; bar < bars; bar++) {
  const chord = chords[bar % chords.length];
  for (let n = 0; n < notesPerBar; n++) {
    const pattern = [0, 1, 2, 3, 2, 1, 2, 1];
    const f = chord[pattern[n]];
    const start = Math.floor((bar * notesPerBar + n) * noteLen * RATE);
    const len = Math.floor(noteLen * 1.6 * RATE);
    for (let i = 0; i < len && start + i < total; i++) {
      const t = i / RATE;
      const env = Math.min(1, i / (0.01 * RATE)) * Math.exp(-3.2 * t);
      const s = Math.sin(2 * Math.PI * f * t) + 0.25 * Math.sin(2 * Math.PI * f * 2 * t);
      samples[start + i] += s * env * 0.22;
    }
  }
  // nota di basso a inizio battuta
  const bf = chord[0] / 2;
  const bs = Math.floor(bar * notesPerBar * noteLen * RATE);
  const bl = Math.floor(beat * 3 * RATE);
  for (let i = 0; i < bl && bs + i < total; i++) {
    const t = i / RATE;
    samples[bs + i] += Math.sin(2 * Math.PI * bf * t) * Math.exp(-1.2 * t) * 0.25;
  }
}

const pcm = Buffer.alloc(total * 2);
for (let i = 0; i < total; i++) {
  const v = Math.max(-1, Math.min(1, samples[i]));
  pcm.writeInt16LE(Math.round(v * 32767), i * 2);
}
const header = Buffer.alloc(44);
header.write('RIFF', 0);
header.writeUInt32LE(36 + pcm.length, 4);
header.write('WAVEfmt ', 8);
header.writeUInt32LE(16, 16);
header.writeUInt16LE(1, 20);
header.writeUInt16LE(1, 22);
header.writeUInt32LE(RATE, 24);
header.writeUInt32LE(RATE * 2, 28);
header.writeUInt16LE(2, 32);
header.writeUInt16LE(16, 34);
header.write('data', 36);
header.writeUInt32LE(pcm.length, 40);
fs.writeFileSync(__dirname + '/attesa.wav', Buffer.concat([header, pcm]));
console.log('attesa.wav creato.');
