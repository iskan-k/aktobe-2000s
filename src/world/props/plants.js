import * as THREE from 'three';
import { PAL } from '../../core/palette.js';
import { rngKit } from '../../core/util.js';
import { coreBlob, leafCards, foliageCore, foliageCard } from './foliage.js';
import { canopy, shade } from './trees.js';

/* ------------------------------------------------------------------ *
 * Low plants and far trees, in the same two-layer style as trees.js
 * (core blobs wrapped in leaf cards), so the whole town has one look:
 *
 *   farTree     the skyline's trees: a core blob only, shaded exactly
 *               like a near tree once its cards have faded, so nothing
 *               changes colour where the town hands over to the backdrop
 *   addWeeds    a clump on waste ground: silver wormwood (полынь),
 *               burdock (лопух), dry grass with a seed stalk or two
 *   addCropRow  a row in a private-sector garden: potatoes, tomatoes
 *               tied to stakes, dill and onions, cabbages
 *   addFlowerBed  red salvias and white flowers on a bed of leaves
 *
 * Leaf cards reuse the four leaf kinds of foliage.js and cabbages the
 * core material, so none of this adds a material (and so a draw call)
 * to a cell that already has trees. Flower beds use the solid material.
 * ------------------------------------------------------------------ */

/* ---------------- far trees ---------------- */

const FAR = {
  // tint, crown radius, height of the crown centre, vertical stretch
  round: { tint: PAL.elm, r: [2.6, 3.8], y: 1.3, sy: [0.9, 1.1] },
  poplar: { tint: PAL.poplar, r: [1.5, 1.9], y: 2.2, sy: [3.0, 3.6] },
  fruit: { tint: 0x5f8a3e, r: [1.8, 2.4], y: 1.05, sy: [0.75, 0.9] },
};

/**
 * One backdrop tree: one core blob, and a thin trunk under a poplar. The near trees'
 * cores are drawn at shade 0.82 with the same colour ramp, which is all
 * that is left of them past about 150 m, where this takes over.
 * @param {'round'|'poplar'|'fruit'} kind
 */
export function farTree(batch, x, z, rng, { kind = 'round', scale = 1 } = {}) {
  const f = FAR[kind];
  const r = rng.range(f.r[0], f.r[1]) * scale;
  const ry = r * rng.range(f.sy[0], f.sy[1]);
  const cy = r * f.y + ry * 0.55;
  // only a poplar's trunk shows below its crown from this far
  if (kind === 'poplar') {
    const t = new THREE.CylinderGeometry(0.12 * scale, 0.2 * scale, cy, 3, 1, true);
    t.translate(x, cy / 2, z);
    batch.add(t, { color: PAL.barkLight, cast: false, receive: false });
  }
  // 20 triangles: the radial normals keep it round under the cel ramp
  const colors = { base: shade(f.tint, 0, rng), light: shade(PAL.leafLight, 0, rng), dark: PAL.leafDark, shade: 0.82, detail: 0 };
  batch.add(coreBlob(rng, x, cy, z, r * 0.92, ry * 0.92, r * 0.92, colors), { color: null, mat: foliageCore(), cast: false, receive: false });
}

/* ---------------- weeds ---------------- */

const WEEDS = {
  wormwood: { colors: { base: 0x8c9a76, light: 0xb8c2a0, dark: 0x5e6c52 }, leaf: 'elm', r: [0.3, 0.5], sy: 0.8, size: 0.4 },
  burdock: { colors: { base: 0x4f7a36, light: 0x7a9a4e, dark: 0x3a5a2c }, leaf: 'broad', r: [0.4, 0.6], sy: 0.6, size: 0.55 },
  dry: { colors: { base: 0x9a9458, light: 0xc0b478, dark: 0x6e6a40 }, leaf: 'elm', r: [0.25, 0.42], sy: 0.9, size: 0.35 },
  green: { colors: { base: 0x6e8e40, light: 0x94ad5a, dark: 0x4f7236 }, leaf: 'elm', r: [0.3, 0.5], sy: 0.75, size: 0.4 },
};
const WEED_KINDS = ['wormwood', 'wormwood', 'burdock', 'dry', 'dry', 'green', 'green'];

/**
 * A clump of weeds at (x, z).
 * @param {object} [o]
 * @param {keyof WEEDS} [o.kind]  random if left out
 */
export function addWeeds(batch, x, z, seed, { kind, scale = 1, y = 0 } = {}) {
  const rng = rngKit(seed);
  const w = WEEDS[kind ?? rng.pick(WEED_KINDS)];
  const r = rng.range(w.r[0], w.r[1]) * scale;
  const colors = {
    base: shade(w.colors.base, 0, rng), light: w.colors.light, dark: w.colors.dark,
  };
  const clumps = [{ x, y: y + r * w.sy * 0.55, z, rx: r, ry: r * w.sy, rz: r }];
  if (r > 0.38) clumps.push({ x: x + rng.range(-0.3, 0.3), y: y + r * w.sy * 0.45, z: z + rng.range(-0.3, 0.3), rx: r * 0.7, ry: r * w.sy * 0.7, rz: r * 0.7 });
  canopy(batch, rng, clumps, colors, { kind: w.leaf, size: w.size * scale, density: 1.1, detail: 0, core: 0.75 });
  // dry seed stalks standing out of the clump
  if (w === WEEDS.dry || w === WEEDS.wormwood) {
    const n = rng.int(1, 3);
    for (let i = 0; i < n; i++) {
      const a = rng.range(0, Math.PI * 2), d = rng.range(0, r * 0.5), hgt = rng.range(0.8, 1.4) * scale;
      batch.tube(x + Math.cos(a) * d, y, z + Math.sin(a) * d, x + Math.cos(a) * (d + 0.1), y + hgt, z + Math.sin(a) * (d + 0.1),
        0.012, 0xa8986a, { seg: 3, cast: false });
    }
  }
}

/* ---------------- garden crops ---------------- */

const CROPS = {
  // leaf kind, card size, clump radius and height, clump centre height, colours
  potato: { leaf: 'broad', size: 0.34, r: 0.27, ry: 0.22, y: 0.24, colors: { base: 0x4f7f34, light: 0x7c9e4e, dark: 0x3a5e2a } },
  tomato: { leaf: 'broad', size: 0.3, r: 0.22, ry: 0.34, y: 0.42, colors: { base: 0x4a7632, light: 0x729448, dark: 0x365a28 } },
  greens: { leaf: 'elm', size: 0.26, r: 0.2, ry: 0.13, y: 0.12, colors: { base: 0x6f9a3e, light: 0x9cbc5e, dark: 0x4f7a30 } },
};
const CABBAGE = { base: 0x8aae7a, light: 0xb4cca0, dark: 0x5e8458 };

const _m = new THREE.Matrix4();

/**
 * A stretch of a crop row as one clump: a core blob drawn out along the
 * row and turned to it, with leaf cards round it. Cheaper than a clump
 * per plant, and a row of potatoes grows together into a ridge anyway.
 */
function rowClump(batch, rng, x, y, z, half, c, yaw, s) {
  const colors = { base: shade(c.colors.base, 0, rng), light: c.colors.light, dark: c.colors.dark };
  _m.makeRotationY(yaw).setPosition(x, y + c.y * s, z);
  const core = coreBlob(rng, 0, 0, 0, half * 0.9, c.ry * s * 0.65, c.r * s * 0.65, { ...colors, shade: 0.86, detail: 0 });
  batch.add(core.applyMatrix4(_m), { color: null, mat: foliageCore(), cast: false });
  // plenty of cards, so the row breaks up into plants instead of a smooth roll
  const count = Math.max(6, Math.round(half * 12));
  const cards = leafCards(rng, 0, 0, 0, half + c.r * 0.2, c.ry * s, c.r * s, { ...colors, count, size: c.size * s * 1.4, shell: [0.6, 1.05] });
  batch.add(cards.applyMatrix4(_m), { color: null, mat: foliageCard(c.leaf), cast: false });
}

/**
 * One row of a crop from (ax, az) to (bx, bz), standing on the ridge at
 * height y. Potatoes and greens grow as a continuous row, tomatoes stand
 * one by one at their stakes, cabbages sit in a line of heads `step` apart.
 * @param {'potato'|'tomato'|'greens'|'cabbage'} kind
 */
export function addCropRow(batch, ax, az, bx, bz, kind, seed, { y = 0, step = 0.55 } = {}) {
  const rng = rngKit(seed);
  const len = Math.hypot(bx - ax, bz - az);
  const yaw = Math.atan2(-(bz - az), bx - ax);
  if (kind === 'potato' || kind === 'greens') {
    const n = Math.max(1, Math.round(len / 1.4));
    const half = len / n / 2;
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n;
      rowClump(batch, rng, ax + (bx - ax) * t, y, az + (bz - az) * t, half * 0.92, CROPS[kind], yaw, rng.range(0.9, 1.1));
    }
    return;
  }
  const n = Math.max(1, Math.floor(len / step));
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n;
    const x = ax + (bx - ax) * t + rng.range(-0.04, 0.04), z = az + (bz - az) * t + rng.range(-0.04, 0.04);
    if (kind === 'cabbage') {
      const r = rng.range(0.2, 0.26);
      batch.add(coreBlob(rng, x, y + r * 0.8, z, r, r * 0.85, r, { ...CABBAGE, shade: 1, detail: 0 }), { color: null, mat: foliageCore(), cast: false });
      continue;
    }
    const c = CROPS.tomato;
    if (i % 2) continue;                 // tomatoes stand twice as far apart
    const s = rng.range(0.85, 1.15);
    batch.cyl(0.012, 0.85, 0x9a8062, x + 0.08, y, z, { seg: 3, cast: false });
    const colors = { base: shade(c.colors.base, 0, rng), light: c.colors.light, dark: c.colors.dark };
    batch.add(coreBlob(rng, x, y + c.y * s, z, c.r * s * 0.8, c.ry * s * 0.8, c.r * s * 0.8, { ...colors, shade: 0.86, detail: 0 }),
      { color: null, mat: foliageCore(), cast: false });
    batch.add(leafCards(rng, x, y + c.y * s, z, c.r * s, c.ry * s, c.r * s, { ...colors, count: 4, size: c.size * s * 1.3 }),
      { color: null, mat: foliageCard(c.leaf), cast: false });
  }
}

/* ---------------- flower beds ---------------- */

const LEAVES = { base: 0x436e30, light: 0x6e944a, dark: 0x345628 };

/** A small octahedron with radial normals: 8 triangles that shade round. */
function head(x, y, z, r) {
  const g = new THREE.OctahedronGeometry(r, 0);
  const p = g.attributes.position;
  const n = g.attributes.normal;
  for (let i = 0; i < p.count; i++) {
    const len = Math.hypot(p.getX(i), p.getY(i), p.getZ(i)) || 1;
    n.setXYZ(i, p.getX(i) / len, p.getY(i) / len, p.getZ(i) / len);
  }
  g.scale(1, 0.7, 1);
  return g.translate(x, y, z);
}

/**
 * Plants in a bed: low leafy clumps with flower heads over them.
 * `spots` is a list of [x, z] plant centres the caller lays out (in a
 * ring, along a wall, over a planter); `colors` are the flower colours
 * with their shares repeated, e.g. [red, red, red, white].
 *
 * Beds stand in squares and courtyards with no trees near, so they are
 * drawn in the plain solid material every cell already has, with round
 * normals and the foliage colour ramp baked in, and add no draw call.
 */
export function addFlowerBed(batch, spots, seed, { y = 0, colors = [0xc42f2a], height = 0.28, heads = 4 } = {}) {
  const rng = rngKit(seed);
  for (const [x, z] of spots) {
    const r = rng.range(0.16, 0.22);
    batch.add(coreBlob(rng, x, y + height * 0.45, z, r, height * 0.5, r,
      { base: shade(LEAVES.base, 0, rng), light: LEAVES.light, dark: LEAVES.dark, shade: 1, detail: 0 }), { color: null, cast: false });
    const col = rng.pick(colors);
    for (let i = 0; i < heads; i++) {
      const hx = x + rng.range(-r, r) * 0.9, hz = z + rng.range(-r, r) * 0.9;
      batch.add(head(hx, y + height * rng.range(0.85, 1.05), hz, rng.range(0.05, 0.075)), { color: col, cast: false });
    }
  }
}

/** Plant spots in a ring from radius r0 to r1 round (x, z), about one per `area` square metres. */
export function ringSpots(x, z, r0, r1, seed, area = 0.25) {
  const rng = rngKit(seed);
  const n = Math.round((Math.PI * (r1 * r1 - r0 * r0)) / area);
  const out = [];
  for (let i = 0; i < n; i++) {
    const a = rng.range(0, Math.PI * 2), d = Math.sqrt(rng.range(r0 * r0, r1 * r1));
    out.push([x + Math.cos(a) * d, z + Math.sin(a) * d]);
  }
  return out;
}

/** Plant spots in a w x d rectangle centred on (x, z), turned ry, one per `area` square metres. */
export function rectSpots(x, z, w, d, ry, seed, area = 0.25) {
  const rng = rngKit(seed);
  const n = Math.max(1, Math.round((w * d) / area));
  const c = Math.cos(ry), s = Math.sin(ry);
  const out = [];
  for (let i = 0; i < n; i++) {
    const lx = rng.range(-w / 2, w / 2), lz = rng.range(-d / 2, d / 2);
    out.push([x + lx * c + lz * s, z - lx * s + lz * c]);
  }
  return out;
}
