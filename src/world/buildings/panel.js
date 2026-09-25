import * as THREE from 'three';
import { PAL } from '../../core/palette.js';
import { rngKit, rotXZ } from '../../core/util.js';
import { canvasTex, cached, centerText, FONT } from '../../core/textures.js';
import { cel } from '../../core/toon.js';
import { addBench, addBin } from '../props/street.js';
import {
  wallMaterial, windowAtlas, cellUV, pickCell, WIN, ornamentMaterial, greekKeyMaterial,
} from './facades.js';
import { placeSign } from './signs.js';

/* ------------------------------------------------------------------ *
 * Soviet apartment blocks.
 *
 * `buildBlock(ctx, spec)` builds one block: a long box of `sections`
 * podyezds, `storeys` high, with its entrances on the front (local -z,
 * the side `facing` points to) and its balconies or loggia strips mostly
 * on the back. Everything goes into ctx.batch: the walls as world-mapped
 * texture quads, the windows as quads on the shared window atlas, and the
 * depth (loggias, canopies, plinth, parapet, roof clutter) as
 * vertex-coloured boxes.
 *
 *   spec = {
 *     x, z, facing,           footprint centre; facing in multiples of PI/2
 *     storeys, sections, sectionW, depth, bays (per section),
 *     wall,                   WALLS key: 'silicate' | 'cream' | 'tile' | 'panel' ...
 *     back: 'balconies' | 'strips' | 'plain',   what the back face carries
 *     front: 'plain' | 'strips',
 *     bands: [colour, colour] pastel loggia fronts (tile blocks), or null
 *     parapet: 'greek' | 'sheet' | 'bars'       loggia / balcony fronts
 *     ornament: 'end' | 'frieze' | null
 *     plinth: 'red' | 'grey', gasPipe, liftRooms, aerials, seed
 *     benches, doors          entrance benches; the code-lock door interactable
 *     sheet                   a SignSheet for the entrance plates (optional)
 *   }
 *
 * Returns { x0, z0, x1, z1, entrances: [{ x, z, facing, section }], height }.
 * ------------------------------------------------------------------ */

export const STOREY = 2.8;
const WIN_W = 1.42, WIN_H = 1.42, SILL = 0.86;
const ROOF = 0x6b6660;   // weathered rubberoid, lighter than fresh tar

/** What is taped to the podyezd door, read out when you try it. */
const DOOR_NOTES = [
  'A note on the door: «Горячей воды не будет с 4 по 24 июня».',
  'Someone has scratched «Цой жив» into the paint.',
  'A flyer: «Натяжные потолки. Пластиковые окна. Недорого».',
  'Nobody answers the buzzer.',
  'A note: «Уважаемые жильцы! Собрание в субботу в 18:00».',
  'From inside, a dog barks.',
];

const _one = new THREE.Vector3(1, 1, 1);
const _up = new THREE.Vector3(0, 1, 0);

/**
 * Collects textured quads per material and adds each set to the batch
 * as one geometry. Quads are given in the building's local frame.
 */
class QuadSet {
  constructor() { this.sets = new Map(); }

  /**
   * @param {THREE.Material} mat
   * @param {number[]} c  centre [x, y, z] (local)
   * @param {'-z'|'+z'|'-x'|'+x'|'+y'} face  outward normal
   * @param {number} w  width  (to the viewer's right)
   * @param {number} h  height (up, or local -z for '+y')
   * @param {number[]} uv  [u0, v0, u1, v1]
   */
  quad(mat, c, face, w, h, uv) {
    let s = this.sets.get(mat);
    if (!s) { s = { pos: [], nor: [], uv: [], idx: [] }; this.sets.set(mat, s); }
    const n = { '-z': [0, 0, -1], '+z': [0, 0, 1], '-x': [-1, 0, 0], '+x': [1, 0, 0], '+y': [0, 1, 0] }[face];
    // right as seen from outside = (-n) x up; for the roof, right = +x
    const right = face === '+y' ? [1, 0, 0] : [n[2], 0, -n[0]];
    const up = face === '+y' ? [0, 0, -1] : [0, 1, 0];
    const hw = w / 2, hh = h / 2;
    const base = s.pos.length / 3;
    const corners = [[-hw, -hh], [hw, -hh], [hw, hh], [-hw, hh]];
    for (const [a, b] of corners) {
      s.pos.push(c[0] + right[0] * a + up[0] * b, c[1] + right[1] * a + up[1] * b, c[2] + right[2] * a + up[2] * b);
      s.nor.push(n[0], n[1], n[2]);
    }
    s.uv.push(uv[0], uv[1], uv[2], uv[1], uv[2], uv[3], uv[0], uv[3]);
    s.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }

  /** Wall quad whose uv follows world metres from (u0m, v0m). */
  wall(mat, c, face, w, h, u0m, v0m) {
    const tw = mat.userData.tileW || 2, th = mat.userData.tileH || 2;
    this.quad(mat, c, face, w, h, [u0m / tw, v0m / th, (u0m + w) / tw, (v0m + h) / th]);
  }

  flush(batch, matrix) {
    for (const [mat, s] of this.sets) {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(s.pos, 3));
      g.setAttribute('normal', new THREE.Float32BufferAttribute(s.nor, 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(s.uv, 2));
      g.setIndex(s.idx);
      // flat decals on a wall (windows, reliefs) need not draw into the shadow map
      batch.add(g, { mat, matrix, color: null, cast: !mat.userData.noShadow });
    }
    this.sets.clear();
  }
}

export { QuadSet };

/* ---------------- entrance plates ---------------- */

const PLATE_ROWS = [20, 36, 16, 20];   // flats per podyezd: 5-storey, 9-storey, 4-storey, other

function drawPlate(ctx, x, y, cw, ch, i, perSection) {
  ctx.fillStyle = '#1f4e8c';
  ctx.fillRect(x + 2, y + 2, cw - 4, ch - 4);
  ctx.strokeStyle = '#e8e4da';
  ctx.lineWidth = 2;
  ctx.strokeRect(x + 5, y + 5, cw - 10, ch - 10);
  centerText(ctx, `Подъезд ${i + 1}`, x + cw / 2, y + 22, cw - 16, 18, '#ffffff', { family: FONT.narrow });
  centerText(ctx, `кв. ${i * perSection + 1}–${(i + 1) * perSection}`, x + cw / 2, y + 44, cw - 16, 16, '#ffffff', { family: FONT.narrow, weight: 'normal' });
}

const plateRow = (storeys) => (storeys >= 9 ? 1 : storeys === 4 ? 2 : 0);

/** One shared atlas of "Подъезд N / кв. a–b" plates, per storey count. */
function platesMaterial() {
  return cached('entrance-plates', () => {
    const cw = 128, ch = 64;
    const tex = canvasTex(cw * 8, ch * 4, (ctx) => {
      for (let row = 0; row < 4; row++) {
        for (let i = 0; i < 8; i++) drawPlate(ctx, i * cw, row * ch, cw, ch, i, PLATE_ROWS[row]);
      }
    });
    return cel({ map: tex, bands: 3, grime: 0.02, dirt: 0, polygonOffset: 2, cache: false });
  });
}

/** A single plate as its own small canvas, for a SignSheet. */
function plateTex(storeys, i) {
  const row = plateRow(storeys);
  return cached(`plate|${row}|${i}`, () => canvasTex(128, 64, (ctx) => drawPlate(ctx, 0, 0, 128, 64, i, PLATE_ROWS[row])));
}

function plateUV(storeys, i) {
  const row = plateRow(storeys);
  const c = Math.min(i, 7);
  return [c / 8, 1 - (row + 1) / 4, (c + 1) / 8, 1 - row / 4];
}

/* ---------------- the block ---------------- */

export function buildBlock(ctx, spec) {
  const {
    x, z, facing = 0, storeys = 5, sections = 4, sectionW = 15, depth = 12,
    bays = Math.max(3, Math.round(sectionW / 3)), wall = 'cream',
    back = 'balconies', front = 'plain', bands = null, parapet = 'sheet',
    ornament = null, plinth = 'grey', gasPipe = false, liftRooms = storeys >= 9,
    aerials = 4, seed = 1, lift = 0.6, benches = true, endWindows = false, doors = true, sheet = null,
  } = spec;
  const { batch, colliders, ground } = ctx;
  const rng = rngKit(seed);
  const L = sections * sectionW, D = depth;
  const floor0 = lift;
  const topY = floor0 + storeys * STOREY;
  const H = topY + 0.1;
  const bayW = sectionW / bays;
  const stairBay = Math.floor(bays / 2);

  const matrix = new THREE.Matrix4().compose(
    new THREE.Vector3(x, 0, z), new THREE.Quaternion().setFromAxisAngle(_up, facing), _one);
  const toW = (lx, lz) => {
    const [a, b] = rotXZ(lx, lz, facing);
    return [x + a, z + b];
  };
  /** Local box: centre-bottom at (lx, ly, lz), size w (local x) x h x d (local z). */
  const box = (w, h, d, color, lx, ly, lz, o = {}) => {
    const [wx, wz] = toW(lx, lz);
    batch.box(w, h, d, color, wx, ly, wz, { ...o, ry: facing + (o.ry || 0) });
  };

  const quads = new QuadSet();
  const wmat = wallMaterial(wall);
  const atlas = windowAtlas();
  const gk = parapet === 'greek' ? greekKeyMaterial() : null;
  const orn = ornament ? ornamentMaterial(ornament, seed % 3 + 1, wall) : null;

  /* ---- walls ---- */
  const wallH = H - floor0 + 0.9;   // down into the plinth
  const wallY = floor0 - 0.9 + wallH / 2;
  quads.wall(wmat, [0, wallY, -D / 2], '-z', L, wallH, 0, floor0 - 0.9);
  quads.wall(wmat, [0, wallY, D / 2], '+z', L, wallH, 0, floor0 - 0.9);
  for (const sx of [-1, 1]) {
    const face = sx < 0 ? '-x' : '+x';
    if (orn && ornament === 'end') {
      const cUV = [0, 0, 1, 1];
      quads.quad(orn, [sx * L / 2, wallY, 0], face, D, wallH, cUV);
    } else {
      quads.wall(wmat, [sx * L / 2, wallY, 0], face, D, wallH, 0, floor0 - 0.9);
    }
  }
  if (orn && ornament === 'frieze') {
    // a band of ornament across the top storey, front and back
    for (const face of ['-z', '+z']) {
      quads.quad(orn, [0, topY - 1.0, (face === '-z' ? -1 : 1) * (D / 2 + 0.01)], face, L, 1.5, [0, 0, L / 12, 1]);
    }
  }
  // roof surface
  box(L, 0.12, D, ROOF, 0, H - 0.12, 0);

  /* ---- windows ---- */
  const winCell = (k) => (k === 0 && rng.chance(0.55) ? pickCell(rng, WIN.grille) : pickCell(rng, WIN.flat));
  const hasBack = (bi) => (back === 'balconies' || back === 'strips') && (bi === 1 || bi === bays - 2);
  const hasFrontStrip = (bi) => front === 'strips' && (bi === stairBay - 1 || bi === stairBay + 1);
  const acUnits = [];
  const dishes = [];

  for (let s = 0; s < sections; s++) {
    for (let bi = 0; bi < bays; bi++) {
      const lx = -L / 2 + s * sectionW + (bi + 0.5) * bayW;
      for (const side of [-1, 1]) {
        const face = side < 0 ? '-z' : '+z';
        const zf = side * (D / 2 + 0.012);
        const isStair = side < 0 && bi === stairBay;
        if (isStair) {
          // stairwell: glass blocks or small windows at the half landings
          const glassBlocks = storeys >= 9 ? rng.chance(0.3) : rng.chance(0.5);
          for (let k = 0; k < storeys - 1; k++) {
            const cy = floor0 + (k + 1) * STOREY + 0.35;
            const cell = glassBlocks ? pickCell(rng, WIN.glassBlock) : pickCell(rng, WIN.stair);
            quads.quad(atlas, [lx, cy, zf], face, 1.15, 1.25, cellUV(cell));
          }
          continue;
        }
        for (let k = 0; k < storeys; k++) {
          const cy = floor0 + k * STOREY + SILL + WIN_H / 2;
          const kitchen = (bi + s) % 3 === 2;
          const w = kitchen ? 1.18 : WIN_W;
          quads.quad(atlas, [lx, cy, zf], face, w, WIN_H, cellUV(winCell(k)));
          const loggiaHere = (side > 0 && hasBack(bi) && (back === 'strips' || k > 0)) || (side < 0 && hasFrontStrip(bi));
          if (!loggiaHere && k > 0 && rng.chance(0.13)) acUnits.push([lx + (rng.chance(0.5) ? -1 : 1) * (w / 2 + 0.5), floor0 + k * STOREY + 0.55, side]);
          if (!loggiaHere && rng.chance(0.03)) dishes.push([lx + w / 2 + 0.45, floor0 + k * STOREY + 1.6, side]);
        }
      }
    }
  }
  if (endWindows && !orn) {
    for (const sx of [-1, 1]) {
      for (let k = 0; k < storeys; k++) {
        const cy = floor0 + k * STOREY + SILL + WIN_H / 2;
        quads.quad(atlas, [sx * (L / 2 + 0.012), cy, -D / 4], sx < 0 ? '-x' : '+x', 1.18, WIN_H, cellUV(pickCell(rng, WIN.flat)));
      }
    }
  }

  /* ---- balconies and loggias ---- */
  const loggia = (lx, k, side, stripIdx, style) => {
    const deep = style === 'strip' ? 1.2 : 1.0;
    const w = bayW - 0.25;
    const yb = floor0 + k * STOREY;
    const zc = side * (D / 2 + deep / 2);
    const band = bands ? bands[stripIdx % bands.length] : null;
    // floor slab
    box(w + 0.1, 0.14, deep, PAL.concrete, lx, yb - 0.14, zc);
    // parapet front
    const pc = band ?? (parapet === 'sheet' ? rng.pick([0xcfc8b8, 0xb8b4a8, 0x9aa3a0, 0xd6d0c4]) : PAL.concrete);
    if (parapet === 'greek' && !band) {
      box(w, 1.0, 0.1, 0xcfc8b8, lx, yb, side * (D / 2 + deep - 0.05));
      quads.wall(gk, [lx, yb + 0.5, side * (D / 2 + deep + 0.004)], side < 0 ? '-z' : '+z', w, 1.0, lx + L, 0);
    } else if (parapet === 'bars' && !band) {
      box(w, 0.06, 0.06, PAL.metalDark, lx, yb + 0.95, side * (D / 2 + deep - 0.03));
      for (let t = -w / 2 + 0.1; t <= w / 2 - 0.1; t += 0.14) box(0.025, 0.95, 0.025, PAL.metalDark, lx + t, yb, side * (D / 2 + deep - 0.03));
    } else {
      box(w, 1.0, 0.1, pc, lx, yb, side * (D / 2 + deep - 0.05));
    }
    // side walls on strips (loggias are boxes, not open slabs)
    if (style === 'strip') {
      for (const sx of [-1, 1]) box(0.12, STOREY - 0.14, deep, band ? PAL.panelLight : PAL.concrete, lx + sx * (w / 2 + 0.02), yb, zc);
    }
    // glazing: mismatched, the whole point of a 2000s facade
    const g = rng.weighted([['open', style === 'strip' ? 3 : 5], ['wood', 3], ['pvc', 4], ['sheet', 1.5], ['siding', 1]]);
    const gy = yb + 1.0, gh = STOREY - 1.18;
    const gz = side * (D / 2 + deep - 0.06);
    if (g === 'open') {
      if (rng.chance(0.25)) laundry(lx, yb, side, deep, w);
    } else if (g === 'sheet' || g === 'siding') {
      box(w, gh, 0.06, g === 'sheet' ? 0x2f5fa8 : rng.pick([0xe8e0c8, 0xd8dccf, 0xc9b58f]), lx, gy, gz);
      box(w + 0.04, 0.05, 0.12, PAL.metalGrey, lx, gy + gh, gz);
    } else {
      const fc = g === 'wood' ? rng.pick([0x8a6a4a, 0xe8e4da, 0xa89070]) : 0xf4f4f0;
      box(w, gh, 0.03, 0x5b7389, lx, gy, gz, { mat: 'glass' });
      box(w, 0.07, 0.08, fc, lx, gy, gz);
      box(w, 0.07, 0.08, fc, lx, gy + gh - 0.07, gz);
      const n = Math.max(2, Math.round(w / 0.7));
      for (let i = 0; i <= n; i++) box(0.06, gh, 0.08, fc, lx - w / 2 + (i * w) / n, gy, gz);
    }
  };

  function laundry(lx, yb, side, deep, w) {
    const ly = yb + 2.2;
    const zz = side * (D / 2 + deep * 0.5);
    box(w, 0.015, 0.015, 0xd8d4c8, lx, ly, zz);
    for (let i = 0; i < 4; i++) {
      if (rng.chance(0.3)) continue;
      const c = rng.pick([0xe8e2d0, 0xc9553d, 0x5a7aa8, 0xd8c27a, 0x6f8a4a, 0xf2f0ea]);
      box(rng.range(0.3, 0.55), rng.range(0.35, 0.7), 0.02, c, lx - w / 2 + 0.35 + i * (w / 4), ly - 0.6, zz);
    }
  }

  let strip = 0;
  for (let s = 0; s < sections; s++) {
    for (let bi = 0; bi < bays; bi++) {
      const lx = -L / 2 + s * sectionW + (bi + 0.5) * bayW;
      if (hasBack(bi)) {
        const style = back === 'strips' ? 'strip' : 'balcony';
        for (let k = back === 'strips' ? 0 : 1; k < storeys; k++) loggia(lx, k, 1, strip, style);
        strip++;
      }
      if (hasFrontStrip(bi)) {
        for (let k = 0; k < storeys; k++) loggia(lx, k, -1, strip, 'strip');
        strip++;
      }
    }
  }

  /* ---- AC units, dishes, drainpipes ---- */
  for (const [lx, ly, side] of acUnits) {
    box(0.78, 0.52, 0.26, 0xeceae4, lx, ly, side * (D / 2 + 0.14));
    box(0.44, 0.44, 0.02, 0x3a3a3a, lx + 0.12, ly + 0.04, side * (D / 2 + 0.28));
  }
  for (const [lx, ly, side] of dishes) {
    const [wx, wz] = toW(lx, side * (D / 2 + 0.3));
    batch.cyl(0.34, 0.06, 0xe4e2dc, wx, ly, wz, { rx: Math.PI / 2 - 0.5 * side, ry: facing + (side < 0 ? Math.PI : 0), seg: 12 });
  }
  const pipeXs = [-L / 2 + 0.25, L / 2 - 0.25];
  for (let s = 1; s < sections; s++) pipeXs.push(-L / 2 + s * sectionW);
  for (const px of pipeXs) {
    for (const side of [-1, 1]) {
      const [wx, wz] = toW(px, side * (D / 2 + 0.1));
      batch.cyl(0.07, H - 0.5, PAL.metalGrey, wx, 0.3, wz, { seg: 6 });
    }
  }

  /* ---- plinth, parapet, roof ---- */
  const plinthC = plinth === 'red' ? 0xb8342b : PAL.concreteDark;
  box(L + 0.16, floor0 + 0.3, D + 0.16, plinthC, 0, 0, 0);
  // basement vents
  for (let s = 0; s < sections; s++) {
    for (const bi of [0, bays - 1]) {
      const lx = -L / 2 + s * sectionW + (bi + 0.5) * bayW;
      for (const side of [-1, 1]) box(0.5, 0.28, 0.04, 0x2a2826, lx, 0.18, side * (D / 2 + 0.09));
    }
  }
  box(L + 0.1, 0.5, 0.25, PAL.concrete, 0, H, -D / 2 + 0.12);
  box(L + 0.1, 0.5, 0.25, PAL.concrete, 0, H, D / 2 - 0.12);
  box(0.25, 0.5, D, PAL.concrete, -L / 2 + 0.12, H, 0);
  box(0.25, 0.5, D, PAL.concrete, L / 2 - 0.12, H, 0);
  for (let s = 0; s < sections; s++) {
    const cx = -L / 2 + s * sectionW + (stairBay + 0.5) * bayW;
    if (liftRooms) {
      box(3.4, 2.6, 4.2, wall === 'silicate' ? 0xd6d0c4 : PAL.panelGrey, cx, H, -D / 2 + 2.6);
      box(3.6, 0.12, 4.4, ROOF, cx, H + 2.6, -D / 2 + 2.6);
    } else {
      box(1.4, 1.1, 1.4, PAL.concrete, cx, H, -D / 2 + 2.2);
    }
    // brick vent stacks
    for (const o of [-0.3, 0.3]) box(0.7, 1.1, 0.5, wall === 'cream' ? 0xd8c49a : 0xc9c2b4, cx + o * sectionW, H, 1.2);
  }
  // TV aerials: a pole with crossbars, leaning a little every which way
  for (let i = 0; i < aerials; i++) {
    const ax = rng.range(-L / 2 + 1, L / 2 - 1), az = rng.range(-D / 2 + 1, D / 2 - 1);
    const [wx, wz] = toW(ax, az);
    const hgt = rng.range(2.2, 3.6);
    const tx = rng.range(-0.2, 0.2), tz = rng.range(-0.2, 0.2);
    batch.tube(wx, H, wz, wx + tx, H + hgt, wz + tz, 0.025, PAL.metalGrey, { seg: 4 });
    const a = rng.range(0, Math.PI);
    for (let j = 0; j < 3; j++) {
      const y = H + hgt - 0.1 - j * 0.35;
      const len = 0.9 - j * 0.15;
      batch.tube(wx + tx - Math.cos(a) * len, y, wz + tz - Math.sin(a) * len, wx + tx + Math.cos(a) * len, y, wz + tz + Math.sin(a) * len, 0.012, PAL.metalGrey, { seg: 3, cast: false });
    }
  }
  if (rng.chance(0.6)) {
    const [wx, wz] = toW(rng.range(-L / 3, L / 3), D / 2 - 1);
    batch.cyl(0.55, 0.08, 0xe4e2dc, wx, H + 1.1, wz, { rx: 0.9, seg: 12 });
    batch.cyl(0.04, 1.1, PAL.metalGrey, wx, H, wz, { seg: 4 });
  }

  /* ---- entrances ---- */
  const entrances = [];
  for (let s = 0; s < sections; s++) {
    const lx = -L / 2 + s * sectionW + (stairBay + 0.5) * bayW;
    const zf = -D / 2;
    // door and plate
    quads.quad(atlas, [lx, floor0 + 1.1, zf - 0.02], '-z', 1.3, 2.2, cellUV(WIN.door[0] + rng.int(0, 3)));
    if (sheet) {
      const [px, pz] = toW(lx + 1.05, zf - 0.03);
      placeSign(ctx, sheet, plateTex(storeys, s), 0.6, 0.3, px, floor0 + 1.75, pz, facing + Math.PI);
    } else {
      quads.quad(platesMaterial(), [lx + 1.05, floor0 + 1.75, zf - 0.03], '-z', 0.6, 0.3, plateUV(storeys, s));
    }
    // canopy on two thin posts, steps up to the door
    box(2.4, 0.14, 1.6, PAL.concrete, lx, floor0 + 2.35, zf - 0.8);
    box(2.46, 0.05, 1.66, PAL.roofTar, lx, floor0 + 2.49, zf - 0.8);
    for (const sx of [-1, 1]) box(0.08, floor0 + 2.35, 0.08, PAL.metalDark, lx + sx * 1.1, 0, zf - 1.5);
    const steps = Math.max(1, Math.round(floor0 / 0.15));
    for (let i = 0; i < steps; i++) {
      const sh = floor0 * (i + 1) / steps;
      box(2.0, sh, 1.5 - i * (1.2 / steps), PAL.concrete, lx, 0, zf - 0.75 + i * (0.6 / steps));
    }
    const [ex, ez] = toW(lx, zf - 2.2);
    entrances.push({ x: ex, z: ez, facing, section: s, lx });
    // walkable steps: a ramp up to the landing
    const [ax, az] = toW(lx - 1.0, zf - 1.5);
    const [bx, bz] = toW(lx + 1.0, zf);
    if (Math.abs(Math.sin(facing)) < 0.5) {
      const zNear = Math.min(az, bz), zFar = Math.max(az, bz);
      const toward = Math.cos(facing) > 0;   // front faces -z: steps rise toward +z
      ground.ramp(Math.min(ax, bx), zNear, Math.max(ax, bx), zFar, toward ? 0 : floor0, toward ? floor0 : 0, 'z');
    } else {
      const xNear = Math.min(ax, bx), xFar = Math.max(ax, bx);
      const toward = Math.sin(facing) > 0;
      ground.ramp(xNear, Math.min(az, bz), xFar, Math.max(az, bz), toward ? 0 : floor0, toward ? floor0 : 0, 'x');
    }
    for (const sx of [-1, 1]) {
      const [px, pz] = toW(lx + sx * 1.1, zf - 1.5);
      colliders.circle(px, pz, 0.08, { tag: 'canopy-post' });
    }
    const door = toW(lx, zf - 0.35);
    const note = DOOR_NOTES[(seed + s) % DOOR_NOTES.length];
    if (doors) ctx.interact({
      x: door[0], y: floor0 + 1.1, z: door[1], w: 1.4, h: 2.2, d: 0.7, ry: facing,
      label: `Open podyezd ${s + 1} (подъезд)`,
      action: (game) => {
        game.audio.play('deny', { pos: { x: door[0], y: floor0 + 1.2, z: door[1] } });
        game.hud.flash(`Code lock beeps: «Кодты теріңіз / Наберите код». ${note}`, 3400);
      },
    });
    if (benches) {
      // benches clear of any loggias beside the door
      const off = front === 'strips' ? 1.5 * bayW + 1.0 : 2.6;
      for (const sx of [-1, 1]) {
        if (rng.chance(0.2)) continue;
        const [bxw, bzw] = toW(lx + sx * off, zf - 1.4);
        addBench(batch, bxw, bzw, facing, {
          style: rng.chance(0.5) ? 'park' : 'yard', color: rng.pick([PAL.greenPaint, 0x8a5a3a, 0x3e6aa6, 0xb8423a]), len: 1.6,
        });
        colliders.circle(bxw, bzw, 0.6, { top: 0.5, tag: 'bench' });
      }
      if (rng.chance(0.6)) {
        const [bxw, bzw] = toW(lx + 1.6, zf - 2.3);
        addBin(batch, bxw, bzw, facing);
      }
    }
  }

  /* ---- gas pipe along the front at first-floor level ---- */
  if (gasPipe) {
    const gy = floor0 + 2.62;
    const [ax, az] = toW(-L / 2 - 0.2, -D / 2 - 0.18);
    const [bx, bz] = toW(L / 2 + 0.2, -D / 2 - 0.18);
    batch.tube(ax, gy, az, bx, gy, bz, 0.05, PAL.gasYellow, { seg: 6 });
    for (let s = 0; s < sections; s++) {
      const lx = -L / 2 + s * sectionW + 0.8;
      const [px, pz] = toW(lx, -D / 2 - 0.18);
      batch.tube(px, gy, pz, px, 0.3, pz, 0.04, PAL.gasYellow, { seg: 6 });
      box(0.3, 0.3, 0.2, PAL.gasYellow, lx, 1.2, -D / 2 - 0.2);
    }
  }

  quads.flush(batch, matrix);

  /* ---- footprint ---- */
  const c = [[-L / 2 - 0.1, -D / 2 - 0.1], [L / 2 + 0.1, D / 2 + 0.1]].map(([a, b]) => toW(a, b));
  const x0 = Math.min(c[0][0], c[1][0]), x1 = Math.max(c[0][0], c[1][0]);
  const z0 = Math.min(c[0][1], c[1][1]), z1 = Math.max(c[0][1], c[1][1]);
  colliders.box(x0, z0, x1, z1, { tag: 'building' });
  // balconies on the ground floor of strip blocks stick out: keep people off them
  const guard = (a0, b0, a1, b1) => {
    const b = [toW(a0, b0), toW(a1, b1)];
    colliders.box(Math.min(b[0][0], b[1][0]), Math.min(b[0][1], b[1][1]), Math.max(b[0][0], b[1][0]), Math.max(b[0][1], b[1][1]), { top: floor0 + 1.0, tag: 'loggia' });
  };
  if (back === 'strips') guard(-L / 2, D / 2, L / 2, D / 2 + 1.25);
  if (front === 'strips') {
    for (let s = 0; s < sections; s++) {
      for (const bi of [stairBay - 1, stairBay + 1]) {
        const lx = -L / 2 + s * sectionW + (bi + 0.5) * bayW;
        guard(lx - bayW / 2, -D / 2 - 1.25, lx + bayW / 2, -D / 2);
      }
    }
  }
  return { x0, z0, x1, z1, entrances, height: H, length: L, depth: D, toW, facing, floor0 };
}
