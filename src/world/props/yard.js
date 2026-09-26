import * as THREE from 'three';
import { PAL } from '../../core/palette.js';
import { rngKit, rotXZ } from '../../core/util.js';
import { SURF, TILE, hQuad } from '../../core/surfaces.js';
import { Batch } from '../../core/batch.js';
import { addBench } from './street.js';
import { addTree } from './trees.js';
import { addFlowerBed, ringSpots } from './plants.js';

/* ------------------------------------------------------------------ *
 * Courtyard furniture of a Soviet microdistrict, June 2007: ground
 * covers and paths, trees, fences, garages, laundry poles, skips, tyre
 * beds and swans, the dominoes table, the hockey box, heating mains.
 * Everything here is static and goes into the batch. The things that
 * move or answer E (playgrounds, the swing, carpets, the cat) are in
 * play.js.
 *
 * Every `add*` takes world (x, z) and a `facing` yaw; 0 = front to the
 * north (-z), as everywhere else in the town.
 * ------------------------------------------------------------------ */

/* ---------------- a district's own batch ---------------- */

/**
 * A district's view of ctx with a private batch for its ground covers.
 * The shared batch cuts the town into 64 m cells, so a block's five
 * ground surfaces (bare yard, lawn, paths, asphalt, sand) would cost
 * five draw calls in every cell it touches. Ground quads are a handful
 * of triangles, so culling them finely buys nothing: they go into one
 * coarse batch instead. Buildings and props stay in the shared batch,
 * where they merge with the streets' own solid and foliage meshes.
 * Call `flush()` at the end of the district's build.
 */
export function districtCtx(ctx, name) {
  const my = Object.create(ctx);
  my.groundBatch = new Batch({ cell: 1024, name: `${name}-ground` });
  my.flush = () => my.groundBatch.flush(ctx.root);
  return my;
}

/** The batch ground covers go into: the district's own if it has one. */
export const groundOf = (ctx) => ctx.groundBatch || ctx.batch;

/* ---------------- helpers ---------------- */

/** Local-to-world (lx, lz) for a prop standing at (x, z) turned by `facing`. */
export function frame(x, z, facing) {
  const toW = (lx, lz) => { const [a, b] = rotXZ(lx, lz, facing); return [x + a, z + b]; };
  return toW;
}

/** The world rectangle of a local w x d box at (lx, lz), as collider arguments. */
export function boxOf(toW, lx, lz, w, d) {
  const a = toW(lx - w / 2, lz - d / 2), b = toW(lx + w / 2, lz + d / 2);
  return [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[0], b[0]), Math.max(a[1], b[1]), { tag: 'play' }];
}

/* ---------------- ground ---------------- */

/** A trodden dirt path from point to point, `w` metres wide. */
export function addPath(ctx, pts, w = 1.6, y = -0.022) {
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, az] = pts[i], [bx, bz] = pts[i + 1];
    const len = Math.hypot(bx - ax, bz - az);
    const g = new THREE.PlaneGeometry(w, len + w * 0.6);
    g.rotateX(-Math.PI / 2);
    g.rotateY(Math.atan2(bx - ax, bz - az));
    g.translate((ax + bx) / 2, y, (az + bz) / 2);
    const p = g.attributes.position;
    const uv = new Float32Array(p.count * 2);
    for (let k = 0; k < p.count; k++) { uv[k * 2] = p.getX(k) / TILE.dirt; uv[k * 2 + 1] = -p.getZ(k) / TILE.dirt; }
    g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    groundOf(ctx).add(g, { mat: SURF.dirt, color: null, cast: false });
  }
}

/** Cover a rectangle with a ground surface (yard, grass, dirt, asphalt, slabs, sand). */
export function cover(ctx, x0, z0, x1, z1, surf = 'yard', y = -0.03) {
  const tile = TILE[surf] || 8;
  const nx = Math.max(1, Math.ceil((x1 - x0) / 40)), nz = Math.max(1, Math.ceil((z1 - z0) / 40));
  for (let i = 0; i < nx; i++) {
    for (let j = 0; j < nz; j++) {
      const a0 = x0 + ((x1 - x0) * i) / nx, a1 = x0 + ((x1 - x0) * (i + 1)) / nx;
      const b0 = z0 + ((z1 - z0) * j) / nz, b1 = z0 + ((z1 - z0) * (j + 1)) / nz;
      groundOf(ctx).add(hQuad(a0, b0, a1, b1, y, tile), { mat: SURF[surf], color: null, cast: false });
    }
  }
}

/** One ground quad from (x0, z0) to (x1, z1) at height y, in a SURF surface. */
export function groundQuad(ctx, x0, z0, x1, z1, y, surf) {
  groundOf(ctx).add(hQuad(x0, z0, x1, z1, y, TILE[surf]), { mat: SURF[surf], color: null, cast: false });
}

/* ---------------- trees ---------------- */

/** Trees at explicit spots [kind, x, z, scale?], each with a trunk collider. */
export function plantTrees(ctx, list, seed = 1) {
  list.forEach(([kind, x, z, scale], i) => {
    const t = addTree(ctx.batch, kind, x, z, seed + i * 17, { scale: scale ?? 1 });
    if (kind !== 'shrub') ctx.colliders.circle(x, z, t.r + 0.08, { tag: 'tree' });
  });
}

/**
 * Scatter `n` trees over a rectangle [x0, z0, x1, z1], keeping `gap`
 * metres clear of every rectangle in `avoid` and of each other.
 */
export function scatterTrees(ctx, area, n, kinds, avoid = [], { seed = 1, gap = 1.5, spacing = 4.5 } = {}) {
  const rng = rngKit(seed);
  const [x0, z0, x1, z1] = area;
  const placed = [];
  const blocked = (x, z) => avoid.some(([a0, b0, a1, b1]) => x > a0 - gap && x < a1 + gap && z > b0 - gap && z < b1 + gap);
  for (let tries = 0; placed.length < n && tries < n * 30; tries++) {
    const x = rng.range(x0, x1), z = rng.range(z0, z1);
    if (blocked(x, z)) continue;
    if (placed.some(([, px, pz]) => Math.hypot(px - x, pz - z) < spacing)) continue;
    placed.push([rng.pick(kinds), x, z, rng.range(0.85, 1.1)]);
  }
  plantTrees(ctx, placed, seed * 31);
  return placed;
}

/* ---------------- fences ---------------- */

/** The low black loop fence round a lawn (c46, c50). Open polyline. */
export function addLoopFence(ctx, pts, { h = 0.55, color = 0x1e1e1e, closed = false } = {}) {
  const { batch } = ctx;
  const list = closed ? [...pts, pts[0]] : pts;
  for (let i = 0; i < list.length - 1; i++) {
    const [ax, az] = list[i], [bx, bz] = list[i + 1];
    const len = Math.hypot(bx - ax, bz - az);
    const n = Math.max(1, Math.round(len / 0.34));
    batch.tube(ax, h, az, bx, h, bz, 0.018, color, { seg: 4 });
    batch.tube(ax, 0.12, az, bx, 0.12, bz, 0.018, color, { seg: 4 });
    for (let k = 0; k <= n; k++) {
      const t = k / n;
      const x = ax + (bx - ax) * t, z = az + (bz - az) * t;
      if (k % 6 === 0) batch.tube(x, 0, z, x, h + 0.08, z, 0.03, color, { seg: 4 });
      else batch.tube(x, 0.12, z, x, h - 0.12 + (k % 2) * 0.1, z, 0.012, color, { seg: 3, cast: false });
    }
    ctx.colliders.obb((ax + bx) / 2, (az + bz) / 2, 0.05, len / 2, Math.atan2(bx - ax, bz - az), { top: h, tag: 'fence' });
  }
}

/** A steel bar fence (schools, kindergartens): posts every 2.5 m, vertical bars. */
export function addBarFence(ctx, ax, az, bx, bz, { h = 1.6, color = 0x2f4a3a, gaps = [] } = {}) {
  const { batch } = ctx;
  const len = Math.hypot(bx - ax, bz - az);
  const dx = (bx - ax) / len, dz = (bz - az) / len;
  const inGap = (s) => gaps.some(([g0, g1]) => s > g0 && s < g1);
  for (let s = 0; s <= len; s += 0.16) {
    if (inGap(s)) continue;
    const x = ax + dx * s, z = az + dz * s;
    const post = Math.abs((s / 2.5) - Math.round(s / 2.5)) < 0.035;
    batch.tube(x, 0, z, x, post ? h + 0.1 : h, z, post ? 0.04 : 0.012, color, { seg: post ? 4 : 3, cast: post });
  }
  let s0 = 0;
  const spans = [];
  for (const [g0, g1] of [...gaps].sort((a, b) => a[0] - b[0])) { spans.push([s0, g0]); s0 = g1; }
  spans.push([s0, len]);
  for (const [a, b] of spans) {
    if (b - a < 0.2) continue;
    for (const y of [0.15, h - 0.1]) batch.tube(ax + dx * a, y, az + dz * a, ax + dx * b, y, az + dz * b, 0.02, color, { seg: 3 });
    const mx = ax + dx * (a + b) / 2, mz = az + dz * (a + b) / 2;
    ctx.colliders.obb(mx, mz, 0.05, (b - a) / 2, Math.atan2(dx, dz), { tag: 'fence' });
  }
}

/* ---------------- garages ---------------- */

/**
 * A row of steel garages (metal "пеналы"), doors facing `facing`.
 * Some doors rusty, one open with a Moskvich-sized dark inside.
 */
export function addGarages(ctx, x, z, n, facing, seed = 1, { w = 3.0, d = 5.6, h = 2.35 } = {}) {
  const { batch, colliders } = ctx;
  const rng = rngKit(seed);
  const toW = frame(x, z, facing);
  const L = n * w;
  const colors = [0x3e6aa6, 0x4f7a5a, 0x8a4a3a, 0x9aa3a0, 0x6b6e70, 0xb8a060, 0x2f5f8a];
  for (let i = 0; i < n; i++) {
    const lx = -L / 2 + (i + 0.5) * w;
    const [cx, cz] = toW(lx, 0);
    const body = rng.pick([0x9aa0a2, 0x8c8f90, 0xa39c8e, 0x7f8a86]);
    const hh = h + rng.range(-0.08, 0.1);
    batch.box(w - 0.04, hh, d, body, cx, 0, cz, { ry: facing });
    // corrugated roof sheet, a little overhang, slightly sloped
    batch.box(w + 0.1, 0.06, d + 0.3, rng.pick([0x6b6e70, 0x8d9aa0, 0x7a5a40]), cx, hh, cz, { ry: facing, rx: 0.04 });
    // doors: two leaves
    const door = rng.chance(0.3) ? PAL.rust : rng.pick(colors);
    const open = rng.chance(0.08);
    const [fx, fz] = toW(lx, -d / 2 - 0.03);
    if (open) {
      batch.box(w - 0.3, 2.0, 0.04, 0x121314, fx, 0.05, fz, { ry: facing });
      for (const sx of [-1, 1]) {
        const [ox, oz] = toW(lx + sx * (w / 2 - 0.1), -d / 2 - 0.7);
        batch.box(0.04, 2.0, 1.3, door, ox, 0.05, oz, { ry: facing });
      }
    } else {
      batch.box(w - 0.3, 2.05, 0.05, door, fx, 0.05, fz, { ry: facing });
      const [mx, mz] = toW(lx, -d / 2 - 0.06);
      batch.box(0.03, 2.05, 0.03, 0x2a2826, mx, 0.05, mz, { ry: facing });
      const [px, pz] = toW(lx + 0.12, -d / 2 - 0.08);
      batch.box(0.08, 0.1, 0.04, 0x8a8a86, px, 1.05, pz, { ry: facing });
      // a painted number
      if (rng.chance(0.6)) {
        const [nx, nz] = toW(lx - 0.5, -d / 2 - 0.085);
        batch.box(0.28, 0.2, 0.01, 0xf2f0ea, nx, 1.7, nz, { ry: facing });
      }
    }
  }
  const c = [toW(-L / 2, -d / 2), toW(L / 2, d / 2)];
  colliders.box(Math.min(c[0][0], c[1][0]), Math.min(c[0][1], c[1][1]), Math.max(c[0][0], c[1][0]), Math.max(c[0][1], c[1][1]), { top: h, tag: 'garage' });
  return { roofY: h, toW, L, d };
}

/* ---------------- laundry, skips, tyres ---------------- */

/** Two T-poles with washing lines between them. */
export function addLaundryPoles(ctx, ax, az, bx, bz, seed = 5) {
  const { batch, colliders } = ctx;
  const rng = rngKit(seed);
  const dir = Math.atan2(bx - ax, bz - az);
  const cross = (x, z) => {
    batch.cyl(0.05, 2.3, PAL.metalGrey, x, 0, z, { seg: 6 });
    const [ox, oz] = rotXZ(0.8, 0, dir);
    batch.tube(x - ox, 2.2, z - oz, x + ox, 2.2, z + oz, 0.035, PAL.metalGrey, { seg: 5 });
    colliders.circle(x, z, 0.1, { tag: 'pole' });
  };
  cross(ax, az);
  cross(bx, bz);
  const len = Math.hypot(bx - ax, bz - az);
  for (const off of [-0.6, -0.2, 0.2, 0.6]) {
    const [ox, oz] = rotXZ(off, 0, dir);
    batch.tube(ax + ox, 2.18, az + oz, bx + ox, 2.18, bz + oz, 0.006, 0xdad6c8, { seg: 3, cast: false });
    for (let s = 0.6; s < len - 0.6; s += rng.range(0.7, 1.4)) {
      if (rng.chance(0.45)) continue;
      const t = s / len;
      const x = ax + (bx - ax) * t + ox, z = az + (bz - az) * t + oz;
      const c = rng.pick([0xf2f0ea, 0xe8e2d0, 0xc9553d, 0x5a7aa8, 0xd8c27a, 0x6f8a4a, 0xe89aa8, 0xf0f0f0]);
      const w = rng.range(0.3, 0.9), h = rng.range(0.3, 0.8);
      batch.box(w, h, 0.02, c, x, 2.17 - h, z, { ry: dir + Math.PI / 2, closed: true });
    }
  }
}

/** Three steel skips on a concrete pad with a low brick screen. */
export function addSkips(ctx, x, z, facing, seed = 6) {
  const { batch, colliders } = ctx;
  const rng = rngKit(seed);
  const toW = frame(x, z, facing);
  const [px, pz] = toW(0, 0);
  batch.box(7, 0.1, 3.4, PAL.concrete, px, -0.04, pz, { ry: facing });
  const [wx, wz] = toW(0, 1.6);
  batch.box(7, 1.4, 0.25, 0xa65a42, wx, 0, wz, { ry: facing });
  for (let i = 0; i < 3; i++) {
    const [sx, sz] = toW(-2.2 + i * 2.2, 0.2);
    const c = rng.pick([0x4f7a5a, 0x3e6aa6, 0x6b6e70]);
    batch.box(1.8, 1.05, 1.3, c, sx, 0.08, sz, { ry: facing });
    batch.box(1.9, 0.06, 1.4, 0x2a2826, sx, 1.13, sz, { ry: facing, rx: rng.range(-0.1, 0.2) });
    // bags that did not make it in
    if (rng.chance(0.6)) {
      const [bx, bz] = toW(-2.2 + i * 2.2 + rng.range(-0.6, 0.6), -1.0);
      batch.box(0.45, 0.4, 0.4, rng.pick([0x2a2a2c, 0x3a4a5a, 0xe8e4da]), bx, 0, bz, { ry: rng.range(0, 3) });
    }
  }
  colliders.box(...boxOf(toW, 0, 0.3, 7, 2.8));
}

/** Flower bed ringed with half-buried whitewashed tyres. */
export function addTyreBed(ctx, x, z, seed = 7, { r = 1.3 } = {}) {
  const { batch } = ctx;
  const rng = rngKit(seed);
  const n = Math.round((Math.PI * 2 * r) / 0.55);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    batch.cyl(0.3, 0.2, rng.chance(0.3) ? rng.pick([0x3e6aa6, 0xc9453d, 0xe2bd3f]) : PAL.whitewash, x + Math.cos(a) * r, 0, z + Math.sin(a) * r, { rx: Math.PI / 2, ry: -a + Math.PI / 2, seg: 8 });
  }
  groundOf(ctx).add(hQuad(x - r * 0.8, z - r * 0.8, x + r * 0.8, z + r * 0.8, 0.02, TILE.dirt), { mat: SURF.dirt, color: null, cast: false });
  // marigolds, cosmos, petunias: whatever the neighbours had seeds of
  addFlowerBed(batch, ringSpots(x, z, 0, r * 0.75, seed, 0.3), seed + 1,
    { y: 0.02, colors: [0xd8453a, 0xf2e05a, 0xf0f0f0, 0xe07a3a, 0xc85aa0], height: 0.34, heads: 5 });
  ctx.colliders.circle(x, z, r + 0.2, { top: 0.35, tag: 'tyres' });
}

/** A swan cut from a tyre and painted white, beak red: the courtyard classic. */
export function addTyreSwan(ctx, x, z, facing = 0) {
  const { batch } = ctx;
  const toW = frame(x, z, facing);
  const white = 0xf2f0ea;
  batch.cyl(0.45, 0.28, white, x, 0, z, { seg: 12 });
  // wings: two flattened boxes tilted up
  for (const s of [-1, 1]) {
    const [wx, wz] = toW(s * 0.3, 0.05);
    batch.box(0.08, 0.35, 0.8, white, wx, 0.2, wz, { ry: facing, rz: s * 0.5 });
  }
  // neck and head
  const [nx, nz] = toW(0, -0.35);
  batch.tube(nx, 0.25, nz, nx, 0.85, nz - 0.0, 0.06, white, { seg: 6 });
  const [hx, hz] = toW(0, -0.5);
  batch.box(0.12, 0.12, 0.26, white, hx, 0.82, hz, { ry: facing });
  const [bx, bz] = toW(0, -0.68);
  batch.box(0.06, 0.05, 0.12, 0xd8453a, bx, 0.85, bz, { ry: facing });
}

/** The dominoes table under the trees: a plank top on a steel frame, two benches. */
export function addDominoTable(ctx, x, z, facing = 0, seed = 8) {
  const { batch, colliders } = ctx;
  const rng = rngKit(seed);
  const toW = frame(x, z, facing);
  batch.box(0.1, 0.72, 0.1, PAL.metalDark, x, 0, z, { ry: facing });
  batch.box(1.6, 0.05, 0.9, rng.pick([0x8a5a3a, 0x6e4a30, 0x3e6aa6]), x, 0.72, z, { ry: facing });
  for (let i = 0; i < 6; i++) {
    const [dx, dz] = toW(rng.range(-0.5, 0.5), rng.range(-0.25, 0.25));
    batch.box(0.05, 0.012, 0.1, 0xf2f0ea, dx, 0.77, dz, { ry: facing + rng.range(0, 3) });
  }
  for (const s of [-1, 1]) {
    const [bx, bz] = toW(0, s * 0.95);
    addBench(batch, bx, bz, facing + (s < 0 ? Math.PI : 0), { style: 'yard', color: 0x8a5a3a, len: 1.8 });
  }
  colliders.box(...boxOf(toW, 0, 0, 1.9, 2.6));
}

/**
 * The courtyard hockey box (хоккейная коробка): plank boards round an
 * asphalt rink with chamfered corners, football goals for the summer.
 * `facing` in multiples of PI/2; the long side runs along local x.
 */
export function addSportsBox(ctx, x, z, facing = 0, { L = 28, W = 14, seed = 10 } = {}) {
  const { batch, colliders } = ctx;
  const rng = rngKit(seed);
  const toW = frame(x, z, facing);
  const c = 2.4;
  const hw = L / 2, hd = W / 2;
  const ring = [[-hw + c, -hd], [hw - c, -hd], [hw, -hd + c], [hw, hd - c], [hw - c, hd], [-hw + c, hd], [-hw, hd - c], [-hw, -hd + c]];
  const board = rng.pick([0x3f7a4a, 0x2f5f8a]);
  for (let i = 0; i < ring.length; i++) {
    const [ax, az] = ring[i], [bx, bz] = ring[(i + 1) % ring.length];
    const len = Math.hypot(bx - ax, bz - az);
    // a gap in the middle of the north long side to walk in
    const parts = i === 0 ? [[0, len / 2 - 0.8], [len / 2 + 0.8, len]] : [[0, len]];
    for (const [s0, s1] of parts) {
      const t0 = s0 / len, t1 = s1 / len;
      const [p0x, p0z] = toW(ax + (bx - ax) * t0, az + (bz - az) * t0);
      const [p1x, p1z] = toW(ax + (bx - ax) * t1, az + (bz - az) * t1);
      const dir = Math.atan2(p1x - p0x, p1z - p0z);
      const l = Math.hypot(p1x - p0x, p1z - p0z);
      const mx = (p0x + p1x) / 2, mz = (p0z + p1z) / 2;
      batch.box(0.06, 1.1, l, board, mx, 0, mz, { ry: dir });
      batch.box(0.1, 0.06, l, 0xf2f0ea, mx, 1.1, mz, { ry: dir });
      for (let s = 0; s <= l; s += 2) batch.box(0.1, 1.15, 0.1, 0x6a5a4a, p0x + (p1x - p0x) * (s / l), 0, p0z + (p1z - p0z) * (s / l), { ry: dir });
      colliders.obb(mx, mz, 0.06, l / 2, dir, { top: 1.1, tag: 'boards' });
    }
  }
  const [a0, a1] = [toW(-hw, -hd), toW(hw, hd)];
  groundOf(ctx).add(hQuad(Math.min(a0[0], a1[0]), Math.min(a0[1], a1[1]), Math.max(a0[0], a1[0]), Math.max(a0[1], a1[1]), -0.01, TILE.asphalt), { mat: SURF.asphalt, color: null, cast: false });
  // centre line and goals
  const [lx0, lz0] = toW(0, -hd + 0.3), [lx1, lz1] = toW(0, hd - 0.3);
  batch.box(0.1, 0.01, Math.hypot(lx1 - lx0, lz1 - lz0), 0xd8d4c8, (lx0 + lx1) / 2, 0.0, (lz0 + lz1) / 2, { ry: facing, cast: false });
  for (const sx of [-1, 1]) {
    const gx = sx * (hw - 0.6);
    const post = (oz, h) => { const [px, pz] = toW(gx, oz); batch.cyl(0.04, h, 0xf2f0ea, px, 0, pz, { seg: 5 }); };
    post(-1.5, 2); post(1.5, 2);
    const [t0x, t0z] = toW(gx, -1.5), [t1x, t1z] = toW(gx, 1.5);
    batch.tube(t0x, 2, t0z, t1x, 2, t1z, 0.04, 0xf2f0ea, { seg: 5 });
    for (const oz of [-1.5, 1.5]) {
      const [bx, bz] = toW(gx + sx * 0.8, oz), [tx, tz] = toW(gx, oz);
      batch.tube(tx, 2, tz, bx, 0, bz, 0.02, 0xf2f0ea, { seg: 3, cast: false });
    }
    const [rx, rz] = toW(gx + sx * 0.8, 0);
    batch.box(0.02, 0.01, 3.0, 0xd8d4c8, rx, 0, rz, { ry: facing, cast: false });
  }
  // a forgotten ball
  const [bx, bz] = toW(rng.range(-5, 5), rng.range(-3, 3));
  const ball = new THREE.IcosahedronGeometry(0.11, 1);
  ball.translate(bx, 0.11, bz);
  batch.add(ball, { color: 0xf2f0ea });
}

/* ---------------- heating mains ---------------- */

/**
 * Above-ground heating pipes in silver cladding on concrete supports:
 * two pipes side by side along a polyline. Segments listed in `hoops`
 * are lifted overhead (the П-shaped loop that lets a drive or a path
 * pass under), rising at the segment's start and dropping at its end.
 */
export function addHeatingMain(ctx, pts, { y = 0.9, hoops = [], up = 4.4 } = {}) {
  const { batch, colliders } = ctx;
  const clad = 0xc9ccce;
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, az] = pts[i], [bx, bz] = pts[i + 1];
    const len = Math.hypot(bx - ax, bz - az);
    const dir = Math.atan2(bx - ax, bz - az);
    const hoop = hoops.includes(i);
    const py = hoop ? up : y;
    for (const off of [-0.32, 0.32]) {
      const [ox, oz] = rotXZ(off, 0, dir);
      batch.tube(ax + ox, py, az + oz, bx + ox, py, bz + oz, 0.24, clad, { seg: 8 });
      if (hoop) {
        batch.tube(ax + ox, y, az + oz, ax + ox, up, az + oz, 0.24, clad, { seg: 8 });
        batch.tube(bx + ox, y, bz + oz, bx + ox, up, bz + oz, 0.24, clad, { seg: 8 });
      }
      // bands on the cladding
      for (let s = 0.8; s < len; s += 1.2) {
        const t = s / len;
        batch.cyl(0.25, 0.05, 0xa8acae, ax + (bx - ax) * t + ox, py, az + (bz - az) * t + oz, { rx: Math.PI / 2, ry: dir, seg: 8, cast: false });
      }
    }
    if (hoop) {
      // the loop's legs are all a walker bumps into
      for (const [x, z] of [[ax, az], [bx, bz]]) colliders.circle(x, z, 0.65, { tag: 'pipe' });
      continue;
    }
    // supports about every 6 m
    const n = Math.max(1, Math.ceil(len / 6));
    for (let k = 0; k <= n; k++) {
      const t = k / n;
      batch.box(1.1, y - 0.24, 0.3, PAL.concrete, ax + (bx - ax) * t, 0, az + (bz - az) * t, { ry: dir + Math.PI / 2 });
    }
    colliders.obb((ax + bx) / 2, (az + bz) / 2, 0.6, len / 2, dir, { top: y + 0.3, tag: 'pipe' });
  }
}
