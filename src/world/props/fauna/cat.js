import * as THREE from 'three';
import { rngKit } from '../../../core/util.js';
import { Geo, sweep, ell, cone, box, ramp, torsoPath, limbPath } from './geo.js';
import { herdFor, settle, watcher, joint, scaled } from './herd.js';
import { poseRig, poseHead, standing, walkLegs, legsStraight, walkToGoal, lookTargets, proxy, twitchEars } from './quad.js';
import './voices.js';

/* ------------------------------------------------------------------ *
 * Cats: the courtyard and bazaar cats every podyezd feeds.
 *
 * Modes
 *   sit     upright, tail wrapped round its paws, looking about; now
 *           and then it washes a paw or lies down in a loaf
 *   loaf    lying with its paws tucked under, eyes half shut
 *   curl    asleep in a ring, nose in its tail; lifts its head if you
 *           come close
 *   walk    strolls back and forth along a path (a pipe, a wall, a
 *           kerb), stops at the ends to sit and look about
 * E pets it: it purrs, raises its tail and turns to you.
 * ------------------------------------------------------------------ */

const D = {
  hip: [0.2, 0.14],
  head: [0.05, -0.33],
  ear: [0.036, 0.128, -0.068],
  tail: [0.03, 0.085], tail2: 0.14,
  fu: [0.042, -0.03, -0.29], fuLen: 0.1,
  hu: [0.045, -0.02, 0.0], huEnd: [-0.12, 0.03],
};

/* ------------------------------------------------------------------ geometry */

/** Tabby stripes across the body: dark bands at a steady spacing. */
const stripes = (v, k = 38) => ramp(0.1, 0.9, Math.sin(v * k)) * 0.85;

function torsoGeo() {
  const g = sweep(torsoPath([
    [0.09, 0.03, -0.02, 0.03],
    [0.06, 0.055, -0.05, 0.066],
    [0.0, 0.066, -0.072, 0.08],
    [-0.08, 0.06, -0.077, 0.076],
    [-0.16, 0.058, -0.076, 0.072],
    [-0.24, 0.06, -0.078, 0.072],
    [-0.3, 0.066, -0.074, 0.068],
    [-0.34, 0.066, -0.05, 0.056],
    [-0.36, 0.056, -0.012, 0.036],
  ]), 16, { sub: 3 });
  return new Geo().add(g, {
    fur: (p) => [
      Math.max(ramp(-0.03, -0.07, p.y), ramp(-0.01, -0.05, p.y) * ramp(-0.24, -0.32, p.z)),
      0, 0,
      stripes(p.z) * ramp(-0.03, 0.03, p.y),
    ],
  }).build();
}

function headGeo() {
  const geo = new Geo();
  const face = (p) => [
    ramp(0.07, 0.03, p.y),
    0,
    // white muzzle and a blaze up between the eyes
    Math.max(ramp(-0.1, -0.125, p.z) * ramp(0.09, 0.07, p.y), Math.abs(p.x) < 0.012 && p.z < -0.1 ? ramp(0.13, 0.08, p.y) : 0),
    // the tabby M on the forehead and cheek stripes
    ramp(0.11, 0.125, p.y) * (0.5 + 0.5 * Math.sin(p.x * 120)) + (Math.abs(p.x) > 0.045 ? stripes(p.y, 110) * 0.6 : 0),
  ];
  geo.add(sweep(limbPath([
    [0, -0.02, 0.02, 0.05, 0.056],
    [0, 0.05, -0.03, 0.046, 0.05],
  ]), 12), { fur: (p, n) => [ramp(0.3, 0.7, -n.z - n.y * 0.5), 0, 0, stripes(p.y, 60) * 0.5] });
  geo.add(ell(0.064, 0.056, 0.06, 0, 0.09, -0.07, 14), { fur: face });
  geo.add(ell(0.068, 0.042, 0.048, 0, 0.074, -0.082, 12), { fur: face });
  geo.add(ell(0.03, 0.022, 0.024, 0, 0.068, -0.122, 10), { fur: face });
  geo.add(ell(0.009, 0.006, 0.005, 0, 0.079, -0.134, 6), { color: 0xc07a78, fixed: true });
  for (const s of [-1, 1]) {
    geo.add(ell(0.015, 0.013, 0.008, s * 0.028, 0.098, -0.12, 8), { color: 0xb8b040, fixed: true });
    geo.add(box(0.004, 0.018, 0.004, s * 0.028, 0.098, -0.127), { color: 0x141210, fixed: true });
  }
  return geo.build();
}

function earGeo() {
  const g = cone(0.03, 0.058, 0, -0.008, 0, 0, 0, 0, 6);
  g.scale(1, 1, 0.45);
  const inner = cone(0.02, 0.042, 0, -0.004, -0.01, 0, 0, 0, 5);
  inner.scale(1, 1, 0.3);
  return new Geo()
    .add(g, { fur: (p) => [0, 0, 0, ramp(0.03, 0.05, p.y) * 0.5] })
    .add(inner, { color: 0xd8a8a0, fixed: true })
    .build();
}

function tail1Geo() {
  return new Geo().add(sweep(limbPath([
    [0, 0, -0.01, 0.018, 0.019],
    [0, 0, 0.07, 0.017, 0.018],
    [0, 0, 0.145, 0.016, 0.016],
  ]), 8, { sub: 3 }), { fur: (p) => [0, 0, 0, stripes(p.z, 70)] }).build();
}

function tail2Geo() {
  return new Geo().add(sweep(limbPath([
    [0, 0, -0.005, 0.016, 0.016],
    [0, 0, 0.08, 0.015, 0.015],
    [0, 0, 0.15, 0.013, 0.013],
    [0, 0, 0.165, 0.004, 0.004],
  ]), 8, { sub: 3 }), { fur: (p) => [0, 0, 0, Math.max(stripes(p.z, 70), ramp(0.12, 0.15, p.z))] }).build();
}

function foreUpperGeo() {
  return new Geo().add(sweep(limbPath([
    [0, 0.035, 0.01, 0.03, 0.042],
    [0, -0.04, 0.012, 0.024, 0.028],
    [0, -0.1, 0.0, 0.017, 0.018],
  ]), 8), { fur: (p) => [ramp(0, -0.04, p.y) * 0.4, ramp(-0.07, -0.1, p.y), 0, stripes(p.y, 70) * 0.6] }).build();
}

function paw(geo, y, z) {
  geo.add(ell(0.019, 0.013, 0.024, 0, y, z, 8), { fur: [0, 1, 0, 0] });
}

function foreLowerGeo() {
  const geo = new Geo().add(sweep(limbPath([
    [0, 0.005, 0, 0.017, 0.018],
    [0, -0.048, -0.004, 0.015, 0.015],
  ]), 7), { fur: [0, 1, 0, 0] });
  paw(geo, -0.057, -0.012);
  return geo.build();
}

function hindUpperGeo() {
  const geo = new Geo();
  geo.add(ell(0.036, 0.066, 0.052, 0, -0.04, -0.01, 12), { fur: (p) => [0, 0, 0, stripes(p.y, 60) * 0.7] });
  geo.add(sweep(limbPath([
    [0, -0.02, -0.01, 0.03, 0.04],
    [0, -0.08, -0.01, 0.024, 0.03],
    [0, -0.12, 0.03, 0.016, 0.018],
  ]), 8), { fur: (p) => [0, ramp(-0.09, -0.12, p.y), 0, stripes(p.y, 60) * 0.6] });
  return geo.build();
}

function hindLowerGeo() {
  const geo = new Geo().add(sweep(limbPath([
    [0, 0.005, 0.002, 0.016, 0.017],
    [0, -0.05, -0.004, 0.014, 0.015],
  ]), 7), { fur: [0, 1, 0, 0] });
  paw(geo, -0.056, -0.014);
  return geo.build();
}

/** Asleep in a ring: body round to the left, the tail wrapped over the nose. */
function curlGeo() {
  const geo = new Geo();
  const R = 0.1, arc = [];
  for (let i = 0; i <= 10; i++) {
    const a = -0.4 + (i / 10) * 4.7;
    const w = 0.07 - 0.02 * Math.abs(i / 10 - 0.45);
    arc.push({ p: [Math.cos(a) * R, 0.062, Math.sin(a) * R], rx: w, ry: 0.06 });
  }
  geo.add(sweep(arc, 14, { flatBottom: 0.5, sub: 2 }), { fur: (p) => [ramp(0.04, 0.0, p.y) * 0.6, 0, 0, stripes(Math.atan2(p.z, p.x) * 0.1, 60) * ramp(0.07, 0.11, p.y)] });
  const tail = [];
  for (let i = 0; i <= 8; i++) {
    const a = 4.2 + (i / 8) * 2.6;
    tail.push({ p: [Math.cos(a) * 0.165, 0.028 + 0.01 * Math.sin(i), Math.sin(a) * 0.165], rx: 0.018, ry: 0.017 });
  }
  geo.add(sweep(tail, 8, { sub: 2 }), { fur: (p) => [0, 0, 0, stripes(Math.atan2(p.z, p.x), 7)] });
  // tucked paws peeking out
  geo.add(ell(0.02, 0.013, 0.026, 0.07, 0.014, -0.1, 8), { fur: [0, 1, 0, 0] });
  geo.add(ell(0.02, 0.013, 0.026, 0.1, 0.014, -0.07, 8), { fur: [0, 1, 0, 0] });
  return geo.build();
}

/* ------------------------------------------------------------------ coats */

export const CAT_COATS = {
  ginger: { main: 0xd08a3a, light: 0xf2e2c8, dark: 0xa05a22, mask: [0.8, 0.8, 0.6, 1] },
  greyTabby: { main: 0x8e8a80, light: 0xe4ded2, dark: 0x3e3a36, mask: [0.7, 0.5, 0.5, 1] },
  brownTabby: { main: 0x8a6e4e, light: 0xd8c8a8, dark: 0x3a2c20, mask: [0.5, 0.3, 0.4, 1] },
  black: { main: 0x1e1c1c, light: 0x3a3634, dark: 0x121010, mask: [0, 0, 0, 0] },
  blackWhite: { main: 0x1e1c1c, light: 0xf0ece4, dark: 0x121010, mask: [1, 1, 1, 0] },
  white: { main: 0xece8e0, light: 0xf8f6f2, dark: 0xc8c0b4, mask: [1, 1, 1, 0] },
  greyWhite: { main: 0x6e6e6e, light: 0xeeeae2, dark: 0x4a4a4a, mask: [1, 1, 0.8, 0.2] },
  cream: { main: 0xe0c8a0, light: 0xf4ecdc, dark: 0xc49a6a, mask: [0.6, 0.6, 0.5, 0.8] },
};

/* ------------------------------------------------------------------ poses */

function sitPose(T) {
  legsStraight(T);
  T.bodyY = -0.13; T.bodyZ = 0.02; T.pitch = 0.95; T.roll = 0;
  T.fu0 = T.fu1 = -0.95; T.fl0 = T.fl1 = 0.0;
  T.hu0 = T.hu1 = 0.42; T.hl0 = T.hl1 = 0.2;
  T.headP = -0.9;
  // tail down to the ground and round the front paws
  T.tailP = 1.1; T.tailY = 1.2; T.tail2P = 0.25; T.tail2Y = 1.3;
}

function loafPose(T) {
  legsStraight(T);
  T.bodyY = -0.125; T.bodyZ = 0; T.pitch = 0.04; T.roll = 0;
  T.fu0 = T.fu1 = -1.3; T.fl0 = T.fl1 = 2.4;
  T.hu0 = T.hu1 = 1.3; T.hl0 = T.hl1 = -2.6;
  T.headP = -0.15;
  T.tailP = 0.25; T.tailY = 1.0; T.tail2P = 0; T.tail2Y = 1.1;
}

function standPose(T) {
  legsStraight(T);
  T.bodyY = 0; T.bodyZ = 0; T.pitch = 0; T.roll = 0; T.headP = 0.05;
  // tail up, the tip bent over: a cat about its business
  T.tailP = -1.25; T.tailY = 0; T.tail2P = 0.7; T.tail2Y = 0;
}

/* ------------------------------------------------------------------ behaviour */

function next(a) {
  const r = a.rng;
  if (a.mode === 'walk') return r.weighted([['walk', 5], ['sit', 2], ['groom', 1]]);
  if (a.mode === 'loaf') return r.weighted([['loaf', 5], ['sit', 1.5], ['groom', 1]]);
  return r.weighted([['sit', 5], ['groom', 1.2], ['loaf', 1.5]]);
}

function enter(a, state) {
  a.state = state;
  const r = a.rng;
  a.timer = { sit: r.range(8, 20), loaf: r.range(14, 40), groom: r.range(3, 6), walk: 30, curl: 1e9 }[state];
  if (state === 'walk' && a.path) {
    a.leg = 1 - (a.leg || 0);
    const [x, z] = a.path[a.leg];
    a.gx = x; a.gz = z;
  }
}

function stepCat(a, dt, game, dist) {
  a.t += dt;
  a.timer -= dt;
  a.happy = Math.max(0, a.happy - dt);
  const T = a.T;
  const p = watcher(game);
  const onFoot = !game.controller;
  const dp = Math.hypot(p.x - a.x, p.z - a.z);
  const near = onFoot && dp < 5;
  if (a.state !== 'curl' && a.timer <= 0) enter(a, next(a));
  // a cat in the middle of its walk stops and stares when you come close
  if (a.state === 'walk' && onFoot && dp < 2.2) { a.state = 'sit'; a.timer = 4; }
  if (a.happy > 0 && a.state === 'walk') a.state = 'sit';

  let rate = 3;
  switch (a.state) {
    case 'curl': {
      // head lifts off the tail when you come near
      a.awake += ((near || a.happy > 0 ? 1 : 0) - a.awake) * Math.min(1, dt * 2);
      T.headP = -0.1 + a.awake * 0.4;
      T.headY = a.awake > 0.3 ? lookTargets(a, p, 1.0) * a.awake : 0;
      break;
    }
    case 'loaf': loafPose(T); break;
    case 'groom': {
      sitPose(T);
      // one front paw up to the mouth, the head licking down at it
      const k = a.side;
      T[`fu${k}`] = -0.95 + 1.9; T[`fl${k}`] = -1.6;
      T.headP = -0.75 + Math.max(0, Math.sin(a.t * 7)) * 0.25;
      T.headY = k ? 0.25 : -0.25;
      rate = 8;
      break;
    }
    case 'walk': {
      standPose(T);
      if (walkToGoal(a, dt, 0.4, 2.2)) enter(a, a.rng.chance(0.6) ? 'sit' : 'walk');
      else walkLegs(T, a.phase, { amp: 0.45, fore: 1.1, hind: 0.9, bob: 0.006 });
      if (a.pathY === null) a.y = game.world.heightAt(a.x, a.z, a.y + 0.3);
      rate = 12;
      break;
    }
    default: sitPose(T);
  }
  if (a.state !== 'curl') {
    if (near && a.state !== 'groom') T.headY = lookTargets(a, p, 1.2);
    else if (a.state !== 'groom') T.headY = Math.sin(a.t * 0.3 + a.seed) * 0.5 + Math.sin(a.t * 1.7) * 0.08;
    // the tail tip flicks; petted, the tail goes straight up
    if (a.happy > 0) { T.tailP = -1.3; T.tailY = 0; T.tail2P = 0.2; T.tail2Y = Math.sin(a.t * 3) * 0.2; }
    T.tail2Y += Math.sin(a.t * 2.3) * 0.25 * (0.5 + 0.5 * Math.sin(a.t * 0.4));
  }
  twitchEars(a, T, dt);
  if (a.happy > 0) { T.ear0 = T.ear1 = 0.15; T.headP += 0.2; }
  settle(a.j, T, rate, dt);
  a.breathRate = 2.4;
  a.breathAmp = a.state === 'curl' || a.state === 'loaf' ? 0.04 : 0.022;
  if (a.proxy) { a.proxy.position.set(a.x, a.y, a.z); a.proxy.rotation.y = a.yaw; }
}

const _root = new THREE.Matrix4();
const _body = new THREE.Matrix4();
const _out = new THREE.Matrix4();

function poseCat(a, write) {
  if (a.state !== 'curl') { poseRig(a, D, write); return; }
  joint(_root, null, a.x, a.y, a.z, 0, a.yaw, 0, a.s);
  const br = 1 + Math.sin(a.t * a.breathRate) * a.breathAmp;
  write('curl', 0, scaled(_out, _root, br, br, br));
  // the head lies on the front of the ring, chin toward the tail
  joint(_body, _root, 0.02, -0.02, -0.02, 0, -0.9, 0.35);
  poseHead(a, { head: [0.03, -0.08], ear: D.ear }, _body, write);
}

export const CAT = {
  name: 'cat',
  view: 60,
  parts: {
    torso: { geo: torsoGeo },
    head: { geo: headGeo },
    ear: { geo: earGeo, mult: 2, cast: false },
    tail: { geo: tail1Geo, cast: false },
    tail2: { geo: tail2Geo, cast: false },
    curl: { geo: curlGeo },
    fu: { geo: foreUpperGeo, mult: 2, cast: false },
    fl: { geo: foreLowerGeo, mult: 2, cast: false },
    hu: { geo: hindUpperGeo, mult: 2, cast: false },
    hl: { geo: hindLowerGeo, mult: 2, cast: false },
  },
  step: stepCat,
  pose: poseCat,
};

let catSeed = 1;

/**
 * A cat at (x, y, z) facing yaw.
 *   coat   key of CAT_COATS or a coat object
 *   mode   'sit' | 'loaf' | 'curl' | 'walk'
 *   path   for 'walk': [[x0, z0], [x1, z1]] (it starts at x, z)
 *   pathY  fixed height of the path (a pipe top, a wall); null = ground
 *   s      size (kittens smaller)
 */
export function addCat(ctx, x, y, z, yaw = 0, opts = {}) {
  const { coat = 'ginger', mode = 'sit', path = null, pathY = y, s = 1, seed = catSeed++, collide = true } = opts;
  const rng = rngKit(7000 + seed * 17);
  const a = {
    species: 'cat', x, y, z, yaw, s: s * rng.range(0.92, 1.08), girth: rng.range(0.94, 1.1),
    coat: typeof coat === 'string' ? CAT_COATS[coat] : coat,
    earScale: 1, earFold: 0.1, earSpread: 0.22, earTurn: 0.15,
    tailKind: mode === 'curl' ? null : 'tail', mode, path, pathY: mode === 'walk' ? pathY : y,
    rng, seed, t: rng.range(0, 30), phase: 0, stride: 0.26,
    j: standing(), T: standing(), happy: 0, awake: 0, side: rng.int(0, 1), twitchT: rng.range(1, 4),
    breathRate: 2.4, breathAmp: 0.03,
  };
  a.uses = mode === 'curl' ? ['curl', 'head', 'ear'] : ['torso', 'head', 'ear', 'tail', 'tail2', 'fu', 'fl', 'hu', 'hl'];
  if (mode === 'curl') a.state = 'curl', a.timer = 1e9;
  else enter(a, mode === 'walk' ? 'walk' : mode);
  const T0 = standing();
  if (mode === 'loaf') loafPose(T0); else if (mode === 'walk') standPose(T0); else sitPose(T0);
  a.j = T0;
  herdFor(ctx, CAT).add(a);

  a.proxy = proxy(ctx, a);
  if (collide && mode !== 'walk') ctx.colliders.circle(x, z, 0.2 * a.s, { top: y + 0.3, bottom: y - 0.1, tag: 'cat' });
  ctx.interact({
    x: 0, y: 0.18 * a.s, z: 0, w: 0.5 * a.s, h: 0.45 * a.s, d: 0.6 * a.s, parent: a.proxy,
    label: 'Pet the cat (кис-кис)',
    action: (game) => {
      a.happy = 4;
      game.audio.play('purr', { pos: { x: a.x, y: a.y + 0.2, z: a.z } });
      if (a.rng.chance(0.5)) game.audio.play('meow', { pos: { x: a.x, y: a.y + 0.3, z: a.z } });
      const lines = ['мур-мур-мур. It pushes its head into your palm.', 'It purrs like a little tractor.', 'Мяу. It shuts its eyes and purrs.', 'It purrs, then bites your hand, gently, to say enough.'];
      game.hud.flash(lines[Math.floor(a.rng.next() * lines.length)], 2400);
    },
  });
  return a;
}
