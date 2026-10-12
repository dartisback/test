import * as THREE from 'three';
import { clamp, damp } from './util.js';
import * as T from './textures.js';

const SEDAN = {
  giulia: {
    L: 4.64, W: 1.86, wb: 2.82, vmax: 58, accel: 12.5, steerMax: 0.58,
    lower: [[-2.28, 0.30], [2.26, 0.30], [2.32, 0.46], [2.27, 0.70], [1.55, 0.88], [0.98, 0.97], [-1.6, 0.97], [-2.18, 0.96], [-2.32, 0.84], [-2.32, 0.44]],
    cabin: [[1.0, 0.96], [0.28, 1.40], [-1.0, 1.42], [-1.78, 1.04], [-1.8, 0.96]], roofX: [-1.0, 0.28],
  },
  giulietta: {
    L: 4.35, W: 1.80, wb: 2.63, vmax: 52, accel: 11, steerMax: 0.62,
    lower: [[-2.12, 0.30], [2.1, 0.30], [2.17, 0.46], [2.12, 0.70], [1.4, 0.88], [0.9, 0.97], [-1.9, 0.97], [-2.16, 0.9], [-2.18, 0.44]],
    cabin: [[0.95, 0.96], [0.25, 1.40], [-1.2, 1.44], [-2.0, 1.12], [-2.12, 0.96]], roofX: [-1.2, 0.25],
  },
};

export const CAR_TYPES = {
  giulia: { id: 'giulia', name: 'Alfa Romeo Giulia', desc: 'Berlina di Pronto Intervento. Potente e veloce.', shape: 'sedan', ...SEDAN.giulia, color: 0x2149b0, livery: 'polizia', emergency: true, plate: 'POLIZIA M7085', sirenRate: 1, mass: 1.2, faction: 'polizia' },
  giulietta: { id: 'giulietta', name: 'Alfa Romeo Giulietta', desc: 'Compatta agile, ideale per i vicoli.', shape: 'sedan', ...SEDAN.giulietta, color: 0x2149b0, livery: 'polizia', emergency: true, plate: 'POLIZIA M5553', sirenRate: 1, mass: 1.1, faction: 'polizia' },
  cc_giulia: { id: 'cc_giulia', name: 'Alfa Romeo Giulia (Radiomobile)', desc: 'Gazzella dell\'Arma: potente e veloce.', shape: 'sedan', ...SEDAN.giulia, color: 0x14275a, livery: 'carabinieri', emergency: true, plate: 'CC AB123CD', sirenRate: 1.04, mass: 1.2, faction: 'carabinieri' },
  cc_giulietta: { id: 'cc_giulietta', name: 'Alfa Romeo Giulietta (Radiomobile)', desc: 'Gazzella compatta e maneggevole.', shape: 'sedan', ...SEDAN.giulietta, color: 0x14275a, livery: 'carabinieri', emergency: true, plate: 'CC AB124CD', sirenRate: 1.04, mass: 1.1, faction: 'carabinieri' },
  ambulanza: {
    id: 'ambulanza', name: 'Fiat Ducato (Ambulanza CRI)', desc: 'Ambulanza di soccorso avanzato.', shape: 'van', L: 6.0, W: 2.05, wb: 3.8, vmax: 42, accel: 8, steerMax: 0.5,
    color: 0xf3f3f0, livery: 'ambulanza', emergency: true, plate: 'CRI A 123AB', sirenRate: 1.18, mass: 1.8, faction: 'croce_rossa',
  },
  autopompa: {
    id: 'autopompa', name: 'Autopompa Serbatoio VVF', desc: 'Autopompa con lancia e serbatoio da 4000 litri.', shape: 'truck', L: 7.8, W: 2.5, wb: 4.4, vmax: 30, accel: 5.5, steerMax: 0.5,
    color: 0xc4201a, livery: 'vvf', emergency: true, plate: 'VF 24581', sirenRate: 0.82, mass: 3.2, faction: 'vvf',
  },
  civ_sedan: { id: 'civ_sedan', name: 'Berlina', shape: 'sedan', ...SEDAN.giulia, L: 4.5, W: 1.8, vmax: 46, accel: 9, steerMax: 0.58, color: 0x888888, emergency: false, plate: 'EX 123 AB', mass: 1.1 },
  civ_hatch: { id: 'civ_hatch', name: 'Utilitaria', shape: 'sedan', ...SEDAN.giulietta, L: 4.2, W: 1.75, vmax: 40, accel: 8.5, steerMax: 0.62, color: 0xaa4444, emergency: false, plate: 'FG 456 CD', mass: 0.9 },
};

export const randomPlate = (rnd = Math.random) => {
  const L = () => 'ABCDEFGHJKLMNPRSTVWXYZ'[Math.floor(rnd() * 22)];
  return `${L()}${L()} ${100 + Math.floor(rnd() * 899)} ${L()}${L()}`;
};

const texCache = {};
const livery = (kind) => (texCache[kind] || (texCache[kind] = T.liveryTexture(kind)));

const extrudeProfile = (pts, width, bevel = 0.05) => {
  const sh = new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x, y)));
  const geo = new THREE.ExtrudeGeometry(sh, { depth: Math.max(0.01, width - bevel * 2), bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 3, curveSegments: 1 });
  geo.translate(0, 0, -(width - bevel * 2) / 2);
  geo.rotateY(-Math.PI / 2);
  return geo;
};

export class Vehicle {
  constructor(typeId, world, opts = {}) {
    this.type = { ...CAR_TYPES[typeId] };
    if (opts.color !== undefined) this.type.color = opts.color;
    if (opts.plate) this.type.plate = opts.plate;
    this.typeId = typeId;
    this.world = world;
    this.group = new THREE.Group();
    this.group.name = `veh-${typeId}`;
    this.group.rotation.order = 'YXZ';
    this.x = 0; this.z = 0; this.h = 0; this.y = 0;
    this.vx = 0; this.vz = 0;
    this.steer = 0; this.speed = 0; this.vf = 0;
    this.pitch = 0; this.roll = 0; this.accel = 0;
    this.wheelSpin = 0; this.yawRate = 0;
    this.siren = false; this.lightsOn = false; this.braking = false;
    this.occupied = false; this.locked = true;
    this.impact = 0;
    this.health = 100;
    this.disabled = false;
    this.controller = null;  // funzione (dt) -> ctrl per veicoli guidati dall'IA
    this.tag = null;
    this.driver = null;
    this.smoke = 0;
    this.build();
    const n = Math.max(3, Math.ceil(this.type.L / 2.2));
    const r = this.type.W / 2 + 0.05;
    this.circles = Array.from({ length: n }, (_, i) => ({ o: -(this.type.L / 2 - r) + (i * (this.type.L - 2 * r)) / (n - 1), r }));
  }

  // ======================================================================================
  build() {
    const t = this.type;
    this.body = new THREE.Group(); this.group.add(this.body);
    this.wheels = [];
    this.barMats = [0, 1].map(() => new THREE.MeshStandardMaterial({ color: 0x1c4dff, emissive: 0x2255ff, emissiveIntensity: 0.1, roughness: 0.3 }));
    this.frontFlash = [];
    this.headMat = new THREE.MeshStandardMaterial({ color: 0xe8f2ff, emissive: 0xfff4d6, emissiveIntensity: 0.05, roughness: 0.1, metalness: 0.2 });
    this.tailMat = new THREE.MeshStandardMaterial({ color: 0x6a0a0a, emissive: 0xff1010, emissiveIntensity: 0.15, roughness: 0.3 });
    this.mats = {
      body: new THREE.MeshStandardMaterial({ color: t.color, roughness: 0.3, metalness: 0.35 }),
      white: new THREE.MeshStandardMaterial({ color: 0xf2f4f7, roughness: 0.35, metalness: 0.3 }),
      glass: new THREE.MeshStandardMaterial({ color: 0x141c26, roughness: 0.06, metalness: 0.85 }),
      black: new THREE.MeshStandardMaterial({ color: 0x0d0e10, roughness: 0.6, metalness: 0.3 }),
      seat: new THREE.MeshStandardMaterial({ color: 0x1a1c20, roughness: 0.9 }),
    };
    if (t.shape === 'sedan') this.buildSedan();
    else if (t.shape === 'van') this.buildVan();
    else this.buildTruck();
    this.group.traverse((o) => { if (o.isMesh) { o.receiveShadow = true; } });
  }

  add(m, parent = this.body) { m.castShadow = true; parent.add(m); return m; }

  decal(kind, w, h, y, z) {
    const t = this.type;
    const mat = new THREE.MeshStandardMaterial({ map: livery(kind), transparent: true, roughness: 0.4, metalness: 0.2, polygonOffset: true, polygonOffsetFactor: -2, depthWrite: false });
    for (const sx of [-1, 1]) {
      const d = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
      d.position.set(sx * (t.W / 2 + 0.004), y, z); d.rotation.y = sx * Math.PI / 2; this.body.add(d);
    }
  }
  plates(zf, zr, y) {
    for (const [z, rot] of [[zf, 0], [zr, Math.PI]]) {
      const p = new THREE.Mesh(new THREE.PlaneGeometry(0.52, 0.113), new THREE.MeshBasicMaterial({ map: T.plateTexture(this.type.plate) }));
      p.position.set(0, y, z); p.rotation.y = rot; this.body.add(p);
    }
  }
  addWheels(layout, r, w, trackHalf) {
    const tire = new THREE.CylinderGeometry(r, r, w, 24).rotateZ(Math.PI / 2);
    const rim = new THREE.CylinderGeometry(r * 0.66, r * 0.66, w + 0.01, 12).rotateZ(Math.PI / 2);
    const hub = new THREE.CylinderGeometry(r * 0.15, r * 0.15, w + 0.03, 8).rotateZ(Math.PI / 2);
    const tireMat = new THREE.MeshStandardMaterial({ color: 0x111214, roughness: 0.95 });
    const rimMat = new THREE.MeshStandardMaterial({ color: 0xb5b9bf, roughness: 0.25, metalness: 1 });
    const spokeGeo = new THREE.BoxGeometry(w + 0.01, 0.04, r * 1.2);
    for (const wl of layout) for (const sx of [-1, 1]) {
      const pivot = new THREE.Group(); pivot.position.set(sx * trackHalf, r, wl.z);
      const spin = new THREE.Group(); pivot.add(spin);
      const tr = new THREE.Mesh(tire, tireMat); tr.castShadow = true; spin.add(tr);
      spin.add(new THREE.Mesh(rim, rimMat), new THREE.Mesh(hub, this.mats.black));
      for (let i = 0; i < 5; i++) { const s = new THREE.Mesh(spokeGeo, this.mats.black); s.rotation.x = (i / 5) * Math.PI; spin.add(s); }
      this.body.add(pivot);
      this.wheels.push({ pivot, spin, front: !!wl.steer });
    }
  }
  lightbar(y, z, width = 1.0) {
    const base = this.add(new THREE.Mesh(new THREE.BoxGeometry(width, 0.09, 0.34), this.mats.black)); base.position.set(0, y, z);
    for (const [i, sx] of [[0, -1], [1, 1]]) {
      const b = this.add(new THREE.Mesh(new THREE.BoxGeometry(width * 0.46, 0.1, 0.3), this.barMats[i])); b.position.set(sx * width * 0.25, y + 0.08, z);
    }
  }

  // ----------------------------- berlina (Giulia / Giulietta / civile) -------------------
  buildSedan() {
    const t = this.type, m = this.mats;
    this.add(new THREE.Mesh(extrudeProfile(t.lower, t.W, 0.06), m.body));
    this.add(new THREE.Mesh(extrudeProfile(t.cabin, t.W - 0.28, 0.025), m.glass));
    const roofL = t.roofX[1] - t.roofX[0];
    const roof = this.add(new THREE.Mesh(new THREE.BoxGeometry(t.W - 0.24, 0.045, roofL), m.body)); roof.position.set(0, 1.425, (t.roofX[0] + t.roofX[1]) / 2);
    for (const sx of [-1, 1]) {
      const b = this.add(new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.46, 0.1), m.body)); b.position.set(sx * (t.W / 2 - 0.15), 1.2, -0.28);
      const a = this.add(new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.5, 0.07), m.body)); a.position.set(sx * (t.W / 2 - 0.15), 1.18, 0.62); a.rotation.x = -0.9;
    }
    if (t.livery) this.decal(t.livery, 3.7, 0.74, 0.64, -0.12);
    for (const sz of [-1, 1]) for (const sx of [-1, 1]) {
      const a = new THREE.Mesh(new THREE.CircleGeometry(0.4, 20), m.black); a.position.set(sx * (t.W / 2 + 0.002), 0.34, sz * t.wb / 2); a.rotation.y = sx * Math.PI / 2; this.body.add(a);
    }
    if (t.livery === 'polizia') { const hs = this.add(new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.012, 1.1), m.white)); hs.position.set(0, 0.935, t.L / 2 - 1.55); hs.rotation.x = 0.28; }
    this.add(new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.17, 0.05), m.black)).position.set(0, 0.58, t.L / 2 + 0.05);
    const scud = this.add(new THREE.Mesh(new THREE.ConeGeometry(0.15, 0.2, 3), new THREE.MeshStandardMaterial({ color: 0x2a2d31, roughness: 0.3, metalness: 0.8 })));
    scud.position.set(0, 0.6, t.L / 2 + 0.07); scud.rotation.set(Math.PI / 2, 0, Math.PI);
    this.add(new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.13, 0.05), m.black)).position.set(0, 0.4, t.L / 2 + 0.02);
    this.add(new THREE.Mesh(new THREE.BoxGeometry(t.W - 0.1, 0.1, 0.06), m.black)).position.set(0, 0.32, t.L / 2 - 0.02);
    this.add(new THREE.Mesh(new THREE.BoxGeometry(t.W - 0.1, 0.1, 0.06), m.black)).position.set(0, 0.32, -t.L / 2 + 0.02);
    for (const sx of [-1, 1]) {
      const h = this.add(new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.12, 0.06), this.headMat)); h.position.set(sx * 0.65, 0.78, t.L / 2 - 0.12); h.rotation.set(-0.35, sx * -0.22, 0);
      const l = this.add(new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.13, 0.05), this.tailMat)); l.position.set(sx * 0.62, 0.9, -t.L / 2 + 0.01);
      const mi = this.add(new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.12, 0.1), m.body)); mi.position.set(sx * (t.W / 2 + 0.1), 1.06, 0.62);
      const bk = this.add(new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.14, 0.5), m.seat)); bk.position.set(sx * 0.45, 0.42, -0.12);
      const bb = this.add(new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.62, 0.12), m.seat)); bb.position.set(sx * 0.45, 0.75, -0.42); bb.rotation.x = -0.15;
    }
    this.plates(t.L / 2 + 0.09, -t.L / 2 - 0.09, 0.42);
    this.add(new THREE.Mesh(new THREE.BoxGeometry(t.W - 0.3, 0.2, 0.35), m.black)).position.set(0, 0.88, 0.78);
    this.wheelSteer = new THREE.Group(); this.wheelSteer.position.set(0.45, 0.95, 0.52); this.wheelSteer.rotation.x = -0.5;
    this.wheelSteer.add(new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.022, 8, 18), m.black)); this.body.add(this.wheelSteer);
    if (t.emergency) {
      this.lightbar(1.5, 0.15);
      this.frontFlash = [0, 1].map((i) => {
        const mm = new THREE.MeshStandardMaterial({ color: 0x1c4dff, emissive: 0x2255ff, emissiveIntensity: 0.1 });
        const f = this.add(new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.06, 0.04), mm)); f.position.set((i ? 1 : -1) * 0.3, 0.7, t.L / 2 + 0.02); return mm;
      });
    }
    this.addWheels([{ z: t.wb / 2, steer: true }, { z: -t.wb / 2 }], 0.335, 0.24, t.W / 2 - 0.03);
    this.seat = { x: 0.45, y: 0, z: -0.2 };
  }

  // ----------------------------- ambulanza (Fiat Ducato) -----------------------------
  buildVan() {
    const t = this.type, m = this.mats;
    const prof = [[-2.98, 0.38], [2.9, 0.38], [3.0, 0.62], [2.98, 1.0], [2.55, 1.18], [2.0, 1.28], [1.52, 2.08], [1.35, 2.5], [-2.92, 2.52], [-3.0, 2.3], [-3.0, 0.6]];
    this.add(new THREE.Mesh(extrudeProfile(prof, t.W, 0.05), m.body));
    // vetri cabina
    const ws = this.add(new THREE.Mesh(new THREE.BoxGeometry(t.W - 0.3, 0.03, 0.98), m.glass)); ws.position.set(0, 1.72, 1.78); ws.rotation.x = 0.97;
    for (const sx of [-1, 1]) {
      const sw = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 0.62), m.glass); sw.position.set(sx * (t.W / 2 + 0.006), 1.78, 1.45); sw.rotation.y = sx * Math.PI / 2; this.body.add(sw);
      const mi = this.add(new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.35, 0.1), m.black)); mi.position.set(sx * (t.W / 2 + 0.12), 1.5, 1.75);
      const l = this.add(new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.35, 0.18), this.tailMat)); l.position.set(sx * (t.W / 2 - 0.1), 1.0, -3.0);
      const h = this.add(new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.14, 0.06), this.headMat)); h.position.set(sx * 0.7, 0.95, 2.98);
    }
    this.decal('ambulanza', 4.0, 1.0, 1.35, -0.55);
    // croce rossa sul retro
    const cross = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.9), new THREE.MeshBasicMaterial({ map: T.crossTexture() })); cross.position.set(0, 1.5, -3.01); cross.rotation.y = Math.PI; this.body.add(cross);
    this.add(new THREE.Mesh(new THREE.BoxGeometry(t.W - 0.2, 0.18, 0.1), m.black)).position.set(0, 0.55, 3.0);
    this.add(new THREE.Mesh(new THREE.BoxGeometry(t.W - 0.2, 0.18, 0.1), m.black)).position.set(0, 0.5, -3.0);
    this.lightbar(2.58, 1.0, 1.5);
    this.add(new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.16, 0.5), this.barMats[0])).position.set(0, 2.62, -2.9);
    this.frontFlash = [0, 1].map((i) => { const mm = new THREE.MeshStandardMaterial({ color: 0x1c4dff, emissive: 0x2255ff, emissiveIntensity: 0.1 }); const f = this.add(new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.07, 0.04), mm)); f.position.set((i ? 1 : -1) * 0.35, 0.75, 3.0); return mm; });
    this.plates(3.06, -3.06, 0.62);
    this.addWheels([{ z: 1.9, steer: true }, { z: -1.9 }], 0.37, 0.26, t.W / 2 - 0.02);
    const bk = this.add(new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.15, 0.5), m.seat)); bk.position.set(0.5, 0.55, 1.0);
    this.wheelSteer = new THREE.Group(); this.wheelSteer.position.set(0.5, 1.15, 1.85); this.wheelSteer.rotation.x = -0.6;
    this.wheelSteer.add(new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.025, 8, 18), m.black)); this.body.add(this.wheelSteer);
    this.seat = { x: 0.5, y: 0.1, z: 1.05 };
  }

  // ----------------------------- autopompa VVF -----------------------------
  buildTruck() {
    const t = this.type, m = this.mats;
    const cabProf = [[1.7, 0.55], [3.9, 0.55], [3.95, 1.5], [3.72, 2.2], [3.25, 2.95], [1.7, 2.95]];
    this.add(new THREE.Mesh(extrudeProfile(cabProf, t.W, 0.06), m.body));
    const box = this.add(new THREE.Mesh(new THREE.BoxGeometry(t.W, 1.9, 5.5), m.body)); box.position.set(0, 1.6, -1.05);
    const chassis = this.add(new THREE.Mesh(new THREE.BoxGeometry(t.W - 0.4, 0.4, 7.2), m.black)); chassis.position.set(0, 0.62, -0.1);
    const ws = this.add(new THREE.Mesh(new THREE.BoxGeometry(t.W - 0.3, 0.03, 1.05), m.glass)); ws.position.set(0, 2.55, 3.45); ws.rotation.x = 0.95;
    const grey = new THREE.MeshStandardMaterial({ color: 0xaeb4ba, roughness: 0.5, metalness: 0.6 });
    for (const sx of [-1, 1]) {
      const sw = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.8), m.glass); sw.position.set(sx * (t.W / 2 + 0.006), 2.25, 2.75); sw.rotation.y = sx * Math.PI / 2; this.body.add(sw);
      for (const z of [-2.8, -1.2, 0.4]) { const sh = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 1.2), grey); sh.position.set(sx * (t.W / 2 + 0.006), 1.35, z); sh.rotation.y = sx * Math.PI / 2; this.body.add(sh); }
      const h = this.add(new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.16, 0.06), this.headMat)); h.position.set(sx * 0.85, 0.95, 3.96);
      const l = this.add(new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.18, 0.06), this.tailMat)); l.position.set(sx * 0.9, 1.1, -3.82);
      const mi = this.add(new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.45, 0.12), m.black)); mi.position.set(sx * (t.W / 2 + 0.15), 2.15, 3.4);
    }
    this.decal('vvf', 4.8, 0.8, 2.15, -1.05);
    this.add(new THREE.Mesh(new THREE.BoxGeometry(t.W, 0.3, 0.25), m.white)).position.set(0, 0.7, 4.0);
    // scala + attrezzatura sul tetto
    for (const sx of [-0.45, 0.45]) { const r = this.add(new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.12, 5.0), grey)); r.position.set(sx, 2.7, -1.05); }
    for (let z = -3.4; z <= 1.3; z += 0.55) { const r = this.add(new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.06, 0.06), grey)); r.position.set(0, 2.7, z); }
    const tank = this.add(new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 2.2, 12).rotateZ(Math.PI / 2), grey)); tank.position.set(1.0, 2.75, -2.4);
    this.lightbar(3.05, 2.35, 1.5);
    this.frontFlash = [0, 1].map((i) => { const mm = new THREE.MeshStandardMaterial({ color: 0x1c4dff, emissive: 0x2255ff, emissiveIntensity: 0.1 }); const f = this.add(new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.08, 0.04), mm)); f.position.set((i ? 1 : -1) * 0.5, 1.3, 3.98); return mm; });
    this.plates(4.02, -3.9, 0.6);
    this.addWheels([{ z: 2.9, steer: true }, { z: -1.2 }, { z: -2.5 }], 0.52, 0.34, t.W / 2 - 0.12);
    this.wheelSteer = new THREE.Group(); this.wheelSteer.position.set(0.6, 1.7, 3.1); this.wheelSteer.rotation.x = -0.6;
    this.wheelSteer.add(new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.025, 8, 18), m.black)); this.body.add(this.wheelSteer);
    this.seat = { x: 0.6, y: 0.6, z: 2.8 };
    // punto d'uscita della lancia (davanti-destra) per l'effetto acqua
    this.nozzle = new THREE.Vector3(0, 3.2, 4.4);
  }

  // ======================================================================================
  setPose(x, z, h) {
    this.x = x; this.z = z; this.h = h;
    this.vx = this.vz = 0; this.vf = 0; this.speed = 0; this.yawRate = 0; this.steer = 0;
    this.y = this.world.groundY(x, z);
    this.group.position.set(x, this.y + 0.02, z); this.group.rotation.y = h;
  }
  forward() { return [Math.sin(this.h), Math.cos(this.h)]; }
  right() { return [-Math.cos(this.h), Math.sin(this.h)]; }
  driverDoor() { const c = Math.cos(this.h), s = Math.sin(this.h); return { x: this.x + c * 1.9, z: this.z - s * 1.9 }; }

  /** ctrl: {throttle, brake, steer (+destra), handbrake} oppure null */
  update(dt, ctrl, others) {
    const t = this.type, grid = this.world.grid;
    let c = ctrl || (this.controller ? this.controller(dt, this) : null) || { throttle: 0, brake: 0, steer: 0, handbrake: false };
    if (this.disabled) c = { throttle: 0, brake: 0.4, steer: 0, handbrake: false };
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
    acc -= 0.0011 * vf * av + (av > 0.05 ? Math.sign(vf) * (coast ? 1.6 : 0.5) : 0);
    if (c.handbrake) { acc -= Math.sign(vf) * Math.min(av / dt * 0.5, 9); this.braking = true; }
    vf += acc * dt;
    if (coast && Math.abs(vf) < 0.25) vf = 0;

    const maxSt = t.steerMax / (1 + Math.pow(av / 16, 1.4));
    this.steer = damp(this.steer, c.steer * maxSt, 9, dt);
    let yaw = (-vf * Math.tan(this.steer)) / t.wb;
    if (c.handbrake && av > 6) yaw *= 1.45;
    this.yawRate = damp(this.yawRate, yaw, 14, dt);
    this.h += this.yawRate * dt;

    const grip = c.handbrake ? 1.4 : av > 22 ? 5.5 : 9;
    vr *= Math.exp(-grip * dt);
    const nfx = Math.sin(this.h), nfz = Math.cos(this.h), nrx = -nfz, nrz = nfx;
    this.vx = nfx * vf + nrx * vr;
    this.vz = nfz * vf + nrz * vr;
    this.x += this.vx * dt; this.z += this.vz * dt;

    this.impact = 0;
    this.y = this.world.groundY(this.x, this.z);
    this._collideWorld(grid);
    this._collideVehicles(others);

    this.vf = this.vx * Math.sin(this.h) + this.vz * Math.cos(this.h);
    this.speed = Math.hypot(this.vx, this.vz);
    this.accel = damp(this.accel, acc, 6, dt);
    if (this.impact > 4) this.health = Math.max(0, this.health - (this.impact - 3) * 2.2 / (t.mass || 1));
    if (this.health <= 0 && !this.disabled && t.emergency === false) this.disabled = true;

    // visuale
    this.wheelSpin += (this.vf / 0.335) * dt;
    for (const w of this.wheels) { w.spin.rotation.x = this.wheelSpin; if (w.front) w.pivot.rotation.y = -this.steer; }
    if (this.wheelSteer) this.wheelSteer.rotation.z = -this.steer * 3;
    const rollT = clamp(this.yawRate * this.vf * -0.0035, -0.07, 0.07);
    const pitchT = clamp(-this.accel * 0.0035, -0.05, 0.05);
    this.roll = damp(this.roll, rollT, 6, dt); this.pitch = damp(this.pitch, pitchT, 6, dt);
    this.body.rotation.set(this.pitch, 0, this.roll);
    // inclinazione del terreno
    const half = t.L / 2 - 0.5;
    const hF = this.world.groundY(this.x + nfx * half, this.z + nfz * half), hB = this.world.groundY(this.x - nfx * half, this.z - nfz * half);
    const hL = this.world.groundY(this.x - nrx * 0.9, this.z - nrz * 0.9), hR = this.world.groundY(this.x + nrx * 0.9, this.z + nrz * 0.9);
    const slopeP = Math.atan2(hB - hF, half * 2), slopeR = Math.atan2(hL - hR, 1.8);
    this.gp = damp(this.gp || 0, slopeP, 10, dt); this.gr = damp(this.gr || 0, slopeR, 10, dt);
    this.group.position.set(this.x, (hF + hB) / 2 + 0.02, this.z);
    this.y = (hF + hB) / 2;
    this.group.rotation.set(this.gp, this.h, this.gr);

    // luci
    const flash = Math.floor(performance.now() / 110) % 2;
    const on = this.siren && t.emergency;
    this.barMats[0].emissiveIntensity = on ? (flash ? 6 : 0.2) : 0.1;
    this.barMats[1].emissiveIntensity = on ? (flash ? 0.2 : 6) : 0.1;
    if (this.frontFlash[0]) { this.frontFlash[0].emissiveIntensity = on ? (flash ? 6 : 0.1) : 0.1; this.frontFlash[1].emissiveIntensity = on ? (flash ? 0.1 : 6) : 0.1; }
    this.headMat.emissiveIntensity = this.lightsOn ? 3.5 : 0.05;
    this.tailMat.emissiveIntensity = this.braking || this.lightsOn ? (this.braking ? 4 : 1.5) : 0.15;
  }

  _collideWorld(grid) {
    const s = Math.sin(this.h), c = Math.cos(this.h);
    let nx = 0, nz = 0, hit = false;
    const maxY = this.y + 1.8;
    for (let pass = 0; pass < 2; pass++) {
      for (const k of this.circles) {
        const p = { x: this.x + s * k.o, z: this.z + c * k.o };
        const ox = p.x, oz = p.z;
        const r = grid.resolveCircle(p, k.r, maxY);
        if (r.hit) { this.x += p.x - ox; this.z += p.z - oz; nx += p.x - ox; nz += p.z - oz; hit = true; }
      }
    }
    if (hit) {
      const len = Math.hypot(nx, nz) || 1; nx /= len; nz /= len;
      const vn = this.vx * nx + this.vz * nz;
      if (vn < 0) {
        this.impact = Math.max(this.impact, -vn);
        this.vx -= 1.25 * vn * nx; this.vz -= 1.25 * vn * nz;
        this.vx *= 0.93; this.vz *= 0.93;
      }
    }
  }

  _collideVehicles(others) {
    if (!others) return;
    const m1 = this.type.mass || 1;
    for (const o of others) {
      if (o === this || o.hidden) continue;
      if ((o.x - this.x) ** 2 + (o.z - this.z) ** 2 > 140) continue;
      const m2 = o.type.mass || 1, wt1 = m2 / (m1 + m2), wt2 = m1 / (m1 + m2);
      const s1 = Math.sin(this.h), c1 = Math.cos(this.h), s2 = Math.sin(o.h), c2 = Math.cos(o.h);
      for (const a of this.circles) for (const b of o.circles) {
        const ax = this.x + s1 * a.o, az = this.z + c1 * a.o, bx = o.x + s2 * b.o, bz = o.z + c2 * b.o;
        let dx = ax - bx, dz = az - bz;
        const d = Math.hypot(dx, dz), min = a.r + b.r;
        if (d < min && d > 1e-4) {
          dx /= d; dz /= d;
          const push = min - d;
          this.x += dx * push * wt1; this.z += dz * push * wt1; o.x -= dx * push * wt2; o.z -= dz * push * wt2;
          const rel = (this.vx - o.vx) * dx + (this.vz - o.vz) * dz;
          if (rel < 0) {
            const j = -(1.25) * rel;
            this.vx += dx * j * wt1; this.vz += dz * j * wt1; o.vx -= dx * j * wt2; o.vz -= dz * j * wt2;
            this.impact = Math.max(this.impact, -rel); o.impact = Math.max(o.impact, -rel);
            o.hitBy = this;
          }
        }
      }
    }
  }

  findExit() {
    const grid = this.world.grid;
    const c = Math.cos(this.h), s = Math.sin(this.h);
    const side = this.type.W / 2 + 0.9;
    const cands = [[1, 0], [-1, 0], [1, 1.8], [-1, 1.8], [0, -(this.type.L / 2 + 1.2)]];
    for (const [sd, back] of cands) {
      const x = this.x + c * side * sd - s * back, z = this.z - s * side * sd - c * back;
      const p = { x, z };
      grid.resolveCircle(p, 0.4, this.y + 1.8);
      if (Math.hypot(p.x - x, p.z - z) < 0.05) return { x, z };
    }
    return { x: this.x + c * 2.2, z: this.z - s * 2.2 };
  }
}
