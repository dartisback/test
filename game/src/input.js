import { clamp } from './util.js';
import { settings } from './settings.js';

const GAME_KEYS = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'ShiftLeft', 'ShiftRight', 'ControlLeft', 'KeyE', 'KeyF', 'KeyQ', 'KeyC', 'KeyH', 'KeyL', 'KeyM', 'KeyV', 'KeyR', 'KeyG', 'KeyX', 'KeyY', 'KeyN', 'Digit1', 'Digit2', 'Digit3', 'Digit0', 'F1', 'F2', 'Tab']);

const dead = (v, d = 0.16) => (Math.abs(v) < d ? 0 : (v - Math.sign(v) * d) / (1 - d));

export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = new Set();
    this.pressed = new Set();
    this.mouse = { dx: 0, dy: 0, left: false, right: false, leftPressed: false, wheel: 0 };
    this.locked = false;
    this.lockTime = 0;
    this.enabled = false; // abilitato solo durante la partita
    this.onLockChange = () => {};
    this.padPrev = [];
    this.padActive = false;

    window.addEventListener('keydown', (e) => {
      if (e.target && /INPUT|SELECT|TEXTAREA/.test(e.target.tagName)) return;
      if (GAME_KEYS.has(e.code) && (this.enabled || e.code === 'F1')) e.preventDefault();
      if (!this.keys.has(e.code)) this.pressed.add(e.code);
      this.keys.add(e.code);
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => { this.keys.clear(); this.mouse.left = this.mouse.right = false; });
    document.addEventListener('mousemove', (e) => {
      if (!this.locked || performance.now() - this.lockTime < 150) return;
      // Chrome può inviare salti enormi subito dopo il lock: li scartiamo
      if (Math.abs(e.movementX) > 400 || Math.abs(e.movementY) > 400) return;
      this.mouse.dx += e.movementX; this.mouse.dy += e.movementY;
    });
    canvas.addEventListener('mousedown', (e) => {
      if (!this.locked) return;
      if (e.button === 0) { this.mouse.left = true; this.mouse.leftPressed = true; }
      if (e.button === 2) this.mouse.right = true;
    });
    window.addEventListener('mouseup', (e) => {
      if (e.button === 0) this.mouse.left = false;
      if (e.button === 2) this.mouse.right = false;
    });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    canvas.addEventListener('wheel', (e) => { if (this.locked) this.mouse.wheel += Math.sign(e.deltaY); }, { passive: true });
    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === canvas;
      this.lockTime = performance.now();
      this.mouse.dx = this.mouse.dy = 0;
      if (!this.locked) { this.mouse.left = this.mouse.right = false; }
      this.onLockChange(this.locked);
    });
  }

  requestLock() {
    try {
      const p = this.canvas.requestPointerLock();
      if (p && p.catch) p.catch(() => {});
    } catch (e) { /* ignore */ }
  }
  exitLock() { if (document.pointerLockElement) document.exitPointerLock(); }

  down(code) { return this.keys.has(code); }
  hit(code) { return this.pressed.has(code); }

  /** Calcola le azioni astratte del frame (tastiera + mouse + gamepad) */
  poll(dt) {
    const k = (c) => (this.keys.has(c) ? 1 : 0);
    const h = (c) => this.pressed.has(c);
    const a = {
      moveX: k('KeyD') - k('KeyA'),
      moveY: k('KeyW') - k('KeyS'),
      lookX: this.mouse.dx * settings.mouseSens * 0.0022,
      lookY: this.mouse.dy * settings.mouseSens * 0.0022,
      run: !!(k('ShiftLeft') || k('ShiftRight')),
      crouchHold: !!k('ControlLeft'),
      crouchPress: h('KeyC'),
      jump: h('Space'),
      handbrake: !!k('Space'),
      interact: h('KeyE'),
      vehicle: h('KeyF'),
      siren: h('KeyQ'),
      lights: h('KeyL'),
      horn: !!k('KeyH'),
      fire: this.mouse.left, firePressed: this.mouse.leftPressed,
      aim: this.mouse.right,
      weapon: h('Digit1') ? 1 : h('Digit2') ? 2 : h('Digit3') ? 3 : h('Digit0') ? 0 : -1,
      map: h('KeyM'),
      admin: h('F1'),
      help: h('F2'),
      camReset: h('KeyV'),
      throttle: k('KeyW') || k('ArrowUp'),
      brake: k('KeyS') || k('ArrowDown'),
      steer: (k('KeyD') || k('ArrowRight')) - (k('KeyA') || k('ArrowLeft')),
      wheel: this.mouse.wheel,
      pad: false,
    };
    if (k('ArrowUp') || k('ArrowDown')) a.moveY = k('ArrowUp') - k('ArrowDown');
    if (k('ArrowLeft') || k('ArrowRight')) a.moveX = k('ArrowRight') - k('ArrowLeft');

    // ---- gamepad ----
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    const p = pads && Array.from(pads).find((g) => g && g.connected);
    if (p) {
      const b = (i) => !!(p.buttons[i] && p.buttons[i].pressed);
      const bv = (i) => (p.buttons[i] ? p.buttons[i].value : 0);
      const pr = (i) => b(i) && !this.padPrev[i];
      const lx = dead(p.axes[0]), ly = dead(p.axes[1]), rx = dead(p.axes[2]), ry = dead(p.axes[3]);
      if (lx || ly || rx || ry || b(0) || b(7)) this.padActive = true;
      a.moveX = clamp(a.moveX + lx, -1, 1);
      a.moveY = clamp(a.moveY - ly, -1, 1);
      a.lookX += rx * dt * 2.6 * settings.padSens;
      a.lookY += ry * dt * 1.8 * settings.padSens;
      a.run = a.run || b(10);
      a.jump = a.jump || pr(0);
      a.handbrake = a.handbrake || b(0);
      a.crouchPress = a.crouchPress || pr(1);
      a.interact = a.interact || pr(2);
      a.vehicle = a.vehicle || pr(3);
      a.siren = a.siren || pr(4);
      a.lights = a.lights || pr(5);
      a.horn = a.horn || b(11);
      a.aim = a.aim || bv(6) > 0.4;
      a.fire = a.fire || bv(7) > 0.5;
      a.firePressed = a.firePressed || (bv(7) > 0.5 && !this.padPrev[7]);
      a.throttle = Math.max(a.throttle, bv(7));
      a.brake = Math.max(a.brake, bv(6));
      a.steer = clamp(a.steer + lx, -1, 1);
      a.map = a.map || pr(8);
      a.camReset = a.camReset || pr(9);
      if (pr(12)) a.weapon = 1; if (pr(14)) a.weapon = 2; if (pr(15)) a.weapon = 3; if (pr(13)) a.weapon = 0;
      a.pad = this.padActive;
      this.padPrev = p.buttons.map((x) => x.pressed);
    }
    return a;
  }

  endFrame() {
    this.pressed.clear();
    this.mouse.dx = this.mouse.dy = 0;
    this.mouse.leftPressed = false;
    this.mouse.wheel = 0;
  }
}
