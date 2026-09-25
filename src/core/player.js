import * as THREE from 'three';
import { clamp, damp } from './util.js';
import { pushCircle } from './physics.js';

/* ------------------------------------------------------------------ *
 * First-person walker.
 *
 * Pointer-lock look, eased WASD movement, circle-vs-footprint collision
 * against the static colliders and against whatever is moving this frame
 * (cars, buses, the train), and a ground query so the walker steps up
 * onto kerbs and porches. No jump, no crouch.
 *
 * Other controllers (the car, a bus seat, a swing) take the camera over
 * by setting `player.active = false`; the walker then stands still,
 * invisible, until it is handed back with `placeAt()`.
 * ------------------------------------------------------------------ */

export const EYE = 1.64;
export const RADIUS = 0.3;
const STEP = 0.42;

export class Player {
  constructor(camera, world, input) {
    this.camera = camera;
    this.world = world;
    this.input = input;
    this.spawn = { x: 0, z: 0, yaw: 0, pitch: 0 };
    this.pos = new THREE.Vector3();
    this.vel = new THREE.Vector3();
    this.yaw = 0;
    this.pitch = 0;
    this.bob = 0;
    this.active = true;
    this.walkSpeed = 2.3;
    this.runSpeed = 5.4;
    this.moving = 0;
    this.stepPhase = 0;
    this.onStep = null;   // footstep callback for audio

    this._fwd = new THREE.Vector3();
    this._right = new THREE.Vector3();
    this._wish = new THREE.Vector3();
    this._dir = new THREE.Vector3();
    this.raycaster = new THREE.Raycaster();
    this.raycaster.far = 3.2;
    this.hovered = null;
  }

  setSpawn(x, z, yaw = 0, pitch = 0) {
    this.spawn = { x, z, yaw, pitch };
    this.placeAt(x, z, yaw, pitch);
  }

  placeAt(x, z, yaw = this.yaw, pitch = this.pitch) {
    this.pos.set(x, 0, z);
    this.pos.y = this.world.heightAt(x, z);
    this.yaw = yaw;
    this.pitch = pitch;
    this.vel.set(0, 0, 0);
    this.bob = 0;
    this.applyCamera();
  }

  reset() {
    const s = this.spawn;
    this.placeAt(s.x, s.z, s.yaw, s.pitch);
  }

  look() {
    const { dx, dy } = this.input.takeLook();
    this.yaw -= dx;
    this.pitch = clamp(this.pitch - dy, -1.2, 1.1);
  }

  _collide(feetY) {
    const p = this.pos;
    const list = this.world.colliders.near(p.x - 1, p.z - 1, p.x + 1, p.z + 1);
    for (const c of list) pushCircle(p, RADIUS, c, feetY, STEP);
    for (const c of this.world.dynamic) {
      if (Math.abs(c.cx - p.x) > 14 || Math.abs(c.cz - p.z) > 14) continue;
      pushCircle(p, RADIUS, c, feetY, STEP);
    }
  }

  update(dt) {
    if (!this.active) return;
    this.look();
    const { fwd, side } = this.input.axes();
    const speed = this.input.shift ? this.runSpeed : this.walkSpeed;

    this._fwd.set(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    this._right.set(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
    this._wish.copy(this._fwd).multiplyScalar(fwd).addScaledVector(this._right, side);
    if (this._wish.lengthSq() > 1e-6) this._wish.normalize().multiplyScalar(speed);

    const accel = this._wish.lengthSq() > 1e-6 ? 11 : 14;
    const a = 1 - Math.exp(-accel * dt);
    this.vel.x += (this._wish.x - this.vel.x) * a;
    this.vel.z += (this._wish.z - this.vel.z) * a;

    const feetY = this.pos.y;
    const sx = this.vel.x * dt, sz = this.vel.z * dt;
    const n = Math.max(1, Math.ceil(Math.max(Math.abs(sx), Math.abs(sz)) / 0.15));
    for (let i = 0; i < n; i++) {
      this.pos.x += sx / n;
      this.pos.z += sz / n;
      this._collide(feetY);
    }

    const b = this.world.bounds;
    this.pos.x = clamp(this.pos.x, b.x0, b.x1);
    this.pos.z = clamp(this.pos.z, b.z0, b.z1);

    const targetY = this.world.heightAt(this.pos.x, this.pos.z, this.pos.y);
    this.pos.y = targetY > this.pos.y ? damp(this.pos.y, targetY, 22, dt) : damp(this.pos.y, targetY, 12, dt);

    this.moving = Math.hypot(this.vel.x, this.vel.z);
    const prev = this.bob;
    this.bob += dt * this.moving * (this.input.shift ? 2.9 : 2.6);
    // one footstep per half bob cycle
    if (Math.floor(prev / Math.PI) !== Math.floor(this.bob / Math.PI) && this.moving > 0.6) {
      this.onStep?.(this.moving);
    }
    this.applyCamera();
  }

  applyCamera() {
    const amp = Math.min(this.moving / this.walkSpeed, 1.4) * 0.022;
    const eye = this.pos.y + EYE + Math.abs(Math.sin(this.bob)) * amp - amp * 0.5;
    this.camera.position.set(this.pos.x, eye, this.pos.z);
    this.camera.rotation.set(this.pitch, this.yaw, Math.sin(this.bob) * amp * 0.12, 'YXZ');
  }

  /** Ray from the camera through the crosshair; nearest interactable in reach. */
  pick(interactables) {
    this.camera.getWorldDirection(this._dir);
    const cam = this.camera.position;
    const meshes = [];
    const items = [];
    for (const it of interactables) {
      if (it.enabled && !it.enabled()) continue;
      const hb = it.hitbox;
      hb.getWorldPosition(this._wish);
      if (this._wish.distanceToSquared(cam) > 36) continue;
      meshes.push(hb);
      items.push(it);
    }
    if (!meshes.length) { this.hovered = null; return null; }
    this.raycaster.set(cam, this._dir);
    const hits = this.raycaster.intersectObjects(meshes, false);
    this.hovered = hits.length ? items[meshes.indexOf(hits[0].object)] : null;
    return this.hovered;
  }
}
