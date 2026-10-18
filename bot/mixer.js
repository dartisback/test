// Mixer audio: la musichetta d'attesa gira in continuo e il saluto viene
// SOVRAPPOSTO quando entra una persona, senza fermare né far ripartire la musica.
const { Readable } = require('stream');
const { spawn, execFile } = require('child_process');

const FRAME = 3840; // 20ms, 48kHz, stereo, 16bit
const DUCK = 0.3; // volume della musica mentre parla il saluto (se la musica era già in corso)

// Decodifica un file audio in PCM 48kHz stereo 16bit (per il saluto)
function decodeToPcm(ffmpeg, file) {
  return new Promise((resolve, reject) => {
    execFile(
      ffmpeg,
      ['-loglevel', 'error', '-i', file, '-f', 's16le', '-ar', '48000', '-ac', '2', 'pipe:1'],
      { encoding: 'buffer', maxBuffer: 100 * 1024 * 1024 },
      (err, stdout) => (err ? reject(err) : resolve(stdout)),
    );
  });
}

class WaitingMixer extends Readable {
  constructor({ ffmpeg, musicFile, greetingPcm, withGreeting }) {
    super({ highWaterMark: FRAME * 10 });
    this.greetingPcm = greetingPcm;
    this.greetQueue = 0; // saluti in coda
    this.greetPos = -1; // posizione nel saluto in corso (-1 = nessuno)
    this.musicActive = false;
    this.musicBuf = Buffer.alloc(0);
    this.proc = null;
    this.stopped = false;

    if (musicFile) {
      this.proc = spawn(
        ffmpeg,
        ['-loglevel', 'error', '-stream_loop', '-1', '-i', musicFile, '-f', 's16le', '-ar', '48000', '-ac', '2', 'pipe:1'],
        { stdio: ['ignore', 'pipe', 'ignore'] },
      );
      this.proc.stdout.on('data', (chunk) => {
        this.musicBuf = Buffer.concat([this.musicBuf, chunk]);
        if (this.musicBuf.length > FRAME * 100) this.proc.stdout.pause(); // ~2s di scorta
      });
      this.proc.on('error', (e) => console.error('[mixer] ffmpeg musica:', e.message));
    }

    if (withGreeting && greetingPcm) this.greetQueue = 1;
    else this.musicActive = true; // niente saluto: musica subito
  }

  // Entra un'altra persona: il suo saluto si sovrappone alla musica in corso
  queueGreeting() {
    if (this.greetingPcm) this.greetQueue++;
  }

  _read() {
    while (!this.stopped && this.push(this._frame())) { /* riempie il buffer */ }
  }

  _frame() {
    const out = Buffer.alloc(FRAME);

    // 1) saluto
    let greeting = null;
    if (this.greetPos < 0 && this.greetQueue > 0) {
      this.greetQueue--;
      this.greetPos = 0;
    }
    if (this.greetPos >= 0) {
      greeting = this.greetingPcm.subarray(this.greetPos, this.greetPos + FRAME);
      this.greetPos += FRAME;
      if (this.greetPos >= this.greetingPcm.length) {
        this.greetPos = -1;
        // finito il primo saluto: parte la musichetta (da capo)
        if (this.greetQueue === 0) this.musicActive = true;
      }
    }

    // 2) musica
    let music = null;
    let gain = 1;
    if (this.musicActive && this.musicBuf.length >= FRAME) {
      music = this.musicBuf.subarray(0, FRAME);
      this.musicBuf = this.musicBuf.subarray(FRAME);
      if (this.musicBuf.length < FRAME * 50 && this.proc) this.proc.stdout.resume();
      if (greeting) gain = DUCK;
    }

    // 3) mix
    for (let i = 0; i + 1 < FRAME; i += 2) {
      let v = 0;
      if (music) v += music.readInt16LE(i) * gain;
      if (greeting && i + 1 < greeting.length) v += greeting.readInt16LE(i);
      out.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(v))), i);
    }
    return out;
  }

  _destroy(err, cb) {
    this.stopped = true;
    if (this.proc) this.proc.kill();
    cb(err);
  }
}

module.exports = { WaitingMixer, decodeToPcm };
