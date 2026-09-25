import * as THREE from 'three';
import { PAL } from '../../core/palette.js';
import { rngKit } from '../../core/util.js';

/* ------------------------------------------------------------------ *
 * Trees.
 *
 * The street trees of a Kazakh steppe town in the 2000s:
 *   poplar  the tall pyramidal poplar (пирамидальный тополь), in rows
 *           along every avenue, and the source of the June fluff
 *   black   the broad black poplar of old courtyards
 *   elm     the small-leaved elm (карагач), the tough steppe tree
 *   maple   the ash-leaved maple (клён), self-seeded everywhere
 *   shrub   lilac and yellow acacia (карагана) hedges
 *   ball    an elm clipped into a ball, on squares and the avenue
 *   spruce  blue spruce, for the akimat, the station and the park
 *
 * Canopies are clusters of jittered ellipsoid blobs with radial normals,
 * so the soft cel ramp shades them as rounded masses rather than facets.
 * Colour is baked into the vertices: darker underneath, sunlit on top,
 * each blob with its own slight hue shift. Every trunk in a public place
 * is whitewashed to about 1.2 m, as it was every spring.
 *
 * `addTree(batch, kind, x, z, seed, opts)` adds one tree to a Batch and
 * returns its trunk radius so the caller can register a collider.
 * ------------------------------------------------------------------ */

const _c = new THREE.Color();
const _c2 = new THREE.Color();

function blob(rng, cx, cy, cz, rx, ry, rz, base, light, dark) {
  const g = new THREE.IcosahedronGeometry(1, 2);
  const p = g.attributes.position;
  const n = new Float32Array(p.count * 3);
  const col = new Float32Array(p.count * 3);
  const seedX = rng.range(0, 100);
  // jitter is a function of the unit direction, so shared corners stay shared
  for (let i = 0; i < p.count; i++) {
    let x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const len = Math.hypot(x, y, z) || 1;
    x /= len; y /= len; z /= len;
    const k = 1 + 0.13 * Math.sin(x * 5.1 + seedX) * Math.cos(z * 4.3 + seedX * 0.7) + 0.07 * Math.sin(y * 7.7 + seedX * 1.3);
    p.setXYZ(i, cx + x * rx * k, cy + y * ry * k, cz + z * rz * k);
    n[i * 3] = x / rx; n[i * 3 + 1] = y / ry; n[i * 3 + 2] = z / rz;
    const nl = Math.hypot(n[i * 3], n[i * 3 + 1], n[i * 3 + 2]);
    n[i * 3] /= nl; n[i * 3 + 1] /= nl; n[i * 3 + 2] /= nl;
    // underside darker, crown lighter, a little sun-side warmth (west)
    const t = y * 0.5 + 0.5;
    _c.set(dark).lerp(_c2.set(base), Math.min(1, t * 1.6));
    if (t > 0.62) _c.lerp(_c2.set(light), (t - 0.62) * 1.4);
    if (x < -0.4) _c.lerp(_c2.set(light), 0.15);
    col[i * 3] = _c.r; col[i * 3 + 1] = _c.g; col[i * 3 + 2] = _c.b;
  }
  g.setAttribute('normal', new THREE.BufferAttribute(n, 3));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return g;
}

function shade(hexA, amount, rng) {
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
    const w = new THREE.CylinderGeometry(r0 * 1.06, r0 * 1.12, 1.15, 7, 1, true);
    w.translate(0, 0.58, 0);
    if (lean) w.applyMatrix4(new THREE.Matrix4().makeRotationAxis(new THREE.Vector3(Math.cos(leanDir), 0, Math.sin(leanDir)), lean));
    w.translate(x, y0, z);
    batch.add(w, { color: PAL.whitewash });
  }
}

/** A few bare branch stubs so the trunk reads as holding the crown. */
function branches(batch, rng, x, z, y0, y1, reach, color, count) {
  for (let i = 0; i < count; i++) {
    const a = rng.range(0, Math.PI * 2);
    const y = rng.range(y0, y1);
    const len = reach * rng.range(0.6, 1);
    batch.tube(x, y, z, x + Math.cos(a) * len, y + len * rng.range(0.5, 0.9), z + Math.sin(a) * len,
      rng.range(0.05, 0.09), color, { seg: 5 });
  }
}

/**
 * Add a tree.
 * @param {import('../../core/batch.js').Batch} batch
 * @param {'poplar'|'black'|'elm'|'maple'|'shrub'|'young'|'ball'|'spruce'} kind
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
  const put = (g) => batch.add(g, { color: null, mat: 'foliage' });

  if (kind === 'poplar') {
    const h = 15 * s;
    const r = 0.24 * s;
    trunk(batch, x, z, h * 0.62, r, r * 0.45, PAL.barkLight, { whitewash: ww, y0 });
    const base = shade(PAL.poplar, 0, rng), light = shade(PAL.leafLight, 0, rng), dark = PAL.leafDark;
    // a narrow column, widest a third of the way up, tapering to a point
    const n = 9;
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1);
      const cy = y0 + h * (0.24 + t * 0.68);
      const rad = (0.75 + Math.sin(Math.min(1, t * 1.25) * Math.PI) * 0.7 * (1 - t * 0.35)) * s;
      put(blob(rng, x + rng.range(-0.25, 0.25), cy, z + rng.range(-0.25, 0.25), rad, rad * 2.1, rad, base, light, dark));
    }
    return { r, h };
  }

  if (kind === 'black') {
    const h = 17 * s;
    const r = 0.42 * s;
    trunk(batch, x, z, h * 0.5, r, r * 0.6, PAL.bark, { whitewash: ww, y0 });
    branches(batch, rng, x, z, y0 + h * 0.3, y0 + h * 0.5, 2.6 * s, PAL.bark, 5);
    const base = shade(PAL.poplar, 0.05, rng), light = shade(PAL.leafLight, -0.05, rng), dark = PAL.leafDark;
    for (let i = 0; i < 11; i++) {
      const a = rng.range(0, Math.PI * 2);
      const d = rng.range(0, 3.2) * s;
      const cy = y0 + rng.range(0.45, 0.88) * h;
      const rad = rng.range(1.9, 2.8) * s;
      put(blob(rng, x + Math.cos(a) * d, cy, z + Math.sin(a) * d, rad, rad * 1.1, rad, base, light, dark));
    }
    return { r, h };
  }

  if (kind === 'elm' || kind === 'maple') {
    const h = (kind === 'elm' ? 10 : 8.5) * s;
    const r = (kind === 'elm' ? 0.25 : 0.2) * s;
    const lean = rng.range(0, 0.12);
    const leanDir = rng.range(0, Math.PI * 2);
    trunk(batch, x, z, h * 0.5, r, r * 0.6, kind === 'elm' ? PAL.bark : PAL.barkLight, { whitewash: ww, lean, leanDir, y0 });
    const lx = Math.cos(leanDir) * Math.sin(lean) * h * 0.5, lz = Math.sin(leanDir) * Math.sin(lean) * h * 0.5;
    branches(batch, rng, x + lx * 0.5, z + lz * 0.5, y0 + h * 0.3, y0 + h * 0.48, 1.8 * s, PAL.bark, 4);
    const tint = kind === 'elm' ? PAL.elm : PAL.leaf;
    const base = shade(tint, 0, rng), light = shade(PAL.leafLight, 0, rng), dark = PAL.leafDark;
    const n = kind === 'elm' ? 9 : 7;
    for (let i = 0; i < n; i++) {
      const a = rng.range(0, Math.PI * 2);
      const d = rng.range(0, 2.1) * s;
      const cy = y0 + rng.range(0.52, 0.86) * h;
      const rad = rng.range(1.4, 2.1) * s;
      put(blob(rng, x + lx + Math.cos(a) * d, cy, z + lz + Math.sin(a) * d, rad, rad * 0.9, rad, base, light, dark));
    }
    return { r, h };
  }

  if (kind === 'young') {
    const h = 4.2 * s;
    const r = 0.07 * s;
    trunk(batch, x, z, h * 0.6, r, r * 0.6, PAL.barkLight, { whitewash: ww, y0 });
    const base = shade(PAL.leaf, 0.05, rng), light = PAL.leafLight, dark = PAL.leafDark;
    for (let i = 0; i < 3; i++) {
      const rad = rng.range(0.7, 1.0) * s;
      put(blob(rng, x + rng.range(-0.4, 0.4), y0 + h * rng.range(0.62, 0.85), z + rng.range(-0.4, 0.4), rad, rad, rad, base, light, dark));
    }
    return { r, h };
  }

  if (kind === 'ball') {
    // an elm clipped into a ball, the way the city gardeners kept them on
    // squares and along the avenue
    const h = 4.6 * s;
    const r = 0.14 * s;
    trunk(batch, x, z, h * 0.62, r, r * 0.8, PAL.bark, { whitewash: ww, y0 });
    const base = shade(PAL.elm, 0.02, rng), light = PAL.leafLight, dark = PAL.leafDark;
    const rad = 1.35 * s;
    put(blob(rng, x, y0 + h - rad * 0.9, z, rad, rad * 0.95, rad, base, light, dark));
    return { r, h };
  }

  if (kind === 'spruce') {
    // blue spruce (голубая ель): stacked tiers, blue-green, for formal spots
    const h = 9 * s;
    const r = 0.18 * s;
    trunk(batch, x, z, h * 0.3, r, r * 0.8, PAL.bark, { whitewash: false, y0 });
    const tiers = 6;
    for (let i = 0; i < tiers; i++) {
      const t = i / tiers;
      const tr = (2.1 - t * 1.7) * s;
      const th = h * 0.24;
      const g = new THREE.ConeGeometry(tr, th, 9, 1, true);
      g.translate(x, y0 + h * 0.12 + t * h * 0.78 + th / 2, z);
      g.rotateY(0);
      const col = new Float32Array(g.attributes.position.count * 3);
      const p = g.attributes.position;
      for (let k = 0; k < p.count; k++) {
        const up = (p.getY(k) - (y0 + h * 0.12 + t * h * 0.78)) / th;
        _c.set(0x3f5f63).lerp(_c2.set(0x7c9ea0), Math.min(1, up * 0.9 + t * 0.2));
        col[k * 3] = _c.r; col[k * 3 + 1] = _c.g; col[k * 3 + 2] = _c.b;
      }
      g.setAttribute('color', new THREE.BufferAttribute(col, 3));
      batch.add(g, { color: null, mat: 'foliage' });
    }
    return { r: 0.3 * s, h };
  }

  // shrub: a low hedge-like mound
  const rad = 0.9 * s;
  const base = shade(PAL.leaf, -0.05, rng), light = PAL.leafLight, dark = PAL.leafDark;
  for (let i = 0; i < 3; i++) {
    put(blob(rng, x + rng.range(-0.6, 0.6), y0 + rad * 0.55, z + rng.range(-0.6, 0.6), rad * rng.range(0.8, 1.1), rad * 0.75, rad * rng.range(0.8, 1.1), base, light, dark));
  }
  return { r: 0.6 * s, h: rad * 1.4 };
}

/** A straight hedge of shrubs from (x0, z0) to (x1, z1). */
export function addHedge(batch, x0, z0, x1, z1, seed, { height = 1.0, width = 0.9, y = 0 } = {}) {
  const rng = rngKit(seed);
  const len = Math.hypot(x1 - x0, z1 - z0);
  const n = Math.max(1, Math.round(len / 1.1));
  const base = shade(PAL.leaf, -0.08, rng);
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const x = x0 + (x1 - x0) * t + rng.range(-0.1, 0.1);
    const z = z0 + (z1 - z0) * t + rng.range(-0.1, 0.1);
    const r = rng.range(0.55, 0.75);
    batch.add(blob(rng, x, y + height * 0.5, z, r * width, height * 0.55, r * width, base, PAL.leafLight, PAL.leafDark),
      { color: null, mat: 'foliage' });
  }
}
