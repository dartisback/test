import * as THREE from 'three';
import { hex2lin } from './util.js';

/** Accumula geometria (con colori vertice) per fonderla in una sola mesh. */
export class Batch {
  constructor() { this.pos = []; this.nor = []; this.uv = []; this.col = []; this.idx = []; this.n = 0; }
  get count() { return this.n; }

  /** quad con 4 vertici in senso antiorario visti da fuori */
  quad(a, b, c, d, nrm, uvs, color) {
    const col = Array.isArray(color) ? color : hex2lin(color);
    const base = this.n;
    for (const p of [a, b, c, d]) { this.pos.push(p[0], p[1], p[2]); this.nor.push(nrm[0], nrm[1], nrm[2]); this.col.push(col[0], col[1], col[2]); }
    for (const u of uvs) this.uv.push(u[0], u[1]);
    this.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
    this.n += 4;
  }
  tri(a, b, c, nrm, uvs, color) {
    const col = Array.isArray(color) ? color : hex2lin(color);
    const base = this.n;
    for (const p of [a, b, c]) { this.pos.push(p[0], p[1], p[2]); this.nor.push(nrm[0], nrm[1], nrm[2]); this.col.push(col[0], col[1], col[2]); }
    for (const u of uvs) this.uv.push(u[0], u[1]);
    this.idx.push(base, base + 1, base + 2);
    this.n += 3;
  }

  /**
   * Box: le facce laterali ricevono UV "a campate" (4 m) e "piani" (3.2 m) se sideUV è definito.
   * opts: { sideUV:{v0:quota piano terra, du:offset campate}, top:bool, bottom:bool, sides:[px,nx,pz,nz] booleani }
   */
  box(x0, x1, y0, y1, z0, z1, color, o = {}) {
    const col = Array.isArray(color) ? color : hex2lin(color);
    const w = x1 - x0, d = z1 - z0;
    const su = o.sideUV;
    const bay = (len) => Math.max(1, Math.round(len / 4));
    const fh = o.floorH || 3.2;
    let vA = 0, vB = 1;
    if (su) { vA = (y0 - su.v0) / fh; vB = (y1 - su.v0) / fh; }
    const du = su ? su.du || 0 : 0;
    const U = (len) => (su ? [du, du + bay(len)] : [0, 1]);
    const sides = o.sides || [true, true, true, true];
    if (sides[0]) { const [u0, u1] = U(d); this.quad([x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [1, 0, 0], [[u0, vA], [u1, vA], [u1, vB], [u0, vB]], col); }
    if (sides[1]) { const [u0, u1] = U(d); this.quad([x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], [-1, 0, 0], [[u0, vA], [u1, vA], [u1, vB], [u0, vB]], col); }
    if (sides[2]) { const [u0, u1] = U(w); this.quad([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], [0, 0, 1], [[u0, vA], [u1, vA], [u1, vB], [u0, vB]], col); }
    if (sides[3]) { const [u0, u1] = U(w); this.quad([x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], [0, 0, -1], [[u0, vA], [u1, vA], [u1, vB], [u0, vB]], col); }
    if (o.top !== false) this.quad([x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0], [0, 1, 0], [[0, 0], [w / 4, 0], [w / 4, d / 4], [0, d / 4]], col);
    if (o.bottom) this.quad([x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], [0, -1, 0], [[0, 0], [1, 0], [1, 1], [0, 1]], col);
  }

  /** tetto a padiglione (piramide tronca) */
  hip(x0, x1, z0, z1, yb, h, color, over = 0.5) {
    const col = hex2lin(color);
    const a = [x0 - over, yb, z0 - over], b = [x1 + over, yb, z0 - over], c = [x1 + over, yb, z1 + over], d = [x0 - over, yb, z1 + over];
    const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
    const rx = Math.min((x1 - x0) / 2 - 0.5, (x1 - x0) / 2 * 0.0 + 0.9), rz = Math.min((z1 - z0) / 2 - 0.5, 0.9);
    const T = [[cx - rx, yb + h, cz - rz], [cx + rx, yb + h, cz - rz], [cx + rx, yb + h, cz + rz], [cx - rx, yb + h, cz + rz]];
    const face = (p0, p1, q1, q0, n) => this.quad(p0, p1, q1, q0, n, [[0, 0], [6, 0], [5, 3], [1, 3]], col);
    const sx = h / ((x1 - x0) / 2 + over), sz = h / ((z1 - z0) / 2 + over);
    face(d, c, T[2], T[3], norm([0, 1, sz]));        // sud
    face(b, a, T[0], T[1], norm([0, 1, -sz]));       // nord
    face(a, d, T[3], T[0], norm([-sx, 1, 0]));       // ovest
    face(c, b, T[1], T[2], norm([sx, 1, 0]));        // est
    this.quad(T[3], T[2], T[1], T[0], [0, 1, 0], [[0, 0], [1, 0], [1, 1], [0, 1]], col);
  }

  /** aggiunge una BufferGeometry già pronta, trasformata con matrix e colorata */
  addGeometry(geo, matrix, color) {
    const col = Array.isArray(color) ? color : hex2lin(color);
    const g = geo.index ? geo : geo.clone();
    const pos = geo.attributes.position, nor = geo.attributes.normal, uv = geo.attributes.uv;
    const v = new THREE.Vector3(), nm = new THREE.Matrix3().getNormalMatrix(matrix);
    const base = this.n;
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).applyMatrix4(matrix); this.pos.push(v.x, v.y, v.z);
      v.fromBufferAttribute(nor, i).applyMatrix3(nm).normalize(); this.nor.push(v.x, v.y, v.z);
      this.uv.push(uv ? uv.getX(i) : 0, uv ? uv.getY(i) : 0);
      this.col.push(col[0], col[1], col[2]);
    }
    if (geo.index) for (let i = 0; i < geo.index.count; i++) this.idx.push(base + geo.index.getX(i));
    else for (let i = 0; i < pos.count; i++) this.idx.push(base + i);
    this.n += pos.count;
  }

  geometry() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    g.setIndex(this.n > 65535 ? new THREE.Uint32BufferAttribute(this.idx, 1) : new THREE.Uint16BufferAttribute(this.idx, 1));
    g.computeBoundingSphere(); g.computeBoundingBox();
    return g;
  }
}

function norm(v) { const l = Math.hypot(v[0], v[1], v[2]); return [v[0] / l, v[1] / l, v[2] / l]; }

/** Raggruppa Batch per chunk spaziale e materiale */
export class ChunkedBatches {
  constructor(size = 256) { this.size = size; this.map = new Map(); }
  get(x, z, mat) {
    const k = `${Math.floor(x / this.size)}|${Math.floor(z / this.size)}|${mat}`;
    let b = this.map.get(k);
    if (!b) { b = new Batch(); b.mat = mat; this.map.set(k, b); }
    return b;
  }
  meshes(materials, opts = {}) {
    const out = [];
    for (const b of this.map.values()) {
      if (!b.n) continue;
      const m = new THREE.Mesh(b.geometry(), materials[b.mat]);
      m.castShadow = opts.cast !== false && !materials[b.mat].userData.noShadow; m.receiveShadow = true;
      m.matrixAutoUpdate = false;
      out.push(m);
    }
    return out;
  }
}
