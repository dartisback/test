import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { makeRng, dampAngle, clamp } from './util.js';

const SHIRTS = [0xe8e4dc, 0x3b6bc6, 0xc63b3b, 0x2f2f33, 0x58a05f, 0xe3c43b, 0x8a4fb0, 0xf09a3a, 0x6b7a8c, 0xd9d2c0, 0x1f3b6b, 0xb0b0b0, 0xe58aa0];
const PANTS = [0x2c3e5e, 0x1b1b1f, 0x4b4033, 0x6a6a6e, 0x3d5a80, 0x2a2a2a, 0xc2b8a0, 0x23324a];
const SKINS = [0xf1c8a5, 0xd9a283, 0xb77c58, 0x8a5a3c, 0xe8b894, 0x6b4430];
const HAIR = [0x1b130e, 0x3a2a1c, 0x6b4a2a, 0xb08a4a, 0x9a9a9a, 0x0d0d0d, 0x7a3a1a];

const M = new THREE.Matrix4(), R = new THREE.Matrix4(), P = new THREE.Matrix4(), Q = new THREE.Quaternion(), E = new THREE.Euler(), V = new THREE.Vector3(), S1 = new THREE.Vector3(1, 1, 1);

/** Folla di cittadini istanziati: ~250 pedoni sui marciapiedi, animazione a arti. */
export class Crowd {
  constructor(world, scene, max = 260) {
    this.world = world; this.max = max;
    this.rnd = makeRng(777);
    this.peds = [];
    this.group = new THREE.Group(); scene.add(this.group);
    const mk = (geo, color = 0xffffff, rough = 0.85) => {
      const im = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ color, roughness: rough }), max);
      im.castShadow = false; im.frustumCulled = false; im.count = 0; this.group.add(im); return im;
    };
    this.torso = mk(new RoundedBoxGeometry(0.4, 0.56, 0.22, 2, 0.07));
    this.head = mk(new THREE.SphereGeometry(0.105, 10, 8));
    this.hair = mk(new THREE.SphereGeometry(0.11, 10, 8, 0, Math.PI * 2, 0, Math.PI * 0.55));
    this.legL = mk(new THREE.CapsuleGeometry(0.07, 0.72, 3, 6));
    this.legR = mk(new THREE.CapsuleGeometry(0.07, 0.72, 3, 6));
    this.armL = mk(new THREE.CapsuleGeometry(0.05, 0.46, 3, 6));
    this.armR = mk(new THREE.CapsuleGeometry(0.05, 0.46, 3, 6));
    this.parts = [this.torso, this.head, this.hair, this.legL, this.legR, this.armL, this.armR];
    this.hits = []; // eventi investimento
    this.target = 120;
    this.respawn = 0;
  }

  spawnOne(px, pz) {
    const w = this.world, g = w.graph, rnd = this.rnd;
    const e = g.randomEdge(rnd, px, pz, 25, 125);
    if (!e) return null;
    const t = rnd() * e.len;
    const l = e.line;
    const side = rnd() < 0.5 ? 1 : -1;
    const off = (l.w / 2 + (l.sw > 0 ? l.sw * (0.3 + rnd() * 0.5) : 0.7)) * side;
    const x = e.a.x + e.dx * t - e.dz * off;
    const zz = e.a.z + e.dz * t + e.dx * off;
    const d = w.district(x, zz);
    const dens = d ? d.ped : 0.15;
    if (rnd() > dens + 0.15) return null;
    const p = {
      x, z: zz, y: w.groundY(x, zz), yaw: Math.atan2(e.dx, e.dz), e, t, side, off, speed: 1.1 + rnd() * 0.6, vs: 0, phase: rnd() * 6, state: 'walk', timer: 0,
      run: rnd() < 0.06, stopT: 0, idx: 0, fall: 0, scale: 0.92 + rnd() * 0.16,
      c: [SHIRTS[(rnd() * SHIRTS.length) | 0], PANTS[(rnd() * PANTS.length) | 0], SKINS[(rnd() * SKINS.length) | 0], HAIR[(rnd() * HAIR.length) | 0]],
    };
    if (p.run) p.speed = 2.6 + rnd() * 1.2;
    return p;
  }

  scare(x, z, r) {
    for (const p of this.peds) {
      if (p.state === 'down') continue;
      if ((p.x - x) ** 2 + (p.z - z) ** 2 < r * r) { p.state = 'flee'; p.timer = 4 + this.rnd() * 3; p.fx = p.x - x; p.fz = p.z - z; const l = Math.hypot(p.fx, p.fz) || 1; p.fx /= l; p.fz /= l; }
    }
  }

  update(dt, px, pz, vehicles, playerOnFoot) {
    const w = this.world, g = w.graph, rnd = this.rnd;
    const d = w.district(px, pz);
    this.target = Math.round(70 + 190 * (d ? d.ped : 0.2));
    // spawn / despawn
    this.respawn -= dt;
    if (this.peds.length < this.target && this.respawn <= 0) {
      for (let k = 0; k < 6; k++) { const p = this.spawnOne(px, pz); if (p) { this.peds.push(p); this.colorsDirty = true; } }
      this.respawn = 0.05;
    }
    for (let i = this.peds.length - 1; i >= 0; i--) {
      const p = this.peds[i];
      const dd = Math.hypot(p.x - px, p.z - pz);
      if (dd > 150 || (this.peds.length > this.target + 30 && dd > 80)) { this.peds.splice(i, 1); this.colorsDirty = true; }
    }
    this.hits.length = 0;
    // movimento
    for (const p of this.peds) {
      p.timer -= dt;
      if (p.state === 'down') {
        p.fall = Math.min(1, p.fall + dt * 4);
        if (p.timer <= 0) { p.state = 'walk'; p.fall = 0; }
        continue;
      }
      // pericoli: veicoli
      for (const v of vehicles) {
        const sp = v.speed !== undefined ? v.speed : 0;
        if (sp < 1.5) continue;
        const dx = p.x - v.x, dz = p.z - v.z, dist = Math.hypot(dx, dz);
        if (dist > 14) continue;
        if (dist < 1.9 + (v.type ? v.type.W * 0.3 : 0.6) && sp > 3.5) {
          p.state = 'down'; p.timer = 4 + rnd() * 3; p.fall = 0; this.hits.push({ ped: p, vehicle: v, speed: sp }); break;
        }
        if (dist < 9 && p.state !== 'flee') { p.state = 'flee'; p.timer = 2.5; p.fx = dx / (dist || 1); p.fz = dz / (dist || 1); }
      }
      if (p.state === 'down') continue;
      if (p.state === 'flee') {
        const sp = 4.4;
        p.x += p.fx * sp * dt; p.z += p.fz * sp * dt;
        p.yaw = dampAngle(p.yaw, Math.atan2(p.fx, p.fz), 12, dt);
        p.vs = sp;
        const q = { x: p.x, z: p.z }; w.grid.resolveCircle(q, 0.35, p.y + 1.6); p.x = q.x; p.z = q.z;
        if (p.timer <= 0) { p.state = 'walk'; this.rejoin(p); }
        p.y = w.groundY(p.x, p.z);
        continue;
      }
      // sosta
      if (p.stopT > 0) { p.stopT -= dt; p.vs = 0; continue; }
      if (rnd() < dt * 0.012) { p.stopT = 2 + rnd() * 6; continue; }
      // cammina lungo l'arco
      const e = p.e;
      p.t += p.speed * dt; p.vs = p.speed;
      if (p.t >= e.len - 0.8) {
        const nodeAdj = e.b.adj;
        let opts = nodeAdj.filter((q) => q.b !== e.a);
        if (!opts.length) opts = nodeAdj;
        if (!opts.length) { this.peds.splice(this.peds.indexOf(p), 1); continue; }
        p.e = opts[(rnd() * opts.length) | 0]; p.t = 0.5;
        const l = p.e.line; p.off = (l.w / 2 + (l.sw > 0 ? l.sw * (0.3 + rnd() * 0.5) : 0.7)) * p.side;
      }
      const e2 = p.e;
      const nx = e2.a.x + e2.dx * p.t - e2.dz * p.off, nz = e2.a.z + e2.dz * p.t + e2.dx * p.off;
      // movimento fluido verso il punto sul marciapiede
      const lx = nx - p.x, lz = nz - p.z, ll = Math.hypot(lx, lz);
      if (ll > 0.001) { const st = Math.min(ll, p.speed * dt * 1.5 + 0.02); p.x += (lx / ll) * st; p.z += (lz / ll) * st; p.yaw = dampAngle(p.yaw, Math.atan2(lx, lz), 8, dt); }
      p.y = w.groundY(p.x, p.z);
      if (playerOnFoot) {
        const dx = p.x - px, dz = p.z - pz, dist = Math.hypot(dx, dz);
        if (dist < 0.7 && dist > 0.001) { p.x += (dx / dist) * (0.7 - dist); p.z += (dz / dist) * (0.7 - dist); }
      }
      p.phase += dt * p.speed * 4.2;
    }
    this.render();
  }

  rejoin(p) {
    const g = this.world.graph;
    const n = g.nearest(p.x, p.z, 120);
    if (n && n.adj.length) { p.e = n.adj[(this.rnd() * n.adj.length) | 0]; p.t = 0.5; const l = p.e.line; p.off = (l.w / 2 + (l.sw > 0 ? l.sw * 0.5 : 0.7)) * p.side; }
  }

  render() {
    const n = this.peds.length;
    for (const m of this.parts) m.count = n;
    const col = new THREE.Color();
    this.peds.forEach((p, i) => {
      const sp = clamp(p.vs / 1.5, 0, 2.2);
      const sw = Math.sin(p.phase) * 0.55 * Math.min(1, sp * 0.8 + 0.0) * (p.run ? 1.3 : 1);
      const down = p.state === 'down';
      const lean = p.run ? 0.15 : 0;
      // radice
      E.set(down ? -Math.PI / 2 * p.fall : 0, p.yaw, 0, 'YXZ'); Q.setFromEuler(E);
      V.set(p.x, p.y + (down ? 0.2 * p.fall : 0), p.z);
      const s = p.scale; const sv = new THREE.Vector3(s, s, s);
      M.compose(V, Q, sv);
      const put = (mesh, lx, ly, lz, rx = 0, cy = 0) => {
        // pivot (lx,ly,lz), rotazione rx attorno a x, centro del solido a cy sotto il pivot
        E.set(rx, 0, 0); Q.setFromEuler(E);
        P.compose(V.set(lx, ly, lz), Q, S1); P.multiply(R.makeTranslation(0, cy, 0));
        P.premultiply(M);
        mesh.setMatrixAt(i, P);
      };
      put(this.torso, 0, 1.23, 0, lean);
      put(this.head, 0, 1.69, 0.0 + lean * 0.3);
      put(this.hair, 0, 1.705, -0.005 + lean * 0.3);
      put(this.legL, -0.095, 0.88, 0, sw, -0.44);
      put(this.legR, 0.095, 0.88, 0, -sw, -0.44);
      put(this.armL, -0.255, 1.45, 0, -sw * 0.9, -0.28);
      put(this.armR, 0.255, 1.45, 0, sw * 0.9, -0.28);
    });
    if (this.colorsDirty || this.lastN !== n) {
      this.colorsDirty = false; this.lastN = n;
    this.peds.forEach((p, i) => {
      this.torso.setColorAt(i, col.setHex(p.c[0])); this.head.setColorAt(i, col.setHex(p.c[2])); this.hair.setColorAt(i, col.setHex(p.c[3]));
      this.legL.setColorAt(i, col.setHex(p.c[1])); this.legR.setColorAt(i, col.setHex(p.c[1]));
      this.armL.setColorAt(i, col.setHex(p.c[2])); this.armR.setColorAt(i, col.setHex(p.c[2]));
    });
    for (const m of this.parts) if (m.instanceColor) m.instanceColor.needsUpdate = true;
    }
    for (const m of this.parts) m.instanceMatrix.needsUpdate = true;
  }
}
