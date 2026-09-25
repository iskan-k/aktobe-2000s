import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { PAL } from '../../core/palette.js';
import { rngKit, rotXZ, clamp, damp } from '../../core/util.js';
import { cel, MAT } from '../../core/toon.js';
import { canvasTex, cached } from '../../core/textures.js';
import { SURF, TILE, hQuad } from '../../core/surfaces.js';
import { defineVoice } from '../../core/audio.js';
import { addBench } from './street.js';
import { addTree } from './trees.js';
import { Batch } from '../../core/batch.js';

/* ------------------------------------------------------------------ *
 * Courtyard furniture of a Soviet microdistrict, June 2007.
 *
 * Static parts go into ctx.batch. Things that move (the carousel, the
 * swing you sit on, the carpet you beat, the cat) are small groups in
 * ctx.root with an update function and an interactable.
 *
 * Every `add*` takes world (x, z) and a `facing` yaw; 0 = front to the
 * north (-z), as everywhere else in the town.
 * ------------------------------------------------------------------ */

/* ---------------- sounds ---------------- */

let NOISE = null;
function noise(ac) {
  if (!NOISE || NOISE.sampleRate !== ac.sampleRate) {
    NOISE = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
    const d = NOISE.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  const s = ac.createBufferSource();
  s.buffer = NOISE;
  return s;
}

defineVoice('thwack', (ac, out, { volume = 1 }) => {
  const t = ac.currentTime;
  const s = noise(ac);
  const f = ac.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.setValueAtTime(2200, t);
  f.frequency.exponentialRampToValueAtTime(300, t + 0.18);
  const g = ac.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.7 * volume, t + 0.004);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
  s.connect(f).connect(g).connect(out);
  s.start(t, Math.random() * 0.5);
  s.stop(t + 0.3);
});

defineVoice('meow', (ac, out, { volume = 1 }) => {
  const t = ac.currentTime;
  const o = ac.createOscillator();
  o.type = 'sawtooth';
  const f = ac.createBiquadFilter();
  f.type = 'bandpass';
  f.Q.value = 3;
  const base = 520 + Math.random() * 160;
  o.frequency.setValueAtTime(base, t);
  o.frequency.linearRampToValueAtTime(base * 1.45, t + 0.18);
  o.frequency.linearRampToValueAtTime(base * 0.8, t + 0.6);
  f.frequency.setValueAtTime(900, t);
  f.frequency.linearRampToValueAtTime(1600, t + 0.2);
  f.frequency.linearRampToValueAtTime(700, t + 0.6);
  const g = ac.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.16 * volume, t + 0.06);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.65);
  o.connect(f).connect(g).connect(out);
  o.start(t);
  o.stop(t + 0.7);
});

/** A rusty squeak: swings and carousels that nobody has oiled since 1989. */
defineVoice('swing-creak', (ac, out, { volume = 1, rate = 1 }) => {
  const t = ac.currentTime;
  const o = ac.createOscillator();
  o.type = 'square';
  const f = ac.createBiquadFilter();
  f.type = 'bandpass';
  f.Q.value = 8;
  f.frequency.value = 1400 * rate;
  const b = 700 * rate + Math.random() * 60;
  o.frequency.setValueAtTime(b, t);
  o.frequency.linearRampToValueAtTime(b * 1.3, t + 0.25);
  const g = ac.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.05 * volume, t + 0.05);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.32);
  o.connect(f).connect(g).connect(out);
  o.start(t);
  o.stop(t + 0.35);
});

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
const groundOf = (ctx) => ctx.groundBatch || ctx.batch;

/* ---------------- helpers ---------------- */

function frame(x, z, facing) {
  const toW = (lx, lz) => { const [a, b] = rotXZ(lx, lz, facing); return [x + a, z + b]; };
  return toW;
}

/** A geometry moved into place: translate, then Euler (rx, ry, rz) about its own centre. */
function placed(g, x, y, z, rx = 0, ry = 0, rz = 0) {
  g.applyMatrix4(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(rx, ry, rz)));
  g.translate(x, y, z);
  return g;
}

/**
 * One vertex-coloured mesh from [geometry, colour] parts, so a moving
 * prop made of many pieces is still a single draw call.
 */
function coloured(parts, { cast = true } = {}) {
  const c = new THREE.Color();
  const geos = parts.map(([g, color]) => {
    const n = g.attributes.position.count;
    const col = new Float32Array(n * 3);
    c.set(color);
    for (let i = 0; i < n; i++) { col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.deleteAttribute('uv');
    return g;
  });
  const merged = mergeGeometries(geos, false);
  geos.forEach((g) => g.dispose());
  const mesh = new THREE.Mesh(merged, MAT.solid);
  mesh.castShadow = cast;
  mesh.receiveShadow = true;
  return mesh;
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

/* ---------------- playgrounds ---------------- */

/** Soviet metal slide: ladder, platform, a steel chute. */
function addSlide(batch, toW, lx, lz, facing, color) {
  const post = (ox, oz, h) => { const [px, pz] = toW(lx + ox, lz + oz); batch.cyl(0.04, h, color, px, 0, pz, { seg: 5 }); };
  post(-0.35, 0.8, 1.9); post(0.35, 0.8, 1.9); post(-0.35, 0.2, 1.9); post(0.35, 0.2, 1.9);
  const [px, pz] = toW(lx, lz + 0.5);
  batch.box(0.8, 0.06, 0.7, 0x9a9a96, px, 1.3, pz, { ry: facing });
  for (let i = 0; i < 5; i++) { const [sx, sz] = toW(lx, lz + 0.85 + i * 0.12); batch.box(0.66, 0.04, 0.05, color, sx, 0.25 + i * 0.25, sz, { ry: facing }); }
  const [cx, cz] = toW(lx, lz - 0.9);
  batch.box(0.6, 0.04, 2.6, 0xb8bcbe, cx, 0.66, cz, { ry: facing, rx: -0.46 });
  for (const sx of [-1, 1]) { const [ex, ez] = toW(lx + sx * 0.3, lz - 0.9); batch.box(0.03, 0.18, 2.6, color, ex, 0.7, ez, { ry: facing, rx: -0.46 }); }
}

/** The rocket climbing frame: a tube of rings with a nose cone and fins. */
function addRocket(batch, x, z, color) {
  const h = 5.2;
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    batch.tube(x + Math.cos(a) * 0.8, 0, z + Math.sin(a) * 0.8, x + Math.cos(a) * 0.7, h - 1.2, z + Math.sin(a) * 0.7, 0.035, color, { seg: 4 });
    batch.tube(x + Math.cos(a) * 0.7, h - 1.2, z + Math.sin(a) * 0.7, x, h, z, 0.03, color, { seg: 4 });
  }
  for (let y = 0.5; y < h - 1.3; y += 0.55) {
    const r = 0.8 - (y / (h - 1.2)) * 0.1;
    for (let i = 0; i < 12; i++) {
      const a0 = (i / 12) * Math.PI * 2, a1 = ((i + 1) / 12) * Math.PI * 2;
      batch.tube(x + Math.cos(a0) * r, y, z + Math.sin(a0) * r, x + Math.cos(a1) * r, y, z + Math.sin(a1) * r, 0.02, color, { seg: 3, cast: false });
    }
  }
  batch.cyl(0.02, 0.6, 0xc9453d, x, h - 0.1, z, { seg: 4 });
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + 0.3;
    batch.box(0.04, 1.2, 0.8, 0xc9453d, x + Math.cos(a) * 1.0, 0, z + Math.sin(a) * 1.0, { ry: -a });
  }
}

/** Globe climbing frame: meridians and parallels of steel tube. */
function addGlobe(batch, x, z, color) {
  const r = 1.3, cy = 1.3;
  for (let m = 0; m < 8; m++) {
    const a = (m / 8) * Math.PI;
    let prev = null;
    for (let k = 0; k <= 12; k++) {
      const t = (k / 12) * Math.PI * 2;
      const p = [x + Math.cos(a) * Math.cos(t) * r, cy + Math.sin(t) * r, z + Math.sin(a) * Math.cos(t) * r];
      if (prev && p[1] > 0 && prev[1] > 0) batch.tube(prev[0], prev[1], prev[2], p[0], p[1], p[2], 0.022, color, { seg: 3, cast: false });
      prev = p;
    }
  }
  for (const lat of [-0.5, 0, 0.5, 0.9]) {
    const rr = Math.cos(lat) * r, y = cy + Math.sin(lat) * r;
    for (let i = 0; i < 14; i++) {
      const a0 = (i / 14) * Math.PI * 2, a1 = ((i + 1) / 14) * Math.PI * 2;
      batch.tube(x + Math.cos(a0) * rr, y, z + Math.sin(a0) * rr, x + Math.cos(a1) * rr, y, z + Math.sin(a1) * rr, 0.022, color, { seg: 3, cast: false });
    }
  }
}

/** Sandbox with wooden edges and a little mushroom sunshade. */
function addSandbox(ctx, x, z, facing) {
  const { batch } = ctx;
  const toW = frame(x, z, facing);
  const s = 3.2;
  groundOf(ctx).add(hQuad(x - s / 2 + 0.1, z - s / 2 + 0.1, x + s / 2 - 0.1, z + s / 2 - 0.1, 0.12, TILE.sand), { mat: SURF.sand, color: null, cast: false });
  for (const [a, b, w, d] of [[0, -s / 2, s, 0.12], [0, s / 2, s, 0.12], [-s / 2, 0, 0.12, s], [s / 2, 0, 0.12, s]]) {
    const [px, pz] = toW(a, b);
    batch.box(w, 0.28, d, 0x9a7650, px, 0, pz, { ry: facing });
  }
  const [mx, mz] = toW(s / 2 - 0.4, -s / 2 + 0.4);
  batch.cyl(0.06, 1.8, 0x9a7650, mx, 0, mz, { seg: 6 });
  batch.cyl(1.0, 0.5, 0xc9453d, mx, 1.8, mz, { rTop: 0.05, seg: 10 });
  // a forgotten spade
  batch.box(0.08, 0.02, 0.45, 0x3e6aa6, x + 0.3, 0.14, z - 0.2, { ry: 0.7 });
}

/**
 * The old Soviet playground: carousel (spins on E), swings (sit on one),
 * slide, a rocket and a globe to climb, a sandbox. `facing` turns the lot.
 */
export function addOldPlayground(ctx, x, z, facing = 0, seed = 3) {
  const { batch, colliders } = ctx;
  const rng = rngKit(seed);
  const toW = frame(x, z, facing);
  const paint = () => rng.pick([0x3e6aa6, 0xc9453d, 0xe2bd3f, 0x4f8a4a, 0xdc7a36]);

  // swings, a carousel, the slide, the climbers, the sandbox
  const [sx, sz] = toW(-5, -2);
  addSwing(ctx, sx, sz, facing + Math.PI / 2, paint());
  const [cx, cz] = toW(0, -3.5);
  addCarousel(ctx, cx, cz, paint());
  addSlide(batch, toW, 4.5, -2.5, facing, paint());
  colliders.box(...boxOf(toW, 4.5, -2.5, 1.0, 3.5));
  const [rx, rz] = toW(-4.5, 3.5);
  addRocket(batch, rx, rz, paint());
  colliders.circle(rx, rz, 1.0, { tag: 'rocket' });
  const [gx, gz] = toW(1.0, 3.5);
  addGlobe(batch, gx, gz, paint());
  colliders.circle(gx, gz, 1.35, { tag: 'globe' });
  const [bx, bz] = toW(5.5, 3.8);
  addSandbox(ctx, bx, bz, facing);
  // benches for the grandmothers
  for (const [ox, oz, f] of [[-8.5, 0, Math.PI / 2], [8.5, -1, -Math.PI / 2], [0, 7, 0]]) {
    const [px, pz] = toW(ox, oz);
    addBench(batch, px, pz, facing + f, { style: 'park', color: rng.pick([PAL.greenPaint, 0x8a5a3a, 0x3e6aa6]) });
    colliders.circle(px, pz, 0.7, { top: 0.5, tag: 'bench' });
  }
}

function boxOf(toW, lx, lz, w, d) {
  const a = toW(lx - w / 2, lz - d / 2), b = toW(lx + w / 2, lz + d / 2);
  return [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[0], b[0]), Math.max(a[1], b[1]), { tag: 'play' }];
}

/** New bright plastic playground of the late 2000s (c18). */
export function addPlasticPlayground(ctx, x, z, facing = 0, seed = 4) {
  const { batch, colliders } = ctx;
  const rng = rngKit(seed);
  const toW = frame(x, z, facing);
  const tower = (lx, lz, dome) => {
    const [tx, tz] = toW(lx, lz);
    for (const [ox, oz] of [[-0.7, -0.7], [0.7, -0.7], [-0.7, 0.7], [0.7, 0.7]]) {
      const [px, pz] = toW(lx + ox, lz + oz);
      batch.cyl(0.07, 2.6, 0xd9453a, px, 0, pz, { seg: 8 });
    }
    batch.box(1.6, 0.1, 1.6, 0xe8d6a8, tx, 1.2, tz, { ry: facing });
    for (const [ox, oz, w, d] of [[0, -0.78, 1.5, 0.06], [-0.78, 0, 0.06, 1.5]]) {
      const [px, pz] = toW(lx + ox, lz + oz);
      batch.box(w, 0.7, d, rng.pick([0x3e8ad6, 0xe2bd3f, 0x4fa04a]), px, 1.3, pz, { ry: facing });
    }
    batch.cyl(1.2, 0.9, dome, tx, 2.6, tz, { rTop: 0.15, seg: 8 });
    batch.cyl(0.08, 0.5, 0xe2bd3f, tx, 3.5, tz, { seg: 6 });
    colliders.box(...boxOf(toW, lx, lz, 1.7, 1.7));
  };
  tower(-2, 0, 0x7a3d9a);
  tower(2.2, 0.4, 0x3f9a4a);
  // bridge between the towers
  const [bx, bz] = toW(0.1, 0.2);
  batch.box(2.5, 0.08, 1.0, 0xe8d6a8, bx, 1.2, bz, { ry: facing });
  // tube slide: a spiral of short red segments
  const [ox0, oz0] = toW(3.2, 0.4);
  let prev = [ox0, 1.25, oz0];
  for (let i = 1; i <= 14; i++) {
    const a = i * 0.36;
    const [px, pz] = toW(3.2 + 1.2 * Math.sin(a), 0.4 + 1.2 * (1 - Math.cos(a)));
    const p = [px, 1.25 - i * 0.075, pz];
    batch.tube(prev[0], prev[1] + 0.35, prev[2], p[0], p[1] + 0.35, p[2], 0.36, 0x2f6fd0, { seg: 8 });
    prev = p;
  }
  // straight red slide
  const [sx, sz] = toW(-3.8, 0);
  batch.box(0.65, 0.05, 2.4, 0xd9453a, sx, 0.6, sz, { ry: facing - Math.PI / 2, rx: -0.45 });
  // play house and spring riders
  const [hx, hz] = toW(0, 3.6);
  batch.box(1.8, 1.3, 1.5, 0xe8d6a8, hx, 0, hz, { ry: facing });
  batch.box(2.0, 0.1, 1.7, 0x3e8ad6, hx, 1.3, hz, { ry: facing, rz: 0.3 });
  colliders.box(...boxOf(toW, 0, 3.6, 1.9, 1.6));
  for (const [lx, lz, c] of [[-3, 3.4, 0xe2bd3f], [3, 3.4, 0x4fa04a]]) {
    const [px, pz] = toW(lx, lz);
    batch.cyl(0.08, 0.4, 0x8a8a86, px, 0, pz, { seg: 6 });
    batch.box(0.35, 0.45, 0.8, c, px, 0.4, pz, { ry: facing });
    batch.cyl(0.18, 0.3, c, px, 0.8, pz, { seg: 8 });
  }
  // rubber-crumb pad
  const pad = boxOf(toW, 0, 1.5, 11, 8.5);
  ctx.batch.box(pad[2] - pad[0], 0.03, pad[3] - pad[1], 0x8a3a32, (pad[0] + pad[2]) / 2, -0.03, (pad[1] + pad[3]) / 2, { cast: false });
}

/* ---------------- the moving pieces ---------------- */

const PUMP = 2.2;   // rad/s² your legs add to the swing, in phase with it

/** A carousel: a disc with handle bars. E gives it a push. */
export function addCarousel(ctx, x, z, color) {
  const parts = [[placed(new THREE.CylinderGeometry(1.25, 1.25, 0.08, 18), 0, 0.46, 0), 0x9a9a96]];
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2;
    const cx = Math.cos(a) * 0.55, cz = Math.sin(a) * 0.55;
    parts.push([placed(new THREE.CylinderGeometry(0.03, 0.03, 0.6, 5), cx * 1.8, 0.8, cz * 1.8), color]);
    parts.push([placed(new THREE.CylinderGeometry(0.025, 0.025, 1.1, 5), cx, 1.1, cz, 0, -a, Math.PI / 2), color]);
  }
  const spin = coloured(parts);
  spin.position.set(x, 0, z);
  ctx.root.add(spin);
  ctx.batch.cyl(0.12, 0.42, PAL.metalDark, x, 0, z, { seg: 8, rTop: 0.1 });
  ctx.colliders.circle(x, z, 1.3, { top: 0.5, tag: 'carousel' });
  const st = { w: 0.25, t: 0 };
  ctx.update((dt, game) => {
    spin.rotation.y += st.w * dt;
    st.w = damp(st.w, 0.05, 0.25, dt);
    st.t -= dt * Math.abs(st.w);
    if (st.t <= 0 && Math.abs(st.w) > 0.6) { st.t = 1.6; game.audio.play('swing-creak', { pos: { x, y: 0.5, z }, volume: 0.6, rate: 0.8 }); }
  });
  ctx.interact({
    x, y: 0.8, z, w: 2.4, h: 1.2, d: 2.4,
    label: 'Give the carousel a push',
    action: (game) => {
      st.w = clamp(st.w + 2.4, 0, 6);
      game.audio.play('swing-creak', { pos: { x, y: 0.5, z }, rate: 0.7 });
    },
  });
}

/**
 * A-frame swing with two seats; sit on the left one with E. The seat you
 * sit on is a live pendulum: W pumps, S slows it, the mouse looks about.
 */
export function addSwing(ctx, x, z, facing, color) {
  const { batch, colliders } = ctx;
  const toW = frame(x, z, facing);
  const barY = 2.45, len = 2.05, span = 3.6;
  // frame: two inverted Vs and a top bar (the bar runs along local x)
  for (const sx of [-1, 1]) {
    const [tx, tz] = toW(sx * span / 2, 0);
    for (const sz of [-1, 1]) {
      const [fx, fz] = toW(sx * span / 2, sz * 1.0);
      batch.tube(fx, 0, fz, tx, barY, tz, 0.045, color, { seg: 5 });
    }
    colliders.circle(tx, tz, 0.2, { tag: 'swing' });
  }
  const [ax, az] = toW(-span / 2, 0), [bx, bz] = toW(span / 2, 0);
  batch.tube(ax, barY, az, bx, barY, bz, 0.05, color, { seg: 6 });

  const makeSeat = (lx) => {
    const [px, pz] = toW(lx, 0);
    const pivot = coloured([
      [placed(new THREE.CylinderGeometry(0.015, 0.015, len, 4), -0.22, -len / 2, 0), PAL.metalGrey],
      [placed(new THREE.CylinderGeometry(0.015, 0.015, len, 4), 0.22, -len / 2, 0), PAL.metalGrey],
      [placed(new THREE.BoxGeometry(0.55, 0.05, 0.3), 0, -len, 0), 0x8a5a3a],
    ]);
    pivot.position.set(px, barY, pz);
    // yaw first, then the swing about the bar
    pivot.rotation.order = 'YXZ';
    pivot.rotation.y = facing;
    ctx.root.add(pivot);
    return pivot;
  };
  // the other seat hangs still: it lives in the static batch
  for (const o of [-0.22, 0.22]) {
    const [rx, rz] = toW(0.8 + o, 0);
    batch.tube(rx, barY, rz, rx, barY - len, rz, 0.015, PAL.metalGrey, { seg: 4 });
  }
  const [ox, oz] = toW(0.8, 0);
  batch.box(0.55, 0.05, 0.3, 0x8a5a3a, ox, barY - len - 0.025, oz, { ry: facing });
  const mine = makeSeat(-0.8);
  const st = { a: 0, w: 0, lookYaw: 0, lookPitch: 0, sitting: false, creakT: 0 };
  const g = 9.81;
  const eye = new THREE.Vector3();

  ctx.update((dt) => {
    if (!st.sitting) {
      st.w += (-g / len * Math.sin(st.a) - st.w * 0.6) * dt;
      st.a += st.w * dt;
    }
    mine.rotation.x = st.a;
  });

  const controller = {
    name: 'swing',
    crosshair: false,
    get pos() { return mine.position; },
    get yaw() { return facing + st.lookYaw; },
    enter() { st.sitting = true; },
    exit() { st.sitting = false; },
    update(dt) {
      const game = ctx.game;
      const { fwd } = game.input.axes();
      // pump in phase with the motion, brake with S
      let acc = -g / len * Math.sin(st.a) - st.w * 0.08;
      if (fwd > 0) acc += Math.sign(st.w || 1) * PUMP * Math.cos(st.a);
      if (fwd < 0) acc -= st.w * 1.6;
      st.w += acc * dt;
      st.a = clamp(st.a + st.w * dt, -1.2, 1.2);
      if (Math.abs(st.a) >= 1.2) st.w *= -0.3;
      mine.rotation.x = st.a;
      st.creakT -= dt;
      if (st.creakT <= 0 && Math.abs(st.w) > 1.2) { st.creakT = Math.PI / Math.sqrt(g / len); game.audio.play('swing-creak', { pos: mine.position, volume: 0.8 }); }
      const { dx, dy } = game.input.takeLook();
      st.lookYaw = clamp(st.lookYaw - dx, -1.8, 1.8);
      st.lookPitch = clamp(st.lookPitch - dy, -1.0, 0.8);
      // eye: 0.75 m above the seat, swinging with it
      eye.set(0, -len + 0.72, 0.05).applyEuler(mine.rotation).add(mine.position);
      game.camera.position.copy(eye);
      game.camera.rotation.set(st.lookPitch + st.a * 0.55, facing + st.lookYaw, 0, 'YXZ');
    },
    onInteract() {
      const game = ctx.game;
      if (Math.abs(st.w) > 1.5) { game.hud.flash('Too fast to jump off! (S to slow down)'); return true; }
      const [ex, ez] = toW(-0.8, -1.4);
      game.player.placeAt(ex, ez, facing, 0);
      game.setController(null);
      return true;
    },
    prompt: () => 'W swing higher · S slow down · E get off',
  };

  const [hx, hz] = toW(-0.8, 0);
  ctx.interact({
    x: hx, y: 0.6, z: hz, w: 0.7, h: 0.9, d: 0.7,
    label: 'Sit on the swing',
    action: (game) => {
      st.lookYaw = 0;
      st.lookPitch = 0;
      game.setController(controller);
      game.hud.flash('качели: the chains creak', 1400);
    },
  });
}

/* ---------------- carpet frame ---------------- */

const CARPETS = 4;   // designs in the shared carpet sheet, side by side

/** One carpet design drawn at (0, 0) of a w x h area of `ctx`. */
function drawCarpet(ctx, w, h, seed) {
  const r = rngKit(seed);
  const base = r.pick(['#8a2027', '#6e1e2a', '#7a3a24', '#2d3e6e']);
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = '#e8d8b0';
  ctx.lineWidth = 6;
  ctx.strokeRect(14, 14, w - 28, h - 28);
  ctx.strokeStyle = '#1e2a4a';
  ctx.lineWidth = 10;
  ctx.strokeRect(30, 30, w - 60, h - 60);
  // central medallion and corner pieces, the carpet every flat had on the wall
  ctx.fillStyle = '#d8b060';
  ctx.beginPath();
  ctx.moveTo(w / 2, h * 0.25); ctx.lineTo(w * 0.78, h / 2); ctx.lineTo(w / 2, h * 0.75); ctx.lineTo(w * 0.22, h / 2); ctx.closePath();
  ctx.fill();
  ctx.fillStyle = base;
  ctx.beginPath();
  ctx.moveTo(w / 2, h * 0.32); ctx.lineTo(w * 0.7, h / 2); ctx.lineTo(w / 2, h * 0.68); ctx.lineTo(w * 0.3, h / 2); ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#e8d8b0';
  for (let i = 0; i < 40; i++) {
    const a = r.range(0, Math.PI * 2), d = r.range(10, 40);
    ctx.fillRect(w / 2 + Math.cos(a) * d, h / 2 + Math.sin(a) * d * 1.3, 4, 4);
  }
  for (const [cx, cy] of [[50, 50], [w - 50, 50], [50, h - 50], [w - 50, h - 50]]) {
    ctx.fillStyle = '#d8b060';
    ctx.beginPath(); ctx.arc(cx, cy, 12, 0, Math.PI * 2); ctx.fill();
  }
  // fringe
  ctx.fillStyle = '#e8e0c8';
  for (let x = 0; x < w; x += 4) { ctx.fillRect(x, 0, 2, 8); ctx.fillRect(x, h - 8, 2, 8); }
}

/** Every carpet in town shares one texture and so merges into the static batch. */
function carpetMaterial() {
  return cached('carpet-sheet', () => {
    const w = 256, h = 384;
    const tex = canvasTex(w * CARPETS, h, (ctx) => {
      for (let i = 0; i < CARPETS; i++) {
        ctx.save();
        ctx.translate(i * w, 0);
        ctx.beginPath(); ctx.rect(0, 0, w, h); ctx.clip();
        drawCarpet(ctx, w, h, 31 + i * 17);
        ctx.restore();
      }
    });
    return cel({ map: tex, bands: 3, grime: 0.04, dirt: 0, side: THREE.DoubleSide, cache: false });
  });
}

function puffTex() {
  return cached('dust-puff', () => canvasTex(64, 64, (ctx, w, h) => {
    const g = ctx.createRadialGradient(w / 2, h / 2, 2, w / 2, h / 2, w / 2);
    g.addColorStop(0, 'rgba(214,200,170,0.85)');
    g.addColorStop(0.6, 'rgba(214,200,170,0.35)');
    g.addColorStop(1, 'rgba(214,200,170,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }));
}

/**
 * Carpet-beating frame (выбивалка): two posts and a bar. With a carpet
 * over it, E gives it a whack and the dust flies.
 */
export function addCarpetFrame(ctx, x, z, facing = 0, { carpet = true, seed = 9 } = {}) {
  const { batch, colliders } = ctx;
  const toW = frame(x, z, facing);
  const w = 3.0, h = 2.0;
  for (const sx of [-1, 1]) {
    const [px, pz] = toW(sx * w / 2, 0);
    batch.cyl(0.045, h, PAL.metalDark, px, 0, pz, { seg: 6 });
    colliders.circle(px, pz, 0.08, { tag: 'carpet-frame' });
  }
  for (const y of [h, h - 0.55]) {
    const [ax, az] = toW(-w / 2, 0), [bx, bz] = toW(w / 2, 0);
    batch.tube(ax, y, az, bx, y, bz, 0.035, PAL.metalDark, { seg: 5 });
  }
  if (!carpet) return;
  const cw = 1.8, ch = 2.6;
  const geo = new THREE.PlaneGeometry(cw, ch, 1, 6);
  // drape over the bar: bend the plane into an inverted V
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i);
    const t = y / (ch / 2);
    p.setXYZ(i, p.getX(i), -Math.abs(y) * 0.72 + 0.02, Math.sign(y) * (0.06 + Math.abs(t) * 0.25));
  }
  // pick one design from the sheet
  const k = seed % CARPETS;
  const uv = geo.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setX(i, (k + uv.getX(i)) / CARPETS);
  geo.computeVertexNormals();
  geo.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(x, h, z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), facing), new THREE.Vector3(1, 1, 1)));
  batch.add(geo, { mat: carpetMaterial(), color: null, cast: false });
  const puffs = [];
  const pm = new THREE.SpriteMaterial({ map: puffTex(), transparent: true, depthWrite: false });
  for (let i = 0; i < 14; i++) {
    const s = new THREE.Sprite(pm.clone());
    s.visible = false;
    ctx.root.add(s);
    puffs.push({ s, t: 0, v: new THREE.Vector3() });
  }
  ctx.update((dt) => {
    for (const q of puffs) {
      if (!q.s.visible) continue;
      q.t += dt;
      q.s.position.addScaledVector(q.v, dt);
      q.v.multiplyScalar(1 - dt * 1.4);
      q.v.y += dt * 0.3;
      const k = q.t / 1.8;
      q.s.scale.setScalar(0.4 + k * 1.6);
      q.s.material.opacity = Math.max(0, 0.8 * (1 - k));
      if (k >= 1) q.s.visible = false;
    }
  });
  ctx.interact({
    x, y: h - 0.7, z, w: 2.0, h: 1.8, d: 1.0,
    label: 'Beat the carpet (выбивать ковёр)',
    action: (game) => {
      game.audio.play('thwack', { pos: { x, y: 1.5, z } });
      const cam = game.camera.position;
      const side = Math.sign((cam.x - x) * -Math.sin(facing) + (cam.z - z) * -Math.cos(facing)) || 1;
      let n = 0;
      for (const q of puffs) {
        if (q.s.visible || n > 6) continue;
        n++;
        q.s.visible = true;
        q.t = 0;
        const [ox, oz] = rotXZ((Math.random() - 0.5) * 1.6, -side * 0.35, facing);
        q.s.position.set(x + ox, h - 0.3 - Math.random() * 1.2, z + oz);
        const [vx, vz] = rotXZ((Math.random() - 0.5) * 0.6, -side * (0.6 + Math.random() * 0.8), facing);
        q.v.set(vx, 0.2 + Math.random() * 0.3, vz);
      }
    },
  });
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
  for (let i = 0; i < 9; i++) {
    const a = rng.range(0, Math.PI * 2), d = rng.range(0, r * 0.7);
    const c = rng.pick([0xd8453a, 0xf2e05a, 0xf0f0f0, 0xe07a3a, 0xc85aa0]);
    batch.cyl(0.14, 0.3, 0x5f8a3a, x + Math.cos(a) * d, 0, z + Math.sin(a) * d, { seg: 5, rTop: 0.18 });
    batch.cyl(0.12, 0.08, c, x + Math.cos(a) * d, 0.3, z + Math.sin(a) * d, { seg: 6 });
  }
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

/* ---------------- the cat ---------------- */

/**
 * A courtyard cat, sitting on a garage roof or a bench, looking about;
 * E makes it turn to you and meow.
 */
export function addCat(ctx, x, y, z, facing = 0, color = 0xd08a3a) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  g.rotation.y = facing;
  ctx.root.add(g);
  g.updateMatrixWorld();
  const cream = 0xf2e8d8;
  // the body never moves: it goes into the static batch
  const body = new THREE.SphereGeometry(0.16, 10, 8);
  body.scale(1, 1.15, 1.5);
  body.translate(0, 0.17, 0.05);
  ctx.batch.add(body.applyMatrix4(g.matrixWorld), { color });
  ctx.batch.add(placed(new THREE.SphereGeometry(0.1, 8, 6), 0, 0.2, -0.12).applyMatrix4(g.matrixWorld), { color: cream });
  // head and tail turn, each one mesh
  const skull = new THREE.SphereGeometry(0.1, 10, 8);
  skull.scale(1.1, 0.95, 1);
  const headParts = [[skull, color], [placed(new THREE.SphereGeometry(0.04, 6, 4), 0, -0.025, -0.085), cream]];
  for (const s of [-1, 1]) {
    headParts.push([placed(new THREE.ConeGeometry(0.035, 0.08, 4), s * 0.055, 0.09, 0, 0, 0, -s * 0.25), color]);
    headParts.push([placed(new THREE.SphereGeometry(0.014, 6, 4), s * 0.04, 0.02, -0.09), 0x9ab83a]);
  }
  const headG = coloured(headParts);
  headG.position.set(0, 0.38, -0.14);
  // the tail curls round the paws, still
  ctx.batch.add(placed(new THREE.CylinderGeometry(0.022, 0.03, 0.34, 5), 0.12, 0.04, 0.12, Math.PI / 2, 0.9, 0).applyMatrix4(g.matrixWorld), { color });
  g.add(headG);
  const st = { look: 0, t: 0, meowT: 0 };
  const tmp = new THREE.Vector3();
  ctx.update((dt, game) => {
    st.t += dt;
    st.meowT -= dt;
    let target = Math.sin(st.t * 0.21) * 0.4;
    if (st.meowT > 0) {
      // turn the head toward the camera
      tmp.copy(game.camera.position).sub(g.position);
      const a = Math.atan2(-tmp.x, -tmp.z) - facing;
      target = clamp(Math.atan2(Math.sin(a), Math.cos(a)), -1.2, 1.2);
    }
    st.look = damp(st.look, target, 4, dt);
    headG.rotation.y = st.look;
    headG.rotation.x = st.meowT > 0 ? -0.2 : 0.05;
  });
  ctx.colliders.circle(x, z, 0.25, { top: y + 0.3, bottom: y - 0.1, tag: 'cat' });
  ctx.interact({
    x, y: y + 0.25, z, w: 0.6, h: 0.6, d: 0.7,
    label: 'Pet the cat (кис-кис)',
    action: (game) => {
      st.meowT = 2.5;
      game.audio.play('meow', { pos: { x, y: y + 0.3, z } });
      game.hud.flash('мяу');
    },
  });
}
