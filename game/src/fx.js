import * as THREE from 'three';
import { glowTexture } from './textures.js';

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
  update(dt) {
    for (let i = this.items.length - 1; i >= 0; i--) {
      const it = this.items[i];
      it.life -= dt;
      if (it.obj.material && it.obj.material.opacity !== undefined && it.obj.isLine) it.obj.material.opacity = Math.max(0, it.life / it.max);
      if (it.life <= 0) {
        this.scene.remove(it.obj);
        if (it.geo) it.geo.dispose();
        this.items.splice(i, 1);
      }
    }
  }
}
