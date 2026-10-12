import * as THREE from 'three';
import { makeRng, hex2lin } from './util.js';
import { FLOOR_H, heightAt } from './napoli.js';
import * as T from './textures.js';

const D = new THREE.Object3D();

/** crea un edificio "speciale" tramite il sistema comune di facciate fuse */
function bld(world, rect, floors, opts = {}) {
  const b = {
    ...rect, floors, h: opts.h || floors * FLOOR_H + 0.5, color: opts.color ?? 0xe0c9a0, variant: opts.variant || 'old', roof: opts.roof || 'flat',
    roofColor: opts.roofColor ?? 0xa5502f, face: opts.face, name: opts.name, big: true, special: true, noClutter: true, muralDone: true,
  };
  world.placeBuilding(b);
  return b;
}

const signTex = (text, w = 1024, h = 160, bg = '#1d3a6b', fg = '#f6f2e6', font = 'bold 82px Arial') => T.textTexture(text.toUpperCase(), { w, h, font, fg, bg });
function signPlane(world, text, x, y, z, ry, width, bg = '#1d3a6b') {
  const tex = signTex(text, 1024, 160, bg);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(width, width * 0.156), new THREE.MeshBasicMaterial({ map: tex }));
  m.position.set(x, y, z); m.rotation.y = ry; world.root.add(m); return m;
}

function cyl(world, x, y, z, r, h, color, seg = 20, mat) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 1.02, h, seg), mat || new THREE.MeshStandardMaterial({ color, roughness: 0.9 }));
  m.position.set(x, y + h / 2, z); m.castShadow = true; m.receiveShadow = true; world.root.add(m); return m;
}

export function buildLandmarks(world) {
  const rnd = makeRng(3131);
  const root = world.root, grid = world.grid, gY = (x, z) => heightAt(x, z);
  const stoneMat = new THREE.MeshStandardMaterial({ color: 0xe6dcc6, roughness: 0.85 });
  const darkStone = new THREE.MeshStandardMaterial({ color: 0x7e7364, roughness: 0.95 });

  // =============== PALAZZO REALE (lato est del Plebiscito) ===============
  {
    const b = bld(world, { x0: -66, x1: -26, z0: -190, z1: -86 }, 5, { color: 0xc98660, name: 'Palazzo Reale', face: 'w', h: 24 });
    // porticato: pilastri e archi lungo la facciata ovest
    const n = 16, step = 104 / n;
    const colG = new THREE.CylinderGeometry(0.55, 0.62, 5.2, 10).translate(0, 2.6, 0);
    const cols = new THREE.InstancedMesh(colG, stoneMat, n + 1);
    for (let i = 0; i <= n; i++) { D.position.set(-67.6, gY(-67.6, -190 + i * step) + 0.1, -190 + i * step); D.rotation.set(0, 0, 0); D.scale.set(1, 1, 1); D.updateMatrix(); cols.setMatrixAt(i, D.matrix); grid.add({ x0: -68.2, x1: -67, z0: -190 + i * step - 0.6, z1: -190 + i * step + 0.6, y0: 0, y1: 5 }); }
    cols.castShadow = true; root.add(cols);
    const arch = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.2, 104), stoneMat); arch.position.set(-67.6, 5.6, -138); arch.castShadow = true; root.add(arch);
    const floor = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.18, 104), new THREE.MeshStandardMaterial({ color: 0xc8bfae })); floor.position.set(-67.6, 0.1, -138); root.add(floor);
  }

  // =============== BASILICA SAN FRANCESCO DI PAOLA + COLONNATO ===============
  {
    const cx = -130, cz = -132;
    // chiesa dietro l'apice
    const body = bld(world, { x0: -150, x1: -110, z0: -234, z1: -200 }, 4, { color: 0xe8dcc4, h: 20, name: '', roof: 'flat' });
    cyl(world, -130, gY(-130, -218) + 17, -217, 14, 8, 0xe8dcc4, 28);                    // tamburo
    const dome = new THREE.Mesh(new THREE.SphereGeometry(14.5, 28, 14, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x7f9a8f, roughness: 0.6, metalness: 0.2 }));
    dome.position.set(-130, gY(-130, -217) + 25, -217); dome.castShadow = true; root.add(dome);
    cyl(world, -130, gY(-130, -217) + 25 + 14, -217, 1.6, 4, 0xe8dcc4, 10);
    // pronao
    for (let i = 0; i < 6; i++) { const x = -143 + i * 5.2; cyl(world, x, gY(x, -196), -197, 0.9, 12, 0xeee5d0, 12); grid.add({ x0: x - 1, x1: x + 1, z0: -198, z1: -196, y0: 0, y1: 12 }); }
    const ped = new THREE.Mesh(new THREE.BoxGeometry(34, 2.4, 6), stoneMat); ped.position.set(-130, gY(-130, -197) + 13.2, -197.5); ped.castShadow = true; root.add(ped);
    // colonnato semicircolare (due file)
    const colG = new THREE.CylinderGeometry(0.5, 0.58, 11, 10).translate(0, 5.5, 0);
    const pts = [];
    for (const R of [58, 51]) {
      for (const [a0, a1] of [[Math.PI + 0.32, Math.PI * 1.5 - 0.16], [Math.PI * 1.5 + 0.16, Math.PI * 2 - 0.32]]) {
        const len = (a1 - a0) * R, n = Math.max(3, Math.round(len / 3.6));
        for (let i = 0; i <= n; i++) { const a = a0 + ((a1 - a0) * i) / n; pts.push({ x: cx + Math.cos(a) * R, z: cz + Math.sin(a) * R, a, R }); }
      }
    }
    const cols = new THREE.InstancedMesh(colG, stoneMat, pts.length);
    pts.forEach((p, i) => { D.position.set(p.x, gY(p.x, p.z), p.z); D.rotation.set(0, 0, 0); D.scale.set(1, 1, 1); D.updateMatrix(); cols.setMatrixAt(i, D.matrix); grid.add({ x0: p.x - 0.7, x1: p.x + 0.7, z0: p.z - 0.7, z1: p.z + 0.7, y0: 0, y1: 11 }); });
    cols.castShadow = true; root.add(cols);
    // trabeazione: segmenti tra colonne consecutive della stessa fila
    const beam = new THREE.BoxGeometry(1, 1.5, 2.2);
    const segs = [];
    for (let i = 0; i < pts.length - 1; i++) { const p = pts[i], q = pts[i + 1]; if (p.R !== q.R || Math.abs(p.a - q.a) > 0.2) continue; segs.push([p, q]); }
    const bm = new THREE.InstancedMesh(beam, stoneMat, segs.length);
    segs.forEach(([p, q], i) => { const dx = q.x - p.x, dz = q.z - p.z; D.position.set((p.x + q.x) / 2, gY(p.x, p.z) + 11.7, (p.z + q.z) / 2); D.rotation.set(0, -Math.atan2(dz, dx), 0); D.scale.set(Math.hypot(dx, dz) + 0.3, 1, 1); D.updateMatrix(); bm.setMatrixAt(i, D.matrix); });
    bm.castShadow = true; root.add(bm);
  }

  // =============== MASCHIO ANGIOINO (Castel Nuovo) ===============
  {
    const r = { x0: 217, x1: 273, z0: -101, z1: -55 };
    bld(world, r, 4, { color: 0x8a7e6d, h: 20, name: 'Maschio Angioino', face: 's', variant: 'old', roof: 'flat' });
    const tm = new THREE.MeshStandardMaterial({ color: 0x75695a, roughness: 0.95 });
    for (const [x, z, h] of [[217, -101, 30], [273, -101, 30], [217, -55, 30], [273, -55, 30], [245, -55, 28]]) {
      cyl(world, x, gY(x, z) - 1, z, 9.5, h + 1, 0x75695a, 18, tm);
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(10.4, 9.6, 2.2, 18), darkStone); cap.position.set(x, gY(x, z) + h, z); cap.castShadow = true; root.add(cap);
      grid.add({ x0: x - 9.5, x1: x + 9.5, z0: z - 9.5, z1: z + 9.5, y0: -5, y1: h });
    }
    const gate = new THREE.Mesh(new THREE.BoxGeometry(9, 8, 3), new THREE.MeshStandardMaterial({ color: 0x241f1b })); gate.position.set(245, gY(245, -54) + 4, -53.5); root.add(gate);
  }

  // =============== CASTEL DELL'OVO ===============
  {
    const cx = -150, cz = 42;
    const rock = new THREE.Mesh(new THREE.CylinderGeometry(40, 46, 9, 14), new THREE.MeshStandardMaterial({ color: 0x7a7468, roughness: 1, flatShading: true }));
    rock.position.set(cx, 1.5 - 4.5 + 3, cz); root.add(rock);
    const mat = new THREE.MeshStandardMaterial({ color: 0xcdb48a, roughness: 0.9 });
    const castle = new THREE.Mesh(new THREE.BoxGeometry(52, 14, 20), mat); castle.position.set(cx, 3 + 7, cz); castle.castShadow = true; root.add(castle);
    for (const [dx, dz] of [[-24, -8], [24, -8], [-24, 8], [24, 8]]) { const t = new THREE.Mesh(new THREE.CylinderGeometry(4.6, 5, 20, 12), mat); t.position.set(cx + dx, 3 + 10, cz + dz); t.castShadow = true; root.add(t); }
    const cz2 = new THREE.Mesh(new THREE.BoxGeometry(8, 3, 46), new THREE.MeshStandardMaterial({ color: 0xb9ae98, roughness: 1 })); cz2.position.set(cx, 0.3, cz - 28); root.add(cz2); // sopraelevata verso la costa
  }

  // =============== CAMPANILE DEL CARMINE + CHIESA ===============
  {
    const base = bld(world, { x0: 676, x1: 706, z0: -250, z1: -208 }, 5, { color: 0xd8b98a, h: 24, name: 'Chiesa del Carmine', face: 's', variant: 'old', roof: 'hip' });
    const tx = 722, tz = -228, gy = gY(tx, tz);
    const tower = bld(world, { x0: tx - 6, x1: tx + 6, z0: tz - 6, z1: tz + 6 }, 15, { color: 0xcfa86e, h: 54, roof: 'flat' });
    const oct = new THREE.Mesh(new THREE.CylinderGeometry(4.4, 5.8, 12, 8), new THREE.MeshStandardMaterial({ color: 0xcfa86e, roughness: 0.9 })); oct.position.set(tx, gy + 54 + 6.5, tz); oct.castShadow = true; root.add(oct);
    const spire = new THREE.Mesh(new THREE.ConeGeometry(4.6, 14, 8), new THREE.MeshStandardMaterial({ color: 0x4a7a5e, roughness: 0.6, metalness: 0.2 })); spire.position.set(tx, gy + 54 + 12.5 + 7, tz); spire.castShadow = true; root.add(spire);
    const cross = new THREE.Mesh(new THREE.BoxGeometry(0.3, 3, 0.3), new THREE.MeshStandardMaterial({ color: 0xd9b24a })); cross.position.set(tx, gy + 54 + 12.5 + 15.5, tz); root.add(cross);
  }

  // =============== VELE DI SCAMPIA ===============
  {
    const xs = [-420, -300, -180];
    const concrete = [0xc9c2b2, 0xbcb4a2, 0xc4baa6];
    xs.forEach((x, idx) => {
      const z0 = -1235, z1 = -1095, L = z1 - z0, hb = 17, ht = 5, H = 44;
      const gy = gY(x, (z0 + z1) / 2) + 0.05;
      const cx = x, cz = (z0 + z1) / 2;
      const F = world.chunks.get(cx, cz, 'f_tower'), S = world.chunks.get(cx, cz, 'solid');
      const col = hex2lin(concrete[idx]);
      const bays = Math.round(L / 4), fl = H / FLOOR_H;
      // facciate inclinate (ovest/est)
      for (const sx of [-1, 1]) {
        const nrm = new THREE.Vector3(sx * H, hb - ht, 0).normalize();
        const a0 = [x + sx * hb, gy - 1, z0], a1 = [x + sx * hb, gy - 1, z1], b1 = [x + sx * ht, gy + H, z1], b0 = [x + sx * ht, gy + H, z0];
        if (sx > 0) F.quad(a1, a0, b0, b1, [nrm.x, nrm.y, nrm.z], [[0, 0], [bays, 0], [bays, fl], [0, fl]], col);
        else F.quad(a0, a1, b1, b0, [nrm.x, nrm.y, nrm.z], [[0, 0], [bays, 0], [bays, fl], [0, fl]], col);
      }
      // testate
      for (const [z, nz] of [[z0, -1], [z1, 1]]) {
        const a = [x - hb, gy - 1, z], b = [x + hb, gy - 1, z], c = [x + ht, gy + H, z], d = [x - ht, gy + H, z];
        if (nz < 0) S.quad(b, a, d, c, [0, 0, -1], [[0, 0], [1, 0], [1, 1], [0, 1]], col);
        else S.quad(a, b, c, d, [0, 0, 1], [[0, 0], [1, 0], [1, 1], [0, 1]], col);
      }
      S.box(x - ht, x + ht, gy + H, gy + H + 0.5, z0, z1, 0x8d877b);
      // torri ascensori centrali
      for (const zz of [z0 + 8, z1 - 8]) S.box(x - 3, x + 3, gy, gy + H + 6, zz - 3, zz + 3, 0x9f9990);
      // collisioni: scaglioni
      grid.add({ x0: x - 17, x1: x + 17, z0, z1, y0: gy - 2, y1: gy + 12 });
      grid.add({ x0: x - 12, x1: x + 12, z0, z1, y0: gy + 12, y1: gy + 26 });
      grid.add({ x0: x - 7, x1: x + 7, z0, z1, y0: gy + 26, y1: gy + H });
    });
    signPlane(world, 'Le Vele di Scampia', -300, gY(-300, -1240) + 8, -1240, 0, 24, '#4a4a4a').rotation.y = Math.PI;
  }

  // =============== CASTEL SANT'ELMO ===============
  {
    const cx = -540, cz = -795, h = gY(cx, cz);
    const wallMat = new THREE.MeshStandardMaterial({ color: 0xa89a82, roughness: 0.95 });
    const W = 46, t = 6;
    const parts = [[cx - W, cx + W, cz - W, cz - W + t], [cx - W, cx + W, cz + W - t, cz + W], [cx - W, cx - W + t, cz - W + t, cz + W - t], [cx + W - t, cx + W, cz - W + t, cz + W - t]];
    // ingresso a sud: apriamo il muro sud
    parts[1] = [cx - W, cx - 6, cz + W - t, cz + W]; parts.push([cx + 6, cx + W, cz + W - t, cz + W]);
    for (const [x0, x1, z0, z1] of parts) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, 16, z1 - z0), wallMat); m.position.set((x0 + x1) / 2, h + 8 - 3, (z0 + z1) / 2); m.castShadow = true; m.receiveShadow = true; root.add(m);
      grid.add({ x0, x1, z0, z1, y0: h - 5, y1: h + 14 });
    }
    for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      const b = new THREE.Mesh(new THREE.CylinderGeometry(14, 16, 17, 4), wallMat); b.rotation.y = Math.PI / 4; b.position.set(cx + dx * (W + 4), h + 5.5, cz + dz * (W + 4)); b.castShadow = true; root.add(b);
      grid.add({ x0: cx + dx * (W + 4) - 12, x1: cx + dx * (W + 4) + 12, z0: cz + dz * (W + 4) - 12, z1: cz + dz * (W + 4) + 12, y0: h - 5, y1: h + 14 });
    }
    const flag = new THREE.Mesh(new THREE.BoxGeometry(0.3, 14, 0.3), new THREE.MeshStandardMaterial({ color: 0x333333 })); flag.position.set(cx, h + 18, cz); root.add(flag);
  }

  // =============== OSPEDALI ===============
  const hospital = (x0, x1, z0, z1, name, floors) => {
    const b = bld(world, { x0, x1, z0, z1 }, floors, { color: 0xeeeae0, variant: 'modern', h: floors * FLOOR_H, name, face: 's', roof: 'flat' });
    const gy = gY((x0 + x1) / 2, z1);
    const cross = new THREE.Mesh(new THREE.PlaneGeometry(9, 9), new THREE.MeshBasicMaterial({ map: T.crossTexture() }));
    cross.position.set((x0 + x1) / 2, gy + floors * FLOOR_H - 5, z1 + 0.08); root.add(cross);
    const pad = new THREE.Mesh(new THREE.CylinderGeometry(7, 7, 0.3, 24), new THREE.MeshStandardMaterial({ color: 0x7a8088 })); pad.position.set(x0 + 12, gy + floors * FLOOR_H + 1.2, z0 + 14); root.add(pad);
    const H = new THREE.Mesh(new THREE.PlaneGeometry(9, 9).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: T.textTexture('H', { w: 128, h: 128, font: 'bold 110px Arial', fg: '#ffffff', bg: '#7a8088' }) })); H.position.set(x0 + 12, gy + floors * FLOOR_H + 1.4, z0 + 14); root.add(H);
    // area pronto soccorso
    const er = new THREE.Mesh(new THREE.PlaneGeometry(26, 10).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: T.textTexture('PRONTO SOCCORSO', { w: 512, h: 200, font: 'bold 62px Arial', fg: '#ffffff', bg: '#c4202a' }) }));
    er.position.set((x0 + x1) / 2, gY((x0 + x1) / 2, z1 + 12) + 0.25, z1 + 12); root.add(er);
    return b;
  };
  hospital(-520, -440, -604, -552, 'Ospedale Cardarelli', 7);
  hospital(1130, 1200, -262, -216, 'Ospedale del Mare', 6);
  world.hospitals = [{ name: 'Ospedale Cardarelli', x: -480, z: -540 }, { name: 'Ospedale del Mare', x: 1165, z: -204 }];

  // =============== JORIT (murale gigante a San Giovanni a Teduccio) ===============
  {
    const b = bld(world, { x0: 1240, x1: 1264, z0: -228, z1: -200 }, 19, { color: 0xc4bcaa, variant: 'tower', h: 62, face: 's', roof: 'flat' });
    world.addMural(b, 1, 0, { h: 50, w: 24, pos: 0.5 });
    const b2 = { ...b, face: 'e' }; world.addMural(b2, 3, 0, { h: 40, w: 28, pos: 0.5 });
  }

  // =============== PORTO ===============
  {
    const x0 = 160, x1 = 880, z0 = -2, z1 = 72, y = 0.25;
    const plat = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, 1.4, z1 - z0), new THREE.MeshStandardMaterial({ color: 0x9a9a92, roughness: 0.95 }));
    plat.position.set((x0 + x1) / 2, y - 0.7, (z0 + z1) / 2); plat.receiveShadow = true; root.add(plat);
    // container
    const cols = [0xc4361f, 0x2e5fa8, 0x3a8f55, 0xd9a030, 0xb6b6b0, 0x7a4a2a];
    const items = [];
    for (let x = x0 + 12; x < x1 - 20; x += 15) for (let z = z0 + 8; z < z1 - 14; z += 8) {
      if (rnd() < 0.35) continue;
      const stack = rnd.int(1, 4); for (let k = 0; k < stack; k++) items.push({ x: x + rnd.range(-0.6, 0.6), z, y: y + 1.3 + k * 2.6, c: rnd.pick(cols) });
    }
    const cm = new THREE.InstancedMesh(new THREE.BoxGeometry(12, 2.6, 2.5), new THREE.MeshStandardMaterial({ roughness: 0.8, metalness: 0.2 }), items.length);
    const col = new THREE.Color();
    items.forEach((it, i) => { D.position.set(it.x, it.y, it.z); D.rotation.set(0, 0, 0); D.scale.set(1, 1, 1); D.updateMatrix(); cm.setMatrixAt(i, D.matrix); col.setHex(it.c); cm.setColorAt(i, col); });
    cm.castShadow = true; root.add(cm);
    // gru a portale
    const craneMat = new THREE.MeshStandardMaterial({ color: 0xd9a030, roughness: 0.6, metalness: 0.4 });
    for (const x of [260, 420, 580, 740]) {
      for (const dz of [-12, 12]) for (const dx of [-8, 8]) { const l = new THREE.Mesh(new THREE.BoxGeometry(1, 38, 1), craneMat); l.position.set(x + dx, y + 19, z1 - 16 + dz * 0.0 + (dz > 0 ? 6 : -6)); root.add(l); }
      const beam = new THREE.Mesh(new THREE.BoxGeometry(24, 3, 62), craneMat); beam.position.set(x, y + 38, z1 - 8); beam.castShadow = true; root.add(beam);
    }
    // navi
    const hullMat = new THREE.MeshStandardMaterial({ color: 0x2a3a52, roughness: 0.6, metalness: 0.3 });
    for (const [x, z, len, c] of [[330, 96, 150, 0xf2f2f2], [620, 96, 120, 0xdddddd]]) {
      const hull = new THREE.Mesh(new THREE.BoxGeometry(len, 12, 26), hullMat); hull.position.set(x, 1, z); hull.castShadow = true; root.add(hull);
      const sup = new THREE.Mesh(new THREE.BoxGeometry(len * 0.7, 16, 20), new THREE.MeshStandardMaterial({ color: c, roughness: 0.5 })); sup.position.set(x - len * 0.05, 15, z); sup.castShadow = true; root.add(sup);
      const fun = new THREE.Mesh(new THREE.CylinderGeometry(3, 3, 10, 12), new THREE.MeshStandardMaterial({ color: 0xc4361f })); fun.position.set(x + len * 0.2, 28, z); root.add(fun);
      const wins = new THREE.Mesh(new THREE.BoxGeometry(len * 0.7 + 0.2, 3, 20.2), new THREE.MeshStandardMaterial({ color: 0x1a2430, roughness: 0.2, metalness: 0.5 })); wins.position.set(x - len * 0.05, 17, z); root.add(wins);
    }
    world.addCollider({ x0: x0, x1: x1, z0: 72, z1: 76, y0: -3, y1: 5 });
  }

  // =============== VESUVIO: pennacchio di fumo ===============
  {
    const sm = new THREE.MeshBasicMaterial({ color: 0xcfd2d6, transparent: true, opacity: 0.35, fog: true, depthWrite: false });
    const g = new THREE.Group();
    for (let i = 0; i < 9; i++) { const s = new THREE.Mesh(new THREE.SphereGeometry(30 + i * 9, 10, 8), sm); s.position.set(i * 14, i * 38, -i * 6); g.add(s); }
    g.position.set(1750, gY(1750, -720) + 20, -720);
    root.add(g);
    // cratere scuro
    const crater = new THREE.Mesh(new THREE.CylinderGeometry(70, 90, 8, 24), new THREE.MeshStandardMaterial({ color: 0x2a2523, roughness: 1 }));
    crater.position.set(1750, gY(1750, -720) - 6, -720); root.add(crater);
  }
}
