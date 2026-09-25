import * as THREE from 'three';
import { Batch } from '../core/batch.js';
import { CROSSING, TRACK_NORTH, TRACK_SOUTH } from './layout.js';
import { wedge } from './platform.js';
import { LAMP } from './lamps.js';

/* ------------------------------------------------------------------ *
 * The level crossing on пр. Санкибай батыра.
 *
 * Static (district build): the rubber deck level with the pavements,
 * the carriageway humps, the keeper's booth, the barrier cabinets and
 * the light masts with their St Andrew's crosses.
 *
 * Moving (rail system): two half barriers, red and white, one for each
 * approach on the right of the road; two red lights per approach that
 * flash in turn and a white "moon" lamp that blinks slowly while the way
 * is open; the bell; a stop line for road traffic in each direction.
 * ------------------------------------------------------------------ */

const X = CROSSING.x;
const HW = CROSSING.hw;
const ARM = HW + 1.2;          // arm length from the pivot
const PIVOT_Y = 1.05;
const UP = 1.45;               // raised, radians from horizontal
const LOWER_SPEED = UP / 5;
const RAISE_SPEED = UP / 4;
const FLASH_HZ = 1.1;

/**
 * The two approaches. `side` is where the barrier post and the lights
 * stand; `face` the yaw the lights look toward (the oncoming traffic).
 */
export const APPROACHES = [
  // southbound traffic comes down from the north and stops at zNorth
  { id: 'north', post: { x: X - HW - 0.7, z: CROSSING.zNorth }, reach: 1, mast: { x: X - HW - 0.7, z: CROSSING.zNorth - 1.3 }, face: 0, dir: 1 },
  // northbound traffic comes up from the south and stops at zSouth
  { id: 'south', post: { x: X + HW + 0.7, z: CROSSING.zSouth }, reach: -1, mast: { x: X + HW + 0.7, z: CROSSING.zSouth + 1.3 }, face: Math.PI, dir: -1 },
];

/* ---------------- static ---------------- */

function deck(ctx) {
  const b = ctx.batch;
  const x0 = X - CROSSING.outer, x1 = X + CROSSING.outer;
  const z0 = CROSSING.deckZ0, z1 = CROSSING.deckZ1, y = CROSSING.deckY;
  b.span(x0, 0, z0, x1, y - 0.005, z1, 0x2f2e2c);
  // panel joints across the deck and the steel edge angles
  for (let z = z0 + 1.2; z < z1; z += 1.2) b.span(x0, y - 0.005, z - 0.03, x1, y + 0.001, z + 0.03, 0x1f1e1d, { cast: false });
  for (const z of [z0, z1]) b.span(x0, y - 0.02, z - 0.06, x1, y + 0.004, z + 0.06, 0x7d7a73, { cast: false });
  for (const t of [TRACK_NORTH, TRACK_SOUTH]) {
    b.span(x0, y - 0.005, t - 1.25, x1, y + 0.002, t + 1.25, 0x3a3835, { cast: false });
  }
  const r = CROSSING.ramp;
  wedge(b, X - HW, z0 - r, X + HW, z0, y, 'z', true, 0x55534f);
  wedge(b, X - HW, z1, X + HW, z1 + r, y, 'z', false, 0x55534f);
  ctx.ground.flat(x0, z0, x1, z1, y, 'crossing');
  ctx.ground.ramp(X - HW, z0 - r, X + HW, z0, 0, y, 'z', 'crossing');
  ctx.ground.ramp(X - HW, z1, X + HW, z1 + r, y, 0, 'z', 'crossing');
}

function booth(ctx) {
  const b = ctx.batch;
  const x = X + CROSSING.outer + 3.6, z = CROSSING.zNorth + 1.2;
  const w = 3.2, d = 3.2, h = 2.8;
  b.box(w + 0.2, 0.35, d + 0.2, 0x9d998f, x, -0.04, z);
  b.box(w, h, d, 0xeeebe2, x, 0.3, z);
  b.box(w + 0.02, 0.25, d + 0.02, 0x3f6d9a, x, 0.3, z);
  // windows on three sides so the keeper sees both ways and the road
  for (const [dx, dz, ry] of [[0, d / 2, 0], [-w / 2, 0, Math.PI / 2], [0, -d / 2, 0]]) {
    b.box(ry ? 0.06 : 2.2, 1.1, ry ? 2.2 : 0.06, 0x36464f, x + dx * 1.01, 1.4, z + dz * 1.01, { mat: 'glass' });
    b.box(ry ? 0.08 : 2.3, 0.08, ry ? 2.3 : 0.08, 0x3f6d9a, x + dx * 1.02, 2.5, z + dz * 1.02);
  }
  b.box(0.06, 2.0, 0.9, 0x3f6d9a, x + w / 2 + 0.01, 0.3, z + 0.6);
  b.box(w + 0.8, 0.18, d + 0.8, 0x6f716f, x, h + 0.3, z, { closed: true });
  b.cyl(0.08, 1.2, 0x4a4d50, x + 0.9, h + 0.45, z - 0.9, { seg: 6 });
  ctx.colliders.box(x - w / 2, z - d / 2, x + w / 2, z + d / 2, { top: h + 0.5, tag: 'booth' });
}

function crossSign(b, x, y, z, face) {
  // St Andrew's cross, doubled for two tracks: white boards with red borders
  const ry = face;
  const dz = -Math.cos(face) * 0.04;
  for (const [yy, s] of [[y, 1], [y - 0.5, 0.7]]) {
    for (const rz of [0.72, -0.72]) {
      b.box(1.3 * s, 0.2, 0.03, 0xc0302a, x, yy, z + dz, { ry, rz });
      b.box(1.2 * s, 0.12, 0.04, 0xf4f2ea, x, yy + 0.04, z + dz, { ry, rz });
    }
  }
}

function masts(ctx) {
  const b = ctx.batch;
  for (const a of APPROACHES) {
    const { x, z } = a.mast;
    b.cyl(0.08, 4.4, 0xe9e7e0, x, 0.15, z, { seg: 6 });
    for (let y = 0.6; y < 4.2; y += 0.5) b.cyl(0.085, 0.25, 0x1f1f1f, x, y + 0.15, z, { seg: 6 });
    const fx = -Math.sin(a.face), fz = -Math.cos(a.face);   // toward the oncoming traffic
    b.box(1.1, 1.0, 0.06, 0x151515, x + fx * 0.04, 1.55, z + fz * 0.04, { ry: a.face });
    for (const l of lampSpots(a)) {
      // hood: open tube from the backboard forward past the lens
      b.cyl(0.17, 0.18, 0x151515, l.x - fx * 0.06, l.y, l.z - fz * 0.06, { rx: -Math.PI / 2, ry: a.face, seg: 10, open: true });
    }
    crossSign(b, x, 4.0, z + fz * 0.08, a.face);
    ctx.colliders.circle(x, z, 0.2, { top: 4.5 });
    // barrier cabinet with the drive
    b.box(0.55, 1.0, 0.5, 0x9a9e9a, a.post.x, 0.15, a.post.z);
    b.box(0.3, 0.3, 0.3, 0x4a4d50, a.post.x, 1.0 + 0.15 - 0.2, a.post.z);
    ctx.colliders.box(a.post.x - 0.3, a.post.z - 0.3, a.post.x + 0.3, a.post.z + 0.3, { top: 1.3 });
  }
}

/** Where the three lenses of an approach sit: red, red, then the white one below. */
function lampSpots(a) {
  const { x, z } = a.mast;
  const fx = -Math.sin(a.face), fz = -Math.cos(a.face);
  const rx = Math.cos(a.face), rz = -Math.sin(a.face);        // across the mast
  const off = 0.14;
  return [
    { x: x + rx * 0.3 + fx * off, y: 2.3, z: z + rz * 0.3 + fz * off },
    { x: x - rx * 0.3 + fx * off, y: 2.3, z: z - rz * 0.3 + fz * off },
    { x: x + fx * off, y: 1.8, z: z + fz * off },
  ];
}

export function buildCrossing(ctx) {
  deck(ctx);
  booth(ctx);
  masts(ctx);
}

/* ---------------- moving ---------------- */

function armGeometry() {
  const b = new Batch({ cell: Infinity });
  const stripes = Math.round(ARM / 0.5);
  for (let i = 0; i < stripes; i++) {
    const x0 = 0.2 + (i * (ARM - 0.2)) / stripes;
    const w = (ARM - 0.2) / stripes;
    b.box(w, 0.12, 0.09, i % 2 ? 0xf4f2ea : 0xc8302a, x0 + w / 2, -0.06, 0);
  }
  // counterweight and the hub
  b.box(0.7, 0.28, 0.16, 0x4a4d50, -0.35, -0.14, 0);
  b.cyl(0.1, 0.2, 0x2a2a2a, 0, 0, -0.1, { rx: Math.PI / 2, seg: 8 });
  // three red lamps along the top, lit when down
  for (const f of [0.35, 0.65, 0.95]) b.box(0.1, 0.08, 0.1, 0xd83a28, ARM * f, 0.06, 0);
  const g = new THREE.Group();
  const [mesh] = b.flush(g);
  return mesh;
}

/**
 * Crossing controller. `update(dt, want)` with `want` true while a train
 * is due or on the crossing.
 */
export function createCrossing(game, parent, lamps) {
  const template = armGeometry();
  const arms = new THREE.InstancedMesh(template.geometry, template.material, APPROACHES.length);
  arms.name = 'crossing-arms';
  arms.castShadow = true;
  arms.frustumCulled = false;
  parent.add(arms);

  const net = game.traffic?.net;
  const units = APPROACHES.map((a) => {
    const lenses = lampSpots(a).map((l) => lamps.add(l.x, l.y, l.z, a.face, 0.12));
    const collider = { kind: 'obb', cx: 1e7, cz: 1e7, hx: ARM / 2, hz: 0.12, cos: 1, sin: 0, top: 1.3, bottom: 0.6 };
    game.world.dynamic.push(collider);
    const stopZ = a.dir > 0 ? a.post.z - CROSSING.stopGap : a.post.z + CROSSING.stopGap;
    const blockers = (net?.lanes || [])
      .filter((l) => l.road?.id === 'east' && l.dir === a.dir && l.index === 0
        && stopZ >= Math.min(l.a0, l.a1) && stopZ <= Math.max(l.a0, l.a1))
      .map((l) => game.traffic.addBlocker(l, Math.abs(stopZ - l.a0)));
    return { ...a, lenses, collider, blockers, angle: UP };
  });

  const bell = game.audio.loop('bell', { pos: { x: X, y: 3, z: (CROSSING.zNorth + CROSSING.zSouth) / 2 }, volume: 0 });
  const _m = new THREE.Matrix4();
  const _r = new THREE.Matrix4();
  let phase = 'open';
  let t = 0;
  let clock = 0;

  function place() {
    units.forEach((u, i) => {
      _m.makeTranslation(u.post.x, PIVOT_Y + 0.15, u.post.z);
      if (u.reach < 0) _m.multiply(_r.makeRotationY(Math.PI));
      _m.multiply(_r.makeRotationZ(u.angle));
      arms.setMatrixAt(i, _m);
      const down = u.angle < 0.35;
      u.collider.cx = down ? u.post.x + u.reach * ARM / 2 : 1e7;
      u.collider.cz = down ? u.post.z : 1e7;
    });
    arms.instanceMatrix.needsUpdate = true;
  }
  place();

  return {
    get phase() { return phase; },
    get closed() { return phase !== 'open'; },
    update(dt, want) {
      clock += dt;
      t += dt;
      if (want && phase === 'open') { phase = 'warning'; t = 0; }
      if (phase === 'warning' && t > CROSSING.lower) { phase = 'closed'; t = 0; }
      if (!want && (phase === 'warning' || phase === 'closed')) { phase = 'opening'; t = 0; }
      const target = phase === 'closed' ? 0 : UP;
      let moving = false;
      for (const u of units) {
        const speed = target < u.angle ? LOWER_SPEED : RAISE_SPEED;
        const d = target - u.angle;
        if (Math.abs(d) > 1e-4) moving = true;
        u.angle += Math.sign(d) * Math.min(Math.abs(d), speed * dt);
      }
      if (phase === 'opening' && !moving) phase = 'open';
      if (moving) place();

      const lit = phase === 'warning' || phase === 'closed';
      const tick = Math.floor(clock * FLASH_HZ * 2) % 2;
      const moon = Math.floor(clock / 0.9) % 2 === 0;
      for (const u of units) {
        lamps.set(u.lenses[0], lit && tick === 0 ? LAMP.red : LAMP.redDim);
        lamps.set(u.lenses[1], lit && tick === 1 ? LAMP.red : LAMP.redDim);
        lamps.set(u.lenses[2], phase === 'open' && moon ? LAMP.white : LAMP.off);
        for (const b of u.blockers) b.active = phase !== 'open';
      }
      bell.set({ volume: lit ? 0.9 : 0 });
    },
  };
}
