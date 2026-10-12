import { WORLD, VESUVIO } from './napoli.js';
import { TAU } from './util.js';

const FS = 0.34; // px per metro nella mappa completa

export class MapRenderer {
  constructor(world) {
    this.world = world; this.city = world.city;
    this.full = document.createElement('canvas');
    this.full.width = Math.ceil((WORLD.x1 - WORLD.x0) * FS);
    this.full.height = Math.ceil((WORLD.z1 - WORLD.z0 + 80) * FS);
    // indice spaziale degli edifici
    this.cell = 128; this.bgrid = new Map();
    for (const b of this.city.buildings) {
      for (let i = Math.floor(b.x0 / this.cell); i <= Math.floor(b.x1 / this.cell); i++) for (let j = Math.floor(b.z0 / this.cell); j <= Math.floor(b.z1 / this.cell); j++) {
        const k = i * 9973 + j; let a = this.bgrid.get(k); if (!a) this.bgrid.set(k, (a = [])); a.push(b);
      }
    }
    this.renderFull();
  }

  P(x, z) { return [(x - WORLD.x0) * FS, (z - WORLD.z0) * FS]; }

  renderFull() {
    const c = this.full, g = c.getContext('2d'), C = this.city;
    g.fillStyle = '#26333c'; g.fillRect(0, 0, c.width, c.height);
    const rect = (x0, z0, x1, z1, col) => { const [a, b] = this.P(x0, z0); g.fillStyle = col; g.fillRect(a, b, (x1 - x0) * FS, (z1 - z0) * FS); };
    rect(WORLD.x0, WORLD.z0, WORLD.x1, 0, '#4b5a44');
    // Vesuvio
    const [vx, vz] = this.P(VESUVIO.x, VESUVIO.z);
    const gr = g.createRadialGradient(vx, vz, 0, vx, vz, VESUVIO.R * FS);
    gr.addColorStop(0, '#2b2522'); gr.addColorStop(0.35, '#4c4038'); gr.addColorStop(0.7, '#5d6b45'); gr.addColorStop(1, 'rgba(75,90,68,0)');
    g.fillStyle = gr; g.beginPath(); g.arc(vx, vz, VESUVIO.R * FS, 0, TAU); g.fill();
    for (const d of C.districts) rect(d.rect.x0, d.rect.z0, d.rect.x1, d.rect.z1, '#58585a');
    for (const p of C.plazas) rect(p.rect.x0, p.rect.z0, p.rect.x1, p.rect.z1, p.kind === 'park' ? '#3f6f48' : '#87867a');
    for (const b of C.buildings) rect(b.x0, b.z0, b.x1, b.z1, b.name ? '#8a7f6e' : '#6d6c6b');
    g.fillStyle = '#d0d3d6';
    for (const l of C.roads.H) { const [a, b] = this.P(l.x0, l.z - l.w / 2); g.fillRect(a, b, (l.x1 - l.x0) * FS, Math.max(1.2, l.w * FS)); }
    for (const l of C.roads.V) { const [a, b] = this.P(l.x - l.w / 2, l.z0); g.fillRect(a, b, Math.max(1.2, l.w * FS), (l.z1 - l.z0) * FS); }
    rect(WORLD.x0, 0, WORLD.x1, WORLD.z1 + 80, '#1f5f8a');
    g.font = 'bold 15px Arial'; g.textAlign = 'center'; g.fillStyle = '#fff'; g.strokeStyle = '#0b1220'; g.lineWidth = 4; g.lineJoin = 'round';
    for (const p of C.pois) { if (p.icon === 'hospital' || p.faction) continue; const [x, y] = this.P(p.x, p.z); g.strokeText(p.name, x, y - 8); g.fillText(p.name, x, y - 8); }
    g.font = 'bold 13px Arial'; g.fillStyle = '#aee'; const [sx, sy] = this.P(500, 60); g.fillText('GOLFO DI NAPOLI', sx, sy);
  }

  // ---- minimappa rotante dinamica ----
  drawMini(ctx, size, px, pz, yaw, zoom, blips, facing, time, icons = []) {
    const R = size / 2, C = this.city;
    ctx.clearRect(0, 0, size, size);
    ctx.save();
    ctx.beginPath(); ctx.arc(R, R, R - 3, 0, TAU); ctx.clip();
    ctx.fillStyle = '#3a4a34'; ctx.fillRect(0, 0, size, size);
    ctx.translate(R, R); ctx.rotate(yaw); ctx.scale(zoom, zoom); ctx.translate(-px, -pz);
    const range = R / zoom * 1.5;
    // mare
    ctx.fillStyle = '#245f86'; ctx.fillRect(px - range, 0, range * 2, range + 50);
    ctx.fillStyle = '#58585a';
    for (const d of C.districts) { const r = d.rect; if (r.x1 < px - range || r.x0 > px + range || r.z1 < pz - range || r.z0 > pz + range) continue; ctx.fillRect(r.x0, r.z0, r.x1 - r.x0, r.z1 - r.z0); }
    for (const p of C.plazas) { const r = p.rect; if (r.x1 < px - range || r.x0 > px + range || r.z1 < pz - range || r.z0 > pz + range) continue; ctx.fillStyle = p.kind === 'park' ? '#3f6f48' : '#87867a'; ctx.fillRect(r.x0, r.z0, r.x1 - r.x0, r.z1 - r.z0); }
    // edifici nel raggio
    ctx.fillStyle = '#707070';
    const seen = new Set();
    for (let i = Math.floor((px - range) / this.cell); i <= Math.floor((px + range) / this.cell); i++) for (let j = Math.floor((pz - range) / this.cell); j <= Math.floor((pz + range) / this.cell); j++) {
      const a = this.bgrid.get(i * 9973 + j); if (!a) continue;
      for (const b of a) { if (seen.has(b)) continue; seen.add(b); ctx.fillStyle = b.name ? '#9a8d7a' : '#727272'; ctx.fillRect(b.x0, b.z0, b.x1 - b.x0, b.z1 - b.z0); }
    }
    // strade
    ctx.fillStyle = '#d2d5d8';
    for (const l of C.roads.H) { if (Math.abs(l.z - pz) > range + l.w || l.x1 < px - range || l.x0 > px + range) continue; ctx.fillRect(l.x0, l.z - l.w / 2, l.x1 - l.x0, l.w); }
    for (const l of C.roads.V) { if (Math.abs(l.x - px) > range + l.w || l.z1 < pz - range || l.z0 > pz + range) continue; ctx.fillRect(l.x - l.w / 2, l.z0, l.w, l.z1 - l.z0); }
    // sedi
    for (const ic of icons) { ctx.fillStyle = ic.color; ctx.beginPath(); ctx.arc(ic.x, ic.z, 9 / zoom * 1.2, 0, TAU); ctx.fill(); ctx.lineWidth = 2 / zoom; ctx.strokeStyle = '#fff'; ctx.stroke(); }
    ctx.restore();

    const cos = Math.cos(yaw), sin = Math.sin(yaw);
    const toScr = (x, z) => { const dx = x - px, dz = z - pz; return [R + (dx * cos - dz * sin) * zoom, R + (dx * sin + dz * cos) * zoom]; };
    for (const b of blips) {
      let [sx, sy] = toScr(b.x, b.z);
      const dx = sx - R, dy = sy - R, d = Math.hypot(dx, dy), lim = R - 14;
      let edge = false;
      if (d > lim) { sx = R + (dx / d) * lim; sy = R + (dy / d) * lim; edge = true; }
      const pulse = 1 + Math.sin(time * 5) * 0.15;
      ctx.beginPath(); ctx.arc(sx, sy, (edge ? 7 : 9) * pulse, 0, TAU); ctx.fillStyle = b.color || '#ffd24a'; ctx.fill();
      ctx.lineWidth = 3; ctx.strokeStyle = '#0b1220'; ctx.stroke();
      if (!edge) { ctx.beginPath(); ctx.arc(sx, sy, 14 * pulse, 0, TAU); ctx.strokeStyle = (b.color || '#ffd24a') + '99'; ctx.lineWidth = 2; ctx.stroke(); }
    }
    const fa = facing === undefined ? 0 : facing;
    const fx = Math.sin(fa), fz = Math.cos(fa);
    const ang = Math.atan2(fx * sin + fz * cos, fx * cos - fz * sin);
    ctx.save(); ctx.translate(R, R); ctx.rotate(ang + Math.PI / 2);
    ctx.beginPath(); ctx.moveTo(0, -13); ctx.lineTo(9, 10); ctx.lineTo(0, 5); ctx.lineTo(-9, 10); ctx.closePath();
    ctx.fillStyle = '#fff'; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = '#2f6bff'; ctx.stroke(); ctx.restore();
    ctx.save(); ctx.translate(R, R); ctx.rotate(yaw); ctx.fillStyle = '#fff'; ctx.font = 'bold 15px Arial'; ctx.textAlign = 'center'; ctx.fillText('N', 0, -(R - 8)); ctx.restore();
  }

  // ---- mappa completa (selezione spawn / tasto M) ----
  drawFull(ctx, w, h, { player, spawns, selected, blips, icons } = {}) {
    ctx.clearRect(0, 0, w, h);
    const sc = Math.min(w / this.full.width, h / this.full.height);
    const ox = (w - this.full.width * sc) / 2, oy = (h - this.full.height * sc) / 2;
    ctx.drawImage(this.full, ox, oy, this.full.width * sc, this.full.height * sc);
    const toS = (x, z) => [ox + (x - WORLD.x0) * FS * sc, oy + (z - WORLD.z0) * FS * sc];
    this._tr = { ox, oy, sc };
    for (const ic of icons || []) { const [x, y] = toS(ic.x, ic.z); ctx.beginPath(); ctx.arc(x, y, 7, 0, TAU); ctx.fillStyle = ic.color; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = '#fff'; ctx.stroke(); }
    if (spawns) spawns.forEach((s, i) => {
      const [x, y] = toS(s.x, s.z), sel = s.id === selected;
      ctx.beginPath(); ctx.arc(x, y, sel ? 15 : 11, 0, TAU); ctx.fillStyle = sel ? '#ffd24a' : '#2f6bff'; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = '#fff'; ctx.stroke();
      ctx.fillStyle = sel ? '#111' : '#fff'; ctx.font = 'bold 13px Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(String(i + 1), x, y + 1);
    });
    for (const b of blips || []) { const [x, y] = toS(b.x, b.z); ctx.beginPath(); ctx.arc(x, y, 9, 0, TAU); ctx.fillStyle = b.color || '#ffd24a'; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = '#0b1220'; ctx.stroke(); }
    if (player) {
      const [x, y] = toS(player.x, player.z);
      ctx.save(); ctx.translate(x, y); ctx.rotate(Math.PI - (player.facing || 0));
      ctx.beginPath(); ctx.moveTo(0, -13); ctx.lineTo(9, 10); ctx.lineTo(0, 5); ctx.lineTo(-9, 10); ctx.closePath();
      ctx.fillStyle = '#fff'; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = '#2f6bff'; ctx.stroke(); ctx.restore();
    }
  }
  pickWorld(px, py) { const t = this._tr; if (!t) return null; return { x: (px - t.ox) / (FS * t.sc) + WORLD.x0, z: (py - t.oy) / (FS * t.sc) + WORLD.z0 }; }
}
