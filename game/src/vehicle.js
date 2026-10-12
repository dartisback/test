import * as THREE from 'three';
import { clamp, damp, TAU } from './util.js';
import * as T from './textures.js';

export const CAR_TYPES = {
  giulia: {
    id: 'giulia', name: 'Alfa Romeo Giulia', desc: 'Berlina di Pronto Intervento. Potente e veloce.',
    L: 4.64, W: 1.86, wb: 2.82, vmax: 58, accel: 12.5, steerMax: 0.58,
    lower: [[-2.28, 0.30], [2.26, 0.30], [2.32, 0.46], [2.27, 0.70], [1.55, 0.88], [0.98, 0.97], [-1.6, 0.97], [-2.18, 0.96], [-2.32, 0.84], [-2.32, 0.44]],
    cabin: [[1.0, 0.96], [0.28, 1.40], [-1.0, 1.42], [-1.78, 1.04], [-1.8, 0.96]],
    roofX: [-1.0, 0.28], plate: 'POLIZIA M7085',
  },
  giulietta: {
    id: 'giulietta', name: 'Alfa Romeo Giulietta', desc: 'Compatta agile, ideale per il centro storico.',
    L: 4.35, W: 1.80, wb: 2.63, vmax: 52, accel: 11, steerMax: 0.62,
    lower: [[-2.12, 0.30], [2.1, 0.30], [2.17, 0.46], [2.12, 0.70], [1.4, 0.88], [0.9, 0.97], [-1.9, 0.97], [-2.16, 0.9], [-2.18, 0.44]],
    cabin: [[0.95, 0.96], [0.25, 1.40], [-1.2, 1.44], [-2.0, 1.12], [-2.12, 0.96]],
    roofX: [-1.2, 0.25], plate: 'POLIZIA M5553',
  },
};

let sharedTex = null;
const shared = () => {
  if (sharedTex) return sharedTex;
  sharedTex = { livery: T.liveryTexture() };
  return sharedTex;
};

const extrudeProfile = (pts, width, bevel = 0.05) => {
  const sh = new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x, y)));
  const geo = new THREE.ExtrudeGeometry(sh, { depth: Math.max(0.01, width - bevel * 2), bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 3, curveSegments: 1 });
  geo.translate(0, 0, -(width - bevel * 2) / 2);
  geo.rotateY(-Math.PI / 2);
  return geo;
};

export class Vehicle {
  constructor(typeId, world) {
    this.type = CAR_TYPES[typeId];
    this.typeId = typeId;
    this.world = world;
    this.group = new THREE.Group();
    this.group.name = `volante-${typeId}`;
    this.x = 0; this.z = 0; this.h = 0;
    this.vx = 0; this.vz = 0;
    this.steer = 0; this.speed = 0; this.vf = 0;
    this.pitch = 0; this.roll = 0; this.accel = 0;
    this.wheelSpin = 0;
    this.yawRate = 0;
    this.siren = false;
    this.lightsOn = false;
    this.braking = false;
    this.occupied = false;
    this.locked = true;
    this.impact = 0;
    this.build();
    this.circles = this._makeCircles();
  }

  _makeCircles() {
    const L = this.type.L, r = this.type.W / 2 + 0.02;
    return [-(L / 2 - 0.85), 0, L / 2 - 0.85].map((o) => ({ o, r }));
  }

  build() {
    const t = this.type;
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0x2149b0, roughness: 0.3, metalness: 0.35 });
    const whiteMat = new THREE.MeshStandardMaterial({ color: 0xf2f4f7, roughness: 0.35, metalness: 0.3 });
    const glassMat = new THREE.MeshStandardMaterial({ color: 0x141c26, roughness: 0.06, metalness: 0.85 });
    const black = new THREE.MeshStandardMaterial({ color: 0x0d0e10, roughness: 0.6, metalness: 0.3 });
    const chrome = new THREE.MeshStandardMaterial({ color: 0xc8ccd2, roughness: 0.2, metalness: 1 });
    this.body = new THREE.Group(); this.group.add(this.body);
    const add = (m, parent = this.body) => { m.castShadow = true; parent.add(m); return m; };

    add(new THREE.Mesh(extrudeProfile(t.lower, t.W, 0.06), bodyMat));
    add(new THREE.Mesh(extrudeProfile(t.cabin, t.W - 0.28, 0.025), glassMat));
    // tetto blu
    const roofL = t.roofX[1] - t.roofX[0];
    const roof = add(new THREE.Mesh(new THREE.BoxGeometry(t.W - 0.24, 0.045, roofL), bodyMat));
    roof.position.set(0, 1.425, (t.roofX[0] + t.roofX[1]) / 2);
    // montanti B e C
    for (const sx of [-1, 1]) {
      const b = add(new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.46, 0.1), bodyMat)); b.position.set(sx * (t.W / 2 - 0.15), 1.2, -0.28);
      const a = add(new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.5, 0.07), bodyMat));
      a.position.set(sx * (t.W / 2 - 0.15), 1.18, 0.62); a.rotation.x = -0.9;
    }
    // fascia bianca / livrea
    const liv = shared().livery;
    const decalMat = new THREE.MeshStandardMaterial({ map: liv, transparent: true, roughness: 0.4, metalness: 0.2, polygonOffset: true, polygonOffsetFactor: -2, depthWrite: false });
    for (const sx of [-1, 1]) {
      const d = new THREE.Mesh(new THREE.PlaneGeometry(3.7, 0.74), decalMat);
      d.position.set(sx * (t.W / 2 + 0.003), 0.64, -0.12); d.rotation.y = sx * Math.PI / 2;
      this.body.add(d);
    }
    // passaruota
    for (const sz of [-1, 1]) for (const sx of [-1, 1]) {
      const a = new THREE.Mesh(new THREE.CircleGeometry(0.4, 20), black);
      a.position.set(sx * (t.W / 2 + 0.002), 0.34, sz * t.wb / 2); a.rotation.y = sx * Math.PI / 2;
      this.body.add(a);
    }
    // fascia bianca sul cofano
    const hoodStripe = add(new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.012, 1.1), whiteMat));
    hoodStripe.position.set(0, 0.935 - 0.0, t.L / 2 - 1.55); hoodStripe.rotation.x = 0.28;
    // griglia e scudetto
    add(new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.17, 0.05), black)).position.set(0, 0.58, t.L / 2 + 0.05);
    const scud = add(new THREE.Mesh(new THREE.ConeGeometry(0.15, 0.2, 3), new THREE.MeshStandardMaterial({ color: 0x2a2d31, roughness: 0.3, metalness: 0.8 })));
    scud.position.set(0, 0.6, t.L / 2 + 0.07); scud.rotation.set(Math.PI / 2, 0, Math.PI);
    add(new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.13, 0.05), black)).position.set(0, 0.4, t.L / 2 + 0.02);
    add(new THREE.Mesh(new THREE.BoxGeometry(t.W - 0.1, 0.1, 0.06), black)).position.set(0, 0.32, t.L / 2 - 0.02);
    add(new THREE.Mesh(new THREE.BoxGeometry(t.W - 0.1, 0.1, 0.06), black)).position.set(0, 0.32, -t.L / 2 + 0.02);
    // fari
    this.headMat = new THREE.MeshStandardMaterial({ color: 0xe8f2ff, emissive: 0xfff4d6, emissiveIntensity: 0.05, roughness: 0.1, metalness: 0.2 });
    this.tailMat = new THREE.MeshStandardMaterial({ color: 0x6a0a0a, emissive: 0xff1010, emissiveIntensity: 0.15, roughness: 0.3 });
    for (const sx of [-1, 1]) {
      const h = add(new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.12, 0.06), this.headMat)); h.position.set(sx * 0.65, 0.78, t.L / 2 - 0.12); h.rotation.set(-0.35, sx * -0.22, 0);
      const l = add(new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.13, 0.05), this.tailMat)); l.position.set(sx * 0.62, 0.9, -t.L / 2 + 0.01);
    }
    // targhe
    for (const [z, rot, txt] of [[t.L / 2 + 0.09, 0, t.plate], [-t.L / 2 - 0.09, Math.PI, t.plate]]) {
      const p = new THREE.Mesh(new THREE.PlaneGeometry(0.52, 0.113), new THREE.MeshBasicMaterial({ map: T.plateTexture(txt) }));
      p.position.set(0, 0.42, z); p.rotation.y = rot; this.body.add(p);
    }
    // specchietti
    for (const sx of [-1, 1]) {
      const m = add(new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.12, 0.1), bodyMat)); m.position.set(sx * (t.W / 2 + 0.1), 1.06, 0.62);
    }
    // interni: sedili + volante + cruscotto
    const seatMat = new THREE.MeshStandardMaterial({ color: 0x1a1c20, roughness: 0.9 });
    for (const sx of [-1, 1]) {
      add(new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.14, 0.5), seatMat)).position.set(sx * 0.45, 0.42, -0.12);
      const back = add(new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.62, 0.12), seatMat)); back.position.set(sx * 0.45, 0.75, -0.42); back.rotation.x = -0.15;
    }
    add(new THREE.Mesh(new THREE.BoxGeometry(t.W - 0.3, 0.2, 0.4), seatMat)).position.set(0, 0.45, -0.95);
    add(new THREE.Mesh(new THREE.BoxGeometry(t.W - 0.3, 0.2, 0.35), black)).position.set(0, 0.88, 0.78);
    this.wheelSteer = new THREE.Group(); this.wheelSteer.position.set(0.45, 0.95, 0.52); this.wheelSteer.rotation.x = -0.5;
    this.wheelSteer.add(new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.022, 8, 18), black));
    this.body.add(this.wheelSteer);
    // barra luminosa blu
    this.barMats = [0, 1].map(() => new THREE.MeshStandardMaterial({ color: 0x1c4dff, emissive: 0x2255ff, emissiveIntensity: 0.1, roughness: 0.3 }));
    const barBase = add(new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.09, 0.34), black)); barBase.position.set(0, 1.5, 0.15);
    this.barBase = barBase;
    for (const [i, sx] of [[0, -1], [1, 1]]) {
      const b = add(new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.1, 0.3), this.barMats[i])); b.position.set(sx * 0.25, 1.58, 0.15);
    }
    // lampeggianti nella calandra / retro
    this.frontFlash = [0, 1].map((i) => {
      const m = new THREE.MeshStandardMaterial({ color: 0x1c4dff, emissive: 0x2255ff, emissiveIntensity: 0.1 });
      const f = add(new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.06, 0.04), m)); f.position.set((i ? 1 : -1) * 0.3, 0.7, t.L / 2 + 0.02); return m;
    });
    // ruote
    this.wheels = [];
    const tire = new THREE.CylinderGeometry(0.335, 0.335, 0.24, 24).rotateZ(Math.PI / 2);
    const rim = new THREE.CylinderGeometry(0.22, 0.22, 0.25, 12).rotateZ(Math.PI / 2);
    const hub = new THREE.CylinderGeometry(0.05, 0.05, 0.27, 8).rotateZ(Math.PI / 2);
    const tireMat = new THREE.MeshStandardMaterial({ color: 0x111214, roughness: 0.95 });
    const rimMat = new THREE.MeshStandardMaterial({ color: 0xb5b9bf, roughness: 0.25, metalness: 1 });
    const spokeGeo = new THREE.BoxGeometry(0.255, 0.04, 0.4);
    for (const sz of [1, -1]) for (const sx of [-1, 1]) {
      const pivot = new THREE.Group(); pivot.position.set(sx * (t.W / 2 - 0.03), 0.335, sz * t.wb / 2);
      const spin = new THREE.Group(); pivot.add(spin);
      const tr = new THREE.Mesh(tire, tireMat); tr.castShadow = true; spin.add(tr);
      spin.add(new THREE.Mesh(rim, rimMat), new THREE.Mesh(hub, black));
      for (let i = 0; i < 5; i++) { const s = new THREE.Mesh(spokeGeo, black); s.rotation.x = (i / 5) * Math.PI; s.position.x = sx * 0.01; spin.add(s); }
      this.body.add(pivot);
      this.wheels.push({ pivot, spin, front: sz > 0 });
    }
    // marker di collisione per debug (nascosto)
    this.group.traverse((o) => { if (o.isMesh) o.receiveShadow = true; });
  }

  // ---------- stato ----------
  setPose(x, z, h) {
    this.x = x; this.z = z; this.h = h;
    this.vx = this.vz = 0; this.vf = 0; this.speed = 0;
    this.group.position.set(x, 0.09, z); this.group.rotation.y = h;
  }
  forward() { return [Math.sin(this.h), Math.cos(this.h)]; }
  right() { return [-Math.cos(this.h), Math.sin(this.h)]; }
  driverDoor() {
    // lato guida a sinistra (+x locale)
    const c = Math.cos(this.h), s = Math.sin(this.h);
    return { x: this.x + c * 1.9 * 1 + 0 * s, z: this.z - s * 1.9 };
  }

  /** ctrl: {throttle, brake, steer (+destra), handbrake} oppure null */
  update(dt, ctrl, others, grid) {
    const t = this.type;
    const c = ctrl || { throttle: 0, brake: 0, steer: 0, handbrake: false };
    const fx = Math.sin(this.h), fz = Math.cos(this.h);
    const rx = -fz, rz = fx;
    let vf = this.vx * fx + this.vz * fz;
    let vr = this.vx * rx + this.vz * rz;
    const av = Math.abs(vf);

    const pw = c.power || 1;
    const vmax = t.vmax * Math.sqrt(pw);
    let acc = 0;
    this.braking = false;
    if (c.throttle > 0.02) {
      if (vf < -0.8) { acc += 22 * c.throttle; this.braking = true; }
      else acc += t.accel * pw * c.throttle * (1 - Math.pow(clamp(vf / vmax, 0, 1), 1.7));
    }
    if (c.brake > 0.02) {
      if (vf > 0.8) { acc -= 24 * c.brake; this.braking = true; }
      else if (vf > -9) acc -= 6.5 * c.brake * (1 - clamp(-vf / 9, 0, 1) * 0.6);
    }
    const coast = c.throttle < 0.02 && c.brake < 0.02;
    const drag = 0.0011 * vf * av + (av > 0.05 ? Math.sign(vf) * (coast ? 1.6 : 0.5) : 0);
    acc -= drag;
    if (c.handbrake) { acc -= Math.sign(vf) * Math.min(av / dt * 0.5, 9); this.braking = true; }
    vf += acc * dt;
    if (coast && Math.abs(vf) < 0.25) vf = 0;

    // sterzo
    const maxSt = t.steerMax / (1 + Math.pow(av / 16, 1.4));
    this.steer = damp(this.steer, c.steer * maxSt, 9, dt);
    let yaw = (-vf * Math.tan(this.steer)) / t.wb;
    if (c.handbrake && av > 6) yaw *= 1.45;
    this.yawRate = damp(this.yawRate, yaw, 14, dt);
    this.h += this.yawRate * dt;

    // aderenza laterale
    const grip = c.handbrake ? 1.4 : av > 22 ? 5.5 : 9;
    vr *= Math.exp(-grip * dt);
    const nfx = Math.sin(this.h), nfz = Math.cos(this.h), nrx = -nfz, nrz = nfx;
    this.vx = nfx * vf + nrx * vr;
    this.vz = nfz * vf + nrz * vr;

    this.x += this.vx * dt; this.z += this.vz * dt;

    // collisioni con edifici/oggetti
    this.impact = 0;
    this._collideWorld(grid);
    this._collideVehicles(others);

    this.vf = this.vx * Math.sin(this.h) + this.vz * Math.cos(this.h);
    this.speed = Math.hypot(this.vx, this.vz);
    this.accel = damp(this.accel, acc, 6, dt);

    // visuale
    this.wheelSpin += (this.vf / 0.335) * dt;
    for (const w of this.wheels) {
      w.spin.rotation.x = this.wheelSpin;
      if (w.front) w.pivot.rotation.y = -this.steer;
    }
    this.wheelSteer.rotation.z = -this.steer * 3;
    const rollT = clamp(this.yawRate * this.vf * -0.0035, -0.07, 0.07);
    const pitchT = clamp(-this.accel * 0.0035, -0.05, 0.05);
    this.roll = damp(this.roll, rollT, 6, dt); this.pitch = damp(this.pitch, pitchT, 6, dt);
    this.body.rotation.set(this.pitch, 0, this.roll);
    this.group.position.set(this.x, 0.09, this.z);
    this.group.rotation.y = this.h;

    // luci
    const flash = Math.floor(performance.now() / 110) % 2;
    const sirenOn = this.siren;
    this.barMats[0].emissiveIntensity = sirenOn ? (flash ? 6 : 0.2) : 0.1;
    this.barMats[1].emissiveIntensity = sirenOn ? (flash ? 0.2 : 6) : 0.1;
    this.frontFlash[0].emissiveIntensity = sirenOn ? (flash ? 6 : 0.1) : 0.1;
    this.frontFlash[1].emissiveIntensity = sirenOn ? (flash ? 0.1 : 6) : 0.1;
    this.headMat.emissiveIntensity = this.lightsOn ? 3.5 : 0.05;
    this.tailMat.emissiveIntensity = this.braking || this.lightsOn ? (this.braking ? 4 : 1.5) : 0.15;
  }

  _collideWorld(grid) {
    const t = this.type;
    const s = Math.sin(this.h), c = Math.cos(this.h);
    let nx = 0, nz = 0, hit = false;
    for (let pass = 0; pass < 2; pass++) {
      for (const k of this.circles) {
        const p = { x: this.x + s * k.o, z: this.z + c * k.o };
        const ox = p.x, oz = p.z;
        const r = grid.resolveCircle(p, k.r, 1.7);
        if (r.hit) {
          this.x += p.x - ox; this.z += p.z - oz;
          nx += p.x - ox; nz += p.z - oz; hit = true;
        }
      }
    }
    if (hit) {
      const len = Math.hypot(nx, nz) || 1; nx /= len; nz /= len;
      const vn = this.vx * nx + this.vz * nz;
      if (vn < 0) {
        this.impact = Math.max(this.impact, -vn);
        const e = 0.25;
        this.vx -= (1 + e) * vn * nx; this.vz -= (1 + e) * vn * nz;
        this.vx *= 0.93; this.vz *= 0.93;
      }
    }
  }

  _collideVehicles(others) {
    if (!others) return;
    for (const o of others) {
      if (o === this) continue;
      if ((o.x - this.x) ** 2 + (o.z - this.z) ** 2 > 36) continue;
      const s1 = Math.sin(this.h), c1 = Math.cos(this.h), s2 = Math.sin(o.h), c2 = Math.cos(o.h);
      for (const a of this.circles) for (const b of o.circles) {
        const ax = this.x + s1 * a.o, az = this.z + c1 * a.o;
        const bx = o.x + s2 * b.o, bz = o.z + c2 * b.o;
        let dx = ax - bx, dz = az - bz;
        const d = Math.hypot(dx, dz), min = a.r + b.r;
        if (d < min && d > 1e-4) {
          dx /= d; dz /= d;
          const push = (min - d) * 0.5;
          this.x += dx * push; this.z += dz * push;
          o.x -= dx * push; o.z -= dz * push;
          const rel = (this.vx - o.vx) * dx + (this.vz - o.vz) * dz;
          if (rel < 0) {
            const j = -(1 + 0.2) * rel * 0.5;
            this.vx += dx * j; this.vz += dz * j; o.vx -= dx * j; o.vz -= dz * j;
            this.impact = Math.max(this.impact, -rel);
          }
        }
      }
    }
  }

  /** Cerca una posizione libera per far scendere il giocatore */
  findExit(grid) {
    const c = Math.cos(this.h), s = Math.sin(this.h);
    const cands = [[1, 0], [-1, 0], [1, 1.6], [-1, 1.6]];
    for (const [side, back] of cands) {
      const x = this.x + c * 1.7 * side - s * back, z = this.z - s * 1.7 * side - c * back;
      const p = { x, z };
      const before = { x, z };
      grid.resolveCircle(p, 0.4, 1.8);
      if (Math.hypot(p.x - before.x, p.z - before.z) < 0.05) return { x, z };
    }
    return { x: this.x + c * 1.8, z: this.z - s * 1.8 };
  }
}
