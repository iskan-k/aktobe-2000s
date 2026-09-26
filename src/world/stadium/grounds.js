import * as THREE from 'three';
import { cel } from '../../core/toon.js';
import { SURF, TILE, hQuad, splitRect } from '../../core/surfaces.js';
import { rngKit } from '../../core/util.js';
import { BOUNDS } from '../plan.js';
import { addTree } from '../props/trees.js';
import { addLamp, addBench } from '../props/street.js';
import { B, RAIL, GATES, LOBBY, FORECOURT, PARKING, TRAINING, FIELD, COL } from './layout.js';
import { railTex } from './textures.js';
import { netMaterial } from './pitch.js';
import { wallQuad } from './util.js';

/* ------------------------------------------------------------------ *
 * The grounds round the stadium: paving and asphalt, the railings with
 * their turnstile gates, the car park with the team bus, the training
 * pitch, lamps, benches, trees, and the wire fence at the south and east
 * ends of the map.
 * ------------------------------------------------------------------ */

const GATE_W = 8.4;      // opening in the railings for a turnstile gate
const LANE = 0.95;       // one turnstile lane
const RAIL_H = 2.1;

function lay(b, x0, z0, x1, z1, y, mat, tile) {
  for (const [a, c, d, e] of splitRect(x0, z0, x1, z1, 48)) {
    b.add(hQuad(a, c, d, e, y, tile), { mat, color: null, cast: false });
  }
}

/* ---------------- surfaces ---------------- */

function surfaces(b) {
  // the forecourt in concrete slabs, the concourse inside the railings in pavement
  lay(b, FORECOURT.x0, FORECOURT.z0, FORECOURT.x1, FORECOURT.z1, 0.0, SURF.slabs, TILE.slabs);
  lay(b, RAIL.x0, RAIL.z0, RAIL.x1, RAIL.z1, -0.015, SURF.walk, TILE.walk);
  // the car park and its entrance off ул. Айтеке би
  lay(b, B.x0, PARKING.z0, PARKING.x1, PARKING.z1 + 3, -0.012, SURF.asphalt, TILE.asphalt);
  // paths: down the east side to the training pitch, and along the south
  lay(b, RAIL.x1, PARKING.z1 + 3, RAIL.x1 + 4, RAIL.z1 + 4, -0.014, SURF.walk, TILE.walk);
  lay(b, FORECOURT.x0, RAIL.z1, RAIL.x1 + 4, RAIL.z1 + 4, -0.013, SURF.walk, TILE.walk);
  lay(b, FORECOURT.x0, FORECOURT.z0 - 3, RAIL.x0, FORECOURT.z0, -0.011, SURF.walk, TILE.walk);
  // bay lines in the car park
  for (let x = PARKING.x0; x <= PARKING.x1; x += 2.7) {
    for (const [z0, z1] of [[PARKING.z0 + 0.5, PARKING.z0 + 5.5], [PARKING.z1 - 5.5, PARKING.z1 - 0.5]]) {
      b.box(0.1, 0.012, z1 - z0, 0xe8e4d8, x, -0.011, (z0 + z1) / 2, { cast: false });
    }
  }
}

/* ---------------- railings and gates ---------------- */

let railMat = null;
function railRun(ctx, a, c) {
  if (!railMat) railMat = cel({ map: railTex(), alphaTest: 0.5, side: THREE.DoubleSide, cache: false, grime: 0.03, dirt: 0.2 });
  const L = Math.hypot(c.x - a.x, c.z - a.z);
  if (L < 0.2) return;
  ctx.batch.add(wallQuad(a, c, 0, RAIL_H, [0, 0, L / 3, 1]), { mat: railMat, color: null, cast: false });
  const n = Math.ceil(L / 3);
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    ctx.batch.box(0.12, RAIL_H + 0.15, 0.12, COL.paintGreen, a.x + (c.x - a.x) * t, 0, a.z + (c.z - a.z) * t, { cast: false });
  }
  ctx.colliders.box(Math.min(a.x, c.x) - 0.06, Math.min(a.z, c.z) - 0.06, Math.max(a.x, c.x) + 0.06, Math.max(a.z, c.z) + 0.06, { tag: 'railing' });
}

/** Turnstiles across a gate in the railings running along z at x, centred on z. */
function turnstiles(ctx, x, z, facing) {
  const { batch: b, colliders } = ctx;
  const n = Math.floor(GATE_W / (LANE + 0.35));
  const span = n * (LANE + 0.35) + 0.35;
  let zz = z - span / 2;
  for (let i = 0; i <= n; i++) {
    // a steel cabinet between lanes with its three-armed rotor
    b.box(0.9, 1.0, 0.32, 0xa8acae, x, 0, zz + 0.16, { ry: 0 });
    b.box(0.92, 0.06, 0.34, 0x6a6e70, x, 1.0, zz + 0.16, { cast: false });
    colliders.box(x - 0.45, zz, x + 0.45, zz + 0.32, { tag: 'turnstile' });
    if (i < n) {
      const hub = zz + 0.32;
      b.cyl(0.06, 0.12, 0x5e6266, x, 0.85, hub + 0.03, { rx: Math.PI / 2, seg: 8, cast: false });
      for (let k = 0; k < 3; k++) {
        const ang = facing + (k * Math.PI * 2) / 3;
        b.tube(x, 0.9, hub + 0.06, x + Math.cos(ang) * 0.05, 0.9 + Math.sin(ang) * 0.42, hub + 0.06 + 0.45, 0.018, 0xc8ccce, { seg: 4, cast: false });
      }
    }
    zz += LANE + 0.35;
  }
  // a canopy over the gate
  b.box(2.6, 0.15, span + 0.6, COL.red, x, 2.9, z, { closed: true });
  for (const dz of [-span / 2 - 0.2, span / 2 + 0.2]) {
    for (const dx of [-1.1, 1.1]) {
      b.cyl(0.06, 2.9, COL.steelDark, x + dx, 0, z + dz, { seg: 6 });
      colliders.circle(x + dx, z + dz, 0.08, { tag: 'pole' });
    }
  }
  return span;
}

function railings(ctx) {
  const openings = { w: [], e: [] };
  for (const g of GATES) openings[g.side].push([g.z - GATE_W / 2 - 0.5, g.z + GATE_W / 2 + 0.5]);
  openings.w.push([LOBBY.z0 - 1, LOBBY.z1 + 1]);
  openings.w.sort((a, b) => a[0] - b[0]);
  openings.e.sort((a, b) => a[0] - b[0]);
  const along = (x, list) => {
    let z = RAIL.z0;
    for (const [o0, o1] of list) {
      railRun(ctx, { x, z }, { x, z: o0 });
      z = o1;
    }
    railRun(ctx, { x, z }, { x, z: RAIL.z1 });
  };
  along(RAIL.x0, openings.w);
  along(RAIL.x1, openings.e);
  railRun(ctx, { x: RAIL.x0, z: RAIL.z0 }, { x: RAIL.x1, z: RAIL.z0 });
  railRun(ctx, { x: RAIL.x0, z: RAIL.z1 }, { x: RAIL.x1, z: RAIL.z1 });
  for (const g of GATES) {
    const x = g.side === 'w' ? RAIL.x0 : RAIL.x1;
    const span = turnstiles(ctx, x, g.z, g.side === 'w' ? 0 : Math.PI);
    // railings close the gap either side of the turnstile block
    railRun(ctx, { x, z: g.z - GATE_W / 2 - 0.5 }, { x, z: g.z - span / 2 });
    railRun(ctx, { x, z: g.z + span / 2 }, { x, z: g.z + GATE_W / 2 + 0.5 });
  }
}

/* ---------------- the south and east fences ---------------- */

function edgeFence(b, colliders) {
  const post = (x, z) => b.box(0.14, 1.5, 0.14, 0xb4b0a6, x, 0, z, { rz: Math.sin(x * 1.7 + z) * 0.05, cast: false });
  const fz = BOUNDS.z1 - 0.4, fx = BOUNDS.x1 - 0.4;
  for (let x = B.x0 + 0.5; x <= fx; x += 3) post(x, fz);
  for (let z = B.z0 + 1; z <= fz; z += 3) post(fx, z);
  for (const y of [0.45, 0.9, 1.35]) {
    b.tube(B.x0 + 0.5, y, fz, fx, y, fz, 0.008, 0x5a5854, { seg: 3, cast: false });
    b.tube(fx, y, B.z0 + 1, fx, y, fz, 0.008, 0x5a5854, { seg: 3, cast: false });
  }
  colliders.box(B.x0, fz - 0.1, fx, fz + 0.1, { top: 1.5, tag: 'fence' });
  colliders.box(fx - 0.1, B.z0, fx + 0.1, fz, { top: 1.5, tag: 'fence' });
}

/* ---------------- the car park ---------------- */

function carPark(ctx) {
  const rng = rngKit(2007);
  for (let x = PARKING.x0 + 1.35; x < PARKING.x1 - 1; x += 2.7) {
    ctx.parking.push({ x, z: PARKING.z0 + 3, ry: 0, chance: rng.chance(0.5) ? 0.75 : 0.25 });
    ctx.parking.push({ x, z: PARKING.z1 - 3, ry: Math.PI, chance: 0.4 });
  }
  // at the players' entrance, north end of the main stand: the midibus
  // the team travels in, and the club's minibus
  ctx.parking.push({ x: 27.2, z: 226, ry: 0, kind: 'county' });
  ctx.parking.push({ x: 27.2, z: 213, ry: 0, kind: 'sprinter', color: COL.white });
}

/* ---------------- the training pitch ---------------- */

function trainingSurround(ctx) {
  const { batch: b, colliders } = ctx;
  const T = TRAINING;
  // a cinder surround, worn bare where the players warm up
  lay(b, T.x - T.w / 2 - 3, T.z - T.l / 2 - 3, T.x + T.w / 2 + 3, T.z + T.l / 2 + 3, -0.02, SURF.dirt, TILE.dirt);
  // tall ball-stop nets behind each goal on steel poles
  for (const end of [-1, 1]) {
    const z = T.z + end * (T.l / 2 + 1.5);
    const x0 = T.x - 16, x1 = T.x + 16, H = 5;
    const g = wallQuad({ x: x0, z }, { x: x1, z }, 0, H, [0, 0, (x1 - x0) / 0.15, H / 0.15]);
    b.add(g, { mat: netMaterial(), color: null, cast: false });
    for (let x = x0; x <= x1 + 0.01; x += 4) {
      b.cyl(0.05, H, COL.steelDark, x, 0, z, { seg: 6, cast: false });
      colliders.circle(x, z, 0.08, { tag: 'pole' });
    }
    b.tube(x0, H, z, x1, H, z, 0.03, COL.steelDark, { seg: 4, cast: false });
    colliders.box(x0, z - 0.05, x1, z + 0.05, { top: H, tag: 'net' });
  }
  // benches along the west side, and a shed for the kit
  for (let z = T.z - 24; z <= T.z + 24; z += 12) {
    addBench(b, T.x - T.w / 2 - 2.5, z, -Math.PI / 2, { style: 'park', color: COL.red });
    colliders.box(T.x - T.w / 2 - 2.9, z - 1, T.x - T.w / 2 - 2.1, z + 1, { top: 0.5, tag: 'bench' });
  }
  const sx = T.x + T.w / 2 - 3, sz = T.z - T.l / 2 - 8;
  b.box(6, 2.6, 3.2, 0xdcd6c8, sx, 0, sz);
  b.box(6.4, 0.2, 3.6, COL.red, sx, 2.6, sz, { closed: true });
  b.box(1.1, 2.0, 0.06, 0x5a6a7a, sx - 1.2, 0, sz + 1.62);
  colliders.box(sx - 3, sz - 1.6, sx + 3, sz + 1.6, { top: 2.8, tag: 'shed' });
  // a stack of training cones and a bag of balls by the shed
  for (let i = 0; i < 6; i++) b.cyl(0.14, 0.28, 0xf07a1a, sx + 3.6, i * 0.04, sz + 1.5, { seg: 8, rTop: 0.03, cast: false });
  b.add(new THREE.SphereGeometry(0.45, 10, 8).scale(1, 0.8, 1).translate(sx + 4.3, 0.35, sz + 1.0), { color: 0x2a3a6a });
}

/* ---------------- lamps, benches, trees ---------------- */

function greenery(ctx) {
  const { batch: b, colliders } = ctx;
  const tree = (kind, x, z, seed, scale = 1) => {
    addTree(b, kind, x, z, seed, { scale });
    colliders.circle(x, z, kind === 'spruce' ? 0.5 : 0.28, { tag: 'tree' });
  };
  // blue spruces either side of the main entrance
  for (const dz of [-16, -10, 10, 16]) tree('spruce', 8, (LOBBY.z0 + LOBBY.z1) / 2 + dz, 5100 + dz, 0.85);
  // poplars along the south path and the back of the car park
  for (let x = B.x0 + 4; x < B.x1 - 4; x += 9) {
    if (x > TRAINING.x - TRAINING.w / 2 - 6 && x < TRAINING.x + TRAINING.w / 2 + 6) continue;
    tree('poplar', x, RAIL.z1 + 7, 5200 + x);
  }
  for (let x = TRAINING.x - 30; x < B.x1 - 3; x += 8.5) tree('poplar', x, TRAINING.z + TRAINING.l / 2 + 9, 5300 + x);
  // elms and birches on the grass south of the stadium, down to the fence
  const rng = rngKit(5400);
  for (let i = 0; i < 26; i++) {
    const x = rng.range(B.x0 + 6, B.x1 - 6), z = rng.range(RAIL.z1 + 12, BOUNDS.z1 - 5);
    tree(rng.pick(['elm', 'birch', 'birch', 'maple', 'young']), x, z, 5400 + i, rng.range(0.8, 1.1));
  }
  // trees between the car park and the town fence
  for (let x = PARKING.x0 + 6; x < PARKING.x1; x += 12) tree(rng.pick(['elm', 'maple']), x, B.z0 + 1.6, 5500 + x, 0.8);
  // east of the railings, along the path
  for (let z = RAIL.z0 + 6; z < RAIL.z1; z += 11) tree('birch', RAIL.x1 + 6.5, z, 5600 + z, 0.9);

  // lamps: round the forecourt, the car park and the paths
  for (let z = FORECOURT.z0 + 6; z < FORECOURT.z1; z += 22) {
    addLamp(b, B.x0 + 3.5, z, -Math.PI / 2, { height: 8 });
    colliders.circle(B.x0 + 3.5, z, 0.18, { tag: 'lamp' });
  }
  for (let x = PARKING.x0 + 10; x < PARKING.x1; x += 30) {
    addLamp(b, x, PARKING.z0 + 10, 0, { height: 9, double: true });
    colliders.circle(x, PARKING.z0 + 10, 0.18, { tag: 'lamp' });
  }
  for (let z = RAIL.z0 + 12; z < RAIL.z1; z += 30) {
    addLamp(b, RAIL.x1 + 4.6, z, Math.PI / 2, { height: 8 });
    colliders.circle(RAIL.x1 + 4.6, z, 0.18, { tag: 'lamp' });
  }
  // benches on the forecourt facing the entrance
  for (const z of [FORECOURT.z0 + 18, FORECOURT.z0 + 40, FORECOURT.z1 - 40, FORECOURT.z1 - 18]) {
    addBench(b, B.x0 + 8, z, -Math.PI / 2, { style: 'park' });
    colliders.box(B.x0 + 7.6, z - 1, B.x0 + 8.4, z + 1, { top: 0.5, tag: 'bench' });
  }
}

export function buildGrounds(ctx) {
  surfaces(ctx.batch);
  railings(ctx);
  edgeFence(ctx.batch, ctx.colliders);
  carPark(ctx);
  trainingSurround(ctx);
  greenery(ctx);
  void FIELD;
}
