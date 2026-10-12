export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const damp = (a, b, k, dt) => lerp(a, b, 1 - Math.exp(-k * dt));
export const TAU = Math.PI * 2;

export function angleDiff(a, b) {
  let d = (b - a) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d < -Math.PI) d += TAU;
  return d;
}
export const dampAngle = (a, b, k, dt) => a + angleDiff(a, b) * (1 - Math.exp(-k * dt));

// PRNG deterministico (mulberry32) -> la città è sempre uguale
export function makeRng(seed) {
  let s = seed >>> 0;
  const next = () => {
    s += 0x6d2b79f5;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  next.range = (a, b) => a + (b - a) * next();
  next.int = (a, b) => Math.floor(a + (b - a + 1) * next());
  next.pick = (arr) => arr[Math.floor(next() * arr.length)];
  return next;
}

/**
 * Griglia spaziale per le collisioni.
 * Ogni collider è un box allineato agli assi: {x0,x1,z0,z1,y0,y1}
 */
export class ColliderGrid {
  constructor(cell = 16) {
    this.cell = cell;
    this.cells = new Map();
    this.all = [];
  }
  _key(ix, iz) { return ix * 73856093 ^ iz * 19349663; }
  add(b) {
    if (b.y0 === undefined) b.y0 = 0;
    if (b.y1 === undefined) b.y1 = 3;
    this.all.push(b);
    const c = this.cell;
    for (let ix = Math.floor(b.x0 / c); ix <= Math.floor(b.x1 / c); ix++) {
      for (let iz = Math.floor(b.z0 / c); iz <= Math.floor(b.z1 / c); iz++) {
        const k = this._key(ix, iz);
        let arr = this.cells.get(k);
        if (!arr) this.cells.set(k, (arr = []));
        arr.push(b);
      }
    }
    return b;
  }
  remove(b) {
    const i = this.all.indexOf(b);
    if (i >= 0) this.all.splice(i, 1);
    const c = this.cell;
    for (let ix = Math.floor(b.x0 / c); ix <= Math.floor(b.x1 / c); ix++) {
      for (let iz = Math.floor(b.z0 / c); iz <= Math.floor(b.z1 / c); iz++) {
        const arr = this.cells.get(this._key(ix, iz));
        if (arr) { const j = arr.indexOf(b); if (j >= 0) arr.splice(j, 1); }
      }
    }
  }
  each(x0, z0, x1, z1, cb) {
    const c = this.cell;
    for (let ix = Math.floor(x0 / c); ix <= Math.floor(x1 / c); ix++) {
      for (let iz = Math.floor(z0 / c); iz <= Math.floor(z1 / c); iz++) {
        const arr = this.cells.get(this._key(ix, iz));
        if (arr) for (let i = 0; i < arr.length; i++) cb(arr[i]);
      }
    }
  }
  /** Spinge il cerchio (pos.x,pos.z,r) fuori dai box. Ritorna {hit,nx,nz} */
  resolveCircle(pos, r, maxY = 1.8) {
    let hit = false, nx = 0, nz = 0;
    this.each(pos.x - r, pos.z - r, pos.x + r, pos.z + r, (b) => {
      if (b.y0 > maxY || b.off) return;
      const cx = clamp(pos.x, b.x0, b.x1);
      const cz = clamp(pos.z, b.z0, b.z1);
      const dx = pos.x - cx, dz = pos.z - cz;
      const d2 = dx * dx + dz * dz;
      if (d2 >= r * r) return;
      if (d2 > 1e-8) {
        const d = Math.sqrt(d2), p = r - d;
        pos.x += (dx / d) * p; pos.z += (dz / d) * p;
        nx += dx / d; nz += dz / d;
      } else {
        const l = pos.x - b.x0, rr = b.x1 - pos.x, t = pos.z - b.z0, bt = b.z1 - pos.z;
        const m = Math.min(l, rr, t, bt);
        if (m === l) { pos.x = b.x0 - r; nx -= 1; }
        else if (m === rr) { pos.x = b.x1 + r; nx += 1; }
        else if (m === t) { pos.z = b.z0 - r; nz -= 1; }
        else { pos.z = b.z1 + r; nz += 1; }
      }
      hit = true;
    });
    return { hit, nx, nz };
  }
  /** true se il punto è dentro un box solido (a quota y) */
  pointBlocked(x, z, y = 0.5) {
    let r = false;
    this.each(x, z, x, z, (b) => {
      if (!b.off && x > b.x0 && x < b.x1 && z > b.z0 && z < b.z1 && y > b.y0 && y < b.y1) r = true;
    });
    return r;
  }
  /** Raycast verso i box. Ritorna la distanza t (0..maxT) del primo impatto o maxT */
  ray(ox, oy, oz, dx, dy, dz, maxT) {
    let best = maxT;
    const ex = ox + dx * maxT, ez = oz + dz * maxT;
    this.each(Math.min(ox, ex) - 0.1, Math.min(oz, ez) - 0.1, Math.max(ox, ex) + 0.1, Math.max(oz, ez) + 0.1, (b) => {
      if (b.off || b.noCam) return;
      let t0 = 0, t1 = best;
      const slab = (o, d, lo, hi) => {
        if (Math.abs(d) < 1e-9) return o >= lo && o <= hi;
        let a = (lo - o) / d, c = (hi - o) / d;
        if (a > c) { const t = a; a = c; c = t; }
        if (a > t0) t0 = a;
        if (c < t1) t1 = c;
        return t0 <= t1;
      };
      if (slab(ox, dx, b.x0, b.x1) && slab(oy, dy, b.y0, b.y1) && slab(oz, dz, b.z0, b.z1)) {
        if (t0 < best) best = t0;
      }
    });
    return best;
  }
}

/** Evita lo z-fighting tra piani sovrapposti (strade, marciapiedi, prati...) */
export function layer(mat, n) {
  mat.polygonOffset = true;
  mat.polygonOffsetFactor = -n;
  mat.polygonOffsetUnits = -n;
  return mat;
}

export const smooth = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));
export const distRect = (x, z, r) => {
  const dx = Math.max(r.x0 - x, 0, x - r.x1), dz = Math.max(r.z0 - z, 0, z - r.z1);
  return Math.hypot(dx, dz);
};
export const hex2rgb = (h) => [((h >> 16) & 255) / 255, ((h >> 8) & 255) / 255, (h & 255) / 255];
const s2l = (c) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
/** colore esadecimale sRGB -> componenti lineari (per i colori vertice) */
export const hex2lin = (h) => hex2rgb(h).map(s2l);
