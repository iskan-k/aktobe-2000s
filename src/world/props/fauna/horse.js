import * as THREE from 'three';
import { rngKit } from '../../../core/util.js';
import { Geo, sweep, ell, cone, ring, box, ramp, torsoPath, limbPath } from './geo.js';
import { herdFor, settle, watcher } from './herd.js';
import { poseRig, standing, legsStraight, walkToGoal, walkLegs, lookTargets, proxy, twitchEars } from './quad.js';
import './voices.js';

/* ------------------------------------------------------------------ *
 * Horses: the Kazakh steppe horse (жабы), short and stocky, about
 * 1.4 m at the withers, with a big head on a short thick neck, a heavy
 * mane and a tail nearly to the ground. Bay, dark bay, chestnut, dun
 * (саврасая) with its dorsal stripe, grey and black.
 *
 * Modes
 *   graze    tethered on a stake: head down in the grass, a step now
 *            and then, head up to chew and look about
 *   stand    at a hitching post: resting a hind leg, nodding
 *   harness  in the shafts of a cart, collar and дуга on
 * All swish their tails at the flies and turn their ears. Close up they
 * lift their heads to look at you; E pats the neck.
 * ------------------------------------------------------------------ */

const BODY_Z = 0.85;     // torso and tack are drawn long, then pulled in
const D = {
  hip: [1.02, 0.43],
  neck: { at: [0.14, -1.14 * BODY_Z], head: [0.66, -0.44] },
  ear: [0.058, 0.1, -0.015],
  tail: [0.12, 0.33 * BODY_Z],
  fu: [0.15, -0.1, -1.02 * BODY_Z], fuLen: 0.44,
  hu: [0.165, -0.05, 0.02], huEnd: [-0.47, 0.15],
};

/* ------------------------------------------------------------------ geometry */

const HOOF = 0x3a322a;

function torsoGeo() {
  const g = sweep(torsoPath([
    [0.36, 0.12, 0.02, 0.06],
    [0.3, 0.25, -0.17, 0.19],
    [0.18, 0.32, -0.22, 0.25],
    [0.0, 0.345, -0.25, 0.27],
    [-0.2, 0.335, -0.3, 0.275],
    [-0.45, 0.33, -0.33, 0.29],
    [-0.7, 0.34, -0.33, 0.285],
    [-0.9, 0.37, -0.29, 0.265],
    [-1.06, 0.37, -0.23, 0.245],
    [-1.18, 0.31, -0.13, 0.205],
    [-1.26, 0.21, -0.03, 0.14],
    [-1.3, 0.13, 0.03, 0.05],
  ]), 18, { sub: 2 });
  g.scale(1, 1, BODY_Z);
  return new Geo().add(g, {
    fur: (p) => [
      // a paler belly on duns and bays
      ramp(-0.22, -0.3, p.y) * 0.25,
      0, 0,
      // the dorsal stripe: half dark here, full on a dun (mask w = 2)
      Math.exp(-(p.x * p.x) / 0.0012) * ramp(0.28, 0.34, p.y) * 0.5,
    ],
  }).build();
}

function neckGeo() {
  const geo = new Geo();
  const path = [
    { p: [0, -0.06, 0.1], rx: 0.2, ry: 0.3 },
    { p: [0, 0.12, -0.07], rx: 0.17, ry: 0.25 },
    { p: [0, 0.3, -0.21], rx: 0.14, ry: 0.19 },
    { p: [0, 0.47, -0.32], rx: 0.115, ry: 0.15 },
    { p: [0, 0.6, -0.4], rx: 0.1, ry: 0.12 },
  ];
  geo.add(sweep(path, 14, { sub: 2 }), { fur: (p, n) => [0, 0, 0, ramp(0.6, 0.9, n.y + n.z * 0.4) * 0.3] });
  // the mane: a thick crest of hair falling to the off side
  const crest = [
    { p: [0.03, 0.2, 0.14], rx: 0.04, ry: 0.06 },
    { p: [0.05, 0.38, -0.02], rx: 0.05, ry: 0.08 },
    { p: [0.06, 0.55, -0.16], rx: 0.05, ry: 0.08 },
    { p: [0.055, 0.7, -0.29], rx: 0.045, ry: 0.07 },
    { p: [0.045, 0.78, -0.38], rx: 0.03, ry: 0.05 },
  ];
  geo.add(sweep(crest, 8, { sub: 2 }), { fur: [0, 0, 0, 1] });
  // locks hanging down the right side of the neck
  for (let i = 0; i < 6; i++) {
    const t = i / 5;
    const y = 0.28 + t * 0.44, z = 0.08 - t * 0.4;
    geo.add(ell(0.02, 0.1, 0.05, 0.12 - t * 0.02, y - 0.06, z + 0.02, 6), { fur: [0, 0, 0, 1] });
  }
  return geo.build();
}

function headGeo() {
  const geo = new Geo();
  const face = (p, n) => [
    0, 0,
    // a star on the forehead running down into a blaze
    Math.abs(p.x) < 0.028 && n.z < -0.2 && p.z < -0.05 ? ramp(0.06, -0.02, p.y) * ramp(-0.36, -0.2, p.y) : 0,
    ramp(-0.34, -0.42, p.y) * 0.35,         // dark muzzle
  ];
  geo.add(ell(0.1, 0.11, 0.13, 0, 0.0, -0.06, 14), { fur: face });
  // the round jowl, and the long face angling down to the muzzle
  geo.add(ell(0.092, 0.14, 0.12, 0, -0.1, 0.0, 12), { fur: face });
  geo.add(sweep(limbPath([
    [0, -0.02, -0.1, 0.095, 0.1],
    [0, -0.14, -0.24, 0.08, 0.085],
    [0, -0.26, -0.36, 0.07, 0.075],
    [0, -0.33, -0.43, 0.075, 0.078],
  ]), 12, { sub: 2 }), { fur: face });
  geo.add(ell(0.086, 0.08, 0.092, 0, -0.36, -0.455, 12), { fur: face });
  geo.add(ell(0.058, 0.04, 0.07, 0, -0.43, -0.4, 8), { fur: face });
  for (const s of [-1, 1]) {
    geo.add(ell(0.018, 0.026, 0.012, s * 0.045, -0.335, -0.535, 6), { color: 0x1e1a18, fixed: true });
    geo.add(ell(0.022, 0.024, 0.018, s * 0.098, -0.02, -0.12, 8), { color: 0x1e1612, fixed: true });
    geo.add(ell(0.006, 0.006, 0.004, s * 0.104, -0.014, -0.134, 5), { color: 0xe8e0d0, fixed: true });
  }
  // forelock
  geo.add(sweep(limbPath([
    [0, 0.11, -0.01, 0.05, 0.02],
    [0, 0.06, -0.12, 0.045, 0.018],
    [0, -0.02, -0.17, 0.03, 0.012],
  ]), 6), { fur: [0, 0, 0, 1] });
  // the halter: noseband, cheek straps and crownpiece
  const strap = { color: 0x4a2e1c, fixed: true };
  geo.add(ring(0.092, 0.011, 0, -0.25, -0.35, Math.PI / 4), strap);
  geo.add(ring(0.118, 0.011, 0, -0.02, 0.03, -0.2), strap);
  for (const s of [-1, 1]) geo.add(box(0.012, 0.3, 0.022, s * 0.098, -0.14, -0.17, 0.8), strap);
  geo.add(ring(0.018, 0.006, 0, -0.33, -0.3, 0), { color: 0x9a9690, fixed: true });
  return geo.build();
}

function earGeo() {
  const g = cone(0.036, 0.14, 0, -0.01, 0, 0, 0, 0, 7);
  g.scale(1, 1, 0.5);
  const inner = cone(0.024, 0.1, 0, -0.005, -0.012, 0, 0, 0, 6);
  inner.scale(1, 1, 0.3);
  return new Geo()
    .add(g, { fur: (p) => [0, 0, 0, ramp(0.08, 0.13, p.y)] })
    .add(inner, { color: 0x2a221c, fixed: true })
    .build();
}

function tailGeo() {
  const geo = new Geo();
  geo.add(sweep(limbPath([
    [0, 0, -0.02, 0.05, 0.05],
    [0, -0.03, 0.1, 0.045, 0.05],
    [0, -0.12, 0.16, 0.04, 0.045],
  ]), 8), { fur: [0, 0, 0, 0.6] });
  // the hair, flat and full, falling almost to the hocks and past
  geo.add(sweep(limbPath([
    [0, -0.02, 0.1, 0.06, 0.05],
    [0, -0.25, 0.19, 0.1, 0.06],
    [0, -0.5, 0.21, 0.105, 0.055],
    [0, -0.78, 0.2, 0.085, 0.04],
    [0, -0.95, 0.17, 0.035, 0.02],
  ]), 10, { sub: 2 }), { fur: [0, 0, 0, 1] });
  return geo.build();
}

function hoof(geo, y, z) {
  geo.add(sweep(limbPath([
    [0, y + 0.005, z + 0.005, 0.046, 0.05],
    [0, y - 0.06, z - 0.015, 0.058, 0.066],
    [0, y - 0.08, z - 0.02, 0.06, 0.068],
  ]), 10), { color: HOOF, fixed: true });
}

function foreUpperGeo() {
  const geo = new Geo();
  geo.add(sweep(limbPath([
    [0, 0.1, 0.03, 0.095, 0.13],
    [0, -0.1, 0.02, 0.078, 0.095],
    [0, -0.3, 0.0, 0.056, 0.062],
    [0, -0.42, 0.0, 0.05, 0.055],
  ]), 10, { sub: 2 }), { fur: (p) => [0, 0, 0, ramp(-0.25, -0.4, p.y)] });
  geo.add(ell(0.058, 0.065, 0.062, 0, -0.44, 0.005, 8), { fur: [0, 0, 0, 1] });
  return geo.build();
}

function foreLowerGeo() {
  const geo = new Geo();
  geo.add(sweep(limbPath([
    [0, 0, 0, 0.042, 0.046],
    [0, -0.24, 0.005, 0.036, 0.04],
    [0, -0.32, -0.005, 0.045, 0.05],
    [0, -0.36, -0.03, 0.036, 0.036],
    [0, -0.4, -0.05, 0.04, 0.042],
  ]), 10), { fur: (p) => [0, ramp(-0.22, -0.32, p.y), 0, 1] });
  hoof(geo, -0.4, -0.05);
  return geo.build();
}

function hindUpperGeo() {
  const geo = new Geo();
  // the quarters: a big muscle over the thigh, then the gaskin to the hock
  geo.add(ell(0.13, 0.3, 0.2, 0, -0.12, -0.04, 12), { fur: (p) => [0, 0, 0, ramp(-0.36, -0.42, p.y)] });
  geo.add(sweep(limbPath([
    [0, -0.12, 0.0, 0.12, 0.16],
    [0, -0.3, 0.08, 0.075, 0.11],
    [0, -0.45, 0.14, 0.058, 0.075],
  ]), 10, { sub: 2 }), { fur: (p) => [0, 0, 0, ramp(-0.36, -0.45, p.y)] });
  geo.add(ell(0.05, 0.06, 0.075, 0, -0.47, 0.16, 8), { fur: [0, 0, 0, 1] });
  return geo.build();
}

function hindLowerGeo() {
  const geo = new Geo();
  geo.add(sweep(limbPath([
    [0, 0, 0, 0.044, 0.052],
    [0, -0.33, -0.01, 0.036, 0.04],
    [0, -0.41, -0.02, 0.045, 0.05],
    [0, -0.45, -0.045, 0.036, 0.036],
    [0, -0.49, -0.065, 0.04, 0.042],
  ]), 10), { fur: (p) => [0, ramp(-0.3, -0.4, p.y), 0, 1] });
  hoof(geo, -0.49, -0.065);
  return geo.build();
}

/** A Kazakh saddle: red felt blanket, dark leather seat with its high pommel, stirrups. */
function saddleGeo() {
  const geo = new Geo();
  const blanket = new THREE.CylinderGeometry(0.33, 0.33, 0.62, 16, 1, true, -1.25, 2.5);
  blanket.rotateX(Math.PI / 2);
  blanket.rotateZ(Math.PI / 2 + Math.PI / 2);
  blanket.scale(1.02, 1.12, 1);
  blanket.translate(0, 0.0, -0.68);
  geo.add(blanket, { color: 0xa8281e, fixed: true });
  // ornament band along its hem
  const hem = new THREE.CylinderGeometry(0.335, 0.335, 0.64, 16, 1, true, -1.27, 0.12);
  hem.rotateX(Math.PI / 2); hem.rotateZ(Math.PI);
  hem.scale(1.02, 1.12, 1); hem.translate(0, 0.0, -0.68);
  geo.add(hem, { color: 0xe8c040, fixed: true });
  const hem2 = hem.clone(); hem2.scale(-1, 1, 1);
  geo.add(hem2, { color: 0xe8c040, fixed: true });
  const seat = { color: 0x3a2618, fixed: true };
  geo.add(ell(0.17, 0.05, 0.24, 0, 0.37, -0.7, 10), seat);
  geo.add(box(0.2, 0.2, 0.06, 0, 0.44, -0.93, -0.3), seat);         // pommel
  geo.add(ell(0.02, 0.03, 0.02, 0, 0.55, -0.97, 6), { color: 0xc8a050, fixed: true });
  geo.add(box(0.26, 0.12, 0.05, 0, 0.42, -0.47, 0.3), seat);        // cantle
  for (const s of [-1, 1]) {
    geo.add(box(0.015, 0.5, 0.035, s * 0.3, 0.12, -0.7), seat);
    geo.add(ring(0.045, 0.008, s * 0.305, -0.16, -0.7, 0, 0, Math.PI / 2), { color: 0x8a8680, fixed: true });
  }
  // girth under the belly
  geo.add(ring(0.33, 0.018, 0, 0.0, -0.8, -Math.PI / 2, 0, 0).scale(0.92, 1.08, 1), seat);
  return geo.build().scale(1, 1, BODY_Z);
}

/** Collar (хомут) and the painted дуга over the withers, for the cart horse. */
function harnessGeo() {
  const geo = new Geo();
  const leather = { color: 0x2e2218, fixed: true };
  // the collar sits round the base of the neck, just in front of the shoulders
  const collar = new THREE.TorusGeometry(0.25, 0.06, 6, 18);
  collar.scale(0.95, 1.3, 1);
  // square to the neck, which rises forward at about 45 degrees
  collar.rotateX(0.75);
  collar.translate(0, 0.3, -1.2);
  geo.add(collar, leather);
  // the дуга: a wooden arch from shaft to shaft, over the neck
  const arc = new THREE.TorusGeometry(0.46, 0.028, 5, 18, Math.PI);
  arc.rotateX(0.35);
  arc.translate(0, 0.28, -1.22);
  geo.add(arc, { color: 0x9a3a22, fixed: true });
  // back pad (седёлка) and belly band
  geo.add(ell(0.16, 0.04, 0.14, 0, 0.37, -0.72, 8), leather);
  geo.add(ring(0.34, 0.018, 0, 0.0, -0.72, -Math.PI / 2).scale(0.9, 1.08, 1), leather);
  // breeching straps round the quarters, and the traces along the flanks
  geo.add(ring(0.3, 0.014, 0, 0.12, 0.12, 0, 0, 0).scale(0.95, 1, 1.1), leather);
  for (const s of [-1, 1]) geo.add(box(0.02, 0.025, 1.1, s * 0.29, 0.02, -0.55), leather);
  return geo.build().scale(1, 1, BODY_Z);
}

/* ------------------------------------------------------------------ coats */

/** mask: [belly, socks, face, dark]; w = 2 gives a dun its full dorsal stripe. */
export const HORSE_COATS = {
  bay: { main: 0x7a4424, light: 0xf0e8dc, dark: 0x1e1814, mask: [0.4, 1, 1, 1] },
  darkBay: { main: 0x44281a, light: 0xf0e8dc, dark: 0x16120e, mask: [0.2, 0, 1, 1] },
  chestnut: { main: 0x9a5226, light: 0xf0e8dc, dark: 0x7a3c1a, mask: [0.3, 1, 1, 1] },
  flaxen: { main: 0x8e4e24, light: 0xf2ead8, dark: 0xd8c08a, mask: [0.3, 0, 1, 1] },
  dun: { main: 0xb08c5a, light: 0xe8dcc4, dark: 0x2a221a, mask: [0.6, 0, 0, 2] },
  grey: { main: 0xb8b4ac, light: 0xe8e6e0, dark: 0x7e7a74, mask: [0.5, 0.5, 0.5, 0.9] },
  black: { main: 0x221c18, light: 0xece6dc, dark: 0x141010, mask: [0, 1, 1, 1] },
};

/* ------------------------------------------------------------------ poses */

function standPose(T, a) {
  legsStraight(T);
  T.bodyY = 0; T.bodyZ = 0; T.pitch = 0; T.roll = 0;
  T.hu0 = T.hu1 = -0.08; T.hl0 = T.hl1 = 0.08;
  T.neckP = -0.15; T.headP = 0.05;
  // resting one hind leg: the hoof tipped, that hip dropped
  if (a.rest >= 0) {
    const k = a.rest;
    T[`hu${k}`] = 0.12; T[`hl${k}`] = 0.32;
    T.roll = k ? 0.025 : -0.025;
    T.bodyY = -0.012;
  }
  T.tailP = 0.05;
}

function grazePose(T, a) {
  standPose(T, a);
  // head right down in the grass, nosing along
  T.neckP = -1.85 + Math.sin(a.t * 0.7) * 0.05;
  T.headP = 0.55 + Math.max(0, Math.sin(a.t * 3.1)) * 0.08;
  T.pitch = -0.035;
  T.fu0 = 0.1; T.fu1 = -0.05;
}

/* ------------------------------------------------------------------ behaviour */

function stepHorse(a, dt, game, dist) {
  a.t += dt;
  a.timer -= dt;
  a.happy = Math.max(0, a.happy - dt);
  const T = a.T;
  const p = watcher(game);
  const onFoot = !game.controller;
  const dp = Math.hypot(p.x - a.x, p.z - a.z);
  const near = onFoot && dp < 7;

  if (a.timer <= 0) {
    a.timer = a.rng.range(6, 16);
    a.rest = a.rng.chance(0.6) ? a.rng.int(0, 1) : -1;
    if (a.mode === 'graze') {
      // look up to chew for a while, or take a step or two to fresh grass
      const r = a.rng.next();
      if (r < 0.3) { a.state = 'look'; a.timer = a.rng.range(4, 9); } else if (r < 0.7) {
        a.state = 'step';
        const ang = a.yaw + a.rng.range(-0.8, 0.8);
        let gx = a.x - Math.sin(ang) * 0.7, gz = a.z - Math.cos(ang) * 0.7;
        const t = a.tether;
        if (t && Math.hypot(gx - t.x, gz - t.z) > t.len) { gx = t.x + (a.x - t.x) * 0.5; gz = t.z + (a.z - t.z) * 0.5; }
        a.gx = gx; a.gz = gz;
      } else a.state = 'graze';
    } else a.state = a.rng.chance(0.2) ? 'stamp' : 'stand';
  }
  if (a.happy > 0 || (near && a.mode !== 'harness' && a.state === 'graze')) a.state = 'look';

  let rate = 1.6;
  switch (a.state) {
    case 'graze': grazePose(T, a); break;
    case 'step': {
      grazePose(T, a);
      if (walkToGoal(a, dt, 0.35, 0.8)) a.state = 'graze';
      else { walkLegs(T, a.phase, { amp: 0.25, fore: 0.8, hind: 0.6, bob: 0.01 }); T.neckP = -1.7; }
      rate = 6;
      break;
    }
    case 'stamp': {
      standPose(T, a);
      // a front hoof lifted and put down, at the flies
      const k = a.side;
      const u = Math.max(0, Math.sin(a.t * 5));
      T[`fu${k}`] = 0.35 * u; T[`fl${k}`] = -1.1 * u;
      rate = 6;
      break;
    }
    default: {
      standPose(T, a);
      T.neckP = (a.state === 'look' ? 0.1 : -0.25) + Math.sin(a.t * 0.5) * 0.06;
      if (a.mode === 'harness') T.neckP = -0.1 + Math.sin(a.t * 0.9) * 0.12;
    }
  }
  T.headY = near ? lookTargets(a, p, 0.9) : Math.sin(a.t * 0.17 + a.seed) * 0.3;
  if (a.happy > 0) { T.neckP = -0.4; T.headP = 0.2; T.headY *= 0.4; }
  // tail swishes at the flies, in bursts
  const swish = Math.max(0, Math.sin(a.t * 0.35 + a.seed)) ** 2;
  T.tailY = Math.sin(a.t * 3.4) * 0.45 * swish;
  T.tailP = 0.08 - 0.25 * swish;
  twitchEars(a, T, dt);
  if (near) { T.ear0 -= 0.3; T.ear1 -= 0.3; }
  settle(a.j, T, rate, dt);
  a.j.tailY = T.tailY;

  a.breathRate = 1.1;
  a.breathAmp = 0.012;
  if (near && a.t - a.lastSnort > 20 && a.rng.next() < dt * 0.15) {
    a.lastSnort = a.t;
    game.audio.play('snort', { pos: { x: a.x, y: 1.4, z: a.z } });
  }
  if (dist < 60 && a.t - a.lastCall > 70 && a.rng.next() < dt * 0.01) {
    a.lastCall = a.t;
    game.audio.play('whinny', { pos: { x: a.x, y: 1.5, z: a.z }, rate: a.s < 0.8 ? 1.3 : 1 });
  }
  if (a.proxy) { a.proxy.position.set(a.x, a.y, a.z); a.proxy.rotation.y = a.yaw; }
}

function poseHorse(a, write) {
  const { torso } = poseRig(a, D, write);
  if (a.tack) write(a.tack, 0, torso);
}

export const HORSE = {
  name: 'horse',
  // the herd on the steppe is meant to be seen from across the waste ground
  view: 240,
  parts: {
    torso: { geo: torsoGeo },
    neck: { geo: neckGeo },
    head: { geo: headGeo },
    ear: { geo: earGeo, mult: 2, cast: false },
    tail: { geo: tailGeo },
    saddle: { geo: saddleGeo },
    harness: { geo: harnessGeo },
    fu: { geo: foreUpperGeo, mult: 2 },
    fl: { geo: foreLowerGeo, mult: 2 },
    hu: { geo: hindUpperGeo, mult: 2 },
    hl: { geo: hindLowerGeo, mult: 2 },
  },
  step: stepHorse,
  pose: poseHorse,
};

let horseSeed = 1;

/**
 * A horse at (x, z) facing yaw.
 *   coat    key of HORSE_COATS
 *   mode    'graze' | 'stand' | 'harness'
 *   tack    'saddle' | 'harness' | null
 *   tether  { x, z, len }: the stake it is tied to (graze)
 *   s       size: 1 a grown horse, about 0.65 a foal
 */
export function addHorse(ctx, x, z, yaw = 0, opts = {}) {
  const { coat = 'bay', mode = 'graze', tack = null, tether = null, s = 1, y = null, seed = horseSeed++, collide = true } = opts;
  const rng = rngKit(5000 + seed * 29);
  const a = {
    species: 'horse', x, z, y: y ?? ctx.ground.heightAt(x, z, 2), yaw, s: s * rng.range(0.96, 1.04), girth: rng.range(0.97, 1.05),
    coat: typeof coat === 'string' ? HORSE_COATS[coat] : coat,
    earScale: 1, earFold: 0.15, earSpread: 0.12, earTurn: 0,
    tailKind: 'tail', tack, mode, tether,
    rng, seed, t: rng.range(0, 40), phase: 0, stride: 1.3 * s,
    j: standing(), T: standing(), happy: 0, rest: -1, side: rng.int(0, 1), twitchT: rng.range(1, 4),
    lastSnort: -30, lastCall: -rng.range(0, 60), breathRate: 1.1, breathAmp: 0.012,
    state: mode === 'graze' ? 'graze' : 'stand', timer: rng.range(2, 8),
  };
  a.uses = ['torso', 'neck', 'head', 'ear', 'tail', 'fu', 'fl', 'hu', 'hl'];
  if (tack) a.uses.push(tack);
  if (mode === 'graze') grazePose(a.j, a); else standPose(a.j, a);
  herdFor(ctx, HORSE).add(a);

  a.proxy = proxy(ctx, a);
  if (collide) ctx.colliders.obb(x, z, 0.35 * a.s, 1.1 * a.s, yaw, { top: a.y + 1.5 * a.s, tag: 'horse' });
  ctx.interact({
    x: 0, y: 1.1 * a.s, z: -0.4 * a.s, w: 0.8 * a.s, h: 1.2 * a.s, d: 2.2 * a.s, parent: a.proxy,
    label: 'Pat the horse',
    action: (game) => {
      a.happy = 4;
      game.audio.play('snort', { pos: { x: a.x, y: 1.4, z: a.z } });
      const lines = ['The neck is warm and dusty. It blows at your pocket, hoping for bread.', 'Жануар! It nods its big head, and the flies go up.', 'It snorts and nudges you with its nose.'];
      game.hud.flash(lines[Math.floor(a.rng.next() * lines.length)], 2600);
    },
  });
  return a;
}

/**
 * A flat cart (арба) on two Zhiguli wheels, shafts forward, standing
 * behind a harnessed horse at (x, z) facing yaw. Static: goes into the batch.
 */
export function addCart(ctx, x, z, yaw, { load = 'hay', seed = 3 } = {}) {
  const b = ctx.batch;
  const rng = rngKit(seed);
  const at = (lx, lz) => [x + Math.cos(yaw) * lx + Math.sin(yaw) * lz, z - Math.sin(yaw) * lx + Math.cos(yaw) * lz];
  const cz = 2.35;           // cart centre behind the horse's centre
  const WOOD = 0x8a6a48, GREY = 0x6a6c6e;
  // the bed and its low side boards
  const [bx, bz] = at(0, cz);
  b.box(1.5, 0.08, 2.1, WOOD, bx, 0.62, bz, { ry: yaw });
  for (const s of [-1, 1]) {
    const [sx, sz] = at(s * 0.72, cz);
    b.box(0.05, 0.28, 2.1, 0x7a5a3a, sx, 0.7, sz, { ry: yaw });
  }
  const [tx, tz] = at(0, cz + 1.03);
  b.box(1.5, 0.28, 0.05, 0x7a5a3a, tx, 0.7, tz, { ry: yaw });
  // axle and two car wheels, black tyres on grey rims
  const [a0x, a0z] = at(-0.81, cz + 0.1), [a1x, a1z] = at(0.81, cz + 0.1);
  b.tube(a0x, 0.31, a0z, a1x, 0.31, a1z, 0.03, GREY, { seg: 6 });
  for (const s of [-1, 1]) {
    const [wx, wz] = at(s * 0.84, cz + 0.1);
    const tyre = new THREE.TorusGeometry(0.24, 0.075, 6, 14);
    tyre.rotateY(Math.PI / 2 + yaw);
    tyre.translate(wx, 0.31, wz);
    b.add(tyre, { color: 0x1e1c1a });
    const [h0x, h0z] = at(s * 0.79, cz + 0.1), [h1x, h1z] = at(s * 0.89, cz + 0.1);
    b.tube(h0x, 0.31, h0z, h1x, 0.31, h1z, 0.18, 0xa8aaaa, { seg: 10 });
  }
  // the shafts run forward to the collar
  for (const s of [-1, 1]) {
    const [p0x, p0z] = at(s * 0.55, cz - 1.0);
    const [p1x, p1z] = at(s * 0.4, -0.62);
    b.tube(p0x, 0.64, p0z, p1x, 1.05, p1z, 0.035, WOOD, { seg: 5 });
  }
  // the load
  if (load === 'hay') {
    const hay = new THREE.SphereGeometry(1, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2);
    hay.scale(0.72, 0.55, 1.0);
    hay.rotateY(yaw);
    hay.translate(bx, 0.66, bz);
    b.add(hay, { color: 0xc8b070, mat: 'foliage' });
  } else {
    for (let i = 0; i < 5; i++) {
      const [sx, sz] = at(rng.range(-0.45, 0.45), cz + rng.range(-0.7, 0.7));
      b.add(new THREE.SphereGeometry(0.22, 8, 6).scale(1, 0.7, 1.4).rotateY(yaw + rng.range(-0.3, 0.3)).translate(sx, 0.8, sz), { color: rng.pick([0xe8e2d0, 0xd8ccb0, 0x8a9a5a]) });
    }
  }
  ctx.colliders.obb(bx, bz, 0.9, 1.1, yaw, { top: 1.2, tag: 'cart' });
}
