import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { clamp, lerp, damp } from './util.js';
import { makeCanvas } from './textures.js';

const M = (color, rough = 0.85, metal = 0) => new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal });

const backCache = {};
function backTextTexture(text = 'POLIZIA') {
  if (backCache[text]) return backCache[text];
  const c = makeCanvas(512, 128), g = c.getContext('2d');
  g.clearRect(0, 0, 512, 128);
  g.fillStyle = '#f4f4f4'; g.font = `bold ${text.length > 9 ? 56 : 92}px Arial`; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(text, 256, 66, 500);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; backCache[text] = t; return t;
}

const crossTex = (() => { let t; return () => (t || (t = (() => { const c = makeCanvas(64, 64), g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, 64, 64); g.fillStyle = '#d0202a'; g.fillRect(24, 8, 16, 48); g.fillRect(8, 24, 48, 16); const x = new THREE.CanvasTexture(c); x.colorSpace = THREE.SRGBColorSpace; return x; })())); })();

const OUTFITS = {
  civil: { shirt: 0x56667d, pants: 0x2c3e5e, shoe: 0xeeeeee },
  polizia: { shirt: 0x131c36, pants: 0x0e1526, shoe: 0x0c0c0e, belt: 0x111111, holster: true, text: 'POLIZIA', hat: 'cap', hatColor: 0x141d38, band: 0xb3202a, pipe: 0xb3202a },
  carabinieri: { shirt: 0x0e1730, pants: 0x0a0f1e, shoe: 0x0c0c0e, belt: 0xe8e8e8, holster: true, text: 'CARABINIERI', hat: 'cap', hatColor: 0x0e1730, band: 0xc4202a, pipe: 0xc4202a },
  croce_rossa: { shirt: 0xd0202a, pants: 0x1d2b4a, shoe: 0x15171a, text: 'CROCE ROSSA', pipe: 0xf0f0f0, reflect: true },
  vvf: { shirt: 0x8a1d16, pants: 0x141a2a, shoe: 0x111111, belt: 0x222222, text: 'VIGILI DEL FUOCO', hat: 'helmet', hatColor: 0xf2f2f2, pipe: 0xe0c020, reflect: true },
};

/**
 * Personaggio umanoide procedurale (≈1.78 m) con animazioni procedurali:
 * camminata, corsa, accovacciata, salto, mira, sparo, manganello e posa da seduto (in auto).
 * Outfit: 'civil' (abiti civili) | 'uniform' (divisa Polizia di Stato).
 */
export function createCharacter() {
  const root = new THREE.Group();
  const body = new THREE.Group(); root.add(body);

  const skin = M(0xd4a283, 0.7);
  const hairMat = M(0x2a1f18, 0.9);
  const shirt = M(0x56667d, 0.9);
  const pants = M(0x2c3e5e, 0.9);
  const shoe = M(0xeeeeee, 0.7);
  const belt = M(0x111111, 0.6, 0.2);
  const red = M(0xb3202a, 0.6);
  const black = M(0x15171a, 0.5, 0.4);

  const mesh = (geo, mat, x = 0, y = 0, z = 0) => {
    const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = false; return m;
  };
  const cap = (r, len, mat) => new THREE.CapsuleGeometry(r, len, 4, 10);

  // ---------- bacino / gambe ----------
  const hips = new THREE.Group(); hips.position.y = 0.93; body.add(hips);
  hips.add(mesh(new RoundedBoxGeometry(0.34, 0.2, 0.2, 3, 0.06), pants, 0, -0.02, 0));
  const leg = (sx) => {
    const hip = new THREE.Group(); hip.position.set(sx * 0.095, -0.05, 0); hips.add(hip);
    hip.add(mesh(cap(0.075, 0.28), pants, 0, -0.215, 0));
    const knee = new THREE.Group(); knee.position.y = -0.43; hip.add(knee);
    knee.add(mesh(cap(0.062, 0.28), pants, 0, -0.2, 0));
    const foot = new THREE.Group(); foot.position.y = -0.4; knee.add(foot);
    foot.add(mesh(new RoundedBoxGeometry(0.1, 0.09, 0.26, 2, 0.03), shoe, 0, -0.005, 0.06));
    const stripe = mesh(new THREE.BoxGeometry(0.012, 0.8, 0.03), red, sx * 0.075, 0, 0); stripe.visible = false; stripe.position.set(sx * 0.082, -0.23, 0);
    stripe.scale.y = 0.85; hip.add(stripe);
    return { hip, knee, foot, stripe };
  };
  const legL = leg(-1), legR = leg(1);

  // ---------- busto ----------
  const spine = new THREE.Group(); spine.position.y = 0.0; hips.add(spine);
  spine.add(mesh(new RoundedBoxGeometry(0.4, 0.56, 0.22, 4, 0.08), shirt, 0, 0.3, 0));
  const beltMesh = mesh(new RoundedBoxGeometry(0.41, 0.06, 0.235, 2, 0.02), belt, 0, 0.04, 0); beltMesh.visible = false; spine.add(beltMesh);
  const holster = mesh(new THREE.BoxGeometry(0.06, 0.17, 0.1), black, 0.22, -0.08, 0.02); holster.visible = false; spine.add(holster);
  const radio = mesh(new THREE.BoxGeometry(0.05, 0.1, 0.035), black, -0.13, 0.5, 0.115); radio.visible = false; spine.add(radio);
  const patch = mesh(new THREE.PlaneGeometry(0.07, 0.05), M(0xffffff, 0.8), 0.1, 0.45, 0.113); patch.visible = false; spine.add(patch);
  const backTxt = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.085), new THREE.MeshBasicMaterial({ map: backTextTexture(), transparent: true }));
  backTxt.position.set(0, 0.42, -0.116); backTxt.rotation.y = Math.PI; backTxt.visible = false; spine.add(backTxt);
  // filetti rossi della divisa (spalle e fianchi)
  const pipes = [];
  for (const sx of [-1, 1]) {
    const p1 = mesh(new THREE.BoxGeometry(0.012, 0.52, 0.012), red, sx * 0.201, 0.3, 0.0); p1.visible = false; spine.add(p1); pipes.push(p1);
    const p2 = mesh(new THREE.BoxGeometry(0.1, 0.012, 0.226), red, sx * 0.14, 0.575, 0); p2.visible = false; spine.add(p2); pipes.push(p2);
  }
  const collar = mesh(new THREE.BoxGeometry(0.17, 0.035, 0.12), shirt, 0, 0.6, 0);
  spine.add(collar);

  const neck = mesh(new THREE.CylinderGeometry(0.045, 0.05, 0.1, 10), skin, 0, 0.63, 0); spine.add(neck);
  const head = new THREE.Group(); head.position.y = 0.76; spine.add(head);
  const skull = mesh(new THREE.SphereGeometry(0.105, 20, 16), skin, 0, 0, 0); skull.scale.set(0.92, 1.12, 1.0); head.add(skull);
  const nose = mesh(new THREE.ConeGeometry(0.018, 0.04, 6), skin, 0, -0.01, 0.105); nose.rotation.x = Math.PI / 2; head.add(nose);
  for (const sx of [-1, 1]) {
    head.add(mesh(new THREE.SphereGeometry(0.012, 8, 6), M(0x111111), sx * 0.04, 0.02, 0.095));
    head.add(mesh(new THREE.SphereGeometry(0.02, 8, 6), skin, sx * 0.1, -0.005, 0));
  }
  const hair = mesh(new THREE.SphereGeometry(0.11, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.55), hairMat, 0, 0.012, -0.005); hair.scale.set(0.95, 1.15, 1.05); head.add(hair);
  const ponytail = mesh(new THREE.CapsuleGeometry(0.025, 0.1, 3, 6), hairMat, 0, -0.04, -0.12); ponytail.visible = false; head.add(ponytail);
  // cappello della divisa
  const capGroup = new THREE.Group(); capGroup.visible = false; head.add(capGroup);
  const capMat = M(0x141d38, 0.8);
  const dome = mesh(new THREE.SphereGeometry(0.118, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.5), capMat, 0, 0.03, 0); dome.scale.set(0.96, 0.95, 1.06); capGroup.add(dome);
  const visor = mesh(new THREE.BoxGeometry(0.17, 0.012, 0.09), capMat, 0, 0.035, 0.115); visor.rotation.x = 0.12; capGroup.add(visor);
  const capBand = mesh(new THREE.CylinderGeometry(0.119, 0.119, 0.014, 18, 1, true), M(0xb3202a, 0.6), 0, 0.034, 0); capBand.scale.set(0.97, 1, 1.07); capGroup.add(capBand);
  const capBadge = mesh(new THREE.CircleGeometry(0.022, 10), M(0xd9b24a, 0.4, 0.5), 0, 0.075, 0.121); capGroup.add(capBadge);
  const helmetGroup = new THREE.Group(); helmetGroup.visible = false; head.add(helmetGroup);
  const helmetMat = M(0xf2f2f2, 0.35, 0.1);
  const helm = mesh(new THREE.SphereGeometry(0.128, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.62), helmetMat, 0, 0.02, 0); helm.scale.set(0.98, 1.0, 1.1); helmetGroup.add(helm);
  const helmBrim = mesh(new THREE.BoxGeometry(0.28, 0.014, 0.11), helmetMat, 0, -0.025, 0.12); helmetGroup.add(helmBrim);
  const helmBack = mesh(new THREE.BoxGeometry(0.26, 0.02, 0.1), helmetMat, 0, -0.04, -0.12); helmBack.rotation.x = 0.4; helmetGroup.add(helmBack);
  const helmStripe = mesh(new THREE.BoxGeometry(0.03, 0.02, 0.26), M(0xd12a1e, 0.5), 0, 0.15, 0); helmetGroup.add(helmStripe);

  // ---------- braccia ----------
  const arm = (sx) => {
    const shoulder = new THREE.Group(); shoulder.position.set(sx * 0.255, 0.52, 0); spine.add(shoulder);
    shoulder.add(mesh(new THREE.SphereGeometry(0.07, 12, 10), shirt, 0, 0, 0));
    shoulder.add(mesh(cap(0.058, 0.16), shirt, 0, -0.14, 0));
    const pipe = mesh(new THREE.BoxGeometry(0.125, 0.012, 0.125), red, 0, -0.245, 0); pipe.visible = false; shoulder.add(pipe);
    const elbow = new THREE.Group(); elbow.position.y = -0.3; shoulder.add(elbow);
    elbow.add(mesh(cap(0.048, 0.2), skin, 0, -0.14, 0));
    const hand = new THREE.Group(); hand.position.y = -0.3; elbow.add(hand);
    hand.add(mesh(new THREE.SphereGeometry(0.05, 10, 8), skin, 0, -0.01, 0));
    return { shoulder, elbow, hand, pipe };
  };
  const armL = arm(-1), armR = arm(1);

  // ---------- armi ----------
  const weapons = { pistol: new THREE.Group(), taser: new THREE.Group(), baton: new THREE.Group(), medkit: new THREE.Group(), hose: new THREE.Group() };
  {
    const slide = mesh(new THREE.BoxGeometry(0.032, 0.2, 0.036), M(0x25282c, 0.35, 0.8), 0, -0.1, 0.035);
    const grip = mesh(new THREE.BoxGeometry(0.03, 0.045, 0.1), M(0x111111, 0.7), 0, 0.01, -0.02); grip.rotation.x = 0.2;
    const barrel = mesh(new THREE.CylinderGeometry(0.009, 0.009, 0.05, 6), M(0x777b80, 0.3, 0.9), 0, -0.22, 0.035);
    weapons.pistol.add(slide, grip, barrel);
    weapons.pistol.userData.muzzle = new THREE.Vector3(0, -0.25, 0.035);
    const tb = mesh(new THREE.BoxGeometry(0.04, 0.16, 0.06), M(0xf2c80f, 0.5), 0, -0.08, 0.02);
    const tg = mesh(new THREE.BoxGeometry(0.035, 0.05, 0.09), M(0x15171a, 0.6), 0, 0.01, -0.03);
    const tn = mesh(new THREE.CylinderGeometry(0.014, 0.01, 0.05, 8), M(0x15171a), 0, -0.185, 0.025);
    weapons.taser.add(tb, tg, tn);
    weapons.taser.userData.muzzle = new THREE.Vector3(0, -0.21, 0.025);
    const bt = mesh(new THREE.CylinderGeometry(0.018, 0.015, 0.52, 8), M(0x15171a, 0.5, 0.2), 0, -0.2, 0);
    const bg = mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.12, 8), M(0x0a0a0a, 0.9), 0, 0.02, 0);
    weapons.baton.add(bt, bg);
  }
  {
    const bag = mesh(new THREE.BoxGeometry(0.3, 0.2, 0.12), M(0xd0202a, 0.6), 0, -0.2, 0);
    const cr = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 0.12), new THREE.MeshBasicMaterial({ map: crossTex() })); cr.position.set(0, -0.2, 0.062);
    const crB = cr.clone(); crB.position.z = -0.062; crB.rotation.y = Math.PI;
    weapons.medkit.add(bag, cr, crB);
    const pipe = mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.4, 10), M(0xb08a2a, 0.3, 0.8), 0, -0.2, 0.0);
    const tip = mesh(new THREE.ConeGeometry(0.04, 0.12, 10), M(0xb08a2a, 0.3, 0.8), 0, -0.44, 0); tip.rotation.x = Math.PI;
    const grip = mesh(new THREE.BoxGeometry(0.03, 0.12, 0.05), M(0x15171a, 0.7), 0, -0.05, 0.05);
    weapons.hose.add(pipe, tip, grip);
    weapons.hose.userData.muzzle = new THREE.Vector3(0, -0.5, 0);
  }
  for (const k of Object.keys(weapons)) { weapons[k].visible = false; armR.hand.add(weapons[k]); }

  root.traverse((o) => { if (o.isMesh) o.castShadow = true; });

  const API = {
    group: root,
    outfit: 'civil',
    weapon: null,
    hasSidearm: false,
    phase: 0,
    crouchK: 0,
    kick: 0,
    swingT: -1,
    seated: false,
    seatedK: 0,
    muzzleWorld: new THREE.Vector3(),

    look: { skin: 0xd4a283, hair: 0x2a1f18, shirt: 0x56667d, pants: 0x2c3e5e, shoe: 0xeeeeee },
    setLook(l) { Object.assign(this.look, l); skin.color.set(this.look.skin); hairMat.color.set(this.look.hair); if (this.outfit === 'civil') this.setOutfit('civil'); },
    setOutfit(name) {
      if (name === 'uniform') name = 'polizia';
      this.outfit = name;
      const o = OUTFITS[name] || OUTFITS.civil;
      const civ = name === 'civil';
      shirt.color.set(civ ? this.look.shirt : o.shirt); pants.color.set(civ ? this.look.pants : o.pants); shoe.color.set(civ ? this.look.shoe : o.shoe);
      const u = !civ;
      beltMesh.visible = !!o.belt; if (o.belt) belt.color.set(o.belt);
      radio.visible = u && name !== 'croce_rossa'; patch.visible = u; backTxt.visible = !!o.text;
      if (o.text) backTxt.material.map = backTextTexture(o.text);
      red.color.set(o.pipe || 0xb3202a);
      pipes.forEach((p) => (p.visible = u)); armL.pipe.visible = armR.pipe.visible = u; legL.stripe.visible = legR.stripe.visible = u && !!o.pipe && name !== 'croce_rossa';
      capGroup.visible = o.hat === 'cap'; helmetGroup.visible = o.hat === 'helmet'; hair.visible = !o.hat;
      if (o.hat === 'cap') { capMat.color.set(o.hatColor); capBand.material.color.set(o.band || 0xb3202a); }
      this.holsterOK = !!o.holster;
      this.updateHolster();
    },
    setWeapon(type) {
      this.weapon = type;
      for (const k of Object.keys(weapons)) weapons[k].visible = k === type;
      this.updateHolster();
    },
    setSidearm(has) { this.hasSidearm = has; this.updateHolster(); },
    updateHolster() { holster.visible = !!this.holsterOK && this.hasSidearm; },
    setFemale(f) { ponytail.visible = f; },
    setSeated(v) { this.seated = v; },
    fire() { this.kick = 1; },
    swing() { if (this.swingT < 0) this.swingT = 0; },
    getMuzzle() {
      const w = this.weapon && weapons[this.weapon];
      if (!w) return null;
      return w.localToWorld(this.muzzleWorld.copy(w.userData.muzzle || new THREE.Vector3(0, -0.25, 0)));
    },

    /** s: {speed, run(0..1), crouch(bool), air(bool), vy, aim(bool)} */
    animate(dt, s) {
      this.crouchK = damp(this.crouchK, s.crouch ? 1 : 0, 12, dt);
      this.seatedK = damp(this.seatedK, this.seated ? 1 : 0, 18, dt);
      const ck = this.crouchK, sk = this.seatedK;
      const sp = s.speed;
      const moving = clamp(sp / 1.2, 0, 1);
      const runK = s.run;
      const stride = 1.5 + 0.35 * sp;
      this.phase += dt * (sp / stride) * Math.PI * 2;
      const A = (lerp(0.42, 0.85, runK)) * moving * (1 - ck * 0.4);
      const ph = this.phase;
      const t = performance.now() / 1000;

      let hL = -Math.sin(ph) * A, hR = Math.sin(ph) * A;
      let kL = Math.max(0, Math.cos(ph)) * A * 1.25 + 0.05, kR = Math.max(0, -Math.cos(ph)) * A * 1.25 + 0.05;
      let sL = -Math.sin(ph) * A * 0.9, sR = Math.sin(ph) * A * 0.9; // spalle
      let eL = -(0.15 + runK * 0.9) * moving - 0.08, eR = eL;
      if (s.air) { hL = -0.7; hR = 0.1; kL = 0.9; kR = 0.3; sL = -0.9; sR = -0.9; eL = eR = -0.4; }
      // accovacciata
      hL = lerp(hL, -1.15, ck * 0.85); hR = lerp(hR, -1.0, ck * 0.85);
      kL = lerp(kL, 1.9, ck * 0.85); kR = lerp(kR, 1.75, ck * 0.85);
      // seduto
      hL = lerp(hL, -1.45, sk); hR = lerp(hR, -1.45, sk);
      kL = lerp(kL, 1.45, sk); kR = lerp(kR, 1.45, sk);

      legL.hip.rotation.x = hL; legR.hip.rotation.x = hR;
      legL.knee.rotation.x = kL; legR.knee.rotation.x = kR;
      legL.foot.rotation.x = -(hL + kL) * 0.6 * (1 - sk) + sk * 0.1; legR.foot.rotation.x = -(hR + kR) * 0.6 * (1 - sk) + sk * 0.1;

      body.position.y = -0.4 * ck - 0.45 * sk + Math.abs(Math.cos(ph)) * 0.035 * A * 2 * (1 - sk);
      spine.rotation.x = 0.25 * ck + 0.06 * runK * moving + (-0.1) * sk;
      spine.rotation.y = Math.sin(ph) * 0.12 * A;
      head.rotation.x = -spine.rotation.x * 0.6 + Math.sin(t * 0.7) * 0.01;
      head.rotation.y = -spine.rotation.y * 0.8;

      // braccia
      armL.shoulder.rotation.set(sL, 0, 0.05); armR.shoulder.rotation.set(sR, 0, -0.05);
      armL.elbow.rotation.x = eL; armR.elbow.rotation.x = eR;
      armL.shoulder.rotation.z = 0.05 + (1 - moving) * 0.02;
      armR.shoulder.rotation.z = -0.05 - (1 - moving) * 0.02;

      const hasGun = this.weapon === 'pistol' || this.weapon === 'taser' || this.weapon === 'hose';
      if (hasGun) {
        // posa "low ready" o in mira a due mani
        const k = s.aim ? 1 : 0;
        const recoil = this.kick * 0.18;
        armR.shoulder.rotation.x = lerp(-0.85, -1.52, k) - recoil;
        armR.shoulder.rotation.z = lerp(-0.05, -0.08, k);
        armR.elbow.rotation.x = lerp(-0.9, -0.12, k);
        armL.shoulder.rotation.x = lerp(sL, -1.4, k);
        armL.shoulder.rotation.z = lerp(0.05, -0.38, k);
        armL.elbow.rotation.x = lerp(eL, -0.5, k);
        spine.rotation.y = lerp(spine.rotation.y, -0.2, k);
      } else if (this.weapon === 'baton') {
        armR.shoulder.rotation.x = -0.35; armR.elbow.rotation.x = -0.5;
        if (this.swingT >= 0) {
          this.swingT += dt * 3.2;
          const u = this.swingT;
          if (u >= 1) this.swingT = -1;
          else {
            const w = Math.sin(u * Math.PI);
            armR.shoulder.rotation.x = -0.35 - w * 1.9; armR.elbow.rotation.x = -0.5 + w * 0.2;
            spine.rotation.y += -w * 0.5;
          }
        }
      }
      this.kick = Math.max(0, this.kick - dt * 8);

      if (s.handsUp) { armL.shoulder.rotation.set(-2.7, 0, 0.35); armR.shoulder.rotation.set(-2.7, 0, -0.35); armL.elbow.rotation.x = -0.35; armR.elbow.rotation.x = -0.35; }
      if (s.cuffed) { armL.shoulder.rotation.set(0.5, 0, 0.45); armR.shoulder.rotation.set(0.5, 0, -0.45); armL.elbow.rotation.x = -0.4; armR.elbow.rotation.x = -0.4; spine.rotation.x += 0.1; }
      if (s.fight) { const f = Math.sin(performance.now() / 120 + (s.fight || 0)); armL.shoulder.rotation.set(-1.4 - f * 0.5, 0, 0.2); armR.shoulder.rotation.set(-1.4 + f * 0.5, 0, -0.2); armL.elbow.rotation.x = -0.9; armR.elbow.rotation.x = -0.9; spine.rotation.y = f * 0.3; }
      // seduto: mani sul volante
      if (sk > 0.01) {
        armL.shoulder.rotation.x = lerp(armL.shoulder.rotation.x, -1.15, sk); armR.shoulder.rotation.x = lerp(armR.shoulder.rotation.x, -1.15, sk);
        armL.elbow.rotation.x = lerp(armL.elbow.rotation.x, -0.55, sk); armR.elbow.rotation.x = lerp(armR.elbow.rotation.x, -0.55, sk);
        armL.shoulder.rotation.z = lerp(armL.shoulder.rotation.z, 0.12, sk); armR.shoulder.rotation.z = lerp(armR.shoulder.rotation.z, -0.12, sk);
      }
    },
  };
  API.setOutfit('civil');
  API.setWeapon(null);
  return API;
}
