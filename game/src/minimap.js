import { WORLD, H_ROADS, V_ROADS, Q } from './layout.js';
import { TAU } from './util.js';

const S = 2; // pixel per metro nella mappa pre-renderizzata

export class MapRenderer {
  constructor(layout) {
    this.layout = layout;
    this.S = S;
    this.canvas = document.createElement('canvas');
    this.canvas.width = (WORLD.x1 - WORLD.x0) * S;
    this.canvas.height = (WORLD.z1 - WORLD.z0) * S;
    this.render();
  }

  P(x, z) { return [(x - WORLD.x0) * S, (z - WORLD.z0) * S]; }

  render() {
    const c = this.canvas, g = c.getContext('2d'), L = this.layout;
    const rect = (r, color) => { const [x, y] = this.P(r.x0, r.z0); g.fillStyle = color; g.fillRect(x, y, (r.x1 - r.x0) * S, (r.z1 - r.z0) * S); };
    g.fillStyle = '#26333c'; g.fillRect(0, 0, c.width, c.height);
    for (const b of L.blocks) rect(b, '#3a4752');
    for (const p of L.parks) rect(p, '#3f6f48');
    for (const p of L.plazas) rect(p, '#79796c');
    // strade
    g.fillStyle = '#cfd2d4';
    for (const r of H_ROADS) { const [x, y] = this.P(WORLD.x0, r.z - r.w / 2); g.fillRect(x, y, c.width, r.w * S); }
    for (const r of V_ROADS) { const [x, y] = this.P(r.x - r.w / 2, WORLD.z0); g.fillRect(x, y, r.w * S, c.height); }
    g.strokeStyle = 'rgba(80,90,100,.55)'; g.lineWidth = 1.5; g.setLineDash([10, 8]);
    for (const r of H_ROADS) { const [x, y] = this.P(WORLD.x0, r.z); g.beginPath(); g.moveTo(x, y); g.lineTo(x + c.width, y); g.stroke(); }
    for (const r of V_ROADS) { const [x, y] = this.P(r.x, WORLD.z0); g.beginPath(); g.moveTo(x, y); g.lineTo(x, y + c.height); g.stroke(); }
    g.setLineDash([]);
    // edifici
    for (const b of L.buildings) rect(b, b.name ? '#8a7f6e' : '#5f6d78');
    // Questura evidenziata + piazzale
    rect(Q, '#2d5bd9');
    rect({ x0: Q.yard.x0, x1: Q.yard.x1, z0: Q.yard.z0, z1: Q.yard.z1 }, '#2a3a63');
    // stagni, fontane
    for (const d of L.decor) {
      if (d.type === 'pond' || d.type === 'fountain') {
        const [x, y] = this.P(d.x, d.z); g.fillStyle = '#4a86b5'; g.beginPath(); g.arc(x, y, (d.r || 3) * S, 0, TAU); g.fill();
      }
    }
    // alberi
    g.fillStyle = 'rgba(70,140,80,.55)';
    for (const t of L.trees) { if (t.edge) continue; const [x, y] = this.P(t.x, t.z); g.beginPath(); g.arc(x, y, 2.2 * S * t.s, 0, TAU); g.fill(); }
    // nomi strade
    g.fillStyle = 'rgba(30,40,50,.8)'; g.font = 'bold 13px Arial'; g.textAlign = 'center';
    for (const r of H_ROADS) { const [x, y] = this.P(-95, r.z); g.fillText(r.name.toUpperCase(), x, y + 4); const [x2] = this.P(100, r.z); g.fillText(r.name.toUpperCase(), x2, y + 4); }
    for (const r of V_ROADS) {
      for (const zz of [-70, 70]) { const [x, y] = this.P(r.x, zz); g.save(); g.translate(x, y); g.rotate(-Math.PI / 2); g.fillText(r.name.toUpperCase(), 0, 4); g.restore(); }
    }
    // POI
    g.font = 'bold 15px Arial'; g.fillStyle = '#fff'; g.strokeStyle = '#0b1220'; g.lineWidth = 4; g.lineJoin = 'round';
    for (const p of L.pois) {
      const [x, y] = this.P(p.x, p.z);
      g.strokeText(p.name, x, y - 14); g.fillText(p.name, x, y - 14);
    }
  }

  // ---- minimappa rotante ----
  drawMini(ctx, size, px, pz, yaw, zoom, blips, facing, time) {
    const R = size / 2;
    ctx.clearRect(0, 0, size, size);
    ctx.save();
    ctx.beginPath(); ctx.arc(R, R, R - 3, 0, TAU); ctx.clip();
    ctx.fillStyle = '#1a242e'; ctx.fillRect(0, 0, size, size);
    ctx.translate(R, R); ctx.rotate(yaw);
    ctx.scale(zoom / S, zoom / S);
    ctx.translate(-(px - WORLD.x0) * S, -(pz - WORLD.z0) * S);
    ctx.drawImage(this.canvas, 0, 0);
    ctx.restore();

    const cos = Math.cos(yaw), sin = Math.sin(yaw);
    const toScr = (x, z) => {
      const dx = x - px, dz = z - pz;
      return [R + (dx * cos - dz * sin) * zoom, R + (dx * sin + dz * cos) * zoom];
    };
    for (const b of blips) {
      let [sx, sy] = toScr(b.x, b.z);
      const dx = sx - R, dy = sy - R, d = Math.hypot(dx, dy), lim = R - 14;
      let edge = false;
      if (d > lim) { sx = R + (dx / d) * lim; sy = R + (dy / d) * lim; edge = true; }
      const pulse = 1 + Math.sin(time * 5) * 0.15;
      ctx.beginPath(); ctx.arc(sx, sy, (edge ? 7 : 9) * pulse, 0, TAU);
      ctx.fillStyle = b.color || '#ffd24a'; ctx.fill();
      ctx.lineWidth = 3; ctx.strokeStyle = '#0b1220'; ctx.stroke();
      if (!edge) { ctx.beginPath(); ctx.arc(sx, sy, 14 * pulse, 0, TAU); ctx.strokeStyle = (b.color || '#ffd24a') + '99'; ctx.lineWidth = 2; ctx.stroke(); }
    }
    // freccia del giocatore
    const fa = facing === undefined ? 0 : facing;
    const fx = Math.sin(fa), fz = Math.cos(fa);
    const ax = fx * cos - fz * sin, ay = fx * sin + fz * cos;
    const ang = Math.atan2(ay, ax);
    ctx.save(); ctx.translate(R, R); ctx.rotate(ang + Math.PI / 2);
    ctx.beginPath(); ctx.moveTo(0, -13); ctx.lineTo(9, 10); ctx.lineTo(0, 5); ctx.lineTo(-9, 10); ctx.closePath();
    ctx.fillStyle = '#fff'; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = '#2f6bff'; ctx.stroke();
    ctx.restore();
    // N
    ctx.save(); ctx.translate(R, R); ctx.rotate(yaw);
    ctx.fillStyle = '#fff'; ctx.font = 'bold 15px Arial'; ctx.textAlign = 'center'; ctx.fillText('N', 0, -(R - 8)); ctx.restore();
  }

  // ---- mappa intera (selezione spawn / tasto M) ----
  drawFull(ctx, w, h, { player, spawns, selected, blips, pois } = {}) {
    ctx.clearRect(0, 0, w, h);
    const sc = Math.min(w / this.canvas.width, h / this.canvas.height);
    const ox = (w - this.canvas.width * sc) / 2, oy = (h - this.canvas.height * sc) / 2;
    ctx.drawImage(this.canvas, ox, oy, this.canvas.width * sc, this.canvas.height * sc);
    const toS = (x, z) => [ox + (x - WORLD.x0) * S * sc, oy + (z - WORLD.z0) * S * sc];
    this._tr = { ox, oy, sc };
    if (spawns) {
      spawns.forEach((s, i) => {
        const [x, y] = toS(s.x, s.z), sel = s.id === selected;
        ctx.beginPath(); ctx.arc(x, y, sel ? 16 : 12, 0, TAU);
        ctx.fillStyle = sel ? '#ffd24a' : '#2f6bff'; ctx.fill();
        ctx.lineWidth = 3; ctx.strokeStyle = '#fff'; ctx.stroke();
        ctx.fillStyle = sel ? '#111' : '#fff'; ctx.font = 'bold 14px Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(String(i + 1), x, y + 1);
      });
    }
    for (const b of blips || []) {
      const [x, y] = toS(b.x, b.z);
      ctx.beginPath(); ctx.arc(x, y, 9, 0, TAU); ctx.fillStyle = b.color || '#ffd24a'; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = '#0b1220'; ctx.stroke();
    }
    if (player) {
      const [x, y] = toS(player.x, player.z);
      ctx.save(); ctx.translate(x, y); ctx.rotate(Math.PI - (player.facing || 0));
      ctx.beginPath(); ctx.moveTo(0, -13); ctx.lineTo(9, 10); ctx.lineTo(0, 5); ctx.lineTo(-9, 10); ctx.closePath();
      ctx.fillStyle = '#fff'; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = '#2f6bff'; ctx.stroke(); ctx.restore();
    }
  }

  /** da pixel canvas -> mondo (per click sulla mappa spawn) */
  pickWorld(px, py) {
    const t = this._tr; if (!t) return null;
    return { x: (px - t.ox) / (S * t.sc) + WORLD.x0, z: (py - t.oy) / (S * t.sc) + WORLD.z0 };
  }
}
