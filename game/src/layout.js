// Dati puri della città (nessun THREE qui): usati da minimappa, mappa spawn e dal builder 3D.
// Layout stilizzato del quartiere Questura / Piazza dei Martiri di Belluno.
import { makeRng } from './util.js';

export const WORLD = { x0: -270, x1: 270, z0: -235, z1: 235 };

export const H_ROADS = [
  { name: 'Via Attilio Tissi', z: -120, w: 10 },
  { name: 'Via Ippolito Caffi', z: -20, w: 10 },
  { name: 'Via Giacomo Matteotti', z: 110, w: 10 },
];
export const V_ROADS = [
  { name: 'Via Loreto', x: -150, w: 9 },
  { name: 'Via Rodolfo Psaro', x: 40, w: 9 },
  { name: 'Via Roma', x: 170, w: 9 },
];

export const SIDEWALK = 2.5;
export const FLOOR_H = 3.3;

// Questura di Belluno (edificio d'ingresso a sud, affaccia su Via Attilio Tissi)
export const Q = {
  x0: -48, x1: -12, z0: -165, z1: -135,
  doorX: -30, doorW: 4.2,
  height: 9.4,
  ceil: 3.8,
  wall: 0.35,
  yard: { x0: -12, x1: 33, z0: -192, z1: -128 },
  gate: { x0: 4, x1: 19 },
  bays: [-6, 1, 8, 15, 22, 29].map((x) => ({ x, z: -183, heading: 0 })),
  // punti di interazione
  desk: { x: -30, z: -141.6 },
  lockers: { x: -45.6, z: -142.5 },
  armory: { x: -18.2, z: -142.5 },
  keys: { x: -30, z: -162.6 },
  backDoor: { x: -12.5, z: -155.5 },
};

const X_BLOCKS = [[-270, -154.5], [-145.5, 35.5], [44.5, 165.5], [174.5, 270]];
const Z_BLOCKS = [[-235, -125], [-115, -25], [-15, 105], [115, 235]];
const TYPES = [
  ['station', 'questura', 'urban', 'urban'],
  ['park', 'courts', 'piazzetta', 'park2'],
  ['urban', 'urban', 'urban', 'urban'],
  ['urban', 'urban', 'plaza', 'urban'],
];

const PALETTE = [0xe9d9b8, 0xe3c79a, 0xd9b98a, 0xe8cdb0, 0xf0e4cc, 0xd8c2a0, 0xe6b98c, 0xcfa77d, 0xbfa88a, 0xe8dfcf, 0xd7d0c0, 0xc9b99a];
const ROOFS = [0xa5502f, 0x9b4a2c, 0xb35c36, 0x8f4429, 0xa85d3a];

const SHOP_NAMES = ['La Trappola', 'La Fenice', 'Osteria del Tiziano', 'Gali', 'Sushi Yan', 'Kebab Pak', 'Terracotta', 'Astor', 'Speakeasy 1920', 'Bar Trattoria Il Moro', 'Pizzeria Dolomiti', 'Farmacia', 'Tabacchi', 'Caffè Centrale', 'Gelateria Alpina', 'Panificio'];

const NAMED = [
  { name: 'Albergo Delle Alpi', x: 80, z: -105, floors: 4 },
  { name: 'Ispettorato del Lavoro', x: 150, z: -45, floors: 3 },
  { name: 'MUBEL', x: 120, z: 92, floors: 3 },
  { name: 'Astor', x: 60, z: 128, floors: 3 },
];

const overlap = (a, b) => a.x0 < b.x1 && a.x1 > b.x0 && a.z0 < b.z1 && a.z1 > b.z0;
const shrink = (r, d) => ({ x0: r.x0 + d, x1: r.x1 - d, z0: r.z0 + d, z1: r.z1 - d });

export function streetNameAt(x, z) {
  let best = null, bd = 14;
  for (const r of H_ROADS) {
    const d = Math.abs(z - r.z) - r.w / 2;
    if (d < bd) { bd = d; best = r.name; }
  }
  for (const r of V_ROADS) {
    const d = Math.abs(x - r.x) - r.w / 2;
    if (d < bd) { bd = d; best = r.name; }
  }
  return best;
}

export function onRoad(x, z) {
  for (const r of H_ROADS) if (Math.abs(z - r.z) < r.w / 2) return true;
  for (const r of V_ROADS) if (Math.abs(x - r.x) < r.w / 2) return true;
  return false;
}

export function insideQuestura(x, z) {
  return x > Q.x0 && x < Q.x1 && z > Q.z0 && z < Q.z1;
}

export function generateLayout() {
  const rnd = makeRng(20250601);
  const L = {
    blocks: [], buildings: [], trees: [], lamps: [], decor: [], pois: [], spawns: [],
    parks: [], plazas: [], intersections: [],
  };

  for (const h of H_ROADS) for (const v of V_ROADS) L.intersections.push({ x: v.x, z: h.z, wx: v.w, wz: h.w });

  const addBuilding = (b) => {
    const floors = b.floors || rnd.int(2, 4);
    const nb = {
      x0: b.x0, x1: b.x1, z0: b.z0, z1: b.z1,
      floors, h: floors * FLOOR_H + 0.6,
      color: b.color ?? rnd.pick(PALETTE),
      roofColor: b.roofColor ?? rnd.pick(ROOFS),
      roofType: b.roofType ?? 'hip',
      name: b.name, face: b.face, big: b.big, special: b.special,
    };
    L.buildings.push(nb);
    return nb;
  };

  const fillBlock = (blk, { depth = [10, 14], skip = [], inset = SIDEWALK, alley = 0.12, names = 0.18 } = {}) => {
    const r = shrink(blk, inset);
    const Dmax = depth[1];
    const strips = [
      { axis: 'x', a: r.x0, b: r.x1, fixed: r.z0, dir: 1, face: 'n' },
      { axis: 'x', a: r.x0, b: r.x1, fixed: r.z1, dir: -1, face: 's' },
      { axis: 'z', a: r.z0 + Dmax + 1, b: r.z1 - Dmax - 1, fixed: r.x0, dir: 1, face: 'w' },
      { axis: 'z', a: r.z0 + Dmax + 1, b: r.z1 - Dmax - 1, fixed: r.x1, dir: -1, face: 'e' },
    ];
    for (const s of strips) {
      let p = s.a;
      while (p < s.b - 5) {
        let w = rnd.range(8, 17);
        if (s.b - p - w < 8) w = s.b - p;
        const d = rnd.range(depth[0], depth[1]);
        const rect = s.axis === 'x'
          ? { x0: p, x1: p + w, z0: s.dir > 0 ? s.fixed : s.fixed - d, z1: s.dir > 0 ? s.fixed + d : s.fixed }
          : { z0: p, z1: p + w, x0: s.dir > 0 ? s.fixed : s.fixed - d, x1: s.dir > 0 ? s.fixed + d : s.fixed };
        p += w + (rnd() < alley ? rnd.range(1.2, 2.2) : 0);
        if (skip.some((k) => overlap(rect, k))) continue;
        const b = addBuilding({ ...rect, face: s.face });
        if (rnd() < names) { b.name = rnd.pick(SHOP_NAMES); b.floors = Math.min(b.floors, 3); b.h = b.floors * FLOOR_H + 0.6; }
      }
    }
    return r;
  };

  const scatterTrees = (rect, n, minD = 4.5, avoid = []) => {
    let tries = 0, placed = 0;
    const pts = [];
    while (placed < n && tries++ < n * 30) {
      const x = rnd.range(rect.x0, rect.x1), z = rnd.range(rect.z0, rect.z1);
      if (avoid.some((a) => x > a.x0 - 2 && x < a.x1 + 2 && z > a.z0 - 2 && z < a.z1 + 2)) continue;
      if (pts.some((p) => (p.x - x) ** 2 + (p.z - z) ** 2 < minD * minD)) continue;
      pts.push({ x, z });
      L.trees.push({ x, z, s: rnd.range(0.8, 1.35) });
      placed++;
    }
  };

  // --------- blocchi ----------
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 4; c++) {
      const [x0, x1] = X_BLOCKS[c], [z0, z1] = Z_BLOCKS[r];
      const blk = { x0, x1, z0, z1, type: TYPES[r][c], row: r, col: c };
      L.blocks.push(blk);
    }
  }

  for (const blk of L.blocks) {
    const inner = shrink(blk, SIDEWALK);
    switch (blk.type) {
      case 'urban': {
        fillBlock(blk);
        // corte interna con qualche albero
        scatterTrees(shrink(blk, 17), 4, 6, L.buildings);
        break;
      }
      case 'station': {
        // edificio stazione che affaccia su Via Attilio Tissi
        addBuilding({ x0: -255, x1: -178, z0: -162, z1: -142, floors: 2, color: 0xd9c9a6, roofColor: 0x8f4429, face: 's', name: 'STAZIONE DI BELLUNO', big: true, special: 'station' });
        addBuilding({ x0: -172, x1: -158, z0: -158, z1: -140, floors: 2, color: 0xcdbb97, face: 's' });
        L.decor.push({ type: 'tracks', x0: -270, x1: -154.5, z0: -222, z1: -180 });
        L.decor.push({ type: 'train', x: -215, z: -207 });
        L.decor.push({ type: 'busstop', x: -190, z: -130.2 });
        L.plazas.push({ x0: -262, x1: -156, z0: -139, z1: -127.5, kind: 'forecourt' });
        scatterTrees({ x0: -265, x1: -157, z0: -178, z1: -168 }, 8, 8);
        break;
      }
      case 'questura': {
        // Palazzo di Giustizia, Procura, Caserma Fantuzzi + edifici dietro
        addBuilding({ x0: -140, x1: -86, z0: -176, z1: -138, floors: 3, color: 0xe3d6b6, roofColor: 0x9b4a2c, face: 's', name: 'PALAZZO DI GIUSTIZIA', big: true, special: 'giustizia' });
        addBuilding({ x0: -82, x1: -53, z0: -170, z1: -138, floors: 3, color: 0xd8c39a, face: 's', name: 'PROCURA DELLA REPUBBLICA', big: true });
        addBuilding({ x0: -140, x1: -53, z0: -226, z1: -190, floors: 3, color: 0xc7b690, face: 'n', name: 'CASERMA FANTUZZI', big: true });
        addBuilding({ x0: -8, x1: 33, z0: -230, z1: -197, floors: 3, color: 0xd9c49f, face: 'n' });
        addBuilding({ x0: -48, x1: -14, z0: -230, z1: -197, floors: 3, face: 'n' });
        scatterTrees({ x0: -138, x1: -55, z0: -188, z1: -178 }, 6, 8);
        break;
      }
      case 'courts': {
        // giardino centrale + palazzi nord/sud
        fillBlock(blk, { depth: [8, 11], inset: SIDEWALK });
        L.parks.push({ ...shrink(blk, 21), kind: 'garden' });
        scatterTrees(shrink(blk, 22), 16, 7);
        break;
      }
      case 'piazzetta': {
        // Piazza Piloni
        fillBlock(blk, { depth: [10, 13] });
        L.plazas.push({ ...shrink(blk, 17), kind: 'piazzetta' });
        L.decor.push({ type: 'fountain', x: (blk.x0 + blk.x1) / 2, z: (blk.z0 + blk.z1) / 2, r: 2.2 });
        scatterTrees(shrink(blk, 17), 6, 8);
        break;
      }
      case 'park': {
        L.parks.push({ ...inner, kind: 'park', name: "Parco dell'Artigliere da Montagna" });
        scatterTrees(inner, 70, 5.5);
        L.decor.push({ type: 'monument', x: (blk.x0 + blk.x1) / 2, z: (blk.z0 + blk.z1) / 2 });
        break;
      }
      case 'park2': {
        L.parks.push({ ...inner, kind: 'park', name: 'Parco Città di Bologna' });
        const cx = (blk.x0 + blk.x1) / 2, cz = (blk.z0 + blk.z1) / 2;
        L.decor.push({ type: 'pond', x: cx, z: cz, r: 9 });
        scatterTrees(inner, 60, 5.5, [{ x0: cx - 12, x1: cx + 12, z0: cz - 12, z1: cz + 12 }]);
        L.decor.push({ type: 'playground', x: cx + 24, z: cz + 14 });
        break;
      }
      case 'plaza': {
        // Piazza dei Martiri
        fillBlock(blk, { depth: [11, 14], names: 0.25 });
        const p = shrink(blk, 17);
        L.plazas.push({ ...p, kind: 'martiri' });
        const cx = (blk.x0 + blk.x1) / 2, cz = (blk.z0 + blk.z1) / 2;
        L.decor.push({ type: 'fountain', x: cx, z: cz, r: 4 });
        L.decor.push({ type: 'monument', x: cx, z: cz - 26 });
        for (let i = -3; i <= 3; i++) {
          if (i === 0) continue;
          L.trees.push({ x: cx + i * 15, z: p.z0 + 2, s: 1.1 });
          L.trees.push({ x: cx + i * 15, z: p.z1 - 2, s: 1.1 });
        }
        for (let i = -2; i <= 2; i++) {
          L.decor.push({ type: 'bench', x: cx + i * 15 + 7, z: p.z0 + 4, rot: 0 });
          L.decor.push({ type: 'bench', x: cx + i * 15 + 7, z: p.z1 - 4, rot: Math.PI });
        }
        break;
      }
    }
  }

  // Edifici con nome reale (dal foglio della mappa): rinomina quelli più vicini
  for (const n of NAMED) {
    let best = null, bd = 1e9;
    for (const b of L.buildings) {
      if (b.special) continue;
      const cx = (b.x0 + b.x1) / 2, cz = (b.z0 + b.z1) / 2;
      const d = (cx - n.x) ** 2 + (cz - n.z) ** 2;
      if (d < bd) { bd = d; best = b; }
    }
    if (best) {
      best.name = n.name; best.big = true;
      best.floors = n.floors; best.h = n.floors * FLOOR_H + 0.6;
    }
  }

  // --------- lampioni e alberi stradali ----------
  const nearIntersection = (x, z, d) => L.intersections.some((i) => Math.abs(x - i.x) < i.wx / 2 + d && Math.abs(z - i.z) < i.wz / 2 + d);
  const inQDoor = (x, z) => x > Q.x0 - 4 && x < Q.x1 + 2 && z > -140 && z < -113;
  for (const r of H_ROADS) {
    for (let x = WORLD.x0 + 15, i = 0; x < WORLD.x1 - 10; x += 26, i++) {
      const side = i % 2 ? 1 : -1;
      const z = r.z + side * (r.w / 2 + 1.1);
      if (!nearIntersection(x, z, 5)) L.lamps.push({ x, z, rot: side > 0 ? Math.PI : 0, axis: 'x' });
    }
    for (let x = WORLD.x0 + 22, i = 0; x < WORLD.x1 - 15; x += 17, i++) {
      for (const side of [-1, 1]) {
        const z = r.z + side * (r.w / 2 + 1.8);
        if (rnd() < 0.45 && !nearIntersection(x, z, 7) && !inQDoor(x, z) && r.z !== -20) L.trees.push({ x, z, s: rnd.range(0.7, 0.95), street: true });
      }
    }
  }
  for (const r of V_ROADS) {
    for (let z = WORLD.z0 + 18, i = 0; z < WORLD.z1 - 10; z += 26, i++) {
      const side = i % 2 ? 1 : -1;
      const x = r.x + side * (r.w / 2 + 1.1);
      if (!nearIntersection(x, z, 5)) L.lamps.push({ x, z, rot: side > 0 ? Math.PI / 2 : -Math.PI / 2, axis: 'z' });
    }
    for (let z = WORLD.z0 + 25, i = 0; z < WORLD.z1 - 15; z += 17, i++) {
      for (const side of [-1, 1]) {
        const x = r.x + side * (r.w / 2 + 1.8);
        if (rnd() < 0.4 && !nearIntersection(x, z, 7) && !inQDoor(x, z)) L.trees.push({ x, z, s: rnd.range(0.7, 0.95), street: true });
      }
    }
  }

  // alberi lungo i confini del mondo
  for (let x = WORLD.x0; x <= WORLD.x1; x += 9) {
    L.trees.push({ x: x + rnd.range(-2, 2), z: WORLD.z0 + 3 + rnd.range(0, 3), s: rnd.range(1.4, 2.2), edge: true });
    L.trees.push({ x: x + rnd.range(-2, 2), z: WORLD.z1 - 3 - rnd.range(0, 3), s: rnd.range(1.4, 2.2), edge: true });
  }
  for (let z = WORLD.z0; z <= WORLD.z1; z += 9) {
    L.trees.push({ x: WORLD.x0 + 3 + rnd.range(0, 3), z: z + rnd.range(-2, 2), s: rnd.range(1.4, 2.2), edge: true });
    L.trees.push({ x: WORLD.x1 - 3 - rnd.range(0, 3), z: z + rnd.range(-2, 2), s: rnd.range(1.4, 2.2), edge: true });
  }

  // --------- POI / spawn ----------
  L.pois = [
    { id: 'questura', name: 'Questura di Belluno', x: -30, z: -150, icon: 'police' },
    { id: 'station', name: 'Stazione', x: -215, z: -150, icon: 'train', call: { x: -215, z: -131 } },
    { id: 'giustizia', name: 'Palazzo di Giustizia', x: -113, z: -157, icon: 'building', call: { x: -113, z: -131 } },
    { id: 'martiri', name: 'Piazza dei Martiri', x: 105, z: 168, icon: 'plaza' },
    { id: 'bologna', name: 'Parco Città di Bologna', x: 222, z: -70, icon: 'park' },
    { id: 'artigliere', name: "Parco dell'Artigliere", x: -212, z: -70, icon: 'park' },
  ];

  L.spawns = [
    { id: 'home', name: 'Casa (Via Loreto)', desc: 'Parti da casa tua, in abiti civili.', x: -155.6, z: 42, yaw: 0 },
    { id: 'station', name: 'Stazione di Belluno', desc: 'Sei appena sceso dal treno.', x: -205, z: -131, yaw: 0.2 },
    { id: 'martiri', name: 'Piazza dei Martiri', desc: 'Una passeggiata in centro, cuore della città.', x: 105, z: 168, yaw: Math.PI },
    { id: 'bologna', name: 'Parco Città di Bologna', desc: 'Il parco vicino a Via Flavio Ostilio.', x: 214, z: -52, yaw: Math.PI },
    { id: 'questura', name: 'Davanti alla Questura', desc: 'A pochi passi dall\'ingresso.', x: -24, z: -126.5, yaw: 0 },
  ];

  return L;
}
