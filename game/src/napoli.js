// Dati puri della città di Napoli (nessun THREE): quartieri, strade, edifici, punti di interesse.
// Mappa COMPRESSA e stilizzata: x = est, z = sud, il mare è a z > 0.
import { makeRng, clamp, lerp, smooth, distRect } from './util.js';

export const WORLD = { x0: -1400, x1: 2500, z0: -1700, z1: 120 };
export const FLOOR_H = 3.2;

// ----------------------------------------------------------------------------------------
// Sedi dei corpi (porta d'ingresso in (x, z); l'edificio si estende a NORD, il piazzale a EST)
// ----------------------------------------------------------------------------------------
export const FACTIONS = {
  polizia: {
    id: 'polizia', name: 'Polizia di Stato', short: 'POLIZIA', hq: 'Questura di Napoli',
    law: true, color: '#1f5fd9', facade: 0xe3d3ac, sign: 'POLIZIA DI STATO', desc: 'Volanti, inseguimenti, arresti. Pattuglia la città con Giulia e Giulietta.',
    door: { x: 150, z: -215 }, frontRoad: { z: -200, x0: -10, x1: 520, name: 'Via Medina' },
    equip: 'ARMERIA', equipItems: ['Beretta 92', 'Taser', 'Manganello', 'Manette'], equipMsg: 'Armi ritirate: [1] Pistola [2] Taser [3] Manganello',
    vehicles: ['giulia', 'giulietta', 'giulia', 'giulietta'], outfit: 'polizia', spacing: 7,
  },
  carabinieri: {
    id: 'carabinieri', name: 'Arma dei Carabinieri', short: 'CARABINIERI', hq: 'Caserma dei Carabinieri',
    law: true, color: '#0e2a6b', facade: 0xd8c9a5, sign: 'CARABINIERI', desc: "Radiomobile dell'Arma: controllo del territorio, inseguimenti e arresti.",
    door: { x: -600, z: -120 }, frontRoad: { z: -105, x0: -1100, x1: -420, name: 'Via dei Mille' },
    equip: 'ARMERIA', equipItems: ['Beretta 92', 'Taser', 'Manganello', 'Manette'], equipMsg: 'Armi ritirate: [1] Pistola [2] Taser [3] Manganello',
    vehicles: ['cc_giulia', 'cc_giulietta', 'cc_giulia', 'cc_giulietta'], outfit: 'carabinieri', spacing: 7,
  },
  croce_rossa: {
    id: 'croce_rossa', name: 'Croce Rossa Italiana', short: 'CROCE ROSSA', hq: 'Comitato Croce Rossa',
    law: false, color: '#d9202a', facade: 0xece4d6, sign: 'CROCE ROSSA ITALIANA', desc: 'Ambulanze, soccorso e trasporto in ospedale. Salva vite, rispetta i tempi.',
    door: { x: 600, z: -345 }, frontRoad: { z: -330, x0: 520, x1: 1000, name: 'Via Galileo Ferraris' },
    equip: 'MAGAZZINO SANITARIO', equipItems: ['Kit di primo soccorso', 'Defibrillatore'], equipMsg: 'Kit sanitario ritirato. Premi 1 per usarlo.',
    vehicles: ['ambulanza', 'ambulanza', 'ambulanza'], outfit: 'croce_rossa', spacing: 8.5,
  },
  vvf: {
    id: 'vvf', name: 'Vigili del Fuoco', short: 'VIGILI DEL FUOCO', hq: 'Comando Provinciale VVF',
    law: false, color: '#d12a1e', facade: 0xe0cfb0, sign: 'VIGILI DEL FUOCO', desc: 'Autopompa e idranti: spegni gli incendi e soccorri chi è in pericolo.',
    door: { x: 700, z: -545 }, frontRoad: { z: -530, x0: 520, x1: 1000, name: 'Via Gianturco' },
    equip: 'DEPOSITO ATTREZZATURE', equipItems: ['Lancia idrica', 'Ascia', 'Estintore'], equipMsg: 'Attrezzatura ritirata. Premi 1 per la lancia idrica (tasto sinistro = acqua).',
    vehicles: ['autopompa', 'autopompa'], outfit: 'vvf', spacing: 12,
  },
};
export const FACTION_IDS = Object.keys(FACTIONS);

/** Rettangolo riservato di una sede (edificio + piazzale) */
export function hqRect(f) {
  const { x, z } = f.door;
  return { x0: x - 24, x1: x + 70, z0: z - 64, z1: z + 8 };
}
export const HQ_RECTS = FACTION_IDS.map((id) => hqRect(FACTIONS[id]));

// ----------------------------------------------------------------------------------------
// Terreno
// ----------------------------------------------------------------------------------------
const plat = (t, k = 2.4) => smooth(clamp(t * k, 0, 1)); // profilo a "altopiano"
const bump = (x, z, cx, cz, rx, rz, A, k = 2.4) => A * plat(1 - Math.hypot((x - cx) / rx, (z - cz) / rz), k);

export const VESUVIO = { x: 1750, z: -720, R: 1150, H: 440 };

function rawHeight(x, z) {
  let h = 0;
  h += bump(x, z, -650, -680, 440, 340, 54);       // Vomero (altopiano)
  h += bump(x, z, -1080, -260, 380, 300, 46, 1.6); // Posillipo
  h += bump(x, z, -10, -800, 400, 280, 32, 1.4);   // Capodimonte
  h += bump(x, z, -1150, -1350, 650, 500, 150, 1.3);// Camaldoli
  h += clamp((-z - 950) * 0.02, 0, 14);            // pianura nord leggermente rialzata
  const dv = Math.hypot(x - VESUVIO.x, z - VESUVIO.z);
  if (dv < VESUVIO.R) {
    const t = 1 - dv / VESUVIO.R;
    h += VESUVIO.H * Math.pow(t, 1.55);
    if (dv < 110) h -= 46 * smooth(1 - dv / 110);  // cratere
  }
  return h;
}

const PADS = [];
export function addPad(rect, h) { PADS.push({ ...rect, h }); }

export function heightAt(x, z) {
  let h = rawHeight(x, z);
  for (const p of PADS) {
    const d = distRect(x, z, p);
    if (d < 45) h = lerp(h, p.h, smooth(1 - d / 45));
  }
  // costa: lungomare in piano fino a z=-2, poi scende in spiaggia/scogliera
  if (z > -2) {
    const wob = Math.sin(x / 70) * 3 + Math.sin(x / 23) * 1.2;
    h = lerp(Math.min(h, 0.2), -3.2, smooth((z + 2 - wob) / 16));
  }
  return h;
}

// ----------------------------------------------------------------------------------------
// Quartieri
// ----------------------------------------------------------------------------------------
const NAMES = {
  vicoli: ['Vico Lungo Gelso', 'Via Speranzella', 'Via Emanuele de Deo', 'Vico Tre Re a Toledo', 'Via Portacarrese', 'Vico Lungo Teatro Nuovo', 'Via Concezione a Montecalvario', 'Via Imbriani', 'Vico Tiratoio', 'Via Pasquale Scura', 'Vico Montecalvario'],
  centro: ['Via dei Tribunali', 'Via San Biagio dei Librai', 'Via Duomo', 'Via Santa Brigida', 'Via Medina', 'Via Depretis', 'Via Pignasecca', 'Via Mezzocannone', 'Via Monteoliveto', 'Via Cervantes'],
  chiaia: ['Via Chiaia', 'Via dei Mille', 'Via Filangieri', 'Via Calabritto', 'Riviera di Chiaia', 'Via Carducci', 'Via Colonna', 'Via Bisignano', 'Via Vittoria Colonna'],
  vomero: ['Via Scarlatti', 'Via Luca Giordano', 'Via Cimarosa', 'Via Bernini', 'Via Kerbaker', 'Via Merliani', 'Via Piscicelli', 'Via Solimena', 'Via Morghen', 'Via Aniello Falcone', 'Via Palizzi'],
  mercato: ['Via Nuova Marina', 'Via del Carmine', 'Via Lavinaio', 'Via Sant\'Eligio', 'Via Duchesca', 'Via Cesare Rosaroll', 'Via Torino', 'Via Brin'],
  sgt: ['Via Ferrante Imparato', 'Via Bernardo Quaranta', 'Via Taverna del Ferro', 'Via Gianturco', 'Via Ponte dei Francesi', 'Via Pontenuovo', 'Via Flavio Gioia', 'Corso San Giovanni'],
  secondigliano: ['Via Cupa dell\'Arco', 'Via Janfolla', 'Via Limitone d\'Arzano', 'Via Roma Verso Scampia', 'Via Benedetto Brin', 'Via Hugo Pratt', 'Via Dante Alighieri'],
  scampia: ['Viale della Resistenza', 'Via Ghisleri', 'Via Labriola', 'Via Ippolito Nievo', 'Viale della Metamorfosi', 'Via Gaetano Salvemini'],
  torre: ['Via Nazionale', 'Via Roma', 'Corso Vittorio Emanuele', 'Via Cavour', 'Via Marconi', 'Via Montedoro', 'Via San Sebastiano'],
  poggioreale: ['Via Nuova Poggioreale', 'Via Stadera', 'Via Reggia di Portici', 'Via Gianturco', 'Via Ottaviano Augusto', 'Via Tessitori'],
  sanita: ['Via Foria', 'Via della Sanità', 'Via Santa Teresa', 'Via Capodimonte', 'Via dei Vergini', 'Via Miracoli'],
};

// stili: piani, profondità edifici, larghezza lotti, palette, variante facciata, tetti
const PAL = {
  warm: [0xe0b45a, 0xe8c777, 0xd98f62, 0xe3a08a, 0xc8553d, 0xefdcaa, 0xd9a05b, 0xcf7f55, 0xe9b98c, 0xd7c38a],
  chiaia: [0xefe0b8, 0xe5cf9a, 0xe9d6c0, 0xd9b58a, 0xf1e9d3, 0xcfa890, 0xe2c27a],
  vomero: [0xefe6d3, 0xe3d4b5, 0xd9c7a4, 0xe8c7b0, 0xcfd3cb, 0xf2ecdd, 0xd8b99a],
  concrete: [0xb9b3a6, 0xa9a396, 0xc7bfae, 0x9d988c, 0xb5a98f, 0xbdb7a8],
  sgt: [0xcfa77c, 0xd9bb8a, 0xb88b6d, 0xa8a090, 0xd7c9a8, 0xc1704f],
  torre: [0xefe8d8, 0xe6d0a0, 0xe3b69a, 0xd9c8a5, 0xc9d3d6, 0xf3ede0],
  mercato: [0xd8b878, 0xc78d62, 0xd9a48a, 0xcfc09a, 0xb88f6d, 0xe2cfa0],
};
const STYLES = {
  vicoli: { floors: [5, 7], depth: [11, 15], lot: [8, 14], pal: PAL.warm, variant: 'old', hip: 0.0, inset: 0.7, murals: 0.14, laundry: true, names: NAMES.vicoli, stall: 0 },
  centro: { floors: [4, 6], depth: [12, 16], lot: [9, 16], pal: PAL.warm, variant: 'old', hip: 0.25, inset: 2.4, murals: 0.03, names: NAMES.centro },
  chiaia: { floors: [4, 6], depth: [12, 16], lot: [10, 17], pal: PAL.chiaia, variant: 'old', hip: 0.35, inset: 2.6, names: NAMES.chiaia },
  vomero: { floors: [5, 8], depth: [13, 18], lot: [11, 18], pal: PAL.vomero, variant: 'modern', hip: 0.1, inset: 2.6, names: NAMES.vomero },
  mercato: { floors: [3, 5], depth: [11, 15], lot: [8, 15], pal: PAL.mercato, variant: 'old', hip: 0.2, inset: 2.4, murals: 0.05, names: NAMES.mercato },
  sgt: { floors: [3, 6], depth: [12, 18], lot: [10, 22], pal: PAL.sgt, variant: 'old', hip: 0.1, inset: 2.4, murals: 0.2, names: NAMES.sgt, shed: 0.22 },
  secondigliano: { floors: [6, 9], depth: [14, 18], lot: [20, 38], pal: PAL.concrete, variant: 'tower', hip: 0, inset: 3, murals: 0.06, names: NAMES.secondigliano, slabs: true },
  scampia: { floors: [5, 8], depth: [14, 18], lot: [24, 44], pal: PAL.concrete, variant: 'tower', hip: 0, inset: 3, murals: 0.1, names: NAMES.scampia, slabs: true },
  torre: { floors: [3, 4], depth: [11, 15], lot: [8, 14], pal: PAL.torre, variant: 'old', hip: 0.65, inset: 2.4, names: NAMES.torre },
  poggioreale: { floors: [3, 5], depth: [14, 20], lot: [14, 30], pal: PAL.sgt, variant: 'old', hip: 0.1, inset: 2.4, names: NAMES.poggioreale, shed: 0.35 },
  sanita: { floors: [4, 6], depth: [12, 16], lot: [9, 16], pal: PAL.warm, variant: 'old', hip: 0.2, inset: 2.4, murals: 0.05, names: NAMES.sanita },
};

// rettangoli dei quartieri, ognuno con la propria griglia di strade
const DISTRICTS = [
  { id: 'vicoli', name: 'Quartieri Spagnoli', style: 'vicoli', rect: { x0: -400, x1: -10, z0: -460, z1: -210 }, sx: 30, sz: 33, wx: 5, wz: 5, ped: 1.0, traffic: 0.3 },
  { id: 'centro', name: 'Centro Storico', style: 'centro', rect: { x0: 10, x1: 380, z0: -430, z1: -24 }, sx: 66, sz: 52, wx: 7, wz: 7, ped: 0.9, traffic: 0.8 },
  { id: 'plebiscito', name: 'Plebiscito', style: 'chiaia', rect: { x0: -230, x1: -10, z0: -200, z1: -34 }, sx: 0, sz: 0, wx: 0, wz: 0, ped: 1.0, traffic: 0.3, plaza: true },
  { id: 'chiaia', name: 'Chiaia', style: 'chiaia', rect: { x0: -1150, x1: -240, z0: -300, z1: -24 }, sx: 80, sz: 62, wx: 8, wz: 8, ped: 0.7, traffic: 0.7 },
  { id: 'vomero', name: 'Vomero', style: 'vomero', rect: { x0: -900, x1: -430, z0: -900, z1: -470 }, sx: 82, sz: 72, wx: 9, wz: 9, ped: 0.6, traffic: 0.6 },
  { id: 'sanita', name: 'Sanità / Capodimonte', style: 'sanita', rect: { x0: -400, x1: 380, z0: -700, z1: -470 }, sx: 74, sz: 58, wx: 7, wz: 7, ped: 0.5, traffic: 0.5 },
  { id: 'mercato', name: 'Piazza Mercato', style: 'mercato', rect: { x0: 395, x1: 820, z0: -320, z1: -24 }, sx: 70, sz: 55, wx: 7, wz: 7, ped: 0.9, traffic: 0.6 },
  { id: 'poggioreale', name: 'Poggioreale', style: 'poggioreale', rect: { x0: 395, x1: 990, z0: -700, z1: -340 }, sx: 92, sz: 76, wx: 8, wz: 8, ped: 0.35, traffic: 0.5 },
  { id: 'sgt', name: 'San Giovanni a Teduccio', style: 'sgt', rect: { x0: 1010, x1: 1500, z0: -380, z1: -24 }, sx: 76, sz: 62, wx: 7, wz: 7, ped: 0.7, traffic: 0.5 },
  { id: 'torre', name: 'Torre del Greco', style: 'torre', rect: { x0: 1560, x1: 2150, z0: -420, z1: -24 }, sx: 68, sz: 56, wx: 6.5, wz: 6.5, ped: 0.7, traffic: 0.5 },
  { id: 'secondigliano', name: 'Secondigliano', style: 'secondigliano', rect: { x0: 110, x1: 860, z0: -1460, z1: -1030 }, sx: 110, sz: 90, wx: 9, wz: 9, ped: 0.55, traffic: 0.5 },
  { id: 'scampia', name: 'Scampia', style: 'scampia', rect: { x0: -720, x1: 100, z0: -1460, z1: -1030 }, sx: 125, sz: 100, wx: 9, wz: 9, ped: 0.45, traffic: 0.45 },
];

// piazze/aree riservate (nessuna strada/edificio): Plebiscito, Piazza Mercato, ecc.
export const PLAZAS = [
  { id: 'plebiscito', name: 'Piazza del Plebiscito', rect: { x0: -190, x1: -70, z0: -190, z1: -80 }, kind: 'plaza' },
  { id: 'mercato', name: 'Piazza Mercato', rect: { x0: 540, x1: 670, z0: -240, z1: -140 }, kind: 'market' },
  { id: 'dante', name: 'Piazza Dante', rect: { x0: 80, x1: 170, z0: -360, z1: -300 }, kind: 'plaza' },
  { id: 'villa', name: 'Villa Comunale', rect: { x0: -900, x1: -240, z0: -92, z1: -36 }, kind: 'park' },
  { id: 'parco_scampia', name: 'Parco', rect: { x0: -460, x1: -170, z0: -1330, z1: -1240 }, kind: 'park' },
  { id: 'capodimonte', name: 'Bosco di Capodimonte', rect: { x0: -300, x1: 60, z0: -690, z1: -570 }, kind: 'park' },
  { id: 'vomero_park', name: 'Villa Floridiana', rect: { x0: -760, x1: -640, z0: -740, z1: -650 }, kind: 'park' },
  { id: 'maschio', name: 'Maschio Angioino', rect: { x0: 205, x1: 285, z0: -112, z1: -45 }, kind: 'landmark' },
  { id: 'reale', name: 'Palazzo Reale', rect: { x0: -72, x1: -18, z0: -192, z1: -82 }, kind: 'landmark' },
  { id: 'carmine', name: 'Chiesa del Carmine', rect: { x0: 672, x1: 740, z0: -252, z1: -190 }, kind: 'landmark' },
  { id: 'vele', name: 'Vele di Scampia', rect: { x0: -490, x1: -110, z0: -1245, z1: -1080 }, kind: 'landmark' },
  { id: 'elmo', name: 'Castel Sant\'Elmo', rect: { x0: -610, x1: -470, z0: -860, z1: -730 }, kind: 'landmark' },
  { id: 'cardarelli', name: 'Ospedale Cardarelli', rect: { x0: -530, x1: -430, z0: -610, z1: -520 }, kind: 'landmark' },
  { id: 'delmare', name: 'Ospedale del Mare', rect: { x0: 1120, x1: 1210, z0: -270, z1: -190 }, kind: 'landmark' },
  { id: 'jorit', name: 'Murale di Jorit', rect: { x0: 1236, x1: 1270, z0: -232, z1: -196 }, kind: 'landmark' },
];

// strade principali (arterie)
function arterials() {
  const H = [], V = [];
  const ph = (z, x0, x1, w, name, kind = 'main') => H.push({ z, x0: Math.min(x0, x1), x1: Math.max(x0, x1), w, name, kind });
  const pv = (x, z0, z1, w, name, kind = 'main') => V.push({ x, z0: Math.min(z0, z1), z1: Math.max(z0, z1), w, name, kind });
  // lungomare + via Marina + corso San Giovanni + corso Garibaldi (Torre)
  ph(-24, -1150, 2300, 15, 'Lungomare / Via Marina', 'coast');
  ph(-640, -420, 1000, 14, 'Via Foria / Via Gianturco');
  ph(-1000, -800, 900, 16, 'Asse Mediano');
  ph(-120, 0, 800, 13, 'Corso Umberto I');
  for (const id of FACTION_IDS) { const fr = FACTIONS[id].frontRoad; ph(fr.z, fr.x0, fr.x1, 10, fr.name, 'street'); }
  pv(0, -24, -770, 12, 'Via Toledo');
  pv(-420, -24, -720, 11, 'Via Tasso');
  pv(520, -24, -660, 14, 'Corso Garibaldi');
  pv(1000, -24, -1000, 13, 'Via Argine');
  pv(120, -640, -1460, 14, 'Corso Secondigliano');
  pv(-880, -24, -480, 11, 'Via Posillipo');
  pv(1700, -24, -520, 10, 'Via Vesuvio');
  pv(-300, -1000, -1460, 12, 'Viale della Resistenza');
  return { H, V };
}

const subtract = (a0, a1, cuts) => {
  let segs = [[a0, a1]];
  for (const [c0, c1] of cuts) {
    const out = [];
    for (const [s0, s1] of segs) {
      if (c1 <= s0 || c0 >= s1) { out.push([s0, s1]); continue; }
      if (c0 > s0) out.push([s0, c0]);
      if (c1 < s1) out.push([c1, s1]);
    }
    segs = out;
  }
  return segs.filter(([a, b]) => b - a > 6);
};

export function generateCity() {
  const rnd = makeRng(8082);
  const C = {
    districts: DISTRICTS, plazas: PLAZAS, roads: { H: [], V: [] }, blocks: [], buildings: [], trees: [], palms: [], lamps: [], decor: [],
    pois: [], spawns: [], hqs: {},
  };

  // pad del terreno: sedi in piano, piazze in piano
  for (const id of FACTION_IDS) {
    const r = hqRect(FACTIONS[id]);
    addPad({ x0: r.x0 - 25, x1: r.x1 + 15, z0: r.z0 - 10, z1: r.z1 + 22 }, Math.max(0.15, heightAt(FACTIONS[id].door.x, FACTIONS[id].door.z)));
  }
  addPad(PLAZAS[0].rect, 0.3); addPad(PLAZAS[1].rect, 0.3);
  // zone riservate (nessun edificio / strada di griglia)
  const reserved = [...HQ_RECTS, ...PLAZAS.filter((p) => p.kind !== 'park').map((p) => p.rect), ...PLAZAS.filter((p) => p.kind === 'park').map((p) => p.rect)];

  // ---- arterie ----
  const art = arterials();
  const addH = (l) => C.roads.H.push({ sw: l.kind === 'street' || l.w >= 10 ? 2.4 : 0, ...l });
  const addV = (l) => C.roads.V.push({ sw: l.w >= 10 ? 2.4 : 0, ...l });
  art.H.forEach(addH); art.V.forEach(addV);

  // ---- griglie dei quartieri ----
  for (const d of DISTRICTS) {
    if (!d.sx) continue;
    const st = STYLES[d.style], r = d.rect;
    const sw = d.wx >= 7.5 ? 2.4 : d.wx >= 6 ? 1.2 : 0;
    d.xs = []; d.zs = [];
    const nx = Math.round((r.x1 - r.x0) / d.sx), nz = Math.round((r.z1 - r.z0) / d.sz);
    for (let i = 1; i < nx; i++) d.xs.push(r.x0 + (i * (r.x1 - r.x0)) / nx);
    for (let j = 1; j < nz; j++) d.zs.push(r.z0 + (j * (r.z1 - r.z0)) / nz);
    for (const x of d.xs) {
      const cuts = reserved.filter((q) => x > q.x0 - d.wx && x < q.x1 + d.wx).map((q) => [q.z0 - d.wz / 2 - 2, q.z1 + d.wz / 2 + 2]);
      for (const [a, b] of subtract(r.z0, r.z1, cuts)) C.roads.V.push({ x, z0: a, z1: b, w: d.wx, name: rnd.pick(st.names), kind: 'local', sw, district: d.id });
    }
    for (const z of d.zs) {
      const cuts = reserved.filter((q) => z > q.z0 - d.wz && z < q.z1 + d.wz).map((q) => [q.x0 - d.wx / 2 - 2, q.x1 + d.wx / 2 + 2]);
      for (const [a, b] of subtract(r.x0, r.x1, cuts)) C.roads.H.push({ z, x0: a, x1: b, w: d.wz, name: rnd.pick(st.names), kind: 'local', sw, district: d.id });
    }
  }

  // ---- collega le estremità delle strade di quartiere alle strade vicine (entro 60 m) ----
  const snapEnds = () => {
    for (const h of C.roads.H) {
      if (h.kind !== 'local') continue;
      for (const end of ['x0', 'x1']) {
        const dir = end === 'x0' ? -1 : 1, from = h[end];
        let best = null, bd = 61;
        for (const v of C.roads.V) {
          if (h.z < v.z0 - 1 || h.z > v.z1 + 1) continue;
          const d = (v.x - from) * dir;
          if (d >= -v.w / 2 && d < bd) { bd = d; best = v; }
        }
        if (best && bd > 0) h[end] = best.x;
      }
    }
    for (const v of C.roads.V) {
      if (v.kind !== 'local') continue;
      for (const end of ['z0', 'z1']) {
        const dir = end === 'z0' ? -1 : 1, from = v[end];
        let best = null, bd = 61;
        for (const h of C.roads.H) {
          if (v.x < h.x0 - 1 || v.x > h.x1 + 1) continue;
          const d = (h.z - from) * dir;
          if (d >= -h.w / 2 && d < bd) { bd = d; best = h; }
        }
        if (best && bd > 0) v[end] = best.z;
      }
    }
  };
  snapEnds();

  // ---- indice spaziale delle strade (per evitare edifici sulle strade) ----
  const roadRects = [];
  for (const l of C.roads.H) roadRects.push({ x0: l.x0, x1: l.x1, z0: l.z - l.w / 2 - l.sw - 0.4, z1: l.z + l.w / 2 + l.sw + 0.4 });
  for (const l of C.roads.V) roadRects.push({ x0: l.x - l.w / 2 - l.sw - 0.4, x1: l.x + l.w / 2 + l.sw + 0.4, z0: l.z0, z1: l.z1 });
  const CELL = 64, rgrid = new Map();
  const key = (i, j) => i * 100003 + j;
  for (const r of roadRects) for (let i = Math.floor(r.x0 / CELL); i <= Math.floor(r.x1 / CELL); i++) for (let j = Math.floor(r.z0 / CELL); j <= Math.floor(r.z1 / CELL); j++) {
    const k = key(i, j); (rgrid.get(k) || rgrid.set(k, []).get(k)).push(r);
  }
  const hitsRoad = (b) => {
    for (let i = Math.floor(b.x0 / CELL); i <= Math.floor(b.x1 / CELL); i++) for (let j = Math.floor(b.z0 / CELL); j <= Math.floor(b.z1 / CELL); j++) {
      const a = rgrid.get(key(i, j)); if (!a) continue;
      for (const r of a) if (b.x0 < r.x1 && b.x1 > r.x0 && b.z0 < r.z1 && b.z1 > r.z0) return true;
    }
    return false;
  };
  const hitsReserved = (b) => reserved.some((r) => b.x0 < r.x1 + 2 && b.x1 > r.x0 - 2 && b.z0 < r.z1 + 2 && b.z1 > r.z0 - 2);
  C.hitsRoad = hitsRoad;

  // ---- edifici ----
  const placed = [];
  const addBuilding = (b, st, d) => {
    if (b.x1 - b.x0 < 5 || b.z1 - b.z0 < 5) return null;
    if (hitsRoad(b) || hitsReserved(b)) return null;
    if (b.z1 > -4) return null; // niente edifici sul mare
    const floors = b.floors || rnd.int(st.floors[0], st.floors[1]);
    const shed = st.shed && rnd() < st.shed && !b.floors;
    const nb = {
      x0: b.x0, x1: b.x1, z0: b.z0, z1: b.z1, floors: shed ? 1 + rnd.int(0, 1) : floors,
      h: (shed ? (1 + 0.6) * 5.2 : floors * FLOOR_H + 0.5),
      color: b.color ?? rnd.pick(st.pal),
      variant: shed ? 'shed' : b.variant || st.variant,
      roof: shed ? 'flat' : rnd() < (st.hip || 0) ? 'hip' : 'flat',
      roofColor: rnd.pick([0xa5502f, 0x9b4a2c, 0xb35c36, 0x8f4429]),
      face: b.face, name: b.name, big: b.big, mural: b.mural, district: d.id, special: b.special,
    };
    placed.push(nb);
    C.buildings.push(nb);
    return nb;
  };

  const fillBlock = (blk, st, d) => {
    const ins = Math.max(st.inset, (d.wx >= 7.5 ? 2.4 : d.wx >= 6 ? 1.2 : 0) + 0.55);
    const r = { x0: blk.x0 + ins, x1: blk.x1 - ins, z0: blk.z0 + ins, z1: blk.z1 - ins };
    const W = r.x1 - r.x0, D = r.z1 - r.z0;
    if (W < 9 || D < 9) return;
    const dmax = st.depth[1];
    if (st.slabs) {
      // lunghi stecche residenziali con corti verdi
      const rows = Math.max(1, Math.floor(D / 40));
      for (let k = 0; k < rows; k++) {
        const zc = r.z0 + (D * (k + 0.5)) / rows;
        let x = r.x0 + rnd.range(2, 8);
        while (x < r.x1 - 20) {
          const w = rnd.range(st.lot[0], st.lot[1]);
          const dep = rnd.range(st.depth[0], st.depth[1]);
          if (x + w > r.x1 - 3) break;
          addBuilding({ x0: x, x1: x + w, z0: zc - dep / 2, z1: zc + dep / 2, face: 's' }, st, d);
          x += w + rnd.range(8, 22);
        }
      }
      return;
    }
    const strips = [
      { axis: 'x', a: r.x0, b: r.x1, fixed: r.z0, dir: 1, face: 'n' },
      { axis: 'x', a: r.x0, b: r.x1, fixed: r.z1, dir: -1, face: 's' },
      { axis: 'z', a: r.z0 + dmax + 0.5, b: r.z1 - dmax - 0.5, fixed: r.x0, dir: 1, face: 'w' },
      { axis: 'z', a: r.z0 + dmax + 0.5, b: r.z1 - dmax - 0.5, fixed: r.x1, dir: -1, face: 'e' },
    ];
    for (const s of strips) {
      let p = s.a;
      while (p < s.b - 4) {
        let w = rnd.range(st.lot[0], st.lot[1]);
        if (s.b - p - w < st.lot[0] * 0.6) w = s.b - p;
        const dep = Math.min(rnd.range(st.depth[0], st.depth[1]), (s.axis === 'x' ? D : W) / 2 - 0.5);
        const rect = s.axis === 'x'
          ? { x0: p, x1: p + w, z0: s.dir > 0 ? s.fixed : s.fixed - dep, z1: s.dir > 0 ? s.fixed + dep : s.fixed }
          : { z0: p, z1: p + w, x0: s.dir > 0 ? s.fixed : s.fixed - dep, x1: s.dir > 0 ? s.fixed + dep : s.fixed };
        p += w + (st.alley && rnd() < st.alley ? rnd.range(1, 2) : 0);
        addBuilding({ ...rect, face: s.face }, st, d);
      }
    }
  };

  { // fascia di edifici tra Plebiscito e il lungomare
    const st = STYLES.chiaia, d = DISTRICTS.find((q) => q.id === 'plebiscito');
    fillBlock({ x0: -232, x1: -72, z0: -76, z1: -24 }, { ...st, inset: 2.6 }, { ...d, wx: 8, wz: 8 });
  }
  for (const d of DISTRICTS) {
    if (d.plaza) continue;
    const st = STYLES[d.style], r = d.rect;
    const xs = [r.x0, ...d.xs, r.x1], zs = [r.z0, ...d.zs, r.z1];
    for (let i = 0; i < xs.length - 1; i++) for (let j = 0; j < zs.length - 1; j++) {
      const hw = d.wx / 2, hz = d.wz / 2;
      const blk = { x0: xs[i] + (i === 0 ? 0 : hw + st.inset * 0 + 0), x1: xs[i + 1] - (i === xs.length - 2 ? 0 : hw), z0: zs[j] + (j === 0 ? 0 : hz), z1: zs[j + 1] - (j === zs.length - 2 ? 0 : hz) };
      C.blocks.push({ ...blk, district: d.id });
      fillBlock(blk, st, d);
    }
  }

  // ---- murales: assegna a facciate libere ----
  const muralSet = [];
  for (const b of C.buildings) {
    const st = STYLES[DISTRICTS.find((q) => q.id === b.district).style];
    if (st.murals && b.face && rnd() < st.murals && b.h > 12 && (b.x1 - b.x0) > 9 && (b.z1 - b.z0) > 9) b.mural = rnd.int(0, 4);
  }

  // ---- nomi ai negozi / edifici ----
  const named = [
    ['Ospedale Cardarelli', -560, -560, 6, true], ['Ospedale del Mare', 1240, -230, 5, true],
    ['Hotel Excelsior', -420, -70, 7, true], ['Galleria Umberto I', 100, -250, 5, true],
    ['Stazione Napoli Centrale', 620, -470, 4, true], ['Municipio', 230, -70, 5, true],
  ];
  C.pois = [
    { id: 'plebiscito', name: 'Piazza del Plebiscito', x: -130, z: -135, icon: 'plaza' },
    { id: 'mercato', name: 'Piazza Mercato', x: 590, z: -180, icon: 'plaza' },
    { id: 'lungomare', name: 'Lungomare Caracciolo', x: -520, z: -30, icon: 'sea' },
    { id: 'vomero', name: 'Vomero', x: -660, z: -690, icon: 'hill' },
    { id: 'vele', name: 'Vele di Scampia', x: -300, z: -1160, icon: 'building' },
    { id: 'secondigliano', name: 'Secondigliano', x: 480, z: -1240, icon: 'building' },
    { id: 'sgt', name: 'San Giovanni a Teduccio', x: 1250, z: -200, icon: 'building' },
    { id: 'torre', name: 'Torre del Greco', x: 1850, z: -210, icon: 'building' },
    { id: 'vicoli', name: 'Quartieri Spagnoli', x: -200, z: -335, icon: 'building' },
    { id: 'vesuvio', name: 'Vesuvio', x: 1750, z: -720, icon: 'mountain' },
    { id: 'ospedale1', name: 'Ospedale Cardarelli', x: -520, z: -520, icon: 'hospital' },
    { id: 'ospedale2', name: 'Ospedale del Mare', x: 1160, z: -170, icon: 'hospital' },
  ];
  for (const id of FACTION_IDS) { const f = FACTIONS[id]; C.pois.push({ id: 'hq_' + id, name: f.hq, x: f.door.x, z: f.door.z + 10, icon: id, faction: id }); }

  // ---- punti di partenza ----
  C.spawns = [
    { id: 'lungomare', name: 'Lungomare Caracciolo', desc: 'Passeggi sul lungomare con il Vesuvio all\'orizzonte.', x: -500, z: -34, yaw: Math.PI / 2 },
    { id: 'plebiscito', name: 'Piazza del Plebiscito', desc: 'Il cuore monumentale di Napoli.', x: -130, z: -100, yaw: 0 },
    { id: 'vicoli', name: 'Quartieri Spagnoli', desc: 'Vicoli stretti, bucato steso e murales.', x: -200, z: -332, yaw: 0 },
    { id: 'mercato', name: 'Piazza Mercato', desc: 'Bancarelle e campanile del Carmine.', x: 590, z: -140, yaw: Math.PI },
    { id: 'sgt', name: 'San Giovanni a Teduccio', desc: 'Murales giganti e vita di quartiere.', x: 1250, z: -140, yaw: 0 },
    { id: 'vele', name: 'Vele di Scampia', desc: 'Le grandi Vele, simbolo di Scampia.', x: -300, z: -1090, yaw: 0 },
    { id: 'secondigliano', name: 'Secondigliano', desc: 'Grandi palazzi e strade larghe.', x: 480, z: -1175, yaw: 0 },
    { id: 'vomero', name: 'Vomero', desc: 'Il quartiere sulla collina, con vista sul golfo.', x: -690, z: -690, yaw: 0 },
    { id: 'torre', name: 'Torre del Greco', desc: 'Ai piedi del Vesuvio, sul mare.', x: 1850, z: -150, yaw: 0 },
    { id: 'hq', name: 'Davanti alla tua sede', desc: 'Parti a pochi passi dalla caserma del corpo scelto.', x: 0, z: 0, yaw: 0, hq: true },
  ];

  // ---- alberi / lampioni lungo le strade ----
  const nearRoadCross = (x, z, d) => false;
  const inPlazaOrReserved = (x, z) => reserved.some((q) => x > q.x0 - 1 && x < q.x1 + 1 && z > q.z0 - 1 && z < q.z1 + 1);
  for (const l of C.roads.H) {
    if (l.kind === 'local' && l.w < 6) continue;
    const step = l.kind === 'local' ? 34 : 28;
    for (let x = l.x0 + 10, i = 0; x < l.x1 - 6; x += step, i++) {
      const side = i % 2 ? 1 : -1;
      const z = l.z + side * (l.w / 2 + 0.9);
      if (!inPlazaOrReserved(x, z)) C.lamps.push({ x, z, side, axis: 'x' });
      if (l.sw > 0 && rnd() < (l.kind === 'coast' ? 0.9 : 0.38)) {
        const zt = l.z - side * (l.w / 2 + 1.6);
        if (!inPlazaOrReserved(x + 7, zt) && !hitsBld(C, x + 7, zt)) (l.kind === 'coast' ? C.palms : C.trees).push({ x: x + 7, z: zt, s: rnd.range(0.8, 1.2), street: true });
      }
    }
  }
  for (const l of C.roads.V) {
    if (l.kind === 'local' && l.w < 6) continue;
    const step = l.kind === 'local' ? 34 : 28;
    for (let z = l.z0 + 10, i = 0; z < l.z1 - 6; z += step, i++) {
      const side = i % 2 ? 1 : -1;
      const x = l.x + side * (l.w / 2 + 0.9);
      if (!inPlazaOrReserved(x, z)) C.lamps.push({ x, z, side, axis: 'z' });
      if (l.sw > 0 && rnd() < 0.3) {
        const xt = l.x - side * (l.w / 2 + 1.6);
        if (!inPlazaOrReserved(xt, z + 7) && !hitsBld(C, xt, z + 7)) C.trees.push({ x: xt, z: z + 7, s: rnd.range(0.8, 1.1), street: true });
      }
    }
  }
  // parchi / piazze
  for (const p of PLAZAS) {
    const r = p.rect;
    if (p.kind === 'park') {
      const area = (r.x1 - r.x0) * (r.z1 - r.z0);
      const n = Math.min(240, Math.floor(area / 160));
      for (let i = 0; i < n; i++) (p.id === 'villa' && rnd() < 0.5 ? C.palms : C.trees).push({ x: rnd.range(r.x0 + 3, r.x1 - 3), z: rnd.range(r.z0 + 3, r.z1 - 3), s: rnd.range(0.9, 1.5) });
    } else if (p.kind === 'plaza') {
      for (let x = r.x0 + 8; x < r.x1; x += 22) { C.trees.push({ x, z: r.z0 + 3, s: 1.05 }); C.trees.push({ x, z: r.z1 - 3, s: 1.05 }); }
    }
  }
  // alberi sparsi nelle aree libere del Vesuvio / colline
  for (let i = 0; i < 900; i++) {
    const x = rnd.range(-1300, 2400), z = rnd.range(-1600, -40);
    if (!inAnyDistrict(DISTRICTS, x, z, 20) && !hitsRoad({ x0: x - 4, x1: x + 4, z0: z - 4, z1: z + 4 })) {
      const dv = Math.hypot(x - VESUVIO.x, z - VESUVIO.z);
      if (dv > 260 && dv < 1000 && rnd() < 0.8 || dv >= 1000) C.trees.push({ x, z, s: rnd.range(1.1, 2.0), wild: true });
    }
  }
  return C;
}

const inAnyDistrict = (ds, x, z, m = 0) => ds.some((d) => x > d.rect.x0 - m && x < d.rect.x1 + m && z > d.rect.z0 - m && z < d.rect.z1 + m);
function hitsBld(C, x, z) {
  for (const b of C.buildings) if (x > b.x0 - 1 && x < b.x1 + 1 && z > b.z0 - 1 && z < b.z1 + 1) return true;
  return false;
}

export function districtAt(C, x, z) {
  for (const d of C.districts) if (x >= d.rect.x0 && x <= d.rect.x1 && z >= d.rect.z0 && z <= d.rect.z1) return d;
  return null;
}

export function streetNameAt(C, x, z) {
  let best = null, bd = 9;
  for (const l of C.roads.H) {
    if (x < l.x0 - 4 || x > l.x1 + 4) continue;
    const d = Math.abs(z - l.z) - l.w / 2;
    if (d < bd) { bd = d; best = l.name; }
  }
  for (const l of C.roads.V) {
    if (z < l.z0 - 4 || z > l.z1 + 4) continue;
    const d = Math.abs(x - l.x) - l.w / 2;
    if (d < bd) { bd = d; best = l.name; }
  }
  if (!best) {
    for (const p of PLAZAS) { const r = p.rect; if (x > r.x0 && x < r.x1 && z > r.z0 && z < r.z1) return p.name; }
    const dd = districtAt(C, x, z); return dd ? dd.name : 'Napoli';
  }
  return best;
}
