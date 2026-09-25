import * as THREE from 'three';
import { SURF, TILE, worldUV } from '../../core/surfaces.js';
import { rngKit } from '../../core/util.js';
import { addTree } from '../props/trees.js';
import { addBench } from '../props/street.js';
import { KIT, TILES, tbox, tboxGeo, mtx, frame, quadGeo, scaleUV } from './houseKit.js';

/* ------------------------------------------------------------------ *
 * Private-sector houses and their plots.
 *
 * The house is the Aktobe single-storey type seen in the June 2008
 * photos (c23, c24): gable end to the street with three windows, lime
 * plaster with blue frames or maroon boards with a sky-blue gable, a
 * seamed sheet-metal roof in silver, green or blue, shutters, white
 * window bars, an attic window in the gable, carved surrounds on the
 * older ones, a brick chimney, the porch on the yard side.
 *
 * The plot is everything around it: a solid sheet-metal gate under a
 * wrought-iron arch with a wicket door, plank or profiled-sheet fences,
 * a packed-earth yard, a shed, an outhouse at the back, vegetable beds
 * and whitewashed fruit trees, a clothes line, a bench by the gate, and
 * the yellow gas riser from the main that runs along the front fences.
 *
 * Plot-local frame: x runs along the street (0..W), z runs from the
 * front fence line (0) into the plot (0..D). The street is at -z.
 * `addPlot(ctx, { ox, oz, ry, W, D, seed })` maps local to world with
 * `frame(ox, oz, ry)`: ry = 0 for a plot whose street is to its north.
 * ------------------------------------------------------------------ */

const WALL_H = 2.7;
const PLINTH_H = 0.55;
const FENCE_H = 1.9;

const WALLS = {
  lime: { mat: 'plaster', color: 0xf0ede4, frame: 0x3a6fb0, gable: 0xf0ede4, gableMat: 'plaster' },
  limeGreen: { mat: 'plaster', color: 0xece9dc, frame: 0x3f8a5a, gable: 0x7fa88a, gableMat: 'boards' },
  maroon: { mat: 'boards', color: 0x6e2a2e, frame: 0xf2f0ea, gable: 0x9cb8d8, gableMat: 'boards' },
  brownWood: { mat: 'boards', color: 0x6a4a36, frame: 0xf2f0ea, gable: 0x8fb3cf, gableMat: 'boards' },
  paleYellow: { mat: 'plaster', color: 0xe8d9a4, frame: 0xf2f0ea, gable: 0x5a8ab8, gableMat: 'boards' },
  blueWood: { mat: 'boards', color: 0x4f7fae, frame: 0xf2f0ea, gable: 0xf2f0ea, gableMat: 'boards' },
  brick: { mat: 'brick', color: 0xb05a40, frame: 0xf2f0ea, gable: 0x9cb8d8, gableMat: 'boards' },
};
const ROOFS = [0xa8aaa8, 0xa8aaa8, 0x4e7a5a, 0x2b55a0, 0x8a4a3a, 0x9aa2a6];
const GATES = [0x6e2a2e, 0x6e2a2e, 0x2f5fa8, 0x3f7a52, 0x5a4a3a, 0x7a2626];
const SHUTTERS = [0x3a6fb0, 0x6e2a2e, 0x3f7a52, 0xf2f0ea, 0x2f5fa8];

/* ------------------------------------------------------------------ geometry helpers */

/**
 * A quad from four points with a uv per point. With `want`, the winding
 * is flipped if needed so the face points that way (normal . want > 0).
 */
export function quad(points, uvs, want = null) {
  const build = (P, U) => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array([...P[0], ...P[1], ...P[2], ...P[0], ...P[2], ...P[3]]), 3));
    g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array([...U[0], ...U[1], ...U[2], ...U[0], ...U[2], ...U[3]]), 2));
    g.computeVertexNormals();
    return g;
  };
  let g = build(points, uvs);
  if (want) {
    const n = g.attributes.normal;
    if (n.getX(0) * want[0] + n.getY(0) * want[1] + n.getZ(0) * want[2] < 0) {
      g = build([points[0], points[3], points[2], points[1]], [uvs[0], uvs[3], uvs[2], uvs[1]]);
    }
  }
  return g;
}

/** A triangle prism for a gable: base width w, height h, thickness t, facing -z at z = 0. */
function gableGeo(w, h, t) {
  const s = new THREE.Shape();
  s.moveTo(0, 0);
  s.lineTo(w, 0);
  s.lineTo(w / 2, h);
  s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: t, bevelEnabled: false });
  return g;
}

function addMat(batch, key) {
  return key === 'plaster' ? KIT.plaster : key === 'boards' ? KIT.boards : key === 'brick' ? KIT.brick : KIT.corrugated;
}

function tileOf(key) {
  return TILES[key] || [1, 1];
}

/* ------------------------------------------------------------------ the house */

/**
 * One house. (hx, hz) is its front-left corner in plot-local space; the
 * front wall is at local z = hz and faces the street (-z).
 */
function addHouse(ctx, L, hx, hz, W, D, style, rng, plotRy, o = {}) {
  const { batch, colliders } = ctx;
  const S = WALLS[style];
  const wallMat = addMat(batch, S.mat);
  const at = (lx, lz) => L(hx + lx, hz + lz);
  const put = (geo, mat, color, lx, y, lz, ry = 0, rx = 0, rz = 0) =>
    batch.add(geo, { mat, color, matrix: mtx(...pos3(at(lx, lz), y), plotRy + ry, rx, rz) });
  const pos3 = (xz, y) => [xz[0], y, xz[1]];

  // plinth and walls
  const plinthColor = rng.pick([0x7a3b2e, 0x8a3a30, 0x9a948a, 0x6e6a64]);
  put(tboxGeo(W + 0.08, PLINTH_H, D + 0.08, [1, 1]), 'solid', plinthColor, W / 2, 0, D / 2);
  put(tboxGeo(W, WALL_H, D, tileOf(S.mat)), wallMat, S.color, W / 2, PLINTH_H, D / 2);

  // gables front and back
  const gh = W * 0.33;
  const top = PLINTH_H + WALL_H;
  const gMat = addMat(batch, S.gableMat);
  for (const [lz, flip] of [[-0.02, false], [D + 0.02, true]]) {
    const g = scaleUV(gableGeo(W + 0.1, gh, 0.1), tileOf(S.gableMat));
    g.translate(-(W + 0.1) / 2, 0, -0.05);
    put(g, gMat, S.gable, W / 2, top, lz, flip ? Math.PI : 0);
  }
  // attic window in the front gable
  put(tboxGeo(0.6, 0.7, 0.06), 'solid', S.frame, W / 2, top + gh * 0.28, -0.1);
  put(quadGeo(0.44, 0.52, 0, 0, 0.25, 1), KIT.curtains, 0xffffff, W / 2, top + gh * 0.28 + 0.09, -0.135);

  // roof: two seamed planes, a ridge cap and gable trims
  const over = 0.38;
  const run = D + 0.7;
  const half = W / 2 + over;
  const drop = (half * gh) / (W / 2);
  const ridgeY = top + gh + 0.06;
  const roofColor = o.roof ?? rng.pick(ROOFS);
  for (const side of [-1, 1]) {
    const x0 = W / 2, x1 = W / 2 + side * half;
    const y0 = ridgeY, y1 = ridgeY - drop;
    const z0 = -0.35, z1 = D + 0.35;
    const slope = Math.hypot(half, drop);
    const P = (lx, y, lz) => pos3(at(lx, lz), y);
    const pts = side < 0
      ? [P(x1, y1, z0), P(x0, y0, z0), P(x0, y0, z1), P(x1, y1, z1)]
      : [P(x0, y0, z0), P(x1, y1, z0), P(x1, y1, z1), P(x0, y0, z1)];
    const uvs = side < 0
      ? [[0, 0], [0, slope / 2], [run / 0.6, slope / 2], [run / 0.6, 0]]
      : [[0, slope / 2], [0, 0], [run / 0.6, 0], [run / 0.6, slope / 2]];
    // seams run down the slope: u along the ridge, v down the slope
    const g = quad(pts, uvs, [0, 1, 0]);
    batch.add(g, { mat: KIT.seam, color: roofColor });
    // underside (soffit), seen from below at the eaves
    const under = quad(pts.map((p) => [p[0], p[1] - 0.04, p[2]]), [[0, 0], [1, 0], [1, 1], [0, 1]], [0, -1, 0]);
    batch.add(under, { mat: 'solid', color: 0x6b5a48, cast: false });
    // fascia board along the eave
    const eave = at(x1, D / 2);
    batch.box(0.05, 0.16, run, S.frame === 0xf2f0ea ? 0xf2f0ea : 0x8a6a4a, eave[0], y1 - 0.14, eave[1], { ry: plotRy });
  }
  const rc = at(W / 2, D / 2);
  batch.box(0.22, 0.1, run + 0.05, roofColor, rc[0], ridgeY - 0.02, rc[1], { ry: plotRy });

  // brick chimney near the ridge, toward the back
  const ch = at(W / 2 + 0.7, D * 0.62);
  batch.box(0.5, 1.5, 0.5, 0x9a4a36, ch[0], ridgeY - 0.9, ch[1], { ry: plotRy });
  batch.box(0.62, 0.08, 0.62, 0x6e6a64, ch[0], ridgeY + 0.6, ch[1], { ry: plotRy });

  // windows: three on the street, two on each side
  const shutter = rng.pick(SHUTTERS);
  const bars = rng.chance(0.6);
  const carved = rng.chance(0.45);
  const nFront = W > 7.5 ? 3 : 2;
  for (let i = 0; i < nFront; i++) {
    const lx = (W * (i + 0.5)) / nFront;
    windowAt(put, lx, -0.001, 0, { frame: S.frame, shutter, bars, carved, rng });
  }
  for (const side of [0, 1]) {
    for (let i = 0; i < 2; i++) {
      const lz = D * (0.28 + i * 0.44);
      windowAt(put, side ? W + 0.001 : -0.001, lz, side ? -Math.PI / 2 : Math.PI / 2, { frame: S.frame, shutter, bars: bars && !side, carved: false, rng, side: true });
    }
  }

  // drainpipe at the front corner
  const dp = at(W + 0.08, -0.08);
  batch.cyl(0.055, top - 0.1, 0xb8bcbe, dp[0], 0, dp[1], { seg: 6 });

  // satellite dish on a few
  if (o.dish) {
    const d = at(W * 0.2, -0.25);
    batch.cyl(0.3, 0.06, 0xe8e6e0, d[0], top - 0.8, d[1], { rx: -1.2, ry: plotRy, seg: 10 });
    batch.box(0.05, 0.3, 0.05, 0x777777, d[0], top - 1.0, d[1], { ry: plotRy });
  }
  // TV aerial on a mast off the back gable
  const aer = at(W / 2, D + 0.2);
  batch.cyl(0.03, 3.2, 0x8a8d8f, aer[0], top + gh - 0.4, aer[1], { seg: 5 });
  for (let k = 0; k < 4; k++) batch.box(0.02, 0.02, 1.1 - k * 0.2, 0x8a8d8f, aer[0], top + gh + 2.2 + k * 0.18, aer[1], { ry: plotRy + 0.6 });

  // collider
  const c = at(W / 2, D / 2);
  colliders.obb(c[0], c[1], W / 2 + 0.05, D / 2 + 0.05, plotRy, { top: ridgeY, tag: 'house' });
  return { top, ridgeY };
}

/** One window on a wall; (lx, lz) is the wall point, ry turns it to face out. */
function windowAt(put, lx, lz, ry, { frame: fc, shutter, bars, carved, rng, side = false }) {
  const w = 0.95, h = 1.3, sill = 1.35;
  const variant = rng.int(0, 3);
  // local offsets: the window faces local -z after ry
  const f = (dx, dz) => {
    const c = Math.cos(ry), s = Math.sin(ry);
    return [lx + dx * c + dz * s, lz - dx * s + dz * c];
  };
  const [gx, gz] = f(0, -0.035);
  put(quadGeo(w - 0.1, h - 0.1, variant * 0.25, 0, variant * 0.25 + 0.25, 1), KIT.curtains, 0xffffff, gx, sill + 0.05, gz, ry);
  const [fx, fz] = f(0, -0.02);
  // frame as four bars and a cross
  put(tboxGeo(w, 0.08, 0.08), 'solid', fc, fx, sill - 0.02, fz, ry);
  put(tboxGeo(w, 0.08, 0.08), 'solid', fc, fx, sill + h - 0.08, fz, ry);
  for (const sx of [-1, 1]) {
    const [px, pz] = f(sx * (w / 2 - 0.04), -0.02);
    put(tboxGeo(0.08, h, 0.08), 'solid', fc, px, sill - 0.02, pz, ry);
  }
  put(tboxGeo(0.05, h, 0.05), 'solid', fc, fx, sill, fz, ry);
  put(tboxGeo(w, 0.05, 0.05), 'solid', fc, fx, sill + h * 0.66, fz, ry);
  // sill board
  const [sx0, sz0] = f(0, -0.08);
  put(tboxGeo(w + 0.16, 0.05, 0.18), 'solid', 0xe4e2dc, sx0, sill - 0.06, sz0, ry);
  if (!side) {
    for (const s2 of [-1, 1]) {
      const [px, pz] = f(s2 * (w / 2 + 0.28), -0.05);
      put(tboxGeo(0.48, h + 0.05, 0.04), 'solid', shutter, px, sill - 0.02, pz, ry + s2 * 0.12);
    }
  }
  if (bars) {
    for (let k = 0; k < 4; k++) {
      const [bx, bz] = f(-w / 2 + 0.18 + k * 0.2, -0.1);
      put(tboxGeo(0.02, h - 0.05, 0.02), 'solid', 0xf2f0ea, bx, sill, bz, ry);
    }
    const [bx, bz] = f(0, -0.1);
    put(tboxGeo(w - 0.1, 0.03, 0.02), 'solid', 0xf2f0ea, bx, sill + h * 0.45, bz, ry);
  }
  if (carved) {
    // наличник: a board with a pointed top above the window
    const [cx, cz] = f(0, -0.06);
    put(tboxGeo(w + 0.4, 0.22, 0.05), 'solid', fc, cx, sill + h + 0.02, cz, ry);
    const tri = gableGeo(w + 0.3, 0.32, 0.05);
    tri.translate(-(w + 0.3) / 2, 0, -0.025);
    put(tri, 'solid', fc, cx, sill + h + 0.24, cz, ry);
    put(tboxGeo(w + 0.4, 0.14, 0.05), 'solid', fc, cx, sill - 0.2, cz, ry);
  }
}

/* ------------------------------------------------------------------ fences and gates */

/**
 * A straight fence run in plot-local space from (x0, z0) to (x1, z1).
 * kind: 'plank' (grey boards), 'sheet' (painted profiled sheet),
 * 'picket' (low slats for a front garden).
 */
export function fenceRun(ctx, L, ry, x0, z0, x1, z1, kind, color, o = {}) {
  const { batch, colliders } = ctx;
  const len = Math.hypot(x1 - x0, z1 - z0);
  if (len < 0.2) return;
  const a = Math.atan2(-(z1 - z0), x1 - x0);   // yaw of the run in plot space
  const mid = L((x0 + x1) / 2, (z0 + z1) / 2);
  const yaw = ry + a;
  const h = o.h ?? (kind === 'picket' ? 1.15 : FENCE_H);
  if (kind === 'picket') {
    const n = Math.floor(len / 0.16);
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n;
      const p = L(x0 + (x1 - x0) * t, z0 + (z1 - z0) * t);
      batch.box(0.08, h - (i % 2) * 0.05, 0.025, color, p[0], 0, p[1], { ry: yaw });
    }
    for (const y of [0.3, h - 0.3]) batch.box(len, 0.06, 0.04, 0x6b5238, mid[0], y, mid[1], { ry: yaw });
  } else {
    const mat = kind === 'plank' ? KIT.boards : KIT.corrugated;
    const tile = kind === 'plank' ? TILES.boards : TILES.corrugated;
    tbox(batch, mat, tile, len, h, 0.05, color, mid[0], 0.05, mid[1], yaw);
    const posts = Math.max(1, Math.round(len / 2.6));
    for (let i = 0; i <= posts; i++) {
      const t = i / posts;
      const p = L(x0 + (x1 - x0) * t, z0 + (z1 - z0) * t);
      batch.box(0.1, h + 0.1, 0.1, kind === 'plank' ? 0x5a4a3a : 0x4a4d50, p[0], 0, p[1], { ry: yaw });
    }
  }
  if (o.collide !== false) colliders.obb(mid[0], mid[1], len / 2, 0.1, yaw, { top: h, tag: 'fence' });
}

/** Solid sheet-metal gate with a wicket door and a wrought-iron arch over it. */
function gate(ctx, L, ry, gx, gz, color, rng) {
  const { batch, colliders } = ctx;
  const GW = 3.4, WK = 0.95, H = 2.1;
  const put = (lx, lz) => L(gx + lx, gz + lz);
  // two leaves
  for (const s of [0, 1]) {
    const p = put(s * GW / 2 + GW / 4, 0);
    tbox(batch, KIT.corrugated, TILES.corrugated, GW / 2 - 0.04, H, 0.05, color, p[0], 0.08, p[1], ry);
  }
  // wicket door
  const wk = put(GW + 0.12 + WK / 2, 0);
  tbox(batch, KIT.corrugated, TILES.corrugated, WK, H - 0.05, 0.05, color, wk[0], 0.08, wk[1], ry);
  const handle = put(GW + 0.12 + WK - 0.12, -0.06);
  batch.box(0.04, 0.12, 0.04, 0x333333, handle[0], 1.0, handle[1], { ry });
  // square steel posts
  for (const lx of [-0.06, GW + 0.06, GW + 0.18 + WK]) {
    const p = put(lx, 0);
    batch.box(0.1, H + 0.55, 0.1, 0x3a3c3e, p[0], 0, p[1], { ry });
  }
  // wrought arch with a couple of scrolls
  const archH = 0.55;
  const seg = 10;
  let prev = null;
  for (let i = 0; i <= seg; i++) {
    const t = i / seg;
    const lx = -0.06 + (GW + 0.12) * t;
    const y = H + 0.35 + Math.sin(Math.PI * t) * archH;
    const p = put(lx, 0);
    if (prev) batch.tube(prev[0], prev[1], prev[2], p[0], y, p[1], 0.025, 0x1e1e1e, { seg: 4 });
    prev = [p[0], y, p[1]];
  }
  const cBar = put(GW / 2, 0);
  batch.tube(put(-0.06, 0)[0], H + 0.35, put(-0.06, 0)[1], put(GW + 0.06, 0)[0], H + 0.35, put(GW + 0.06, 0)[1], 0.02, 0x1e1e1e, { seg: 4 });
  for (const s of [-1, 1]) {
    const c = put(GW / 2 + s * 0.7, 0);
    for (let k = 0; k < 8; k++) {
      const a0 = (k / 8) * Math.PI * 1.6, a1 = ((k + 1) / 8) * Math.PI * 1.6;
      const r0 = 0.18 * (1 - k / 10), r1 = 0.18 * (1 - (k + 1) / 10);
      const [ax, az] = [c[0], c[1]];
      batch.tube(ax + Math.cos(a0) * r0 * s * Math.cos(ry), H + 0.62 + Math.sin(a0) * r0, az - Math.cos(a0) * r0 * s * Math.sin(ry),
        ax + Math.cos(a1) * r1 * s * Math.cos(ry), H + 0.62 + Math.sin(a1) * r1, az - Math.cos(a1) * r1 * s * Math.sin(ry), 0.015, 0x1e1e1e, { seg: 3 });
    }
  }
  batch.box(0.02, 0.02, 0.02, 0x1e1e1e, cBar[0], H + 0.4, cBar[1]);
  const mid = put((GW + WK + 0.2) / 2, 0);
  colliders.obb(mid[0], mid[1], (GW + WK + 0.3) / 2, 0.1, ry, { top: H, tag: 'gate' });
  return { width: GW + WK + 0.3, center: put(GW / 2, 0) };
}

/* ------------------------------------------------------------------ yard things */

function shed(ctx, L, ry, lx, lz, rng) {
  const { batch, colliders } = ctx;
  const w = rng.range(2.6, 3.8), d = 2.4, h = 2.3;
  const c = L(lx + w / 2, lz + d / 2);
  const col = rng.pick([0x8e8474, 0x7a6e5e, 0x9a9384]);
  tbox(batch, KIT.boards, TILES.boards, w, h, d, col, c[0], 0, c[1], ry);
  // single-pitch roof of old slate
  batch.box(w + 0.4, 0.06, d + 0.5, 0x8f8d86, c[0], h + 0.12, c[1], { ry, rx: 0.12 });
  const door = L(lx + w * 0.3, lz - 0.01);
  batch.box(0.8, 1.9, 0.04, 0x6b5238, door[0], 0.05, door[1], { ry });
  colliders.obb(c[0], c[1], w / 2, d / 2, ry, { top: h, tag: 'shed' });
}

function outhouse(ctx, L, ry, lx, lz) {
  const { batch, colliders } = ctx;
  const c = L(lx, lz);
  tbox(batch, KIT.boards, TILES.boards, 1.1, 2.05, 1.1, 0x8e8474, c[0], 0, c[1], ry);
  batch.box(1.35, 0.05, 1.45, 0x7f7c74, c[0], 2.12, c[1], { ry, rx: -0.14 });
  const door = L(lx, lz - 0.56);
  batch.box(0.72, 1.8, 0.03, 0x7a6e5e, door[0], 0.08, door[1], { ry });
  // the little window cut in the door
  const win = L(lx, lz - 0.58);
  batch.box(0.12, 0.12, 0.02, 0x1e1a16, win[0], 1.55, win[1], { ry, rz: Math.PI / 4 });
  colliders.obb(c[0], c[1], 0.6, 0.6, ry, { top: 2.1, tag: 'outhouse' });
}

function beds(ctx, L, ry, x0, z0, x1, z1, rng) {
  const { batch } = ctx;
  const rows = Math.max(2, Math.floor((z1 - z0) / 0.9));
  for (let i = 0; i < rows; i++) {
    const z = z0 + (i + 0.5) * ((z1 - z0) / rows);
    const a = L((x0 + x1) / 2, z);
    const kind = rng.pick(['potato', 'potato', 'greens', 'tomato', 'bare']);
    if (kind === 'bare') {
      batch.box(x1 - x0, 0.12, 0.55, 0x7e6a4e, a[0], -0.04, a[1], { ry, cast: false });
      continue;
    }
    batch.box(x1 - x0, 0.1, 0.6, 0x6e5a40, a[0], -0.04, a[1], { ry, cast: false });
    const n = Math.floor((x1 - x0) / 0.55);
    for (let k = 0; k < n; k++) {
      const p = L(x0 + (k + 0.5) * ((x1 - x0) / n), z);
      const hgt = kind === 'tomato' ? 0.7 : kind === 'greens' ? 0.18 : 0.4;
      const col = kind === 'greens' ? 0x6f9a3e : kind === 'tomato' ? 0x4f7a34 : 0x5f8a3c;
      batch.box(0.42, hgt, 0.42, col, p[0], 0.04, p[1], { ry: ry + k, mat: 'foliage' });
    }
  }
}

function clothesLine(ctx, L, ry, x0, z0, x1, z1, rng) {
  const { batch } = ctx;
  const a = L(x0, z0), b = L(x1, z1);
  for (const p of [a, b]) {
    batch.cyl(0.04, 2.1, 0x8a8d8f, p[0], 0, p[1], { seg: 5 });
    batch.box(0.6, 0.04, 0.04, 0x8a8d8f, p[0], 2.05, p[1], { ry: ry + Math.atan2(-(z1 - z0), x1 - x0) + Math.PI / 2 });
  }
  batch.tube(a[0], 2.0, a[1], b[0], 1.92, b[1], 0.006, 0xdddddd, { seg: 3, cast: false });
  const n = rng.int(2, 5);
  for (let i = 0; i < n; i++) {
    const t = 0.15 + (i / n) * 0.7;
    const x = a[0] + (b[0] - a[0]) * t, z = a[1] + (b[1] - a[1]) * t;
    const col = rng.pick([0xf2efe6, 0x5a86c8, 0xd8584a, 0xe8d06a, 0x7fb07a, 0xf0c8d0]);
    const hh = rng.range(0.5, 0.9);
    batch.box(rng.range(0.4, 0.8), hh, 0.02, col, x, 1.95 - hh, z, { ry: ry + Math.atan2(-(z1 - z0), x1 - x0), cast: true });
  }
}

/* ------------------------------------------------------------------ the plot */

/**
 * Build one plot.
 * @param {object} ctx  world build context
 * @param {object} p
 * @param {number} p.ox, p.oz  world position of the plot's front-left corner
 * @param {number} p.ry        yaw: 0 when the street is to the plot's north
 * @param {number} p.W, p.D    width along the street and depth into the plot
 * @param {number} p.seed
 * @param {string} [p.style]   key of WALLS
 * @returns {{ gateWorld: number[], benchWorld: number[], houseWorld: number[] }}
 */
export function addPlot(ctx, p) {
  const { batch } = ctx;
  const rng = rngKit(p.seed);
  const L = frame(p.ox, p.oz, p.ry);
  const style = p.style || rng.pick(Object.keys(WALLS));
  const houseLeft = p.houseLeft ?? rng.chance(0.5);
  const HW = Math.min(p.W - 6.2, rng.range(8.2, 10));
  const HD = rng.range(7.2, 8.6);
  const hx = houseLeft ? 0.6 : p.W - 0.6 - HW;
  const fenceZ = 0.3;

  // yard and garden ground
  groundQuad(ctx, L, p.ry, 0.2, fenceZ, p.W - 0.2, Math.min(p.D, HD + 6), SURF.yard, TILE.yard);
  groundQuad(ctx, L, p.ry, 0.2, HD + 6, p.W - 0.2, p.D - 0.2, SURF.dirt, TILE.dirt);

  addHouse(ctx, L, hx, fenceZ, HW, HD, style, rng, p.ry, { dish: rng.chance(0.3) });

  // gate beside the house, fence for the rest of the front
  const gateColor = rng.pick(GATES);
  const gx = houseLeft ? hx + HW + 0.5 : hx - 0.5 - 4.65;
  const g = gate(ctx, L, p.ry, gx, fenceZ, gateColor, rng);
  const fenceKind = rng.pick(['plank', 'sheet', 'sheet']);
  const fenceCol = fenceKind === 'plank' ? rng.pick([0x9a9384, 0x8e8474, 0xa8a090]) : rng.pick([0x3f7a52, 0x4d7fae, 0x5a4a3a, 0x9aa2a6, gateColor]);
  if (houseLeft) {
    fenceRun(ctx, L, p.ry, hx + HW, fenceZ, gx - 0.06, fenceZ, fenceKind, fenceCol);
    fenceRun(ctx, L, p.ry, gx + g.width, fenceZ, p.W, fenceZ, fenceKind, fenceCol);
  } else {
    fenceRun(ctx, L, p.ry, 0, fenceZ, gx - 0.06, fenceZ, fenceKind, fenceCol);
    fenceRun(ctx, L, p.ry, gx + g.width, fenceZ, hx, fenceZ, fenceKind, fenceCol);
  }
  // side fence on the left (the neighbour draws the right one) and the back
  fenceRun(ctx, L, p.ry, 0, fenceZ, 0, p.D, 'plank', rng.pick([0x9a9384, 0x8e8474]), { h: 1.7 });
  if (p.lastInRow) fenceRun(ctx, L, p.ry, p.W, fenceZ, p.W, p.D, 'plank', 0x9a9384, { h: 1.7 });
  if (p.back !== false) fenceRun(ctx, L, p.ry, 0, p.D, p.W, p.D, 'plank', 0x8e8474, { h: 1.8 });

  // yard: shed, outhouse, clothes line, a water barrel
  const yardX = houseLeft ? hx + HW + 0.8 : 0.8;
  const yardX1 = houseLeft ? p.W - 0.8 : hx - 0.8;
  shed(ctx, L, p.ry, houseLeft ? p.W - 4.6 : 0.8, HD + 1.6, rng);
  outhouse(ctx, L, p.ry, houseLeft ? p.W - 1.4 : 1.4, p.D - 1.3);
  if (yardX1 - yardX > 2.5) clothesLine(ctx, L, p.ry, yardX + 0.4, HD * 0.55, yardX1 - 0.4, HD * 0.6, rng);
  const barrel = L(houseLeft ? hx + HW + 0.6 : hx - 0.6, HD - 0.6);
  batch.cyl(0.32, 0.9, rng.pick([0x3e6aa6, 0x4f8a4a, 0x7a2626]), barrel[0], 0, barrel[1], { seg: 10 });

  // garden: beds and whitewashed fruit trees
  const g0 = HD + 5.2, g1 = p.D - 2.8;
  if (g1 - g0 > 2) beds(ctx, L, p.ry, 1.2, g0, p.W - (houseLeft ? 5.4 : 1.2), g1, rng);
  const trees = rng.int(1, 3);
  for (let i = 0; i < trees; i++) {
    const t = L(rng.range(1.8, p.W - 1.8), rng.range(HD + 3, p.D - 2));
    addTree(batch, rng.pick(['maple', 'young', 'elm']), t[0], t[1], p.seed * 7 + i, { scale: rng.range(0.6, 0.8) });
    ctx.colliders.circle(t[0], t[1], 0.2, { tag: 'tree' });
  }

  // a bench outside the wicket
  const bench = L(houseLeft ? gx + 4.2 : gx - 1.2, -0.6);
  if (p.bench !== false) {
    addBench(batch, bench[0], bench[1], p.ry + Math.PI, { style: 'yard', color: rng.pick([0x6b5238, 0x3f7a52, 0x4d7fae]), len: 1.5 });
    ctx.colliders.obb(bench[0], bench[1], 0.8, 0.3, p.ry, { top: 0.5, tag: 'bench' });
  }

  const houseMid = L(hx + HW / 2, fenceZ + HD / 2);
  return {
    gateWorld: g.center, benchWorld: bench, houseWorld: houseMid,
    houseFront: [hx, hx + HW], gateLocal: gx, houseLeft, L, HW, HD,
  };
}

/** A ground-cover quad in plot-local space. */
function groundQuad(ctx, L, ry, x0, z0, x1, z1, mat, tile) {
  if (x1 - x0 < 0.1 || z1 - z0 < 0.1) return;
  const a = L(x0, z0), b = L(x1, z0), c = L(x1, z1), d = L(x0, z1);
  const y = -0.03;
  const pts = [[a[0], y, a[1]], [b[0], y, b[1]], [c[0], y, c[1]], [d[0], y, d[1]]];
  const g = quad(pts, [[0, 0], [0, 0], [0, 0], [0, 0]], [0, 1, 0]);
  worldUV(g, tile);
  ctx.batch.add(g, { mat, color: null, cast: false });
}

export { WALLS, gate, shed, outhouse };
