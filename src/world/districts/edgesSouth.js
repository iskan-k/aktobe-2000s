import * as THREE from 'three';
import { cel } from '../../core/toon.js';
import { SURF, TILE, hQuad, worldUV } from '../../core/surfaces.js';
import { signTex } from '../../core/textures.js';
import { rngKit } from '../../core/util.js';
import { BLOCKS, BOUNDS, SIGHTS, TOWN_Z1, roadById, outerEdge } from '../plan.js';
import { KIT, TILES, tbox, mtx, quadGeo } from '../buildings/houseKit.js';
import { addTree } from '../props/trees.js';
import { addWeeds } from '../props/plants.js';
import { addWires } from '../props/street.js';

/* ------------------------------------------------------------------ *
 * The south edge: two garage cooperatives of brick boxes with steel
 * doors in faded paint along gravel lanes, the waste ground between
 * them with a trodden path and a boys' football pitch, a 110 kV line
 * of lattice pylons, a wire fence at the end of the town, and the flat
 * steppe beyond it to the horizon.
 * ------------------------------------------------------------------ */

const S = BLOCKS.southEdge;
const MID = roadById.mid;
const MID_W = [MID.c - outerEdge(MID, 0), MID.c + outerEdge(MID, 1)];
const ROW_A = { back: S.z0 + 0.5, front: S.z0 + 6.5 };     // doors face south
const ROW_B = { front: S.z0 + 14.5, back: S.z0 + 20.5 };   // doors face north
const LINE_Z = 153.5;
const DOORS = [0x5a7a5a, 0x4a6a8a, 0x7a4a3a, 0x8a8a84, 0x6a3a3a, 0x9a8a5a, 0x3a5a6a, 0x6a7a4a];

/* ------------------------------------------------------------------ garages */

/**
 * One row of garages from x0 to x1. `dir` is +1 when the doors face +z.
 * Returns the x of each open garage (a car stands nose-in at its door).
 */
function garageRow(ctx, x0, x1, zFront, dir, rng, brick) {
  const { batch, colliders } = ctx;
  const GW = 3.4, D = 6;
  const n = Math.floor((x1 - x0) / GW);
  const zc = zFront - dir * D / 2;
  const ry = dir > 0 ? Math.PI : 0;
  const opened = [];
  for (let i = 0; i < n; i++) {
    const x = x0 + GW * (i + 0.5);
    const h = 2.5 + rng.range(-0.15, 0.2);
    const plastered = rng.chance(0.18);
    tbox(batch, plastered ? KIT.plaster : KIT.brick, plastered ? TILES.plaster : TILES.brick, GW - 0.02, h, D, plastered ? 0xe8e2d4 : brick, x, 0, zc);
    batch.box(GW + 0.02, 0.14, D + 0.5, 0x3a3634, x, h, zc + dir * 0.25, { cast: true });
    const open = rng.chance(0.09);
    const door = rng.pick(DOORS);
    const fz = zFront + dir * 0.012;
    if (open) {
      batch.box(2.6, 2.15, 0.02, 0x1a1816, x, 0, fz, { mat: 'glass', cast: false });
      for (const s of [-1, 1]) tbox(batch, KIT.garageDoor, [2.6, 2.15], 0.04, 2.15, 1.3, door, x + s * 1.33, 0, zFront + dir * 0.67);
      ctx.parking.push({ x, z: zFront + dir * 2.4, ry: dir > 0 ? 0 : Math.PI, chance: 0.8 });
      opened.push(x);
    } else {
      batch.add(quadGeo(2.6, 2.15), { mat: KIT.garageDoor, color: door, matrix: mtx(x, 0, fz, ry), cast: false });
    }
    if (rng.chance(0.3)) batch.box(2.9, 0.08, 0.35, 0x5a5a5a, x, 2.2, zFront + dir * 0.17);   // a lintel shelf
  }
  const zb = zFront - dir * D;
  colliders.box(x0, Math.min(zFront, zb), x0 + n * GW, Math.max(zFront, zb), { top: 2.7, tag: 'garage' });
  return opened;
}

function cooperative(ctx, x0, x1, seed, name) {
  const { batch, root, colliders } = ctx;
  const rng = rngKit(seed);
  const brick = rng.pick([0xd8d0c0, 0xb86a50]);
  const opened = [
    ...garageRow(ctx, x0, x1, ROW_A.front, 1, rng, brick),
    ...garageRow(ctx, x0, x1, ROW_B.front, -1, rng, rng.pick([0xd8d0c0, 0xb86a50, 0xc8bca8])),
  ];
  // the gravel lane between the rows
  batch.add(hQuad(x0, ROW_A.front, x1, ROW_B.front, -0.026, TILE.sand), { mat: SURF.sand, color: null, cast: false });
  // a couple of cars parked along the lane
  for (let x = x0 + 8; x < x1 - 8; x += rng.range(18, 40)) {
    if (opened.some((o) => Math.abs(o - x) < 4)) continue;
    ctx.parking.push({ x, z: ROW_B.front - 1.6, ry: rng.chance(0.5) ? Math.PI / 2 : -Math.PI / 2, chance: 0.7 });
  }
  // cooperative sign and bins at the lane mouth nearest the town
  const mouthX = x1 > 0 ? x0 - 1.5 : x1 + 1.5;
  const sz = ROW_A.front - 0.5;
  batch.box(0.1, 2.8, 0.1, 0x5a5a5a, mouthX, 0, sz);
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 0.7), cel({
    map: signTex({ w: 320, h: 124, bg: '#f2efe6', fg: '#1f3e7c', lines: [name, 'ГСК · ГАРАЖ ҚОҒАМЫ'], sizes: [1, 0.6], seed, wear: 0.7 }),
    cache: false, grime: 0.02, dirt: 0, side: THREE.DoubleSide,
  }));
  sign.position.set(mouthX, 2.4, sz + 0.06);
  root.add(sign);
  colliders.circle(mouthX, sz, 0.1, { tag: 'post' });
  for (let i = 0; i < 2; i++) {
    const bx = x1 > 0 ? x0 + 2 + i * 1.6 : x1 - 2 - i * 1.6, bz = ROW_B.front - 1;
    batch.box(1.3, 1.1, 0.9, 0x3f6a4a, bx, 0.1, bz);
    batch.box(1.3, 0.05, 0.9, 0x2a2a2a, bx, 1.2, bz, { rx: 0.2 });
    colliders.box(bx - 0.65, bz - 0.45, bx + 0.65, bz + 0.45, { top: 1.2, tag: 'bin' });
  }
  // «продаю гараж», painted on the back wall facing the street
  const ad = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 0.9), cel({
    map: signTex({ w: 360, h: 100, bg: '#b86a50', fg: '#f4f2ea', lines: ['ПРОДАЮ ГАРАЖ 21-17-06'], seed: seed + 1, wear: 0.9, key: 'garage-ad-' + seed }),
    cache: false, grime: 0.02, dirt: 0.2, transparent: false,
  }));
  ad.position.set(x0 + (x1 - x0) * 0.37, 1.5, ROW_A.back - 0.02);
  ad.rotation.y = Math.PI;
  root.add(ad);
}

/* ------------------------------------------------------------------ waste ground and pitch */

function strip(batch, pts, width, y, mat, tile) {
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, az] = pts[i], [bx, bz] = pts[i + 1];
    const len = Math.hypot(bx - ax, bz - az);
    const g = new THREE.PlaneGeometry(len + width * 0.6, width);
    g.rotateX(-Math.PI / 2);
    g.rotateY(Math.atan2(-(bz - az), bx - ax));
    g.translate((ax + bx) / 2, y, (az + bz) / 2);
    worldUV(g, tile);
    batch.add(g, { mat, color: null, cast: false });
  }
}

function goal(ctx, x, z, facing) {
  const { batch, colliders } = ctx;
  const col = 0xd8d4cc, W = 5, H = 2, Dp = 1.4;
  for (const s of [-1, 1]) {
    batch.cyl(0.05, H, col, x, 0, z + s * W / 2, { seg: 6 });
    batch.tube(x, H, z + s * W / 2, x - facing * Dp, 0, z + s * W / 2, 0.035, col, { seg: 5 });
    batch.tube(x - facing * Dp, 0.03, z + s * W / 2, x, 0.03, z + s * W / 2, 0.03, col, { seg: 5 });
    colliders.circle(x, z + s * W / 2, 0.08, { tag: 'goal' });
  }
  batch.tube(x, H, z - W / 2, x, H, z + W / 2, 0.05, col, { seg: 6 });
  batch.tube(x - facing * Dp, 0.03, z - W / 2, x - facing * Dp, 0.03, z + W / 2, 0.03, col, { seg: 5 });
}

function wasteGround(ctx, x0, x1) {
  const { batch, colliders } = ctx;
  const rng = rngKit(1717);
  const z0 = S.z0, z1 = S.z1;
  batch.add(hQuad(x0, z0, x1, z1, -0.03, TILE.dirt), { mat: SURF.dirt, color: null, cast: false });
  for (let i = 0; i < 9; i++) {
    const cx = rng.range(x0 + 6, x1 - 6), cz = rng.range(z0 + 4, z1 - 3);
    const w = rng.range(8, 22), d = rng.range(4, 10);
    batch.add(hQuad(Math.max(x0, cx - w / 2), Math.max(z0, cz - d / 2), Math.min(x1, cx + w / 2), Math.min(z1, cz + d / 2), -0.027 + i * 0.0004, TILE.grass),
      { mat: SURF.grass, color: null, cast: false });
  }
  // the pitch: bare trodden earth with two goals, a ball left behind
  const P = { x0: 22, x1: 64, z0: 129, z1: 149 };
  batch.add(hQuad(P.x0, P.z0, P.x1, P.z1, -0.022, TILE.sand), { mat: SURF.sand, color: null, cast: false });
  goal(ctx, P.x0 + 0.6, (P.z0 + P.z1) / 2, 1);
  goal(ctx, P.x1 - 0.6, (P.z0 + P.z1) / 2, -1);
  const ball = new THREE.IcosahedronGeometry(0.11, 1);
  ball.translate(47, 0.1, 141);
  batch.add(ball, { color: 0xf2efe6, mat: 'solidClean' });
  // old tyres half dug in along the touchline, for sitting on
  for (let i = 0; i < 7; i++) {
    const t = new THREE.TorusGeometry(0.34, 0.12, 5, 10);
    t.translate(30 + i * 1.1, 0.1, P.z0 - 0.8);
    batch.add(t, { color: 0x2a2826, cast: false });
  }
  colliders.box(29.5, P.z0 - 1.2, 37.3, P.z0 - 0.4, { top: 0.45, tag: 'tyres' });
  // the trodden paths
  const path = [[MID_W[1], 127.5], [P.x0 - 1, P.z0 - 2], [P.x1 + 2, P.z0 - 2.5], [96, 136], [x1, 135]];
  strip(batch, path, 1.3, -0.02, SURF.yard, TILE.yard);
  strip(batch, [[P.x1 + 2, P.z0 - 2.5], [84, 148], [92, TOWN_Z1]], 1.1, -0.019, SURF.yard, TILE.yard);
  // weeds, bushes, a heap of rubbish and the shell of a Moskvich
  // weeds in patches: wormwood and dry grass mostly, burdock where it is damp
  for (let i = 0; i < 70; i++) {
    const cx = rng.range(x0 + 2, x1 - 2), cz = rng.range(z0 + 1.5, z1 - 1);
    const n = rng.int(1, 4);
    for (let k = 0; k < n; k++) {
      const x = cx + rng.range(-1.6, 1.6), z = cz + rng.range(-1.2, 1.2);
      if (x < x0 + 0.5 || x > x1 - 0.5 || z < z0 + 0.5 || z > z1 - 0.3) continue;
      if (x > P.x0 - 1 && x < P.x1 + 1 && z > P.z0 - 1.5 && z < P.z1 + 0.5) continue;
      addWeeds(batch, x, z, 5000 + i * 7 + k, { scale: rng.range(0.8, 1.4) });
    }
  }
  // self-seeded trees and bushes: elms, maples, a yellow acacia thicket
  const wild = [
    [-4, 153, 'elm'], [8, 131, 'acacia'], [76, 152, 'elm'], [100, 128, 'maple'], [70, 130, 'acacia'], [-8, 140, 'maple'],
    [12, 150, 'acacia'], [56, 153, 'young'], [98, 152, 'acacia'], [108, 138, 'elm'],
  ];
  for (const [x, z, kind] of wild) {
    addTree(batch, kind, x, z, 3000 + x, { scale: kind === 'acacia' ? 1.1 : 0.75, whitewash: false });
    if (kind !== 'acacia') colliders.circle(x, z, 0.25, { tag: 'tree' });
  }
  const hx = 86, hz = 131;
  const heap = new THREE.ConeGeometry(2.6, 1.1, 8, 1, true);
  heap.translate(hx, 0.5, hz);
  batch.add(heap, { color: 0x6a6258, cast: false });
  for (let i = 0; i < 9; i++) {
    batch.box(rng.range(0.3, 1.1), rng.range(0.1, 0.5), rng.range(0.3, 0.9), rng.pick([0xc8c2b4, 0x8a6a4a, 0x3a6aa0, 0xe8e6e0, 0x5a4a3a]),
      hx + rng.range(-2.5, 2.5), 0, hz + rng.range(-2.2, 2.2), { ry: rng.range(0, 3) });
  }
  colliders.circle(hx, hz, 2.2, { top: 1.0, tag: 'heap' });
  const mx = 104, mz = 146;
  batch.box(4.1, 0.75, 1.6, 0x7a4a2e, mx, 0.2, mz, { ry: 0.4 });
  batch.box(2.2, 0.55, 1.45, 0x6a3e26, mx - 0.2, 0.95, mz - 0.1, { ry: 0.4 });
  colliders.obb(mx, mz, 2.05, 0.8, 0.4, { top: 1.5, tag: 'wreck' });
  // concrete slabs dumped in a pile
  for (let i = 0; i < 3; i++) batch.box(6, 0.22, 1.5, 0xb4b0a6, -2, i * 0.22, 134 + i * 0.3, { ry: 0.1 * i });
  colliders.obb(-2, 134.3, 3, 1, 0.1, { top: 0.66, tag: 'slabs' });
}

/* ------------------------------------------------------------------ the 110 kV line */

function pylon(batch, x, z) {
  const col = 0x8a8e8c;
  const H = 24, TOP = 31, B0 = 2.6, B1 = 0.8;
  const at = (y) => B0 + (B1 - B0) * Math.min(1, y / H);
  const corners = [[1, 1], [1, -1], [-1, -1], [-1, 1]];
  for (const [sx, sz] of corners) {
    batch.tube(x + sx * B0, 0, z + sz * B0, x + sx * B1, H, z + sz * B1, 0.09, col, { seg: 4 });
    batch.tube(x + sx * B1, H, z + sz * B1, x + sx * 0.5, TOP, z + sz * 0.5, 0.07, col, { seg: 4 });
  }
  // X bracing on each face, section by section
  const levels = [0, 4.5, 8.5, 12, 15, 17.5, 20, 22, 24];
  for (let k = 0; k < levels.length - 1; k++) {
    const y0 = levels[k], y1 = levels[k + 1], a = at(y0), b = at(y1);
    for (let f = 0; f < 4; f++) {
      const [ax, az] = corners[f], [bx, bz] = corners[(f + 1) % 4];
      batch.tube(x + ax * a, y0, z + az * a, x + bx * b, y1, z + bz * b, 0.035, col, { seg: 3, cast: false });
      batch.tube(x + bx * a, y0, z + bz * a, x + ax * b, y1, z + az * b, 0.035, col, { seg: 3, cast: false });
    }
  }
  // three crossarms each side (a double circuit), across the line
  const arms = [[17.5, 4.2], [21.5, 5.6], [25.5, 4.2]];
  for (const [y, reach] of arms) {
    for (const s of [-1, 1]) {
      const w = at(y);
      batch.tube(x - 0.5, y, z + s * w, x, y, z + s * reach, 0.05, col, { seg: 3 });
      batch.tube(x + 0.5, y, z + s * w, x, y, z + s * reach, 0.05, col, { seg: 3 });
      batch.tube(x, y + 1.6, z + s * w, x, y, z + s * reach, 0.04, col, { seg: 3, cast: false });
      batch.cyl(0.09, 1.5, 0x8a9aa0, x, y - 1.5, z + s * reach, { seg: 5, cast: false });
    }
  }
  batch.box(5.8, 0.4, 5.8, 0xa8a49a, x, -0.1, z, { cast: false });
  return arms;
}

function hvLine(ctx, batch) {
  const { colliders } = ctx;
  const xs = [];
  for (let x = -610; x <= 690; x += 130) xs.push(x);
  let arms = null;
  for (const x of xs) {
    arms = pylon(batch, x, LINE_Z);
    if (x > BOUNDS.x0 - 5 && x < BOUNDS.x1 + 5) {
      for (const [sx, sz] of [[1, 1], [1, -1], [-1, -1], [-1, 1]]) colliders.circle(x + sx * 2.6, LINE_Z + sz * 2.6, 0.2, { tag: 'pylon' });
    }
  }
  for (const [y, reach] of arms) {
    for (const s of [-1, 1]) {
      addWires(batch, xs.map((x) => [x, y - 1.5, LINE_Z + s * reach]), { sag: 3.2, r: 0.03, color: 0x4a4c4e });
    }
  }
  addWires(batch, xs.map((x) => [x, 31, LINE_Z]), { sag: 2.6, r: 0.02, color: 0x4a4c4e });
}

/* ------------------------------------------------------------------ the end of the town */

let steppeMat = null;
function steppe(batch) {
  // pulled forward in depth so the far steppe never fights with the bare earth under it
  if (!steppeMat) steppeMat = cel({ map: SURF.grass.map, cache: false, polygonOffset: 3, grime: 0.06, dirt: 0, bands: 3 });
  const R = 860, T = 25;
  const quads = [
    [-R, TOWN_Z1, MID_W[0], R], [MID_W[1], TOWN_Z1, R, R],
    [-R, S.z0, BOUNDS.x0, TOWN_Z1], [BOUNDS.x1, S.z0, R, TOWN_Z1],
  ];
  for (const [x0, z0, x1, z1] of quads) {
    const g = hQuad(x0, z0, x1, z1, -0.045, T);
    batch.add(g, { mat: steppeMat, color: null, cast: false });
  }
  // a wire fence on concrete posts marks where the town stops
  const fz = TOWN_Z1 - 0.4;
  for (const [a, b] of [[BOUNDS.x0, MID_W[0] - 0.5], [MID_W[1] + 0.5, BOUNDS.x1]]) {
    for (let x = a; x <= b; x += 3) batch.box(0.14, 1.5, 0.14, 0xb4b0a6, x, 0, fz, { rz: Math.sin(x * 1.7) * 0.05, cast: false });
    for (const y of [0.45, 0.9, 1.35]) batch.tube(a, y, fz, b, y, fz, 0.008, 0x5a5854, { seg: 3, cast: false });
  }
}

/** `far` is the backdrop batch (one big cell), for things that reach past the bounds. */
export function southEdge(ctx, far) {
  // each cooperative gives up its outer end to the sights district
  cooperative(ctx, SIGHTS.west.x1 + 2, MID_W[0] - 4, 1414, '«АВТОМОБИЛИСТ»');
  cooperative(ctx, SIGHTS.east.x1 + 4, BOUNDS.x1 - 2, 1515, '«ЖИГУЛИ»');
  wasteGround(ctx, MID_W[1], 120);
  // the strip south of the west cooperative, down to the fence
  ctx.batch.add(hQuad(BOUNDS.x0, ROW_B.back, MID_W[0], TOWN_Z1, -0.03, TILE.grass), { mat: SURF.grass, color: null, cast: false });
  ctx.batch.add(hQuad(120, ROW_B.back, BOUNDS.x1, TOWN_Z1, -0.03, TILE.grass), { mat: SURF.grass, color: null, cast: false });
  hvLine(ctx, far);
  steppe(far);
}
