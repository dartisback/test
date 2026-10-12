import * as THREE from 'three';
import { Q } from './layout.js';
import * as T from './textures.js';
import { layer } from './util.js';

// Costruisce la Questura di Belluno (facciata con portico e balcone come nelle foto),
// interni percorribili: accoglienza, spogliatoio, armeria, sala operativa e piazzale volanti.
export function buildQuestura(world) {
  const g = new THREE.Group();
  g.name = 'questura';
  const H = Q.height, t = Q.wall;
  const cream = 0xe7d9b7;
  const fm = world.facadeMat(cream);
  const paint = new THREE.MeshStandardMaterial({ color: 0xece7da, roughness: 0.95 });
  const paintDark = new THREE.MeshStandardMaterial({ color: 0x4a5b73, roughness: 0.9 });
  const wood = new THREE.MeshStandardMaterial({ color: 0x7a5233, roughness: 0.7 });
  const darkMetal = new THREE.MeshStandardMaterial({ color: 0x2a2e33, roughness: 0.5, metalness: 0.6 });
  const stone = new THREE.MeshStandardMaterial({ color: 0xd8d0bd, roughness: 0.85 });
  const grid = world.grid;

  const shadow = (m) => { m.castShadow = true; m.receiveShadow = true; return m; };
  const solid = (x0, x1, z0, z1, y0, y1, outward, collide = true) => {
    const m = world.facadeBox(x0, x1, z0, z1, y0, y1, cream, paint);
    const mats = Array(6).fill(paint);
    if (outward !== undefined) mats[outward] = fm;
    m.material = mats;
    g.add(m);
    if (collide) grid.add({ x0, x1, z0, z1, y0, y1 });
    return m;
  };
  const plain = (x0, x1, z0, z1, y0, y1, mat, collide = true) => {
    const m = shadow(new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0), mat));
    m.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
    g.add(m);
    if (collide) grid.add({ x0, x1, z0, z1, y0, y1 });
    return m;
  };

  // ---- muri perimetrali ----
  const dl = Q.doorX - Q.doorW / 2, dr = Q.doorX + Q.doorW / 2;
  const DOOR_H = 3.2;
  solid(Q.x0, dl, Q.z1 - t, Q.z1, 0, H, 4);
  solid(dr, Q.x1, Q.z1 - t, Q.z1, 0, H, 4);
  solid(dl, dr, Q.z1 - t, Q.z1, DOOR_H, H, 4);
  solid(Q.x0, Q.x1, Q.z0, Q.z0 + t, 0, H, 5);
  solid(Q.x0, Q.x0 + t, Q.z0, Q.z1, 0, H, 1);
  // porta sul retro (verso il piazzale)
  const bz0 = -157, bz1 = -154;
  solid(Q.x1 - t, Q.x1, Q.z0, bz0, 0, H, 0);
  solid(Q.x1 - t, Q.x1, bz1, Q.z1, 0, H, 0);
  solid(Q.x1 - t, Q.x1, bz0, bz1, 2.8, H, 0);

  // ---- pavimento e soffitto ----
  const floorTex = T.floorTilesTexture();
  floorTex.repeat.set((Q.x1 - Q.x0) / 3, (Q.z1 - Q.z0) / 3);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(Q.x1 - Q.x0, Q.z1 - Q.z0).rotateX(-Math.PI / 2), layer(new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.4 }), 9));
  floor.position.set((Q.x0 + Q.x1) / 2, 0.09, (Q.z0 + Q.z1) / 2); floor.receiveShadow = true; g.add(floor);
  const ceil = new THREE.Mesh(new THREE.BoxGeometry(Q.x1 - Q.x0, 0.3, Q.z1 - Q.z0), paint);
  ceil.position.set((Q.x0 + Q.x1) / 2, Q.ceil + 0.15, (Q.z0 + Q.z1) / 2); ceil.receiveShadow = true; g.add(ceil);
  grid.add({ x0: Q.x0, x1: Q.x1, z0: Q.z0, z1: Q.z1, y0: Q.ceil, y1: Q.ceil + 0.3 });
  // zoccolino blu (fascia) lungo i muri interni

  // ---- pareti interne ----
  const pt = 0.16; // metà spessore
  const DH = 2.7;  // altezza porta interna
  const ZB = -150; // parete tra atrio e sala operativa
  // P1 (x=-38): porta spogliatoio
  const p1 = -38, p2 = -22;
  const doorZ0 = -144.6, doorZ1 = -142.4;
  for (const px of [p1, p2]) {
    plain(px - pt, px + pt, ZB, doorZ0, 0, Q.ceil, paint);
    plain(px - pt, px + pt, doorZ1, Q.z1 - t, 0, Q.ceil, paint);
    plain(px - pt, px + pt, doorZ0, doorZ1, DH, Q.ceil, paint, false);
    grid.add({ x0: px - pt, x1: px + pt, z0: doorZ0, z1: doorZ1, y0: DH, y1: Q.ceil });
  }
  // parete di fondo atrio/stanze con varco verso la sala operativa
  const gx0 = -31.5, gx1 = -28.5;
  plain(Q.x0 + t, gx0, ZB - pt, ZB + pt, 0, Q.ceil, paint);
  plain(gx1, Q.x1 - t, ZB - pt, ZB + pt, 0, Q.ceil, paint);
  plain(gx0, gx1, ZB - pt, ZB + pt, DH, Q.ceil, paint);

  // ---- cartelli ----
  const sign = (text, x, y, z, ry, w = 2.6, h = 0.55, bg = '#1d3a6b') => {
    const tex = T.textTexture(text, { w: 512, h: Math.round(512 * h / w), font: 'bold 62px Arial', fg: '#ffffff', bg });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex }));
    m.position.set(x, y, z); m.rotation.y = ry; g.add(m); return m;
  };
  sign('SPOGLIATOIO', p1 + pt + 0.02, 3.2, -143.5, Math.PI / 2);
  sign('ARMERIA', p2 - pt - 0.02, 3.2, -143.5, -Math.PI / 2);
  sign('SALA OPERATIVA', -30, 3.3, ZB + pt + 0.02, 0, 3.2, 0.55);
  sign('USCITA', Q.x1 - t - 0.02, 3.3, -155.5, -Math.PI / 2, 1.6, 0.45, '#1f7a3a');

  // ---- ATRIO: accoglienza ----
  const deskTop = new THREE.MeshStandardMaterial({ color: 0x8a6a4a, roughness: 0.5 });
  plain(-34, -26, -143.2, -141.8, 0, 1.1, paintDark);
  plain(-34.2, -25.8, -143.4, -141.6, 1.1, 1.18, deskTop, false);
  plain(-31.2, -29.6, -143.6, -143.1, 1.18, 1.62, darkMetal, false); // monitor
  const deskSign = new THREE.Mesh(new THREE.PlaneGeometry(4, 0.5), new THREE.MeshBasicMaterial({ map: T.textTexture('ACCOGLIENZA / ENTRA IN SERVIZIO', { w: 1024, h: 128, font: 'bold 60px Arial', fg: '#fff', bg: '#12306a' }) }));
  deskSign.position.set(-30, 0.62, -141.78);
  g.add(deskSign);
  // panche sala d'attesa
  for (const [x, z] of [[-36.6, -137.2], [-23.4, -137.2]]) plain(x - 0.7, x + 0.7, z - 0.25, z + 0.25, 0, 0.5, wood);
  plain(-37.7, -37.2, -140, -138.5, 0, 0.9, new THREE.MeshStandardMaterial({ color: 0x2f7a3b, roughness: 0.9 }), false); // vaso
  // bacheca / stemma
  const emblem = new THREE.Mesh(new THREE.CircleGeometry(0.55, 24), new THREE.MeshBasicMaterial({ color: 0x2850a0 }));
  emblem.position.set(-30, 2.5, Q.z1 - t - 0.02); emblem.rotation.y = Math.PI; g.add(emblem);

  // ---- SPOGLIATOIO ----
  const lockTex = T.lockerTexture();
  lockTex.repeat.set(3, 1);
  const lockMat = new THREE.MeshStandardMaterial({ map: lockTex, roughness: 0.5, metalness: 0.4 });
  const lk = plain(Q.x0 + t, Q.x0 + t + 0.65, -149.6, -136.4, 0, 2.2, lockMat);
  lk.geometry.dispose();
  { // UV: ripeti 13 m di armadietti
    const geo = new THREE.BoxGeometry(0.65, 2.2, 13.2);
    const uv = geo.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 6, uv.getY(i));
    lk.geometry = geo;
  }
  plain(-44.5, -41.8, -143.2, -142.2, 0, 0.45, wood);   // panca
  plain(-44.5, -41.8, -140.2, -139.4, 0, 0.45, wood);
  const mirror = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 1.9), new THREE.MeshStandardMaterial({ color: 0xcfe0ee, metalness: 1, roughness: 0.05 }));
  mirror.position.set(-41.5, 1.5, ZB + 0.19); g.add(mirror);
  const wardrobeSign = sign('UNIFORMI', Q.x0 + t + 0.67, 2.65, -143, Math.PI / 2, 1.8, 0.4, '#8a1b24');

  // ---- ARMERIA ----
  plain(-15.6, -14.8, -148.6, -137.2, 0, 1.1, darkMetal);                    // bancone
  plain(-15.8, -14.6, -148.6, -137.2, 1.1, 1.18, deskTop, false);
  const bars = new THREE.MeshStandardMaterial({ color: 0x80858c, metalness: 0.8, roughness: 0.35 });
  for (let z = -148.4; z <= -137.4; z += 0.5) plain(-15.25, -15.15, z, z + 0.05, 1.18, 2.7, bars, false);
  plain(-15.4, -15.0, -148.6, -137.2, 2.7, 2.78, darkMetal, false);
  // scaffali con armi dietro il bancone
  const rackMat = new THREE.MeshStandardMaterial({ color: 0x1e2226, roughness: 0.6, metalness: 0.5 });
  plain(Q.x1 - t - 0.35, Q.x1 - t, -149.4, -136.2, 0, 2.4, new THREE.MeshStandardMaterial({ color: 0x4b5159, roughness: 0.7 }), false);
  for (let z = -148.6; z <= -137; z += 0.9) {
    plain(Q.x1 - t - 0.55, Q.x1 - t - 0.35, z, z + 0.5, 1.2, 1.35, rackMat, false);
    plain(Q.x1 - t - 0.55, Q.x1 - t - 0.35, z + 0.1, z + 0.4, 1.7, 1.82, rackMat, false);
  }
  sign('ARMERIA - RITIRO ARMI', -17.2, 2.6, ZB + pt + 0.02, 0, 2.8, 0.45, '#8a1b24');

  // ---- SALA OPERATIVA ----
  // bacheca chiavi volanti
  const kb = plain(-31.6, -28.4, Q.z0 + t, Q.z0 + t + 0.14, 1.1, 2.9, darkMetal, false);
  grid.add({ x0: -31.6, x1: -28.4, z0: Q.z0 + t, z1: Q.z0 + t + 0.3, y0: 0, y1: 3 });
  const sign2 = sign('BACHECA CHIAVI VOLANTI', -30, 3.15, Q.z0 + t + 0.17, Math.PI, 3.2, 0.42, '#12306a');
  const keyMats = [0x2f68d9, 0xe8e8e8, 0xd9a82f, 0x3aa357];
  for (let r = 0; r < 3; r++) for (let c = 0; c < 6; c++) {
    const k = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.22, 0.04), new THREE.MeshStandardMaterial({ color: keyMats[(r + c) % 4], metalness: 0.3 }));
    k.position.set(-31.2 + c * 0.5, 2.5 - r * 0.45, Q.z0 + t + 0.2); g.add(k);
  }
  // scrivanie con computer
  for (const [x, z] of [[-44, -158], [-40, -158], [-44, -162], [-40, -162], [-18, -158], [-18, -162]]) {
    plain(x - 1.2, x + 1.2, z - 0.55, z + 0.55, 0, 0.78, wood);
    plain(x - 0.35, x + 0.35, z - 0.1, z + 0.1, 0.78, 1.22, darkMetal, false);
  }
  // cartina murale della provincia
  const mapPanel = new THREE.Mesh(new THREE.PlaneGeometry(5, 2.4), new THREE.MeshBasicMaterial({ map: T.textTexture('PROVINCIA DI BELLUNO\nSALA OPERATIVA 113', { w: 640, h: 300, font: 'bold 54px Arial', fg: '#fff', bg: '#1f4e3a', border: '#fff' }) }));
  mapPanel.position.set(Q.x0 + t + 0.02, 2.2, -157); mapPanel.rotation.y = Math.PI / 2; g.add(mapPanel);

  // ---- luci interne ----
  const lights = [];
  for (const [x, z, i] of [[-30, -142, 26], [-43, -143, 18], [-17, -143, 18], [-36, -157, 26], [-24, -157, 22]]) {
    const l = new THREE.PointLight(0xfff0d8, i, 18, 1.6);
    l.position.set(x, 3.4, z);
    g.add(l); lights.push(l);
    const fixture = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.05, 0.3), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    fixture.position.set(x, Q.ceil - 0.03, z); g.add(fixture);
  }

  // ======== FACCIATA ========
  const zf = Q.z1;
  // portico: colonne
  const colMat = new THREE.MeshStandardMaterial({ color: 0xe8e0cf, roughness: 0.8 });
  for (const cx of [-35.6, -32.7, -27.3, -24.4]) {
    const c = shadow(new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.38, 3.75, 16), colMat));
    c.position.set(cx, 0.1 + 1.88, zf + 2.2); g.add(c);
    const base = shadow(new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.22, 0.9), stone)); base.position.set(cx, 0.2, zf + 2.2); g.add(base);
    const cap = shadow(new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.22, 0.9), stone)); cap.position.set(cx, 3.72, zf + 2.2); g.add(cap);
    grid.add({ x0: cx - 0.36, x1: cx + 0.36, z0: zf + 2.2 - 0.36, z1: zf + 2.2 + 0.36, y0: 0, y1: 3.8 });
  }
  // balcone sopra il portico
  plain(-37, -23, zf - 0.1, zf + 2.75, 3.82, 4.2, stone, false);
  grid.add({ x0: -37, x1: -23, z0: zf - 0.1, z1: zf + 2.75, y0: 3.82, y1: 4.2 });
  // balaustra
  const rail = new THREE.Mesh(new THREE.BoxGeometry(14, 0.12, 0.2), stone); rail.position.set(-30, 5.2, zf + 2.6); g.add(rail);
  const railL = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.12, 2.8), stone); railL.position.set(-36.9, 5.2, zf + 1.3); g.add(railL);
  const railR = railL.clone(); railR.position.x = -23.1; g.add(railR);
  const post = new THREE.CylinderGeometry(0.06, 0.08, 0.95, 8);
  const posts = new THREE.InstancedMesh(post, stone, 96);
  const dm = new THREE.Object3D(); let pi = 0;
  for (let x = -36.8; x <= -23.2; x += 0.34) { dm.position.set(x, 4.7, zf + 2.6); dm.updateMatrix(); posts.setMatrixAt(pi++, dm.matrix); }
  for (let z = zf + 0.2; z < zf + 2.6; z += 0.34) {
    dm.position.set(-36.9, 4.7, z); dm.updateMatrix(); posts.setMatrixAt(pi++, dm.matrix);
    dm.position.set(-23.1, 4.7, z); dm.updateMatrix(); posts.setMatrixAt(pi++, dm.matrix);
  }
  posts.count = pi; g.add(posts);
  // gradini
  for (let i = 0; i < 3; i++) plain(-33.2 + i * 0.0, -26.8, zf + 0.0 + 2.1 + i * 0.35, zf + 2.45 + i * 0.35, 0.06, 0.1 + 0.05 * (3 - i), stone, false);
  // stemma sulla facciata
  const crest = new THREE.Mesh(new THREE.CircleGeometry(0.62, 28), new THREE.MeshBasicMaterial({ map: T.textTexture('★', { w: 128, h: 128, font: 'bold 90px Arial', fg: '#d9b24a', bg: '#1f3f8a', border: '#cfd6e2' }) }));
  crest.position.set(-30, 5.9, zf + 0.03); g.add(crest);
  // bandiere (Italia + UE) e scritta verticale POLIZIA DI STATO
  for (const [x, k] of [[-35.2, 'it'], [-33.2, 'eu']]) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 3.4, 8), darkMetal);
    pole.position.set(x, 6.4, zf + 0.7); pole.rotation.z = (k === 'it' ? 0.5 : 0.35) * (x < -34 ? 1 : -1) * 0.0 + 0.0; g.add(pole);
    const flag = new THREE.Mesh(new THREE.PlaneGeometry(1.35, 0.9), new THREE.MeshStandardMaterial({ map: T.flagTexture(k), side: THREE.DoubleSide, roughness: 0.9 }));
    flag.position.set(x + 0.7, 7.5, zf + 0.7); g.add(flag);
  }
  {
    const c = T.makeCanvas(160, 640), cx = c.getContext('2d');
    cx.fillStyle = '#e8eef7'; cx.fillRect(0, 0, 160, 640);
    cx.strokeStyle = '#1c4aa0'; cx.lineWidth = 8; cx.strokeRect(4, 4, 152, 632);
    cx.save(); cx.translate(80, 320); cx.rotate(Math.PI / 2);
    cx.fillStyle = '#1c4aa0'; cx.font = 'bold 84px Arial'; cx.textAlign = 'center'; cx.textBaseline = 'middle'; cx.fillText('POLIZIA DI STATO', 0, 0, 580);
    cx.restore();
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
    const vs = new THREE.Mesh(new THREE.BoxGeometry(0.9, 3.6, 0.2), [paint, paint, paint, paint, new THREE.MeshBasicMaterial({ map: tex }), paint]);
    vs.position.set(Q.x1 + 0.2 - 1.0, 5.6, zf + 0.9); g.add(vs);
  }
  // targa "QUESTURA" vicino alla porta
  const plaque = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.5), new THREE.MeshStandardMaterial({ map: T.textTexture('QUESTURA\nDI BELLUNO', { w: 384, h: 128, font: 'bold 44px Arial', fg: '#111', bg: '#c8c4b8', border: '#555' }) }));
  plaque.position.set(-25.6, 1.75, zf + 0.03); g.add(plaque);
  // porta d'ingresso: vetrata aperta, battente laterale
  const doorFrame = new THREE.Mesh(new THREE.BoxGeometry(0.2, DOOR_H, 0.5), wood);
  for (const x of [dl - 0.1, dr + 0.1]) { const f = doorFrame.clone(); f.position.set(x, DOOR_H / 2, zf - 0.17); g.add(f); }

  // ---- tetto ----
  const w = Q.x1 - Q.x0 + 1.6, d = Q.z1 - Q.z0 + 1.6;
  const roofGeo = new THREE.ConeGeometry(0.7071, 1, 4); roofGeo.rotateY(Math.PI / 4);
  const roof = shadow(new THREE.Mesh(roofGeo, new THREE.MeshStandardMaterial({ color: 0xa5502f, roughness: 0.85 })));
  roof.scale.set(w, 3.8, d); roof.position.set((Q.x0 + Q.x1) / 2, H + 1.85, (Q.z0 + Q.z1) / 2); g.add(roof);
  const chim = shadow(new THREE.Mesh(new THREE.BoxGeometry(1, 3, 1), stone)); chim.position.set(-20, H + 3, -150); g.add(chim);

  // ======== PIAZZALE VOLANTI ========
  const Y = Q.yard;
  const yardTex = world.tex.asphalt.clone(); yardTex.needsUpdate = true; yardTex.repeat.set((Y.x1 - Y.x0) / 5, (Y.z1 - Y.z0) / 5);
  const yard = new THREE.Mesh(new THREE.PlaneGeometry(Y.x1 - Y.x0, Y.z1 - Y.z0).rotateX(-Math.PI / 2), layer(new THREE.MeshStandardMaterial({ map: yardTex, roughness: 0.95 }), 9));
  yard.position.set((Y.x0 + Y.x1) / 2, 0.085, (Y.z0 + Y.z1) / 2); yard.receiveShadow = true; g.add(yard);
  const lineMat = layer(new THREE.MeshBasicMaterial({ color: 0xe8e8df }), 11);
  const lineXs = Q.bays.map((b) => b.x - 3.5).concat([Q.bays[Q.bays.length - 1].x + 3.5]);
  for (const lx of lineXs) {
    const l = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 12).rotateX(-Math.PI / 2), lineMat);
    l.position.set(lx, 0.09, Q.bays[0].z - 0.8); g.add(l);
  }
  // corsia di uscita e indicazione
  const yardSign = new THREE.Mesh(new THREE.PlaneGeometry(4, 0.9), new THREE.MeshBasicMaterial({ map: T.textTexture('PARCHEGGIO VOLANTI', { w: 800, h: 180, font: 'bold 96px Arial', fg: '#fff', bg: '#12306a' }) }));
  yardSign.position.set(11, 2.2, Y.z0 + 0.12); g.add(yardSign);
  const signPost = plain(8.9, 9.1, Y.z0 + 0.05, Y.z0 + 0.15, 0, 2.7, darkMetal, false);

  // recinzione in ferro battuto con cancello aperto
  const barTex = (() => {
    const c = T.makeCanvas(64, 128), cx = c.getContext('2d');
    cx.clearRect(0, 0, 64, 128);
    cx.fillStyle = '#1c1f23';
    for (let x = 6; x < 64; x += 16) cx.fillRect(x, 6, 4, 122);
    cx.fillRect(0, 10, 64, 4); cx.fillRect(0, 110, 64, 4);
    const t2 = new THREE.CanvasTexture(c); t2.wrapS = t2.wrapT = THREE.RepeatWrapping; t2.colorSpace = THREE.SRGBColorSpace; return t2;
  })();
  const fenceMat = new THREE.MeshStandardMaterial({ map: barTex, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.6, metalness: 0.5 });
  const fence = (x0, z0, x1, z1) => {
    const len = Math.hypot(x1 - x0, z1 - z0);
    const tx = barTex.clone(); tx.needsUpdate = true; tx.repeat.set(len / 1.0, 1);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(len, 1.9), new THREE.MeshStandardMaterial({ map: tx, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.6, metalness: 0.5 }));
    m.position.set((x0 + x1) / 2, 0.095 + 0.95, (z0 + z1) / 2); m.rotation.y = -Math.atan2(z1 - z0, x1 - x0); m.castShadow = true; g.add(m);
    grid.add({ x0: Math.min(x0, x1) - 0.1, x1: Math.max(x0, x1) + 0.1, z0: Math.min(z0, z1) - 0.1, z1: Math.max(z0, z1) + 0.1, y0: 0, y1: 1.9 });
  };
  fence(Y.x0, Y.z1, Q.gate.x0, Y.z1);
  fence(Q.gate.x1, Y.z1, Y.x1, Y.z1);
  fence(Y.x1, Y.z0, Y.x1, Y.z1);
  fence(Y.x0, Y.z0, Y.x1, Y.z0);
  fence(Y.x0, Y.z0, Y.x0, Q.z0);
  fence(Y.x0, Q.z1, Y.x0, Y.z1);
  for (const x of [Q.gate.x0, Q.gate.x1]) {
    plain(x - 0.3, x + 0.3, Y.z1 - 0.3, Y.z1 + 0.3, 0, 2.3, stone);
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 8), new THREE.MeshBasicMaterial({ color: 0x3a6fd9 }));
    lamp.position.set(x, 2.5, Y.z1); g.add(lamp);
  }

  world.root.add(g);
  return {
    group: g,
    lights,
    interact: {
      desk: { ...Q.desk }, lockers: { ...Q.lockers }, armory: { ...Q.armory }, keys: { ...Q.keys },
    },
    yardBounds: Y,
  };
}
