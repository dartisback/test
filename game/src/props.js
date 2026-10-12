import * as THREE from 'three';
import { makeRng, hex2lin } from './util.js';
import { WORLD, PLAZAS } from './napoli.js';

const D = new THREE.Object3D();

export function buildProps(world) {
  const C = world.city, rnd = makeRng(515);
  const root = world.root;
  const gy = (x, z) => world.groundY(x, z) - 0.02;

  // ---------------- alberi ----------------
  {
    const trees = C.trees;
    const trunkGeo = new THREE.CylinderGeometry(0.15, 0.24, 1, 7).translate(0, 0.5, 0);
    const foliageGeo = new THREE.IcosahedronGeometry(1, 1);
    const trunks = new THREE.InstancedMesh(trunkGeo, new THREE.MeshStandardMaterial({ color: 0x5b4330, roughness: 1 }), trees.length);
    const foliage = new THREE.InstancedMesh(foliageGeo, new THREE.MeshStandardMaterial({ roughness: 0.95, flatShading: true }), trees.length * 2);
    const col = new THREE.Color();
    trees.forEach((t, i) => {
      const y = gy(t.x, t.z), h = 3.2 * t.s, r = 1.9 * t.s;
      D.position.set(t.x, y, t.z); D.scale.set(t.s, h, t.s); D.rotation.set(0, 0, 0); D.updateMatrix(); trunks.setMatrixAt(i, D.matrix);
      const pine = t.wild && rnd() < 0.4;
      for (let k = 0; k < 2; k++) {
        D.position.set(t.x + (k ? 0.6 : -0.3) * t.s, y + h + (k ? 1.4 : 0.6) * t.s, t.z + (k ? -0.4 : 0.3) * t.s);
        D.scale.set(r * (k ? 0.75 : 1), r * (k ? 0.75 : 0.9) * (pine ? 1.5 : 1), r * (k ? 0.75 : 1)); D.rotation.set(rnd() * 3, rnd() * 3, 0);
        D.updateMatrix(); foliage.setMatrixAt(i * 2 + k, D.matrix);
        const dry = rnd() < 0.12 && !pine;
        col.setHSL(dry ? 0.1 + rnd() * 0.04 : 0.24 + rnd() * 0.07, dry ? 0.55 : 0.42, pine ? 0.17 + rnd() * 0.05 : 0.26 + rnd() * 0.1);
        foliage.setColorAt(i * 2 + k, col);
      }
      if (!t.wild) world.grid.add({ x0: t.x - 0.3, x1: t.x + 0.3, z0: t.z - 0.3, z1: t.z + 0.3, y0: y - 1, y1: y + 6, tree: true });
    });
    trunks.castShadow = true; foliage.castShadow = true; foliage.receiveShadow = true;
    trunks.frustumCulled = false; foliage.frustumCulled = false;
    root.add(trunks, foliage);
  }

  // ---------------- palme (lungomare, Villa Comunale) ----------------
  {
    const palms = C.palms;
    if (palms.length) {
      const trunkGeo = new THREE.CylinderGeometry(0.18, 0.28, 1, 7).translate(0, 0.5, 0);
      // chioma: 9 foglie allungate
      const fr = [];
      const leaf = new THREE.PlaneGeometry(0.7, 3.4, 1, 3);
      for (let i = 0; i < 9; i++) {
        const g = leaf.clone();
        const a = (i / 9) * Math.PI * 2;
        const pos = g.attributes.position;
        for (let v = 0; v < pos.count; v++) { const yy = pos.getY(v) + 1.7; pos.setZ(v, -yy * yy * 0.12); }
        g.translate(0, 1.7, 0);
        g.rotateX(-0.25); g.rotateY(a);
        fr.push(g);
      }
      const merged = mergeGeos(fr);
      const crown = new THREE.InstancedMesh(merged, new THREE.MeshStandardMaterial({ color: 0x3c6b2a, roughness: 0.9, side: THREE.DoubleSide }), palms.length);
      const trunks = new THREE.InstancedMesh(trunkGeo, new THREE.MeshStandardMaterial({ color: 0x8a7254, roughness: 1 }), palms.length);
      palms.forEach((p, i) => {
        const y = gy(p.x, p.z), h = rnd.range(6, 9.5) * p.s;
        D.position.set(p.x, y, p.z); D.rotation.set(0, 0, 0); D.scale.set(1, h, 1); D.updateMatrix(); trunks.setMatrixAt(i, D.matrix);
        D.position.set(p.x, y + h, p.z); D.rotation.set(0, rnd() * 6, 0); D.scale.set(p.s * 1.1, p.s * 1.1, p.s * 1.1); D.updateMatrix(); crown.setMatrixAt(i, D.matrix);
        world.grid.add({ x0: p.x - 0.3, x1: p.x + 0.3, z0: p.z - 0.3, z1: p.z + 0.3, y0: y - 1, y1: y + 8, tree: true });
      });
      trunks.castShadow = true; crown.castShadow = true; trunks.frustumCulled = false; crown.frustumCulled = false;
      root.add(trunks, crown);
    }
  }

  // ---------------- lampioni ----------------
  {
    const lamps = C.lamps;
    const poleGeo = new THREE.CylinderGeometry(0.07, 0.11, 6.4, 8).translate(0, 3.2, 0);
    const armGeo = new THREE.BoxGeometry(1.4, 0.08, 0.08).translate(0.7, 0, 0);
    const headGeo = new THREE.BoxGeometry(0.75, 0.14, 0.32);
    const dark = new THREE.MeshStandardMaterial({ color: 0x23262b, roughness: 0.6, metalness: 0.4 });
    const poles = new THREE.InstancedMesh(poleGeo, dark, lamps.length);
    const arms = new THREE.InstancedMesh(armGeo, dark, lamps.length);
    const heads = new THREE.InstancedMesh(headGeo, new THREE.MeshStandardMaterial({ color: 0xfff1cf, emissive: 0xffd9a0, emissiveIntensity: 0 }), lamps.length);
    const pools = new THREE.InstancedMesh(new THREE.PlaneGeometry(14, 14).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: world.tex.glow, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, polygonOffset: true, polygonOffsetFactor: -10, polygonOffsetUnits: -10 }), lamps.length);
    lamps.forEach((l, i) => {
      const y = gy(l.x, l.z);
      const dx = l.axis === 'z' ? -l.side : 0, dz = l.axis === 'x' ? -l.side : 0;
      const ry = Math.atan2(-dz, dx);
      D.position.set(l.x, y, l.z); D.rotation.set(0, 0, 0); D.scale.set(1, 1, 1); D.updateMatrix(); poles.setMatrixAt(i, D.matrix);
      D.position.set(l.x, y + 6.3, l.z); D.rotation.set(0, ry, 0); D.updateMatrix(); arms.setMatrixAt(i, D.matrix);
      D.position.set(l.x + dx * 1.4, y + 6.25, l.z + dz * 1.4); D.rotation.set(0, ry, 0); D.updateMatrix(); heads.setMatrixAt(i, D.matrix);
      D.position.set(l.x + dx * 1.5, y + 0.3, l.z + dz * 1.5); D.rotation.set(0, 0, 0); D.updateMatrix(); pools.setMatrixAt(i, D.matrix);
    });
    poles.frustumCulled = arms.frustumCulled = heads.frustumCulled = pools.frustumCulled = false;
    root.add(poles, arms, heads, pools);
    world.lampHeads = [heads]; world.nightObjs.push(pools); pools.visible = false;
  }

  // ---------------- bucato steso nei vicoli ----------------
  {
    const lines = [], cloths = [];
    const addLine = (axis, c, a, w, d) => {
      // axis: 'x' = strada lungo x, il filo attraversa in z
      const wires = rnd.int(1, 2);
      for (let k = 0; k < wires; k++) {
        const h = rnd.range(6.5, 13), len = w + 1.8;
        const x = axis === 'x' ? a : c + 0, z = axis === 'x' ? c : a;
        const y = world.groundY(x, z) + h;
        lines.push({ x, y, z, len, axis });
        const n = rnd.int(3, 7);
        for (let i = 0; i < n; i++) {
          const o = (i / n - 0.5) * len * 0.85 + rnd.range(-0.2, 0.2);
          cloths.push({ x: axis === 'x' ? x : x + o, y: y - 0.45, z: axis === 'x' ? z + o : z, axis, col: rnd.pick([0xf3efe6, 0xc63b3b, 0x3b6bc6, 0xe3c43b, 0x3b9a5a, 0xe8d5e0, 0x7a4fb0, 0xf09a3a]) });
        }
      }
    };
    for (const l of C.roads.H) if (l.district === 'vicoli') for (let x = l.x0 + 6; x < l.x1 - 6; x += rnd.range(10, 18)) if (rnd() < 0.7) addLine('x', l.z, x, l.w);
    for (const l of C.roads.V) if (l.district === 'vicoli') for (let z = l.z0 + 6; z < l.z1 - 6; z += rnd.range(10, 18)) if (rnd() < 0.7) addLine('z', l.x, z, l.w);
    if (lines.length) {
      const lm = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 0.03, 0.03), new THREE.MeshStandardMaterial({ color: 0x555555 }), lines.length);
      lines.forEach((l, i) => { D.position.set(l.x, l.y, l.z); D.rotation.set(0, l.axis === 'x' ? Math.PI / 2 : 0, 0); D.scale.set(l.len, 1, 1); D.updateMatrix(); lm.setMatrixAt(i, D.matrix); });
      const cm = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.55, 0.85), new THREE.MeshStandardMaterial({ roughness: 1, side: THREE.DoubleSide }), cloths.length);
      const col = new THREE.Color();
      cloths.forEach((c, i) => { D.position.set(c.x, c.y, c.z); D.rotation.set(0, c.axis === 'x' ? 0 : Math.PI / 2, 0); D.scale.set(0.8 + rnd() * 0.8, 0.7 + rnd() * 0.8, 1); D.updateMatrix(); cm.setMatrixAt(i, D.matrix); col.setHex(c.col); cm.setColorAt(i, col); });
      lm.frustumCulled = cm.frustumCulled = false;
      root.add(lm, cm);
    }
  }

  // ---------------- banchi del mercato ----------------
  {
    const m = PLAZAS.find((p) => p.id === 'mercato').rect;
    const stalls = [];
    for (let x = m.x0 + 8; x < m.x1 - 8; x += 11) for (let z = m.z0 + 8; z < m.z1 - 8; z += 14) if (rnd() < 0.85) stalls.push({ x: x + rnd.range(-1, 1), z: z + rnd.range(-1, 1), c: rnd.pick([0xd9242b, 0x2f6bd9, 0xf0b44a, 0x3aa357, 0xf4f1e8, 0xe66aa0]) });
    const canopy = new THREE.InstancedMesh(new THREE.BoxGeometry(3.2, 0.12, 2.6), new THREE.MeshStandardMaterial({ roughness: 0.8 }), stalls.length);
    const base = new THREE.InstancedMesh(new THREE.BoxGeometry(3.0, 1.0, 1.5), new THREE.MeshStandardMaterial({ color: 0x8a6a4a, roughness: 0.9 }), stalls.length);
    const goods = new THREE.InstancedMesh(new THREE.BoxGeometry(2.8, 0.3, 1.3), new THREE.MeshStandardMaterial({ roughness: 0.9 }), stalls.length);
    const col = new THREE.Color();
    stalls.forEach((s, i) => {
      const y = world.groundY(s.x, s.z);
      D.rotation.set(0, 0, 0); D.scale.set(1, 1, 1);
      D.position.set(s.x, y + 2.6, s.z); D.rotation.x = 0.12; D.updateMatrix(); canopy.setMatrixAt(i, D.matrix); col.setHex(s.c); canopy.setColorAt(i, col); D.rotation.x = 0;
      D.position.set(s.x, y + 0.5, s.z + 0.3); D.updateMatrix(); base.setMatrixAt(i, D.matrix);
      D.position.set(s.x, y + 1.15, s.z + 0.3); D.updateMatrix(); goods.setMatrixAt(i, D.matrix); col.setHex(rnd.pick([0xd0382a, 0xe3a63a, 0x4f8f3a, 0xcf7f55, 0xe8d8b0])); goods.setColorAt(i, col);
      world.grid.add({ x0: s.x - 1.6, x1: s.x + 1.6, z0: s.z - 0.5, z1: s.z + 1.1, y0: y, y1: y + 3 });
    });
    canopy.castShadow = true; base.castShadow = true;
    root.add(canopy, base, goods);
  }

  // ---------------- panchine ----------------
  {
    const benches = [];
    for (const p of PLAZAS) {
      if (p.kind !== 'plaza' && p.kind !== 'park') continue;
      const r = p.rect;
      const n = p.kind === 'plaza' ? 18 : 24;
      for (let i = 0; i < n; i++) benches.push({ x: rnd.range(r.x0 + 6, r.x1 - 6), z: rnd.range(r.z0 + 6, r.z1 - 6), rot: rnd.int(0, 3) * Math.PI / 2 });
    }
    // lungomare
    for (let x = -1100; x < 2250; x += 55) benches.push({ x, z: -16.2, rot: 0 });
    const g = new THREE.BoxGeometry(1.8, 0.5, 0.5).translate(0, 0.35, 0);
    const bm = new THREE.InstancedMesh(g, new THREE.MeshStandardMaterial({ color: 0x6b4a2f, roughness: 0.8 }), benches.length);
    benches.forEach((b, i) => { D.position.set(b.x, gy(b.x, b.z) + 0.1, b.z); D.rotation.set(0, b.rot, 0); D.scale.set(1, 1, 1); D.updateMatrix(); bm.setMatrixAt(i, D.matrix); });
    bm.frustumCulled = false; root.add(bm);
  }

  // ---------------- muretto del lungomare + scogli ----------------
  {
    const wall = new THREE.Mesh(new THREE.BoxGeometry(WORLD.x1 - WORLD.x0 + 800, 1.1, 0.9), new THREE.MeshStandardMaterial({ color: 0xb4ac9b, roughness: 0.9 }));
    wall.position.set((WORLD.x0 + WORLD.x1) / 2, 0.55, -2.3); wall.castShadow = true; root.add(wall);
    const rocks = [];
    for (let i = 0; i < 900; i++) rocks.push({ x: rnd.range(-1300, 2400), z: rnd.range(1.5, 12), s: rnd.range(0.7, 2.6) });
    const rm = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(1, 0), new THREE.MeshStandardMaterial({ color: 0x77736a, roughness: 1, flatShading: true }), rocks.length);
    rocks.forEach((r, i) => { D.position.set(r.x, gy(r.x, r.z) + r.s * 0.2, r.z); D.rotation.set(rnd() * 3, rnd() * 3, 0); D.scale.set(r.s * 1.3, r.s * 0.7, r.s); D.updateMatrix(); rm.setMatrixAt(i, D.matrix); });
    rm.frustumCulled = false; root.add(rm);
  }
}

function mergeGeos(list) {
  const pos = [], nor = [], uv = [], idx = [];
  let off = 0;
  for (const g of list) {
    const gi = g.index ? g : null;
    const p = g.attributes.position, n = g.attributes.normal, u = g.attributes.uv;
    for (let i = 0; i < p.count; i++) { pos.push(p.getX(i), p.getY(i), p.getZ(i)); nor.push(n.getX(i), n.getY(i), n.getZ(i)); uv.push(u.getX(i), u.getY(i)); }
    for (let i = 0; i < gi.index.count; i++) idx.push(off + gi.index.getX(i));
    off += p.count;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx); g.computeVertexNormals();
  return g;
}
