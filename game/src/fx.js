import * as THREE from 'three';
import { glowTexture, makeCanvas } from './textures.js';

// Effetti rapidi: lampo di bocca, tracciante, scintille d'impatto.
export class FX {
  constructor(scene) {
    this.scene = scene;
    this.items = [];
    this.glow = glowTexture();
    this.flashMat = new THREE.SpriteMaterial({ map: this.glow, color: 0xffe0a0, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true });
    this.taserMat = new THREE.SpriteMaterial({ map: this.glow, color: 0x7fb7ff, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true });
    this.lineMat = new THREE.LineBasicMaterial({ color: 0xffe9a8, transparent: true, opacity: 0.9 });
    this.arcMat = new THREE.LineBasicMaterial({ color: 0x9cc8ff, transparent: true, opacity: 0.95 });
    // fuoco, fumo, acqua
    this.fires = []; this.drops = []; this.smokes = [];
    this.flameMats = [0xff7a1a, 0xffb02e, 0xff4a0f].map((c) => new THREE.SpriteMaterial({ map: this.glow, color: c, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.9 }));
    this.dropMat = new THREE.SpriteMaterial({ map: this.glow, color: 0x9fd8ff, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.85 });
    const c = makeCanvas(64, 64), g = c.getContext('2d');
    const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(70,70,70,0.7)'); gr.addColorStop(1, 'rgba(70,70,70,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    const st = new THREE.CanvasTexture(c);
    this.smokeMat = new THREE.SpriteMaterial({ map: st, transparent: true, depthWrite: false, opacity: 0.6 });
    this.fireLight = new THREE.PointLight(0xff7a2a, 0, 40, 1.6); scene.add(this.fireLight);
  }

  // ---------- fuoco ----------
  addFire(x, y, z, size = 1, health = 100) {
    const f = { x, y, z, size, health, max: health, sprites: [], alive: true, t: Math.random() * 10 };
    const n = Math.round(5 + size * 5);
    for (let i = 0; i < n; i++) {
      const sp = new THREE.Sprite(this.flameMats[i % 3]);
      sp.userData = { ox: (Math.random() - 0.5) * size * 1.6, oz: (Math.random() - 0.5) * size * 1.6, ph: Math.random() * 6, h: Math.random() };
      this.scene.add(sp); f.sprites.push(sp);
    }
    this.fires.push(f); return f;
  }
  removeFire(f) { f.alive = false; for (const s of f.sprites) this.scene.remove(s); f.sprites.length = 0; const i = this.fires.indexOf(f); if (i >= 0) this.fires.splice(i, 1); }
  smoke(x, y, z, s = 1) {
    if (this.smokes.length > 90) return;
    const sp = new THREE.Sprite(this.smokeMat.clone()); sp.position.set(x, y, z); sp.scale.setScalar(1.2 * s);
    this.scene.add(sp); this.smokes.push({ sp, life: 2.8, max: 2.8, vy: 1.4 + Math.random(), s });
  }
  /** getto d'acqua dalla lancia */
  spray(origin, dir, dt) {
    const n = Math.max(1, Math.round(dt * 160));
    for (let i = 0; i < n; i++) {
      if (this.drops.length > 260) break;
      const sp = new THREE.Sprite(this.dropMat); sp.scale.setScalar(0.28 + Math.random() * 0.2);
      sp.position.copy(origin);
      const v = dir.clone().multiplyScalar(19 + Math.random() * 3); v.x += (Math.random() - 0.5) * 1.2; v.y += (Math.random() - 0.5) * 1.2; v.z += (Math.random() - 0.5) * 1.2;
      this.scene.add(sp); this.drops.push({ sp, v, life: 1.6 });
    }
  }
  update(dt) {
    for (let i = this.items.length - 1; i >= 0; i--) {
      const it = this.items[i];
      it.life -= dt;
      if (it.obj.material && it.obj.isLine) it.obj.material.opacity = Math.max(0, it.life / it.max);
      if (it.life <= 0) { this.scene.remove(it.obj); if (it.geo) it.geo.dispose(); this.items.splice(i, 1); }
    }
    // acqua
    for (let i = this.drops.length - 1; i >= 0; i--) {
      const d = this.drops[i];
      d.life -= dt; d.v.y -= 9 * dt; d.sp.position.addScaledVector(d.v, dt);
      let hit = d.sp.position.y < (this.groundAt ? this.groundAt(d.sp.position.x, d.sp.position.z) : 0) + 0.1;
      for (const f of this.fires) {
        const dx = f.x - d.sp.position.x, dy = f.y + f.size - d.sp.position.y, dz = f.z - d.sp.position.z;
        if (dx * dx + dy * dy + dz * dz < (1.3 + f.size) ** 2) { f.health -= 2.4; hit = true; this.onFireHit && this.onFireHit(f); break; }
      }
      if (d.life <= 0 || hit) { this.scene.remove(d.sp); this.drops.splice(i, 1); }
    }
    // fiamme
    let light = 0, lx = 0, ly = 0, lz = 0;
    for (const f of [...this.fires]) {
      f.t += dt;
      const k = Math.max(0, f.health / f.max);
      if (f.health <= 0) { this.removeFire(f); continue; }
      for (const s of f.sprites) {
        const u = s.userData, ph = f.t * 5 + u.ph;
        const h = (0.5 + 0.5 * Math.sin(ph)) * f.size * (1 + u.h);
        s.position.set(f.x + u.ox + Math.sin(ph * 0.7) * 0.15, f.y + h * 0.9 + 0.2, f.z + u.oz);
        s.scale.setScalar((1.3 + Math.sin(ph) * 0.4) * f.size * (0.4 + 0.6 * k));
        s.material.opacity = 0.55 + 0.4 * k;
      }
      if (Math.random() < dt * 5) this.smoke(f.x + (Math.random() - 0.5) * f.size, f.y + f.size * 1.5, f.z + (Math.random() - 0.5) * f.size, f.size);
      light = Math.max(light, 90 * f.size * k); lx = f.x; ly = f.y + 2; lz = f.z;
    }
    this.fireLight.intensity = light; this.fireLight.position.set(lx, ly, lz);
    for (let i = this.smokes.length - 1; i >= 0; i--) {
      const m = this.smokes[i]; m.life -= dt;
      m.sp.position.y += m.vy * dt; m.sp.scale.setScalar((1.2 + (1 - m.life / m.max) * 3.5) * m.s); m.sp.material.opacity = 0.5 * (m.life / m.max);
      if (m.life <= 0) { this.scene.remove(m.sp); m.sp.material.dispose(); this.smokes.splice(i, 1); }
    }
  }
  flash(pos, taser = false) {
    const s = new THREE.Sprite(taser ? this.taserMat : this.flashMat);
    s.scale.setScalar(taser ? 0.5 : 0.7); s.position.copy(pos);
    this.scene.add(s); this.items.push({ obj: s, life: 0.06, max: 0.06 });
  }
  tracer(a, b, taser = false) {
    const geo = new THREE.BufferGeometry().setFromPoints(taser ? this._arc(a, b) : [a.clone(), b.clone()]);
    const l = new THREE.Line(geo, (taser ? this.arcMat : this.lineMat).clone());
    this.scene.add(l); this.items.push({ obj: l, life: 0.09, max: 0.09, geo });
  }
  _arc(a, b) {
    const pts = [a.clone()];
    const n = 10;
    for (let i = 1; i < n; i++) {
      const p = a.clone().lerp(b, i / n);
      p.x += (Math.random() - 0.5) * 0.25; p.y += (Math.random() - 0.5) * 0.25; p.z += (Math.random() - 0.5) * 0.25;
      pts.push(p);
    }
    pts.push(b.clone());
    return pts;
  }
  spark(pos) {
    const s = new THREE.Sprite(this.flashMat);
    s.scale.setScalar(0.35); s.position.copy(pos);
    this.scene.add(s); this.items.push({ obj: s, life: 0.12, max: 0.12 });
  }
}
