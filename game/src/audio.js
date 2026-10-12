import { settings } from './settings.js';
import SIREN_DATA from './siren_data.js';

// Audio interamente procedurale (WebAudio): nessun file esterno necessario.
export class AudioSys {
  constructor() {
    this.ctx = null;
    this.sirenOn = false;
    this.engineOn = false;
  }

  init() {
    if (this.ctx) { this.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = (this.ctx = new AC());
    this.master = ctx.createGain(); this.master.connect(ctx.destination);
    this.sfx = ctx.createGain(); this.sfx.connect(this.master);
    this.engineBus = ctx.createGain(); this.engineBus.connect(this.master);
    this.sirenBus = ctx.createGain(); this.sirenBus.connect(this.master);
    // buffer di rumore
    const len = ctx.sampleRate * 1;
    this.noise = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this._buildSirenChain();
    this.applyVolumes();
  }

  // ---------- sirena italiana (campione reale) con effetto "deep" ----------
  _buildSirenChain() {
    const c = this.ctx;
    this.sirenIn = c.createGain();
    const low = c.createBiquadFilter(); low.type = 'lowshelf'; low.frequency.value = 220; low.gain.value = 10;      // bassi profondi
    const sub = c.createBiquadFilter(); sub.type = 'peaking'; sub.frequency.value = 110; sub.Q.value = 0.8; sub.gain.value = 5;
    const high = c.createBiquadFilter(); high.type = 'highshelf'; high.frequency.value = 4200; high.gain.value = -4; // meno acuti taglienti
    const comp = c.createDynamicsCompressor(); comp.threshold.value = -18; comp.ratio.value = 3.5; comp.attack.value = 0.01; comp.release.value = 0.25;
    this.sirenIn.connect(low); low.connect(sub); sub.connect(high); high.connect(comp);
    // riverbero (impulso sintetico di ~1.6 s)
    const len = Math.floor(c.sampleRate * 1.6);
    const ir = c.createBuffer(2, len, c.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = ir.getChannelData(ch);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6);
    }
    const conv = c.createConvolver(); conv.buffer = ir;
    const wet = c.createGain(); wet.gain.value = 0.42;
    const dry = c.createGain(); dry.gain.value = 0.95;
    comp.connect(dry); dry.connect(this.sirenBus);
    comp.connect(conv); conv.connect(wet); wet.connect(this.sirenBus);
    // decodifica del campione incorporato
    try {
      const bin = atob(SIREN_DATA); const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      c.decodeAudioData(bytes.buffer, (buf) => { this.sirenBuf = buf; if (this.sirenOn && !this.sirenVoices) this._startSampleSiren(); }, () => { this.sirenBuf = null; });
    } catch (e) { this.sirenBuf = null; }
  }

  _spawnSirenVoice(fadeIn) {
    const c = this.ctx, buf = this.sirenBuf, xf = 0.8;
    const src = c.createBufferSource(); src.buffer = buf;
    const g = c.createGain();
    const t = c.currentTime;
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(1, t + fadeIn);
    src.connect(g); g.connect(this.sirenIn);
    src.start(t);
    const endAt = t + buf.duration;
    g.gain.setValueAtTime(1, endAt - xf); g.gain.linearRampToValueAtTime(0.0001, endAt);
    src.stop(endAt + 0.05);
    const v = { src, g, nextAt: endAt - xf };
    this.sirenVoices.push(v);
    src.onended = () => { this.sirenVoices = this.sirenVoices.filter((x) => x !== v); };
    return v;
  }
  _startSampleSiren() {
    this.sirenVoices = [];
    this._spawnSirenVoice(0.08);
    let spawnedFor = this.sirenVoices[0];
    this.sirenTimer = setInterval(() => {
      if (!this.sirenOn || !this.sirenVoices.length) return;
      const last = this.sirenVoices[this.sirenVoices.length - 1];
      if (this.ctx.currentTime >= last.nextAt - 0.05 && spawnedFor === last) { spawnedFor = this._spawnSirenVoice(0.8); }
    }, 50);
  }

  resume() { if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); }

  applyVolumes() {
    if (!this.ctx) return;
    this.master.gain.value = settings.master;
    this.sfx.gain.value = settings.sfx;
    this.engineBus.gain.value = settings.engine * 0.5;
    this.sirenBus.gain.value = settings.sirenVol * 0.9;
  }

  // ---------- motore ----------
  startEngine() {
    if (!this.ctx || this.engineOn) return;
    const c = this.ctx;
    this.o1 = c.createOscillator(); this.o1.type = 'sawtooth';
    this.o2 = c.createOscillator(); this.o2.type = 'square';
    this.eg = c.createGain(); this.eg.gain.value = 0.0;
    this.ef = c.createBiquadFilter(); this.ef.type = 'lowpass'; this.ef.frequency.value = 400;
    this.o1.connect(this.ef); this.o2.connect(this.ef); this.ef.connect(this.eg); this.eg.connect(this.engineBus);
    this.o1.start(); this.o2.start();
    this.engineOn = true;
  }
  setEngine(speedAbs, throttle) {
    if (!this.ctx || !this.engineOn) return;
    const gears = [0, 9, 17, 27, 38, 50];
    let g = 0;
    while (g < gears.length - 2 && speedAbs > gears[g + 1]) g++;
    const frac = Math.min(1, (speedAbs - gears[g]) / (gears[g + 1] - gears[g]));
    const rpm = 0.12 + frac * 0.75 + throttle * 0.1;
    const f = 38 + rpm * 120;
    const t = this.ctx.currentTime;
    this.o1.frequency.setTargetAtTime(f, t, 0.05);
    this.o2.frequency.setTargetAtTime(f * 0.5, t, 0.05);
    this.ef.frequency.setTargetAtTime(260 + rpm * 900 + throttle * 300, t, 0.08);
    this.eg.gain.setTargetAtTime(0.22 + throttle * 0.2 + rpm * 0.1, t, 0.08);
  }
  stopEngine() {
    if (!this.ctx || !this.engineOn) return;
    const t = this.ctx.currentTime;
    this.eg.gain.setTargetAtTime(0, t, 0.1);
    const { o1, o2 } = this;
    setTimeout(() => { try { o1.stop(); o2.stop(); } catch (e) { /* ignore */ } }, 600);
    this.engineOn = false;
  }

  // ---------- sirena ----------
  setSiren(on) {
    if (!this.ctx) return;
    if (on && !this.sirenOn) {
      this.sirenOn = true;
      if (this.sirenBuf) this._startSampleSiren();
      else this._startProceduralSiren(); // ripiego se il campione non è decodificato
    } else if (!on && this.sirenOn) {
      this.sirenOn = false;
      clearInterval(this.sirenTimer);
      const t = this.ctx.currentTime;
      for (const v of this.sirenVoices || []) {
        v.g.gain.cancelScheduledValues(t); v.g.gain.setValueAtTime(v.g.gain.value, t); v.g.gain.linearRampToValueAtTime(0.0001, t + 0.25);
        try { v.src.stop(t + 0.3); } catch (e) { /* ignore */ }
      }
      this.sirenVoices = [];
      if (this.so) { try { this.sg.gain.setTargetAtTime(0, t, 0.04); const so = this.so; setTimeout(() => { try { so.stop(); } catch (e) { /* ignore */ } }, 300); } catch (e) { /* ignore */ } this.so = null; }
    }
  }
  _startProceduralSiren() {
    const c = this.ctx;
    this.so = c.createOscillator(); this.so.type = 'sawtooth';
    this.sf = c.createBiquadFilter(); this.sf.type = 'bandpass'; this.sf.frequency.value = 1200; this.sf.Q.value = 0.7;
    this.sg = c.createGain(); this.sg.gain.value = 0.0;
    this.so.connect(this.sf); this.sf.connect(this.sg); this.sg.connect(this.sirenIn);
    this.so.start();
    this.sg.gain.setTargetAtTime(0.7, c.currentTime, 0.03);
    let hi = false;
    const flip = () => { hi = !hi; if (this.so) this.so.frequency.setValueAtTime(hi ? 960 : 720, this.ctx.currentTime); };
    flip();
    this.sirenTimer = setInterval(flip, 520);
  }

  setHorn(on) {
    if (!this.ctx) return;
    if (on && !this.hornOn) {
      const c = this.ctx;
      this.ho = [c.createOscillator(), c.createOscillator()];
      this.hg = c.createGain(); this.hg.gain.value = 0.18;
      this.ho[0].type = this.ho[1].type = 'square';
      this.ho[0].frequency.value = 420; this.ho[1].frequency.value = 520;
      this.ho.forEach((o) => { o.connect(this.hg); o.start(); });
      this.hg.connect(this.sfx);
      this.hornOn = true;
    } else if (!on && this.hornOn) {
      this.ho.forEach((o) => { try { o.stop(); } catch (e) { /* ignore */ } });
      this.hornOn = false;
    }
  }

  // ---------- effetti ----------
  _burst({ dur = 0.2, freq = 800, q = 0.7, type = 'lowpass', gain = 0.6, decay = 0.08, delay = 0 }) {
    if (!this.ctx) return;
    const c = this.ctx, t = c.currentTime + delay;
    const s = c.createBufferSource(); s.buffer = this.noise;
    const f = c.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = c.createGain(); g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    s.connect(f); f.connect(g); g.connect(this.sfx);
    s.start(t, Math.random() * 0.5, dur + 0.05);
  }
  shot() { this._burst({ dur: 0.28, freq: 2200, gain: 0.9 }); this._burst({ dur: 0.12, freq: 400, gain: 0.8 }); }
  taser() { for (let i = 0; i < 6; i++) this._burst({ dur: 0.04, freq: 3500, type: 'highpass', gain: 0.35, delay: i * 0.05 }); }
  swing() { this._burst({ dur: 0.18, freq: 1200, type: 'bandpass', gain: 0.25 }); }
  step(run) { this._burst({ dur: 0.07, freq: run ? 700 : 500, type: 'lowpass', gain: run ? 0.22 : 0.13 }); }
  thud(power = 1) { this._burst({ dur: 0.25, freq: 300, gain: Math.min(1, 0.3 + power * 0.1) }); }
  ui(kind = 'click') {
    if (!this.ctx) return;
    const c = this.ctx, o = c.createOscillator(), g = c.createGain();
    o.type = 'sine';
    const f = kind === 'ok' ? 880 : kind === 'err' ? 180 : 520;
    o.frequency.setValueAtTime(f, c.currentTime);
    if (kind === 'ok') o.frequency.exponentialRampToValueAtTime(1320, c.currentTime + 0.12);
    g.gain.setValueAtTime(0.18, c.currentTime); g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.18);
    o.connect(g); g.connect(this.sfx); o.start(); o.stop(c.currentTime + 0.2);
  }
  door() { this._burst({ dur: 0.3, freq: 250, gain: 0.5 }); }
}
