import * as THREE from 'three';
import { clamp, damp, dampAngle, lerp } from './util.js';
import { createCharacter } from './character.js';

const GROUND = 0.06;
const RADIUS = 0.36;

export class Player {
  constructor(scene, world, audio, fx) {
    this.scene = scene; this.world = world; this.audio = audio; this.fx = fx;
    this.char = createCharacter();
    scene.add(this.char.group);
    this.pos = new THREE.Vector3(0, GROUND, 0);
    this.vel = new THREE.Vector3();
    this.vy = 0;
    this.rot = 0;
    this.onGround = true;
    this.crouch = false;
    this.aiming = false;
    this.weapons = { pistol: false, taser: false, baton: false };
    this.equipped = null;
    this.fireCd = 0;
    this.stepAcc = 0;
    this.noclip = false;
    this.speedMul = 1;
    this.jumpMul = 1;
    this.vehicle = null;
    this.moving = 0;
    this.runK = 0;
  }

  teleport(x, z, yaw = 0) {
    this.pos.set(x, GROUND, z);
    this.vel.set(0, 0, 0); this.vy = 0;
    this.rot = yaw;
    this.char.group.position.copy(this.pos);
    this.char.group.rotation.y = yaw;
  }

  giveWeapons() { this.weapons.pistol = this.weapons.taser = this.weapons.baton = true; this.char.setSidearm(true); }
  clearWeapons() { this.weapons.pistol = this.weapons.taser = this.weapons.baton = false; this.equip(null); this.char.setSidearm(false); }
  hasWeapons() { return this.weapons.pistol; }

  equip(type) {
    if (type && !this.weapons[type]) return;
    this.equipped = type === this.equipped ? null : type;
    if (type === null) this.equipped = null;
    this.char.setWeapon(this.equipped);
    this.audio.ui('click');
  }

  /** Ritorna il punto d'occhio (per la camera) */
  get focus() { return this.pos; }

  update(dt, a, cam) {
    const ch = this.char;
    if (this.vehicle) {
      // seduto in auto: la logica è nel veicolo
      ch.animate(dt, { speed: 0, run: 0, crouch: false, air: false, aim: false });
      return;
    }

    // armi
    if (a.weapon === 0) this.equip(null);
    else if (a.weapon === 1) this.equip('pistol');
    else if (a.weapon === 2) this.equip('taser');
    else if (a.weapon === 3) this.equip('baton');

    // accovacciata
    if (a.crouchPress) this.crouch = !this.crouch;
    const crouching = this.crouch || a.crouchHold;
    this.aiming = !!(a.aim && this.equipped && (this.equipped === 'pistol' || this.equipped === 'taser'));

    // direzione desiderata (relativa alla camera)
    const yaw = cam.yaw;
    const fx = -Math.sin(yaw), fz = -Math.cos(yaw);
    const rx = Math.cos(yaw), rz = -Math.sin(yaw);
    let mx = a.moveX, my = a.moveY;
    const ml = Math.hypot(mx, my);
    if (ml > 1) { mx /= ml; my /= ml; }
    const wx = rx * mx + fx * my, wz = rz * mx + fz * my;
    const intensity = Math.min(1, ml);

    const wantRun = a.run && !crouching && !this.aiming && my > -0.5;
    let target = crouching ? 1.35 : this.aiming ? 1.7 : wantRun ? 5.4 : 2.1;
    target *= this.speedMul * (this.noclip ? (wantRun ? 4 : 2) : 1);
    const k = this.onGround || this.noclip ? 14 : 2.5;
    this.vel.x = damp(this.vel.x, wx * target * intensity, k, dt);
    this.vel.z = damp(this.vel.z, wz * target * intensity, k, dt);

    if (this.noclip) {
      this.vy = (a.jump || a.handbrake ? 6 : 0) - (a.crouchHold ? 6 : 0);
      this.pos.x += this.vel.x * dt; this.pos.z += this.vel.z * dt; this.pos.y += this.vy * dt;
      this.pos.y = Math.max(GROUND, this.pos.y);
      this.onGround = this.pos.y <= GROUND + 0.01;
    } else {
      // salto
      if (a.jump && this.onGround && !crouching) { this.vy = 5.0 * this.jumpMul; this.onGround = false; }
      this.vy -= 14 * dt;
      this.pos.x += this.vel.x * dt; this.pos.z += this.vel.z * dt;
      this.pos.y += this.vy * dt;
      if (this.pos.y <= GROUND) { this.pos.y = GROUND; this.vy = 0; this.onGround = true; }
      // collisioni
      const p = { x: this.pos.x, z: this.pos.z };
      this.world.grid.resolveCircle(p, RADIUS, this.pos.y + 1.7);
      this.pos.x = p.x; this.pos.z = p.z;
    }

    const speed = Math.hypot(this.vel.x, this.vel.z);
    this.moving = speed;

    // rotazione del modello
    if (this.aiming || (this.equipped && a.fire)) {
      this.rot = dampAngle(this.rot, Math.atan2(fx, fz), 16, dt);
    } else if (speed > 0.25) {
      this.rot = dampAngle(this.rot, Math.atan2(this.vel.x, this.vel.z), 11, dt);
    }

    // passi
    if (this.onGround && speed > 0.5) {
      this.stepAcc += speed * dt;
      const stride = wantRun ? 2.1 : 1.35;
      if (this.stepAcc > stride) { this.stepAcc = 0; this.audio.step(wantRun); }
    }

    // fuoco
    this.fireCd = Math.max(0, this.fireCd - dt);
    if (this.equipped && this.onGround !== undefined) {
      if (this.equipped === 'baton') {
        if (a.firePressed && this.fireCd <= 0) { ch.swing(); this.audio.swing(); this.fireCd = 0.45; }
      } else if (a.firePressed && this.fireCd <= 0 && !this.vehicle) {
        this.shoot(cam);
      }
    }

    ch.group.position.copy(this.pos);
    ch.group.rotation.y = this.rot;
    this.runK = damp(this.runK, wantRun && speed > 3 ? 1 : 0, 6, dt);
    ch.animate(dt, { speed, run: this.runK, crouch: crouching, air: !this.onGround, aim: this.aiming });
  }

  shoot(cam) {
    const type = this.equipped;
    const taser = type === 'taser';
    this.fireCd = taser ? 1.0 : 0.22;
    this.char.fire();
    const o = cam.getRayOrigin(), d = cam.getRayDir();
    const maxD = taser ? 9 : 120;
    const t = this.world.grid.ray(o.x, o.y, o.z, d.x, d.y, d.z, maxD);
    const hit = o.clone().addScaledVector(d, t);
    // sposta il bersaglio oltre la sagoma del giocatore
    const muzzle = this.char.getMuzzle() || this.pos.clone().setY(1.3);
    if (taser) { this.audio.taser(); } else { this.audio.shot(); }
    this.fx.flash(muzzle, taser);
    this.fx.tracer(muzzle, hit, taser);
    if (t < maxD) this.fx.spark(hit);
  }
}
