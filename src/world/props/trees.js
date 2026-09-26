import * as THREE from 'three';
import { PAL } from '../../core/palette.js';
import { rngKit } from '../../core/util.js';
import { coreBlob, leafCards, foliageCore, foliageCard } from './foliage.js';

/* ------------------------------------------------------------------ *
 * Trees.
 *
 * The street trees of a Kazakh steppe town in the 2000s:
 *   poplar  the tall pyramidal poplar (пирамидальный тополь), in rows
 *           along every avenue, and the source of the June fluff
 *   black   the broad black poplar of old courtyards
 *   elm     the small-leaved elm (карагач), the tough steppe tree
 *   maple   the ash-leaved maple (клён), self-seeded everywhere
 *   birch   a birch (берёза), planted by someone homesick for Russia
 *   shrub   lilac and yellow acacia (карагана) hedges
 *   young   a sapling on a stake, the avenue's newest planting
 *   ball    an elm clipped into a ball, on squares and the avenue
 *   spruce  blue spruce, for the akimat, the station and the park
 *   apple, apricot, cherry
 *           the whitewashed fruit trees of every private-sector garden;
 *           the cherries are red in June
 *   lilac   a tall many-stemmed lilac bush (сирень), over by now
 *   acacia  a feathery yellow acacia (карагана) bush
 *   karagach  another name for the elm
 *
 * A canopy is a few low-poly core blobs wrapped in alpha-tested leaf
 * cards (see foliage.js): the core gives the mass and the shadow, the
 * cards give a leafy outline, and both sway a little in the wind. Colour
 * is baked into the vertices: darker underneath, sunlit on top and on
 * the west side. Every trunk in a public place is whitewashed to about
 * 1.2 m, as it was every spring.
 *
 * `addTree(batch, kind, x, z, seed, opts)` adds one tree to a Batch and
 * returns its trunk radius so the caller can register a collider.
 * ------------------------------------------------------------------ */

const _c = new THREE.Color();

/** A hue, saturation and lightness jitter of a base colour. */
export function shade(hexA, amount, rng) {
  _c.set(hexA);
  const hsl = {};
  _c.getHSL(hsl);
  _c.setHSL(hsl.h + rng.range(-0.02, 0.02), Math.min(1, hsl.s * rng.range(0.85, 1.1)), Math.min(1, hsl.l * (1 + amount)));
  return _c.getHex();
}

function trunk(batch, x, z, h, r0, r1, color, { whitewash = true, lean = 0, leanDir = 0, y0 = 0 } = {}) {
  const g = new THREE.CylinderGeometry(r1, r0, h, 7, 1, true);
  g.translate(0, h / 2, 0);
  if (lean) g.applyMatrix4(new THREE.Matrix4().makeRotationAxis(new THREE.Vector3(Math.cos(leanDir), 0, Math.sin(leanDir)), lean));
  g.translate(x, y0, z);
  batch.add(g, { color });
  if (whitewash) {
    const w = new THREE.CylinderGeometry(r0 * 1.06, r0 * 1.12, 1.2, 7, 1, true);
    w.translate(0, 0.6, 0);
    if (lean) w.applyMatrix4(new THREE.Matrix4().makeRotationAxis(new THREE.Vector3(Math.cos(leanDir), 0, Math.sin(leanDir)), lean));
    w.translate(x, y0, z);
    batch.add(w, { color: PAL.whitewash });
  }
}

/** A few bare limbs so the trunk reads as holding the crown. */
function branches(batch, rng, x, z, y0, y1, reach, color, count, rise = [0.5, 0.9]) {
  for (let i = 0; i < count; i++) {
    const a = rng.range(0, Math.PI * 2);
    const y = rng.range(y0, y1);
    const len = reach * rng.range(0.6, 1);
    batch.tube(x, y, z, x + Math.cos(a) * len, y + len * rng.range(rise[0], rise[1]), z + Math.sin(a) * len,
      rng.range(0.05, 0.09), color, { seg: 5 });
  }
}

/**
 * Wrap a list of clumps in core blobs and leaf cards.
 * @param {object} leaf  { kind, size, density, up, droop, shell, core }
 *   density is cards per square metre of clump silhouette
 */
export function canopy(batch, rng, clumps, colors, leaf) {
  const core = foliageCore();
  const card = foliageCard(leaf.kind);
  const coreScale = leaf.core ?? 0.8;
  for (const k of clumps) {
    batch.add(coreBlob(rng, k.x, k.y, k.z, k.rx * coreScale, k.ry * coreScale, k.rz * coreScale,
      { ...colors, shade: 0.82, detail: leaf.detail ?? 1 }), { color: null, mat: core });
    // enough cards to cover the blob's surface: density is the share of
    // the surface one card's leaf cluster covers, summed over all cards
    const surface = 4 * Math.PI * (k.rx * k.ry + k.ry * k.rz + k.rx * k.rz) / 3;
    const count = Math.max(4, Math.min(48, Math.round((surface * leaf.density * 0.8) / (leaf.size * leaf.size * 0.45 * 1.2))));
    batch.add(leafCards(rng, k.x, k.y, k.z, k.rx, k.ry, k.rz, {
      ...colors, count, size: leaf.size * 1.1, up: leaf.up ?? 0, droop: leaf.droop ?? 0, shell: leaf.shell,
    }), { color: null, mat: card, cast: false });
  }
}

/**
 * Add a tree.
 * @param {import('../../core/batch.js').Batch} batch
 * @param {'poplar'|'black'|'elm'|'karagach'|'maple'|'birch'|'shrub'|'young'|'ball'|'spruce'|'apple'|'apricot'|'cherry'|'lilac'|'acacia'} kind
 * @param {number} x
 * @param {number} z
 * @param {number} seed
 * @param {object} [o]
 * @param {number} [o.scale=1]
 * @param {number} [o.y=0]   ground height at the foot
 * @param {boolean} [o.whitewash=true]
 * @returns {{ r: number, h: number }} trunk radius and total height
 */
export function addTree(batch, kind, x, z, seed, o = {}) {
  const rng = rngKit(seed);
  const s = (o.scale ?? 1) * rng.range(0.85, 1.15);
  const y0 = o.y ?? 0;
  const ww = o.whitewash ?? true;

  if (kind === 'poplar') {
    // a narrow column, widest a third of the way up, tapering to a point;
    // the branches all sweep upward, so the cards stand upright too
    const h = 15 * s;
    const r = 0.24 * s;
    trunk(batch, x, z, h * 0.62, r, r * 0.45, PAL.barkLight, { whitewash: ww, y0 });
    branches(batch, rng, x, z, y0 + h * 0.2, y0 + h * 0.3, 0.9 * s, PAL.barkLight, 3, [1.4, 2.2]);
    const colors = { base: shade(PAL.poplar, 0, rng), light: shade(PAL.leafLight, -0.04, rng), dark: PAL.leafDark };
    const clumps = [];
    const n = 5;
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1);
      const rad = (0.85 + Math.sin(Math.min(1, t * 1.25) * Math.PI) * 0.75 * (1 - t * 0.35)) * s * (i === n - 1 ? 0.8 : 1);
      clumps.push({ x: x + rng.range(-0.2, 0.2), y: y0 + h * (0.26 + t * 0.64), z: z + rng.range(-0.2, 0.2), rx: rad, ry: rad * 1.9, rz: rad });
    }
    canopy(batch, rng, clumps, colors, { kind: 'poplar', size: 1.25 * s, density: 1.3, up: 0.55 });
    return { r, h };
  }

  if (kind === 'black') {
    const h = 17 * s;
    const r = 0.42 * s;
    trunk(batch, x, z, h * 0.5, r, r * 0.6, PAL.bark, { whitewash: ww, y0 });
    branches(batch, rng, x, z, y0 + h * 0.3, y0 + h * 0.5, 2.8 * s, PAL.bark, 6);
    const colors = { base: shade(PAL.poplar, 0.05, rng), light: shade(PAL.leafLight, -0.05, rng), dark: PAL.leafDark };
    const clumps = [];
    for (let i = 0; i < 7; i++) {
      const a = rng.range(0, Math.PI * 2);
      const d = rng.range(0.4, 3.4) * s;
      const rad = rng.range(1.9, 2.7) * s;
      clumps.push({ x: x + Math.cos(a) * d, y: y0 + rng.range(0.48, 0.86) * h, z: z + Math.sin(a) * d, rx: rad, ry: rad * 1.05, rz: rad });
    }
    canopy(batch, rng, clumps, colors, { kind: 'poplar', size: 1.9 * s, density: 1.2 });
    return { r, h };
  }

  if (kind === 'apple' || kind === 'apricot' || kind === 'cherry') return fruitTree(batch, rng, kind, x, z, s, y0, ww);
  if (kind === 'lilac' || kind === 'acacia') return bush(batch, rng, kind, x, z, s, y0);
  if (kind === 'karagach') kind = 'elm';

  if (kind === 'elm' || kind === 'maple') {
    const isElm = kind === 'elm';
    const h = (isElm ? 10 : 8.5) * s;
    const r = (isElm ? 0.25 : 0.2) * s;
    const lean = rng.range(0, isElm ? 0.12 : 0.22);
    const leanDir = rng.range(0, Math.PI * 2);
    trunk(batch, x, z, h * 0.5, r, r * 0.6, isElm ? PAL.bark : PAL.barkLight, { whitewash: ww, lean, leanDir, y0 });
    const lx = Math.cos(leanDir) * Math.sin(lean) * h * 0.5, lz = Math.sin(leanDir) * Math.sin(lean) * h * 0.5;
    branches(batch, rng, x + lx * 0.5, z + lz * 0.5, y0 + h * 0.3, y0 + h * 0.48, 2.0 * s, PAL.bark, 5);
    const tint = isElm ? PAL.elm : PAL.leaf;
    const colors = { base: shade(tint, 0, rng), light: shade(PAL.leafLight, 0, rng), dark: PAL.leafDark };
    const clumps = [];
    const n = isElm ? 6 : 5;
    for (let i = 0; i < n; i++) {
      const a = rng.range(0, Math.PI * 2);
      const d = rng.range(0.3, 2.3) * s;
      const rad = rng.range(1.4, 2.0) * s;
      clumps.push({ x: x + lx + Math.cos(a) * d, y: y0 + rng.range(0.54, 0.84) * h, z: z + lz + Math.sin(a) * d, rx: rad, ry: rad * 0.85, rz: rad });
    }
    canopy(batch, rng, clumps, colors, isElm
      ? { kind: 'elm', size: 1.5 * s, density: 1.3 }
      : { kind: 'broad', size: 1.6 * s, density: 1.2, droop: 0.4 });
    return { r, h };
  }

  if (kind === 'birch') {
    const h = 12 * s;
    const r = 0.16 * s;
    trunk(batch, x, z, h * 0.8, r, r * 0.4, 0xe6e2d8, { whitewash: false, y0 });
    // the black lenticel bands of a birch trunk
    for (let i = 0; i < 9; i++) {
      const yy = y0 + rng.range(0.3, h * 0.55);
      const rr = r * (1 - (yy - y0) / (h * 0.8) * 0.6) * 1.04;
      batch.cyl(rr, rng.range(0.04, 0.12), 0x2e2c28, x, yy, z, { seg: 7, open: true });
    }
    batch.cyl(r * 1.1, 0.5, 0x3a3630, x, y0, z, { seg: 7, open: true });
    branches(batch, rng, x, z, y0 + h * 0.4, y0 + h * 0.6, 1.4 * s, 0xd8d2c6, 4, [0.3, 0.7]);
    const colors = { base: shade(0x86a44c, 0, rng), light: shade(0xb1c46c, 0, rng), dark: 0x5a7a38 };
    const clumps = [];
    for (let i = 0; i < 5; i++) {
      const a = rng.range(0, Math.PI * 2);
      const d = rng.range(0.2, 1.4) * s;
      const rad = rng.range(1.2, 1.7) * s;
      clumps.push({ x: x + Math.cos(a) * d, y: y0 + h * rng.range(0.5, 0.85), z: z + Math.sin(a) * d, rx: rad, ry: rad * 1.35, rz: rad });
    }
    canopy(batch, rng, clumps, colors, { kind: 'elm', size: 1.3 * s, density: 1.1, droop: 0.7, core: 0.7 });
    return { r, h };
  }

  if (kind === 'young') {
    const h = 4.2 * s;
    const r = 0.07 * s;
    trunk(batch, x, z, h * 0.6, r, r * 0.6, PAL.barkLight, { whitewash: ww, y0 });
    // the stake it is tied to
    batch.cyl(0.03, 1.8, 0x9a8062, x + 0.18, y0, z, { seg: 4 });
    const colors = { base: shade(PAL.leaf, 0.05, rng), light: PAL.leafLight, dark: PAL.leafDark };
    const clumps = [];
    for (let i = 0; i < 3; i++) {
      const rad = rng.range(0.65, 0.9) * s;
      clumps.push({ x: x + rng.range(-0.4, 0.4), y: y0 + h * rng.range(0.64, 0.86), z: z + rng.range(-0.4, 0.4), rx: rad, ry: rad, rz: rad });
    }
    canopy(batch, rng, clumps, colors, { kind: 'elm', size: 0.9 * s, density: 1.2 });
    return { r, h };
  }

  if (kind === 'ball') {
    // an elm clipped into a ball, the way the city gardeners kept them on
    // squares and along the avenue
    const h = 4.6 * s;
    const r = 0.14 * s;
    trunk(batch, x, z, h * 0.62, r, r * 0.8, PAL.bark, { whitewash: ww, y0 });
    const colors = { base: shade(PAL.elm, 0.02, rng), light: PAL.leafLight, dark: PAL.leafDark };
    const rad = 1.35 * s;
    canopy(batch, rng, [{ x, y: y0 + h - rad * 0.9, z, rx: rad, ry: rad * 0.95, rz: rad }], colors,
      { kind: 'clipped', size: 0.95 * s, density: 1.5, shell: [0.9, 1.0], core: 0.93, detail: 2 });
    return { r, h };
  }

  if (kind === 'spruce') {
    // blue spruce (голубая ель): drooping tiers with ragged branch tips
    const h = 9 * s;
    const r = 0.18 * s;
    trunk(batch, x, z, h * 0.3, r, r * 0.8, PAL.bark, { whitewash: false, y0 });
    const tiers = 7;
    const seg = 14;
    const core = foliageCore();
    for (let i = 0; i < tiers; i++) {
      const t = i / tiers;
      const tr = (2.2 - t * 1.85) * s;
      const th = h * (0.22 - t * 0.05);
      const yb = y0 + h * 0.1 + t * h * 0.8;
      const g = new THREE.ConeGeometry(tr, th, seg, 1, true);
      g.translate(0, th / 2, 0);
      const p = g.attributes.position;
      const col = new Float32Array(p.count * 3);
      const tint = shade(0x6f9397, 0, rng);
      for (let k = 0; k < p.count; k++) {
        let px = p.getX(k), py = p.getY(k), pz = p.getZ(k);
        if (py < 1e-3) {
          // alternate long and short branch tips, the long ones droop
          const j = k % (seg + 1);
          const tip = j % 2 === 0 ? 1.0 : 0.72;
          px *= tip * rng.range(0.92, 1.05);
          pz *= tip * rng.range(0.92, 1.05);
          py -= tip > 0.9 ? th * 0.12 : -th * 0.05;
        }
        p.setXYZ(k, x + px, yb + py, z + pz);
        const up = py / th;
        _c.set(0x3a585c).lerp(new THREE.Color(tint), Math.min(1, up * 0.8 + 0.15 + t * 0.25));
        if (px < -tr * 0.3) _c.lerp(new THREE.Color(0x9cb8b6), 0.18);
        col[k * 3] = _c.r; col[k * 3 + 1] = _c.g; col[k * 3 + 2] = _c.b;
      }
      g.computeVertexNormals();
      g.setAttribute('color', new THREE.BufferAttribute(col, 3));
      batch.add(g, { color: null, mat: core });
    }
    return { r: 0.3 * s, h };
  }

  // shrub: a low mound of lilac or acacia
  const rad = 0.9 * s;
  const colors = { base: shade(PAL.leaf, -0.05, rng), light: PAL.leafLight, dark: PAL.leafDark };
  const clumps = [];
  for (let i = 0; i < 3; i++) {
    clumps.push({ x: x + rng.range(-0.6, 0.6), y: y0 + rad * 0.55, z: z + rng.range(-0.6, 0.6), rx: rad * rng.range(0.8, 1.1), ry: rad * 0.75, rz: rad * rng.range(0.8, 1.1) });
  }
  canopy(batch, rng, clumps, colors, { kind: 'broad', size: 0.9 * s, density: 1.2 });
  return { r: 0.6 * s, h: rad * 1.4 };
}

const FRUIT = {
  // leaf tint, crown height, crown spread, leaf card kind and size
  apple: { tint: 0x5f8a3e, h: 5.2, spread: 1.7, leaf: 'broad', size: 1.1 },
  apricot: { tint: 0x74984a, h: 6.0, spread: 1.9, leaf: 'broad', size: 1.2 },
  cherry: { tint: 0x4d7a34, h: 4.4, spread: 1.3, leaf: 'elm', size: 1.0 },
};

/**
 * A garden fruit tree: a short whitewashed trunk that forks low into a
 * few spreading limbs, and a wide, rather flat crown.
 */
function fruitTree(batch, rng, kind, x, z, s, y0, ww) {
  const f = FRUIT[kind];
  const h = f.h * s;
  const r = 0.12 * s;
  trunk(batch, x, z, h * 0.34, r, r * 0.7, PAL.bark, { whitewash: ww, y0, lean: rng.range(0, 0.1), leanDir: rng.range(0, 6.3) });
  branches(batch, rng, x, z, y0 + h * 0.22, y0 + h * 0.34, 1.5 * s, PAL.bark, 4, [0.35, 0.7]);
  const colors = { base: shade(f.tint, 0, rng), light: shade(PAL.leafLight, -0.02, rng), dark: PAL.leafDark };
  const clumps = [];
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + rng.range(-0.4, 0.4);
    const d = (i === 0 ? 0.2 : rng.range(0.8, f.spread)) * s;
    const rad = rng.range(1.0, 1.35) * s;
    clumps.push({ x: x + Math.cos(a) * d, y: y0 + h * rng.range(0.6, 0.78), z: z + Math.sin(a) * d, rx: rad, ry: rad * 0.78, rz: rad });
  }
  canopy(batch, rng, clumps, colors, { kind: f.leaf, size: f.size * s, density: 1.2, droop: 0.2, detail: 0 });
  if (kind === 'cherry') {
    // ripe cherries hanging on the outside of the crown
    for (let i = 0; i < 16; i++) {
      const k = clumps[i % clumps.length];
      const a = rng.range(0, Math.PI * 2), dy = rng.range(-0.6, 0.3);
      const rr = Math.sqrt(1 - dy * dy);
      const g = new THREE.OctahedronGeometry(0.08 * s, 0);
      g.translate(k.x + Math.cos(a) * rr * k.rx * 0.98, k.y + dy * k.ry * 0.98, k.z + Math.sin(a) * rr * k.rz * 0.98);
      batch.add(g, { color: rng.pick([0x9e1a24, 0xb8242c, 0x7e1420]), cast: false });
    }
  }
  return { r, h };
}

/**
 * A bush of several stems from one root: lilac, tall and upright with
 * dark heart-shaped leaves, or yellow acacia, lower, arching and airy.
 */
function bush(batch, rng, kind, x, z, s, y0) {
  const lilac = kind === 'lilac';
  const h = (lilac ? 3.2 : 2.1) * s;
  const stems = lilac ? 5 : 6;
  const clumps = [];
  for (let i = 0; i < stems; i++) {
    const a = rng.range(0, Math.PI * 2);
    const out = rng.range(0.3, lilac ? 0.8 : 1.1) * s;
    const top = h * rng.range(0.7, 0.95);
    batch.tube(x + Math.cos(a) * 0.12, y0, z + Math.sin(a) * 0.12, x + Math.cos(a) * out, y0 + top * 0.7, z + Math.sin(a) * out,
      0.035 * s, PAL.bark, { seg: 4, cast: false });
    const rad = (lilac ? rng.range(0.7, 0.95) : rng.range(0.6, 0.85)) * s;
    clumps.push({ x: x + Math.cos(a) * out, y: y0 + top - rad * 0.4, z: z + Math.sin(a) * out, rx: rad, ry: rad * (lilac ? 1.15 : 0.8), rz: rad });
  }
  const colors = lilac
    ? { base: shade(0x4e7a36, 0, rng), light: shade(0x86a458, 0, rng), dark: 0x3e6030 }
    : { base: shade(0x7c9c48, 0, rng), light: shade(0xa8bc68, 0, rng), dark: 0x587a38 };
  canopy(batch, rng, clumps, colors, lilac
    ? { kind: 'broad', size: 0.95 * s, density: 1.3, detail: 0 }
    : { kind: 'elm', size: 0.8 * s, density: 1.2, droop: 0.5, detail: 0 });
  return { r: 0.5 * s, h };
}

/** A straight clipped hedge of shrubs from (x0, z0) to (x1, z1). */
export function addHedge(batch, x0, z0, x1, z1, seed, { height = 1.0, width = 0.9, y = 0 } = {}) {
  const rng = rngKit(seed);
  const len = Math.hypot(x1 - x0, z1 - z0);
  const n = Math.max(1, Math.round(len / 1.1));
  const colors = { base: shade(PAL.leaf, -0.08, rng), light: PAL.leafLight, dark: PAL.leafDark };
  const clumps = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const r = rng.range(0.55, 0.75);
    clumps.push({
      x: x0 + (x1 - x0) * t + rng.range(-0.1, 0.1), y: y + height * 0.5, z: z0 + (z1 - z0) * t + rng.range(-0.1, 0.1),
      rx: r * width, ry: height * 0.55, rz: r * width,
    });
  }
  canopy(batch, rng, clumps, colors, { kind: 'clipped', size: 0.7, density: 1.2, shell: [0.85, 1.0], core: 0.92 });
}
