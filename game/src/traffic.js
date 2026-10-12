import * as THREE from 'three';
import { ExtrudeGeometry } from 'three';
import { makeRng, clamp, angleDiff, dampAngle } from './util.js';
import { Batch } from './batch.js';
import { PathDriver } from './ai.js';

const CAR_COLORS = [0xe9e9e6, 0xc9c9c6, 0x2b2b30, 0x8a8f96, 0xb5342a, 0x2c4f8f, 0x4d6b4a, 0xd9c9a0, 0x6d3f2a, 0xe0b53a, 0x1c1c1f, 0xaeb7c0];

function extrude(pts, width, bevel = 0.05) {
  const sh = new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x, y)));
  const geo = new ExtrudeGeometry(sh, { depth: width - bevel * 2, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 2, curveSegments: 1 });
  geo.translate(0, 0, -(width - bevel * 2) / 2); geo.rotateY(-Math.PI / 2); return geo;
}

function buildModel(kind) {
  const b = new Batch(), I = new THREE.Matrix4();
  const white = [1, 1, 1], glass = [0.04, 0.05, 0.07], black = [0.02, 0.02, 0.02];
  let L, W, wb, r = 0.32;
  if (kind === 'van') {
    L = 4.7; W = 1.95; wb = 2.9;
    b.addGeometry(extrude([[-2.35, 0.35], [2.3, 0.35], [2.38, 0.6], [2.3, 1.0], [1.9, 1.15], [1.45, 1.95], [1.3, 2.2], [-2.3, 2.2], [-2.38, 2.0], [-2.38, 0.5]], W, 0.05), I, white);
    const ws = new THREE.BoxGeometry(W - 0.3, 0.03, 0.9).rotateX(0.95).translate(0, 1.58, 1.62); b.addGeometry(ws, I, glass);
    for (const sx of [-1, 1]) b.addGeometry(new THREE.BoxGeometry(0.02, 0.5, 1.0).translate(sx * (W / 2 + 0.005), 1.55, 1.3), I, glass);
  } else {
    const lower = kind === 'hatch' ? [[-2.0, 0.3], [2.0, 0.3], [2.08, 0.46], [2.02, 0.7], [1.3, 0.88], [0.85, 0.97], [-1.8, 0.97], [-2.06, 0.9], [-2.08, 0.44]] : [[-2.2, 0.3], [2.18, 0.3], [2.25, 0.46], [2.2, 0.7], [1.5, 0.88], [0.95, 0.97], [-1.55, 0.97], [-2.1, 0.96], [-2.25, 0.84], [-2.25, 0.44]];
    const cabin = kind === 'hatch' ? [[0.9, 0.96], [0.25, 1.38], [-1.1, 1.42], [-1.9, 1.1], [-2.0, 0.96]] : [[0.95, 0.96], [0.3, 1.38], [-0.95, 1.4], [-1.7, 1.04], [-1.75, 0.96]];
    L = kind === 'hatch' ? 4.1 : 4.5; W = kind === 'hatch' ? 1.74 : 1.8; wb = kind === 'hatch' ? 2.5 : 2.7;
    b.addGeometry(extrude(lower, W, 0.06), I, white);
    b.addGeometry(extrude(cabin, W - 0.28, 0.025), I, glass);
    b.addGeometry(new THREE.BoxGeometry(W - 0.24, 0.045, 1.3).translate(0, 1.4, kind === 'hatch' ? -0.35 : -0.3), I, white);
  }
  for (const sz of [-1, 1]) for (const sx of [-1, 1]) {
    const m = new THREE.Matrix4().makeTranslation(sx * (W / 2 - 0.03), r, sz * wb / 2);
    b.addGeometry(new THREE.CylinderGeometry(r, r, 0.22, 14).rotateZ(Math.PI / 2), m, black);
  }
  const geo = b.geometry();
  geo.userData = { L, W, wb };
  return geo;
}

/** Traffico civile cinematico guidato dal grafo stradale (modelli istanziati). */
export class Traffic {
  constructor(world, scene, max = 56) {
    this.world = world; this.max = max;
    this.rnd = makeRng(4242);
    this.cars = [];
    this.group = new THREE.Group(); scene.add(this.group);
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.35, metalness: 0.4 });
    this.kinds = ['sedan', 'hatch', 'van'];
    this.meshes = {};
    this.dims = {};
    for (const k of this.kinds) {
      const geo = buildModel(k);
      this.dims[k] = geo.userData;
      const im = new THREE.InstancedMesh(geo, mat, max); im.count = 0; im.frustumCulled = false; im.castShadow = true;
      this.group.add(im); this.meshes[k] = im;
    }
    this.headM = new THREE.InstancedMesh(new THREE.BoxGeometry(0.38, 0.12, 0.05), new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff2cc, emissiveIntensity: 0 }), max * 2);
    this.tailM = new THREE.InstancedMesh(new THREE.BoxGeometry(0.4, 0.12, 0.05), new THREE.MeshStandardMaterial({ color: 0x550000, emissive: 0xff1a1a, emissiveIntensity: 0 }), max * 2);
    for (const m of [this.headM, this.tailM]) { m.count = 0; m.frustumCulled = false; this.group.add(m); }
    this.claims = new Map();
    this.spawnT = 0;
    this.target = 30;
  }

  _mkCar(kind, e, t) {
    const w = this.world, rnd = this.rnd;
    const d = this.dims[kind];
    const lane = Math.min(1.9, e.line.w / 2 - 0.9);
    const x = e.a.x + e.dx * t - e.dz * lane, z = e.a.z + e.dz * t + e.dx * lane;
    const car = {
      kind, x, z, y: w.groundY(x, z), h: Math.atan2(e.dx, e.dz), v: 0, vx: 0, vz: 0, speed: 0,
      type: { W: d.W, L: d.L, mass: kind === 'van' ? 1.6 : 1.0 },
      circles: [], color: CAR_COLORS[(rnd() * CAR_COLORS.length) | 0], factor: 0.8 + rnd() * 0.3, wait: 0, crash: 0, impact: 0,
      driver: new PathDriver(w.graph, rnd, { lane, look: 7, wander: true }), emergency: false, hidden: false, isTraffic: true,
    };
    const r = d.W / 2 + 0.05, n = 3;
    car.circles = Array.from({ length: n }, (_, i) => ({ o: -(d.L / 2 - r) + (i * (d.L - 2 * r)) / (n - 1), r }));
    car.driver.path = [e.a, e.b]; car.driver.i = 0; car.driver.done = false; car.driver.extend();
    return car;
  }

  spawn(px, pz) {
    const w = this.world, g = w.graph, rnd = this.rnd;
    const e = g.randomEdge(rnd, px, pz, 70, 190);
    if (!e || e.len < 14) return;
    const dd = w.district((e.a.x + e.b.x) / 2, (e.a.z + e.b.z) / 2);
    const dens = (dd ? dd.traffic : 0.25) + (e.line.kind === 'main' || e.line.kind === 'coast' ? 0.25 : 0);
    if (rnd() > dens) return;
    const t = 4 + rnd() * (e.len - 8);
    const kind = this.kinds[(rnd() * 3) | 0];
    const car = this._mkCar(kind, e, t);
    for (const o of this.cars) if ((o.x - car.x) ** 2 + (o.z - car.z) ** 2 < 100) return;
    if ((car.x - px) ** 2 + (car.z - pz) ** 2 < 55 * 55) return;
    car.v = 4;
    this.cars.push(car);
  }

  /** others: veicoli fisici + pedoni; emergencies: veicoli con sirena */
  update(dt, px, pz, obstacles, peds, emergencies) {
    const w = this.world, rnd = this.rnd;
    const dd = w.district(px, pz);
    this.target = Math.round(12 + 44 * (dd ? dd.traffic : 0.25));
    this.spawnT -= dt;
    if (this.cars.length < this.target && this.spawnT <= 0) { for (let k = 0; k < 3; k++) this.spawn(px, pz); this.spawnT = 0.15; }
    for (let i = this.cars.length - 1; i >= 0; i--) {
      const c = this.cars[i];
      const d2 = (c.x - px) ** 2 + (c.z - pz) ** 2;
      if (d2 > 230 * 230 || (this.cars.length > this.target + 8 && d2 > 130 * 130)) this.cars.splice(i, 1);
    }
    const now = performance.now() / 1000;
    for (const c of this.cars) {
      // dopo urti fisici: riprendi velocità dalla proiezione
      const sh = Math.sin(c.h), ch = Math.cos(c.h);
      if (c.impact > 0.5) { c.v = Math.max(0, c.vx * sh + c.vz * ch); c.crash = Math.max(c.crash, c.impact > 3 ? 4 : 1.2); }
      c.impact = 0;
      if (c.crash > 0) { c.crash -= dt; c.v = Math.max(0, c.v - 14 * dt); }
      const a = c.driver.aim(c.x, c.z);
      let want = a.done ? 0 : Math.min(a.limit * c.factor, a.limit);
      // ostacoli davanti
      const look = 5 + c.v * 1.3;
      const scanList = (list, wid, stopDist) => {
        for (const o of list) {
          if (o === c) continue;
          const dx = o.x - c.x, dz = o.z - c.z;
          if (Math.abs(dx) > 30 || Math.abs(dz) > 30) continue;
          const f = dx * sh + dz * ch, l = dx * ch - dz * sh;
          const half = (o.type ? o.type.W / 2 : 0.4) + wid;
          if (f > 0.5 && f < look + (o.type ? o.type.L / 2 : 0) && Math.abs(l) < half) want = Math.min(want, Math.max(0, (f - stopDist) * 0.9));
        }
      };
      scanList(this.cars, 1.0, 4.2);
      scanList(obstacles, 1.0, 4.5);
      scanList(peds, 0.5, 3.2);
      // cedi il passo ai mezzi di emergenza con sirena
      for (const em of emergencies) {
        const dx = c.x - em.x, dz = c.z - em.z, dist = Math.hypot(dx, dz);
        if (dist < 45) { const fwd = Math.sin(em.h) * dx + Math.cos(em.h) * dz; if (fwd > 0) want = Math.min(want, 2.5); }
      }
      // precedenza ai nodi
      const b = c.driver.path[c.driver.i + 1];
      if (b) {
        const dEnd = Math.hypot(b.x - c.x, b.z - c.z);
        if (dEnd < 14 && b.adj.length > 2) {
          const cl = this.claims.get(b.id);
          if (cl && cl.car !== c && now - cl.t < 2.4 && c.wait < 4) { want = Math.min(want, dEnd < 8 ? 0 : 3); c.wait += dt; }
          else { this.claims.set(b.id, { car: c, t: now }); c.wait = Math.max(0, c.wait - dt); }
        } else c.wait = Math.max(0, c.wait - dt * 0.5);
      }
      const dv = want - c.v;
      c.v += clamp(dv, -8 * dt, 2.6 * dt);
      if (c.v < 0.05 && want < 0.1) c.v = 0;
      // sterzo verso il punto bersaglio
      if (c.v > 0.1) {
        const hd = Math.atan2(a.tx - c.x, a.tz - c.z);
        const rate = clamp(c.v * 0.5, 0.7, 2.6);
        c.h += clamp(angleDiff(c.h, hd), -rate * dt, rate * dt);
      }
      const nsh = Math.sin(c.h), nch = Math.cos(c.h);
      c.x += nsh * c.v * dt; c.z += nch * c.v * dt;
      // muri
      const y = w.groundY(c.x, c.z); c.y = y;
      for (const k of [-1.3, 1.3]) {
        const p = { x: c.x + nsh * k, z: c.z + nch * k }, ox = p.x, oz = p.z;
        const r = w.grid.resolveCircle(p, 0.85, y + 1.6);
        if (r.hit) { c.x += p.x - ox; c.z += p.z - oz; c.v *= 0.8; }
      }
      c.vx = nsh * c.v; c.vz = nch * c.v; c.speed = c.v;
    }
    this.render();
  }

  render() {
    const counts = { sedan: 0, hatch: 0, van: 0 };
    const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), E = new THREE.Euler(), V = new THREE.Vector3(), S = new THREE.Vector3(1, 1, 1);
    const col = new THREE.Color();
    let hi = 0;
    const night = this.world.nightAmt || 0;
    for (const c of this.cars) {
      const im = this.meshes[c.kind], i = counts[c.kind]++;
      E.set(0, c.h, 0); Q.setFromEuler(E); V.set(c.x, c.y + 0.02, c.z); M.compose(V, Q, S);
      im.setMatrixAt(i, M); im.setColorAt(i, col.setHex(c.color));
      const d = this.dims[c.kind];
      const lh = c.kind === 'van' ? 0.95 : 0.76;
      for (const sx of [-0.62, 0.62]) {
        V.set(sx, lh, d.L / 2 - 0.05).applyMatrix4(M); const P = new THREE.Matrix4().compose(V, Q, S); this.headM.setMatrixAt(hi, P);
        V.set(sx, lh + 0.1, -d.L / 2 + 0.03).applyMatrix4(M); const P2 = new THREE.Matrix4().compose(V, Q, S); this.tailM.setMatrixAt(hi, P2); hi++;
      }
    }
    for (const k of this.kinds) { this.meshes[k].count = counts[k]; this.meshes[k].instanceMatrix.needsUpdate = true; if (this.meshes[k].instanceColor) this.meshes[k].instanceColor.needsUpdate = true; }
    this.headM.count = this.tailM.count = hi;
    this.headM.instanceMatrix.needsUpdate = this.tailM.instanceMatrix.needsUpdate = true;
    this.headM.material.emissiveIntensity = night * 3; this.tailM.material.emissiveIntensity = 0.4 + night * 2.5;
  }
}
