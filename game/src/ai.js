import { clamp, angleDiff } from './util.js';

/** Segue una lista di nodi del grafo stradale con un punto bersaglio "lookahead" (pure pursuit). */
export class PathDriver {
  constructor(graph, rnd, opts = {}) {
    this.g = graph; this.rnd = rnd;
    this.path = []; this.i = 0;
    this.lane = opts.lane ?? 1.8;      // scostamento laterale a destra (m)
    this.look = opts.look ?? 7;
    this.wander = !!opts.wander;
    this.sidewalk = !!opts.sidewalk;
    this.done = false;
    this.speedLimit = 10;
  }

  setPath(nodes) { this.path = nodes ? nodes.slice() : []; this.i = 0; this.done = this.path.length < 2; }

  startWander(node, prev) {
    this.path = [node]; this.i = 0; this.done = false;
    this.extend(prev);
  }

  /** aggiunge un nodo a caso in coda (senza inversione a U se possibile) */
  extend(prevAvoid) {
    const last = this.path[this.path.length - 1];
    const prev = this.path.length > 1 ? this.path[this.path.length - 2] : prevAvoid;
    let opts = last.adj.filter((e) => e.b !== prev);
    if (!opts.length) opts = last.adj;
    if (!opts.length) { this.done = true; return; }
    // preferisci proseguire dritto
    let e = opts[Math.floor(this.rnd() * opts.length)];
    if (prev && this.rnd() < 0.5) {
      const st = opts.find((o) => Math.abs(o.dx * (last.x - prev.x) + o.dz * (last.z - prev.z)) > 0.9 * Math.hypot(last.x - prev.x, last.z - prev.z));
      if (st) e = st;
    }
    this.path.push(e.b);
  }

  laneOffsetFor(e) {
    if (this.sidewalk) { const l = e.line; return (l.w / 2 + (l.sw > 0 ? l.sw * 0.5 : 0.7)) * (this.side || 1); }
    const l = e.line;
    return Math.min(this.lane, l.w / 2 - 0.9);
  }

  /** ritorna {tx,tz,remaining,limit,done} per la posizione (x,z) */
  aim(x, z) {
    const g = this.g;
    if (this.done || this.path.length < 2) return { tx: x, tz: z, remaining: 0, limit: 0, done: true };
    // avanza lungo il percorso
    while (this.i < this.path.length - 1) {
      const a = this.path[this.i], b = this.path[this.i + 1];
      const dx = b.x - a.x, dz = b.z - a.z, len = Math.hypot(dx, dz) || 1;
      const s = ((x - a.x) * dx + (z - a.z) * dz) / len;
      if (s >= len - 2.5) {
        if (this.i + 1 < this.path.length - 1) { this.i++; if (this.wander && this.path.length - this.i < 3) this.extend(); continue; }
        if (this.wander) { this.extend(); if (this.done) break; this.i++; continue; }
        this.done = true; break;
      }
      break;
    }
    if (this.done) return { tx: x, tz: z, remaining: 0, limit: 0, done: true };
    const a = this.path[this.i], b = this.path[this.i + 1];
    const e = g.edgeBetween(a, b);
    const dx = b.x - a.x, dz = b.z - a.z, len = Math.hypot(dx, dz) || 1, ux = dx / len, uz = dz / len;
    let s = ((x - a.x) * ux + (z - a.z) * uz);
    let remainLook = this.look;
    // punto a distanza "look" lungo il percorso
    let seg = this.i, pos = clamp(s, 0, len) + remainLook, segLen = len, sa = a, sb = b, sux = ux, suz = uz, se = e;
    let total = len - clamp(s, 0, len);
    for (let k = this.i + 1; k < this.path.length - 1; k++) total += Math.hypot(this.path[k + 1].x - this.path[k].x, this.path[k + 1].z - this.path[k].z);
    while (pos > segLen && seg < this.path.length - 2) {
      pos -= segLen; seg++;
      sa = this.path[seg]; sb = this.path[seg + 1];
      segLen = Math.hypot(sb.x - sa.x, sb.z - sa.z) || 1; sux = (sb.x - sa.x) / segLen; suz = (sb.z - sa.z) / segLen; se = g.edgeBetween(sa, sb);
    }
    pos = Math.min(pos, segLen);
    const off = se ? this.laneOffsetFor(se) : 0;
    const tx = sa.x + sux * pos - suz * off, tz = sa.z + suz * pos + sux * off;
    // limite di velocità secondo il tipo di strada e la curva successiva
    const kind = e ? e.line.kind : 'street';
    let limit = kind === 'coast' || kind === 'main' ? 15 : kind === 'street' ? 12 : 7.5;
    if (e && (e.line.district === 'vicoli')) limit = 4.5;
    const distEnd = len - s;
    if (this.i + 2 < this.path.length && distEnd < 22) {
      const c = this.path[this.i + 2];
      const turn = Math.abs(ux * ((c.z - b.z) / (Math.hypot(c.x - b.x, c.z - b.z) || 1)) - uz * ((c.x - b.x) / (Math.hypot(c.x - b.x, c.z - b.z) || 1)));
      if (turn > 0.5) limit = Math.min(limit, 3.5 + distEnd * 0.35);
    }
    this.speedLimit = limit;
    return { tx, tz, remaining: total, limit, done: false, edge: e };
  }
}

/** converte (bersaglio) in comandi di guida per un Vehicle fisico */
export function steerTo(v, tx, tz, desiredSpeed, opts = {}) {
  const dx = tx - v.x, dz = tz - v.z;
  const hd = Math.atan2(dx, dz);
  const diff = angleDiff(v.h, hd);
  const steer = -clamp(diff * (opts.k || 1.8), -1, 1);
  const vf = v.vf;
  let throttle = 0, brake = 0;
  const err = desiredSpeed - vf;
  if (err > 0) throttle = clamp(err * 0.6, 0, 1); else brake = clamp(-err * 0.35, 0, 1);
  // curve strette: rallenta
  if (Math.abs(diff) > 0.9 && vf > 6) { throttle = 0; brake = Math.max(brake, 0.35); }
  return { throttle, brake, steer, handbrake: false, diff };
}
