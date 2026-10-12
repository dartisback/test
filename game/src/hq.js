import * as THREE from 'three';
import { layer } from './util.js';
import { heightAt } from './napoli.js';
import * as T from './textures.js';

/**
 * Sede di un corpo (Questura / Caserma / Comitato CRI / Comando VVF).
 * Coordinate locali: porta d'ingresso in (0,0) sulla parete SUD, l'edificio si estende a NORD (z negativo),
 * il piazzale è a EST. Atrio, spogliatoio, armeria/magazzino, sala operativa con bacheca chiavi.
 */
export const HQ = {
  x0: -18, x1: 18, z0: -30, z1: 0, doorW: 4.2, height: 9.4, ceil: 3.8, wall: 0.35,
  yard: { x0: 18, x1: 63, z0: -57, z1: 7 }, gate: { x0: 34, x1: 49 },
  desk: { x: 0, z: -6.6 }, lockers: { x: -15.6, z: -7.5 }, equip: { x: 11.8, z: -7.5 }, keys: { x: 0, z: -27.6 }, backDoor: { x: 17.5, z: -20.5 },
};

export function bayPositions(count, spacing) {
  return Array.from({ length: count }, (_, i) => ({ x: 25 + i * spacing, z: -46, heading: 0 }));
}

export function buildHQ(world, cfg) {
  const ox = cfg.door.x, oz = cfg.door.z;
  const gy = heightAt(ox, oz) + 0.1; // piatto (pad del terreno)
  const g = new THREE.Group(); g.name = 'hq_' + cfg.id; g.position.set(ox, gy, oz);
  const H = HQ.height, t = HQ.wall, grid = world.grid;
  const floorTex = T.floorTilesTexture();

  const fm = new THREE.MeshStandardMaterial({
    map: world.tex.facades.old.map, color: cfg.facade, roughness: 0.92,
    emissive: 0xffd9a0, emissiveMap: world.tex.facades.old.emissive, emissiveIntensity: 0,
  });
  world.facadeMats['hq_' + cfg.id] = fm;
  const paint = new THREE.MeshStandardMaterial({ color: 0xece7da, roughness: 0.95 });
  const paintDark = new THREE.MeshStandardMaterial({ color: 0x4a5b73, roughness: 0.9 });
  const wood = new THREE.MeshStandardMaterial({ color: 0x7a5233, roughness: 0.7 });
  const darkMetal = new THREE.MeshStandardMaterial({ color: 0x2a2e33, roughness: 0.5, metalness: 0.6 });
  const stone = new THREE.MeshStandardMaterial({ color: 0xd8d0bd, roughness: 0.85 });
  const accent = new THREE.MeshStandardMaterial({ color: new THREE.Color(cfg.color), roughness: 0.7 });

  const addC = (x0, x1, z0, z1, y0, y1) => grid.add({ x0: ox + x0, x1: ox + x1, z0: oz + z0, z1: oz + z1, y0: gy + y0, y1: gy + y1 });
  const mesh = (geo, mat, x, y, z) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; g.add(m); return m; };
  const bayU = (len) => Math.max(1, Math.round(len / 4));

  // facciata esterna (la faccia rivolta verso l'esterno prende la texture di facciata)
  const solid = (x0, x1, z0, z1, y0, y1, outward, collide = true) => {
    const w = x1 - x0, d = z1 - z0, h = y1 - y0;
    const geo = new THREE.BoxGeometry(w, h, d);
    const uv = geo.attributes.uv;
    const scale = (face, u, v) => { for (let i = face * 4; i < face * 4 + 4; i++) uv.setXY(i, uv.getX(i) * u, uv.getY(i) * v); };
    const fl = Math.max(1, Math.round(h / 3.2));
    scale(0, bayU(d), fl); scale(1, bayU(d), fl); scale(4, bayU(w), fl); scale(5, bayU(w), fl);
    const mats = Array(6).fill(paint);
    if (outward !== undefined) mats[outward] = fm;
    const m = new THREE.Mesh(geo, mats); m.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2); m.castShadow = true; m.receiveShadow = true; g.add(m);
    if (collide) addC(x0, x1, z0, z1, y0, y1);
    return m;
  };
  const plain = (x0, x1, z0, z1, y0, y1, mat, collide = true) => {
    const m = mesh(new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0), mat, (x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
    if (collide) addC(x0, x1, z0, z1, y0, y1);
    return m;
  };
  const sign = (text, x, y, z, ry, w = 2.6, h = 0.55, bg = '#1d3a6b') => {
    const tex = T.textTexture(text, { w: 512, h: Math.round((512 * h) / w), font: 'bold 62px Arial', fg: '#ffffff', bg });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex }));
    m.position.set(x, y, z); m.rotation.y = ry; g.add(m); return m;
  };

  // ---- muri perimetrali ----
  const dl = -HQ.doorW / 2, dr = HQ.doorW / 2, DOOR_H = 3.2;
  solid(HQ.x0, dl, HQ.z1 - t, HQ.z1, 0, H, 4);
  solid(dr, HQ.x1, HQ.z1 - t, HQ.z1, 0, H, 4);
  solid(dl, dr, HQ.z1 - t, HQ.z1, DOOR_H, H, 4);
  solid(HQ.x0, HQ.x1, HQ.z0, HQ.z0 + t, 0, H, 5);
  solid(HQ.x0, HQ.x0 + t, HQ.z0, HQ.z1, 0, H, 1);
  const bz0 = -22, bz1 = -19; // porta sul retro
  solid(HQ.x1 - t, HQ.x1, HQ.z0, bz0, 0, H, 0);
  solid(HQ.x1 - t, HQ.x1, bz1, HQ.z1, 0, H, 0);
  solid(HQ.x1 - t, HQ.x1, bz0, bz1, 2.8, H, 0);

  // ---- pavimento e soffitto ----
  floorTex.repeat.set((HQ.x1 - HQ.x0) / 3, (HQ.z1 - HQ.z0) / 3);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(HQ.x1 - HQ.x0, HQ.z1 - HQ.z0).rotateX(-Math.PI / 2), layer(new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.4 }), 9));
  floor.position.set(0, 0.04, (HQ.z0 + HQ.z1) / 2); floor.receiveShadow = true; g.add(floor);
  const ceil = new THREE.Mesh(new THREE.BoxGeometry(HQ.x1 - HQ.x0, 0.3, HQ.z1 - HQ.z0), paint);
  ceil.position.set(0, HQ.ceil + 0.15, (HQ.z0 + HQ.z1) / 2); g.add(ceil);
  addC(HQ.x0, HQ.x1, HQ.z0, HQ.z1, HQ.ceil, HQ.ceil + 0.3);

  // ---- pareti interne ----
  const pt = 0.16, DH = 2.7, ZB = -15, p1 = -8, p2 = 8;
  const dz0 = -9.6, dz1 = -7.4;
  for (const px of [p1, p2]) {
    plain(px - pt, px + pt, ZB, dz0, 0, HQ.ceil, paint);
    plain(px - pt, px + pt, dz1, HQ.z1 - t, 0, HQ.ceil, paint);
    plain(px - pt, px + pt, dz0, dz1, DH, HQ.ceil, paint);
  }
  const gx0 = -1.5, gx1 = 1.5;
  plain(HQ.x0 + t, gx0, ZB - pt, ZB + pt, 0, HQ.ceil, paint);
  plain(gx1, HQ.x1 - t, ZB - pt, ZB + pt, 0, HQ.ceil, paint);
  plain(gx0, gx1, ZB - pt, ZB + pt, DH, HQ.ceil, paint);

  // ---- cartelli ----
  sign('SPOGLIATOIO', p1 + pt + 0.02, 3.2, -8.5, Math.PI / 2);
  sign(cfg.equip, p2 - pt - 0.02, 3.2, -8.5, -Math.PI / 2, 2.8, 0.55, '#8a1b24');
  sign('SALA OPERATIVA', 0, 3.3, ZB + pt + 0.02, 0, 3.2);
  sign('USCITA', HQ.x1 - t - 0.02, 3.3, -20.5, -Math.PI / 2, 1.6, 0.45, '#1f7a3a');

  // ---- atrio: accoglienza ----
  const deskTop = new THREE.MeshStandardMaterial({ color: 0x8a6a4a, roughness: 0.5 });
  plain(-4, 4, -8.2, -6.8, 0, 1.1, paintDark);
  plain(-4.2, 4.2, -8.4, -6.6, 1.1, 1.18, deskTop, false);
  plain(-1.2, 0.4, -8.6, -8.1, 1.18, 1.62, darkMetal, false);
  const dsign = new THREE.Mesh(new THREE.PlaneGeometry(4, 0.5), new THREE.MeshBasicMaterial({ map: T.textTexture('ACCOGLIENZA / ENTRA IN SERVIZIO', { w: 1024, h: 128, font: 'bold 60px Arial', fg: '#fff', bg: cfg.color }) }));
  dsign.position.set(0, 0.62, -6.78); g.add(dsign);
  for (const x of [-6.6, 6.6]) plain(x - 0.7, x + 0.7, -2.45, -1.95, 0, 0.5, wood);
  const crest = new THREE.Mesh(new THREE.CircleGeometry(0.55, 24), new THREE.MeshBasicMaterial({ color: new THREE.Color(cfg.color) }));
  crest.position.set(0, 2.5, HQ.z1 - t - 0.02); crest.rotation.y = Math.PI; g.add(crest);

  // ---- spogliatoio ----
  const lockMat = new THREE.MeshStandardMaterial({ map: T.lockerTexture(), roughness: 0.5, metalness: 0.4 });
  const lk = plain(HQ.x0 + t, HQ.x0 + t + 0.65, -14.6, -1.4, 0, 2.2, lockMat);
  { const geo = new THREE.BoxGeometry(0.65, 2.2, 13.2); const uv = geo.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 6, uv.getY(i)); lk.geometry.dispose(); lk.geometry = geo; }
  plain(-14.5, -11.8, -8.4, -7.4, 0, 0.45, wood);
  plain(-14.5, -11.8, -5.2, -4.4, 0, 0.45, wood);
  sign('UNIFORMI', HQ.x0 + t + 0.67, 2.65, -8, Math.PI / 2, 1.8, 0.4, '#8a1b24');

  // ---- armeria / magazzino ----
  plain(14.4, 15.2, -13.6, -2.2, 0, 1.1, darkMetal);
  plain(14.2, 15.4, -13.6, -2.2, 1.1, 1.18, deskTop, false);
  const bars = new THREE.MeshStandardMaterial({ color: 0x80858c, metalness: 0.8, roughness: 0.35 });
  for (let z = -13.4; z <= -2.4; z += 0.5) plain(14.75, 14.85, z, z + 0.05, 1.18, 2.7, bars, false);
  plain(14.6, 15.0, -13.6, -2.2, 2.7, 2.78, darkMetal, false);
  const rack = new THREE.MeshStandardMaterial({ color: 0x1e2226, roughness: 0.6, metalness: 0.5 });
  plain(HQ.x1 - t - 0.35, HQ.x1 - t, -14.4, -1.2, 0, 2.4, new THREE.MeshStandardMaterial({ color: 0x4b5159, roughness: 0.7 }), false);
  for (let z = -13.6; z <= -2; z += 0.9) { plain(HQ.x1 - t - 0.55, HQ.x1 - t - 0.35, z, z + 0.5, 1.2, 1.35, rack, false); plain(HQ.x1 - t - 0.55, HQ.x1 - t - 0.35, z + 0.1, z + 0.4, 1.7, 1.82, rack, false); }
  sign(cfg.equip, 12.8, 2.6, ZB + pt + 0.02, 0, 3.4, 0.45, '#8a1b24');

  // ---- sala operativa: bacheca chiavi ----
  plain(-1.6, 1.6, HQ.z0 + t, HQ.z0 + t + 0.14, 1.1, 2.9, darkMetal, false);
  addC(-1.6, 1.6, HQ.z0 + t, HQ.z0 + t + 0.3, 0, 3);
  sign('BACHECA CHIAVI VEICOLI', 0, 3.15, HQ.z0 + t + 0.17, Math.PI, 3.2, 0.42, cfg.color);
  const keyMats = [0x2f68d9, 0xe8e8e8, 0xd9a82f, 0x3aa357];
  for (let r = 0; r < 3; r++) for (let c = 0; c < 6; c++) {
    const k = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.22, 0.04), new THREE.MeshStandardMaterial({ color: keyMats[(r + c) % 4], metalness: 0.3 }));
    k.position.set(-1.2 + c * 0.5, 2.5 - r * 0.45, HQ.z0 + t + 0.2); g.add(k);
  }
  for (const [x, z] of [[-14, -23], [-10, -23], [-14, -27], [-10, -27], [12, -23], [12, -27]]) {
    plain(x - 1.2, x + 1.2, z - 0.55, z + 0.55, 0, 0.78, wood);
    plain(x - 0.35, x + 0.35, z - 0.1, z + 0.1, 0.78, 1.22, darkMetal, false);
  }
  const mp = new THREE.Mesh(new THREE.PlaneGeometry(5, 2.4), new THREE.MeshBasicMaterial({ map: T.textTexture('CENTRALE OPERATIVA\nNAPOLI 112 · 113', { w: 640, h: 300, font: 'bold 54px Arial', fg: '#fff', bg: '#1f4e3a', border: '#fff' }) }));
  mp.position.set(HQ.x0 + t + 0.02, 2.2, -22); mp.rotation.y = Math.PI / 2; g.add(mp);

  // ---- luci interne ----
  const lights = [];
  for (const [x, z, i] of [[0, -7, 26], [-13, -8, 18], [13, -8, 18], [-6, -22, 26], [6, -22, 22]]) {
    const l = new THREE.PointLight(0xfff0d8, i, 18, 1.6); l.position.set(x, 3.4, z); g.add(l); lights.push(l);
    const fx = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.05, 0.3), new THREE.MeshBasicMaterial({ color: 0xffffff })); fx.position.set(x, HQ.ceil - 0.03, z); g.add(fx);
  }

  // ======== FACCIATA ========
  const zf = HQ.z1;
  const colMat = new THREE.MeshStandardMaterial({ color: 0xe8e0cf, roughness: 0.8 });
  for (const cx of [-5.6, -2.7, 2.7, 5.6]) {
    mesh(new THREE.CylinderGeometry(0.34, 0.38, 3.75, 16), colMat, cx, 0.1 + 1.88, zf + 2.2);
    mesh(new THREE.BoxGeometry(0.9, 0.22, 0.9), stone, cx, 0.2, zf + 2.2);
    mesh(new THREE.BoxGeometry(0.9, 0.22, 0.9), stone, cx, 3.72, zf + 2.2);
    addC(cx - 0.36, cx + 0.36, zf + 2.2 - 0.36, zf + 2.2 + 0.36, 0, 3.8);
  }
  plain(-7, 7, zf - 0.1, zf + 2.75, 3.82, 4.2, stone, false);
  addC(-7, 7, zf - 0.1, zf + 2.75, 3.82, 4.2);
  mesh(new THREE.BoxGeometry(14, 0.12, 0.2), stone, 0, 5.2, zf + 2.6);
  mesh(new THREE.BoxGeometry(0.2, 0.12, 2.8), stone, -6.9, 5.2, zf + 1.3); mesh(new THREE.BoxGeometry(0.2, 0.12, 2.8), stone, 6.9, 5.2, zf + 1.3);
  const post = new THREE.CylinderGeometry(0.06, 0.08, 0.95, 8);
  const posts = new THREE.InstancedMesh(post, stone, 96); const dm = new THREE.Object3D(); let pi = 0;
  for (let x = -6.8; x <= 6.8; x += 0.34) { dm.position.set(x, 4.7, zf + 2.6); dm.updateMatrix(); posts.setMatrixAt(pi++, dm.matrix); }
  posts.count = pi; g.add(posts);
  for (let i = 0; i < 3; i++) plain(-3.2, 3.2, zf + 2.1 + i * 0.35, zf + 2.45 + i * 0.35, 0.06, 0.1 + 0.05 * (3 - i), stone, false);
  const emb = new THREE.Mesh(new THREE.CircleGeometry(0.62, 28), new THREE.MeshBasicMaterial({ map: T.textTexture('★', { w: 128, h: 128, font: 'bold 90px Arial', fg: '#d9b24a', bg: cfg.color, border: '#cfd6e2' }) }));
  emb.position.set(0, 5.9, zf + 0.03); g.add(emb);
  for (const [x, k] of [[-5.2, 'it'], [-3.2, 'eu']]) {
    mesh(new THREE.CylinderGeometry(0.035, 0.035, 3.4, 8), darkMetal, x, 6.4, zf + 0.7);
    const flag = new THREE.Mesh(new THREE.PlaneGeometry(1.35, 0.9), new THREE.MeshStandardMaterial({ map: T.flagTexture(k), side: THREE.DoubleSide, roughness: 0.9 }));
    flag.position.set(x + 0.7, 7.5, zf + 0.7); g.add(flag);
  }
  { // banner verticale con la sigla del corpo
    const c = T.makeCanvas(160, 640), cx = c.getContext('2d');
    cx.fillStyle = '#f0f3f8'; cx.fillRect(0, 0, 160, 640);
    cx.strokeStyle = cfg.color; cx.lineWidth = 10; cx.strokeRect(5, 5, 150, 630);
    cx.save(); cx.translate(80, 320); cx.rotate(Math.PI / 2); cx.fillStyle = cfg.color; cx.font = 'bold 74px Arial'; cx.textAlign = 'center'; cx.textBaseline = 'middle'; cx.fillText(cfg.sign, 0, 0, 590); cx.restore();
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
    const vs = new THREE.Mesh(new THREE.BoxGeometry(0.9, 3.6, 0.2), [paint, paint, paint, paint, new THREE.MeshBasicMaterial({ map: tex }), paint]);
    vs.position.set(HQ.x1 - 1.0, 5.6, zf + 0.9); g.add(vs);
  }
  const plaque = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 0.6), new THREE.MeshStandardMaterial({ map: T.textTexture(cfg.hq.toUpperCase().replace(' DI ', '\nDI ').replace('COMANDO ', 'COMANDO\n'), { w: 384, h: 144, font: 'bold 40px Arial', fg: '#111', bg: '#c8c4b8', border: '#555' }) }));
  plaque.position.set(4.6, 1.75, zf + 0.03); g.add(plaque);
  for (const x of [dl - 0.1, dr + 0.1]) mesh(new THREE.BoxGeometry(0.2, DOOR_H, 0.5), wood, x, DOOR_H / 2, zf - 0.17);

  // ---- tetto ----
  const roofGeo = new THREE.ConeGeometry(0.7071, 1, 4); roofGeo.rotateY(Math.PI / 4);
  const roof = mesh(roofGeo, new THREE.MeshStandardMaterial({ color: cfg.id === 'vvf' ? 0x8a3a2a : 0xa5502f, roughness: 0.85 }), 0, H + 1.85, (HQ.z0 + HQ.z1) / 2);
  roof.scale.set(HQ.x1 - HQ.x0 + 1.6, 3.8, HQ.z1 - HQ.z0 + 1.6);

  // ======== PIAZZALE ========
  const Y = HQ.yard;
  const yardTex = world.tex.asphalt.clone(); yardTex.needsUpdate = true; yardTex.repeat.set((Y.x1 - Y.x0) / 5, (Y.z1 - Y.z0) / 5);
  const yard = new THREE.Mesh(new THREE.PlaneGeometry(Y.x1 - Y.x0, Y.z1 - Y.z0).rotateX(-Math.PI / 2), layer(new THREE.MeshStandardMaterial({ map: yardTex, roughness: 0.95 }), 9));
  yard.position.set((Y.x0 + Y.x1) / 2, 0.05, (Y.z0 + Y.z1) / 2); yard.receiveShadow = true; g.add(yard);
  const lineMat = layer(new THREE.MeshBasicMaterial({ color: 0xe8e8df }), 11);
  const bays = cfg.bays || [];
  for (let i = 0; i <= bays.length; i++) {
    const lx = i < bays.length ? bays[i].x - cfg.spacing / 2 : bays[bays.length - 1].x + cfg.spacing / 2;
    const l = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 13).rotateX(-Math.PI / 2), lineMat); l.position.set(lx, 0.06, bays[0].z); g.add(l);
  }
  const ysign = new THREE.Mesh(new THREE.PlaneGeometry(4.6, 0.9), new THREE.MeshBasicMaterial({ map: T.textTexture('PARCHEGGIO VEICOLI', { w: 800, h: 160, font: 'bold 90px Arial', fg: '#fff', bg: cfg.color }) }));
  ysign.position.set(40, 2.2, Y.z0 + 0.12); g.add(ysign);
  plain(37.9, 38.1, Y.z0 + 0.05, Y.z0 + 0.15, 0, 2.7, darkMetal, false);
  // recinzione
  const barTex = (() => {
    const c = T.makeCanvas(64, 128), cx = c.getContext('2d'); cx.clearRect(0, 0, 64, 128); cx.fillStyle = '#1c1f23';
    for (let x = 6; x < 64; x += 16) cx.fillRect(x, 6, 4, 122); cx.fillRect(0, 10, 64, 4); cx.fillRect(0, 110, 64, 4);
    const t2 = new THREE.CanvasTexture(c); t2.wrapS = t2.wrapT = THREE.RepeatWrapping; t2.colorSpace = THREE.SRGBColorSpace; return t2;
  })();
  const fence = (x0, z0, x1, z1) => {
    const len = Math.hypot(x1 - x0, z1 - z0);
    const tx = barTex.clone(); tx.needsUpdate = true; tx.repeat.set(len, 1);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(len, 1.9), new THREE.MeshStandardMaterial({ map: tx, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.6, metalness: 0.5 }));
    m.position.set((x0 + x1) / 2, 0.05 + 0.95, (z0 + z1) / 2); m.rotation.y = -Math.atan2(z1 - z0, x1 - x0); m.castShadow = true; g.add(m);
    addC(Math.min(x0, x1) - 0.1, Math.max(x0, x1) + 0.1, Math.min(z0, z1) - 0.1, Math.max(z0, z1) + 0.1, 0, 1.9);
  };
  fence(Y.x0, Y.z1, HQ.gate.x0, Y.z1); fence(HQ.gate.x1, Y.z1, Y.x1, Y.z1);
  fence(Y.x1, Y.z0, Y.x1, Y.z1); fence(Y.x0, Y.z0, Y.x1, Y.z0);
  fence(Y.x0, Y.z0, Y.x0, HQ.z0); fence(Y.x0, HQ.z1, Y.x0, Y.z1);
  for (const x of [HQ.gate.x0, HQ.gate.x1]) {
    plain(x - 0.3, x + 0.3, Y.z1 - 0.3, Y.z1 + 0.3, 0, 2.3, stone);
    mesh(new THREE.SphereGeometry(0.2, 10, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(cfg.color) }), x, 2.5, Y.z1);
  }
  world.root.add(g);

  const W = (p) => ({ x: ox + p.x, z: oz + p.z });
  return {
    cfg, group: g, ox, oz, gy, lights, door: { x: ox, z: oz },
    interact: { desk: W(HQ.desk), lockers: W(HQ.lockers), equip: W(HQ.equip), keys: W(HQ.keys) },
    bays: bays.map((b) => ({ x: ox + b.x, z: oz + b.z, heading: b.heading })),
    yard: { x0: ox + Y.x0, x1: ox + Y.x1, z0: oz + Y.z0, z1: oz + Y.z1 },
    footprint: { x0: ox + HQ.x0, x1: ox + HQ.x1, z0: oz + HQ.z0, z1: oz + HQ.z1 },
    gate: { x: ox + (HQ.gate.x0 + HQ.gate.x1) / 2, z: oz + Y.z1 },
    inside(x, z) { return x > ox + HQ.x0 && x < ox + HQ.x1 && z > oz + HQ.z0 && z < oz + HQ.z1; },
  };
}
