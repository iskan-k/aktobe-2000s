import * as THREE from 'three';
import { clamp } from '../../../core/util.js';
import { joint, scaled, angleTo, yawToward } from './herd.js';

/* ------------------------------------------------------------------ *
 * The four-legged rig shared by dogs, cats and horses.
 *
 * Joints (radians unless noted), all damped toward targets:
 *   bodyY, bodyZ   hip offset from the standing pose (metres)
 *   pitch, roll    the torso; +pitch lifts the nose
 *   neckP          horses only: the neck on the withers
 *   headP, headY, headR
 *   ear0, ear1     extra pitch per ear (twitches, pinned back)
 *   tailP, tailY   (-tailP lifts the tail), tail2P, tail2Y for a
 *                  two-piece tail
 *   fu0 fu1 fl0 fl1 hu0 hu1 hl0 hl1   leg segments, 0 = left;
 *                  +angle swings the foot forward
 *
 * A species gives the joint positions in `D` (see dog.js).
 * ------------------------------------------------------------------ */

export const LEG_KEYS = ['fu0', 'fu1', 'fl0', 'fl1', 'hu0', 'hu1', 'hl0', 'hl1'];

/** A full joint set at the standing pose. */
export function standing(extra = {}) {
  const j = {
    bodyY: 0, bodyZ: 0, pitch: 0, roll: 0, neckP: 0,
    headP: 0, headY: 0, headR: 0, ear0: 0, ear1: 0,
    tailP: 0, tailY: 0, tail2P: 0, tail2Y: 0,
  };
  for (const k of LEG_KEYS) j[k] = 0;
  return Object.assign(j, extra);
}

const M = {
  root: new THREE.Matrix4(), torso: new THREE.Matrix4(), neck: new THREE.Matrix4(), head: new THREE.Matrix4(),
  ear: new THREE.Matrix4(), tail: new THREE.Matrix4(), tail2: new THREE.Matrix4(),
  up: new THREE.Matrix4(), low: new THREE.Matrix4(), out: new THREE.Matrix4(),
};

/** Turn an animal's joints into part matrices. Returns the torso and head matrices (reused scratch). */
export function poseRig(a, D, write) {
  const j = a.j;
  const root = joint(M.root, null, a.x, a.y, a.z, 0, a.yaw, 0, a.s);
  const torso = joint(M.torso, root, 0, D.hip[0] + j.bodyY, D.hip[1] + j.bodyZ, j.pitch, 0, j.roll);
  const br = Math.sin(a.t * a.breathRate) * a.breathAmp;
  const g = a.girth || 1;
  write('torso', 0, scaled(M.out, torso, g * (1 + br * 0.5), g * (1 + br), 1));
  const head = poseHead(a, D, torso, write);
  if (a.tailKind) {
    const t = joint(M.tail, torso, 0, D.tail[0], D.tail[1], j.tailP, j.tailY, 0);
    write(a.tailKind, 0, t);
    if (D.tail2) write('tail2', 0, joint(M.tail2, t, 0, 0, D.tail2, j.tail2P, j.tail2Y, 0));
  }
  for (let k = 0; k < 2; k++) {
    const s = k ? 1 : -1;
    const fu = joint(M.up, torso, s * D.fu[0], D.fu[1], D.fu[2], j[`fu${k}`], 0, 0);
    write('fu', k, fu);
    write('fl', k, joint(M.low, fu, 0, -D.fuLen, 0, j[`fl${k}`], 0, 0));
    const hu = joint(M.up, torso, s * D.hu[0], D.hu[1], D.hu[2], j[`hu${k}`], 0, 0);
    write('hu', k, hu);
    write('hl', k, joint(M.low, hu, 0, D.huEnd[0], D.huEnd[1], j[`hl${k}`], 0, 0));
  }
  return { torso, head };
}

/** Head (and neck, for horses) and ears on `parent`. */
export function poseHead(a, D, parent, write) {
  const j = a.j;
  let head;
  if (D.neck) {
    const n = joint(M.neck, parent, 0, D.neck.at[0], D.neck.at[1], j.neckP, j.headY * 0.45, 0);
    write('neck', 0, n);
    head = joint(M.head, n, 0, D.neck.head[0], D.neck.head[1], j.headP, j.headY * 0.55, j.headR);
  } else {
    head = joint(M.head, parent, 0, D.head[0], D.head[1], j.headP, j.headY, j.headR);
  }
  write('head', 0, head);
  for (let k = 0; k < 2; k++) {
    const s = k ? 1 : -1;
    write('ear', k, joint(M.ear, head, s * D.ear[0], D.ear[1], D.ear[2],
      a.earFold + j[`ear${k}`], s * a.earTurn, -s * a.earSpread, a.earScale));
  }
  return head;
}

/**
 * Walking legs: a lateral-sequence walk, near fore and far hind a
 * quarter cycle apart. `amp` scales the swing of the upper segments.
 */
export function walkLegs(T, phase, { amp = 0.4, fore = 1.0, hind = 0.8, bob = 0.012 } = {}) {
  const offs = [0, Math.PI, Math.PI * 1.5, Math.PI * 0.5];   // fl, fr, hl, hr
  for (let k = 0; k < 2; k++) {
    const pf = phase + offs[k], ph = phase + offs[2 + k];
    T[`fu${k}`] = amp * Math.sin(pf);
    T[`fl${k}`] = -fore * Math.max(0, Math.cos(pf));
    T[`hu${k}`] = amp * 0.85 * Math.sin(ph);
    T[`hl${k}`] = hind * Math.max(0, Math.cos(ph));
  }
  T.bodyY = (T.bodyY || 0) + bob * Math.cos(phase * 2);
}

/** Legs straight under the body. */
export function legsStraight(T) {
  for (const k of LEG_KEYS) T[k] = 0;
}

/**
 * Step toward the goal (a.gx, a.gz) at `speed`, turning as it goes.
 * Returns true on arrival.
 */
export function walkToGoal(a, dt, speed, turnRate = 3) {
  const dx = a.gx - a.x, dz = a.gz - a.z;
  const d = Math.hypot(dx, dz);
  if (d < 0.15) return true;
  const want = Math.atan2(-dx, -dz);
  const dy = angleTo(a.yaw, want);
  a.yaw += clamp(dy, -turnRate * dt, turnRate * dt);
  // slow down for the sharp part of a turn
  const v = speed * Math.max(0.25, Math.cos(dy));
  const step = Math.min(d, v * dt);
  a.x -= Math.sin(a.yaw) * step;
  a.z -= Math.cos(a.yaw) * step;
  a.phase += (step / a.stride) * Math.PI * 2;
  return false;
}

/** Head yaw and pitch targets that look at world point p. */
export function lookTargets(a, p, limit = 1.1) {
  const want = yawToward(a.x, a.z, p);
  return clamp(angleTo(a.yaw, want), -limit, limit);
}

/** An invisible object that follows the animal, to carry its E hitbox. */
export function proxy(ctx, a) {
  const o = new THREE.Object3D();
  o.position.set(a.x, a.y, a.z);
  o.rotation.y = a.yaw;
  ctx.root.add(o);
  return o;
}

/** Ear twitches: every few seconds one ear flicks back and forward. */
export function twitchEars(a, T, dt) {
  a.twitchT -= dt;
  if (a.twitchT <= 0) {
    a.twitchT = 1.5 + a.rng.next() * 5;
    a.twitchEar = a.rng.next() < 0.5 ? 0 : 1;
    a.twitchOn = 0.18;
  }
  a.twitchOn = Math.max(0, (a.twitchOn || 0) - dt);
  T.ear0 = a.twitchOn > 0 && a.twitchEar === 0 ? -0.5 : 0;
  T.ear1 = a.twitchOn > 0 && a.twitchEar === 1 ? -0.5 : 0;
}
