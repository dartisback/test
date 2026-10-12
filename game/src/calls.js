import * as THREE from 'three';
import { makeRng, clamp, angleDiff } from './util.js';
import { PathDriver, steerTo } from './ai.js';
import { CAR_TYPES, randomPlate } from './vehicle.js';

const rnd = makeRng(Math.floor(Math.random() * 1e9));
const R = Math.random;

// =====================================================================================
// Chiamate della Centrale
// =====================================================================================
const POOL = {
  law: [
    { id: 'scippo', w: 3, title: 'Scippo in corso', short: 'Scippo', reward: 220 },
    { id: 'inseguimento', w: 3, title: 'Inseguimento: auto in fuga', short: 'Inseguimento', reward: 450 },
    { id: 'rapina', w: 2, title: 'Rapina in un negozio', short: 'Rapina', reward: 500 },
    { id: 'controllo', w: 2, title: 'Veicolo sospetto da fermare', short: 'Controllo', reward: 180 },
    { id: 'rissa', w: 2, title: 'Rissa in strada', short: 'Rissa', reward: 260 },
  ],
  croce_rossa: [
    { id: 'malore', w: 3, title: 'Malore in strada', short: 'Malore', reward: 300 },
    { id: 'incidente', w: 3, title: 'Incidente stradale con feriti', short: 'Incidente', reward: 480 },
    { id: 'trasporto', w: 2, title: 'Trasporto urgente in ospedale', short: 'Trasporto', reward: 260 },
  ],
  vvf: [
    { id: 'incendio', w: 3, title: 'Incendio in un appartamento', short: 'Incendio', reward: 500 },
    { id: 'autofiamme', w: 3, title: 'Auto in fiamme', short: 'Auto in fiamme', reward: 320 },
  ],
};

export class Dispatcher {
  constructor(game) { this.g = game; this.reset(); }
  reset() {
    this.active = null; this.offer = null; this.timer = 20; this.running = false;
    this.done = 0; this.failed = 0; this.arrests = 0;
  }
  start() { this.running = true; this.timer = 12; }

  pool() { const f = this.g.faction; return f.law ? POOL.law : POOL[f.id]; }

  makeCall(def) {
    const C = { scippo: Scippo, inseguimento: Inseguimento, rapina: Rapina, controllo: Controllo, rissa: Rissa, malore: Malore, incidente: Incidente, trasporto: Trasporto, incendio: Incendio, autofiamme: AutoFiamme }[def.id];
    return new C(this.g, def);
  }

  offerNew(forceId) {
    const pool = this.pool();
    let def;
    if (forceId) def = pool.find((p) => p.id === forceId) || pool[0];
    else { const tot = pool.reduce((s, p) => s + p.w, 0); let r = R() * tot; def = pool.find((p) => (r -= p.w) < 0) || pool[0]; }
    const call = this.makeCall(def);
    if (!call.prepare()) return false;
    this.offer = { call, t: 18 };
    this.g.radio(`📻 Centrale: ${call.def.title} — ${call.address}. [Y] Accetta  [N] Rifiuta`);
    this.g.audio.ui('ok');
    return true;
  }

  accept() {
    if (!this.offer) return;
    const call = this.offer.call; this.offer = null;
    this.active = call; call.start();
    this.g.radio(`📻 Ricevuto. ${call.def.short} in corso, vai sul posto.`);
  }
  decline() { if (this.offer) { this.offer.call.cleanup(); this.offer = null; this.timer = 25; this.g.toast('Chiamata rifiutata.', ''); } }

  finish(call, ok, msg) {
    if (this.active !== call) return;
    call.finished = true; call.cleanup();
    if (ok) { this.done++; this.g.addScore(call.def.reward + (call.bonus || 0), call.def.short); this.g.toast(`✔ ${call.def.short} risolto: +${call.def.reward + (call.bonus || 0)} punti. ${msg || ''}`, 'ok'); this.g.audio.ui('ok'); }
    else { this.failed++; this.g.addScore(-60, 'Fallita'); this.g.toast(`✘ ${call.def.short} fallito. ${msg || ''}`, 'err'); this.g.audio.ui('err'); }
    this.active = null; this.timer = 20 + R() * 25;
  }

  update(dt, a) {
    if (!this.running) return;
    if (this.offer) {
      this.offer.t -= dt;
      if (this.g.input.hit('KeyY')) this.accept();
      else if (this.g.input.hit('KeyN') || this.offer.t <= 0) this.decline();
    } else if (!this.active) {
      this.timer -= dt;
      if (this.timer <= 0) { this.timer = 8; this.offerNew(); }
    }
    const act = this.active;
    if (act) {
      act.age += dt;
      act.update(dt, a);
      if (!act.finished && act.timeLimit && act.age > act.timeLimit) this.finish(act, false, 'Tempo scaduto.');
    }
  }

  objective() {
    if (this.active) return this.active.objective();
    if (this.offer) return { title: 'Chiamata in arrivo', sub: `${this.offer.call.def.title}: premi Y per accettare, N per rifiutare (${Math.ceil(this.offer.t)}s).` };
    return { title: 'Pattuglia libera', sub: 'Guida per Napoli e attendi la prossima chiamata. R = radio.' };
  }
  blips() { return this.active ? this.active.blips() : []; }
}

// =====================================================================================
// base
// =====================================================================================
class Call {
  constructor(g, def) { this.g = g; this.def = def; this.age = 0; this.finished = false; this.timeLimit = 600; this.address = ''; this.phase = 'go'; this.actors = []; this.vehicles = []; this.bonus = 0; }
  pickSpot(rMin = 260, rMax = 720) {
    const g = this.g, p = g.player;
    const px = p.vehicle ? p.vehicle.x : p.pos.x, pz = p.vehicle ? p.vehicle.z : p.pos.z;
    for (let k = 0; k < 12; k++) {
      const s = g.world.sidewalkSpot(rnd, px, pz, rMin, rMax);
      if (!s) continue;
      if (g.world.district(s.x, s.z) == null) continue;
      if (Object.values(g.world.hqs).some((h) => h.inside(s.x, s.z) || Math.hypot(h.door.x - s.x, h.door.z - s.z) < 90)) continue;
      return s;
    }
    return null;
  }
  setAddress(s) { this.address = this.g.world.streetName(s.x, s.z); }
  prepare() { return true; }
  start() {}
  update() {}
  objective() { return { title: this.def.title, sub: '' }; }
  blips() { return []; }
  cleanup() {
    for (const a of this.actors) { if (a.cleanupLater) continue; }
    // gli attori e i mezzi sopravvivono un po' (si dissolvono quando lontani)
    this.g.scheduleCleanup(this.actors, this.vehicles);
  }
  playerPos() { const p = this.g.player; return p.vehicle ? { x: p.vehicle.x, z: p.vehicle.z } : { x: p.pos.x, z: p.pos.z }; }
  distTo(x, z) { const p = this.playerPos(); return Math.hypot(p.x - x, p.z - z); }
  fail(msg) { this.g.dispatcher.finish(this, false, msg); }
  win(msg) { this.g.dispatcher.finish(this, true, msg); }
}

// ---- mini sistema d'arresto per chiamate delle forze dell'ordine ----------------------
class ArrestMixin extends Call {
  suspects() { return this.actors.filter((a) => a.role === 'suspect' && !a.delivered); }
  /** gestisce prompt/azioni; ritorna true se ha mostrato un prompt */
  arrestPrompts(a) {
    const g = this.g, p = g.player; if (p.vehicle) return this.vehiclePrompts(a);
    const s = g.actors.nearest(p.pos.x, p.pos.z, 2.6, (x) => x.role === 'suspect' && !x.delivered && x.state !== 'seated');
    if (!s) return false;
    const d = Math.hypot(s.pos.x - p.pos.x, s.pos.z - p.pos.z);
    if (s.state === 'surrender' || s.state === 'down') { g.ui.setCallPrompt({ key: 'E', text: 'Ammanetta il sospetto' }); if (a.interact) { s.cuff(); p.escort = null; g.toast('Sospetto ammanettato.', 'ok'); g.audio.ui('ok'); } return true; }
    if (s.state === 'flee' && d < 2.3) { g.ui.setCallPrompt({ key: 'E', text: 'Blocca il fuggitivo' }); if (a.interact) { if (R() < 0.72) { s.stun(4.5); s.stunRecover = 'surrender'; g.toast('Placcato!', 'ok'); } else { g.toast('Il sospetto si divincola!', 'err'); s.stamina += 4; } } return true; }
    if (s.state === 'cuffed' && g.nearestPlayerVehicle(5)) { g.ui.setCallPrompt({ key: 'E', text: 'Metti il sospetto in auto' }); if (a.interact) this.loadSuspect(s, g.nearestPlayerVehicle(5)); return true; }
    return false;
  }
  vehiclePrompts() { return false; }
  loadSuspect(s, v) {
    if (v.passengers && v.passengers.length >= 2) { this.g.toast('Auto piena.', 'err'); return; }
    s.cuffed = true; s.enterVehicle(v, { x: -0.45, y: 0, z: -0.95 });
    this.g.toast('Sospetto in auto. Portalo in sede.', 'ok');
  }
  /** consegna: veicolo del giocatore dentro il piazzale/ingresso con sospetti a bordo */
  checkDelivery() {
    const g = this.g, p = g.player, hq = g.hq;
    const v = p.vehicle; if (!v) return;
    const nearHQ = (v.x > hq.yard.x0 - 4 && v.x < hq.yard.x1 && v.z > hq.yard.z0 && v.z < hq.yard.z1 + 14) || Math.hypot(v.x - hq.door.x, v.z - hq.door.z) < 22;
    if (!nearHQ) return;
    const list = (v.passengers || []).filter((x) => x.role === 'suspect');
    if (!list.length) return;
    for (const s of list) { s.delivered = true; s.leaveVehicle({ x: hq.gate.x, z: hq.gate.z + 4 }); g.actors.remove(s); this.g.dispatcher.arrests++; }
    g.toast(`Consegnati ${list.length} sospetti.`, 'ok');
  }
  allDelivered() { return this.actors.filter((x) => x.role === 'suspect').every((x) => x.delivered); }
  suspectBlips() {
    const out = [];
    for (const s of this.suspects()) { if (s.vehicle) continue; out.push({ x: s.pos.x, z: s.pos.z, label: s.state === 'cuffed' ? 'Ammanettato' : 'Sospetto', color: '#ff4d4d' }); }
    return out;
  }
  onShout(p) {
    const g = this.g;
    let any = false;
    for (const s of this.suspects()) {
      if (s.state !== 'flee' && s.state !== 'idle' && s.state !== 'fight') continue;
      const d = Math.hypot(s.pos.x - p.pos.x, s.pos.z - p.pos.z);
      if (d > 28) continue;
      any = true;
      const ch = d < 12 && p.aiming ? 0.88 : d < 20 ? 0.6 : 0.4;
      if (R() < ch) { s.surrender(); g.toast('«Mani in alto!» — il sospetto si arrende.', 'ok'); }
    }
    return any;
  }
  onShot(shot) {
    for (const s of this.suspects()) {
      if (s.vehicle || s.state === 'cuffed' || s.state === 'down') continue;
      const A = shot.from, B = shot.to;
      const ab = B.clone().sub(A), len = ab.length() || 1;
      const t = clamp(((s.pos.x - A.x) * ab.x + ((s.pos.y + 1.1) - A.y) * ab.y + (s.pos.z - A.z) * ab.z) / (len * len), 0, 1);
      const q = A.clone().addScaledVector(ab, t);
      const d = Math.hypot(q.x - s.pos.x, q.z - s.pos.z), dy = Math.abs(q.y - (s.pos.y + 1.0));
      if (d < 0.65 && dy < 1.1) {
        if (shot.taser) { s.stun(7); s.stunRecover = 'surrender'; this.g.toast('Taser a segno!', 'ok'); }
        else { s.stun(10); s.stunRecover = 'surrender'; this.g.addScore(-30, 'Uso della forza'); this.g.toast('Sospetto ferito (uso della forza: -30)', 'err'); }
      }
    }
  }
  onMelee(p) {
    for (const s of this.suspects()) {
      const dx = s.pos.x - p.pos.x, dz = s.pos.z - p.pos.z, d = Math.hypot(dx, dz);
      if (d < 2.4 && s.state !== 'cuffed' && s.state !== 'down') { s.stun(5); s.stunRecover = 'surrender'; this.g.toast('Sospetto colpito col manganello.', 'ok'); }
    }
  }
}

// =====================================================================================
// SCIPPO / RAPINA (sospetti a piedi)
// =====================================================================================
class Scippo extends ArrestMixin {
  prepare() { this.spot = this.pickSpot(); if (!this.spot) return false; this.setAddress(this.spot); this.n = 1; return true; }
  start() {
    const g = this.g, s = this.spot;
    this.victim = g.actors.spawn({ role: 'victim', x: s.x, z: s.z, female: true, state: 'idle' });
    this.actors.push(this.victim);
    for (let i = 0; i < this.n; i++) {
      const a = g.actors.spawn({ role: 'suspect', x: s.x + 1.6 + i * 1.2, z: s.z + 0.8, state: 'idle', armed: this.n > 1, wanted: true, shirt: 0x15151a, pants: 0x1c1c22 });
      this.actors.push(a);
    }
  }
  objective() {
    const left = this.suspects().length;
    if (this.phase === 'go') return { title: `${this.def.title}`, sub: `Raggiungi ${this.address}. Il sospetto è nei dintorni (segnale giallo).` };
    if (this.suspects().some((s) => s.state === 'cuffed' || s.vehicle)) return { title: 'Porta i sospetti in sede', sub: `Metti i sospettati in auto (E) e guida fino a ${this.g.faction.hq}.` };
    return { title: left > 1 ? `Ferma i ${left} sospetti` : 'Ferma il sospetto', sub: 'Inseguilo, grida «Fermo!» (X), usa il taser (2) o placcalo (E).' };
  }
  blips() {
    if (this.phase === 'go') return [{ x: this.spot.x, z: this.spot.z, label: 'Scena' }];
    const b = this.suspectBlips();
    if (!b.length && this.suspects().length === 0) return [];
    const hq = this.g.hq;
    if (this.suspects().some((s) => s.vehicle)) b.push({ x: hq.gate.x, z: hq.gate.z + 4, label: 'Consegna', color: '#6fa8ff' });
    return b;
  }
  update(dt, a) {
    const g = this.g;
    if (this.phase === 'go') {
      if (this.distTo(this.spot.x, this.spot.z) < 55) {
        this.phase = 'chase';
        const pp = this.playerPos();
        for (const s of this.suspects()) s.flee(pp.x, pp.z, true);
        this.victim.stun(2); g.radio('📻 «Al ladro!» Il sospetto scappa a piedi!');
      }
    } else {
      if (this.arrestPrompts(a) === false) { /* nessun prompt */ }
      this.checkDelivery();
      if (this.allDelivered()) return this.win('Arresto riuscito.');
      // persa la traccia
      const left = this.suspects().filter((s) => !s.vehicle && s.state === 'flee');
      this.lost = left.length && left.every((s) => this.distTo(s.pos.x, s.pos.z) > 380) ? (this.lost || 0) + dt : 0;
      if (this.lost > 18) this.fail('Il sospetto è sparito.');
    }
  }
}
class Rapina extends Scippo {
  prepare() { this.timeLimit = 720; const r = super.prepare(); this.n = 2; return r; }
}

// =====================================================================================
// RISSA
// =====================================================================================
class Rissa extends ArrestMixin {
  prepare() { this.spot = this.pickSpot(); if (!this.spot) return false; this.setAddress(this.spot); return true; }
  start() {
    const s = this.spot, g = this.g;
    for (let i = 0; i < 3; i++) {
      const a = g.actors.spawn({ role: 'suspect', x: s.x + Math.cos(i * 2.1) * 1.1, z: s.z + Math.sin(i * 2.1) * 1.1, rot: i * 2.1 + Math.PI, state: 'fight', wanted: true });
      this.actors.push(a);
    }
  }
  objective() {
    if (this.phase === 'go') return { title: this.def.title, sub: `Raggiungi ${this.address}.` };
    if (this.suspects().some((s) => s.state === 'cuffed' || s.vehicle)) return { title: 'Porta il fermato in sede', sub: 'Mettilo in auto (E) e consegnalo.' };
    return { title: 'Interrompi la rissa', sub: 'Grida «Fermo!» (X) o avvicinati con il taser, poi ammanetta chi si arrende.' };
  }
  blips() { return this.phase === 'go' ? [{ x: this.spot.x, z: this.spot.z, label: 'Rissa' }] : this.suspectBlips(); }
  update(dt, a) {
    const g = this.g;
    if (this.phase === 'go') { if (this.distTo(this.spot.x, this.spot.z) < 40) { this.phase = 'brawl'; g.radio('📻 Stanno ancora litigando!'); } return; }
    if (this.phase === 'brawl') {
      const near = this.distTo(this.spot.x, this.spot.z) < 6;
      this.calm = near ? (this.calm || 0) + dt : this.calm || 0;
      if (this.calm > 3 || this.suspects().some((s) => s.state === 'surrender' || s.state === 'down')) this.disperse();
    }
    if (this.phase === 'after') {
      this.arrestPrompts(a); this.checkDelivery();
      if (this.suspects().every((s) => s.state === 'cuffed' || s.delivered || s.vehicle || s.fled)) {
        if (this.actors.some((x) => x.delivered)) return this.win('Rissa sedata e fermato consegnato.');
      }
    }
  }
  disperse() {
    this.phase = 'after';
    const list = this.suspects();
    const pp = this.playerPos();
    list.forEach((s, i) => { if (s.state === 'surrender' || s.state === 'down') return; if (i === 0) s.surrender(); else { s.flee(pp.x, pp.z, true); s.fled = true; s.role = 'bystander'; } });
    this.g.radio('📻 Gli animi si calmano: fermane almeno uno.');
  }
  onShout(p) { if (this.phase === 'brawl' && this.distTo(this.spot.x, this.spot.z) < 22) { this.disperse(); return true; } return super.onShout(p); }
}

// =====================================================================================
// INSEGUIMENTO (auto in fuga)
// =====================================================================================
class Inseguimento extends ArrestMixin {
  prepare() {
    this.spot = this.pickSpot(300, 800);
    if (!this.spot) return false; this.setAddress(this.spot); this.timeLimit = 720; return true;
  }
  start() {
    const g = this.g, w = g.world, s = this.spot;
    const e = s.edge; const rs = w.roadSpot(e, s.t, 1.8);
    const v = g.spawnVehicle(R() < 0.5 ? 'civ_sedan' : 'civ_hatch', rs.x, rs.z, rs.h, { color: [0x2b2b30, 0xb5342a, 0x2c4f8f, 0xe9e9e6][(R() * 4) | 0], plate: randomPlate(R), tag: 'suspect' });
    v.locked = true; v.type = { ...v.type, emergency: false }; v.maxHealth = 100;
    this.car = v; this.vehicles.push(v);
    const drv = g.actors.spawn({ role: 'suspect', x: rs.x, z: rs.z, wanted: true, state: 'idle', shirt: 0x15151a });
    drv.enterVehicle(v, { x: 0.45, y: 0, z: -0.2 }); drv.hiddenInCar = false; v.driverActor = drv; this.actors.push(drv); this.driverA = drv;
    this.pressure = 0; this.fleeing = false; this.stopped = false; this.far = 0;
    this.path = new PathDriver(w.graph, R, { lane: 0, look: 10 });
    v.controller = (dt, car) => this.drive(dt, car);
    this.plate = v.type.plate;
  }
  objective() {
    if (this.phase === 'go') return { title: 'Auto sospetta in fuga', sub: `Raggiungi ${this.address} (targa ${this.plate}).` };
    if (!this.stopped) return { title: 'Inseguimento!', sub: `Resta dietro l'auto con la sirena (Q) fino a farla fermare, o speronala. Pressione ${Math.round(Math.min(100, this.pressure / 8 * 100))}%. R = chiama rinforzi.` };
    if (this.suspects().some((s) => s.state === 'cuffed' || s.vehicle)) return { title: 'Porta il sospetto in sede', sub: 'Mettilo in auto (E) e guida fino alla sede.' };
    return { title: 'Ferma il guidatore', sub: 'Ammanettalo (E), grida «Fermo!» (X) o usa il taser.' };
  }
  blips() {
    if (this.phase === 'go') return [{ x: this.car.x, z: this.car.z, label: 'Auto sospetta', color: '#ff4d4d' }];
    if (!this.driverA.vehicle) { const b = this.suspectBlips(); const hq = this.g.hq; if (this.suspects().some((s) => s.vehicle)) b.push({ x: hq.gate.x, z: hq.gate.z + 4, label: 'Consegna', color: '#6fa8ff' }); return b; }
    return [{ x: this.car.x, z: this.car.z, label: 'Sospetto', color: '#ff4d4d' }];
  }
  drive(dt, car) {
    if (!this.fleeing || car.disabled) return null;
    if (this.stopped) return { throttle: 0, brake: 1, steer: 0, handbrake: car.speed > 3 };
    const w = this.g.world, pp = this.playerPos();
    if (this.path.done || this.path.path.length < 2) {
      const here = w.graph.nearest(car.x, car.z, 200), ring = w.graph.nodesInRing(pp.x, pp.z, 300, 900);
      let best = null, bd = -1; for (let i = 0; i < 6 && ring.length; i++) { const n = ring[(R() * ring.length) | 0]; const d = Math.hypot(n.x - car.x, n.z - car.z); if (d > bd) { bd = d; best = n; } }
      this.path.setPath(w.graph.path(here, best || here));
    }
    const a = this.path.aim(car.x, car.z);
    // evita di restare fermo contro un muro
    car.stuck = (car.speed < 1.2 ? (car.stuck || 0) + dt : 0);
    if (car.stuck > 1.6) { car.rev = 1.1; car.stuck = 0; }
    if (car.rev > 0) { car.rev -= dt; return { throttle: 0, brake: 1, steer: (R() < 0.5 ? -1 : 1) * 0.6, handbrake: false }; }
    const lim = Math.min(a.limit * 1.9, 27);
    return steerTo(car, a.tx, a.tz, a.done ? 0 : lim);
  }
  update(dt, a) {
    const g = this.g, car = this.car, p = g.player;
    if (this.phase === 'go') {
      if (this.distTo(car.x, car.z) < 75) { this.phase = 'chase'; this.fleeing = true; g.radio('📻 L\'auto ha visto la pattuglia ed è partita a tutta velocità!'); }
      return;
    }
    if (!this.stopped) {
      // pressione: veicolo di soccorso con sirena dietro l'auto
      let pr = false;
      for (const v of g.vehicles) {
        if (v === car || !v.siren || !v.type.emergency || v.type.faction === 'croce_rossa') continue;
        const dx = car.x - v.x, dz = car.z - v.z, d = Math.hypot(dx, dz);
        const behind = dx * Math.sin(car.h) + dz * Math.cos(car.h) > 0;
        if (d < 22 && behind && v.speed > 4) pr = true;
        if (v.hitBy === undefined && car.hitBy === v) { car.health = Math.max(0, car.health - 12); car.hitBy = null; }
      }
      this.pressure = clamp(this.pressure + (pr ? dt : -dt * 0.5), 0, 12);
      if (car.hitBy) { car.health = Math.max(0, car.health - 10); car.hitBy = null; }
      if (car.health <= 28 || this.pressure >= 8 || car.disabled) this.stopChase();
      const d = this.distTo(car.x, car.z);
      this.far = d > 420 ? this.far + dt : 0;
      if (this.far > 16) return this.fail('Hai perso l\'auto.');
      if (car.disabled) g.fx.smoke(car.x, car.y + 1, car.z);
    } else {
      this.arrestPrompts(a); this.checkDelivery();
      if (car.disabled || car.health < 28) g.fx.smoke(car.x, car.y + 1.2, car.z, 0.8);
      if (this.allDelivered()) this.win('Autista arrestato.');
    }
  }
  stopChase() {
    this.stopped = true; this.car.controller = null; this.car.disabled = this.car.health <= 28;
    this.car.handbrake = true;
    const d = this.driverA, v = this.car;
    const pos = v.findExit();
    d.leaveVehicle(pos);
    if (R() < 0.45) { const pp = this.playerPos(); d.flee(pp.x, pp.z, true); this.g.radio('📻 L\'autista scende e scappa a piedi!'); }
    else { d.surrender(); this.g.radio('📻 L\'auto si ferma: il sospetto si arrende.'); }
    this.g.toast('Auto fermata!', 'ok');
  }
  onShout(p) {
    if (this.phase === 'chase' && !this.stopped) { this.pressure = Math.min(12, this.pressure + 1.5); return true; }
    return super.onShout(p);
  }
}

// =====================================================================================
// CONTROLLO (veicolo sospetto)
// =====================================================================================
class Controllo extends ArrestMixin {
  prepare() { this.spot = this.pickSpot(220, 600); if (!this.spot) return false; this.setAddress(this.spot); this.timeLimit = 420; return true; }
  start() {
    const g = this.g, w = g.world, s = this.spot, rs = w.roadSpot(s.edge, s.t, 1.8);
    const v = g.spawnVehicle(R() < 0.5 ? 'civ_sedan' : 'civ_hatch', rs.x, rs.z, rs.h, { color: [0xc9c9c6, 0x8a8f96, 0x4d6b4a, 0xd9c9a0][(R() * 4) | 0], plate: randomPlate(R), tag: 'check' });
    v.locked = true; this.car = v; this.vehicles.push(v);
    this.plate = v.type.plate;
    const d = g.actors.spawn({ role: 'driver', x: rs.x, z: rs.z, state: 'idle' }); d.enterVehicle(v, { x: 0.45, y: 0, z: -0.2 }); this.driverA = d; this.actors.push(d);
    this.path = new PathDriver(w.graph, R, { lane: 1.8, look: 9, wander: true });
    const here = w.graph.nearest(rs.x, rs.z, 100); this.path.startWander(here, null);
    v.controller = (dt, car) => {
      if (this.phase === 'stopped') return { throttle: 0, brake: 1, steer: 0, handbrake: car.speed > 3 };
      const a = this.path.aim(car.x, car.z); return steerTo(car, a.tx, a.tz, Math.min(a.limit * 0.9, 12));
    };
    this.pressure = 0; this.wanted = R() < 0.4;
  }
  objective() {
    if (this.phase === 'go') return { title: 'Veicolo sospetto', sub: `Raggiungi ${this.address} e individua l'auto targata ${this.plate}.` };
    if (this.phase === 'chase') return { title: 'Fai accostare il veicolo', sub: `Resta dietro l'auto con la sirena (Q): ${Math.round(Math.min(100, this.pressure / 4.5 * 100))}%` };
    if (this.phase === 'stopped') return { title: 'Controlla il conducente', sub: 'Avvicinati alla portiera (lato guida) e premi E.' };
    return { title: 'Sospetto da arrestare', sub: 'Ammanettalo e portalo in sede.' };
  }
  blips() {
    if (this.phase === 'stopped' || this.phase === 'go' || this.phase === 'chase') return [{ x: this.car.x, z: this.car.z, label: this.plate, color: '#ffd24a' }];
    return this.suspectBlips();
  }
  update(dt, a) {
    const g = this.g, car = this.car;
    if (this.phase === 'go') { if (this.distTo(car.x, car.z) < 90) this.phase = 'chase'; return; }
    if (this.phase === 'chase') {
      let pr = false;
      for (const v of g.vehicles) { if (v === car || !v.siren || !v.type.emergency) continue; const dx = car.x - v.x, dz = car.z - v.z, d = Math.hypot(dx, dz); if (d < 20 && dx * Math.sin(car.h) + dz * Math.cos(car.h) > 0) pr = true; }
      this.pressure = clamp(this.pressure + (pr ? dt : -dt * 0.4), 0, 6);
      if (this.pressure >= 4.5) { this.phase = 'stopped'; g.radio('📻 Il veicolo accosta.'); }
      if (this.distTo(car.x, car.z) > 500) this.fail('Veicolo perso.');
      return;
    }
    if (this.phase === 'stopped') {
      const p = g.player;
      if (!p.vehicle) {
        const door = car.driverDoor();
        const d = Math.hypot(p.pos.x - door.x, p.pos.z - door.z);
        if (d < 3.0) {
          g.ui.setCallPrompt({ key: 'E', text: 'Controlla documenti e conducente' });
          if (a.interact) {
            if (!this.wanted) { this.win('Documenti in regola, nessuna irregolarità.'); }
            else {
              const d2 = this.driverA; d2.leaveVehicle(); d2.wanted = true; d2.role = 'suspect';
              if (R() < 0.5) { const pp = this.playerPos(); d2.flee(pp.x, pp.z, true); g.radio('📻 Era ricercato! Scappa a piedi!'); } else { d2.surrender(); g.toast('Il conducente è ricercato: si arrende.', 'ok'); }
              this.phase = 'arrest'; this.timeLimit = 900;
            }
          }
        }
      }
      return;
    }
    if (this.phase === 'arrest') { this.arrestPrompts(a); this.checkDelivery(); if (this.allDelivered()) this.win('Ricercato arrestato.'); }
  }
  onShout(p) { if (this.phase === 'chase') { this.pressure = Math.min(6, this.pressure + 1); return true; } return super.onShout(p); }
}

// =====================================================================================
// CROCE ROSSA
// =====================================================================================
class Medical extends Call {
  hospital() {
    const hs = this.g.world.hospitals, p = this.playerPos();
    return hs.slice().sort((a, b) => Math.hypot(a.x - p.x, a.z - p.z) - Math.hypot(b.x - p.x, b.z - p.z))[0];
  }
  patients() { return this.actors.filter((a) => a.role === 'patient' && !a.delivered); }
  /** interazioni con i pazienti (soccorso con E tenuto premuto, carico in ambulanza) */
  patientPrompts(a, dt) {
    const g = this.g, p = g.player;
    if (p.vehicle) return;
    const pt = g.actors.nearest(p.pos.x, p.pos.z, 2.8, (x) => x.role === 'patient' && !x.delivered && !x.vehicle);
    if (!pt) return;
    if (pt.treat < 100) {
      g.ui.setCallPrompt({ key: 'E', text: `Soccorri (tieni premuto) ${Math.round(pt.treat)}%` });
      if (g.input.down('KeyE')) { pt.treat = Math.min(100, pt.treat + dt * 32); p.char.group.rotation.y = p.rot; if (pt.treat >= 100) { pt.hp = Math.max(pt.hp, 60); g.toast('Paziente stabilizzato.', 'ok'); } }
    } else if (!pt.carried) {
      const amb = g.nearestPlayerVehicle(8, 'ambulanza');
      if (amb) { g.ui.setCallPrompt({ key: 'E', text: 'Carica il paziente in ambulanza' }); if (a.interact) { if ((amb.passengers || []).length >= 2) g.toast('Ambulanza piena.', 'err'); else { pt.setLying(false); pt.enterVehicle(amb, { x: -0.4, y: 0.5, z: -1.4 }); amb.hiddenPassengers = true; pt.char.group.visible = false; g.toast('Paziente a bordo.', 'ok'); } } }
      else g.ui.setCallPrompt({ key: '', text: 'Avvicina l\'ambulanza per caricare il paziente', deny: false });
    }
  }
  hospitalDelivery() {
    const g = this.g, v = g.player.vehicle; if (!v || v.type.id !== 'ambulanza') return;
    const h = this.hospital();
    if (Math.hypot(v.x - h.x, v.z - h.z) < 18 && v.speed < 6) {
      const list = (v.passengers || []).filter((x) => x.role === 'patient');
      if (!list.length) return;
      for (const pt of list) { pt.delivered = true; pt.char.group.visible = true; pt.leaveVehicle({ x: h.x + 3, z: h.z + 3 }); g.actors.remove(pt); }
      v.hiddenPassengers = false;
      g.toast(`${list.length} paziente/i consegnato/i al ${h.name}.`, 'ok');
    }
  }
  decay(dt) { for (const pt of this.patients()) { if (pt.treat < 100) { pt.hp -= dt * (pt.critical ? 0.28 : 0.1); } } }
  objectiveCommon(first) {
    const left = this.patients();
    const loaded = left.filter((x) => x.vehicle).length;
    if (this.phase === 'go') return { title: this.def.title, sub: `Raggiungi ${this.address} con l'ambulanza (sirena Q).` };
    if (left.some((x) => x.treat < 100)) return { title: 'Soccorri i pazienti', sub: 'Avvicinati e tieni premuto E per le cure.' };
    if (left.length > loaded) return { title: 'Carica i pazienti', sub: 'Porta l\'ambulanza vicino al paziente e premi E.' };
    return { title: `Porta in ospedale (${this.hospital().name})`, sub: 'Guida fino al Pronto Soccorso (segnale blu).' };
  }
  blipsCommon() {
    const out = [];
    if (this.phase === 'go') { out.push({ x: this.spot.x, z: this.spot.z, label: 'Emergenza', color: '#ff4d4d' }); return out; }
    for (const pt of this.patients()) if (!pt.vehicle) out.push({ x: pt.pos.x, z: pt.pos.z, label: pt.critical ? 'Critico' : 'Paziente', color: '#ff4d4d' });
    if (this.patients().some((x) => x.vehicle || x.treat >= 100)) { const h = this.hospital(); out.push({ x: h.x, z: h.z, label: 'Ospedale', color: '#6fa8ff' }); }
    return out;
  }
  check() {
    if (this.patients().some((x) => x.hp <= 0)) return this.fail('Un paziente non ce l\'ha fatta.');
    if (this.patients().length === 0 && this.actors.some((x) => x.delivered)) this.win('Pazienti in salvo!');
  }
}

class Malore extends Medical {
  prepare() { this.spot = this.pickSpot(); if (!this.spot) return false; this.setAddress(this.spot); this.timeLimit = 480; return true; }
  start() {
    const s = this.spot, g = this.g;
    const pt = g.actors.spawn({ role: 'patient', x: s.x, z: s.z, state: 'patient', female: R() < 0.5 }); pt.setLying(true); pt.hp = 100; pt.treat = 0; this.actors.push(pt);
    for (let i = 0; i < 2; i++) { const b = g.actors.spawn({ role: 'bystander', x: s.x + 1.5 + i, z: s.z + 1.2, state: 'idle' }); this.actors.push(b); }
  }
  objective() { return this.objectiveCommon(); }
  blips() { return this.blipsCommon(); }
  update(dt, a) {
    if (this.phase === 'go' && this.distTo(this.spot.x, this.spot.z) < 45) { this.phase = 'treat'; this.g.radio('📻 Il paziente è a terra, cosciente a tratti.'); }
    this.decay(dt); if (this.phase !== 'go') { this.patientPrompts(a, dt); this.hospitalDelivery(); }
    this.check();
  }
}
class Trasporto extends Malore {
  start() {
    const s = this.spot, g = this.g;
    const pt = g.actors.spawn({ role: 'patient', x: s.x, z: s.z, state: 'idle' }); pt.treat = 100; pt.hp = 100; this.actors.push(pt);
    const rel = g.actors.spawn({ role: 'bystander', x: s.x + 1, z: s.z + 1, state: 'idle', female: true }); this.actors.push(rel);
  }
  decay() {}
}
class Incidente extends Medical {
  prepare() { this.spot = this.pickSpot(); if (!this.spot) return false; this.setAddress(this.spot); this.timeLimit = 600; return true; }
  start() {
    const g = this.g, w = g.world, s = this.spot, e = s.edge;
    const rs = w.roadSpot(e, s.t, 0.5);
    for (let i = 0; i < 2; i++) {
      const v = g.spawnVehicle(i ? 'civ_hatch' : 'civ_sedan', rs.x + (i ? 2.5 : 0), rs.z + (i ? 3.8 : 0), rs.h + (i ? 0.9 : -0.2), { color: i ? 0xb5342a : 0x2c4f8f, tag: 'crash' });
      v.locked = true; v.disabled = true; v.type = { ...v.type, emergency: false }; v.health = 0; this.vehicles.push(v);
      g.fx.smoke(v.x, v.y + 1, v.z, 1.2);
    }
    for (let i = 0; i < 2; i++) {
      const pt = g.actors.spawn({ role: 'patient', x: rs.x + 2 + i * 1.3, z: rs.z - 3 + i, state: 'patient', female: i === 1 }); pt.setLying(true); pt.critical = i === 0; pt.hp = i === 0 ? 70 : 100; pt.treat = 0; this.actors.push(pt);
    }
    this.crashPos = rs;
  }
  objective() { return this.objectiveCommon(); }
  blips() { return this.blipsCommon(); }
  update(dt, a) {
    if (this.phase === 'go' && this.distTo(this.spot.x, this.spot.z) < 50) { this.phase = 'treat'; this.g.radio('📻 Due feriti, uno è grave. Fate presto!'); }
    for (const v of this.vehicles) if (R() < dt * 2) this.g.fx.smoke(v.x, v.y + 1.1, v.z, 1);
    this.decay(dt); if (this.phase !== 'go') { this.patientPrompts(a, dt); this.hospitalDelivery(); }
    this.check();
  }
}

// =====================================================================================
// VIGILI DEL FUOCO
// =====================================================================================
class Fire extends Call {
  extinguished() { return this.fires.every((f) => !f.alive); }
  grow(dt) {
    if (this.extinguished()) return;
    this.t2 = (this.t2 || 0) + dt;
    if (this.t2 > 40) { this.t2 = 0; for (const f of this.fires) if (f.alive) { f.size = Math.min(2.4, f.size + 0.15); f.health = Math.min(f.max, f.health + 10); } }
  }
}
class Incendio extends Fire {
  prepare() {
    this.spot = this.pickSpot(); if (!this.spot) return false; this.setAddress(this.spot); this.timeLimit = 560;
    // edificio vicino al punto
    const C = this.g.world.city; let best = null, bd = 1e9;
    for (const b of C.buildings) { if (!b.face || b.special || b.h < 12) continue; const d = Math.hypot((b.x0 + b.x1) / 2 - this.spot.x, (b.z0 + b.z1) / 2 - this.spot.z); if (d < bd) { bd = d; best = b; } }
    this.b = best; return !!best;
  }
  start() {
    const g = this.g, b = this.b, gy = b.gy;
    let fx = (b.x0 + b.x1) / 2, fz = (b.z0 + b.z1) / 2;
    if (b.face === 's') fz = b.z1 + 0.6; else if (b.face === 'n') fz = b.z0 - 0.6; else if (b.face === 'e') fx = b.x1 + 0.6; else fx = b.x0 - 0.6;
    this.front = { x: fx, z: fz };
    this.fires = [];
    const off = (k) => (b.face === 's' || b.face === 'n' ? { x: k, z: 0 } : { x: 0, z: k });
    for (const [k, h, sz] of [[-2.5, 6.5, 1.2], [2.5, 9.5, 1.5], [0, 3.2, 1.0]]) { const o = off(k); this.fires.push(g.fx.addFire(fx + o.x, gy + h, fz + o.z, sz, 100)); }
    // vittima sul marciapiede
    const s = this.spot;
    this.victim = g.actors.spawn({ role: 'victim', x: s.x, z: s.z, state: 'idle', female: R() < 0.5 }); this.actors.push(this.victim); this.victim.rescued = false;
    this.victim.hp = 100;
    this.safe = false;
  }
  objective() {
    if (this.phase === 'go') return { title: this.def.title, sub: `Raggiungi ${this.address} con l'autopompa.` };
    const n = this.fires.filter((f) => f.alive).length;
    if (n) return { title: `Spegni l'incendio (${n} focolai)`, sub: 'Scendi (F), prendi la lancia (1) e tieni premuto il tasto sinistro puntando le fiamme.' + (this.victim.rescued ? '' : ' Salva anche la persona (E).') };
    if (!this.victim.rescued) return { title: 'Metti in salvo la persona', sub: 'Avvicinati e premi E, poi portala lontano dall\'edificio.' };
    return { title: 'Incendio domato', sub: '' };
  }
  blips() {
    if (this.phase === 'go') return [{ x: this.front.x, z: this.front.z, label: 'Incendio', color: '#ff7a1a' }];
    const out = this.fires.filter((f) => f.alive).map((f) => ({ x: f.x, z: f.z, label: 'Fuoco', color: '#ff7a1a' }));
    if (!this.victim.rescued) out.push({ x: this.victim.pos.x, z: this.victim.pos.z, label: 'Persona', color: '#ffd24a' });
    return out;
  }
  update(dt, a) {
    const g = this.g, p = g.player;
    if (this.phase === 'go') { if (this.distTo(this.front.x, this.front.z) < 55) { this.phase = 'fire'; g.radio('📻 Fiamme dai piani alti! Una persona è all\'esterno.'); } return; }
    this.grow(dt);
    // salvataggio
    if (!p.vehicle && !this.victim.rescued) {
      const d = Math.hypot(this.victim.pos.x - p.pos.x, this.victim.pos.z - p.pos.z);
      if (this.victim.state !== 'carried' && d < 2.6) { g.ui.setCallPrompt({ key: 'E', text: 'Metti in salvo la persona' }); if (a.interact) { this.victim.carry(p); g.toast('Accompagna la persona lontano dall\'edificio.', 'ok'); } }
      if (this.victim.state === 'carried' && Math.hypot(this.victim.pos.x - this.front.x, this.victim.pos.z - this.front.z) > 38) { this.victim.rescued = true; this.victim.state = 'idle'; this.victim.leader = null; g.toast('Persona in salvo!', 'ok'); this.bonus = 150; }
    }
    // la fiamma ferisce chi si avvicina troppo (solo effetto visivo/avviso)
    if (this.extinguished() && this.victim.rescued) this.win('Incendio domato e persona salva.');
    else if (this.extinguished() && !this.victim.rescued) { this.nudge = (this.nudge || 0) + dt; }
  }
  cleanup() { for (const f of this.fires || []) if (f.alive) this.g.fx.removeFire(f); super.cleanup(); }
}
class AutoFiamme extends Fire {
  prepare() { this.spot = this.pickSpot(220, 650); if (!this.spot) return false; this.setAddress(this.spot); this.timeLimit = 420; return true; }
  start() {
    const g = this.g, w = g.world, s = this.spot, rs = w.roadSpot(s.edge, s.t, 2.0);
    const v = g.spawnVehicle(R() < 0.5 ? 'civ_sedan' : 'civ_hatch', rs.x, rs.z, rs.h, { color: 0x6d3f2a, tag: 'burning' });
    v.locked = true; v.disabled = true; v.type = { ...v.type, emergency: false }; this.vehicles.push(v); this.car = v;
    this.fires = [g.fx.addFire(v.x, v.y + 0.9, v.z, 1.3, 120), g.fx.addFire(v.x + Math.sin(v.h) * 1.8, v.y + 0.7, v.z + Math.cos(v.h) * 1.8, 1.0, 90)];
    this.explode = 150;
  }
  objective() {
    if (this.phase === 'go') return { title: this.def.title, sub: `Raggiungi ${this.address}.` };
    const n = this.fires.filter((f) => f.alive).length;
    return n ? { title: `Spegni l'auto in fiamme (${n})`, sub: 'Scendi dall\'autopompa (F), lancia (1) e tasto sinistro per spruzzare. Esplode tra ' + Math.max(0, Math.ceil(this.explode)) + ' s.' } : { title: 'Fiamme spente', sub: '' };
  }
  blips() { return [{ x: this.car.x, z: this.car.z, label: 'Auto in fiamme', color: '#ff7a1a' }]; }
  update(dt) {
    if (this.phase === 'go') { if (this.distTo(this.car.x, this.car.z) < 50) { this.phase = 'fire'; this.g.radio('📻 Serbatoio a rischio esplosione, attenzione!'); } return; }
    this.grow(dt);
    this.explode -= dt;
    if (this.extinguished()) return this.win('Auto spenta in tempo.');
    if (this.explode <= 0) { this.g.fx.flash(new THREE.Vector3(this.car.x, this.car.y + 1, this.car.z)); this.g.audio.thud(8); return this.fail('L\'auto è esplosa.'); }
  }
  cleanup() { for (const f of this.fires || []) if (f.alive) this.g.fx.removeFire(f); super.cleanup(); }
}
