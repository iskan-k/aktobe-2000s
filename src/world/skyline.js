import * as THREE from 'three';
import { cel } from '../core/toon.js';
import { canvasTex, cached } from '../core/textures.js';
import { rngKit } from '../core/util.js';
import { BOUNDS, RAIL, onStreet } from './plan.js';
import { tboxGeo, mtx } from './buildings/houseKit.js';

/* ------------------------------------------------------------------ *
 * The rest of Aktobe, seen from the neighbourhood: microdistricts of
 * 5-, 9- and 12-storey blocks in rings from about 260 to 700 m, low
 * private-sector roofs and trees to the west and east, the 192 m TV
 * tower to the north-west, factory chimneys and a water tower to the
 * north-east. To the south there is only steppe (see edgesSouth.js).
 *
 * Everything is cheap: boxes with one tiled window texture, blobs for
 * trees, no shadows, fog on. It all goes into the `far` batch, which
 * has one huge cell, so the whole skyline is a handful of draw calls.
 * ------------------------------------------------------------------ */

const STOREY = 2.8;
const MARGIN = 34;                   // keep clear of the playable area
const RING = [262, 720];
const PANELS = [0xe8dcc0, 0xdcdcd4, 0xe8d8a8, 0xe2cbb8, 0xcfd8dc, 0xd8d0c0, 0xeae6da];
const ROOFS = [0x8a8c8a, 0x9a4a3a, 0x4e7a5a, 0x2b55a0, 0xa8aaa8, 0x7a6a5a];
const TREES = [0x5f7f3a, 0x4f7034, 0x6a8a42, 0x587a38];

/** One window bay, greyscale so the vertex colour tints the panels. */
function facadeTex() {
  return cached('skyline-facade', () => canvasTex(64, 64, (ctx, w, h) => {
    ctx.fillStyle = '#ececec';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#d0d0d0';
    ctx.fillRect(0, h - 5, w, 5);
    ctx.fillStyle = '#4a525c';
    ctx.fillRect(w * 0.26, h * 0.22, w * 0.48, h * 0.46);
    ctx.fillStyle = '#6a7684';
    ctx.fillRect(w * 0.26, h * 0.22, w * 0.48, h * 0.1);
  }, { repeat: [1, 1] }));
}

let facadeMat = null;
const facade = () => {
  if (!facadeMat) facadeMat = cel({ map: facadeTex(), vertexColors: true, cache: false, grime: 0, dirt: 0, bands: 3 });
  return facadeMat;
};

function clearOfTown(x, z, pad = 0) {
  if (x > BOUNDS.x0 - MARGIN - pad && x < BOUNDS.x1 + MARGIN + pad && z > BOUNDS.z0 - MARGIN - pad && z < BOUNDS.z1 + MARGIN + pad) return false;
  if (z > RAIL.corridor[0] - 16 - pad && z < RAIL.corridor[1] + 12 + pad) return false;
  if (onStreet(x, z, 9 + pad)) return false;
  return true;
}

/** A panel block: w along its own x, d deep, `floors` storeys, yawed ry. */
function block(batch, x, z, w, d, floors, ry, color) {
  const h = floors * STOREY + 0.6;
  const g = tboxGeo(w, h, d, [3.2, STOREY]);
  batch.add(g, { mat: facade(), color, matrix: mtx(x, 0, z, ry), cast: false, receive: false });
  batch.box(w + 0.3, 0.5, d + 0.3, 0x8a8a86, x, h, z, { ry, cast: false, receive: false });
  // lift machine rooms, one per stair section
  const n = Math.max(1, Math.round(w / 18));
  const c = Math.cos(ry), s = Math.sin(ry);
  for (let i = 0; i < n; i++) {
    const lx = -w / 2 + (i + 0.5) * (w / n);
    batch.box(3.2, 2.2, 4, color, x + lx * c, h + 0.5, z - lx * s, { ry, cast: false, receive: false });
  }
}

function fits(x, z, w, d, ry) {
  const c = Math.cos(ry), s = Math.sin(ry);
  for (const [lx, lz] of [[-w / 2, -d / 2], [w / 2, -d / 2], [-w / 2, d / 2], [w / 2, d / 2], [0, 0]]) {
    if (!clearOfTown(x + lx * c + lz * s, z - lx * s + lz * c)) return false;
  }
  return true;
}

function treeBlob(batch, x, z, rng, scale = 1) {
  const r = rng.range(2.6, 4.2) * scale;
  const g = new THREE.IcosahedronGeometry(r, 0);
  g.scale(1, rng.range(1.0, 1.5), 1);
  g.translate(x, r * 0.9 + 1.5 * scale, z);
  batch.add(g, { color: rng.pick(TREES), mat: 'foliage', cast: false, receive: false });
}

/**
 * A microdistrict: rows of blocks on a local grid turned by `ry`, with
 * trees in the yards between them. Taller blocks further out.
 */
function microdistrict(batch, cx, cz, ry, rng, dist) {
  const outer = dist > 440;
  const cols = rng.int(2, 3), rows = rng.int(2, 4);
  const c = Math.cos(ry), s = Math.sin(ry);
  const put = (lx, lz) => [cx + lx * c + lz * s, cz - lx * s + lz * c];
  let count = 0;
  for (let i = 0; i < cols; i++) {
    for (let j = 0; j < rows; j++) {
      const lx = (i - (cols - 1) / 2) * 92 + rng.range(-6, 6);
      const lz = (j - (rows - 1) / 2) * 44 + rng.range(-4, 4);
      const [x, z] = put(lx, lz);
      const r = rng.next();
      let floors, w, d, yaw = ry;
      if (r < 0.14) { floors = outer ? 16 : 12; w = 20; d = 18; }                 // point block
      else if (r < 0.22) { floors = 3; w = 60; d = 20; }                           // a school
      else { floors = outer ? rng.pick([9, 9, 12, 5]) : rng.pick([5, 5, 9, 9]); w = rng.pick([48, 64, 80, 96]); d = 12; }
      if (rng.chance(0.25) && floors < 12) yaw += Math.PI / 2;                      // an L of blocks
      if (!fits(x, z, w, d, yaw)) continue;
      block(batch, x, z, w, d, floors, yaw, rng.pick(PANELS));
      count++;
      // yard trees on the sunny side
      for (let k = 0; k < 5; k++) {
        const [tx, tz] = put(lx + rng.range(-w / 2, w / 2), lz + rng.range(10, 18));
        if (clearOfTown(tx, tz, -4)) treeBlob(batch, tx, tz, rng);
      }
    }
  }
  return count;
}

/** Low roofs among fruit trees: the private sector seen from afar. */
function lowHouses(batch, x0, z0, x1, z1, rng) {
  for (let x = x0; x < x1; x += 16) {
    for (let z = z0; z < z1; z += 20) {
      const hx = x + rng.range(-3, 3), hz = z + rng.range(-3, 3);
      if (!clearOfTown(hx, hz)) continue;
      if (rng.chance(0.15)) continue;
      const ry = rng.chance(0.5) ? 0 : Math.PI / 2;
      const w = rng.range(8, 11), d = rng.range(7, 9);
      batch.box(w, 3.2, d, rng.pick([0xe8e2d4, 0xd8e0c8, 0xe0d4b8, 0xb86a50]), hx, 0, hz, { ry, cast: false, receive: false });
      // a gable roof: a triangular prism along the house, ridge up
      const r = (d + 0.6) / Math.sqrt(3);
      const roof = new THREE.CylinderGeometry(r, r, w + 0.6, 3, 1);
      roof.rotateZ(Math.PI / 2);
      roof.rotateX(-Math.PI / 2);
      roof.scale(1, 0.55, 1);
      roof.translate(0, 3.2 + 0.275 * r, 0);
      batch.add(roof, { color: rng.pick(ROOFS), matrix: mtx(hx, 0, hz, ry), cast: false, receive: false });
      if (rng.chance(0.7)) treeBlob(batch, hx + rng.range(-8, 8), hz + rng.range(6, 9), rng, 0.8);
    }
  }
}

/* ------------------------------------------------------------------ landmarks */

/** The TV tower: a tapered lattice of four legs, platforms, and a mast on top. */
function tvTower(batch, x, z) {
  const col = 0x6a3a2e, H = 150, TOP = 192;
  const at = (y) => 11 - 9.5 * (y / H);
  const corners = [[1, 1], [1, -1], [-1, -1], [-1, 1]];
  for (const [sx, sz] of corners) batch.tube(x + sx * at(0), 0, z + sz * at(0), x + sx * at(H), H, z + sz * at(H), 0.9, col, { seg: 4, cast: false });
  for (let y = 0; y < H; y += 12) {
    const y1 = Math.min(H, y + 12), a = at(y), b = at(y1);
    for (let f = 0; f < 4; f++) {
      const [ax, az] = corners[f], [bx, bz] = corners[(f + 1) % 4];
      batch.tube(x + ax * a, y, z + az * a, x + bx * b, y1, z + bz * b, 0.45, col, { seg: 3, cast: false });
      batch.tube(x + bx * a, y, z + bz * a, x + ax * b, y1, z + az * b, 0.45, col, { seg: 3, cast: false });
    }
  }
  for (const y of [62, 104, 146]) batch.box(at(y) * 2 + 4, 1.4, at(y) * 2 + 4, 0x7a4a3a, x, y, z, { cast: false, receive: false });
  batch.cyl(0.8, TOP - H, col, x, H, z, { rTop: 0.35, seg: 6, cast: false });
  for (const y of [63.5, 105.5, 147.5, TOP - 0.5]) batch.box(1.2, 1.2, 1.2, 0xff3a2a, x, y, z, { mat: 'glow', cast: false });
}

function chimney(batch, x, z, h, r) {
  batch.cyl(r, h * 0.8, 0xb8a898, x, 0, z, { rTop: r * 0.78, seg: 12, cast: false, receive: false });
  const bands = 4, bh = (h * 0.2) / bands;
  for (let i = 0; i < bands; i++) {
    const r0 = r * (0.78 - 0.1 * (i / bands)), r1 = r * (0.78 - 0.1 * ((i + 1) / bands));
    batch.cyl(r0, bh, i % 2 ? 0xf2efe6 : 0xc8322a, x, h * 0.8 + i * bh, z, { rTop: r1, seg: 12, cast: false, receive: false });
  }
}

function factory(batch, rng) {
  // the plant: long halls, a boiler house, three chimneys
  const halls = [[420, -330, 110, 36, 16], [430, -380, 80, 30, 12], [360, -350, 50, 40, 20], [470, -290, 60, 26, 10]];
  for (const [x, z, w, d, h] of halls) {
    batch.box(w, h, d, rng.pick([0xa8aaa6, 0xb8b2a4, 0x9a9c98]), x, 0, z, { cast: false, receive: false });
    for (let i = 0; i < Math.floor(w / 12); i++) {
      batch.box(10, 1.8, d + 0.2, 0x7a7c7a, x - w / 2 + 6 + i * 12, h, z, { rz: 0.25, cast: false, receive: false });
    }
  }
  chimney(batch, 385, -372, 92, 3.4);
  chimney(batch, 405, -372, 80, 3.0);
  chimney(batch, 468, -345, 60, 2.4);
  // the water tower: a concrete shaft and a tank with a conical roof
  const wx = 330, wz = -300;
  batch.cyl(3, 30, 0xc8c2b4, wx, 0, wz, { seg: 10, cast: false, receive: false });
  batch.cyl(8, 9, 0xd8d4ca, wx, 30, wz, { rTop: 8.5, seg: 14, cast: false, receive: false });
  batch.cyl(8.8, 3.5, 0x8a8c8a, wx, 39, wz, { rTop: 0.5, seg: 14, cast: false, receive: false });
}

/* ------------------------------------------------------------------ build */

/**
 * Add the skyline to `batch` (the far batch). Returns a rough count of
 * buildings, for the stats line.
 */
export function buildSkyline(batch) {
  const rng = rngKit(1869);
  let n = 0;
  const STEP = 115;
  for (let gx = -RING[1]; gx <= RING[1]; gx += STEP) {
    for (let gz = -RING[1]; gz <= 200; gz += STEP) {
      const x = gx + rng.range(-25, 25), z = gz + rng.range(-25, 25);
      const d = Math.hypot(x, z);
      if (d < RING[0] || d > RING[1]) continue;
      // steppe to the south, factory ground to the north-east, the TV tower's field to the north-west
      if (z > 170) continue;
      if (x > 300 && x < 520 && z > -420 && z < -250) continue;
      if (x > -380 && x < -260 && z > -440 && z < -320) continue;
      // private sector to the west and east, microdistricts elsewhere
      if (Math.abs(x) > 280 && z > -140 && z < 150 && rng.chance(0.55)) {
        lowHouses(batch, x - 50, z - 50, x + 50, z + 50, rng);
        continue;
      }
      if (rng.chance(0.12)) continue;
      n += microdistrict(batch, x, z, rng.pick([0, 0, 0.12, -0.1, Math.PI / 2]), rng, d);
    }
  }
  tvTower(batch, -320, -380);
  factory(batch, rng);
  return n;
}
