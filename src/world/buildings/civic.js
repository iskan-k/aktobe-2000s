import * as THREE from 'three';
import { PAL } from '../../core/palette.js';
import { rngKit, rotXZ } from '../../core/util.js';
import { flagTex } from '../../core/textures.js';
import { SURF, TILE, worldUV } from '../../core/surfaces.js';
import { cel } from '../../core/toon.js';
import { QuadSet } from './panel.js';
import { wallMaterial, windowAtlas, cellUV, pickCell, WIN } from './facades.js';
import { placeSign } from './signs.js';

/* ------------------------------------------------------------------ *
 * Public buildings: schools, kindergartens, shops.
 *
 * `hall(ctx, spec)` is a plain Soviet box: brick or stucco walls, rows
 * of windows on the long sides, white belts between the storeys, a flat
 * roof with a parapet. Schools and kindergartens are put together from
 * a few halls plus a porch, a sign and a flagpole.
 * ------------------------------------------------------------------ */

const _up = new THREE.Vector3(0, 1, 0);
const _one = new THREE.Vector3(1, 1, 1);
const WHITE = 0xf0ece4;

/**
 * @param {object} spec
 *   x, z, facing        centre and yaw; the front (local -z) faces `facing`
 *   L, D                length along local x, depth along local z
 *   storeys, storeyH    storey count and height (m)
 *   wall                WALLS key
 *   cells               window atlas range, e.g. WIN.school
 *   winW, winH, sill    window size and sill height above each floor
 *   bay                 window spacing
 *   belts               white belts at each floor line
 *   ends                windows on the end walls too
 *   skip(side, lx, k)   return true to leave a window out
 *   plinthH, roof
 * @returns {{ toW, box, rect, matrix, H, length, depth, facing }}
 */
export function hall(ctx, spec) {
  const {
    x, z, facing = 0, L, D, storeys = 2, storeyH = 3.3, wall = 'redBrick', cells = WIN.school,
    winW = 2.6, winH = 1.9, sill = 0.9, bay = 3.6, belts = true, ends = false,
    skip = () => false, plinthH = 0.6, roof = 0x5a5652, seed = 1,
  } = spec;
  const { batch, colliders } = ctx;
  const rng = rngKit(seed);
  const matrix = new THREE.Matrix4().compose(new THREE.Vector3(x, 0, z), new THREE.Quaternion().setFromAxisAngle(_up, facing), _one);
  const toW = (lx, lz) => { const [a, b] = rotXZ(lx, lz, facing); return [x + a, z + b]; };
  const box = (w, h, d, color, lx, ly, lz, o = {}) => {
    const [wx, wz] = toW(lx, lz);
    batch.box(w, h, d, color, wx, ly, wz, { ...o, ry: facing + (o.ry || 0) });
  };
  const rect = (lx0, lz0, lx1, lz1) => {
    const a = toW(lx0, lz0), b = toW(lx1, lz1);
    return [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[0], b[0]), Math.max(a[1], b[1])];
  };
  const H = plinthH + storeys * storeyH;
  const quads = new QuadSet();
  const wmat = wallMaterial(wall);
  const atlas = windowAtlas();
  for (const side of [-1, 1]) {
    quads.wall(wmat, [0, H / 2, side * D / 2], side < 0 ? '-z' : '+z', L, H, 0, 0);
    quads.wall(wmat, [side * L / 2, H / 2, 0], side < 0 ? '-x' : '+x', D, H, 0, 0);
  }
  const n = Math.max(1, Math.floor((L - 1) / bay));
  const b = L / n;
  for (let k = 0; k < storeys; k++) {
    const cy = plinthH + k * storeyH + sill + winH / 2;
    for (const side of [-1, 1]) {
      for (let i = 0; i < n; i++) {
        const lx = -L / 2 + (i + 0.5) * b;
        if (skip(side, lx, k)) continue;
        quads.quad(atlas, [lx, cy, side * (D / 2 + 0.012)], side < 0 ? '-z' : '+z', winW, winH, cellUV(pickCell(rng, cells)));
        box(winW + 0.2, 0.07, 0.14, WHITE, lx, cy - winH / 2 - 0.07, side * (D / 2 + 0.07));
      }
    }
    if (ends) {
      const m = Math.max(1, Math.floor((D - 2) / bay));
      for (const sx of [-1, 1]) {
        for (let i = 0; i < m; i++) {
          const lz = -D / 2 + ((i + 0.5) * D) / m;
          quads.quad(atlas, [sx * (L / 2 + 0.012), cy, lz], sx < 0 ? '-x' : '+x', Math.min(winW, 1.6), winH, cellUV(pickCell(rng, cells)));
        }
      }
    }
    if (belts && k > 0) box(L + 0.1, 0.32, D + 0.1, WHITE, 0, plinthH + k * storeyH - 0.16, 0);
  }
  quads.flush(batch, matrix);
  box(L + 0.12, plinthH, D + 0.12, PAL.concreteDark, 0, 0, 0);
  box(L, 0.12, D, roof, 0, H, 0);
  for (const side of [-1, 1]) {
    box(L + 0.2, 0.55, 0.3, WHITE, 0, H, side * (D / 2 - 0.05));
    box(0.3, 0.55, D + 0.2, WHITE, side * (L / 2 - 0.05), H, 0);
  }
  // drainpipes at the corners
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const [px, pz] = toW(sx * (L / 2 - 0.3), sz * (D / 2 + 0.1));
      batch.cyl(0.07, H - 0.3, PAL.metalGrey, px, 0.3, pz, { seg: 6 });
    }
  }
  colliders.box(...rect(-L / 2 - 0.1, -D / 2 - 0.1, L / 2 + 0.1, D / 2 + 0.1), { tag: 'building' });
  return { toW, box, rect, matrix, H, length: L, depth: D, facing };
}

/** A fascia sign in front of local (lx, y, lz) of a hall, facing out of its front. */
export function fascia(ctx, h, lx, y, lz, w, ht, tex, sheet = null) {
  const [sx, sz] = h.toW(lx, lz);
  return placeSign(ctx, sheet, tex, w, ht, sx, y, sz, h.facing + Math.PI);
}

/**
 * The entrance porch: a glazed vestibule, a flat canopy on round
 * columns, three steps, and a sign board over the canopy.
 */
export function porch(ctx, h, lx, { w = 8, d = 3.2, height = 3.4, sign = null, signW = 7, stepsY = 0.45, sheet = null } = {}) {
  const { batch, colliders, ground } = ctx;
  const D2 = h.depth / 2;
  h.box(w, height, d, WHITE, lx, 0, -D2 - d / 2);
  h.box(w - 1.2, 2.3, 0.05, 0x5b7389, lx, 0.5, -D2 - d - 0.01, { mat: 'glass' });
  for (let i = 0; i <= 4; i++) h.box(0.08, 2.3, 0.08, 0xe8e4da, lx - (w - 1.2) / 2 + (i * (w - 1.2)) / 4, 0.5, -D2 - d - 0.03);
  h.box(2.0, 2.2, 0.06, 0x6b4a34, lx, 0.5, -D2 - d - 0.03);
  // canopy on columns
  const cd = 3.2;
  h.box(w + 2, 0.3, cd, WHITE, lx, height - 0.1, -D2 - d - cd / 2);
  for (const sx of [-1, 1]) {
    const [cx, cz] = h.toW(lx + sx * (w / 2 + 0.6), -D2 - d - cd + 0.3);
    batch.cyl(0.18, height - 0.1, WHITE, cx, 0, cz, { seg: 10 });
    colliders.circle(cx, cz, 0.22, { tag: 'column' });
  }
  // steps
  for (let i = 0; i < 3; i++) h.box(w + 1.5, stepsY * (3 - i) / 3, cd - i * 0.45, PAL.concrete, lx, 0, -D2 - d - cd / 2 + i * 0.22);
  const r = h.rect(lx - w / 2 - 0.75, -D2 - d - cd, lx + w / 2 + 0.75, -D2 - d);
  ground.flat(r[0], r[1], r[2], r[3], stepsY);
  colliders.box(...h.rect(lx - w / 2, -D2 - d, lx + w / 2, -D2), { tag: 'building' });
  if (sign) fascia(ctx, h, lx, height + 0.75, -D2 - d - cd + 0.02, signW, 1.1, sign, sheet);
}

/** A flagpole with the flag of Kazakhstan, stirring a little in the wind. */
export function flagpole(ctx, x, z, h = 9) {
  const { batch, colliders, root } = ctx;
  batch.cyl(0.6, 0.35, PAL.concrete, x, 0, z, { seg: 8 });
  batch.cyl(0.07, h, 0xe8e4da, x, 0.35, z, { seg: 8, rTop: 0.04 });
  batch.cyl(0.1, 0.12, 0xd8b040, x, h + 0.35, z, { seg: 8 });
  colliders.circle(x, z, 0.6, { top: 0.35, tag: 'flag' });
  const geo = new THREE.PlaneGeometry(2.4, 1.2, 8, 1);
  geo.translate(1.2, 0, 0);
  const base = Float32Array.from(geo.attributes.position.array);
  const flag = new THREE.Mesh(geo, cel({ map: flagTex(), bands: 3, grime: 0, dirt: 0, side: THREE.DoubleSide, cache: false }));
  flag.position.set(x + 0.06, h - 0.35, z);
  flag.rotation.y = 0.6;
  root.add(flag);
  const p = geo.attributes.position;
  ctx.update((dt, game) => {
    const t = game.time;
    for (let i = 0; i < p.count; i++) {
      const u = base[i * 3] / 2.4;
      p.setZ(i, Math.sin(t * 3 + u * 5) * 0.12 * u);
    }
    p.needsUpdate = true;
  });
}

/**
 * A stadium-shaped running track (two straights and two bends) with a
 * grass field inside. Long axis along world x. Returns its radii.
 */
export function runningTrack(ctx, cx, cz, { R = 16, lanes = 4, laneW = 1.0, straight = 14 } = {}) {
  const batch = ctx.groundBatch || ctx.batch;
  const ri = R - lanes * laneW;
  const stadium = (r, path) => {
    path.moveTo(-straight / 2, -r);
    path.lineTo(straight / 2, -r);
    path.absarc(straight / 2, 0, r, -Math.PI / 2, Math.PI / 2, false);
    path.lineTo(-straight / 2, r);
    path.absarc(-straight / 2, 0, r, Math.PI / 2, Math.PI * 1.5, false);
    return path;
  };
  const flatShape = (rOut, rIn, color, y) => {
    const s = stadium(rOut, new THREE.Shape());
    if (rIn > 0) s.holes.push(stadium(rIn, new THREE.Path()));
    const g = new THREE.ShapeGeometry(s, 16);
    g.rotateX(Math.PI / 2);
    g.translate(cx, y, cz);
    // ShapeGeometry faces +z; after the turn it faces down, so flip it
    const idx = g.index.array;
    for (let i = 0; i < idx.length; i += 3) { const t = idx[i + 1]; idx[i + 1] = idx[i + 2]; idx[i + 2] = t; }
    g.computeVertexNormals();
    batch.add(g, { color, cast: false });
  };
  flatShape(R, ri, 0x9a4a3a, -0.01);
  // the grass field inside the track
  const field = new THREE.ShapeGeometry(stadium(ri, new THREE.Shape()), 16);
  field.rotateX(Math.PI / 2);
  field.translate(cx, -0.012, cz);
  const fi = field.index.array;
  for (let i = 0; i < fi.length; i += 3) { const t = fi[i + 1]; fi[i + 1] = fi[i + 2]; fi[i + 2] = t; }
  field.computeVertexNormals();
  batch.add(worldUV(field, TILE.grass), { mat: SURF.grass, color: null, cast: false });
  for (let i = 1; i < lanes; i++) flatShape(R - i * laneW + 0.03, R - i * laneW - 0.03, 0xe8e4da, -0.005);
  flatShape(R + 0.06, R - 0.02, 0xe8e4da, -0.005);
  flatShape(ri + 0.03, ri - 0.05, 0xe8e4da, -0.005);
  return { ri, R, halfLen: straight / 2 + ri };
}

/** Football goal: white posts and bar, a sagging net of dark lines. Faces +x when `dir` = 1. */
export function goal(ctx, x, z, dir = 1, { w = 5, h = 2 } = {}) {
  const { batch, colliders } = ctx;
  for (const s of [-1, 1]) {
    batch.cyl(0.06, h, WHITE, x, 0, z + s * w / 2, { seg: 6 });
    batch.tube(x, h, z + s * w / 2, x - dir * 1.2, 0, z + s * w / 2, 0.02, 0x3a3a3a, { seg: 3, cast: false });
    colliders.circle(x, z + s * w / 2, 0.1, { tag: 'goal' });
  }
  batch.tube(x, h, z - w / 2, x, h, z + w / 2, 0.06, WHITE, { seg: 6 });
  batch.tube(x - dir * 1.2, 0.02, z - w / 2, x - dir * 1.2, 0.02, z + w / 2, 0.02, 0x3a3a3a, { seg: 3, cast: false });
  for (let t = -w / 2 + 0.5; t < w / 2; t += 0.5) {
    batch.tube(x, h, z + t, x - dir * 1.2, 0.02, z + t, 0.008, 0x4a4a4a, { seg: 3, cast: false });
  }
}

/** Pull-up bars and parallel bars, the physical education corner. */
export function gymBars(ctx, x, z, facing = 0) {
  const { batch, colliders } = ctx;
  const toW = (lx, lz) => { const [a, b] = rotXZ(lx, lz, facing); return [x + a, z + b]; };
  const heights = [1.4, 2.0, 2.5];
  for (let i = 0; i < 3; i++) {
    const [ax, az] = toW(i * 1.6, 0), [bx, bz] = toW(i * 1.6 + 1.6, 0);
    batch.tube(ax, 0, az, ax, heights[i], az, 0.05, 0x3e6aa6, { seg: 5 });
    batch.tube(ax, heights[i], az, bx, heights[i], bz, 0.025, PAL.metalGrey, { seg: 4 });
    colliders.circle(ax, az, 0.1, { tag: 'bars' });
  }
  const [ex, ez] = toW(4.8, 0);
  batch.tube(ex, 0, ez, ex, 2.5, ez, 0.05, 0x3e6aa6, { seg: 5 });
  for (const o of [-0.25, 0.25]) {
    const [ax, az] = toW(7, o), [bx, bz] = toW(9.5, o);
    batch.tube(ax, 1.3, az, bx, 1.3, bz, 0.03, PAL.metalGrey, { seg: 4 });
    for (const [px, pz] of [[ax, az], [bx, bz]]) batch.tube(px, 0, pz, px, 1.3, pz, 0.04, 0x3e6aa6, { seg: 5 });
  }
}

/** A kindergarten veranda: a painted shelter with a low back wall and a bench. */
export function veranda(ctx, x, z, facing, color = 0x3e8a5a) {
  const { batch, colliders } = ctx;
  const toW = (lx, lz) => { const [a, b] = rotXZ(lx, lz, facing); return [x + a, z + b]; };
  const w = 6, d = 3.5, h = 2.6;
  batch.box(w, 0.12, d, PAL.concrete, x, 0, z, { ry: facing });
  for (const [lx, lz] of [[-w / 2 + 0.1, -d / 2 + 0.1], [w / 2 - 0.1, -d / 2 + 0.1]]) {
    const [px, pz] = toW(lx, lz);
    batch.box(0.12, h, 0.12, WHITE, px, 0.12, pz, { ry: facing });
  }
  const [bx, bz] = toW(0, d / 2 - 0.06);
  batch.box(w, h, 0.12, color, bx, 0.12, bz, { ry: facing });
  for (const s of [-1, 1]) {
    const [sx, sz] = toW(s * (w / 2 - 0.06), 0.4);
    batch.box(0.12, 1.1, d - 0.8, color, sx, 0.12, sz, { ry: facing });
  }
  batch.box(w + 0.4, 0.14, d + 0.5, 0xe8e4da, x, h + 0.12, z, { ry: facing, rx: -0.06 });
  const [cx, cz] = toW(0, d / 2 - 0.45);
  batch.box(w - 0.6, 0.35, 0.4, 0x8a5a3a, cx, 0.12, cz, { ry: facing });
  const a = toW(-w / 2, -d / 2), b2 = toW(w / 2, d / 2);
  colliders.box(Math.min(a[0], b2[0]), Math.min(a[1], b2[1]), Math.max(a[0], b2[0]), Math.max(a[1], b2[1]), { top: 0.5, tag: 'veranda' });
  // posts and walls actually stop you
  const [p0x, p0z] = toW(0, d / 2);
  colliders.obb(p0x, p0z, w / 2, 0.1, facing + Math.PI / 2, { tag: 'veranda' });
}

/** A child-size wooden play house with a gable roof. */
export function playHouse(ctx, x, z, facing, seed = 1) {
  const { batch, colliders } = ctx;
  const rng = rngKit(seed);
  const c = rng.pick([0xe2bd3f, 0xd9453a, 0x3e8ad6, 0x4fa04a]);
  batch.box(1.6, 1.2, 1.4, c, x, 0, z, { ry: facing });
  for (const s of [-1, 1]) {
    const [ox, oz] = rotXZ(s * 0.42, 0, facing);
    batch.box(1.05, 0.06, 1.6, 0xd9453a, x + ox, 1.42, z + oz, { ry: facing, rz: -s * 0.6 });
  }
  const [dx, dz] = rotXZ(0, -0.71, facing);
  batch.box(0.5, 0.8, 0.02, 0x2a2826, x + dx, 0.05, z + dz, { ry: facing });
  colliders.circle(x, z, 0.9, { tag: 'playhouse' });
}

export { WHITE };
