import * as THREE from 'three';
import { Sky } from 'three/examples/jsm/objects/Sky.js';
import { ColliderGrid, makeRng, clamp, TAU, layer } from './util.js';
import { WORLD, H_ROADS, V_ROADS, SIDEWALK, FLOOR_H, Q, generateLayout } from './layout.js';
import * as T from './textures.js';
import { buildQuestura } from './questura.js';

const tick = () => new Promise((r) => setTimeout(r, 0));

export class World {
  constructor(scene) {
    this.scene = scene;
    this.layout = generateLayout();
    this.grid = new ColliderGrid(16);
    this.facadeMats = new Map();
    this.lampMeshes = [];
    this.nightObjs = [];
    this.root = new THREE.Group();
    this.root.name = 'world';
    scene.add(this.root);
  }

  // ---------- helpers ----------
  facadeMat(color) {
    let m = this.facadeMats.get(color);
    if (!m) {
      m = new THREE.MeshStandardMaterial({
        map: this.tex.facade.map, color, roughness: 0.92, metalness: 0,
        emissive: new THREE.Color(0xffd9a0), emissiveMap: this.tex.facade.emissive, emissiveIntensity: 0,
      });
      this.facadeMats.set(color, m);
    }
    return m;
  }

  /** Box con UV delle campate di facciata (4 m) e piani */
  facadeBox(x0, x1, z0, z1, y0, y1, color, roofMat) {
    const w = x1 - x0, d = z1 - z0, h = y1 - y0;
    const geo = new THREE.BoxGeometry(w, h, d);
    const uv = geo.attributes.uv;
    const bays = (len) => Math.max(1, Math.round(len / 4));
    const floors = Math.max(1, Math.round(h / FLOOR_H));
    // ordine facce: +x, -x, +y, -y, +z, -z (4 vertici ciascuna)
    const scaleFace = (face, u, v) => {
      for (let i = face * 4; i < face * 4 + 4; i++) uv.setXY(i, uv.getX(i) * u, uv.getY(i) * v);
    };
    scaleFace(0, bays(d), floors); scaleFace(1, bays(d), floors);
    scaleFace(4, bays(w), floors); scaleFace(5, bays(w), floors);
    const fm = this.facadeMat(color);
    const mats = [fm, fm, roofMat, roofMat, fm, fm];
    const mesh = new THREE.Mesh(geo, mats);
    mesh.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
    mesh.castShadow = true; mesh.receiveShadow = true;
    return mesh;
  }

  addBox(b, collider = true) {
    if (collider) this.grid.add(b);
    return b;
  }

  // ---------- costruzione (asincrona per il caricamento) ----------
  async build(progress = () => {}) {
    const rnd = makeRng(4242);
    this.rnd = rnd;
    progress(0.02, 'Preparazione texture…'); await tick();
    this.tex = {
      facade: T.facadeTextures(),
      road: T.asphaltRoadTexture(),
      asphalt: T.plainAsphaltTexture(),
      pave: T.pavementTexture(),
      cobble: T.cobbleTexture(),
      grass: T.grassTexture(),
      gravel: T.gravelTexture(),
      path: T.pathTexture(),
      glow: T.glowTexture(),
    };
    this.mats = {
      roofTop: new THREE.MeshStandardMaterial({ color: 0x8a8a84, roughness: 1 }),
      concrete: new THREE.MeshStandardMaterial({ color: 0xb9b6ae, roughness: 0.95 }),
      dark: new THREE.MeshStandardMaterial({ color: 0x23262b, roughness: 0.6, metalness: 0.4 }),
      metal: new THREE.MeshStandardMaterial({ color: 0x8c9096, roughness: 0.5, metalness: 0.7 }),
      water: new THREE.MeshStandardMaterial({ color: 0x3f7fa8, roughness: 0.1, metalness: 0.2, transparent: true, opacity: 0.85 }),
      stone: new THREE.MeshStandardMaterial({ color: 0xc9c3b5, roughness: 0.85 }),
      wood: new THREE.MeshStandardMaterial({ color: 0x7a5233, roughness: 0.8 }),
      bronze: new THREE.MeshStandardMaterial({ color: 0x5b4a32, roughness: 0.5, metalness: 0.6 }),
    };

    this.buildSky();
    progress(0.08, 'Cielo e Dolomiti…'); await tick();
    this.buildMountains();
    progress(0.14, 'Strade e marciapiedi…'); await tick();
    this.buildGround();
    progress(0.30, 'Edifici di Belluno…'); await tick();
    this.buildBuildings();
    progress(0.50, 'Questura di Belluno…'); await tick();
    this.questura = buildQuestura(this);
    progress(0.62, 'Parchi, alberi e lampioni…'); await tick();
    this.buildDecor();
    this.buildTrees();
    this.buildLamps();
    progress(0.80, 'Confini della città…'); await tick();
    this.buildBounds();
    this.setTimeOfDay(15.5);
    progress(0.9, 'Quasi pronto…'); await tick();
  }

  // ---------- cielo / luce ----------
  buildSky() {
    const sky = new Sky();
    sky.scale.setScalar(4500);
    const u = sky.material.uniforms;
    u.turbidity.value = 4; u.rayleigh.value = 1.6; u.mieCoefficient.value = 0.004; u.mieDirectionalG.value = 0.82;
    this.root.add(sky);
    this.sky = sky;

    this.hemi = new THREE.HemisphereLight(0xbcd4ff, 0x5a5648, 0.7);
    this.root.add(this.hemi);
    this.sun = new THREE.DirectionalLight(0xfff1d6, 3);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    const sc = this.sun.shadow.camera;
    sc.left = -60; sc.right = 60; sc.top = 60; sc.bottom = -60; sc.near = 1; sc.far = 400;
    this.sun.shadow.bias = -0.0004; this.sun.shadow.normalBias = 0.05;
    this.root.add(this.sun, this.sun.target);
    this.scene.fog = new THREE.Fog(0xb8cce0, 120, 900);
  }

  setTimeOfDay(h) {
    this.hour = ((h % 24) + 24) % 24;
    const t = this.hour;
    const az = ((t - 6) / 12) * Math.PI;
    const e = Math.sin(az) * 1.08; // elevazione in rad (max ~62°)
    const sinE = Math.sin(e);
    this.sunDir = new THREE.Vector3(Math.cos(az) * Math.cos(e), sinE, Math.sin(az) * Math.cos(e)).normalize();
    const day = clamp(sinE * 3 + 0.25, 0, 1);       // 0 notte … 1 giorno
    const dusk = clamp(1 - Math.abs(sinE) * 5, 0, 1); // intensità del tramonto
    this.dayFactor = day;
    this.sky.material.uniforms.sunPosition.value.copy(this.sunDir).multiplyScalar(1000);
    this.sky.material.uniforms.rayleigh.value = 1.2 + dusk * 2.2 + (1 - day) * 0.3;
    this.sun.color.setRGB(1, 0.92 - dusk * 0.28, 0.82 - dusk * 0.5);
    this.sun.intensity = sinE > -0.02 ? 3.2 * clamp(sinE * 2.2 + 0.1, 0, 1) : 0;
    this.moon = this.moon || null;
    this.hemi.intensity = 0.12 + day * 0.95;
    this.hemi.color.setRGB(0.55 + day * 0.2, 0.62 + day * 0.2, 0.85 + day * 0.1);
    const fogDay = new THREE.Color(0xb9cde2), fogDusk = new THREE.Color(0xe9a77a), fogNight = new THREE.Color(0x070b16);
    const fc = fogNight.clone().lerp(fogDay, day).lerp(fogDusk, dusk * 0.6 * day + dusk * 0.2);
    this.scene.fog.color.copy(fc);
    if (this.scene.background) this.scene.background = null;
    this.night = sinE < 0.08;
    const nightAmt = 1 - clamp(sinE * 6 + 0.5, 0, 1);
    for (const m of this.facadeMats.values()) m.emissiveIntensity = nightAmt * 0.9;
    for (const o of this.nightObjs) o.visible = nightAmt > 0.2;
    for (const l of this.lampHeads || []) l.material.emissiveIntensity = nightAmt * 4;
    this.nightAmt = nightAmt;
    this.exposure = 0.78 - nightAmt * 0.25;
  }

  updateSun(center) {
    if (!this.sunDir) return;
    const up = this.sunDir.y > 0.02 ? this.sunDir : new THREE.Vector3(0.3, 0.8, 0.2).normalize();
    this.sun.position.copy(center).addScaledVector(up, 150);
    this.sun.target.position.copy(center);
    this.sun.target.updateMatrixWorld();
  }

  buildMountains() {
    const rnd = makeRng(99);
    const geo = new THREE.ConeGeometry(1, 1, 7, 4, true);
    const pos = geo.attributes.position;
    const colors = [];
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i) + 0.5;
      const jx = (rnd() - 0.5) * 0.25 * (1 - y);
      pos.setX(i, pos.getX(i) + jx);
      const snow = y > 0.62 ? (y - 0.62) / 0.2 : 0;
      const c = new THREE.Color(0x5b6471).lerp(new THREE.Color(0x3f5a3a), clamp(1 - y * 1.6, 0, 1)).lerp(new THREE.Color(0xf2f4f7), clamp(snow, 0, 1));
      colors.push(c.r, c.g, c.b);
    }
    geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geo.computeVertexNormals();
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, flatShading: true, fog: true });
    const g = new THREE.Group();
    for (let i = 0; i < 46; i++) {
      const a = (i / 46) * TAU + rnd() * 0.12;
      const dist = 1100 + rnd() * 500;
      const h = 220 + rnd() * 520;
      const m = new THREE.Mesh(geo, mat);
      m.scale.set(300 + rnd() * 380, h, 300 + rnd() * 380);
      m.position.set(Math.cos(a) * dist, h / 2 - 40, Math.sin(a) * dist);
      m.rotation.y = rnd() * TAU;
      g.add(m);
    }
    this.root.add(g);
    this.mountains = g;
  }

  // ---------- terreno e strade ----------
  buildGround() {
    const M = this.mats;
    // erba fino all'orizzonte
    const far = new THREE.Mesh(new THREE.PlaneGeometry(6000, 6000), new THREE.MeshStandardMaterial({ map: this.tex.grass, roughness: 1 }));
    far.material.map = this.tex.grass.clone(); far.material.map.repeat.set(900, 900); far.material.map.needsUpdate = true;
    far.rotation.x = -Math.PI / 2; far.position.y = -0.25; far.receiveShadow = true;
    this.root.add(far);

    const roadTex = this.tex.road;
    const mkRoad = (len, w, cx, cz, vertical) => {
      const t = roadTex.clone(); t.needsUpdate = true;
      t.repeat.set(len / 40, 1);
      const geo = new THREE.PlaneGeometry(len, w);
      geo.rotateX(-Math.PI / 2);
      if (vertical) geo.rotateY(Math.PI / 2);
      const m = new THREE.Mesh(geo, layer(new THREE.MeshStandardMaterial({ map: t, roughness: 0.92 }), 2));
      m.position.set(cx, 0.03, cz); m.receiveShadow = true;
      this.root.add(m);
    };
    const lenX = WORLD.x1 - WORLD.x0, lenZ = WORLD.z1 - WORLD.z0;
    for (const r of H_ROADS) mkRoad(lenX, r.w, 0, r.z, false);
    for (const r of V_ROADS) mkRoad(lenZ, r.w, r.x, 0, true);

    // incroci: asfalto pieno + strisce pedonali
    const interMat = layer(new THREE.MeshStandardMaterial({ map: this.tex.asphalt.clone(), roughness: 0.92 }), 3);
    interMat.map.repeat.set(4, 4);
    const stripeMat = layer(new THREE.MeshBasicMaterial({ color: 0xe8e8e0 }), 5);
    const stripeGeo = new THREE.PlaneGeometry(0.55, 3).rotateX(-Math.PI / 2);
    const stripes = [];
    for (const i of this.layout.intersections) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(i.wx, i.wz).rotateX(-Math.PI / 2), interMat);
      m.position.set(i.x, 0.032, i.z); m.receiveShadow = true; this.root.add(m);
      // strisce pedonali sui 4 lati
      for (const side of [-1, 1]) {
        // attraversamento lungo la strada orizzontale (ai lati sinistro/destro dell'incrocio)
        for (let k = -i.wz / 2 + 0.8; k <= i.wz / 2 - 0.7; k += 1.1) stripes.push({ x: i.x + side * (i.wx / 2 + 2.2), z: i.z + k, rot: 0 });
        for (let k = -i.wx / 2 + 0.8; k <= i.wx / 2 - 0.7; k += 1.1) stripes.push({ x: i.x + k, z: i.z + side * (i.wz / 2 + 2.2), rot: Math.PI / 2 });
      }
    }
    const inst = new THREE.InstancedMesh(stripeGeo, stripeMat, stripes.length);
    const dummy = new THREE.Object3D();
    stripes.forEach((s, idx) => {
      dummy.position.set(s.x, 0.036, s.z); dummy.rotation.set(0, s.rot, 0); dummy.updateMatrix();
      inst.setMatrixAt(idx, dummy.matrix);
    });
    this.root.add(inst);

    // blocchi (marciapiede) con cordolo
    const paveMat = layer(new THREE.MeshStandardMaterial({ map: this.tex.pave.clone(), roughness: 0.95 }), 3);
    const cobbleMat = layer(new THREE.MeshStandardMaterial({ map: this.tex.cobble.clone(), roughness: 0.95 }), 6);
    const grassMat = layer(new THREE.MeshStandardMaterial({ map: this.tex.grass.clone(), roughness: 1 }), 6);
    const curbMat = new THREE.MeshStandardMaterial({ color: 0xcfcbc2, roughness: 0.9 });
    const mkTop = (x0, x1, z0, z1, y, mat, tile) => {
      const w = x1 - x0, d = z1 - z0;
      const mm = mat.clone(); mm.polygonOffset = mat.polygonOffset; mm.polygonOffsetFactor = mat.polygonOffsetFactor; mm.polygonOffsetUnits = mat.polygonOffsetUnits; mm.map = mat.map.clone(); mm.map.needsUpdate = true; mm.map.repeat.set(w / tile, d / tile);
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d).rotateX(-Math.PI / 2), mm);
      m.position.set((x0 + x1) / 2, y, (z0 + z1) / 2); m.receiveShadow = true;
      this.root.add(m);
      return m;
    };
    for (const b of this.layout.blocks) {
      mkTop(b.x0, b.x1, b.z0, b.z1, 0.06, paveMat, 5);
      // cordoli
      const cw = 0.28;
      const curb = (x0, x1, z0, z1) => {
        const m = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, 0.14, z1 - z0), curbMat);
        m.position.set((x0 + x1) / 2, 0.06, (z0 + z1) / 2); m.receiveShadow = true; this.root.add(m);
      };
      curb(b.x0, b.x1, b.z0, b.z0 + cw); curb(b.x0, b.x1, b.z1 - cw, b.z1);
      curb(b.x0, b.x0 + cw, b.z0, b.z1); curb(b.x1 - cw, b.x1, b.z0, b.z1);
    }
    for (const p of this.layout.parks) mkTop(p.x0, p.x1, p.z0, p.z1, 0.075, grassMat, 8);
    for (const p of this.layout.plazas) mkTop(p.x0, p.x1, p.z0, p.z1, 0.075, p.kind === 'forecourt' ? paveMat : cobbleMat, 4);

    // parchi: viali in ghiaia
    for (const p of this.layout.parks) {
      if (p.kind === 'garden') continue;
      const cx = (p.x0 + p.x1) / 2, cz = (p.z0 + p.z1) / 2;
      mkTop(cx - 1.4, cx + 1.4, p.z0, p.z1, 0.08, layer(new THREE.MeshStandardMaterial({ map: this.tex.path }), 8), 3);
      mkTop(p.x0, p.x1, cz - 1.4, cz + 1.4, 0.082, layer(new THREE.MeshStandardMaterial({ map: this.tex.path }), 9), 3);
    }
  }

  // ---------- edifici ----------
  buildBuildings() {
    const roofGeoHip = new THREE.ConeGeometry(0.7071, 1, 4);
    roofGeoHip.rotateY(Math.PI / 4);
    const roofMats = new Map();
    const roofMat = (c) => {
      let m = roofMats.get(c);
      if (!m) { m = new THREE.MeshStandardMaterial({ color: c, roughness: 0.85 }); roofMats.set(c, m); }
      return m;
    };
    const signGeo = new THREE.PlaneGeometry(1, 1);
    for (const b of this.layout.buildings) {
      const mesh = this.facadeBox(b.x0, b.x1, b.z0, b.z1, 0, b.h, b.color, this.mats.roofTop);
      this.root.add(mesh);
      this.grid.add({ x0: b.x0, x1: b.x1, z0: b.z0, z1: b.z1, y0: 0, y1: b.h });
      // tetto a padiglione
      const w = b.x1 - b.x0 + 1.0, d = b.z1 - b.z0 + 1.0;
      const rh = clamp(Math.min(w, d) * 0.28, 1.8, 4.5);
      const roof = new THREE.Mesh(roofGeoHip, roofMat(b.roofColor));
      roof.scale.set(w, rh, d);
      roof.position.set((b.x0 + b.x1) / 2, b.h + rh / 2 - 0.05, (b.z0 + b.z1) / 2);
      roof.castShadow = true; roof.receiveShadow = true;
      this.root.add(roof);
      // porta + insegna sul fronte
      if (b.face) {
        const cx = (b.x0 + b.x1) / 2, cz = (b.z0 + b.z1) / 2;
        const off = 0.06;
        let px = cx, pz = cz, ry = 0;
        const bw = (b.face === 'n' || b.face === 's') ? b.x1 - b.x0 : b.z1 - b.z0;
        if (b.face === 'n') { pz = b.z0 - off; ry = Math.PI; }
        if (b.face === 's') { pz = b.z1 + off; ry = 0; }
        if (b.face === 'w') { px = b.x0 - off; ry = -Math.PI / 2; }
        if (b.face === 'e') { px = b.x1 + off; ry = Math.PI / 2; }
        const door = new THREE.Mesh(signGeo, new THREE.MeshStandardMaterial({ color: 0x4a3426, roughness: 0.7 }));
        door.scale.set(1.5, 2.6, 1); door.position.set(px, 1.3, pz); door.rotation.y = ry; this.root.add(door);
        if (b.name) {
          const big = b.big;
          const tex = T.textTexture(b.name.toUpperCase(), { w: 1024, h: big ? 160 : 128, font: `bold ${big ? 84 : 76}px Arial`, fg: '#f6f2e6', bg: big ? '#1d3a6b' : '#3a2a22' });
          const sw = Math.min(bw * 0.8, big ? 16 : 7.5);
          const s = new THREE.Mesh(signGeo, new THREE.MeshBasicMaterial({ map: tex }));
          s.scale.set(sw, sw * (big ? 0.156 : 0.125), 1);
          s.position.set(px, big ? 3.6 : 3.05, pz);
          s.rotation.y = ry;
          // offset per evitare z-fighting
          s.position.x += Math.sin(ry) * 0.03; s.position.z += Math.cos(ry) * 0.03;
          this.root.add(s);
        }
      }
    }
  }

  // ---------- decorazioni ----------
  buildDecor() {
    const M = this.mats;
    const add = (m) => { m.castShadow = true; m.receiveShadow = true; this.root.add(m); return m; };
    for (const d of this.layout.decor) {
      if (d.type === 'fountain') {
        const g = new THREE.Group();
        const basin = new THREE.Mesh(new THREE.CylinderGeometry(d.r, d.r * 1.05, 0.7, 28), M.stone);
        basin.position.y = 0.35;
        const water = new THREE.Mesh(new THREE.CylinderGeometry(d.r * 0.92, d.r * 0.92, 0.1, 28), M.water);
        water.position.y = 0.66;
        const col = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.5, 2.4, 12), M.stone); col.position.y = 1.5;
        const top = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 0.5, 0.35, 16), M.stone); top.position.y = 2.7;
        g.add(basin, water, col, top);
        g.position.set(d.x, 0.08, d.z); g.traverse((o) => { o.castShadow = true; o.receiveShadow = true; });
        this.root.add(g);
        this.grid.add({ x0: d.x - d.r, x1: d.x + d.r, z0: d.z - d.r, z1: d.z + d.r, y0: 0, y1: 1 });
      } else if (d.type === 'monument') {
        const g = new THREE.Group();
        const p1 = new THREE.Mesh(new THREE.BoxGeometry(5, 0.5, 5), M.stone); p1.position.y = 0.25;
        const p2 = new THREE.Mesh(new THREE.BoxGeometry(3.6, 2.2, 3.6), M.stone); p2.position.y = 1.6;
        const p3 = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.4, 2.8), M.stone); p3.position.y = 2.9;
        const fig = new THREE.Mesh(new THREE.CapsuleGeometry(0.4, 1.6, 4, 10), M.bronze); fig.position.y = 4.1;
        const head = new THREE.Mesh(new THREE.SphereGeometry(0.28, 12, 10), M.bronze); head.position.y = 5.2;
        g.add(p1, p2, p3, fig, head);
        g.position.set(d.x, 0.08, d.z); g.traverse((o) => { o.castShadow = true; o.receiveShadow = true; });
        this.root.add(g);
        this.grid.add({ x0: d.x - 2.5, x1: d.x + 2.5, z0: d.z - 2.5, z1: d.z + 2.5, y0: 0, y1: 5 });
      } else if (d.type === 'pond') {
        const pond = new THREE.Mesh(new THREE.CylinderGeometry(d.r, d.r, 0.12, 32), M.water);
        pond.position.set(d.x, 0.12, d.z); pond.receiveShadow = true; this.root.add(pond);
        const rim = new THREE.Mesh(new THREE.TorusGeometry(d.r, 0.3, 6, 36), M.stone);
        rim.rotation.x = Math.PI / 2; rim.position.set(d.x, 0.14, d.z); this.root.add(rim);
        this.grid.add({ x0: d.x - d.r, x1: d.x + d.r, z0: d.z - d.r, z1: d.z + d.r, y0: 0, y1: 0.8 });
      } else if (d.type === 'bench') {
        const g = new THREE.Group();
        const seat = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.07, 0.5), M.wood); seat.position.y = 0.45;
        const back = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.45, 0.06), M.wood); back.position.set(0, 0.75, -0.22);
        const l1 = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.45, 0.45), M.dark); l1.position.set(-0.8, 0.22, 0);
        const l2 = l1.clone(); l2.position.x = 0.8;
        g.add(seat, back, l1, l2); g.position.set(d.x, 0.08, d.z); g.rotation.y = d.rot || 0;
        g.traverse((o) => { o.castShadow = true; });
        this.root.add(g);
        this.grid.add({ x0: d.x - 0.9, x1: d.x + 0.9, z0: d.z - 0.3, z1: d.z + 0.3, y0: 0, y1: 1 });
      } else if (d.type === 'playground') {
        const mat = new THREE.MeshStandardMaterial({ color: 0xd9442f });
        const mat2 = new THREE.MeshStandardMaterial({ color: 0x2f7fd9 });
        const base = new THREE.Mesh(new THREE.BoxGeometry(5, 0.1, 5), new THREE.MeshStandardMaterial({ color: 0xb08c5a, roughness: 1 }));
        base.position.set(d.x, 0.1, d.z); this.root.add(base);
        for (let i = 0; i < 4; i++) {
          const p = new THREE.Mesh(new THREE.BoxGeometry(0.12, 2.4, 0.12), mat);
          p.position.set(d.x + (i % 2 ? 1.6 : -1.6), 1.3, d.z + (i < 2 ? 1.6 : -1.6)); add(p);
        }
        const roof = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.15, 3.6), mat2); roof.position.set(d.x, 2.5, d.z); add(roof);
        this.grid.add({ x0: d.x - 2.5, x1: d.x + 2.5, z0: d.z - 2.5, z1: d.z + 2.5, y0: 0, y1: 1.2 });
      } else if (d.type === 'busstop') {
        const g = new THREE.Group();
        const roof = new THREE.Mesh(new THREE.BoxGeometry(4, 0.1, 1.6), M.dark); roof.position.y = 2.5;
        const back = new THREE.Mesh(new THREE.BoxGeometry(4, 2.4, 0.05), new THREE.MeshStandardMaterial({ color: 0x9fc4d8, transparent: true, opacity: 0.45, roughness: 0.1 })); back.position.set(0, 1.25, -0.75);
        g.add(roof, back);
        for (const sx of [-1.95, 1.95]) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.08, 2.5, 0.08), M.dark); p.position.set(sx, 1.25, -0.7); g.add(p); }
        g.position.set(d.x, 0.08, d.z); g.traverse((o) => { o.castShadow = true; });
        this.root.add(g);
      } else if (d.type === 'tracks') {
        const gm = layer(new THREE.MeshStandardMaterial({ map: this.tex.gravel.clone(), roughness: 1 }), 8);
        gm.map.repeat.set((d.x1 - d.x0) / 6, (d.z1 - d.z0) / 6); gm.map.needsUpdate = true;
        const bed = new THREE.Mesh(new THREE.PlaneGeometry(d.x1 - d.x0, d.z1 - d.z0).rotateX(-Math.PI / 2), gm);
        bed.position.set((d.x0 + d.x1) / 2, 0.08, (d.z0 + d.z1) / 2); bed.receiveShadow = true; this.root.add(bed);
        const railGeo = new THREE.BoxGeometry(d.x1 - d.x0, 0.12, 0.08);
        for (const zc of [-212, -202, -192, -186]) {
          for (const dz of [-0.72, 0.72]) {
            const r = new THREE.Mesh(railGeo, M.metal); r.position.set((d.x0 + d.x1) / 2, 0.16, zc + dz); this.root.add(r);
          }
        }
        // marciapiede/banchina
        const plat = new THREE.Mesh(new THREE.BoxGeometry(d.x1 - d.x0, 0.5, 5), M.concrete);
        plat.position.set((d.x0 + d.x1) / 2, 0.25, -196.5); plat.receiveShadow = true; this.root.add(plat);
        this.grid.add({ x0: d.x0, x1: d.x1, z0: d.z0, z1: -180.5, y0: 0, y1: 4 }); // area binari invalicabile
      } else if (d.type === 'train') {
        const g = new THREE.Group();
        const bodyMat = new THREE.MeshStandardMaterial({ color: 0xd8dde3, roughness: 0.5, metalness: 0.3 });
        const stripeMat = new THREE.MeshStandardMaterial({ color: 0x2f7a3b });
        for (let i = 0; i < 3; i++) {
          const car = new THREE.Mesh(new THREE.BoxGeometry(22, 3.5, 3), bodyMat); car.position.set(i * 23, 2.6, 0);
          const st = new THREE.Mesh(new THREE.BoxGeometry(22.02, 0.6, 3.02), stripeMat); st.position.set(i * 23, 1.6, 0);
          const win = new THREE.Mesh(new THREE.BoxGeometry(20, 1.0, 3.04), new THREE.MeshStandardMaterial({ color: 0x1a2430, roughness: 0.2, metalness: 0.5 })); win.position.set(i * 23, 3.2, 0);
          g.add(car, st, win);
        }
        g.position.set(d.x - 30, 0.1, -212); g.traverse((o) => { o.castShadow = true; });
        this.root.add(g);
      }
    }
  }

  buildTrees() {
    const trunkGeo = new THREE.CylinderGeometry(0.16, 0.24, 1, 7).translate(0, 0.5, 0);
    const foliageGeo = new THREE.IcosahedronGeometry(1, 1);
    const trees = this.layout.trees;
    const trunks = new THREE.InstancedMesh(trunkGeo, new THREE.MeshStandardMaterial({ color: 0x5b4330, roughness: 1 }), trees.length);
    const foliage = new THREE.InstancedMesh(foliageGeo, new THREE.MeshStandardMaterial({ roughness: 0.95, flatShading: true }), trees.length * 2);
    const d = new THREE.Object3D(), col = new THREE.Color();
    const rnd = this.rnd;
    trees.forEach((t, i) => {
      const h = 3.2 * t.s, r = 1.9 * t.s;
      d.position.set(t.x, 0.08, t.z); d.scale.set(t.s, h, t.s); d.rotation.set(0, 0, 0); d.updateMatrix(); trunks.setMatrixAt(i, d.matrix);
      for (let k = 0; k < 2; k++) {
        d.position.set(t.x + (k ? 0.6 : -0.3) * t.s, h + (k ? 1.4 : 0.6) * t.s, t.z + (k ? -0.4 : 0.3) * t.s);
        d.scale.set(r * (k ? 0.75 : 1), r * (k ? 0.75 : 0.9), r * (k ? 0.75 : 1)); d.rotation.set(rnd() * 3, rnd() * 3, 0);
        d.updateMatrix(); foliage.setMatrixAt(i * 2 + k, d.matrix);
        // autunno: alcune chiome rossicce come nelle foto
        const autumn = rnd() < 0.25;
        col.setHSL(autumn ? 0.04 + rnd() * 0.06 : 0.25 + rnd() * 0.07, autumn ? 0.6 : 0.45, 0.28 + rnd() * 0.12);
        foliage.setColorAt(i * 2 + k, col);
      }
      if (!t.edge) this.grid.add({ x0: t.x - 0.3, x1: t.x + 0.3, z0: t.z - 0.3, z1: t.z + 0.3, y0: 0, y1: 4 });
    });
    trunks.castShadow = true; foliage.castShadow = true; foliage.receiveShadow = true;
    this.root.add(trunks, foliage);
  }

  buildLamps() {
    const lamps = this.layout.lamps;
    const poleGeo = new THREE.CylinderGeometry(0.07, 0.1, 6.2, 8).translate(0, 3.1, 0);
    const armGeo = new THREE.BoxGeometry(1.3, 0.08, 0.08).translate(0.6, 0, 0);
    const headGeo = new THREE.BoxGeometry(0.7, 0.14, 0.3);
    const poles = new THREE.InstancedMesh(poleGeo, this.mats.dark, lamps.length);
    const arms = new THREE.InstancedMesh(armGeo, this.mats.dark, lamps.length);
    const heads = new THREE.InstancedMesh(headGeo, new THREE.MeshStandardMaterial({ color: 0xfff1cf, emissive: 0xffd9a0, emissiveIntensity: 0 }), lamps.length);
    const pools = new THREE.InstancedMesh(new THREE.PlaneGeometry(16, 16).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: this.tex.glow, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }), lamps.length);
    const d = new THREE.Object3D();
    lamps.forEach((l, i) => {
      // il braccio punta verso la strada (a seconda del lato)
      const dirx = l.axis === 'x' ? 0 : (l.rot > 0 ? -1 : 1);
      const dirz = l.axis === 'x' ? (l.rot > 0 ? -1 : 1) : 0;
      d.position.set(l.x, 0.08, l.z); d.rotation.set(0, 0, 0); d.scale.set(1, 1, 1); d.updateMatrix(); poles.setMatrixAt(i, d.matrix);
      d.position.set(l.x, 6.1, l.z); d.rotation.set(0, Math.atan2(-dirz, dirx), 0); d.updateMatrix(); arms.setMatrixAt(i, d.matrix);
      d.position.set(l.x + dirx * 1.3, 6.05, l.z + dirz * 1.3); d.rotation.set(0, Math.atan2(-dirz, dirx), 0); d.updateMatrix(); heads.setMatrixAt(i, d.matrix);
      d.position.set(l.x + dirx * 1.3, 0.1, l.z + dirz * 1.3); d.rotation.set(0, 0, 0); d.updateMatrix(); pools.setMatrixAt(i, d.matrix);
      this.grid.add({ x0: l.x - 0.15, x1: l.x + 0.15, z0: l.z - 0.15, z1: l.z + 0.15, y0: 0, y1: 6 });
    });
    poles.castShadow = true;
    this.root.add(poles, arms, heads, pools);
    this.lampHeads = [heads];
    this.nightObjs.push(pools);
    pools.visible = false;
  }

  buildBounds() {
    const { x0, x1, z0, z1 } = WORLD;
    const t = 4;
    this.grid.add({ x0: x0 - t, x1: x0, z0: z0 - t, z1: z1 + t, y0: 0, y1: 50 });
    this.grid.add({ x0: x1, x1: x1 + t, z0: z0 - t, z1: z1 + t, y0: 0, y1: 50 });
    this.grid.add({ x0: x0 - t, x1: x1 + t, z0: z0 - t, z1: z0, y0: 0, y1: 50 });
    this.grid.add({ x0: x0 - t, x1: x1 + t, z0: z1, z1: z1 + t, y0: 0, y1: 50 });
    for (const b of this.grid.all.slice(-4)) b.noCam = true;
  }

  update(dt, center) {
    this.updateSun(center);
  }
}
