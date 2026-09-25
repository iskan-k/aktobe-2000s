import * as THREE from 'three';
import { MAT } from '../../core/toon.js';
import { rngKit, damp, clamp, mulberry32 } from '../../core/util.js';
import { KERB_H } from '../plan.js';

/* ------------------------------------------------------------------ *
 * The town's animals.
 *
 *   dogs      strays asleep in the shade. Come close and one lifts its
 *             head and thumps its tail; E to pet it.
 *   pigeons   flocks on the pavements by the stops and kiosks. They
 *             walk, peck and bob, clatter up when you come too close (or
 *             when you press E), circle over the avenue and land again.
 *   sparrows  little brown birds hopping round the kiosks, gone in a
 *             flick when you step near.
 *
 * Pigeons and sparrows are instanced (three draw calls for every pigeon
 * in town, one for the sparrows); each dog is three small meshes.
 * ------------------------------------------------------------------ */

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3(1, 1, 1);
const _c = new THREE.Color();
const _w = new THREE.Matrix4();
const _r = new THREE.Matrix4();
const _r2 = new THREE.Matrix4();
const _mw = new THREE.Matrix4();
const _fold = new THREE.Matrix4().makeScale(0.78, 1, 0.8);

// runtime wobble (scares, landing spots) from a fixed stream, so replays match
const rand = mulberry32(4242);

/** Ellipsoid with its colour baked in, for merged animal bodies. */
function ell(rx, ry, rz, x, y, z, color, seg = 10) {
  const g = new THREE.SphereGeometry(1, seg, Math.max(6, seg - 2));
  g.scale(rx, ry, rz);
  g.translate(x, y, z);
  return paint(g, color);
}

function bx(w, h, d, x, y, z, color, rx = 0, ry = 0, rz = 0) {
  const g = new THREE.BoxGeometry(w, h, d);
  g.rotateX(rx); g.rotateY(ry); g.rotateZ(rz);
  g.translate(x, y, z);
  return paint(g, color);
}

function paint(g, color) {
  _c.set(color);
  const n = g.attributes.position.count;
  const a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { a[i * 3] = _c.r; a[i * 3 + 1] = _c.g; a[i * 3 + 2] = _c.b; }
  g.setAttribute('color', new THREE.BufferAttribute(a, 3));
  if (g.index) return g.toNonIndexed();
  return g;
}

function merge(parts) {
  const geos = parts.map((g) => (g.index ? g.toNonIndexed() : g));
  for (const g of geos) {
    if (g.attributes.uv) g.deleteAttribute('uv');
  }
  let count = 0;
  for (const g of geos) count += g.attributes.position.count;
  const pos = new Float32Array(count * 3), nor = new Float32Array(count * 3), col = new Float32Array(count * 3);
  let o = 0;
  for (const g of geos) {
    pos.set(g.attributes.position.array, o * 3);
    nor.set(g.attributes.normal.array, o * 3);
    col.set(g.attributes.color.array, o * 3);
    o += g.attributes.position.count;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  out.setAttribute('color', new THREE.BufferAttribute(col, 3));
  out.computeBoundingSphere();
  return out;
}

/* ------------------------------------------------------------------ *
 * Dogs
 * ------------------------------------------------------------------ */

const COATS = [
  { main: 0xb8743a, light: 0xe2b886, dark: 0x6a3e1e },  // ginger
  { main: 0x2c2826, light: 0xe8e2d6, dark: 0x1a1816 },  // black with a white chest
  { main: 0x8c8276, light: 0xc8bfae, dark: 0x5a5248 },  // grey
];

function dogParts(coat) {
  const body = merge([
    ell(0.19, 0.17, 0.4, 0, 0.18, 0.06, coat.main),
    ell(0.17, 0.19, 0.2, 0, 0.21, -0.24, coat.light),
    ell(0.08, 0.12, 0.17, -0.13, 0.13, 0.26, coat.main),
    ell(0.08, 0.12, 0.17, 0.13, 0.13, 0.26, coat.main),
    bx(0.07, 0.07, 0.32, -0.08, 0.035, -0.44, coat.light),
    bx(0.07, 0.07, 0.32, 0.08, 0.035, -0.44, coat.light),
    ell(0.05, 0.03, 0.06, -0.08, 0.03, -0.6, coat.light, 6),
    ell(0.05, 0.03, 0.06, 0.08, 0.03, -0.6, coat.light, 6),
  ]);
  const head = merge([
    ell(0.12, 0.11, 0.13, 0, 0.03, -0.08, coat.main),
    ell(0.065, 0.06, 0.1, 0, -0.01, -0.21, coat.light, 8),
    ell(0.025, 0.02, 0.02, 0, 0.02, -0.3, 0x111111, 6),
    bx(0.05, 0.1, 0.03, -0.075, 0.12, -0.04, coat.dark, 0, 0, 0.35),
    bx(0.05, 0.1, 0.03, 0.075, 0.12, -0.04, coat.dark, 0, 0, -0.35),
    bx(0.022, 0.012, 0.01, -0.05, 0.06, -0.18, 0x111111),
    bx(0.022, 0.012, 0.01, 0.05, 0.06, -0.18, 0x111111),
  ]);
  const tail = merge([
    (() => {
      const g = new THREE.CylinderGeometry(0.018, 0.035, 0.3, 6);
      g.rotateX(Math.PI / 2);
      g.translate(0, 0, 0.15);
      return paint(g, coat.main);
    })(),
  ]);
  return { body, head, tail };
}

/**
 * A stray asleep at (x, z), facing yaw. Returns the updater state; the
 * caller does not need it.
 */
export function addDog(ctx, x, z, yaw, coatIndex = 0, y = KERB_H) {
  const coat = COATS[coatIndex % COATS.length];
  const parts = dogParts(coat);
  const g = new THREE.Group();
  g.position.set(x, y, z);
  g.rotation.y = yaw;
  const body = new THREE.Mesh(parts.body, MAT.solid);
  const headPivot = new THREE.Group();
  headPivot.position.set(0, 0.3, -0.34);
  const head = new THREE.Mesh(parts.head, MAT.solid);
  headPivot.add(head);
  const tailPivot = new THREE.Group();
  tailPivot.position.set(0, 0.2, 0.44);
  const tail = new THREE.Mesh(parts.tail, MAT.solid);
  tailPivot.add(tail);
  g.add(body, headPivot, tailPivot);
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  ctx.root.add(g);
  ctx.colliders.obb(x, z, 0.3, 0.55, yaw, { top: y + 0.4, tag: 'dog' });

  const st = { t: coatIndex * 3.7, awake: 0, happy: 0, lastWoof: -10 };
  ctx.interact({
    x, y: y + 0.35, z, w: 0.9, h: 0.7, d: 1.3, ry: yaw,
    label: 'Pet the dog',
    action: (game) => {
      st.happy = 3.5;
      game.audio.play('whine', { pos: { x, y: 0.4, z } });
      const lines = ['Good dog. It thumps its tail on the pavement.', 'Хорошая собака! It leans into your hand.', 'It sighs and goes back to sleep, happy.'];
      game.hud.flash(lines[Math.floor(rand() * lines.length)], 2400);
    },
  });

  ctx.update((dt, game) => {
    st.t += dt;
    const p = game.controller ? game.camera.position : game.player.pos;
    const d = Math.hypot(p.x - x, p.z - z);
    if (d > 40) return;
    const near = d < 5.5;
    st.awake = damp(st.awake, near || st.happy > 0 ? 1 : 0, near ? 2.5 : 0.6, dt);
    st.happy = Math.max(0, st.happy - dt);
    // breathing
    body.scale.y = 1 + Math.sin(st.t * (1.6 + st.awake)) * 0.025;
    // resting chin on paws, head up when awake, looking toward you
    const look = Math.atan2(-(p.x - x), -(p.z - z)) - yaw;
    headPivot.rotation.x = -0.42 + st.awake * 0.5;
    headPivot.rotation.y = clamp(Math.atan2(Math.sin(look), Math.cos(look)), -0.8, 0.8) * st.awake;
    headPivot.position.y = 0.26 + st.awake * 0.06;
    const wag = st.happy > 0 ? 1.0 : st.awake * 0.55;
    const rate = st.happy > 0 ? 11 : 6;
    tailPivot.rotation.y = Math.sin(st.t * rate) * wag;
    tailPivot.rotation.x = 0.55 * (1 - st.awake) - 0.3 * st.awake;
    // a sleepy woof now and then if you walk right up
    if (d < 2.2 && st.t - st.lastWoof > 12 && st.happy <= 0) {
      st.lastWoof = st.t;
      game.audio.play('woof', { pos: { x, y: 0.4, z }, rate: 1 + coatIndex * 0.1 });
    }
  });
  return st;
}

/* ------------------------------------------------------------------ *
 * Pigeons
 * ------------------------------------------------------------------ */

function pigeonGeos() {
  const grey = 0x8f949c, dark = 0x5c616b, neck = 0x557a78;
  const body = merge([
    ell(0.065, 0.065, 0.13, 0, 0.13, 0, grey, 8),
    ell(0.05, 0.05, 0.05, 0, 0.19, -0.075, neck, 7),
    ell(0.04, 0.04, 0.045, 0, 0.225, -0.1, dark, 7),
    bx(0.012, 0.01, 0.025, 0, 0.22, -0.145, 0x2a2622),
    bx(0.05, 0.012, 0.11, 0, 0.14, 0.15, dark, -0.15),
    bx(0.01, 0.07, 0.01, -0.025, 0.035, 0.01, 0xb0443a),
    bx(0.01, 0.07, 0.01, 0.025, 0.035, 0.01, 0xb0443a),
  ]);
  // a wing, pivoting at the shoulder, reaching out along +x
  // light grey with the two dark bars and a dark tip
  const wing = merge([
    bx(0.17, 0.012, 0.1, 0.085, 0, 0.01, 0x868b94),
    bx(0.022, 0.014, 0.1, 0.05, 0, 0.01, 0x3e424a),
    bx(0.022, 0.014, 0.1, 0.1, 0, 0.01, 0x3e424a),
    bx(0.08, 0.01, 0.06, 0.2, 0, 0.03, 0x3e424a),
  ]);
  const wingL = wing.clone();
  wingL.scale(-1, 1, 1);
  // mirrored: flip winding so faces still point out
  const idx = [];
  for (let i = 0; i < wingL.attributes.position.count; i += 3) idx.push(i, i + 2, i + 1);
  wingL.setIndex(idx);
  wingL.computeVertexNormals();
  return { body, wingR: wing, wingL };
}

const MAX_PIGEONS = 96;
const SCARE_WALK = 1.9;   // metres from the nearest pigeon
const SCARE_RUN = 4.5;
const MAX_SPARROWS = 36;

// one bird system per world build
const SYSTEMS = new WeakMap();

function pigeonSystem(ctx) {
  if (SYSTEMS.has(ctx)) return SYSTEMS.get(ctx);
  const geos = pigeonGeos();
  const mk = (g) => {
    const m = new THREE.InstancedMesh(g, MAT.solid, MAX_PIGEONS);
    m.count = 0;
    m.castShadow = true;
    m.frustumCulled = false;
    m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    ctx.root.add(m);
    return m;
  };
  const sys = { body: mk(geos.body), wingL: mk(geos.wingL), wingR: mk(geos.wingR), birds: [], flocks: [] };
  const sparrowGeo = merge([
    ell(0.04, 0.038, 0.065, 0, 0.06, 0, 0x8a6a48, 7),
    ell(0.03, 0.03, 0.03, 0, 0.1, -0.05, 0x6a4a30, 6),
    ell(0.022, 0.015, 0.02, 0, 0.09, -0.07, 0x3a302a, 5),
    bx(0.03, 0.008, 0.05, 0, 0.065, 0.07, 0x5a4230, -0.3),
  ]);
  sys.sparrowMesh = new THREE.InstancedMesh(sparrowGeo, MAT.solid, MAX_SPARROWS);
  sys.sparrowMesh.count = 0;
  sys.sparrowMesh.frustumCulled = false;
  sys.sparrowMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  ctx.root.add(sys.sparrowMesh);
  sys.sparrows = [];
  sys.sparrowGroups = [];

  ctx.update((dt, game) => stepBirds(sys, dt, game));
  SYSTEMS.set(ctx, sys);
  return sys;
}

/**
 * A flock of `count` pigeons around (x, z) on the pavement, within
 * radius r (in the local frame of the pavement run `alongX`: true if the
 * pavement runs east-west, so they spread along it).
 */
export function addPigeonFlock(ctx, x, z, count, { rx = 3, rz = 1.2, y = KERB_H, seed = 1 } = {}) {
  const sys = pigeonSystem(ctx);
  const rng = rngKit(seed);
  const flock = { x, z, y, rx, rz, state: 'ground', t: 0, birds: [], coo: rng.range(3, 9), dir: rng.sign() };
  // instance colour multiplies the grey: plain, darker, paler, a brown one
  const tints = [[1, 1, 1], [0.92, 0.93, 0.96], [0.78, 0.8, 0.84], [1.12, 1.12, 1.14]];
  for (let i = 0; i < count && sys.birds.length < MAX_PIGEONS; i++) {
    const b = {
      i: sys.birds.length, flock,
      x: x + rng.range(-rx, rx), y, z: z + rng.range(-rz, rz),
      yaw: rng.range(0, Math.PI * 2), pitch: 0, flap: 0,
      vx: 0, vy: 0, vz: 0,
      state: 'ground', t: rng.range(0, 2), tx: 0, tz: 0, delay: 0,
      speed: rng.range(0.25, 0.4), phase: rng.range(0, 10),
    };
    b.tx = b.x; b.tz = b.z;
    const t = rng.chance(0.07) ? [1.5, 1.45, 1.4] : rng.chance(0.1) ? [1.3, 1.0, 0.78] : rng.pick(tints);
    _c.setRGB(t[0], t[1], t[2]);
    sys.body.setColorAt(b.i, _c);
    sys.wingL.setColorAt(b.i, _c);
    sys.wingR.setColorAt(b.i, _c);
    sys.birds.push(b);
    flock.birds.push(b);
  }
  sys.body.count = sys.wingL.count = sys.wingR.count = sys.birds.length;
  for (const m of [sys.body, sys.wingL, sys.wingR]) if (m.instanceColor) m.instanceColor.needsUpdate = true;
  sys.flocks.push(flock);
  ctx.interact({
    x, y: y + 0.3, z, w: rx * 2 + 1, h: 0.6, d: rz * 2 + 1,
    label: 'Shoo the pigeons',
    enabled: () => flock.state === 'ground',
    action: (game) => scare(flock, game.player.pos.x, game.player.pos.z, game),
  });
  return flock;
}

/** Sparrows hopping around a kiosk. */
export function addSparrows(ctx, x, z, count, { r = 1.6, y = KERB_H, seed = 2 } = {}) {
  const sys = pigeonSystem(ctx);
  const rng = rngKit(seed * 7 + 3);
  const group = { x, z, y, r, gone: 0, chirp: rng.range(2, 6), birds: [] };
  for (let i = 0; i < count && sys.sparrows.length < MAX_SPARROWS; i++) {
    const s = { i: sys.sparrows.length, g: group, x: x + rng.range(-r, r), z: z + rng.range(-r, r), yaw: rng.range(0, 6.3), hop: 0, t: rng.range(0, 1.5), fly: 0, vy: 0, h: 0 };
    sys.sparrows.push(s);
    group.birds.push(s);
  }
  sys.sparrowMesh.count = sys.sparrows.length;
  sys.sparrowGroups.push(group);
  return group;
}

function scare(flock, px, pz, game) {
  if (flock.state !== 'ground') return;
  flock.state = 'fly';
  flock.t = 0;
  flock.dur = 9 + rand() * 8;
  flock.dir = rand() < 0.5 ? -1 : 1;
  flock.R = 10 + rand() * 6;
  flock.alt = 8 + rand() * 5;
  flock.a0 = Math.atan2(flock.z - pz, flock.x - px);
  for (const b of flock.birds) {
    b.state = 'takeoff';
    b.delay = rand() * 0.45;
    const dx = b.x - px, dz = b.z - pz;
    const d = Math.hypot(dx, dz) || 1;
    b.vx = (dx / d) * (2 + rand());
    b.vz = (dz / d) * (2 + rand());
    b.vy = 2.6 + rand();
  }
  game.audio.play('wings', { pos: { x: flock.x, y: 1, z: flock.z }, count: flock.birds.length });
}

function stepBirds(sys, dt, game) {
  const cam = game.camera.position;
  const walker = game.controller ? null : game.player;
  const car = game.car?.active ? game.car : null;

  for (const f of sys.flocks) {
    f.t += dt;
    const dcam = Math.hypot(cam.x - f.x, cam.z - f.z);
    if (f.state === 'ground') {
      // they let a walker come to a couple of metres of the nearest bird,
      // a runner not nearly so close; someone standing still they ignore
      if (walker && walker.moving > 0.3 && dcam < 30) {
        const reach = walker.moving > 3.2 ? SCARE_RUN : SCARE_WALK;
        const px = walker.pos.x, pz = walker.pos.z;
        if (f.birds.some((b) => Math.hypot(b.x - px, b.z - pz) < reach)) scare(f, px, pz, game);
      }
      if (car && Math.abs(car.speed) > 3 && Math.hypot(car.pos.x - f.x, car.pos.z - f.z) < 9) scare(f, car.pos.x, car.pos.z, game);
      f.coo -= dt;
      if (f.coo <= 0) {
        f.coo = 5 + rand() * 9;
        if (dcam < 18) game.audio.play('coo', { pos: { x: f.x, y: 0.3, z: f.z }, rate: 0.9 + rand() * 0.2 });
      }
    } else if (f.state === 'fly' && f.t > f.dur) {
      f.state = 'land';
      for (const b of f.birds) {
        b.state = 'land';
        b.tx = f.x + (rand() * 2 - 1) * f.rx;
        b.tz = f.z + (rand() * 2 - 1) * f.rz;
      }
    } else if (f.state === 'land' && f.birds.every((b) => b.state === 'ground')) {
      f.state = 'ground';
      f.t = 0;
    }
  }

  for (const b of sys.birds) {
    const f = b.flock;
    b.t -= dt;
    if (b.state === 'ground') {
      if (b.t <= 0) {
        const r = rand();
        if (r < 0.45) {
          b.mode = 'walk';
          b.tx = clamp(b.x + (rand() * 2 - 1) * 1.2, f.x - f.rx, f.x + f.rx);
          b.tz = clamp(b.z + (rand() * 2 - 1) * 0.8, f.z - f.rz, f.z + f.rz);
          b.t = 1.5 + rand() * 2;
        } else if (r < 0.8) {
          b.mode = 'peck';
          b.t = 0.8 + rand() * 1.6;
        } else {
          b.mode = 'idle';
          b.t = 0.6 + rand() * 2;
        }
      }
      b.flap = damp(b.flap, 0, 12, dt);
      b.y = damp(b.y, f.y, 10, dt);
      if (b.mode === 'walk') {
        const dx = b.tx - b.x, dz = b.tz - b.z;
        const d = Math.hypot(dx, dz);
        if (d > 0.05) {
          b.x += (dx / d) * b.speed * dt;
          b.z += (dz / d) * b.speed * dt;
          const want = Math.atan2(-dx, -dz);
          b.yaw += Math.atan2(Math.sin(want - b.yaw), Math.cos(want - b.yaw)) * Math.min(1, dt * 8);
        }
        // the head-bob walk
        b.pitch = Math.sin((b.t + b.phase) * 14) * 0.12;
      } else if (b.mode === 'peck') {
        b.pitch = -Math.max(0, Math.sin((b.t + b.phase) * 9)) * 0.6;
      } else {
        b.pitch = damp(b.pitch, 0, 6, dt);
      }
    } else if (b.state === 'takeoff') {
      b.delay -= dt;
      if (b.delay > 0) continue;
      b.x += b.vx * dt; b.y += b.vy * dt; b.z += b.vz * dt;
      b.vy = damp(b.vy, 1.2, 1.5, dt);
      b.flap += dt * 22;
      b.yaw = Math.atan2(-b.vx, -b.vz);
      b.pitch = 0.4;
      if (b.y > f.y + 3) b.state = 'circle';
    } else if (b.state === 'circle') {
      // wheel round the flock's home in a loose ring
      const a = f.a0 + f.dir * (f.t * 0.55) + (b.i % 7) * 0.09;
      const R = f.R + (b.i % 5) * 0.6;
      const tx = f.x + Math.cos(a) * R, tz = f.z + Math.sin(a) * R, ty = f.alt + Math.sin(b.phase + f.t) * 0.8;
      const sp = 6;
      const dx = tx - b.x, dy = ty - b.y, dz = tz - b.z;
      const d = Math.hypot(dx, dy, dz) || 1;
      b.vx = damp(b.vx, (dx / d) * sp, 2.2, dt);
      b.vy = damp(b.vy, (dy / d) * sp * 0.6, 2.2, dt);
      b.vz = damp(b.vz, (dz / d) * sp, 2.2, dt);
      b.x += b.vx * dt; b.y += b.vy * dt; b.z += b.vz * dt;
      b.yaw = Math.atan2(-b.vx, -b.vz);
      b.pitch = b.vy * 0.05;
      // flap in bursts, glide in between
      b.flap += dt * (Math.sin(f.t * 1.3 + b.phase) > 0 ? 20 : 0);
    } else if (b.state === 'land') {
      const dx = b.tx - b.x, dz = b.tz - b.z, dy = f.y - b.y;
      const dh = Math.hypot(dx, dz);
      const sp = Math.max(1.2, Math.min(5, dh * 0.8));
      b.vx = damp(b.vx, (dx / (dh || 1)) * sp, 3, dt);
      b.vz = damp(b.vz, (dz / (dh || 1)) * sp, 3, dt);
      b.vy = damp(b.vy, dh > 3 ? dy * 0.25 : dy * 1.5, 3, dt);
      b.x += b.vx * dt; b.y += b.vy * dt; b.z += b.vz * dt;
      if (dh > 0.3) b.yaw = Math.atan2(-b.vx, -b.vz);
      b.flap += dt * (dh < 3 ? 26 : 10);
      b.pitch = dh < 2 ? 0.3 : -0.1;
      if (dh < 0.25 && Math.abs(dy) < 0.12) {
        b.state = 'ground';
        b.y = f.y;
        b.mode = 'idle';
        b.t = 0.5 + rand();
      }
    }
  }

  // write the instances
  const onGround = (b) => b.state === 'ground' || (b.state === 'takeoff' && b.delay > 0);
  for (const b of sys.birds) {
    _p.set(b.x, b.y, b.z);
    _e.set(b.pitch, b.yaw, 0, 'YXZ');
    _q.setFromEuler(_e);
    _m.compose(_p, _q, _s);
    sys.body.setMatrixAt(b.i, _m);
    const folded = onGround(b);
    const ang = Math.sin(b.flap) * 0.9 + 0.1;
    for (let k = 0; k < 2; k++) {
      const sgn = k === 0 ? 1 : -1;
      _w.makeTranslation(sgn * (folded ? 0.028 : 0.035), folded ? 0.17 : 0.155, -0.03);
      // folded wings hug the flanks, pointing back, tucked a little smaller
      _r.makeRotationZ(sgn * (folded ? -0.62 : ang));
      if (folded) _r.multiply(_r2.makeRotationY(sgn * -1.42)).multiply(_fold);
      _mw.copy(_m).multiply(_w).multiply(_r);
      (k === 0 ? sys.wingR : sys.wingL).setMatrixAt(b.i, _mw);
    }
  }
  for (const m of [sys.body, sys.wingL, sys.wingR]) m.instanceMatrix.needsUpdate = true;

  // sparrows: hop, peck, vanish when you come near, come back later
  for (const g of sys.sparrowGroups) {
    const p = walker ? walker.pos : cam;
    const d = Math.hypot(p.x - g.x, p.z - g.z);
    if (g.gone <= 0 && d < 3.2) {
      g.gone = 7 + rand() * 6;
      for (const s of g.birds) { s.fly = 1; s.vy = 3 + rand() * 2; s.vx = (rand() - 0.5) * 6; s.vz = (rand() - 0.5) * 6; }
    }
    if (g.gone > 0) {
      g.gone -= dt;
      if (g.gone <= 0) for (const s of g.birds) { s.fly = 0; s.h = 0; s.x = g.x + (rand() * 2 - 1) * g.r; s.z = g.z + (rand() * 2 - 1) * g.r; }
    }
    g.chirp -= dt;
    if (g.chirp <= 0 && g.gone <= 0) {
      g.chirp = 1.5 + rand() * 4;
      if (d < 20) game.audio.play('chirp', { pos: { x: g.x, y: 0.3, z: g.z } });
    }
  }
  for (const s of sys.sparrows) {
    const g = s.g;
    if (s.fly) {
      s.x += s.vx * dt; s.z += s.vz * dt; s.h += s.vy * dt; s.vy += 1.5 * dt;
    } else {
      s.t -= dt;
      if (s.t <= 0) {
        s.t = 0.25 + rand() * 0.9;
        if (rand() < 0.6) {
          s.hop = 1;
          s.yaw += (rand() - 0.5) * 2;
        }
      }
      if (s.hop > 0) {
        s.hop -= dt * 5;
        const fx = -Math.sin(s.yaw), fz = -Math.cos(s.yaw);
        s.x = clamp(s.x + fx * dt * 0.7, g.x - g.r, g.x + g.r);
        s.z = clamp(s.z + fz * dt * 0.7, g.z - g.r, g.z + g.r);
        s.h = Math.sin(Math.max(0, s.hop) * Math.PI) * 0.06;
      } else s.h = 0;
    }
    const visible = !(s.fly && s.h > 25);
    _p.set(s.x, g.y + s.h, s.z);
    _e.set(s.hop > 0 ? -0.2 : 0.15 * Math.sin(s.t * 20), s.yaw, 0, 'YXZ');
    _q.setFromEuler(_e);
    _s.setScalar(visible ? 1 : 0);
    _m.compose(_p, _q, _s);
    sys.sparrowMesh.setMatrixAt(s.i, _m);
  }
  _s.setScalar(1);
  sys.sparrowMesh.instanceMatrix.needsUpdate = true;
}
