import * as THREE from 'three';
import { makeRng } from './util.js';

const rnd = makeRng(777);

export function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

function toTex(c, { repeat = true, srgb = true, aniso = 8 } = {}) {
  const t = new THREE.CanvasTexture(c);
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = aniso;
  return t;
}

function speckle(g, w, h, n, base, spread, size = 3, alpha = 0.08) {
  for (let i = 0; i < n; i++) {
    const v = base + (rnd() - 0.5) * spread;
    g.fillStyle = `rgba(${v | 0},${v | 0},${v | 0},${alpha})`;
    g.fillRect(rnd() * w, rnd() * h, 1 + rnd() * size, 1 + rnd() * size);
  }
}

/** Una campata di facciata (4m x 3.3m): intonaco + finestra + persiane. */
export function facadeTextures() {
  const W = 320, H = 264;
  const draw = (emissive) => {
    const c = makeCanvas(W, H), g = c.getContext('2d');
    g.fillStyle = emissive ? '#000' : '#f6f1e8';
    g.fillRect(0, 0, W, H);
    if (!emissive) {
      for (let i = 0; i < 1600; i++) {
        const r = 150 + rnd() * 100, b = 120 + rnd() * 90;
        g.fillStyle = `rgba(${r | 0},${(r - 12) | 0},${b | 0},0.06)`;
        g.fillRect(rnd() * W, rnd() * H, 2 + rnd() * 8, 2 + rnd() * 8);
      }
      g.fillStyle = 'rgba(0,0,0,0.13)'; g.fillRect(0, H - 14, W, 14); // marcapiano
      g.fillStyle = 'rgba(255,255,255,0.35)'; g.fillRect(0, H - 16, W, 2);
    }
    const wx = 118, wy = 46, ww = 84, wh = 132;
    if (!emissive) {
      g.fillStyle = '#e4ddcd'; g.fillRect(wx - 9, wy - 11, ww + 18, wh + 20); // cornice
      g.fillStyle = 'rgba(0,0,0,0.18)'; g.fillRect(wx - 9, wy - 11, ww + 18, 3);
    }
    const grd = g.createLinearGradient(0, wy, 0, wy + wh);
    if (emissive) { grd.addColorStop(0, '#ffe2a8'); grd.addColorStop(1, '#ffc46b'); }
    else { grd.addColorStop(0, '#41566e'); grd.addColorStop(0.5, '#1d2b3b'); grd.addColorStop(1, '#10161f'); }
    g.fillStyle = grd; g.fillRect(wx, wy, ww, wh);
    if (!emissive) {
      g.strokeStyle = '#ece6d8'; g.lineWidth = 5;
      g.strokeRect(wx + 2, wy + 2, ww - 4, wh - 4);
      g.beginPath(); g.moveTo(wx + ww / 2, wy); g.lineTo(wx + ww / 2, wy + wh); g.moveTo(wx, wy + wh * 0.34); g.lineTo(wx + ww, wy + wh * 0.34); g.stroke();
      // persiane
      const shut = (x) => {
        g.fillStyle = '#6a4630'; g.fillRect(x, wy - 8, 40, wh + 16);
        g.fillStyle = 'rgba(0,0,0,0.28)';
        for (let y = wy; y < wy + wh + 8; y += 7) g.fillRect(x + 3, y, 34, 2.5);
        g.fillStyle = 'rgba(255,255,255,0.08)'; g.fillRect(x, wy - 8, 3, wh + 16);
      };
      shut(wx - 9 - 42); shut(wx + ww + 9 + 2);
      g.fillStyle = '#cdc6b5'; g.fillRect(wx - 14, wy + wh + 9, ww + 28, 9);
      g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(wx - 14, wy + wh + 18, ww + 28, 3);
    }
    return toTex(c);
  };
  return { map: draw(false), emissive: draw(true) };
}

export function asphaltRoadTexture() {
  const W = 512, H = 128;
  const c = makeCanvas(W, H), g = c.getContext('2d');
  g.fillStyle = '#3b3e43'; g.fillRect(0, 0, W, H);
  speckle(g, W, H, 5000, 90, 70, 2, 0.12);
  // macchie di usura al centro delle corsie
  for (const y of [H * 0.28, H * 0.72]) {
    const gr = g.createLinearGradient(0, y - 12, 0, y + 12);
    gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(0.5, 'rgba(0,0,0,0.16)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.fillRect(0, y - 12, W, 24);
  }
  g.fillStyle = '#d9d9d2';
  g.fillRect(0, H * 0.045, W, 3.5); g.fillRect(0, H * 0.955 - 3.5, W, 3.5); // linee di bordo
  for (let x = 0; x < W; x += 128) g.fillRect(x + 20, H / 2 - 2, 64, 4);       // mezzeria tratteggiata
  return toTex(c);
}

export function plainAsphaltTexture() {
  const c = makeCanvas(256, 256), g = c.getContext('2d');
  g.fillStyle = '#3b3e43'; g.fillRect(0, 0, 256, 256);
  speckle(g, 256, 256, 3500, 90, 70, 2, 0.12);
  return toTex(c);
}

export function pavementTexture() {
  const c = makeCanvas(256, 256), g = c.getContext('2d');
  g.fillStyle = '#a8a39a'; g.fillRect(0, 0, 256, 256);
  for (let y = 0; y < 256; y += 64) for (let x = 0; x < 256; x += 64) {
    const v = 150 + rnd() * 25;
    g.fillStyle = `rgb(${v},${v - 4},${v - 10})`; g.fillRect(x + 1.5, y + 1.5, 61, 61);
  }
  speckle(g, 256, 256, 1500, 140, 60, 2, 0.1);
  return toTex(c);
}

export function cobbleTexture() {
  const c = makeCanvas(256, 256), g = c.getContext('2d');
  g.fillStyle = '#7d766b'; g.fillRect(0, 0, 256, 256);
  for (let y = 0; y < 256; y += 16) {
    const off = (y / 16) % 2 ? 8 : 0;
    for (let x = -8; x < 256; x += 16) {
      const v = 135 + rnd() * 55;
      g.fillStyle = `rgb(${v},${v - 6},${v - 14})`;
      g.fillRect(x + off + 1, y + 1, 14, 14);
    }
  }
  return toTex(c);
}

export function grassTexture() {
  const c = makeCanvas(256, 256), g = c.getContext('2d');
  g.fillStyle = '#4f7a3a'; g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 5000; i++) {
    const v = rnd();
    g.fillStyle = `rgba(${60 + v * 40 | 0},${110 + v * 60 | 0},${40 + v * 30 | 0},0.35)`;
    g.fillRect(rnd() * 256, rnd() * 256, 1.5, 3 + rnd() * 3);
  }
  return toTex(c);
}

export function gravelTexture() {
  const c = makeCanvas(256, 256), g = c.getContext('2d');
  g.fillStyle = '#6f6a63'; g.fillRect(0, 0, 256, 256);
  speckle(g, 256, 256, 9000, 120, 120, 3, 0.35);
  return toTex(c);
}

export function pathTexture() {
  const c = makeCanvas(128, 128), g = c.getContext('2d');
  g.fillStyle = '#b9a98a'; g.fillRect(0, 0, 128, 128);
  speckle(g, 128, 128, 2000, 170, 90, 2, 0.25);
  return toTex(c);
}

export function wallPaintTexture(color = '#e9e3d6') {
  const c = makeCanvas(128, 128), g = c.getContext('2d');
  g.fillStyle = color; g.fillRect(0, 0, 128, 128);
  speckle(g, 128, 128, 700, 200, 60, 3, 0.05);
  return toTex(c);
}

export function floorTilesTexture(a = '#bfc3c7', b = '#aeb3b8') {
  const c = makeCanvas(128, 128), g = c.getContext('2d');
  for (let y = 0; y < 2; y++) for (let x = 0; x < 2; x++) {
    g.fillStyle = (x + y) % 2 ? a : b; g.fillRect(x * 64, y * 64, 64, 64);
  }
  g.strokeStyle = 'rgba(0,0,0,0.2)'; g.lineWidth = 1;
  g.strokeRect(0.5, 0.5, 127, 127); g.beginPath(); g.moveTo(64, 0); g.lineTo(64, 128); g.moveTo(0, 64); g.lineTo(128, 64); g.stroke();
  return toTex(c);
}

export function textTexture(text, { w = 512, h = 128, font = 'bold 64px Arial', fg = '#ffffff', bg = null, border = null, align = 'center', transparent = false } = {}) {
  const c = makeCanvas(w, h), g = c.getContext('2d');
  if (bg) { g.fillStyle = bg; g.fillRect(0, 0, w, h); }
  if (border) { g.strokeStyle = border; g.lineWidth = 6; g.strokeRect(3, 3, w - 6, h - 6); }
  g.fillStyle = fg; g.font = font; g.textAlign = align; g.textBaseline = 'middle';
  const lines = String(text).split('\n');
  const lh = h / lines.length;
  lines.forEach((ln, i) => g.fillText(ln, align === 'center' ? w / 2 : 12, lh * (i + 0.5), w - 16));
  const t = toTex(c, { repeat: false });
  return t;
}

export function glowTexture() {
  const c = makeCanvas(128, 128), g = c.getContext('2d');
  const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, 'rgba(255,214,150,0.9)'); gr.addColorStop(0.35, 'rgba(255,200,120,0.35)'); gr.addColorStop(1, 'rgba(255,190,100,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  return toTex(c, { repeat: false });
}

export function flagTexture(kind) {
  const c = makeCanvas(150, 100), g = c.getContext('2d');
  if (kind === 'it') {
    g.fillStyle = '#009246'; g.fillRect(0, 0, 50, 100);
    g.fillStyle = '#f4f5f0'; g.fillRect(50, 0, 50, 100);
    g.fillStyle = '#ce2b37'; g.fillRect(100, 0, 50, 100);
  } else {
    g.fillStyle = '#003399'; g.fillRect(0, 0, 150, 100);
    g.fillStyle = '#ffcc00';
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      g.beginPath(); g.arc(75 + Math.cos(a) * 30, 50 + Math.sin(a) * 30, 4.2, 0, 7); g.fill();
    }
  }
  return toTex(c, { repeat: false });
}

export function lockerTexture() {
  const c = makeCanvas(256, 256), g = c.getContext('2d');
  g.fillStyle = '#5e6b7a'; g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 4; i++) {
    const x = i * 64;
    g.fillStyle = '#6e7d8f'; g.fillRect(x + 3, 4, 58, 248);
    g.fillStyle = 'rgba(0,0,0,0.35)';
    for (let y = 18; y < 52; y += 6) g.fillRect(x + 12, y, 40, 2.5);
    g.fillStyle = '#c5ccd4'; g.fillRect(x + 48, 126, 6, 16);
    g.fillStyle = 'rgba(255,255,255,0.12)'; g.fillRect(x + 3, 4, 4, 248);
  }
  return toTex(c);
}

/** Decalcomanie laterali: polizia | carabinieri | ambulanza | vvf */
export function liveryTexture(kind = 'polizia') {
  const W = 1024, H = 256;
  const c = makeCanvas(W, H), g = c.getContext('2d');
  g.clearRect(0, 0, W, H);
  if (kind === 'polizia') {
    g.fillStyle = '#f3f5f7';
    g.beginPath(); g.moveTo(0, 120); g.bezierCurveTo(260, 60, 560, 70, 1024, 20); g.lineTo(1024, 150); g.bezierCurveTo(600, 175, 300, 190, 0, 215); g.closePath(); g.fill();
    const stripe = (col, off) => { g.strokeStyle = col; g.lineWidth = 7; g.beginPath(); g.moveTo(0, 226 + off); g.bezierCurveTo(300, 200 + off, 600, 186 + off, 1024, 160 + off); g.stroke(); };
    stripe('#cd212a', 0); stripe('#009246', 9);
    g.save(); g.translate(520, 112); g.rotate(-0.045); g.fillStyle = '#17489c'; g.font = 'italic bold 118px Arial'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('POLIZIA', 0, 0); g.restore();
  } else if (kind === 'carabinieri') {
    g.fillStyle = '#f3f5f7'; g.fillRect(0, 70, W, 100);
    g.fillStyle = '#c4202a'; g.fillRect(0, 176, W, 14);
    g.fillStyle = '#c4202a'; g.fillRect(0, 54, W, 8);
    g.fillStyle = '#12306e'; g.font = 'bold 92px Arial'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('CARABINIERI', 520, 124);
  } else if (kind === 'ambulanza') {
    g.fillStyle = '#d9202a'; g.fillRect(0, 150, W, 34); g.fillStyle = '#f08a1b'; g.fillRect(0, 190, W, 12);
    g.fillStyle = '#d9202a'; g.font = 'bold 66px Arial'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('CROCE ROSSA ITALIANA', 610, 86);
    g.fillStyle = '#d9202a'; g.fillRect(68, 40, 30, 90); g.fillRect(38, 70, 90, 30);
    g.fillStyle = '#d9202a'; g.font = 'bold 46px Arial'; g.fillText('AMBULANZA', 850, 214);
  } else { // vvf
    g.fillStyle = '#f4f4f4'; g.fillRect(0, 20, W, 8); g.fillRect(0, 226, W, 8);
    g.fillStyle = '#ffffff'; g.font = 'bold 92px Arial'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('VIGILI DEL FUOCO', 520, 128);
  }
  return toTex(c, { repeat: false });
}

export function plateTexture(text = 'POLIZIA M5553') {
  const c = makeCanvas(256, 56), g = c.getContext('2d');
  g.fillStyle = '#f4f4ee'; g.fillRect(0, 0, 256, 56);
  g.strokeStyle = '#1f3d8a'; g.lineWidth = 4; g.strokeRect(2, 2, 252, 52);
  g.fillStyle = '#1b1b1b'; g.font = 'bold 30px Arial'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(text, 128, 30);
  return toTex(c, { repeat: false });
}

// =====================================================================================
// Texture per Napoli
// =====================================================================================

/** Varianti di facciata: old (persiane verdi + balconcino), modern, tower (cemento), shed (capannone) */
export function facadeVariant(kind) {
  const W = 320, H = 264;
  const draw = (emissive) => {
    const c = makeCanvas(W, H), g = c.getContext('2d');
    g.fillStyle = emissive ? '#000' : '#f6f1e8'; g.fillRect(0, 0, W, H);
    if (!emissive) {
      for (let i = 0; i < 2200; i++) {
        const r = 150 + rnd() * 100, b = 110 + rnd() * 90;
        g.fillStyle = `rgba(${r | 0},${(r - 14) | 0},${b | 0},0.07)`; g.fillRect(rnd() * W, rnd() * H, 2 + rnd() * 9, 2 + rnd() * 9);
      }
      // macchie di umidità / sporco che cola
      for (let i = 0; i < 9; i++) {
        const x = rnd() * W, gr = g.createLinearGradient(0, 0, 0, H);
        gr.addColorStop(0, 'rgba(60,50,40,0.0)'); gr.addColorStop(1, 'rgba(60,50,40,0.13)');
        g.fillStyle = gr; g.fillRect(x, 0, 6 + rnd() * 16, H);
      }
      g.fillStyle = 'rgba(0,0,0,0.14)'; g.fillRect(0, H - 12, W, 12);
    }
    const glass = (x, y, w, h) => {
      const grd = g.createLinearGradient(0, y, 0, y + h);
      if (emissive) { grd.addColorStop(0, '#ffe2a8'); grd.addColorStop(1, '#ffc46b'); }
      else { grd.addColorStop(0, '#46607a'); grd.addColorStop(0.5, '#1e2c3d'); grd.addColorStop(1, '#10161f'); }
      g.fillStyle = grd; g.fillRect(x, y, w, h);
    };
    if (kind === 'old') {
      const wx = 124, wy = 40, ww = 72, wh = 128;
      if (!emissive) { g.fillStyle = '#e6dfcf'; g.fillRect(wx - 8, wy - 10, ww + 16, wh + 18); }
      glass(wx, wy, ww, wh);
      if (!emissive) {
        g.strokeStyle = '#efe8d8'; g.lineWidth = 4; g.strokeRect(wx + 2, wy + 2, ww - 4, wh - 4);
        g.beginPath(); g.moveTo(wx + ww / 2, wy); g.lineTo(wx + ww / 2, wy + wh); g.stroke();
        // persiane verdi aperte
        const shut = (x) => { g.fillStyle = '#3d6b4a'; g.fillRect(x, wy - 6, 38, wh + 12); g.fillStyle = 'rgba(0,0,0,0.3)'; for (let y = wy; y < wy + wh + 6; y += 7) g.fillRect(x + 3, y, 32, 2.5); };
        shut(wx - 8 - 40); shut(wx + ww + 8 + 2);
        // balconcino in ferro battuto
        g.fillStyle = '#cfc8b8'; g.fillRect(wx - 26, wy + wh + 6, ww + 52, 8);
        g.strokeStyle = '#1b1d20'; g.lineWidth = 2;
        for (let x = wx - 24; x <= wx + ww + 24; x += 8) { g.beginPath(); g.moveTo(x, wy + wh + 6); g.lineTo(x, wy + wh - 34); g.stroke(); }
        g.beginPath(); g.moveTo(wx - 26, wy + wh - 34); g.lineTo(wx + ww + 26, wy + wh - 34); g.stroke();
      }
    } else if (kind === 'modern') {
      const wx = 70, wy = 36, ww = 180, wh = 136;
      glass(wx, wy, ww, wh);
      if (!emissive) {
        g.strokeStyle = '#d8d6cf'; g.lineWidth = 6; g.strokeRect(wx, wy, ww, wh);
        g.beginPath(); g.moveTo(wx + ww / 2, wy); g.lineTo(wx + ww / 2, wy + wh); g.stroke();
        g.fillStyle = '#d4d0c4'; g.fillRect(wx - 20, wy + wh + 2, ww + 40, 12);
        g.fillStyle = 'rgba(40,60,70,0.45)'; g.fillRect(wx - 20, wy + wh - 50, ww + 40, 52);
        g.strokeStyle = '#a9aeb2'; g.lineWidth = 2; g.strokeRect(wx - 20, wy + wh - 50, ww + 40, 52);
      }
    } else if (kind === 'tower') {
      if (!emissive) { g.fillStyle = 'rgba(70,66,60,0.25)'; g.fillRect(0, 0, W, 16); g.fillStyle = 'rgba(255,255,255,0.18)'; g.fillRect(0, 128, W, 4); }
      glass(30, 52, 120, 70); glass(170, 52, 120, 70);
      if (!emissive) {
        g.strokeStyle = '#8d897f'; g.lineWidth = 5; g.strokeRect(30, 52, 120, 70); g.strokeRect(170, 52, 120, 70);
        g.fillStyle = '#9c978a'; g.fillRect(24, 124, 132, 10); g.fillRect(164, 124, 132, 10);
        g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(24, 136, 132, 20); g.fillRect(164, 136, 132, 20); // sottobalcone
        // panni stesi sui balconi
        const cols = ['#e8e4dc', '#c63b3b', '#3b6bc6', '#e3c43b'];
        for (let x = 40; x < 280; x += 36) { g.fillStyle = cols[(x / 36 | 0) % 4]; g.fillRect(x, 150, 20, 26); }
      }
    } else { // shed
      if (!emissive) {
        g.fillStyle = '#b8b4a6'; g.fillRect(0, 0, W, H);
        g.fillStyle = 'rgba(0,0,0,0.12)'; for (let x = 0; x < W; x += 16) g.fillRect(x, 0, 3, H);
      }
      glass(40, 30, 240, 40);
      if (!emissive) { g.fillStyle = '#5a5e63'; g.fillRect(100, 130, 120, 134); g.fillStyle = 'rgba(0,0,0,0.3)'; for (let y = 134; y < 262; y += 10) g.fillRect(104, y, 112, 3); }
    }
    return toTex(c);
  };
  return { map: draw(false), emissive: draw(true) };
}

const rect = (g, x, y, w, h, c) => { g.fillStyle = c; g.fillRect(x, y, w, h); };
const circ = (g, x, y, r, c) => { g.fillStyle = c; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); };

/** Murales procedurali (5 stili) 512x1024 */
export function muralTexture(kind) {
  const W = 512, H = 1024, c = makeCanvas(W, H), g = c.getContext('2d');
  if (kind === 0) { // Diego
    const sky = g.createLinearGradient(0, 0, 0, H); sky.addColorStop(0, '#5fb3ee'); sky.addColorStop(1, '#bfe6ff'); g.fillStyle = sky; g.fillRect(0, 0, W, H);
    for (let i = 0; i < 6; i++) circ(g, 60 + rnd() * 400, 60 + rnd() * 300, 40 + rnd() * 50, 'rgba(255,255,255,0.6)');
    // maglia
    g.fillStyle = '#7ec8f2'; g.beginPath(); g.moveTo(60, 1024); g.lineTo(90, 640); g.quadraticCurveTo(256, 560, 422, 640); g.lineTo(452, 1024); g.fill();
    g.fillStyle = '#ffffff'; for (let x = 100; x < 420; x += 70) g.fillRect(x, 650, 34, 374);
    g.fillStyle = '#16427a'; g.font = 'bold 190px Arial'; g.textAlign = 'center'; g.fillText('10', 256, 900);
    // collo e volto
    rect(g, 216, 560, 80, 90, '#c98a62');
    g.fillStyle = '#d9996e'; g.beginPath(); g.ellipse(256, 440, 120, 150, 0, 0, 7); g.fill();
    g.fillStyle = '#1b130f'; g.beginPath(); g.ellipse(256, 330, 150, 105, 0, Math.PI, 7); g.fill();
    for (let i = 0; i < 70; i++) circ(g, 120 + rnd() * 270, 290 + rnd() * 90, 22 + rnd() * 14, '#1b130f');
    circ(g, 212, 440, 12, '#fff'); circ(g, 300, 440, 12, '#fff'); circ(g, 214, 442, 6, '#241610'); circ(g, 302, 442, 6, '#241610');
    g.strokeStyle = '#7a4a30'; g.lineWidth = 7; g.beginPath(); g.moveTo(256, 450); g.lineTo(246, 505); g.lineTo(270, 505); g.stroke();
    g.beginPath(); g.moveTo(215, 540); g.quadraticCurveTo(256, 565, 300, 540); g.stroke();
    g.fillStyle = 'rgba(255,255,255,0.95)'; g.font = 'bold 74px Arial'; g.fillText('D10S', 256, 130);
  } else if (kind === 1) { // volto stile Jorit
    g.fillStyle = '#d9d2c4'; g.fillRect(0, 0, W, H);
    for (let i = 0; i < 18; i++) rect(g, rnd() * W, 0, 6 + rnd() * 20, H, `rgba(90,80,70,${0.05 + rnd() * 0.08})`);
    g.fillStyle = '#7a5a46'; g.beginPath(); g.ellipse(256, 480, 190, 300, 0, 0, 7); g.fill();
    g.fillStyle = '#9c7258'; g.beginPath(); g.ellipse(256, 470, 150, 270, 0, 0, 7); g.fill();
    g.fillStyle = '#e9d9c4'; g.beginPath(); g.ellipse(190, 400, 52, 28, 0, 0, 7); g.fill(); g.beginPath(); g.ellipse(322, 400, 52, 28, 0, 0, 7); g.fill();
    circ(g, 190, 402, 22, '#2a1d14'); circ(g, 322, 402, 22, '#2a1d14'); circ(g, 184, 396, 6, '#fff'); circ(g, 316, 396, 6, '#fff');
    g.strokeStyle = '#d9242b'; g.lineWidth = 16; for (const o of [0, 26, 52]) { g.beginPath(); g.moveTo(160 + o * 0.3, 450 + o); g.lineTo(220 + o * 0.3, 470 + o); g.moveTo(352 - o * 0.3, 450 + o); g.lineTo(292 - o * 0.3, 470 + o); g.stroke(); }
    g.strokeStyle = '#3a2418'; g.lineWidth = 12; g.beginPath(); g.moveTo(256, 420); g.lineTo(240, 540); g.lineTo(280, 545); g.stroke();
    g.beginPath(); g.moveTo(200, 640); g.quadraticCurveTo(256, 680, 312, 640); g.stroke();
    g.fillStyle = '#18100c'; g.beginPath(); g.ellipse(256, 230, 200, 130, 0, Math.PI, 7); g.fill();
  } else if (kind === 2) { // Pulcinella
    g.fillStyle = '#f0b44a'; g.fillRect(0, 0, W, H); for (let i = 0; i < 20; i++) circ(g, rnd() * W, rnd() * H, 40 + rnd() * 80, `rgba(255,${200 + rnd() * 55 | 0},120,0.25)`);
    g.fillStyle = '#fafafa'; g.beginPath(); g.moveTo(80, 1024); g.lineTo(130, 560); g.lineTo(382, 560); g.lineTo(432, 1024); g.fill();
    g.fillStyle = '#fafafa'; g.beginPath(); g.moveTo(190, 250); g.lineTo(256, 20); g.lineTo(322, 250); g.fill();
    g.strokeStyle = '#222'; g.lineWidth = 6; g.stroke();
    g.fillStyle = '#e9c9a6'; g.beginPath(); g.ellipse(256, 400, 120, 140, 0, 0, 7); g.fill();
    g.fillStyle = '#17120f'; g.beginPath(); g.ellipse(256, 380, 125, 85, 0, Math.PI * 1.02, Math.PI * 1.98 + 3.14); g.fill();
    g.beginPath(); g.moveTo(200, 360); g.quadraticCurveTo(256, 330, 312, 360); g.lineTo(330, 450); g.quadraticCurveTo(256, 520, 182, 450); g.fill();
    circ(g, 222, 400, 10, '#fff'); circ(g, 290, 400, 10, '#fff');
    g.fillStyle = '#17120f'; g.beginPath(); g.moveTo(250, 420); g.quadraticCurveTo(360, 450, 390, 560); g.lineTo(340, 560); g.quadraticCurveTo(300, 480, 250, 460); g.fill();
    g.fillStyle = '#d4302f'; for (let i = 0; i < 6; i++) circ(g, 256, 640 + i * 60, 10, '#d4302f');
  } else if (kind === 3) { // Vesuvio al tramonto
    const sky = g.createLinearGradient(0, 0, 0, H); sky.addColorStop(0, '#2a1d5a'); sky.addColorStop(0.45, '#e7603a'); sky.addColorStop(0.7, '#ffb347'); sky.addColorStop(1, '#1d6a9c'); g.fillStyle = sky; g.fillRect(0, 0, W, H);
    circ(g, 360, 470, 70, '#ffe08a');
    g.fillStyle = '#2a1b1a'; g.beginPath(); g.moveTo(0, 760); g.lineTo(150, 560); g.lineTo(230, 500); g.lineTo(256, 520); g.lineTo(290, 490); g.lineTo(380, 600); g.lineTo(512, 760); g.fill();
    g.fillStyle = '#ff7a2f'; g.beginPath(); g.moveTo(230, 500); g.lineTo(256, 400); g.lineTo(290, 490); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.95)'; g.font = 'bold 110px Arial'; g.textAlign = 'center'; g.fillText('NAPULE', 256, 190);
    g.font = 'bold 54px Arial'; g.fillText('è mille culure', 256, 260);
  } else { // astratto + forza napoli
    g.fillStyle = '#16427a'; g.fillRect(0, 0, W, H);
    const cols = ['#7ec8f2', '#ffffff', '#f0b44a', '#d9242b', '#3aa357'];
    for (let i = 0; i < 26; i++) { g.fillStyle = cols[i % 5]; g.globalAlpha = 0.55; g.beginPath(); g.ellipse(rnd() * W, rnd() * H, 30 + rnd() * 120, 20 + rnd() * 90, rnd() * 3, 0, 7); g.fill(); }
    g.globalAlpha = 1; g.fillStyle = '#fff'; g.font = 'bold 120px Arial'; g.textAlign = 'center'; g.fillText('FORZA', 256, 600); g.fillText('NAPOLI', 256, 730);
    g.fillStyle = '#7ec8f2'; g.font = 'bold 60px Arial'; g.fillText('SEMPRE', 256, 820);
  }
  g.globalAlpha = 1;
  return toTex(c, { repeat: false });
}

export function terrainDetailTexture() {
  const c = makeCanvas(256, 256), g = c.getContext('2d');
  g.fillStyle = '#c8c8c8'; g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 9000; i++) { const v = 150 + rnd() * 100; g.fillStyle = `rgba(${v | 0},${v | 0},${v | 0},0.45)`; g.fillRect(rnd() * 256, rnd() * 256, 1 + rnd() * 5, 1 + rnd() * 5); }
  return toTex(c);
}

export function seaNormalTexture() {
  const N = 256, h = new Float32Array(N * N);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const u = (x / N) * Math.PI * 2, v = (y / N) * Math.PI * 2;
    h[y * N + x] = Math.sin(u * 3 + Math.sin(v * 2) * 1.5) * 0.5 + Math.sin(v * 5 + u) * 0.3 + Math.sin(u * 9 - v * 7) * 0.15;
  }
  const c = makeCanvas(N, N), g = c.getContext('2d'), im = g.createImageData(N, N);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const dx = h[y * N + ((x + 1) % N)] - h[y * N + ((x + N - 1) % N)], dy = h[((y + 1) % N) * N + x] - h[((y + N - 1) % N) * N + x];
    const i = (y * N + x) * 4; im.data[i] = 128 + dx * 70; im.data[i + 1] = 128 + dy * 70; im.data[i + 2] = 255; im.data[i + 3] = 255;
  }
  g.putImageData(im, 0, 0);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
}

export function stripedAwningTexture() {
  const c = makeCanvas(64, 64), g = c.getContext('2d');
  const cols = ['#d9242b', '#f4f1e8'];
  for (let i = 0; i < 8; i++) { g.fillStyle = cols[i % 2]; g.fillRect(i * 8, 0, 8, 64); }
  return toTex(c);
}

export function crossTexture() {
  const c = makeCanvas(128, 128), g = c.getContext('2d');
  g.fillStyle = '#f7f7f7'; g.fillRect(0, 0, 128, 128);
  g.fillStyle = '#d9202a'; g.fillRect(48, 16, 32, 96); g.fillRect(16, 48, 96, 32);
  return toTex(c, { repeat: false });
}
