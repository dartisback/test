import * as THREE from 'three';
import { clamp, damp, dampAngle, lerp } from './util.js';
import { settings } from './settings.js';

export class CameraRig {
  constructor(camera, world) {
    this.camera = camera; this.world = world;
    this.yaw = 0; this.pitch = 0.18;
    this.dist = 3.4; this.curDist = 3.4;
    this.idle = 0;
    this.fov = settings.fov;
    this.shake = 0;
    this.pivot = new THREE.Vector3();
    this.dir = new THREE.Vector3();
    this.origin = new THREE.Vector3();
    this.tmp = new THREE.Vector3();
    this.inCar = false;
  }

  snapBehind(heading) { this.yaw = heading + Math.PI; }
  getRayOrigin() { return this.camera.getWorldPosition(this.origin); }
  getRayDir() { return this.camera.getWorldDirection(this.dir); }

  update(dt, a, target, opts) {
    const { mode, heading = 0, speed = 0, crouch = false, aim = false } = opts;
    const inv = settings.invertY ? -1 : 1;
    const hadInput = Math.abs(a.lookX) + Math.abs(a.lookY) > 0.0001;
    this.yaw -= a.lookX;
    this.pitch = clamp(this.pitch + a.lookY * inv, -0.75, 1.25);
    if (a.wheel) this.dist = clamp(this.dist + a.wheel * 0.4, 2.0, 6);

    let wantDist, pivotH, shoulder = 0, wantFov = settings.fov;
    if (mode === 'car') {
      wantDist = 7.6 + speed * 0.04; pivotH = 1.5;
      this.idle = hadInput ? 0 : this.idle + dt;
      if (this.idle > 1.2 || a.camReset) this.yaw = dampAngle(this.yaw, heading + Math.PI, 2.6, dt);
      if (!hadInput && this.idle > 1.2) this.pitch = damp(this.pitch, 0.2, 2, dt);
      wantFov = settings.fov + clamp(speed * 0.22, 0, 14);
    } else {
      wantDist = this.dist * (aim ? 0.62 : 1);
      pivotH = crouch ? 1.15 : 1.55;
      shoulder = aim ? 0.55 : 0.28;
      wantFov = aim ? settings.fov * 0.78 : settings.fov;
    }
    this.fov = damp(this.fov, wantFov, 8, dt);
    this.camera.fov = this.fov;
    this.camera.updateProjectionMatrix();

    const cp = Math.cos(this.pitch), sp = Math.sin(this.pitch);
    const back = this.tmp.set(Math.sin(this.yaw) * cp, sp, Math.cos(this.yaw) * cp);
    const rightX = Math.cos(this.yaw), rightZ = -Math.sin(this.yaw);
    this.pivot.set(target.x + rightX * shoulder, target.y + pivotH, target.z + rightZ * shoulder);

    // collisione camera: raycast dal pivot verso la posizione desiderata
    const hit = this.world.grid.ray(this.pivot.x, this.pivot.y, this.pivot.z, back.x, back.y, back.z, wantDist + 0.3);
    const allowed = Math.max(0.35, Math.min(wantDist, hit - 0.3));
    this.curDist = allowed < this.curDist ? allowed : damp(this.curDist, allowed, 5, dt);

    let px = this.pivot.x + back.x * this.curDist;
    let py = this.pivot.y + back.y * this.curDist;
    let pz = this.pivot.z + back.z * this.curDist;
    py = Math.max(py, this.world.groundY(px, pz) + 0.35);
    if (this.shake > 0) {
      const s = this.shake;
      px += (Math.random() - 0.5) * s; py += (Math.random() - 0.5) * s; pz += (Math.random() - 0.5) * s;
      this.shake = Math.max(0, this.shake - dt * 2.5);
    }
    this.camera.position.set(px, py, pz);
    this.camera.lookAt(this.pivot);
  }
}
