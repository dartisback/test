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

/** Decalcomania laterale delle volanti: fascia bianca + POLIZIA + filetto tricolore. */
export function liveryTexture() {
  const W = 1024, H = 256;
  const c = makeCanvas(W, H), g = c.getContext('2d');
  g.clearRect(0, 0, W, H);
  // fascia bianca ondulata
  g.fillStyle = '#f3f5f7';
  g.beginPath();
  g.moveTo(0, 120); g.bezierCurveTo(260, 60, 560, 70, 1024, 20);
  g.lineTo(1024, 150); g.bezierCurveTo(600, 175, 300, 190, 0, 215);
  g.closePath(); g.fill();
  // filetto tricolore
  const stripe = (col, off) => {
    g.strokeStyle = col; g.lineWidth = 7;
    g.beginPath(); g.moveTo(0, 226 + off); g.bezierCurveTo(300, 200 + off, 600, 186 + off, 1024, 160 + off); g.stroke();
  };
  stripe('#cd212a', 0); stripe('#009246', 9);
  // scritta
  g.save();
  g.translate(520, 112);
  g.rotate(-0.045);
  g.fillStyle = '#17489c';
  g.font = 'italic bold 118px Arial'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText('POLIZIA', 0, 0);
  g.restore();
  const t = toTex(c, { repeat: false });
  return t;
}

export function plateTexture(text = 'POLIZIA M5553') {
  const c = makeCanvas(256, 56), g = c.getContext('2d');
  g.fillStyle = '#f4f4ee'; g.fillRect(0, 0, 256, 56);
  g.strokeStyle = '#1f3d8a'; g.lineWidth = 4; g.strokeRect(2, 2, 252, 52);
  g.fillStyle = '#1b1b1b'; g.font = 'bold 30px Arial'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(text, 128, 30);
  return toTex(c, { repeat: false });
}
