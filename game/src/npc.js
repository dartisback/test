import * as THREE from 'three';
import { createCharacter } from './character.js';
import { PathDriver } from './ai.js';
import { makeRng, dampAngle, clamp } from './util.js';

const SKINS = [0xf1c8a5, 0xd9a283, 0xb77c58, 0x8a5a3c, 0xe8b894];
const HAIRS = [0x1b130e, 0x3a2a1c, 0x6b4a2a, 0xb08a4a, 0x0d0d0d];
const SHIRTS = [0xe8e4dc, 0x3b6bc6, 0xc63b3b, 0x2f2f33, 0x58a05f, 0xe3c43b, 0x8a4fb0, 0xf09a3a, 0x1f3b6b];
const PANTS = [0x2c3e5e, 0x1b1b1f, 0x4b4033, 0x6a6a6e, 0x23324a];

/** Persona "importante" per le missioni (modello completo): sospetti, vittime, pazienti... */
export class Actor {
  constructor(game, opts = {}) {
    this.g = game;
    this.role = opts.role || 'bystander';
    this.char = createCharacter();
    const r = Math.random;
    this.char.setLook({ skin: SKINS[(r() * SKINS.length) | 0], hair: HAIRS[(r() * HAIRS.length) | 0], shirt: opts.shirt ?? SHIRTS[(r() * SHIRTS.length) | 0], pants: opts.pants ?? PANTS[(r() * PANTS.length) | 0], shoe: 0x222222 });
    this.char.setOutfit('civil');
    if (opts.female) this.char.setFemale(true);
    this.pos = new THREE.Vector3(opts.x || 0, 0, opts.z || 0);
    this.pos.y = game.world.groundY(this.pos.x, this.pos.z);
    this.rot = opts.rot || 0;
    this.state = opts.state || 'idle';
    this.speed = 0; this.timer = 0; this.stamina = 20 + Math.random() * 10;
    this.driver = new PathDriver(game.world.graph, Math.random, { sidewalk: true, look: 5 });
    this.driver.side = Math.random() < 0.5 ? 1 : -1;
    this.armed = !!opts.armed;
    this.name = opts.name || '';
    this.leader = null; this.vehicle = null;
    this.carried = false; this.hp = 100; this.treat = 0;
    this.fightPhase = Math.random() * 6;
    this.lying = false;
    this.alive = true;
    this.wanted = !!opts.wanted;
    game.scene.add(this.char.group);
    this.char.group.position.copy(this.pos);
    this._sync();
  }

  dispose() { this.alive = false; this.g.scene.remove(this.char.group); if (this.vehicle) this.leaveVehicle(); }
  get hidden() { return !!this.vehicle && this.vehicle.hiddenPassengers; }

  /** inizia a scappare lungo le strade lontano dal giocatore */
  flee(fromX, fromZ, run = true) {
    const g = this.g.world.graph;
    const here = g.nearest(this.pos.x, this.pos.z, 200);
    const ring = g.nodesInRing(fromX, fromZ, 260, 700);
    let best = null, bd = -1;
    for (let i = 0; i < 8 && ring.length; i++) { const n = ring[(Math.random() * ring.length) | 0]; const d = Math.hypot(n.x - this.pos.x, n.z - this.pos.z); if (d > bd) { bd = d; best = n; } }
    const path = g.path(here, best || here);
    this.driver.setPath(path);
    this.state = 'flee'; this.runFast = run; this.fleeFrom = { x: fromX, z: fromZ };
  }
  surrender() { this.state = 'surrender'; this.timer = 0; this.speed = 0; }
  stun(sec) { this.state = 'down'; this.timer = sec; this.lying = true; }
  cuff() { this.state = 'cuffed'; this.lying = false; this.leader = this.g.player; }
  carry(leader) { this.state = 'carried'; this.leader = leader; this.lying = false; }
  setLying(on) { this.lying = on; }

  enterVehicle(v, seat) {
    this.vehicle = v; this.state = 'seated';
    this.g.scene.remove(this.char.group);
    v.body.add(this.char.group);
    const s = seat || { x: -0.45, y: 0, z: -0.9 };
    this.char.group.position.set(s.x, s.y || 0, s.z); this.char.group.rotation.set(0, 0, 0);
    this.char.setSeated(true); v.passengers = (v.passengers || []).concat([this]);
    this.leader = null;
  }
  leaveVehicle(pos) {
    const v = this.vehicle; if (!v) return;
    v.body.remove(this.char.group); this.g.scene.add(this.char.group);
    this.char.setSeated(false); v.passengers = (v.passengers || []).filter((x) => x !== this);
    this.vehicle = null;
    const p = pos || v.findExit();
    this.pos.set(p.x, this.g.world.groundY(p.x, p.z), p.z); this.state = 'idle';
  }

  _sync() {
    const g = this.char.group;
    if (this.vehicle) return;
    g.position.copy(this.pos); g.rotation.y = this.rot;
    if (this.lying) { g.rotation.x = -Math.PI / 2; g.position.y = this.pos.y + 0.22; g.rotation.order = 'YXZ'; }
    else { g.rotation.x = 0; }
  }

  moveToward(tx, tz, speed, dt, face = true) {
    const dx = tx - this.pos.x, dz = tz - this.pos.z, d = Math.hypot(dx, dz);
    if (d < 0.05) { this.speed = 0; return d; }
    const st = Math.min(d, speed * dt);
    this.pos.x += (dx / d) * st; this.pos.z += (dz / d) * st;
    if (face) this.rot = dampAngle(this.rot, Math.atan2(dx, dz), 12, dt);
    this.speed = speed;
    return d;
  }

  update(dt) {
    const g = this.g, w = g.world;
    if (this.vehicle) { this.char.animate(dt, { speed: 0, run: 0, crouch: false, air: false, aim: false, cuffed: this.state === 'seated' && this.wanted }); return; }
    this.timer -= dt;
    let anim = { speed: 0, run: 0, crouch: false, air: false, aim: false };
    const p = g.player;
    switch (this.state) {
      case 'idle': this.speed = 0; break;
      case 'fight': this.speed = 0; anim.fight = this.fightPhase; break;
      case 'surrender': this.speed = 0; anim.handsUp = true; anim.crouch = false; { const f = Math.atan2(p.pos.x - this.pos.x, p.pos.z - this.pos.z); this.rot = dampAngle(this.rot, f, 5, dt); } break;
      case 'down': this.speed = 0; if (this.timer <= 0 && this.role === 'suspect') { this.state = this.stunRecover || 'surrender'; this.lying = false; } break;
      case 'patient': this.speed = 0; break;
      case 'flee': {
        this.stamina -= dt;
        const sp = this.stamina > 0 ? (this.runFast ? 5.1 : 3.6) : 3.0;
        const aim = this.driver.aim(this.pos.x, this.pos.z);
        if (aim.done) this.flee(this.fleeFrom ? this.fleeFrom.x : p.pos.x, this.fleeFrom ? this.fleeFrom.z : p.pos.z, true);
        else this.moveToward(aim.tx, aim.tz, sp, dt);
        anim.speed = sp; anim.run = sp > 4 ? 1 : 0.3;
        break;
      }
      case 'walk': {
        const aim = this.driver.aim(this.pos.x, this.pos.z);
        if (!aim.done) this.moveToward(aim.tx, aim.tz, 1.5, dt); anim.speed = 1.5;
        break;
      }
      case 'cuffed': case 'carried': {
        const L = this.leader || p;
        const lx = L.pos.x - Math.sin(L.rot) * 1.5, lz = L.pos.z - Math.cos(L.rot) * 1.5;
        const d = Math.hypot(lx - this.pos.x, lz - this.pos.z);
        if (d > 0.4) this.moveToward(lx, lz, clamp(d * 2.2, 0, 5.4), dt);
        else { this.speed = 0; this.rot = dampAngle(this.rot, L.rot, 6, dt); }
        anim.speed = this.speed; anim.run = this.speed > 3.4 ? 1 : 0.2; anim.cuffed = this.state === 'cuffed';
        break;
      }
      default: break;
    }
    // collisioni e quota
    if (this.state !== 'idle' || this.speed > 0) {
      const q = { x: this.pos.x, z: this.pos.z };
      w.grid.resolveCircle(q, 0.36, this.pos.y + 1.6);
      this.pos.x = q.x; this.pos.z = q.z;
    }
    this.pos.y = w.groundY(this.pos.x, this.pos.z);
    this._sync();
    this.char.animate(dt, anim);
  }
}

/** Gestione di tutti gli attori di missione */
export class Actors {
  constructor(game) { this.g = game; this.list = []; }
  add(a) { this.list.push(a); return a; }
  spawn(opts) { return this.add(new Actor(this.g, opts)); }
  remove(a) { a.dispose(); const i = this.list.indexOf(a); if (i >= 0) this.list.splice(i, 1); }
  clear() { for (const a of this.list) a.dispose(); this.list.length = 0; }
  update(dt) { for (const a of this.list) a.update(dt); }
  nearest(x, z, r, pred) {
    let best = null, bd = r * r;
    for (const a of this.list) { if (a.vehicle || (pred && !pred(a))) continue; const d = (a.pos.x - x) ** 2 + (a.pos.z - z) ** 2; if (d < bd) { bd = d; best = a; } }
    return best;
  }
}
