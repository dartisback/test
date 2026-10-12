import * as THREE from 'three';
import { Sky } from 'three/examples/jsm/objects/Sky.js';
import { ColliderGrid, makeRng, clamp, lerp, smooth, TAU, layer, hex2lin } from './util.js';
import { WORLD, FLOOR_H, PLAZAS, VESUVIO, FACTIONS, FACTION_IDS, generateCity, heightAt, districtAt, streetNameAt } from './napoli.js';
import { RoadGraph } from './roadgraph.js';
import { Batch, ChunkedBatches } from './batch.js';
import * as T from './textures.js';
import { buildLandmarks } from './landmarks.js';
import { buildProps } from './props.js';
import { buildHQ, bayPositions } from './hq.js';

const tick = () => new Promise((r) => setTimeout(r, 0));
const GROUND_BIAS = 0.1;      // altezza a cui "camminano" persone e veicoli sopra heightAt
const ROAD_Y = 0.06, WALK_Y = 0.14, TERRAIN_DROP = 0.15;

export class World {
  constructor(scene) {
    this.scene = scene;
    this.city = generateCity();
    this.graph = new RoadGraph(this.city.roads);
    this.grid = new ColliderGrid(32);
    this.root = new THREE.Group(); this.root.name = 'napoli';
    scene.add(this.root);
    this.facadeMats = {};
    this.nightObjs = [];
    this.hqs = {};
    this.hour = 15.5;
  }

  groundY(x, z) { return heightAt(x, z) + GROUND_BIAS; }
  normalAt(x, z, out = new THREE.Vector3()) {
    const e = 2;
    const hx = heightAt(x + e, z) - heightAt(x - e, z), hz = heightAt(x, z + e) - heightAt(x, z - e);
    return out.set(-hx / (2 * e), 1, -hz / (2 * e)).normalize();
  }
  streetName(x, z) { return streetNameAt(this.city, x, z); }

  /** punto su un marciapiede (per far comparire persone) in un anello attorno a (x,z) */
  sidewalkSpot(rnd, x, z, rMin, rMax, tries = 20) {
    const g = this.graph;
    for (let k = 0; k < tries; k++) {
      const ring = g.nodesInRing(x, z, rMin, rMax);
      if (!ring.length) return null;
      const n = ring[Math.floor(rnd() * ring.length)];
      if (!n.adj.length) continue;
      const e = n.adj[Math.floor(rnd() * n.adj.length)];
      if (e.len < 14) continue;
      const t = 5 + rnd() * (e.len - 10), l = e.line, side = rnd() < 0.5 ? 1 : -1;
      const off = (l.w / 2 + (l.sw > 0 ? l.sw * 0.5 : 0.9)) * side;
      const px = e.a.x + e.dx * t - e.dz * off, pz = e.a.z + e.dz * t + e.dx * off;
      if (this.grid.pointBlocked(px, pz, this.groundY(px, pz) + 1)) continue;
      return { x: px, z: pz, edge: e, t, side, node: n };
    }
    return null;
  }

  /** punto sulla carreggiata (lato destro) lungo un arco */
  roadSpot(e, t, lane = 1.8) {
    const off = Math.min(lane, e.line.w / 2 - 0.9);
    return { x: e.a.x + e.dx * t - e.dz * off, z: e.a.z + e.dz * t + e.dx * off, h: Math.atan2(e.dx, e.dz) };
  }
  district(x, z) { return districtAt(this.city, x, z); }
  addCollider(b) { return this.grid.add(b); }

  // ---------------------------------------------------------------------------------
  async build(progress = () => {}) {
    this.rnd = makeRng(2024);
    progress(0.02, 'Preparazione texture…'); await tick();
    this.tex = {
      facades: { old: T.facadeVariant('old'), modern: T.facadeVariant('modern'), tower: T.facadeVariant('tower'), shed: T.facadeVariant('shed') },
      road: T.asphaltRoadTexture(), asphalt: T.plainAsphaltTexture(), pave: T.pavementTexture(), cobble: T.cobbleTexture(),
      grass: T.grassTexture(), gravel: T.gravelTexture(), detail: T.terrainDetailTexture(), sea: T.seaNormalTexture(), glow: T.glowTexture(),
      murals: [0, 1, 2, 3, 4].map((k) => T.muralTexture(k)),
    };
    this.makeMaterials();
    this.buildSky();
    progress(0.06, 'Mare, cielo e Vesuvio…'); await tick();
    this.buildSea();
    this.buildMountains();
    progress(0.12, 'Terreno e colline…'); await tick();
    this.buildTerrain();
    progress(0.26, 'Strade e marciapiedi…'); await tick();
    this.chunks = new ChunkedBatches(256);
    this.buildRoads();
    progress(0.42, 'Edifici di Napoli…'); await tick();
    this.buildBuildings();
    progress(0.56, 'Monumenti e quartieri…'); await tick();
    buildLandmarks(this);
    progress(0.66, 'Sedi dei corpi…'); await tick();
    for (const id of FACTION_IDS) { const f = FACTIONS[id]; this.hqs[id] = buildHQ(this, { ...f, bays: bayPositions(f.vehicles.length, f.spacing) }); }
    progress(0.76, 'Alberi, lampioni, murales…'); await tick();
    buildProps(this);
    progress(0.86, 'Ultimi ritocchi…'); await tick();
    for (const m of this.chunks.meshes(this.mats)) this.root.add(m);
    this.buildBounds();
    this.setTimeOfDay(this.hour);
    progress(0.92, 'Quasi pronto…'); await tick();
  }

  // ---------------------------------------------------------------------------------
  makeMaterials() {
    const std = (o) => new THREE.MeshStandardMaterial({ roughness: 0.92, ...o });
    this.mats = {};
    for (const k of ['old', 'modern', 'tower', 'shed']) {
      const m = std({ map: this.tex.facades[k].map, vertexColors: true, emissive: 0xffd9a0, emissiveMap: this.tex.facades[k].emissive, emissiveIntensity: 0 });
      this.mats['f_' + k] = m; this.facadeMats[k] = m;
    }
    this.mats.solid = std({ vertexColors: true });
    const road = (map, n) => layer(std({ map: map.clone(), vertexColors: true }), n);
    this.mats.road_main = road(this.tex.road, 2); this.mats.road_main.userData.noShadow = true;
    this.mats.road_plain = road(this.tex.asphalt, 3); this.mats.road_plain.userData.noShadow = true;
    this.mats.road_cobble = road(this.tex.cobble, 2); this.mats.road_cobble.userData.noShadow = true;
    this.mats.walk = road(this.tex.pave, 4); this.mats.walk.userData.noShadow = true;
    this.mats.plaza = road(this.tex.cobble, 4); this.mats.plaza.userData.noShadow = true;
    this.mats.marks = layer(std({ vertexColors: true }), 6); this.mats.marks.userData.noShadow = true;
    this.mats.grass = layer(std({ map: this.tex.grass.clone(), vertexColors: true }), 3); this.mats.grass.userData.noShadow = true;
    this.mats.floor = layer(std({ map: T.floorTilesTexture(), vertexColors: true }), 8);
    for (const k of [0, 1, 2, 3, 4]) this.mats['mural' + k] = layer(std({ map: this.tex.murals[k], roughness: 0.8, polygonOffset: true }), 3);
    for (const k of Object.values(this.mats)) k.userData = k.userData || {};
  }

  // ---------------------------------------------------------------------------------
  buildSky() {
    const sky = new Sky();
    sky.scale.setScalar(14000);
    const u = sky.material.uniforms;
    u.turbidity.value = 3.5; u.rayleigh.value = 1.5; u.mieCoefficient.value = 0.004; u.mieDirectionalG.value = 0.82;
    this.root.add(sky); this.sky = sky;
    this.hemi = new THREE.HemisphereLight(0xbcd4ff, 0x6a6350, 0.9);
    this.root.add(this.hemi);
    this.sun = new THREE.DirectionalLight(0xfff1d6, 3);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    const sc = this.sun.shadow.camera;
    sc.left = -70; sc.right = 70; sc.top = 70; sc.bottom = -70; sc.near = 1; sc.far = 500;
    this.sun.shadow.bias = -0.0004; this.sun.shadow.normalBias = 0.06;
    this.root.add(this.sun, this.sun.target);
    this.scene.fog = new THREE.Fog(0xb8cce0, 220, 3000);
  }

  setTimeOfDay(h) {
    this.hour = ((h % 24) + 24) % 24;
    const t = this.hour;
    const az = ((t - 6) / 12) * Math.PI;
    const e = Math.sin(az) * 1.08;
    const sinE = Math.sin(e);
    this.sunDir = new THREE.Vector3(Math.cos(az) * Math.cos(e), sinE, Math.sin(az) * Math.cos(e)).normalize();
    const day = clamp(sinE * 3 + 0.25, 0, 1);
    const dusk = clamp(1 - Math.abs(sinE) * 5, 0, 1);
    this.dayFactor = day;
    this.sky.material.uniforms.sunPosition.value.copy(this.sunDir).multiplyScalar(1000);
    this.sky.material.uniforms.rayleigh.value = 1.2 + dusk * 2.2 + (1 - day) * 0.3;
    this.sun.color.setRGB(1, 0.92 - dusk * 0.28, 0.82 - dusk * 0.5);
    this.sun.intensity = sinE > -0.02 ? 3.2 * clamp(sinE * 2.2 + 0.1, 0, 1) : 0;
    this.hemi.intensity = 0.12 + day * 0.95;
    this.hemi.color.setRGB(0.55 + day * 0.2, 0.62 + day * 0.2, 0.85 + day * 0.1);
    const fogDay = new THREE.Color(0xbcd0e4), fogDusk = new THREE.Color(0xe9a77a), fogNight = new THREE.Color(0x070b16);
    this.scene.fog.color.copy(fogNight.clone().lerp(fogDay, day).lerp(fogDusk, dusk * 0.6 * day + dusk * 0.2));
    this.night = sinE < 0.08;
    const nightAmt = 1 - clamp(sinE * 6 + 0.5, 0, 1);
    this.nightAmt = nightAmt;
    for (const m of Object.values(this.facadeMats)) m.emissiveIntensity = nightAmt * 0.9;
    for (const o of this.nightObjs) o.visible = nightAmt > 0.2;
    for (const l of this.lampHeads || []) l.material.emissiveIntensity = nightAmt * 4;
    if (this.seaMat) { this.seaMat.color.setRGB(0.05 + day * 0.07, 0.2 + day * 0.28, 0.32 + day * 0.35); }
    this.exposure = 0.78 - nightAmt * 0.25;
  }

  updateSun(center) {
    if (!this.sunDir) return;
    const up = this.sunDir.y > 0.02 ? this.sunDir : new THREE.Vector3(0.3, 0.8, 0.2).normalize();
    this.sun.position.copy(center).addScaledVector(up, 180);
    this.sun.target.position.copy(center);
    this.sun.target.updateMatrixWorld();
  }

  update(dt, center) {
    this.updateSun(center);
    if (this.seaTex) { this.seaTex.offset.x += dt * 0.004; this.seaTex.offset.y += dt * 0.0025; }
  }

  // ---------------------------------------------------------------------------------
  buildSea() {
    this.seaTex = this.tex.sea.clone(); this.seaTex.needsUpdate = true; this.seaTex.repeat.set(220, 220);
    this.seaMat = new THREE.MeshStandardMaterial({ color: 0x2f84b4, roughness: 0.18, metalness: 0.05, normalMap: this.seaTex, normalScale: new THREE.Vector2(0.35, 0.35), envMapIntensity: 1.2 });
    const sea = new THREE.Mesh(new THREE.PlaneGeometry(14000, 9000).rotateX(-Math.PI / 2), this.seaMat);
    sea.position.set(500, -0.8, 4500 + 20);
    this.root.add(sea);
    // fondale "ghiaia" lungo costa per evitare buchi: il terreno scende sotto il pelo dell'acqua
  }

  buildMountains() {
    const rnd = makeRng(99);
    const geo = new THREE.ConeGeometry(1, 1, 8, 4, true);
    const pos = geo.attributes.position, colors = [];
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i) + 0.5;
      pos.setX(i, pos.getX(i) + (rnd() - 0.5) * 0.25 * (1 - y));
      const snow = y > 0.7 ? (y - 0.7) / 0.2 : 0;
      const c = new THREE.Color(0x56626f).lerp(new THREE.Color(0x4a6a42), clamp(1 - y * 1.7, 0, 1)).lerp(new THREE.Color(0xf2f4f7), clamp(snow, 0, 1));
      colors.push(c.r, c.g, c.b);
    }
    geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3)); geo.computeVertexNormals();
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, flatShading: true });
    const g = new THREE.Group();
    for (let i = 0; i < 60; i++) {
      const a = (i / 60) * TAU + rnd() * 0.1;
      // niente montagne a sud (mare)
      if (Math.sin(a) > 0.35) continue;
      const dist = 5200 + rnd() * 1800, h = 500 + rnd() * 1100;
      const m = new THREE.Mesh(geo, mat);
      m.scale.set(900 + rnd() * 900, h, 900 + rnd() * 900);
      m.position.set(500 + Math.cos(a) * dist, h / 2 - 150, -500 + Math.sin(a) * dist);
      m.rotation.y = rnd() * TAU; g.add(m);
    }
    this.root.add(g);
  }

  // ---------------------------------------------------------------------------------
  buildTerrain() {
    const CS = 8, N = 25; // celle da 8 m, chunk di 200 m
    const CW = CS * N;
    const x0 = Math.floor(WORLD.x0 / CW) * CW, z0 = Math.floor(WORLD.z0 / CW) * CW;
    const detail = this.tex.detail.clone(); detail.needsUpdate = true;
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, map: detail, roughness: 1 });
    mat.userData.noShadow = true;
    const parks = PLAZAS.filter((p) => p.kind === 'park').map((p) => p.rect);
    const districts = this.city.districts;
    const colAt = (x, z, h, slope) => {
      const dv = Math.hypot(x - VESUVIO.x, z - VESUVIO.z);
      let c = [0.34, 0.45, 0.23]; // verde
      let urban = false;
      for (const d of districts) if (x > d.rect.x0 - 6 && x < d.rect.x1 + 6 && z > d.rect.z0 - 6 && z < d.rect.z1 + 6) { urban = true; break; }
      if (urban) c = [0.45, 0.42, 0.37];
      for (const p of parks) if (x > p.x0 && x < p.x1 && z > p.z0 && z < p.z1) c = [0.27, 0.42, 0.18];
      if (dv < VESUVIO.R) {
        const k = smooth((h - 90) / 140), k2 = smooth((h - 300) / 90);
        c = [lerp(c[0], 0.2, k), lerp(c[1], 0.17, k), lerp(c[2], 0.15, k)];
        c = [lerp(c[0], 0.14, k2), lerp(c[1], 0.12, k2), lerp(c[2], 0.11, k2)];
      }
      if (slope > 0.55) { const k = smooth((slope - 0.55) / 0.5); c = [lerp(c[0], 0.36, k), lerp(c[1], 0.34, k), lerp(c[2], 0.3, k)]; }
      if (z > -34) { const k = smooth((z + 34) / 30); c = [lerp(c[0], 0.62, k), lerp(c[1], 0.54, k), lerp(c[2], 0.35, k)]; }
      if (z > 6) { const k = smooth((z - 6) / 8); c = [lerp(c[0], 0.3, k), lerp(c[1], 0.29, k), lerp(c[2], 0.27, k)]; }
      return c;
    };
    const meshes = [];
    for (let cx = x0; cx < WORLD.x1; cx += CW) for (let cz = z0; cz < WORLD.z1; cz += CW) {
      const verts = (N + 1) * (N + 1);
      const pos = new Float32Array(verts * 3), nor = new Float32Array(verts * 3), uv = new Float32Array(verts * 2), col = new Float32Array(verts * 3);
      let i = 0;
      for (let a = 0; a <= N; a++) for (let b = 0; b <= N; b++, i++) {
        const x = cx + b * CS, z = cz + a * CS, h = heightAt(x, z);
        const hx = heightAt(x + 3, z) - heightAt(x - 3, z), hz = heightAt(x, z + 3) - heightAt(x, z - 3);
        const nx = -hx / 6, nz = -hz / 6, l = Math.hypot(nx, 1, nz);
        pos.set([x, h - TERRAIN_DROP, z], i * 3); nor.set([nx / l, 1 / l, nz / l], i * 3); uv.set([x / 9, z / 9], i * 2);
        const c = colAt(x, z, h, Math.hypot(nx, nz));
        const v = 0.92 + ((Math.sin(x * 0.13) * Math.cos(z * 0.11)) * 0.5 + 0.5) * 0.16;
        col.set(c.map((q) => Math.pow(q * v, 2.2)), i * 3);
      }
      const idx = [];
      for (let a = 0; a < N; a++) for (let b = 0; b < N; b++) {
        const p = a * (N + 1) + b;
        idx.push(p, p + N + 1, p + 1, p + 1, p + N + 1, p + N + 2);
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
      g.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); g.setAttribute('color', new THREE.BufferAttribute(col, 3));
      g.setIndex(idx); g.computeBoundingSphere(); g.computeBoundingBox();
      const m = new THREE.Mesh(g, mat); m.receiveShadow = true; m.matrixAutoUpdate = false;
      meshes.push(m);
    }
    for (const m of meshes) this.root.add(m);
    this.terrainMeshes = meshes;
  }

  // ---------------------------------------------------------------------------------
  /** striscia lungo un asse con quota che segue il terreno */
  strip(mat, axis, fixed, a0, a1, o0, o1, yOff, uPer, vMode, color, step = 10) {
    const L = a1 - a0;
    if (L < 0.5) return;
    const n = Math.max(1, Math.ceil(L / step));
    const col = hex2lin(color);
    let prev = null;
    for (let i = 0; i <= n; i++) {
      const a = a0 + (L * i) / n;
      const p0 = axis === 'x' ? [a, 0, fixed + o0] : [fixed + o0, 0, a];
      const p1 = axis === 'x' ? [a, 0, fixed + o1] : [fixed + o1, 0, a];
      p0[1] = heightAt(p0[0], p0[2]) + yOff; p1[1] = heightAt(p1[0], p1[2]) + yOff;
      const cur = [p0, p1, a];
      if (prev) {
        const mx = (p0[0] + prev[0][0]) / 2, mz = (p0[2] + prev[0][2]) / 2;
        const B = this.chunks.get(mx, mz, mat);
        const u0 = (prev[2] - a0) / uPer, u1 = (a - a0) / uPer;
        const vv = vMode === 'across' ? [0, 1] : [o0 / uPer, o1 / uPer];
        // l'ordine dei vertici dipende dall'asse per avere la normale verso l'alto
        if (axis === 'x') B.quad(prev[0], cur[0], cur[1], prev[1], [0, 1, 0], [[u0, vv[0]], [u1, vv[0]], [u1, vv[1]], [u0, vv[1]]], col);
        else B.quad(prev[1], cur[1], cur[0], prev[0], [0, 1, 0], [[u0, vv[1]], [u1, vv[1]], [u1, vv[0]], [u0, vv[0]]], col);
      }
      prev = cur;
    }
  }

  buildRoads() {
    const C = this.city, G = this.graph;
    const cobbleDistricts = new Set(['vicoli', 'centro']);
    const matFor = (l) => (l.w >= 10.5 ? 'road_main' : l.district && cobbleDistricts.has(l.district) ? 'road_cobble' : l.w < 6 ? 'road_cobble' : 'road_plain');
    const WHITE = 0xffffff;
    const lineStrips = (l, axis) => {
      const fixed = axis === 'x' ? l.z : l.x, a0 = axis === 'x' ? l.x0 : l.z0, a1 = axis === 'x' ? l.x1 : l.z1;
      const m = matFor(l);
      this.strip(m, axis, fixed, a0, a1, -l.w / 2, l.w / 2, ROAD_Y, m === 'road_main' ? 40 : 12, m === 'road_main' ? 'across' : 'world', WHITE);
      if (l.sw > 0) {
        const cuts = (l.cross || []).map((q) => [q.c - q.w / 2 - 0.2, q.c + q.w / 2 + 0.2]).sort((p, q) => p[0] - q[0]);
        let segs = [[a0, a1]];
        for (const [c0, c1] of cuts) {
          const out = [];
          for (const [s0, s1] of segs) { if (c1 <= s0 || c0 >= s1) out.push([s0, s1]); else { if (c0 > s0) out.push([s0, c0]); if (c1 < s1) out.push([c1, s1]); } }
          segs = out;
        }
        for (const [s0, s1] of segs) {
          this.strip('walk', axis, fixed, s0, s1, l.w / 2, l.w / 2 + l.sw, WALK_Y, 4, 'world', WHITE, 12);
          this.strip('walk', axis, fixed, s0, s1, -l.w / 2 - l.sw, -l.w / 2, WALK_Y, 4, 'world', WHITE, 12);
        }
      }
    };
    for (const l of C.roads.H) lineStrips(l, 'x');
    for (const l of C.roads.V) lineStrips(l, 'z');

    // incroci + strisce pedonali
    const WH = new Map();
    for (const n of G.nodes) {
      let wH = 0, wV = 0, kindH = 'x', hasE = false, hasW = false, hasN = false, hasS = false, cob = false;
      for (const e of n.adj) {
        if (e.axis === 'x') { wH = Math.max(wH, e.line.w); if (e.dx > 0) hasE = true; else hasW = true; }
        else { wV = Math.max(wV, e.line.w); if (e.dz > 0) hasS = true; else hasN = true; }
        if (matFor(e.line) === 'road_cobble') cob = true;
      }
      if (!wH || !wV) continue;
      const y = (x, z) => heightAt(x, z) + ROAD_Y + 0.01;
      const x0 = n.x - wV / 2, x1 = n.x + wV / 2, z0 = n.z - wH / 2, z1 = n.z + wH / 2;
      const B = this.chunks.get(n.x, n.z, cob && Math.min(wH, wV) < 8 ? 'road_cobble' : 'road_plain');
      B.quad([x0, y(x0, z1), z1], [x1, y(x1, z1), z1], [x1, y(x1, z0), z0], [x0, y(x0, z0), z0], [0, 1, 0], [[0, 1], [1, 1], [1, 0], [0, 0]], hex2lin(0xffffff));
      if (Math.min(wH, wV) >= 9) {
        const M = this.chunks.get(n.x, n.z, 'marks');
        const stripe = (cx, cz, along) => { // along: 'x' = strisce lunghe in x
          const hx = along === 'x' ? 1.5 : 0.25, hz = along === 'x' ? 0.25 : 1.5;
          const yy = heightAt(cx, cz) + ROAD_Y + 0.05;
          M.quad([cx - hx, yy, cz + hz], [cx + hx, yy, cz + hz], [cx + hx, yy, cz - hz], [cx - hx, yy, cz - hz], [0, 1, 0], [[0, 0], [1, 0], [1, 1], [0, 1]], hex2lin(0xe6e6de));
        };
        // attraversamenti pedonali su ogni braccio esistente
        if (hasE) for (let k = -wH / 2 + 1; k < wH / 2 - 0.5; k += 1.1) stripe(n.x + wV / 2 + 2.2, n.z + k, 'x');
        if (hasW) for (let k = -wH / 2 + 1; k < wH / 2 - 0.5; k += 1.1) stripe(n.x - wV / 2 - 2.2, n.z + k, 'x');
        if (hasS) for (let k = -wV / 2 + 1; k < wV / 2 - 0.5; k += 1.1) stripe(n.x + k, n.z + wH / 2 + 2.2, 'z');
        if (hasN) for (let k = -wV / 2 + 1; k < wV / 2 - 0.5; k += 1.1) stripe(n.x + k, n.z - wH / 2 - 2.2, 'z');
      }
    }

    // piazze lastricate
    for (const p of PLAZAS) {
      if (p.kind === 'park' || p.kind === 'landmark') continue;
      const r = p.rect;
      const mat = p.kind === 'port' ? 'walk' : 'plaza';
      for (let x = r.x0; x < r.x1; x += 16) for (let z = r.z0; z < r.z1; z += 16) {
        const xx = Math.min(x + 16, r.x1), zz = Math.min(z + 16, r.z1);
        const B = this.chunks.get(x, z, mat);
        const y = (a, b) => heightAt(a, b) + ROAD_Y + 0.04;
        const u = (a) => a / 5;
        B.quad([x, y(x, zz), zz], [xx, y(xx, zz), zz], [xx, y(xx, z), z], [x, y(x, z), z], [0, 1, 0], [[u(x), u(zz)], [u(xx), u(zz)], [u(xx), u(z)], [u(x), u(z)]], hex2lin(p.kind === 'plaza' ? 0xd9d2c2 : 0xcfcabb));
      }
    }
  }

  // ---------------------------------------------------------------------------------
  buildBuildings() {
    this.signBuildings = [];
    for (const b of this.city.buildings) this.placeBuilding(b);
  }

  /** aggiunge un edificio (facciata, tetto, collider, murale) alle mesh fuse */
  placeBuilding(b) {
    const rnd = this.rnd;
    const solid = (x, z) => this.chunks.get(x, z, 'solid');
    const cx = (b.x0 + b.x1) / 2, cz = (b.z0 + b.z1) / 2;
    const gy = Math.max(heightAt(b.x0, b.z0), heightAt(b.x1, b.z0), heightAt(b.x0, b.z1), heightAt(b.x1, b.z1), heightAt(cx, cz)) + 0.05;
    const bottom = gy - 8, top = gy + b.h;
    b.gy = gy; b.top = top;
    const fh = b.variant === 'shed' ? 5.2 : FLOOR_H;
    const F = this.chunks.get(cx, cz, 'f_' + b.variant);
    F.box(b.x0, b.x1, bottom, top, b.z0, b.z1, b.color, { sideUV: { v0: gy }, floorH: fh, top: false });
    const S = solid(cx, cz);
    if (b.roof === 'hip') {
      const rh = clamp(Math.min(b.x1 - b.x0, b.z1 - b.z0) * 0.26, 1.8, 4.2);
      S.hip(b.x0, b.x1, b.z0, b.z1, top, rh, b.roofColor, 0.5);
      b.top = top + rh;
    } else {
      const gray = 0x7b786f;
      S.box(b.x0, b.x1, top - 0.02, top + 0.02, b.z0, b.z1, gray, { sides: [false, false, false, false] });
      const t = 0.32, ph = 0.85;
      S.box(b.x0, b.x1, top, top + ph, b.z0, b.z0 + t, b.color);
      S.box(b.x0, b.x1, top, top + ph, b.z1 - t, b.z1, b.color);
      S.box(b.x0, b.x0 + t, top, top + ph, b.z0 + t, b.z1 - t, b.color);
      S.box(b.x1 - t, b.x1, top, top + ph, b.z0 + t, b.z1 - t, b.color);
      if (!b.noClutter && rnd() < 0.5 && b.x1 - b.x0 > 8 && b.z1 - b.z0 > 8) {
        const tx = b.x0 + 2 + rnd() * (b.x1 - b.x0 - 6), tz = b.z0 + 2 + rnd() * (b.z1 - b.z0 - 6);
        S.box(tx, tx + 2.2, top, top + 2.2, tz, tz + 2.2, rnd() < 0.5 ? 0x8f8c84 : 0xb3714a);
      }
      if (!b.noClutter && rnd() < 0.3) { const ax = b.x0 + 1.5 + rnd() * (b.x1 - b.x0 - 3), az = b.z0 + 1.5 + rnd() * (b.z1 - b.z0 - 3); S.box(ax, ax + 0.15, top, top + 3.5, az, az + 0.15, 0x333333); }
      b.top = top + ph;
    }
    this.grid.add({ x0: b.x0, x1: b.x1, z0: b.z0, z1: b.z1, y0: bottom, y1: b.top });
    if (b.mural !== undefined && b.face && !b.muralDone) this.addMural(b, b.mural, 0.0);
    if (b.name && b.face) this.signBuildings.push(b);
    return b;
  }

  /** murale su una facciata libera (face: n,s,e,w) */
  addMural(b, kind, scaleBoost = 0, opts = {}) {
    const hgt = Math.min(b.h - 3, (opts.h || 20) + scaleBoost);
    const wid = opts.w || hgt / 2;
    const off = 0.07;
    const B = this.chunks.get((b.x0 + b.x1) / 2, (b.z0 + b.z1) / 2, 'mural' + kind);
    const col = hex2lin(0xffffff);
    const y0 = b.gy + 1.2, y1 = y0 + hgt;
    const C = (a, b2) => (a + b2) / 2;
    const uv = [[0, 0], [1, 0], [1, 1], [0, 1]];
    const L = b.face === 'n' || b.face === 's' ? b.x1 - b.x0 : b.z1 - b.z0;
    const w2 = Math.min(wid, L - 1) / 2;
    const c = (opts.pos !== undefined ? opts.pos : 0.5) * L;
    if (b.face === 's') { const xc = b.x0 + clamp(c, w2 + 0.5, L - w2 - 0.5); B.quad([xc - w2, y0, b.z1 + off], [xc + w2, y0, b.z1 + off], [xc + w2, y1, b.z1 + off], [xc - w2, y1, b.z1 + off], [0, 0, 1], uv, col); }
    else if (b.face === 'n') { const xc = b.x0 + clamp(c, w2 + 0.5, L - w2 - 0.5); B.quad([xc + w2, y0, b.z0 - off], [xc - w2, y0, b.z0 - off], [xc - w2, y1, b.z0 - off], [xc + w2, y1, b.z0 - off], [0, 0, -1], uv, col); }
    else if (b.face === 'e') { const zc = b.z0 + clamp(c, w2 + 0.5, L - w2 - 0.5); B.quad([b.x1 + off, y0, zc + w2], [b.x1 + off, y0, zc - w2], [b.x1 + off, y1, zc - w2], [b.x1 + off, y1, zc + w2], [1, 0, 0], uv, col); }
    else { const zc = b.z0 + clamp(c, w2 + 0.5, L - w2 - 0.5); B.quad([b.x0 - off, y0, zc - w2], [b.x0 - off, y0, zc + w2], [b.x0 - off, y1, zc + w2], [b.x0 - off, y1, zc - w2], [-1, 0, 0], uv, col); }
  }

  // ---------------------------------------------------------------------------------
  buildBounds() {
    const { x0, x1, z0 } = WORLD;
    const t = 6;
    const wall = (a) => { const b = this.grid.add({ ...a, y0: -50, y1: 800 }); b.noCam = true; return b; };
    wall({ x0: x0 - t, x1: x0, z0: z0 - t, z1: 200 });
    wall({ x0: x1, x1: x1 + t, z0: z0 - t, z1: 200 });
    wall({ x0: x0 - t, x1: x1 + t, z0: z0 - t, z1: z0 });
    // mare: muro lungo il lungomare (il mare non è percorribile)
    wall({ x0: x0 - t, x1: x1 + t, z0: -2, z1: 200 });
  }
}
