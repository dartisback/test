import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { settings } from './settings.js';
import { clamp, damp } from './util.js';
import { World } from './world.js';
import { Input } from './input.js';
import { AudioSys } from './audio.js';
import { UI } from './ui.js';
import { Player } from './player.js';
import { CameraRig } from './camera.js';
import { Vehicle } from './vehicle.js';
import { Missions } from './missions.js';
import { MapRenderer } from './minimap.js';
import { FX } from './fx.js';
import { Q, streetNameAt, insideQuestura } from './layout.js';

const $ = (id) => document.getElementById(id);
const nextFrame = () => new Promise((r) => requestAnimationFrame(() => r()));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

class Game {
  constructor() {
    this.canvas = $('view');
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.55;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(settings.fov, innerWidth / innerHeight, 0.2, 4200);
    this.audio = new AudioSys();
    this.ui = new UI(); this.ui.game = this;
    this.input = new Input(this.canvas);
    this.input.onLockChange = (l) => this.onLockChange(l);
    this.world = new World(this.scene);
    this.mapR = new MapRenderer(this.world.layout);
    this.clock = new THREE.Clock();

    this.state = 'menu';        // menu | loading | ready | playing
    this.built = false;
    this.modal = false;
    this.forceRun = false;       // per i test automatici
    this.timeScale = 30;
    this.carMul = 1;
    this.todTimer = 0;
    this.fps = 60; this.fpsAcc = 0; this.fpsN = 0;
    this.lockAt = 0;
    this.transition = false;
    this.bigMap = false;
    this.beams = [];
    this.wps = [];
    this.admin = this._makeAdmin();

    addEventListener('resize', () => this.resize());
    this.resize();
    this.applySettings();
    this.ui.show('home');
    this.frame = this.frame.bind(this);
    requestAnimationFrame(this.frame);
  }

  resize() {
    const dpr = Math.min(devicePixelRatio || 1, 1.5) * settings.resolution;
    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(innerWidth, innerHeight, false);
    this.camera.aspect = innerWidth / innerHeight;
    this.camera.updateProjectionMatrix();
  }

  applySettings() {
    this.resize();
    const w = this.world;
    if (w.sun) {
      w.sun.castShadow = settings.shadows !== 'off';
      const size = settings.shadows === 'low' ? 1024 : 2048;
      if (w.sun.shadow.mapSize.x !== size) {
        w.sun.shadow.mapSize.set(size, size);
        if (w.sun.shadow.map) { w.sun.shadow.map.dispose(); w.sun.shadow.map = null; }
      }
      this.scene.fog.near = 120 * settings.viewDist; this.scene.fog.far = 900 * settings.viewDist;
    }
    this.audio.applyVolumes();
    $('fps').style.display = settings.showFps ? '' : 'none';
  }

  // ======================= avvio partita =======================
  async startNewGame(spawnId, duty) {
    try {
      await this._startNewGame(spawnId, duty);
    } catch (e) {
      console.error(e);
      this.state = 'menu';
      this.ui.setProgress(0, `Errore di caricamento: ${e.message}`);
      $('loading-tip').innerHTML = '<button class="btn" onclick="location.reload()">Ricarica la pagina</button>';
    }
  }

  async _startNewGame(spawnId, duty) {
    this.audio.init();
    this.state = 'loading';
    this.ui.startLoading();
    await nextFrame();
    if (!this.built) {
      await this.world.build((p, t) => this.ui.setProgress(p * 0.82, t));
      const pm = new THREE.PMREMGenerator(this.renderer);
      this.scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture;
      this.scene.environmentIntensity = 0.5;
      this.createEntities();
      this.built = true;
    }
    this.ui.setProgress(0.88, 'Posizionamento volanti…'); await sleep(30);
    const spawn = this.world.layout.spawns.find((s) => s.id === spawnId) || this.world.layout.spawns[0];
    this.resetGame(spawn, duty);
    this.ui.setProgress(0.95, 'Compilazione shader…'); await sleep(30);
    this.camRig.update(0.016, { lookX: 0, lookY: 0, wheel: 0 }, this.player.pos, { mode: 'foot' });
    try { this.renderer.compile(this.scene, this.camera); } catch (e) { /* ignore */ }
    this.ui.setProgress(1, 'Pronto!'); await sleep(250);
    this.state = 'ready';
    this.applySettings();
    this.ui.show('click');
  }

  createEntities() {
    this.fx = new FX(this.scene);
    this.player = new Player(this.scene, this.world, this.audio, this.fx);
    this.camRig = new CameraRig(this.camera, this.world);
    this.vehicles = [];
    for (const [i, id] of ['giulia', 'giulietta', 'giulia', 'giulietta'].entries()) {
      const v = new Vehicle(id, this.world);
      this.scene.add(v.group);
      this.vehicles.push(v);
    }
    // luci mobili (sirena + fari): sempre in scena per non ricompilare gli shader
    const g = new THREE.Group();
    this.rig = {
      group: g,
      blueL: new THREE.PointLight(0x2a5cff, 0, 26, 1.4),
      blueR: new THREE.PointLight(0x2a5cff, 0, 26, 1.4),
      spot: new THREE.SpotLight(0xfff0cf, 0, 70, 0.55, 0.55, 1.2),
      target: new THREE.Object3D(),
    };
    this.rig.blueL.position.set(-0.45, 1.95, 0.15); this.rig.blueR.position.set(0.45, 1.95, 0.15);
    this.rig.spot.position.set(0, 0.9, 2.1); this.rig.target.position.set(0, 0.2, 18);
    this.rig.spot.target = this.rig.target;
    g.add(this.rig.blueL, this.rig.blueR, this.rig.spot, this.rig.target);
    this.scene.add(g);
    this.missions = new Missions(this);
    // marcatori 3D degli obiettivi
    const beamMat = new THREE.MeshBasicMaterial({ color: 0xffd24a, transparent: true, opacity: 0.28, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
    for (let i = 0; i < 3; i++) {
      const m = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 90, 16, 1, true), beamMat);
      const ring = new THREE.Mesh(new THREE.RingGeometry(0.8, 1.1, 32).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xffd24a, transparent: true, opacity: 0.9, depthWrite: false, side: THREE.DoubleSide }));
      ring.position.y = -44.9;
      m.add(ring); m.visible = false; this.scene.add(m); this.beams.push(m);
    }
  }

  resetGame(spawn, duty) {
    if (this.player.vehicle) this.exitVehicle(true);
    this.vehicles.forEach((v, i) => {
      const b = Q.bays[i];
      v.setPose(b.x, b.z, b.heading); v.siren = false; v.lightsOn = false; v.occupied = false; v.locked = true;
      v.update(0.001, null, null, this.world.grid);
    });
    this.player.teleport(spawn.x, spawn.z, Math.atan2(-Math.sin(spawn.yaw), -Math.cos(spawn.yaw)));
    this.camRig.yaw = spawn.yaw; this.camRig.pitch = 0.2; this.camRig.curDist = 3.4;
    this.player.noclip = false; this.player.speedMul = 1; this.player.jumpMul = 1; this.carMul = 1;
    this.player.crouch = false;
    this.world.setTimeOfDay(15.5); this.timeScale = 30;
    this.missions.reset();
    this.missions.setStage(0, true);
    if (duty) {
      this.missions.setStage(5, true);
      this.missions.assigned = this.vehicles[0];
      const b = Q.bays[0];
      this.player.teleport(b.x + 2.4, b.z - 1, Math.PI / 2);
      this.camRig.yaw = -Math.PI / 2;
    }
    this.audio.setSiren(false); this.audio.stopEngine(); this.audio.setHorn(false);
  }

  beginPlay() {
    this.audio.init(); this.audio.resume();
    this.ui.hideAll(); this.ui.showHud(true);
    this.state = 'playing'; this.modal = false;
    this.input.enabled = true;
    this.lockAt = performance.now();
    this.input.requestLock();
    this.ui.context = 'game';
    this.showHelp(true);
    setTimeout(() => this.showHelp(false), 9000);
  }

  showHelp(on) { $('help-panel').classList.toggle('hidden', !on); }

  // ======================= pausa / modali =======================
  onLockChange(locked) {
    if (this.state !== 'playing') return;
    if (locked) { this.ui.hideAll(); this.modal = false; return; }
    if (!this.modal) this.pause();
  }
  pause() {
    this.ui.context = 'pause';
    this.ui.show('pause');
  }
  resume() {
    this.ui.context = 'game';
    this.ui.hideAll();
    this.lockAt = performance.now();
    this.input.requestLock();
  }
  quitToMenu() {
    if (this.player && this.player.vehicle) this.exitVehicle(true);
    this.audio.setSiren(false); this.audio.stopEngine(); this.audio.setHorn(false);
    this.state = 'menu'; this.modal = false; this.input.enabled = false;
    this.ui.showHud(false);
    this.ui.context = 'home';
    this.ui.show('home');
  }
  onModalOpen() { this.modal = true; this.input.exitLock(); }
  closeKeys() { this.modal = false; this.ui.hideAll(); this.lockAt = performance.now(); this.input.requestLock(); }
  openAdmin() {
    this.ui.context = 'game'; this.modal = true; this.input.exitLock(); this.ui.show('admin');
  }
  closeAdmin() { this.modal = false; this.ui.context = 'game'; this.ui.hideAll(); this.lockAt = performance.now(); this.input.requestLock(); }

  fadeTransition(cb) {
    if (this.transition) return;
    this.transition = true;
    const f = $('fade'); f.classList.add('on');
    this.audio.door();
    setTimeout(() => { cb(); setTimeout(() => { f.classList.remove('on'); this.transition = false; }, 450); }, 500);
  }

  // ======================= veicoli =======================
  nearestVehicle(maxD) {
    const p = this.player.pos;
    let best = null, bd = maxD;
    for (const v of this.vehicles) {
      const s = Math.sin(v.h), c = Math.cos(v.h);
      for (const k of v.circles) {
        const d = Math.hypot(p.x - (v.x + s * k.o), p.z - (v.z + c * k.o)) - k.r;
        if (d < bd) { bd = d; best = v; }
      }
    }
    return best;
  }

  enterVehicle(v) {
    const p = this.player, ch = p.char;
    p.equip && ch.setWeapon(null);
    p.equipped = null;
    p.vehicle = v; v.occupied = true;
    this.scene.remove(ch.group);
    v.body.add(ch.group);
    ch.group.position.set(0.45, 0.0, -0.2); ch.group.rotation.set(0, 0, 0);
    ch.setSeated(true);
    v.group.add(this.rig.group);
    this.rig.group.position.set(0, 0, 0);
    v.lightsOn = this.world.nightAmt > 0.3;
    this.audio.startEngine();
    this.camRig.snapBehind(v.h);
    this.camRig.curDist = 6;
    this.missions.onEnterVehicle(v);
    this.audio.door();
  }
  exitVehicle(silent = false) {
    const p = this.player, v = p.vehicle, ch = p.char;
    if (!v) return;
    const pos = v.findExit(this.world.grid);
    v.body.remove(ch.group);
    this.scene.add(ch.group);
    ch.setSeated(false);
    p.vehicle = null; v.occupied = false;
    p.teleport(pos.x, pos.z, v.h);
    this.scene.add(this.rig.group);
    this.rig.group.position.set(0, 0, 0);
    this.rig.blueL.intensity = this.rig.blueR.intensity = this.rig.spot.intensity = 0;
    v.siren = false; v.lightsOn = false;
    this.audio.setSiren(false); this.audio.setHorn(false); this.audio.stopEngine();
    this.camRig.curDist = 3.4;
    if (!silent) this.audio.door();
  }
  _pushPlayerOutOfCars() {
    const p = this.player;
    if (p.vehicle) return;
    for (const v of this.vehicles) {
      const s = Math.sin(v.h), c = Math.cos(v.h);
      for (const k of v.circles) {
        const dx = p.pos.x - (v.x + s * k.o), dz = p.pos.z - (v.z + c * k.o);
        const d = Math.hypot(dx, dz), min = k.r + 0.36;
        if (d < min && d > 1e-4) { p.pos.x += (dx / d) * (min - d); p.pos.z += (dz / d) * (min - d); }
      }
    }
  }

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
      // menu: ruota lentamente sopra la città
      this.menuT = (this.menuT || 0) + dt;
      const t = this.menuT * 0.05;
      this.camera.position.set(Math.cos(t) * 150 - 20, 55, Math.sin(t) * 150 - 60);
      this.camera.lookAt(-20, 6, -60);
      this.world.update(dt, new THREE.Vector3(-20, 0, -60));
      this.renderer.toneMappingExposure = this.world.exposure;
      this.renderer.render(this.scene, this.camera);
    }
  }

  update(dt) {
    const p = this.player, input = this.input;
    const lockOk = input.locked || this.forceRun;
    // se il puntatore non è bloccato e non ci sono finestre aperte, vai in pausa
    if (!lockOk && !this.modal && this.ui.screen === null && performance.now() - this.lockAt > 900) this.pause();
    const running = lockOk && !this.modal && this.ui.screen === null;
    const a = input.poll(dt);
    if (running) {
      this.step(dt, a);
    } else {
      this.world.update(dt, p.vehicle ? new THREE.Vector3(p.vehicle.x, 0, p.vehicle.z) : p.pos);
      if (p.vehicle) this.audio.setEngine(0, 0);
    }
    input.endFrame();
  }

  step(dt, a) {
    const p = this.player, w = this.world, m = this.missions;
    // ora del giorno
    w.hour = (w.hour + (dt * this.timeScale) / 3600) % 24;
    this.todTimer += dt;
    if (this.todTimer > 0.15) { this.todTimer = 0; w.setTimeOfDay(w.hour); }

    if (a.admin) { this.openAdmin(); return; }
    if (a.help) this.showHelp($('help-panel').classList.contains('hidden'));
    if (a.map) { this.bigMap = !this.bigMap; $('bigmap').classList.toggle('hidden', !this.bigMap); }

    // salire / scendere
    if (a.vehicle && !this.transition) {
      if (p.vehicle) { if (Math.abs(p.vehicle.vf) < 6) this.exitVehicle(); else this.ui.toast('Fermati prima di scendere.', 'err'); }
      else {
        const v = this.nearestVehicle(2.4);
        if (v) {
          if (v.locked) { this.ui.toast('Devi prima entrare in servizio e ritirare le chiavi.', 'err'); this.audio.ui('err'); }
          else this.enterVehicle(v);
        }
      }
    }

    // veicoli
    const drv = p.vehicle;
    let ctrl = null;
    if (drv) {
      ctrl = { throttle: a.throttle, brake: a.brake, steer: a.steer, handbrake: a.handbrake, power: this.carMul };
      if (a.siren) { drv.siren = !drv.siren; this.audio.setSiren(drv.siren); this.audio.ui('click'); }
      if (a.lights) { drv.lightsOn = !drv.lightsOn; }
      this.audio.setHorn(a.horn);
      this.audio.setEngine(Math.abs(drv.vf), a.throttle);
    }
    for (const v of this.vehicles) v.update(dt, v === drv ? ctrl : null, this.vehicles, w.grid);
    if (drv && drv.impact > 3) { this.audio.thud(drv.impact); this.camRig.shake = Math.min(0.3, drv.impact * 0.02); }
    this._pushPlayerOutOfCars();

    // giocatore (camera già aggiornata al frame prima)
    if (!drv) p.update(dt, a, this.camRig); else p.update(dt, a, this.camRig);

    m.update(dt, a);

    // luci del veicolo guidato
    if (drv) {
      const flash = Math.floor(performance.now() / 110) % 2;
      this.rig.blueL.intensity = drv.siren ? (flash ? 60 : 4) : 0;
      this.rig.blueR.intensity = drv.siren ? (flash ? 4 : 60) : 0;
      this.rig.spot.intensity = drv.lightsOn ? 140 : 0;
    }

    // camera
    const center = drv ? new THREE.Vector3(drv.x, 0, drv.z) : p.pos;
    this.camRig.update(dt, a, center, {
      mode: drv ? 'car' : 'foot', heading: drv ? drv.h : 0, speed: drv ? drv.speed : 0,
      crouch: p.crouch || a.crouchHold, aim: p.aiming,
    });
    // dentro la Questura la camera non deve superare il soffitto
    if (!drv && insideQuestura(p.pos.x, p.pos.z) && this.camera.position.y > Q.ceil - 0.25) {
      this.camera.position.y = Q.ceil - 0.25;
      this.camera.lookAt(this.camRig.pivot);
    }
    w.update(dt, center);
    this.fx.update(dt);
    this.updateHud(dt, a, center);
  }

  // ======================= HUD =======================
  updateHud(dt, a, center) {
    const p = this.player, m = this.missions, w = this.world;
    const o = m.objective();
    if (this._objKey !== o.title + o.sub) { this._objKey = o.title + o.sub; this.ui.setObjective(o.title, o.sub); }
    this.ui.setPrompt(this.transition ? null : m.prompt);
    const h = Math.floor(w.hour), mm = Math.floor((w.hour - h) * 60);
    $('clock').textContent = `${String(h).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
    $('duty-badge').classList.toggle('hidden', !m.onDuty);
    $('calls').textContent = m.callsDone ? `Interventi: ${m.callsDone}` : '';
    $('crosshair').classList.toggle('on', settings.crosshair && p.aiming);

    const drv = p.vehicle;
    $('speedo').classList.toggle('hidden', !drv);
    $('weapon-box').classList.toggle('hidden', !!drv || !p.equipped);
    if (drv) {
      $('speed-val').textContent = Math.round(Math.abs(drv.vf) * 3.6);
      $('car-name').textContent = drv.type.name;
      $('siren-ind').classList.toggle('on', drv.siren);
    } else if (p.equipped) {
      const n = { pistol: 'Beretta 92', taser: 'Taser X26', baton: 'Manganello' }[p.equipped];
      const s = { pistol: 'RMB mira · LMB spara', taser: 'RMB mira · LMB spara', baton: 'LMB colpisci' }[p.equipped];
      $('weapon-box').innerHTML = `<div class="w-name">${n}</div><div class="w-sub">${s}</div>`;
    }

    // minimappa
    const px = drv ? drv.x : p.pos.x, pz = drv ? drv.z : p.pos.z;
    const facing = drv ? drv.h : p.rot;
    const blips = m.blips();
    const zoom = drv ? 1.15 + 0.0 : 1.9;
    this.mapR.drawMini($('minimap').getContext('2d'), 240, px, pz, this.camRig.yaw, zoom, blips, facing, performance.now() / 1000);
    $('street').textContent = insideQuestura(px, pz) ? 'Questura di Belluno' : (streetNameAt(px, pz) || 'Belluno');
    if (this.bigMap) {
      const c = $('bigmap-canvas');
      this.mapR.drawFull(c.getContext('2d'), c.width, c.height, { player: { x: px, z: pz, facing }, blips });
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
      if (beam) { beam.visible = dist > 3; beam.position.set(b.x, 45, b.z); }
      v.set(b.x, 3.2, b.z).project(this.camera);
      const behind = v.z > 1;
      let sx = (v.x * 0.5 + 0.5) * innerWidth, sy = (-v.y * 0.5 + 0.5) * innerHeight;
      if (behind) { sx = innerWidth - sx; sy = innerHeight - 70; }
      const edge = behind || sx < 40 || sx > innerWidth - 40 || sy < 70 || sy > innerHeight - 40;
      sx = clamp(sx, 50, innerWidth - 50); sy = clamp(sy, 90, innerHeight - 60);
      el.style.display = dist < 2.5 ? 'none' : '';
      el.style.left = `${sx}px`; el.style.top = `${sy}px`;
      el.classList.toggle('edge', edge);
      el.children[0].textContent = b.label || '';
      el.children[2].textContent = `${Math.round(dist)} m`;
    });
  }

  // ======================= admin =======================
  _makeAdmin() {
    const g = this;
    return {
      teleport(id) {
        const L = g.world.layout;
        if (g.player.vehicle) g.exitVehicle(true);
        if (id === 'questura_in') return g.player.teleport(-30, -138, 0);
        if (id === 'yard') return g.player.teleport(8, -168, 0);
        if (id === 'martiri2') return g.player.teleport(105, 150, 0);
        const s = L.spawns.find((x) => x.id === id);
        if (s) { g.player.teleport(s.x, s.z, Math.atan2(-Math.sin(s.yaw), -Math.cos(s.yaw))); g.camRig.yaw = s.yaw; }
      },
      setHour(h) { g.world.hour = h; g.world.setTimeOfDay(h); },
      setNoclip(v) { g.player.noclip = v; },
      stage(n) { g.missions.setStage(n); if (n >= 5) g.missions.assigned = g.vehicles[0]; },
      spawnCar(type) {
        const p = g.player;
        const v = new Vehicle(type, g.world);
        const yaw = p.rot;
        v.setPose(p.pos.x + Math.sin(yaw) * 6, p.pos.z + Math.cos(yaw) * 6, yaw);
        v.locked = false;
        g.scene.add(v.group); g.vehicles.push(v);
        g.ui.toast(`Generata: ${v.type.name}`, 'ok');
      },
      action(k) {
        const m = g.missions;
        if (k === 'duty') { m.setStage(Math.max(m.stage, 2), true); g.ui.toast('Sei in servizio', 'ok'); }
        else if (k === 'uniform') { m.setStage(Math.max(m.stage, 3), true); g.ui.toast('Divisa indossata', 'ok'); }
        else if (k === 'weapons') { m.setStage(Math.max(m.stage, 4), true); g.ui.toast('Armi ricevute', 'ok'); }
        else if (k === 'all') { m.setStage(5, true); m.assigned = g.vehicles[0]; g.ui.toast('Kit completo: vai alla volante', 'ok'); }
        else if (k === 'civil') { m.setStage(0, true); g.ui.toast('Di nuovo cittadino', 'ok'); }
        else if (k === 'reset') { m.reset(); m.setStage(0, true); g.ui.toast('Missione azzerata', 'ok'); }
        else if (k === 'unlock') { g.vehicles.forEach((v) => (v.locked = false)); g.ui.toast('Tutte le auto sbloccate', 'ok'); }
        else if (k === 'carhere') {
          const v = g.vehicles[0]; const p = g.player;
          if (v && !v.occupied) v.setPose(p.pos.x + Math.sin(p.rot) * 5, p.pos.z + Math.cos(p.rot) * 5, p.rot);
        }
      },
      info() {
        const p = g.player, r = g.renderer.info.render;
        return `pos  x ${p.pos.x.toFixed(1)}  z ${p.pos.z.toFixed(1)}\nfase ${g.missions.stage} (${g.missions.stageName})\nFPS ${g.fps.toFixed(0)}  draw ${r.calls}  tri ${(r.triangles / 1000).toFixed(0)}k\nveicoli ${g.vehicles.length}  collider ${g.world.grid.all.length}\nora ${g.world.hour.toFixed(2)}  notte ${g.world.nightAmt?.toFixed(2)}`;
      },
    };
  }
}

const game = new Game();
window.__game = game;
window.__settings = settings;
