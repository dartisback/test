import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { settings } from './settings.js';
import { clamp, damp, makeRng } from './util.js';
import { World } from './world.js';
import { Input } from './input.js';
import { AudioSys } from './audio.js';
import { UI } from './ui.js';
import { Player } from './player.js';
import { CameraRig } from './camera.js';
import { Vehicle, CAR_TYPES } from './vehicle.js';
import { Missions } from './missions.js';
import { MapRenderer } from './minimap.js';
import { FX } from './fx.js';
import { FACTIONS, FACTION_IDS } from './napoli.js';
import { Crowd } from './crowd.js';
import { Traffic } from './traffic.js';
import { Actors } from './npc.js';
import { Dispatcher } from './calls.js';
import { PathDriver, steerTo } from './ai.js';

const $ = (id) => document.getElementById(id);
const nextFrame = () => new Promise((r) => requestAnimationFrame(() => r()));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const R = Math.random;

class Game {
  constructor() {
    this.canvas = $('view');
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.78;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(settings.fov, innerWidth / innerHeight, 0.2, 14000);
    this.audio = new AudioSys();
    this.ui = new UI(); this.ui.game = this;
    this.input = new Input(this.canvas);
    this.input.onLockChange = (l) => this.onLockChange(l);
    this.world = new World(this.scene);
    this.mapR = new MapRenderer(this.world);
    this.clock = new THREE.Clock();

    this.state = 'menu'; this.built = false; this.modal = false; this.forceRun = false;
    this.timeScale = 20; this.carMul = 1; this.todTimer = 0;
    this.fps = 60; this.fpsAcc = 0; this.fpsN = 0;
    this.lockAt = 0; this.transition = false; this.bigMap = false;
    this.beams = []; this.wps = []; this.vehicles = []; this.cleanups = [];
    this.faction = FACTIONS.polizia; this.hq = null;
    this.score = 0; this.callPrompt = null; this.radioOpen = false;
    this.rnd = makeRng(Math.floor(Math.random() * 1e9));
    this.admin = this._makeAdmin();

    addEventListener('resize', () => this.resize());
    this.resize(); this.applySettings();
    this.ui.show('home');
    this.frame = this.frame.bind(this);
    requestAnimationFrame(this.frame);
  }

  resize() {
    const dpr = Math.min(devicePixelRatio || 1, 1.5) * settings.resolution;
    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(innerWidth, innerHeight, false);
    this.camera.aspect = innerWidth / innerHeight; this.camera.updateProjectionMatrix();
  }

  applySettings() {
    this.resize();
    const w = this.world;
    if (w.sun) {
      w.sun.castShadow = settings.shadows !== 'off';
      const size = settings.shadows === 'low' ? 1024 : 2048;
      if (w.sun.shadow.mapSize.x !== size) { w.sun.shadow.mapSize.set(size, size); if (w.sun.shadow.map) { w.sun.shadow.map.dispose(); w.sun.shadow.map = null; } }
      this.scene.fog.near = 220 * settings.viewDist; this.scene.fog.far = 3000 * settings.viewDist;
    }
    this.audio.applyVolumes();
    $('fps').style.display = settings.showFps ? '' : 'none';
  }

  // ======================= avvio partita =======================
  async startNewGame(factionId, spawnId, duty) {
    try { await this._startNewGame(factionId, spawnId, duty); }
    catch (e) {
      console.error(e); this.state = 'menu';
      this.ui.setProgress(0, `Errore di caricamento: ${e.message}`);
      $('loading-tip').innerHTML = '<button class="btn" onclick="location.reload()">Ricarica la pagina</button>';
    }
  }

  async _startNewGame(factionId, spawnId, duty) {
    this.audio.init();
    this.state = 'loading';
    this.ui.startLoading();
    await nextFrame();
    if (!this.built) {
      await this.world.build((p, t) => this.ui.setProgress(p * 0.8, t));
      const pm = new THREE.PMREMGenerator(this.renderer);
      this.scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture;
      this.scene.environmentIntensity = 0.5;
      this.createEntities();
      this.built = true;
    }
    this.ui.setProgress(0.86, 'Cittadini e traffico…'); await sleep(30);
    this.faction = FACTIONS[factionId] || FACTIONS.polizia;
    this.hq = this.world.hqs[this.faction.id];
    this.resetGame(spawnId, duty);
    this.ui.setProgress(0.95, 'Compilazione shader…'); await sleep(30);
    this.camRig.update(0.016, { lookX: 0, lookY: 0, wheel: 0 }, this.player.pos, { mode: 'foot' });
    try { this.renderer.compile(this.scene, this.camera); } catch (e) { /* ignore */ }
    this.ui.setProgress(1, 'Pronto!'); await sleep(250);
    this.state = 'ready';
    this.applySettings();
    this.ui.show('click');
  }

  createEntities() {
    const w = this.world;
    this.fx = new FX(this.scene); this.fx.groundAt = (x, z) => w.groundY(x, z);
    this.player = new Player(this.scene, w, this.audio, this.fx);
    this.camRig = new CameraRig(this.camera, w);
    this.crowd = new Crowd(w, this.scene, 260);
    this.traffic = new Traffic(w, this.scene, 56);
    this.actors = new Actors(this);
    this.missions = new Missions(this);
    this.dispatcher = new Dispatcher(this);
    const g = new THREE.Group();
    this.rig = {
      group: g, blueL: new THREE.PointLight(0x2a5cff, 0, 26, 1.4), blueR: new THREE.PointLight(0x2a5cff, 0, 26, 1.4),
      spot: new THREE.SpotLight(0xfff0cf, 0, 70, 0.55, 0.55, 1.2), target: new THREE.Object3D(),
    };
    this.rig.blueL.position.set(-0.45, 1.95, 0.15); this.rig.blueR.position.set(0.45, 1.95, 0.15);
    this.rig.spot.position.set(0, 0.9, 2.1); this.rig.target.position.set(0, 0.2, 18); this.rig.spot.target = this.rig.target;
    g.add(this.rig.blueL, this.rig.blueR, this.rig.spot, this.rig.target);
    this.scene.add(g);
    const beamMat = new THREE.MeshBasicMaterial({ color: 0xffd24a, transparent: true, opacity: 0.28, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
    for (let i = 0; i < 4; i++) {
      const m = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 120, 16, 1, true), beamMat);
      const ring = new THREE.Mesh(new THREE.RingGeometry(0.8, 1.2, 32).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xffd24a, transparent: true, opacity: 0.9, depthWrite: false, side: THREE.DoubleSide }));
      ring.position.y = -59.8; m.add(ring); m.visible = false; this.scene.add(m); this.beams.push(m);
    }
  }

  // ----------------------------- veicoli -----------------------------
  spawnVehicle(typeId, x, z, h, opts = {}) {
    const v = new Vehicle(typeId, this.world, opts);
    v.setPose(x, z, h); v.tag = opts.tag || null; v.locked = opts.locked !== undefined ? opts.locked : false;
    this.scene.add(v.group); this.vehicles.push(v);
    v.update(0.001, null, null);
    return v;
  }
  removeVehicle(v) {
    if (this.player && this.player.vehicle === v) this.exitVehicle(true);
    for (const a of v.passengers || []) if (a.alive) a.leaveVehicle();
    this.scene.remove(v.group);
    const i = this.vehicles.indexOf(v); if (i >= 0) this.vehicles.splice(i, 1);
  }
  scheduleCleanup(actors, vehicles) { this.cleanups.push({ actors: actors.slice(), vehicles: vehicles.slice(), t: 0 }); }
  _runCleanups(dt) {
    const p = this.player, px = p.vehicle ? p.vehicle.x : p.pos.x, pz = p.vehicle ? p.vehicle.z : p.pos.z;
    for (let i = this.cleanups.length - 1; i >= 0; i--) {
      const c = this.cleanups[i]; c.t += dt;
      const far = (o) => { const x = o.pos ? o.pos.x : o.x, z = o.pos ? o.pos.z : o.z; return Math.hypot(x - px, z - pz) > 160; };
      c.actors = c.actors.filter((a) => { if (!a.alive) return false; if (c.t > 25 && far(a)) { this.actors.remove(a); return false; } if (c.t > 120) { this.actors.remove(a); return false; } return true; });
      c.vehicles = c.vehicles.filter((v) => { if (this.player.vehicle === v) return true; if ((c.t > 25 && far(v)) || c.t > 160) { this.removeVehicle(v); return false; } return true; });
      if (!c.actors.length && !c.vehicles.length) this.cleanups.splice(i, 1);
    }
  }

  nearestVehicle(maxD, filter) {
    const p = this.player.pos;
    let best = null, bd = maxD;
    for (const v of this.vehicles) {
      if (filter && !filter(v)) continue;
      const s = Math.sin(v.h), c = Math.cos(v.h);
      for (const k of v.circles) { const d = Math.hypot(p.x - (v.x + s * k.o), p.z - (v.z + c * k.o)) - k.r; if (d < bd) { bd = d; best = v; } }
    }
    return best;
  }
  /** veicolo del giocatore vicino (per caricare sospetti/pazienti): quello guidato in precedenza */
  nearestPlayerVehicle(maxD, typeId) {
    return this.nearestVehicle(maxD, (v) => (v.tag === 'hq' || v.tag === 'driven') && (!typeId || v.typeId === typeId));
  }

  enterVehicle(v) {
    const p = this.player, ch = p.char;
    ch.setWeapon(null); p.equipped = null; p.escort = null;
    p.vehicle = v; v.occupied = true; v.tag = v.tag || 'driven'; if (v.tag === 'unit') v.controller = null;
    this.scene.remove(ch.group); v.body.add(ch.group);
    const s = v.seat || { x: 0.45, y: 0, z: -0.2 };
    ch.group.position.set(s.x, s.y, s.z); ch.group.rotation.set(0, 0, 0); ch.setSeated(true);
    v.group.add(this.rig.group); this.rig.group.position.set(0, 0, 0);
    v.lightsOn = this.world.nightAmt > 0.3;
    this.audio.startEngine();
    this.camRig.snapBehind(v.h); this.camRig.curDist = 6;
    this.missions.onEnterVehicle(v);
    this.audio.door();
  }
  exitVehicle(silent = false) {
    const p = this.player, v = p.vehicle, ch = p.char;
    if (!v) return;
    const pos = v.findExit();
    v.body.remove(ch.group); this.scene.add(ch.group); ch.setSeated(false);
    p.vehicle = null; v.occupied = false;
    p.teleport(pos.x, pos.z, v.h);
    this.scene.add(this.rig.group); this.rig.group.position.set(0, 0, 0);
    this.rig.blueL.intensity = this.rig.blueR.intensity = this.rig.spot.intensity = 0;
    if (v.siren) { v.siren = false; }
    this.audio.setSiren(false); this.audio.setHorn(false); this.audio.stopEngine();
    this.camRig.curDist = 3.4;
    if (!silent) this.audio.door();
  }

  // ----------------------------- reset di partita -----------------------------
  resetGame(spawnId, duty) {
    if (this.player.vehicle) this.exitVehicle(true);
    for (const v of this.vehicles.slice()) this.removeVehicle(v);
    this.actors.clear(); this.cleanups.length = 0;
    if (this.dispatcher.active) this.dispatcher.active.cleanup();
    this.dispatcher.reset();
    for (const f of this.fx.fires.slice()) this.fx.removeFire(f);
    this.crowd.peds.length = 0; this.traffic.cars.length = 0;
    // veicoli della sede
    const f = this.faction, hq = this.hq;
    f.vehicles.forEach((id, i) => { const b = hq.bays[i]; this.spawnVehicle(id, b.x, b.z, b.heading, { tag: 'hq', locked: true }); });
    // spawn
    let spawn = this.world.city.spawns.find((s) => s.id === spawnId) || this.world.city.spawns[0];
    if (spawn.hq) spawn = { ...spawn, x: hq.door.x - 3, z: hq.door.z + 12, yaw: 0 };
    this.player.teleport(spawn.x, spawn.z, Math.atan2(-Math.sin(spawn.yaw), -Math.cos(spawn.yaw)));
    this.camRig.yaw = spawn.yaw; this.camRig.pitch = 0.2; this.camRig.curDist = 3.4;
    this.player.noclip = false; this.player.speedMul = 1; this.player.jumpMul = 1; this.carMul = 1; this.player.crouch = false;
    this.world.setTimeOfDay(10.5 + R() * 6); this.timeScale = 20;
    this.missions.reset(); this.missions.setStage(0, true);
    this.score = 0; this.radioOpen = false;
    if (duty) {
      this.missions.setStage(5, true); this.missions.assigned = this.vehicles[0];
      const b = hq.bays[0]; this.player.teleport(b.x + 3, b.z + 2, Math.PI / 2); this.camRig.yaw = -Math.PI / 2;
    }
    this.audio.setSiren(false); this.audio.stopEngine(); this.audio.setHorn(false);
    this.ui.setScore(0);
  }

  beginPlay() {
    this.audio.init(); this.audio.resume();
    this.ui.hideAll(); this.ui.showHud(true);
    this.state = 'playing'; this.modal = false; this.input.enabled = true;
    this.lockAt = performance.now(); this.input.requestLock();
    this.ui.context = 'game';
    this.showHelp(true); setTimeout(() => this.showHelp(false), 9000);
  }
  showHelp(on) { $('help-panel').classList.toggle('hidden', !on); }

  // ======================= pausa / modali =======================
  onLockChange(locked) {
    if (this.state !== 'playing') return;
    if (locked) { this.ui.hideAll(); this.modal = false; return; }
    if (!this.modal) this.pause();
  }
  pause() { this.ui.context = 'pause'; this.ui.show('pause'); }
  resume() { this.ui.context = 'game'; this.ui.hideAll(); this.lockAt = performance.now(); this.input.requestLock(); }
  quitToMenu() {
    if (this.player && this.player.vehicle) this.exitVehicle(true);
    this.audio.setSiren(false); this.audio.stopEngine(); this.audio.setHorn(false);
    this.state = 'menu'; this.modal = false; this.input.enabled = false;
    this.ui.showHud(false); this.ui.context = 'home'; this.ui.show('home');
  }
  onModalOpen() { this.modal = true; this.input.exitLock(); }
  closeKeys() { this.modal = false; this.ui.hideAll(); this.lockAt = performance.now(); this.input.requestLock(); }
  openAdmin() { this.ui.context = 'game'; this.modal = true; this.input.exitLock(); this.ui.show('admin'); }
  closeAdmin() { this.modal = false; this.ui.context = 'game'; this.ui.hideAll(); this.lockAt = performance.now(); this.input.requestLock(); }

  fadeTransition(cb) {
    if (this.transition) return;
    this.transition = true;
    const f = $('fade'); f.classList.add('on'); this.audio.door();
    setTimeout(() => { cb(); setTimeout(() => { f.classList.remove('on'); this.transition = false; }, 450); }, 500);
  }

  toast(t, type) { this.ui.toast(t, type); }
  radio(t) { this.ui.toast(t, 'radio'); }
  addScore(n, why) { this.score += n; this.ui.setScore(this.score); }

  // ======================= loop =======================
  frame() {
    requestAnimationFrame(this.frame);
    this.frames = (this.frames || 0) + 1;
    const dt = Math.min(this.clock.getDelta(), 0.05);
    this.fpsAcc += dt; this.fpsN++;
    if (this.fpsAcc > 0.5) { this.fps = this.fpsN / this.fpsAcc; this.fpsAcc = 0; this.fpsN = 0; if (settings.showFps) $('fps').textContent = `${Math.round(this.fps)} FPS`; }
    if (this.built && (this.state === 'playing' || this.state === 'ready' || this.state === 'loading')) {
      if (this.state === 'playing') this.update(dt);
      else this.world.update(dt, this.player.pos);
      this.renderer.toneMappingExposure = this.world.exposure;
      this.scene.environmentIntensity = 0.06 + 0.5 * this.world.dayFactor;
      if (this.debugCam) { this.camera.position.copy(this.debugCam.pos); this.camera.lookAt(this.debugCam.look); }
      if (!this.noRender) this.renderer.render(this.scene, this.camera);
    } else if (this.built) {
      this.menuT = (this.menuT || 0) + dt;
      const t = this.menuT * 0.04;
      const cx = -130, cz = -160;
      this.camera.position.set(cx + Math.cos(t) * 330, 110, cz + Math.sin(t) * 330 + 40);
      this.camera.lookAt(cx, 10, cz);
      this.world.update(dt, new THREE.Vector3(cx, 0, cz));
      this.renderer.toneMappingExposure = this.world.exposure;
      if (!this.noRender) this.renderer.render(this.scene, this.camera);
    }
  }

  update(dt) {
    const p = this.player, input = this.input;
    const lockOk = input.locked || this.forceRun;
    if (!lockOk && !this.modal && this.ui.screen === null && performance.now() - this.lockAt > 900) this.pause();
    const running = lockOk && !this.modal && this.ui.screen === null;
    const a = input.poll(dt);
    if (running) this.step(dt, a);
    else {
      const c = p.vehicle ? new THREE.Vector3(p.vehicle.x, 0, p.vehicle.z) : p.pos;
      this.world.update(dt, c);
      if (p.vehicle) this.audio.setEngine(0, 0);
    }
    input.endFrame();
  }

  step(dt, a) {
    const p = this.player, w = this.world, m = this.missions, inp = this.input;
    w.hour = (w.hour + (dt * this.timeScale) / 3600) % 24;
    this.todTimer += dt;
    if (this.todTimer > 0.15) { this.todTimer = 0; w.setTimeOfDay(w.hour); }

    if (a.admin) { this.openAdmin(); return; }
    if (a.help) this.showHelp($('help-panel').classList.contains('hidden'));
    if (a.map) { this.bigMap = !this.bigMap; $('bigmap').classList.toggle('hidden', !this.bigMap); }
    if (inp.hit('KeyR')) this.toggleRadio();
    // numeri: con la radio aperta scelgono l'opzione
    if (this.radioOpen && a.weapon > 0) { this.radioChoose(a.weapon); a.weapon = -1; }

    // salire / scendere
    if (a.vehicle && !this.transition) {
      if (p.vehicle) { if (Math.abs(p.vehicle.vf) < 6) this.exitVehicle(); else this.toast('Fermati prima di scendere.', 'err'); }
      else {
        const v = this.nearestVehicle(2.4, (x) => x.tag === 'hq' || x.tag === 'driven' || x.tag === 'unit');
        if (v) { if (v.locked) { this.toast('Devi prima entrare in servizio e ritirare le chiavi.', 'err'); this.audio.ui('err'); } else this.enterVehicle(v); }
      }
    }

    // guida
    const drv = p.vehicle;
    let ctrl = null;
    if (drv) {
      ctrl = { throttle: a.throttle, brake: a.brake, steer: a.steer, handbrake: a.handbrake, power: this.carMul };
      if (a.siren && drv.type.emergency) {
        drv.siren = !drv.siren; this.audio.setSiren(drv.siren, drv.type.sirenRate); this.audio.ui('click');
      }
      if (a.lights) drv.lightsOn = !drv.lightsOn;
      this.audio.setHorn(a.horn);
      this.audio.setEngine(Math.abs(drv.vf), a.throttle, drv.type.id === 'autopompa' ? 0.6 : drv.type.id === 'ambulanza' ? 0.85 : 1);
    }
    const others = this.vehicles.concat(this.traffic.cars);
    for (const v of this.vehicles) v.update(dt, v === drv ? ctrl : null, others);
    if (drv && drv.impact > 3) { this.audio.thud(drv.impact); this.camRig.shake = Math.min(0.3, drv.impact * 0.02); }
    this._pushPlayerOutOfCars();

    // persone / traffico
    const px = drv ? drv.x : p.pos.x, pz = drv ? drv.z : p.pos.z;
    const emerg = this.vehicles.filter((v) => v.siren && v.type.emergency);
    this.traffic.update(dt, px, pz, this.vehicles, this.crowd.peds.length > 0 ? this.nearPeds(px, pz) : [], emerg);
    this.crowd.update(dt, px, pz, this.vehicles.concat(this.traffic.cars), !drv);
    for (const hit of this.crowd.hits) {
      if (hit.vehicle === drv && drv) { this.addScore(-120, 'Investimento'); this.toast('⚠ Hai investito un pedone! (-120)', 'err'); this.audio.thud(6); this.radio('📻 Centrale: attenzione, incidente con feriti!'); }
    }
    this.actors.update(dt);
    this._backupUnits(dt);

    // giocatore
    if (!drv) p.update(dt, a, this.camRig); else p.update(dt, a, this.camRig);
    this._shotsAndTools(dt, a);

    // missioni
    this.ui.callPrompt = null;
    m.update(dt, a);
    if (m.stage >= 6) this.dispatcher.update(dt, a);
    if (!m.prompt && this.ui.callPrompt) m.prompt = this.ui.callPrompt;
    this._runCleanups(dt);

    // luci del veicolo guidato
    if (drv) {
      const flash = Math.floor(performance.now() / 110) % 2;
      const on = drv.siren && drv.type.emergency;
      this.rig.blueL.intensity = on ? (flash ? 60 : 4) : 0; this.rig.blueR.intensity = on ? (flash ? 4 : 60) : 0;
      this.rig.spot.intensity = drv.lightsOn ? 140 : 0;
    }

    // camera
    const center = drv ? new THREE.Vector3(drv.x, drv.y, drv.z) : p.pos;
    this.camRig.update(dt, a, center, { mode: drv ? 'car' : 'foot', heading: drv ? drv.h : 0, speed: drv ? drv.speed : 0, crouch: p.crouch || a.crouchHold, aim: p.aiming || p.spraying });
    if (!drv && this.hq && this.hq.inside(p.pos.x, p.pos.z)) {
      const ceil = this.hq.gy + 3.55;
      if (this.camera.position.y > ceil) { this.camera.position.y = ceil; this.camera.lookAt(this.camRig.pivot); }
    }
    w.update(dt, center);
    this.fx.update(dt);
    this.updateHud(dt, a, center);
  }

  nearPeds(px, pz) {
    const out = [];
    for (const q of this.crowd.peds) if (Math.abs(q.x - px) < 60 && Math.abs(q.z - pz) < 60) out.push({ x: q.x, z: q.z });
    return out;
  }

  _pushPlayerOutOfCars() {
    const p = this.player; if (p.vehicle) return;
    for (const v of this.vehicles) {
      const s = Math.sin(v.h), c = Math.cos(v.h);
      for (const k of v.circles) {
        const dx = p.pos.x - (v.x + s * k.o), dz = p.pos.z - (v.z + c * k.o), d = Math.hypot(dx, dz), min = k.r + 0.36;
        if (d < min && d > 1e-4) { p.pos.x += (dx / d) * (min - d); p.pos.z += (dz / d) * (min - d); }
      }
    }
  }

  // ----------------------------- colpi, grido, lancia -----------------------------
  _shotsAndTools(dt, a) {
    const p = this.player, call = this.dispatcher.active;
    if (p.shotEvent) {
      const s = p.shotEvent; p.shotEvent = null;
      this.crowd.scare(s.from.x, s.from.z, s.taser ? 14 : 38);
      if (call && call.onShot) call.onShot(s);
    }
    if (p.melee) { p.melee = false; if (call && call.onMelee) call.onMelee(p); this.crowd.scare(p.pos.x, p.pos.z, 6); }
    // grido "Fermo!" (solo forze dell'ordine)
    if (this.input.hit('KeyX') && !p.vehicle && this.faction.law) {
      this.toast(`«Fermi! ${this.faction.id === 'carabinieri' ? 'Carabinieri' : 'Polizia'}!»`, 'ok');
      this.crowd.scare(p.pos.x, p.pos.z, 10);
      if (call && call.onShout) call.onShout(p);
    }
    // idrante
    if (p.spraying) {
      const ch = p.char, o = ch.getMuzzle() || p.pos.clone().setY(p.pos.y + 1.2);
      const d = this.camRig.getRayDir().clone();
      this.fx.spray(o, d, dt); this.audio.hiss(true);
    } else this.audio.hiss(false);
    // fumo dai mezzi danneggiati
    for (const v of this.vehicles) if (v.disabled && R() < dt * 3) this.fx.smoke(v.x, v.y + 1.1, v.z, 0.9);
  }

  // ----------------------------- radio e rinforzi -----------------------------
  toggleRadio() {
    this.radioOpen = !this.radioOpen;
    this.ui.showRadio(this.radioOpen, this.radioOptions());
  }
  radioOptions() {
    const f = this.faction;
    const o = [];
    if (f.law) o.push({ label: 'Chiedi rinforzi (2 pattuglie)', fn: () => this.callUnit(f.id === 'polizia' ? ['giulia', 'cc_giulia'] : ['cc_giulia', 'giulia'], 'Rinforzi') });
    else o.push({ label: 'Chiedi supporto Polizia (2 pattuglie)', fn: () => this.callUnit(['giulia', 'giulietta'], 'Polizia') });
    if (f.id !== 'croce_rossa') o.push({ label: 'Chiedi un\'ambulanza', fn: () => this.callUnit(['ambulanza'], 'Ambulanza') });
    if (f.id !== 'vvf') o.push({ label: 'Chiedi i Vigili del Fuoco', fn: () => this.callUnit(['autopompa'], 'Vigili del Fuoco') });
    o.push({ label: 'Chiedi una nuova chiamata alla Centrale', fn: () => { if (this.missions.stage < 6) this.toast('Prima prendi servizio e sali sul veicolo.', 'err'); else if (!this.dispatcher.active && !this.dispatcher.offer) this.dispatcher.offerNew(); else this.toast('Hai già una chiamata.', 'err'); } });
    return o;
  }
  radioChoose(n) {
    const opts = this.radioOptions(), o = opts[n - 1];
    this.radioOpen = false; this.ui.showRadio(false);
    if (o) o.fn();
  }

  callUnit(types, label) {
    const p = this.player, w = this.world, g = w.graph;
    const px = p.vehicle ? p.vehicle.x : p.pos.x, pz = p.vehicle ? p.vehicle.z : p.pos.z;
    const ring = g.nodesInRing(px, pz, 220, 380);
    if (!ring.length) { this.toast('Nessuna unità disponibile.', 'err'); return; }
    this.radio(`📻 «${label} in arrivo sul posto.»`);
    types.forEach((type, i) => {
      const n = ring[(R() * ring.length) | 0];
      const e = n.adj[0]; if (!e) return;
      const rs = w.roadSpot(e, 4, 0.5 + i * 3);
      const v = this.spawnVehicle(type, rs.x, rs.z, rs.h, { tag: 'unit', locked: true });
      v.siren = true; v.unitLabel = label; v.life = 0;
      v.path = new PathDriver(g, R, { lane: 0, look: 10 }); v.repath = 0;
      v.controller = (dt, car) => this._unitDrive(dt, car);
    });
  }
  _unitDrive(dt, car) {
    const w = this.world, g = w.graph, p = this.player;
    car.life += dt;
    // bersaglio: auto in fuga (se c'è), altrimenti il giocatore
    const call = this.dispatcher.active;
    let tx = p.vehicle ? p.vehicle.x : p.pos.x, tz = p.vehicle ? p.vehicle.z : p.pos.z, chase = false;
    if (call && call.car && call.fleeing && !call.stopped && call.car.tag === 'suspect') { tx = call.car.x; tz = call.car.z; chase = true; }
    else if (call && call.spot && !call.finished) { tx = call.spot.x; tz = call.spot.z; }
    if (car.dismiss) { tx = car.dismissTo.x; tz = car.dismissTo.z; }
    car.repath -= dt;
    if (car.repath <= 0 || car.path.done) {
      car.repath = chase ? 1.0 : 2.5;
      const a = g.nearest(car.x, car.z, 200), b = g.nearest(tx, tz, 300);
      car.path.setPath(g.path(a, b));
    }
    const d = Math.hypot(tx - car.x, tz - car.z);
    const aim = car.path.aim(car.x, car.z);
    car.stuck = car.speed < 1.2 && d > 20 ? (car.stuck || 0) + dt : 0;
    if (car.stuck > 1.6) { car.rev = 1.0; car.stuck = 0; }
    if (car.rev > 0) { car.rev -= dt; return { throttle: 0, brake: 1, steer: (R() < 0.5 ? -1 : 1) * 0.5, handbrake: false }; }
    if (!chase && !car.dismiss && d < 28) return { throttle: 0, brake: 1, steer: 0, handbrake: car.speed > 4 };
    const lim = chase ? Math.min(aim.limit * 2.0, car.type.vmax * 0.6) : Math.min(aim.limit * 1.6, 24);
    const ctl = steerTo(car, chase && d < 25 ? tx : aim.tx, chase && d < 25 ? tz : aim.tz, aim.done ? 0 : lim);
    return ctl;
  }
  _backupUnits(dt) {
    const call = this.dispatcher.active, p = this.player;
    for (const v of this.vehicles.slice()) {
      if (v.tag !== 'unit') continue;
      if (!call && !v.dismiss && v.life > 40) { v.dismiss = true; const ring = this.world.graph.nodesInRing(v.x, v.z, 400, 700); const n = ring[(R() * ring.length) | 0]; v.dismissTo = n ? { x: n.x, z: n.z } : { x: v.x + 500, z: v.z }; }
      if (v.dismiss && Math.hypot(v.x - (p.vehicle ? p.vehicle.x : p.pos.x), v.z - (p.vehicle ? p.vehicle.z : p.pos.z)) > 280) this.removeVehicle(v);
    }
  }

  // ======================= HUD =======================
  updateHud(dt, a, center) {
    const p = this.player, m = this.missions, w = this.world, d = this.dispatcher;
    const o = (m.stage >= 6 ? d.objective() : m.objective()) || { title: '', sub: '' };
    const key = o.title + o.sub;
    if (this._objKey !== key) { this._objKey = key; this.ui.setObjective(o.title, o.sub); }
    this.ui.setPrompt(this.transition ? null : m.prompt);
    const h = Math.floor(w.hour), mm = Math.floor((w.hour - h) * 60);
    $('clock').textContent = `${String(h).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
    $('duty-badge').classList.toggle('hidden', !m.onDuty);
    $('duty-badge').textContent = `● ${this.faction.short}`;
    $('calls').textContent = d.done || d.arrests ? `Interventi: ${d.done}${this.faction.law ? ` · Arresti: ${d.arrests}` : ''}` : '';
    $('crosshair').classList.toggle('on', settings.crosshair && (p.aiming || p.spraying));
    const drv = p.vehicle;
    $('speedo').classList.toggle('hidden', !drv);
    $('weapon-box').classList.toggle('hidden', !!drv || !p.equipped);
    if (drv) {
      $('speed-val').textContent = Math.round(Math.abs(drv.vf) * 3.6);
      $('car-name').textContent = drv.type.name;
      $('siren-ind').classList.toggle('on', drv.siren);
      $('siren-ind').style.display = drv.type.emergency ? '' : 'none';
    } else if (p.equipped) {
      const n = { pistol: 'Beretta 92', taser: 'Taser X26', baton: 'Manganello', medkit: 'Kit di soccorso', hose: 'Lancia idrica' }[p.equipped];
      const s = { pistol: 'RMB mira · LMB spara', taser: 'RMB mira · LMB spara', baton: 'LMB colpisci', medkit: 'Avvicinati ai pazienti · E', hose: 'Tieni premuto LMB per spruzzare' }[p.equipped];
      $('weapon-box').innerHTML = `<div class="w-name">${n}</div><div class="w-sub">${s}</div>`;
    }
    // pressione inseguimento
    const call = d.active;
    const pur = $('pursuit');
    if (call && call.pressure !== undefined && call.phase !== 'go' && !call.stopped && call.phase !== 'stopped') {
      pur.classList.remove('hidden');
      const max = call.def.id === 'inseguimento' ? 8 : 4.5;
      $('pursuit-bar').style.width = `${Math.min(100, (call.pressure / max) * 100)}%`;
    } else pur.classList.add('hidden');

    // minimappa
    const px = drv ? drv.x : p.pos.x, pz = drv ? drv.z : p.pos.z;
    const facing = drv ? drv.h : p.rot;
    const blips = (m.stage < 6 ? m.blips() : d.blips());
    const icons = [{ x: this.hq.door.x, z: this.hq.door.z, color: this.faction.color }];
    if (this.faction.id === 'croce_rossa' || (call && call.hospital)) for (const hs of w.hospitals) icons.push({ x: hs.x, z: hs.z, color: '#d9202a' });
    const zoom = drv ? 0.85 + Math.min(0.5, Math.abs(drv.vf) * 0.012) : 1.7;
    const t = performance.now() / 1000;
    this.mapR.drawMini($('minimap').getContext('2d'), 240, px, pz, this.camRig.yaw, zoom, blips, facing, t, icons);
    $('street').textContent = this.hq.inside(px, pz) ? this.faction.hq : (w.streetName(px, pz) || 'Napoli');
    if (this.bigMap) {
      const c = $('bigmap-canvas');
      this.mapR.drawFull(c.getContext('2d'), c.width, c.height, { player: { x: px, z: pz, facing }, blips, icons });
    }
    this.updateWaypoints(blips, px, pz);
  }

  updateWaypoints(blips, px, pz) {
    const wrap = $('waypoints');
    while (this.wps.length < blips.length) { const d = document.createElement('div'); d.className = 'wp'; d.innerHTML = '<span></span><i></i><small></small>'; wrap.appendChild(d); this.wps.push(d); }
    const v = new THREE.Vector3();
    this.wps.forEach((el, i) => {
      const b = blips[i], beam = this.beams[i];
      if (!b) { el.style.display = 'none'; if (beam) beam.visible = false; return; }
      const dist = Math.hypot(b.x - px, b.z - pz);
      const gy = this.world.groundY(b.x, b.z);
      if (beam) { beam.visible = dist > 3; beam.position.set(b.x, gy + 59, b.z); beam.material.color.set(b.color || '#ffd24a'); }
      v.set(b.x, gy + 3.2, b.z).project(this.camera);
      const behind = v.z > 1;
      let sx = (v.x * 0.5 + 0.5) * innerWidth, sy = (-v.y * 0.5 + 0.5) * innerHeight;
      if (behind) { sx = innerWidth - sx; sy = innerHeight - 70; }
      const edge = behind || sx < 40 || sx > innerWidth - 40 || sy < 70 || sy > innerHeight - 40;
      sx = clamp(sx, 50, innerWidth - 50); sy = clamp(sy, 90, innerHeight - 60);
      el.style.display = dist < 2.5 ? 'none' : '';
      el.style.left = `${sx}px`; el.style.top = `${sy}px`;
      el.classList.toggle('edge', edge);
      el.children[0].textContent = b.label || '';
      el.children[2].textContent = `${dist >= 1000 ? (dist / 1000).toFixed(1) + ' km' : Math.round(dist) + ' m'}`;
    });
  }

  // ======================= admin =======================
  _makeAdmin() {
    const g = this;
    return {
      teleport(id) {
        const C = g.world.city;
        if (g.player.vehicle) g.exitVehicle(true);
        if (id.startsWith('hq_')) { const h = g.world.hqs[id.slice(3)]; return g.player.teleport(h.door.x - 3, h.door.z + 12, 0); }
        if (id === 'hq_in') return g.player.teleport(g.hq.door.x, g.hq.door.z - 4, 0);
        const s = C.spawns.find((x) => x.id === id);
        if (s && !s.hq) { g.player.teleport(s.x, s.z, Math.atan2(-Math.sin(s.yaw), -Math.cos(s.yaw))); g.camRig.yaw = s.yaw; }
      },
      setHour(h) { g.world.hour = h; g.world.setTimeOfDay(h); },
      setNoclip(v) { g.player.noclip = v; },
      stage(n) { g.missions.setStage(n); if (n >= 5) g.missions.assigned = g.vehicles.find((v) => v.tag === 'hq') || null; if (n >= 6) g.dispatcher.start(); },
      spawnCar(type) {
        const p = g.player, yaw = p.rot;
        const v = g.spawnVehicle(type, p.pos.x + Math.sin(yaw) * 7, p.pos.z + Math.cos(yaw) * 7, yaw, { tag: 'driven' });
        v.locked = false; g.toast(`Generato: ${v.type.name}`, 'ok');
      },
      call(id) { if (g.dispatcher.active) { g.dispatcher.active.cleanup(); g.dispatcher.active = null; } g.dispatcher.start(); g.dispatcher.offer = null; if (g.dispatcher.offerNew(id)) g.dispatcher.accept(); else g.toast('Impossibile generare la chiamata qui.', 'err'); },
      faction(id) { g.faction = FACTIONS[id]; g.hq = g.world.hqs[id]; g.resetGame('hq', false); g.toast(`Corpo: ${g.faction.name}`, 'ok'); },
      action(k) {
        const m = g.missions;
        if (k === 'duty') { m.setStage(Math.max(m.stage, 2), true); g.toast('Sei in servizio', 'ok'); }
        else if (k === 'uniform') { m.setStage(Math.max(m.stage, 3), true); g.toast('Divisa indossata', 'ok'); }
        else if (k === 'weapons') { m.setStage(Math.max(m.stage, 4), true); g.toast('Attrezzatura ricevuta', 'ok'); }
        else if (k === 'all') { m.setStage(6, true); m.assigned = g.vehicles.find((v) => v.tag === 'hq'); g.dispatcher.start(); g.toast('Kit completo: sali sul veicolo', 'ok'); }
        else if (k === 'civil') { m.setStage(0, true); g.toast('Di nuovo cittadino', 'ok'); }
        else if (k === 'reset') { g.resetGame('hq', false); g.toast('Partita azzerata', 'ok'); }
        else if (k === 'unlock') { g.vehicles.forEach((v) => (v.locked = false)); g.toast('Tutti i mezzi sbloccati', 'ok'); }
        else if (k === 'carhere') { const v = g.vehicles.find((x) => x.tag === 'hq'); const p = g.player; if (v && !v.occupied) v.setPose(p.pos.x + Math.sin(p.rot) * 6, p.pos.z + Math.cos(p.rot) * 6, p.rot); }
        else if (k === 'backup') g.radioChoose(1);
      },
      info() {
        const p = g.player, r = g.renderer.info.render;
        return `pos  x ${p.pos.x.toFixed(0)}  z ${p.pos.z.toFixed(0)}  y ${p.pos.y.toFixed(1)}\ncorpo ${g.faction.short} · fase ${g.missions.stage}\nFPS ${g.fps.toFixed(0)}  draw ${r.calls}  tri ${(r.triangles / 1000).toFixed(0)}k\npedoni ${g.crowd.peds.length}  auto ${g.traffic.cars.length}  veicoli ${g.vehicles.length}\npunteggio ${g.score}`;
      },
    };
  }
}

const game = new Game();
window.__game = game;
window.__settings = settings;
