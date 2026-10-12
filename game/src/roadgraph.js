// Grafo stradale (nodi = incroci, archi = tratti rettilinei): traffico, pedoni, pathfinding.
export class RoadGraph {
  constructor(roads) {
    this.nodes = [];
    this.edges = [];
    const cells = new Map();
    const ck = (i, j) => i * 100003 + j;
    const node = (x, z) => {
      const ci = Math.floor(x / 4), cj = Math.floor(z / 4);
      for (let i = ci - 1; i <= ci + 1; i++) for (let j = cj - 1; j <= cj + 1; j++) {
        const a = cells.get(ck(i, j)); if (!a) continue;
        for (const n of a) if (Math.abs(n.x - x) < 3.6 && Math.abs(n.z - z) < 3.6) return n;
      }
      const n = { id: this.nodes.length, x, z, adj: [] };
      this.nodes.push(n);
      const k = ck(ci, cj); (cells.get(k) || cells.set(k, []).get(k)).push(n);
      return n;
    };
    const T = 0.6;
    const lines = [];
    for (const l of roads.H) lines.push({ ...l, axis: 'x' });
    for (const l of roads.V) lines.push({ ...l, axis: 'z' });

    // incroci
    const hs = roads.H, vs = roads.V;
    const pts = new Map(); // linea -> lista di coordinate
    const push = (line, v, x, z) => { let a = pts.get(line); if (!a) pts.set(line, (a = [])); a.push({ v, x, z }); };
    // indice per V per accelerare
    const vGrid = new Map();
    const CELL = 128;
    vs.forEach((v) => { for (let i = Math.floor((v.x - 8) / CELL); i <= Math.floor((v.x + 8) / CELL); i++) { let a = vGrid.get(i); if (!a) vGrid.set(i, (a = [])); a.push(v); } });
    for (const h of hs) {
      push(h, h.x0, h.x0, h.z); push(h, h.x1, h.x1, h.z);
      const seen = new Set();
      for (let i = Math.floor(h.x0 / CELL); i <= Math.floor(h.x1 / CELL); i++) {
        for (const v of vGrid.get(i) || []) {
          if (seen.has(v)) continue; seen.add(v);
          if (v.x >= h.x0 - T && v.x <= h.x1 + T && h.z >= v.z0 - T && h.z <= v.z1 + T) {
            push(h, v.x, v.x, h.z); push(v, h.z, v.x, h.z);
            (h.cross || (h.cross = [])).push({ c: v.x, w: v.w }); (v.cross || (v.cross = [])).push({ c: h.z, w: h.w });
          }
        }
      }
    }
    for (const v of vs) { push(v, v.z0, v.x, v.z0); push(v, v.z1, v.x, v.z1); }

    const addEdge = (a, b, line, axis) => {
      if (a === b) return;
      const len = Math.hypot(b.x - a.x, b.z - a.z);
      if (len < 3) return;
      const e1 = { a, b, len, line, axis, dx: (b.x - a.x) / len, dz: (b.z - a.z) / len, id: this.edges.length };
      this.edges.push(e1);
      a.adj.push(e1);
      const e2 = { a: b, b: a, len, line, axis, dx: -e1.dx, dz: -e1.dz, id: this.edges.length, rev: e1 };
      e1.rev = e2;
      this.edges.push(e2);
      b.adj.push(e2);
    };
    for (const [line, arr] of pts) {
      arr.sort((p, q) => p.v - q.v);
      let prev = null;
      for (const p of arr) {
        const n = node(p.x, p.z);
        if (prev && prev !== n) addEdge(prev, n, line, line.x !== undefined ? 'z' : 'x');
        prev = n;
      }
    }

    // indice spaziale dei nodi
    this.cell = 96;
    this.grid = new Map();
    for (const n of this.nodes) {
      const k = Math.floor(n.x / this.cell) * 7919 + Math.floor(n.z / this.cell);
      let a = this.grid.get(k); if (!a) this.grid.set(k, (a = [])); a.push(n);
    }
  }

  nearest(x, z, maxD = 400) {
    let best = null, bd = maxD * maxD;
    const c = this.cell, r = Math.ceil(maxD / c);
    const ci = Math.floor(x / c), cj = Math.floor(z / c);
    for (let i = ci - r; i <= ci + r; i++) for (let j = cj - r; j <= cj + r; j++) {
      const a = this.grid.get(i * 7919 + j); if (!a) continue;
      for (const n of a) { const d = (n.x - x) ** 2 + (n.z - z) ** 2; if (d < bd) { bd = d; best = n; } }
    }
    return best;
  }

  /** nodi entro un anello di distanze [rMin, rMax] dal punto */
  nodesInRing(x, z, rMin, rMax, out = []) {
    const c = this.cell, r = Math.ceil(rMax / c);
    const ci = Math.floor(x / c), cj = Math.floor(z / c);
    for (let i = ci - r; i <= ci + r; i++) for (let j = cj - r; j <= cj + r; j++) {
      const a = this.grid.get(i * 7919 + j); if (!a) continue;
      for (const n of a) { const d = Math.hypot(n.x - x, n.z - z); if (d >= rMin && d <= rMax) out.push(n); }
    }
    return out;
  }

  /** A*: ritorna la lista di nodi dal nodo a al nodo b (inclusi) */
  path(a, b, maxIter = 6000) {
    if (!a || !b) return null;
    if (a === b) return [a];
    const open = [a], came = new Map(), g = new Map([[a, 0]]), f = new Map([[a, Math.hypot(a.x - b.x, a.z - b.z)]]);
    const closed = new Set();
    let it = 0;
    while (open.length && it++ < maxIter) {
      let bi = 0;
      for (let i = 1; i < open.length; i++) if (f.get(open[i]) < f.get(open[bi])) bi = i;
      const cur = open.splice(bi, 1)[0];
      if (cur === b) {
        const out = [cur]; let n = cur;
        while (came.has(n)) { n = came.get(n); out.push(n); }
        return out.reverse();
      }
      closed.add(cur);
      for (const e of cur.adj) {
        const nb = e.b;
        if (closed.has(nb)) continue;
        const ng = g.get(cur) + e.len * (e.line.kind === 'local' ? 1.15 : 1);
        if (!g.has(nb) || ng < g.get(nb)) {
          came.set(nb, cur); g.set(nb, ng); f.set(nb, ng + Math.hypot(nb.x - b.x, nb.z - b.z));
          if (!open.includes(nb)) open.push(nb);
        }
      }
    }
    return null;
  }

  edgeBetween(a, b) {
    for (const e of a.adj) if (e.b === b) return e;
    return null;
  }

  /** punto sul lato destro della carreggiata (guida a destra) */
  lanePoint(e, t, offset, out = {}) {
    const x = e.a.x + e.dx * t, z = e.a.z + e.dz * t;
    // destra rispetto alla direzione di marcia (x est, z sud): r = (-dz, dx)
    out.x = x - e.dz * offset; out.z = z + e.dx * offset;
    return out;
  }

  randomEdge(rnd, x, z, rMin, rMax) {
    const ring = this.nodesInRing(x, z, rMin, rMax);
    if (!ring.length) return null;
    const n = ring[Math.floor(rnd() * ring.length)];
    if (!n.adj.length) return null;
    return n.adj[Math.floor(rnd() * n.adj.length)];
  }
}
