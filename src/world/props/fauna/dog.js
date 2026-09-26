import * as THREE from 'three';
import { rngKit, clamp } from '../../../core/util.js';
import { Geo, sweep, ell, cone, ring, ramp, torsoPath, limbPath } from './geo.js';
import { herdFor, settle, watcher } from './herd.js';
import { poseRig, standing, walkLegs, legsStraight, walkToGoal, lookTargets, proxy, twitchEars } from './quad.js';
import './voices.js';

/* ------------------------------------------------------------------ *
 * Dogs.
 *
 * The street dog of a post-Soviet town: a medium mongrel with a deep
 * chest, a tucked belly, pricked or half-folded ears and either a
 * sabre tail or the curled laika tail over the back. By the private
 * houses, the big guard dogs: alabai and tobet, heavy-headed, with
 * cropped ears, on a chain by the kennel.
 *
 * Modes
 *   sleep   stays on its spot: lies with its chin on its paws, sits up,
 *           scratches, lifts its head when you come near
 *   roam    one of a pack: ambles about its patch, sniffs, sits, lies
 *   chain   by a kennel: lies until you come close, then stands up at
 *           the end of its chain and barks
 * E pets a sleeper or a rover (a chained dog is on duty).
 * ------------------------------------------------------------------ */

/** Joint positions: hip in the root frame, the rest in the torso frame. */
const D = {
  hip: [0.44, 0.18],
  head: [0.10, -0.43],
  ear: [0.048, 0.225, -0.105],
  tail: [0.075, 0.12],
  fu: [0.075, -0.02, -0.37], fuLen: 0.27,
  hu: [0.085, -0.03, 0.0], huEnd: [-0.29, 0.056],
};
const BODY_Z = 0.8;     // torso rows are drawn long, then pulled in
const LEG_Y = 1.12;     // upper leg segments, likewise

/* ------------------------------------------------------------------ geometry */

function torsoGeo() {
  const g = sweep(torsoPath(scaleRows([
    [0.17, 0.04, -0.03, 0.04],
    [0.12, 0.085, -0.075, 0.095],
    [0.04, 0.10, -0.10, 0.12],
    [-0.06, 0.095, -0.075, 0.115],
    [-0.16, 0.10, -0.06, 0.112],
    [-0.27, 0.11, -0.12, 0.125],
    [-0.38, 0.12, -0.16, 0.135],
    [-0.47, 0.13, -0.165, 0.13],
    [-0.54, 0.14, -0.13, 0.11],
    [-0.59, 0.14, -0.06, 0.08],
    [-0.61, 0.12, 0.0, 0.04],
  ])), 18, { sub: 2 });
  return new Geo().add(g, {
    fur: (p) => [
      // white chest running back into the belly
      Math.max(ramp(-0.04, -0.13, p.y) * ramp(-0.18, -0.34, p.z), ramp(-0.02, -0.07, p.y) * ramp(0.02, -0.08, p.z) * 0.8),
      0, 0,
      // the dark saddle of the shepherd crosses
      ramp(0.04, 0.10, p.y) * ramp(0.13, 0.06, p.z),
    ],
  }).build();
}

function headGeo() {
  const geo = new Geo();
  const faceFur = (p) => [
    ramp(0.1, 0.03, p.y),                                     // throat
    0,
    // muzzle, cheeks and the two eyebrow spots of a black-and-tan
    Math.max(ramp(-0.17, -0.22, p.z) * ramp(0.2, 0.16, p.y),
      Math.exp(-(((Math.abs(p.x) - 0.036) ** 2) + (p.y - 0.222) ** 2 + (p.z + 0.19) ** 2) / 0.00025)),
    ramp(-0.26, -0.31, p.z),                                  // dark muzzle tip
  ];
  // neck, rising from the shoulders
  geo.add(sweep(limbPath([
    [0, -0.05, 0.04, 0.078, 0.095],
    [0, 0.04, -0.02, 0.07, 0.082],
    [0, 0.12, -0.075, 0.062, 0.066],
  ]), 14), { fur: (p, n) => [ramp(0.2, 0.6, -n.z * 0.7 - n.y), 0, 0, ramp(0.3, 0.7, n.y - n.z * 0.2) * 0.8] });
  geo.add(ell(0.086, 0.078, 0.098, 0, 0.17, -0.12, 16), { fur: faceFur });
  // cheeks, a little wider than the skull
  geo.add(ell(0.064, 0.047, 0.052, 0, 0.145, -0.16, 12), { fur: faceFur });
  geo.add(sweep(limbPath([
    [0, 0.162, -0.17, 0.05, 0.048],
    [0, 0.152, -0.25, 0.04, 0.038],
    [0, 0.147, -0.3, 0.031, 0.031],
  ]), 12), { fur: faceFur });
  geo.add(ell(0.034, 0.016, 0.06, 0, 0.118, -0.24, 8), { fur: faceFur });
  geo.add(ell(0.023, 0.018, 0.017, 0, 0.158, -0.318, 8), { color: 0x141210, fixed: true });
  for (const s of [-1, 1]) {
    geo.add(ell(0.014, 0.013, 0.008, s * 0.042, 0.19, -0.196, 8), { color: 0x2a1a10, fixed: true });
    geo.add(ell(0.005, 0.005, 0.003, s * 0.046, 0.194, -0.203, 5), { color: 0xe8e0d0, fixed: true });
  }
  return geo.build();
}

function earGeo() {
  // a pricked ear: a flattened cone, the hollow facing forward
  const g = cone(0.036, 0.095, 0, -0.01, 0, 0, 0, 0, 7);
  g.scale(1, 1, 0.42);
  const inner = cone(0.024, 0.07, 0, -0.005, -0.012, 0, 0, 0, 6);
  inner.scale(1, 1, 0.3);
  return new Geo()
    .add(g, { fur: (p) => [0, 0, 0, ramp(0.03, 0.08, p.y)] })
    .add(inner, { color: 0xc89a88, fixed: true })
    .build();
}

function tailGeo() {
  return new Geo().add(sweep(limbPath([
    [0, 0, -0.01, 0.028, 0.03],
    [0, -0.012, 0.08, 0.031, 0.034],
    [0, -0.05, 0.17, 0.03, 0.033],
    [0, -0.12, 0.24, 0.024, 0.026],
    [0, -0.2, 0.28, 0.016, 0.017],
    [0, -0.25, 0.29, 0.006, 0.006],
  ]), 8, { sub: 2 }), { fur: (p) => [0, ramp(-0.17, -0.23, p.y), 0, ramp(-0.02, 0.1, -p.y) * 0.5] }).build();
}

function curlGeo() {
  // the laika's ring of a tail, carried over the back and to one side
  return new Geo().add(sweep(limbPath([
    [0, -0.01, 0.0, 0.03, 0.03],
    [0, 0.07, 0.04, 0.036, 0.034],
    [0.005, 0.135, 0.01, 0.037, 0.035],
    [0.02, 0.16, -0.06, 0.033, 0.032],
    [0.045, 0.14, -0.12, 0.026, 0.025],
    [0.07, 0.095, -0.12, 0.018, 0.018],
    [0.078, 0.07, -0.08, 0.008, 0.008],
  ]), 8, { sub: 2 }), { fur: (p) => [ramp(0.12, 0.15, p.y) * ramp(-0.05, -0.1, p.z) * 0.6, 0, 0, ramp(0.1, 0.16, p.y) * 0.6] }).build();
}

function foreUpperGeo() {
  return new Geo().add(sweep(limbPath([
    [0, 0.05, 0.012, 0.05, 0.072],
    [0, -0.06, 0.02, 0.042, 0.052],
    [0, -0.15, 0.0, 0.03, 0.032],
    [0, -0.25, 0.0, 0.024, 0.026],
  ]), 10), { fur: (p) => [ramp(-0.02, 0.03, -p.z) * ramp(0.0, -0.05, p.y) * 0.5, ramp(-0.16, -0.25, p.y), 0, 0] }).build().scale(1, LEG_Y, 1);
}

function paw(geo, y, z) {
  geo.add(ell(0.028, 0.02, 0.038, 0, y + 0.002, z + 0.004, 10), { fur: [0, 1, 0, 0] });
  for (const s of [-1, 0, 1]) geo.add(ell(0.009, 0.01, 0.011, s * 0.013, y - 0.002, z - 0.03, 5), { fur: [0, 1, 0, 0], color: 0xd8d0c4 });
}

function foreLowerGeo() {
  const geo = new Geo().add(sweep(limbPath([
    [0, 0.01, 0, 0.024, 0.026],
    [0, -0.07, -0.008, 0.021, 0.022],
    [0, -0.1, -0.02, 0.02, 0.022],
  ]), 7), { fur: [0, 1, 0, 0] });
  paw(geo, -0.118, -0.035);
  return geo.build();
}

function hindUpperGeo() {
  const geo = new Geo();
  // the thigh, full and round, and the gaskin angling back to the hock
  geo.add(ell(0.056, 0.115, 0.088, 0, -0.07, -0.015, 14), { fur: (p) => [0, 0, 0, ramp(0.0, 0.04, p.y) * 0.6] });
  geo.add(sweep(limbPath([
    [0, -0.03, -0.02, 0.05, 0.07],
    [0, -0.12, -0.03, 0.04, 0.052],
    [0, -0.2, 0.02, 0.027, 0.032],
    [0, -0.265, 0.05, 0.022, 0.026],
  ]), 10), { fur: (p) => [0, ramp(-0.2, -0.28, p.y), 0, 0] });
  return geo.build().scale(1, LEG_Y, 1);
}

function hindLowerGeo() {
  const geo = new Geo().add(sweep(limbPath([
    [0, 0.01, 0.004, 0.023, 0.026],
    [0, -0.07, -0.005, 0.02, 0.021],
    [0, -0.085, -0.015, 0.02, 0.021],
  ]), 7), { fur: [0, 1, 0, 0] });
  paw(geo, -0.098, -0.035);
  return geo.build();
}

function scaleRows(rows) {
  return rows.map(([z, top, bot, rx]) => [z * BODY_Z, top, bot, rx]);
}

/** The chained dogs' collars are part of the head mesh set: a separate ring. */
function collarGeo() {
  return new Geo().add(ring(0.075, 0.012, 0, 0.04, -0.02, -0.5, 0, 0), { color: 0x4a2a1a, fixed: true }).build();
}

/* ------------------------------------------------------------------ coats */

/** mask: [chest, paws, face, dark] */
export const DOG_COATS = {
  ginger: { main: 0xb8743a, light: 0xeed2a8, dark: 0x7a4620, mask: [1, 1, 0.6, 0] },
  blackWhite: { main: 0x24201e, light: 0xeee8dc, dark: 0x141210, mask: [1, 1, 0, 0] },
  blackTan: { main: 0x221e1c, light: 0xb87a42, dark: 0x141210, mask: [0.9, 1, 1, 0] },
  grey: { main: 0x8e8478, light: 0xd4ccbe, dark: 0x4a4440, mask: [0.8, 0.6, 0.5, 0.6] },
  shepherd: { main: 0xa87a48, light: 0xd2ae7a, dark: 0x2a221c, mask: [0.7, 0.7, 0.4, 1] },
  cream: { main: 0xd8c4a0, light: 0xf2ece0, dark: 0x8a6a48, mask: [1, 1, 0.5, 0] },
  brown: { main: 0x6a4428, light: 0xc8a47a, dark: 0x3a2618, mask: [0.5, 0.8, 0.3, 0.4] },
  white: { main: 0xe8e2d4, light: 0xf8f4ec, dark: 0x9a8a78, mask: [1, 1, 1, 0.3] },
  fawn: { main: 0xc8a070, light: 0xefe2c8, dark: 0x5a4432, mask: [1, 1, 0.3, 0.9] },
};

/** Big guard breeds, and the ordinary mongrel. */
const BUILDS = {
  mongrel: { s: 1, girth: 1, earScale: 1 },
  alabai: { s: 1.3, girth: 1.14, earScale: 0.5, earFold: -0.3, earSpread: 0.7, tail: 'tail' },
  tobet: { s: 1.34, girth: 1.1, earScale: 0.8, earFold: -1.2, earSpread: 0.9, tail: 'tail' },
};

/* ------------------------------------------------------------------ poses */

function lie(T, a) {
  legsStraight(T);
  T.bodyY = -0.27; T.bodyZ = 0; T.pitch = 0.02; T.roll = 0;
  T.fu0 = T.fu1 = 1.45; T.fl0 = T.fl1 = 0.1;
  T.hu0 = T.hu1 = 1.25; T.hl0 = T.hl1 = -2.55;
  T.headP = a.awake > 0.5 ? -0.05 : -0.72;
  T.tailP = -0.35; T.tailY = 1.0;
}

function sit(T) {
  legsStraight(T);
  T.bodyY = -0.29; T.bodyZ = 0.04; T.pitch = 0.78; T.roll = 0;
  T.fu0 = T.fu1 = -0.8; T.fl0 = T.fl1 = 0.02;
  T.hu0 = T.hu1 = 0.3; T.hl0 = T.hl1 = 0.45;
  T.headP = -0.62;
  T.tailP = -0.4; T.tailY = 0.9;
}

function stand(T) {
  legsStraight(T);
  T.bodyY = 0; T.bodyZ = 0; T.pitch = 0; T.roll = 0;
  T.headP = 0; T.tailP = 0; T.tailY = 0;
}

/* ------------------------------------------------------------------ behaviour */

const LOOK = 6;        // metres: it notices you
const WOOF = 2.2;

function nextState(a) {
  const r = a.rng;
  if (a.mode === 'chain') return r.weighted([['lie', 6], ['sit', 2.5], ['scratch', 1]]);
  if (a.mode === 'sleep') return r.weighted([['lie', 7], ['sit', 1.6], ['scratch', 0.8], ['stand', 0.4]]);
  return r.weighted([['walk', 4], ['sniff', 2], ['sit', 1.6], ['lie', 1.4], ['scratch', 0.8]]);
}

function enter(a, state) {
  a.state = state;
  const r = a.rng;
  a.timer = { lie: r.range(10, 30), sit: r.range(5, 14), scratch: r.range(1.8, 3.2), stand: r.range(3, 7), walk: 20, sniff: r.range(3, 7) }[state] || 5;
  if (state === 'walk') {
    const ang = r.range(0, Math.PI * 2), rad = Math.sqrt(r.next()) * a.home.r;
    a.gx = a.home.x + Math.cos(ang) * rad;
    a.gz = a.home.z + Math.sin(ang) * rad;
  }
}

function stepDog(a, dt, game, dist) {
  a.t += dt;
  a.timer -= dt;
  a.happy = Math.max(0, a.happy - dt);
  const T = a.T;
  const p = watcher(game);
  const onFoot = !game.controller;
  const dp = Math.hypot(p.x - a.x, p.z - a.z);
  const near = onFoot && dp < LOOK;
  a.awake += ((near || a.happy > 0 || a.state !== 'lie' ? 1 : 0) - a.awake) * Math.min(1, dt * (near ? 2.5 : 0.5));

  if (a.mode === 'chain') {
    stepChain(a, dt, game, dp, onFoot);
  } else {
    if (a.timer <= 0) enter(a, nextState(a));
    // a rover stops to look at you; a petted dog sits and wags
    if (a.happy > 0 && a.state !== 'lie') a.state = 'sit';
    if (near && a.state === 'walk' && dp < 3) a.state = 'stand';
  }

  let rate = 3;
  switch (a.state) {
    case 'lie': lie(T, a); rate = 2; break;
    case 'sit': sit(T); break;
    case 'scratch': {
      sit(T);
      const k = a.scratchSide;
      T[`hu${k}`] = 1.35; T[`hl${k}`] = -0.3 + Math.sin(a.t * 26) * 0.45;
      T.headR = (k ? 0.45 : -0.45); T.headY = (k ? 0.35 : -0.35); T.headP = -0.4;
      T.roll = k ? -0.12 : 0.12;
      rate = 14;
      break;
    }
    case 'sniff': {
      stand(T);
      T.headP = -1.0 + Math.sin(a.t * 9) * 0.06;
      T.headY = Math.sin(a.t * 0.9) * 0.5;
      T.pitch = -0.06;
      T.tailP = -0.3; T.tailY = Math.sin(a.t * 3) * 0.25;
      break;
    }
    case 'walk': case 'bark': {
      stand(T);
      const speed = a.state === 'bark' ? 1.8 : 0.85;
      const arrived = walkToGoal(a, dt, speed);
      if (arrived) {
        if (a.state === 'walk') enter(a, a.rng.chance(0.5) ? 'sniff' : 'stand');
      } else {
        walkLegs(T, a.phase, { amp: 0.42 });
        T.headP = -0.25 + Math.sin(a.phase * 2) * 0.04;
        T.tailP = -0.2; T.tailY = Math.sin(a.t * 4) * 0.3;
      }
      a.y = game.world.heightAt(a.x, a.z, a.y + 0.5);
      rate = 10;
      break;
    }
    default: stand(T);
  }

  // heads turn toward you, ears prick
  if (near && a.state !== 'scratch' && a.state !== 'sniff') {
    T.headY = lookTargets(a, p, 1.0);
    if (a.state !== 'lie' || a.awake > 0.5) T.headP += 0.12;
  } else if (a.state !== 'scratch' && a.state !== 'sniff' && a.state !== 'walk') {
    T.headY = Math.sin(a.t * 0.23 + a.seed) * 0.35;
    T.headR = 0;
  }
  twitchEars(a, T, dt);
  // tail: a lazy sway, a thump when you come close, a real wag when petted
  const wag = a.happy > 0 ? 1.0 : near ? 0.5 : 0.12;
  const wagRate = a.happy > 0 ? 13 : near ? 8 : 2.5;
  T.tailY = (T.tailY || 0) + Math.sin(a.t * wagRate) * wag * (a.state === 'lie' ? 0.6 : 0.8);
  if (a.tailKind === 'tailCurl') { T.tailP = 0; T.tailY *= 0.25; }

  // fast joints for the wag, slower for the body
  const bodyRate = a.state === 'walk' ? 12 : rate;
  settle(a.j, T, bodyRate, dt);
  a.j.tailY = T.tailY;

  a.breathRate = a.state === 'lie' ? 1.4 : a.state === 'bark' ? 5 : 2.2;
  a.breathAmp = a.state === 'lie' ? 0.035 : 0.02;

  if (dp < WOOF && onFoot && a.mode !== 'chain' && a.t - a.lastWoof > 14 && a.happy <= 0 && dist < 30) {
    a.lastWoof = a.t;
    game.audio.play('woof', { pos: { x: a.x, y: 0.4, z: a.z }, rate: 1.1 / a.s });
  }
  if (a.proxy) { a.proxy.position.set(a.x, a.y, a.z); a.proxy.rotation.y = a.yaw; }
}

/** A kennel dog: lies at its post until you come near, then barks at the end of its chain. */
function stepChain(a, dt, game, dp, onFoot) {
  const c = a.chain;
  const p = watcher(game);
  const alarmed = onFoot && dp < 8.5;
  if (alarmed) {
    // stand at the end of the chain between the post and you
    const dx = p.x - c.x, dz = p.z - c.z, d = Math.hypot(dx, dz) || 1;
    const reach = Math.min(c.len, d - 0.9);
    a.gx = c.x + (dx / d) * reach;
    a.gz = c.z + (dz / d) * reach;
    const arrived = Math.hypot(a.gx - a.x, a.gz - a.z) < 0.2;
    a.state = arrived ? 'barkStand' : 'bark';
    if (arrived) a.yaw += clamp(Math.atan2(Math.sin(Math.atan2(-(p.x - a.x), -(p.z - a.z)) - a.yaw), Math.cos(Math.atan2(-(p.x - a.x), -(p.z - a.z)) - a.yaw)), -4 * dt, 4 * dt);
    a.barkT -= dt;
    if (a.barkT <= 0) {
      a.barkT = 0.9 + a.rng.next() * 1.5;
      a.lunge = 1;
      game.audio.play(a.growled ? 'bark' : 'growl', { pos: { x: a.x, y: 0.6, z: a.z }, rate: 0.8 });
      a.growled = true;
    }
    a.timer = 4;
  } else {
    a.growled = false;
    if (a.state === 'bark' || a.state === 'barkStand') {
      a.gx = a.home.x; a.gz = a.home.z;
      a.state = 'walk';
    }
    if (a.state === 'walk' && Math.hypot(a.home.x - a.x, a.home.z - a.z) < 0.2) enter(a, 'lie');
    if (a.timer <= 0 && a.state !== 'walk') enter(a, nextState(a));
  }
  a.lunge = Math.max(0, (a.lunge || 0) - dt * 3.5);
  if (a.state === 'barkStand') {
    a.T.bodyY = 0; // standing; the bark shows in the head and a hop of the forequarters
  }
}

/* ------------------------------------------------------------------ species */

function poseDog(a, write) {
  if (a.state === 'barkStand' || a.state === 'bark') {
    // lunging: forequarters lift, head up and forward with each bark
    const l = Math.sin((a.lunge || 0) * Math.PI);
    a.j.pitch = 0.12 * l;
    a.j.headP = 0.25 - 0.2 * l;
    a.j.fu0 = a.j.fu1 = 0.35 * l;
  }
  const { head } = poseRig(a, D, write);
  if (a.collar) write('collar', 0, head);
}

export const DOG = {
  name: 'dog',
  view: 90,
  parts: {
    torso: { geo: torsoGeo },
    head: { geo: headGeo },
    ear: { geo: earGeo, mult: 2, cast: false },
    tail: { geo: tailGeo, cast: false },
    tailCurl: { geo: curlGeo, cast: false },
    collar: { geo: collarGeo, cast: false },
    fu: { geo: foreUpperGeo, mult: 2 },
    fl: { geo: foreLowerGeo, mult: 2, cast: false },
    hu: { geo: hindUpperGeo, mult: 2 },
    hl: { geo: hindLowerGeo, mult: 2, cast: false },
  },
  step: stepDog,
  pose: poseDog,
};

/* ------------------------------------------------------------------ chains */

const CHAIN_SEG = 7;
const CHAINS = new WeakMap();

/** All the kennel chains in one line mesh, sagging between post and collar. */
function chainFor(ctx, a) {
  let sys = CHAINS.get(ctx.root);
  if (!sys) {
    sys = { list: [], line: null };
    CHAINS.set(ctx.root, sys);
    ctx.update(() => {
      if (!sys.line) {
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(sys.list.length * CHAIN_SEG * 6), 3));
        sys.line = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: 0x5a5a56 }));
        sys.line.frustumCulled = false;
        ctx.root.add(sys.line);
        sys.list.forEach((d) => { d.dirty = true; });
      }
      const pos = sys.line.geometry.attributes.position;
      let changed = false;
      sys.list.forEach((d, i) => {
        const a = d.a;
        if (!d.dirty && a.acc > 0) return;
        d.dirty = false;
        changed = true;
        // the collar sits at the base of the neck
        const fx = -Math.sin(a.yaw), fz = -Math.cos(a.yaw);
        const cx = a.x + fx * 0.36 * a.s, cz = a.z + fz * 0.36 * a.s, cy = a.y + (0.5 + a.j.bodyY) * a.s;
        const len = Math.hypot(cx - d.x, cz - d.z);
        const sag = Math.max(0.05, (a.chain.len + 0.4 - len) * 0.6);
        let px = d.x, py = d.y, pz = d.z;
        for (let k = 1; k <= CHAIN_SEG; k++) {
          const t = k / CHAIN_SEG;
          const x = d.x + (cx - d.x) * t, z = d.z + (cz - d.z) * t;
          const y = Math.max(a.y + 0.01, d.y + (cy - d.y) * t - sag * 4 * t * (1 - t));
          const o = (i * CHAIN_SEG + k - 1) * 2;
          pos.setXYZ(o, px, py, pz);
          pos.setXYZ(o + 1, x, y, z);
          px = x; py = y; pz = z;
        }
      });
      if (changed) pos.needsUpdate = true;
    });
  }
  const d = { a, x: a.chain.x, y: a.y + 0.12, z: a.chain.z, dirty: true };
  sys.list.push(d);
  if (sys.line) { ctx.root.remove(sys.line); sys.line = null; }
}

let dogSeed = 1;

/**
 * A dog at (x, z) facing yaw.
 *   coat    key of DOG_COATS (or a coat object)
 *   build   'mongrel' | 'alabai' | 'tobet'
 *   mode    'sleep' | 'roam' | 'chain'
 *   r       roaming radius about (x, z)
 *   chain   { x, z, len }: the post and the chain length
 *   curl    the laika tail
 *   y       ground height (defaults to the walkable ground there)
 */
export function addDog(ctx, x, z, yaw = 0, opts = {}) {
  const {
    coat = 'ginger', build = 'mongrel', mode = 'sleep', r = 5, chain = null,
    curl = false, y = null, earFold = null, pet = mode !== 'chain', seed = dogSeed++,
  } = opts;
  const B = BUILDS[build] || BUILDS.mongrel;
  const rng = rngKit(9000 + seed * 13);
  const tailKind = B.tail || (curl ? 'tailCurl' : 'tail');
  const a = {
    species: 'dog', x, z, y: y ?? ctx.ground.heightAt(x, z, 2), yaw, s: B.s * rng.range(0.9, 1.08),
    girth: B.girth * rng.range(0.94, 1.06),
    coat: typeof coat === 'string' ? DOG_COATS[coat] : coat,
    earScale: B.earScale * rng.range(0.9, 1.15),
    earFold: earFold ?? B.earFold ?? rng.weighted([[0, 3], [-0.9, 1.5], [-1.7, 1]]),
    earSpread: B.earSpread ?? rng.range(0.15, 0.4), earTurn: 0,
    tailKind, mode, home: { x, z, r }, chain,
    collar: mode === 'chain' || build !== 'mongrel',
    rng, seed, t: rng.range(0, 20), phase: 0, stride: 0.55 * B.s,
    j: standing(), T: standing(), awake: 0, happy: 0, lastWoof: -20, barkT: 0,
    twitchT: rng.range(1, 4), scratchSide: rng.int(0, 1), breathRate: 1.5, breathAmp: 0.03,
  };
  a.uses = ['torso', 'head', 'ear', tailKind, 'fu', 'fl', 'hu', 'hl'];
  if (a.collar) a.uses.push('collar');
  enter(a, mode === 'roam' ? nextState(a) : 'lie');
  // start in the pose, not standing up out of it
  a.j = { ...a.T };
  if (a.state === 'lie') lie(a.j, a);
  herdFor(ctx, DOG).add(a);
  if (chain) chainFor(ctx, a);

  if (pet) {
    a.proxy = proxy(ctx, a);
    if (mode === 'sleep') ctx.colliders.obb(x, z, 0.3 * a.s, 0.55 * a.s, yaw, { top: a.y + 0.45 * a.s, tag: 'dog' });
    ctx.interact({
      x: 0, y: 0.35 * a.s, z: 0, w: 0.9 * a.s, h: 0.8 * a.s, d: 1.3 * a.s, parent: a.proxy,
      label: 'Pet the dog',
      action: (game) => {
        a.happy = 4;
        if (a.state === 'lie') game.audio.play('thump', { pos: { x: a.x, y: 0.2, z: a.z } });
        game.audio.play('whine', { pos: { x: a.x, y: 0.4, z: a.z } });
        const lines = ['Good dog. Its tail beats the ground.', 'Хорошая собака! It leans into your hand.', 'It sighs and shuts its eyes, happy.', 'Жақсы ит! It licks your fingers: salty, from the семечки.'];
        game.hud.flash(lines[Math.floor(a.rng.next() * lines.length)], 2400);
      },
    });
  }
  return a;
}
