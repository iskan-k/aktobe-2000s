import * as THREE from 'three';
import { PAL } from '../core/palette.js';
import { SURF, TILE, hQuad, worldUV, splitRect } from '../core/surfaces.js';
import { rngKit } from '../core/util.js';
import {
  ROADS, JUNCTIONS, KERB_H, KERB_W, CORNER_R, GROUND_Y, BOUNDS, PORTAL_REACH,
  halfWidth, roadById,
} from './plan.js';

/* ------------------------------------------------------------------ *
 * Streets: carriageways, pavements, kerbs, corner fillets, tree strips
 * and road markings, all generated from ROADS / JUNCTIONS in plan.js.
 *
 * Heights: bare earth at GROUND_Y (-0.04), asphalt at 0, pavements at
 * KERB_H (0.15). Pavements register as walkable ground.
 *
 * How pavements are cut (the three rules):
 *   1. A pavement along road R on side s is interrupted at a junction
 *      only where the crossing road has an arm on that side.
 *   2. Where a road ends at a junction it keeps going far enough to
 *      close the corner: an east-west road by the crossing road's width
 *      plus its pavement, a north-south road by the half width only
 *      (so the outer corner square is drawn once, not twice).
 *   3. Every junction quadrant with both arms present gets a corner
 *      piece with a rounded kerb of radius CORNER_R.
 * ------------------------------------------------------------------ */

const ASPHALT_Y = 0;
const PAINT_Y = 0.006;
const WHITE = 0xe8e5da;
const YELLOW = 0xe0b43a;

/** Along-axis intervals where a pavement on (road, side) is cut. */
function pavementCuts(r, side) {
  const cuts = [];
  for (const j of JUNCTIONS) {
    const crossing = r.axis === 'x' ? j.rz : j.rx;
    if ((r.axis === 'x' ? j.rx : j.rz) !== r) continue;
    const arm = r.axis === 'x' ? (side === 0 ? j.arms.N : j.arms.S) : (side === 0 ? j.arms.W : j.arms.E);
    if (!arm) continue;
    const at = crossing.c;
    const hw = halfWidth(crossing);
    cuts.push([at - hw - crossing.walk[0], at + hw + crossing.walk[1]]);
  }
  return cuts.sort((a, b) => a[0] - b[0]);
}

/** The road's own extent, stretched per rule 2 where it ends at a junction. */
function pavementExtent(r) {
  let a = r.a, b = r.b;
  for (const j of JUNCTIONS) {
    const own = r.axis === 'x' ? j.rx : j.rz;
    if (own !== r) continue;
    const crossing = r.axis === 'x' ? j.rz : j.rx;
    const at = crossing.c;
    const hw = halfWidth(crossing);
    if (Math.abs(at - r.a) < 0.01) a = at - hw - (r.axis === 'x' ? crossing.walk[0] : 0);
    if (Math.abs(at - r.b) < 0.01) b = at + hw + (r.axis === 'x' ? crossing.walk[1] : 0);
  }
  return [a, b];
}

function subtract([a, b], cuts) {
  let out = [[a, b]];
  for (const [c0, c1] of cuts) {
    const next = [];
    for (const [s0, s1] of out) {
      if (c1 <= s0 || c0 >= s1) { next.push([s0, s1]); continue; }
      if (c0 > s0) next.push([s0, c0]);
      if (c1 < s1) next.push([c1, s1]);
    }
    out = next;
  }
  return out.filter(([s0, s1]) => s1 - s0 > 0.05);
}

/** Convert road-local (along, across) to world (x, z). */
function toWorld(r, along, across) {
  return r.axis === 'x' ? [along, r.c + across] : [r.c + across, along];
}

/** World rectangle for along [a0, a1] x across [c0, c1] on road r. */
function rectOf(r, a0, a1, c0, c1) {
  const [x0, z0] = toWorld(r, a0, c0);
  const [x1, z1] = toWorld(r, a1, c1);
  return [Math.min(x0, x1), Math.min(z0, z1), Math.max(x0, x1), Math.max(z0, z1)];
}

export function buildRoads(ctx) {
  const { batch, ground } = ctx;
  const rng = rngKit(404);
  const treeSpots = [];
  const lampSpots = [];

  /* ---------------- base earth, out to the haze ---------------- */
  const reach = PORTAL_REACH + 400;
  const earth = new THREE.Mesh(hQuad(-reach, -reach, reach, reach, GROUND_Y - 0.01, TILE.dirt), SURF.dirt);
  earth.receiveShadow = true;
  earth.name = 'earth';
  ctx.root.add(earth);

  /* ---------------- carriageways ---------------- */
  for (const r of ROADS) {
    const hw = halfWidth(r);
    const [x0, z0, x1, z1] = rectOf(r, r.a, r.b, -hw, hw);
    for (const q of splitRect(x0, z0, x1, z1, 40)) {
      batch.add(hQuad(q[0], q[1], q[2], q[3], ASPHALT_Y, TILE.asphalt), { mat: SURF.asphalt, color: null, cast: false });
    }
  }
  for (const j of JUNCTIONS) {
    const e = CORNER_R;
    batch.add(hQuad(j.x - j.hx - e, j.z - j.hz - e, j.x + j.hx + e, j.z + j.hz + e, ASPHALT_Y + 0.001, TILE.asphalt),
      { mat: SURF.asphalt, color: null, cast: false });
  }

  /* ---------------- pavements ---------------- */
  for (const r of ROADS) {
    const hw = halfWidth(r);
    const ext = pavementExtent(r);
    for (const side of [0, 1]) {
      const sgn = side === 0 ? -1 : 1;
      const walk = r.walk[side];
      if (walk <= 0) continue;
      const spans = subtract(ext, pavementCuts(r, side));
      for (const [s0, s1] of spans) {
        const inner = sgn * hw, outer = sgn * (hw + walk);
        const [x0, z0, x1, z1] = rectOf(r, s0, s1, Math.min(inner, outer), Math.max(inner, outer));
        pavementSlab(ctx, x0, z0, x1, z1);
        // kerb stone along the carriageway edge
        const kIn = sgn * hw, kOut = sgn * (hw + KERB_W);
        const k = rectOf(r, s0, s1, Math.min(kIn, kOut), Math.max(kIn, kOut));
        kerbRun(ctx, r, k, s0, s1);
        // tree strip
        const tw = r.trees[side];
        if (tw > 0 && s1 - s0 > 6) {
          const t0 = sgn * (hw + KERB_W + 0.1), t1 = sgn * (hw + KERB_W + 0.1 + tw);
          const a0 = s0 + 1.5, a1 = s1 - 1.5;
          const [tx0, tz0, tx1, tz1] = rectOf(r, a0, a1, Math.min(t0, t1), Math.max(t0, t1));
          for (const q of splitRect(tx0, tz0, tx1, tz1, 40)) {
            batch.add(hQuad(q[0], q[1], q[2], q[3], KERB_H + 0.004, TILE.grass), { mat: SURF.grass, color: null, cast: false });
          }
          // low concrete edging around the strip
          const edge = (c) => {
            const e = rectOf(r, a0, a1, Math.min(c, c + sgn * 0.08), Math.max(c, c + sgn * 0.08));
            batch.span(e[0], KERB_H, e[1], e[2], KERB_H + 0.07, e[3], PAL.concrete, { cast: false });
          };
          edge(t1);
          const mid = (t0 + t1) / 2;
          const spacing = r.major ? 7.5 : 9;
          for (let a = a0 + 2 + rng.range(0, 2); a < a1 - 1.5; a += spacing + rng.range(-1, 1.2)) {
            const [px, pz] = toWorld(r, a, mid);
            if (!inBounds(px, pz, 8)) continue;
            treeSpots.push({ x: px, z: pz, road: r.id, side, major: r.major });
          }
        }
        // lamp posts: at the kerb on the avenue, on the far side elsewhere
        const lampOff = sgn * (hw + KERB_W + 0.5);
        const lampStep = r.major ? 32 : 38;
        const lampsHere = r.major || side === 1;
        if (lampsHere && s1 - s0 > 10) {
          for (let a = s0 + 6; a < s1 - 4; a += lampStep) {
            const [px, pz] = toWorld(r, a, lampOff);
            if (!inBounds(px, pz, 4)) continue;
            lampSpots.push({ x: px, z: pz, road: r.id, side, facing: r.axis === 'x' ? (side === 0 ? 0 : Math.PI) : (side === 0 ? -Math.PI / 2 : Math.PI / 2) });
          }
        }
      }
    }
  }

  /* ---------------- corners ---------------- */
  for (const j of JUNCTIONS) {
    const quads = [
      ['N', 'E', 1, -1], ['N', 'W', -1, -1], ['S', 'E', 1, 1], ['S', 'W', -1, 1],
    ];
    for (const [ns, ew, sx, sz] of quads) {
      if (!j.arms[ns] || !j.arms[ew]) continue;
      const Wx = j.rz.walk[sx > 0 ? 1 : 0];
      const Wz = j.rx.walk[sz > 0 ? 1 : 0];
      cornerPiece(ctx, j.x + sx * j.hx, j.z + sz * j.hz, sx, sz, Wx, Wz);
    }
  }

  /* ---------------- markings ---------------- */
  for (const r of ROADS) markings(ctx, r);
  for (const j of JUNCTIONS) crossings(ctx, j);

  return { treeSpots, lampSpots };
}

function inBounds(x, z, m = 0) {
  return x > BOUNDS.x0 - m && x < BOUNDS.x1 + m && z > BOUNDS.z0 - m && z < BOUNDS.z1 + m;
}

/** Pavement: textured top, plain concrete sides, registered as ground. */
function pavementSlab(ctx, x0, z0, x1, z1) {
  const { batch, ground } = ctx;
  for (const q of splitRect(x0, z0, x1, z1, 40)) {
    batch.add(hQuad(q[0], q[1], q[2], q[3], KERB_H, TILE.walk), { mat: SURF.walk, color: null, cast: false });
    batch.span(q[0], GROUND_Y, q[1], q[2], KERB_H - 0.004, q[3], PAL.concreteDark, { cast: false });
  }
  ground.flat(x0, z0, x1, z1, KERB_H, 'pavement');
}

/**
 * Kerb stones along a straight run. The avenue's kerbs are painted in
 * black and white bands near junctions, the way they were whitewashed
 * every spring; elsewhere they are plain concrete, a little whiter
 * than the pavement.
 */
function kerbRun(ctx, r, k, s0, s1) {
  const { batch } = ctx;
  const [x0, z0, x1, z1] = k;
  const H = KERB_H + 0.025;
  const striped = r.major;
  if (!striped) {
    for (const q of splitRect(x0, z0, x1, z1, 40)) {
      batch.span(q[0], ASPHALT_Y - 0.02, q[1], q[2], H, q[3], PAL.kerb, { cast: false });
    }
    return;
  }
  const band = 1.0;
  let i = 0;
  for (let a = s0; a < s1 - 0.01; a += band, i++) {
    const b = Math.min(a + band, s1);
    const nearJunction = JUNCTIONS.some((j) => {
      const at = r.axis === 'x' ? j.x : j.z;
      const own = r.axis === 'x' ? j.rx : j.rz;
      return own === r && Math.abs(a - at) < 30;
    });
    const color = nearJunction ? (i % 2 ? PAL.kerbDark : PAL.whitewash) : PAL.kerb;
    const q = r.axis === 'x' ? [a, z0, b, z1] : [x0, a, x1, b];
    batch.span(q[0], ASPHALT_Y - 0.02, q[1], q[2], H, q[3], color, { cast: false });
  }
}

/**
 * Corner piece at carriageway corner P = (px, pz). (sx, sz) points away
 * from the junction into the block. Wx / Wz are the pavement widths
 * along x / z. The kerb curves with radius CORNER_R.
 */
function cornerPiece(ctx, px, pz, sx, sz, Wx, Wz) {
  const { batch, ground } = ctx;
  const R = Math.min(CORNER_R, Wx - 0.3, Wz - 0.3, CORNER_R);
  // shape in local (u, v) with u along +x*sx, v along +z*sz
  const shape = new THREE.Shape();
  shape.moveTo(R, 0);
  shape.lineTo(Wx, 0);
  shape.lineTo(Wx, Wz);
  shape.lineTo(0, Wz);
  shape.lineTo(0, R);
  shape.absarc(R, R, R, Math.PI, Math.PI * 1.5, false);

  const toWorldGeo = (g, y) => {
    // shape lies in XY; map (u, v) -> (px + sx*u, y, pz + sz*v)
    const m = new THREE.Matrix4().set(
      sx, 0, 0, px,
      0, 0, 1, y,
      0, sz, 0, pz,
      0, 0, 0, 1,
    );
    g.applyMatrix4(m);
    // a mirror flips the winding; flip it back so faces point up
    if (sx * sz > 0) flipWinding(g);
    return g;
  };

  const top = toWorldGeo(new THREE.ShapeGeometry(shape, 8), KERB_H);
  fixUp(top);
  batch.add(worldUV(top, TILE.walk), { mat: SURF.walk, color: null, cast: false });

  const body = new THREE.ExtrudeGeometry(shape, { depth: KERB_H - GROUND_Y - 0.004, bevelEnabled: false, curveSegments: 8 });
  body.translate(0, 0, 0);
  const bodyW = toWorldGeo(body, GROUND_Y);
  batch.add(bodyW, { color: PAL.concreteDark, cast: false });

  // curved kerb stone: a thin ring sector just inside the arc
  const ring = new THREE.Shape();
  const r0 = R, r1 = R - KERB_W;
  ring.absarc(R, R, r0, Math.PI, Math.PI * 1.5, false);
  ring.absarc(R, R, r1, Math.PI * 1.5, Math.PI, true);
  const kerbGeo = new THREE.ExtrudeGeometry(ring, { depth: KERB_H + 0.045, bevelEnabled: false, curveSegments: 8 });
  batch.add(toWorldGeo(kerbGeo, -0.02), { color: PAL.kerb, cast: false });
  // straight kerb returns from the arc ends to the pavement edges
  const kx = (u0, u1, v0, v1) => {
    const a = [px + sx * u0, pz + sz * v0], b = [px + sx * u1, pz + sz * v1];
    batch.span(Math.min(a[0], b[0]), -0.02, Math.min(a[1], b[1]), Math.max(a[0], b[0]), KERB_H + 0.025, Math.max(a[1], b[1]), PAL.kerb, { cast: false });
  };
  kx(R, Wx, 0, KERB_W);
  kx(0, KERB_W, R, Wz);

  // walkable: the square minus the fillet, approximated by two rectangles
  const rect = (u0, u1, v0, v1) => {
    const xA = px + sx * u0, xB = px + sx * u1, zA = pz + sz * v0, zB = pz + sz * v1;
    ground.flat(Math.min(xA, xB), Math.min(zA, zB), Math.max(xA, xB), Math.max(zA, zB), KERB_H, 'pavement');
  };
  rect(R * 0.3, Wx, R * 0.3 + R * 0.35, Wz);
  rect(R * 0.3 + R * 0.35, Wx, R * 0.3, Wz);
}

function flipWinding(g) {
  const idx = g.index;
  if (idx) {
    const a = idx.array;
    for (let i = 0; i < a.length; i += 3) { const t = a[i + 1]; a[i + 1] = a[i + 2]; a[i + 2] = t; }
    idx.needsUpdate = true;
  } else {
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i += 3) {
      for (let c = 0; c < 3; c++) {
        const t = p.array[(i + 1) * 3 + c];
        p.array[(i + 1) * 3 + c] = p.array[(i + 2) * 3 + c];
        p.array[(i + 2) * 3 + c] = t;
      }
    }
    p.needsUpdate = true;
  }
  g.computeVertexNormals();
}

/** Make sure a flat horizontal geometry faces up. */
function fixUp(g) {
  g.computeVertexNormals();
  const n = g.attributes.normal;
  if (n.count && n.getY(0) < 0) flipWinding(g);
}

/* ------------------------------------------------------------------ *
 * Markings
 * ------------------------------------------------------------------ */

function paintRect(ctx, x0, z0, x1, z1, color = WHITE) {
  ctx.batch.add(hQuad(x0, z0, x1, z1, PAINT_Y, TILE.paint), { mat: SURF.paint, color, cast: false, receive: true });
}

/** Road-local painted strip. */
function paintAlong(ctx, r, a0, a1, c0, c1, color) {
  const [x0, z0, x1, z1] = rectOf(r, a0, a1, Math.min(c0, c1), Math.max(c0, c1));
  paintRect(ctx, x0, z0, x1, z1, color);
}

/** Along-axis stretches of a road that are not inside a junction box. */
function openSpans(r) {
  const cuts = [];
  for (const j of JUNCTIONS) {
    if ((r.axis === 'x' ? j.rx : j.rz) !== r) continue;
    const crossing = r.axis === 'x' ? j.rz : j.rx;
    const hw = halfWidth(crossing);
    const gap = j.rx.major || j.signal ? 5.0 : 1.0;
    cuts.push([crossing.c - hw - gap, crossing.c + hw + gap]);
  }
  return subtract([r.a, r.b], cuts.sort((a, b) => a[0] - b[0]));
}

function markings(ctx, r) {
  const hw = halfWidth(r);
  for (const [s0, s1] of openSpans(r)) {
    for (const [a0, a1] of chop(s0, s1, 30)) {
      if (r.centre === 'double') {
        paintAlong(ctx, r, a0, a1, -0.2, -0.08, WHITE);
        paintAlong(ctx, r, a0, a1, 0.08, 0.2, WHITE);
      }
    }
    if (r.centre === 'dashed') {
      for (let a = s0 + 1; a < s1 - 3; a += 9) paintAlong(ctx, r, a, a + 3, -0.06, 0.06, WHITE);
    }
    // lane dividers on multi-lane roads
    for (let lane = 1; lane < r.lanes; lane++) {
      for (const sgn of [-1, 1]) {
        const c = sgn * lane * r.laneW;
        for (let a = s0 + 2; a < s1 - 3; a += 12) paintAlong(ctx, r, a, a + 3, c - 0.06, c + 0.06, WHITE);
      }
    }
    // edge lines on the avenue
    if (r.major) {
      for (const [a0, a1] of chop(s0, s1, 30)) {
        paintAlong(ctx, r, a0, a1, -hw + 0.25, -hw + 0.37, WHITE);
        paintAlong(ctx, r, a0, a1, hw - 0.37, hw - 0.25, WHITE);
      }
    }
  }
}

function chop(a, b, max) {
  const out = [];
  const n = Math.max(1, Math.ceil((b - a) / max));
  for (let i = 0; i < n; i++) out.push([a + ((b - a) * i) / n, a + ((b - a) * (i + 1)) / n]);
  return out;
}

/** Zebra crossings and stop lines on every arm of a junction. */
function crossings(ctx, j) {
  const zebra = (r, at, dirSign) => {
    // stripes run along the road direction, 0.5 m wide with 0.5 m gaps
    const hw = halfWidth(r);
    const depth = 3.0;
    const a0 = at + dirSign * 0.8, a1 = a0 + dirSign * depth;
    for (let c = -hw + 0.35; c < hw - 0.3; c += 1.0) {
      paintAlong(ctx, r, Math.min(a0, a1), Math.max(a0, a1), c, c + 0.5, WHITE);
    }
    // stop line across the approaching half, just before the zebra.
    // Right-hand traffic: on an east-west road the westbound lanes are on
    // the north half (across < 0), so the east arm's approach is across < 0;
    // on a north-south road the northbound lanes are east (across > 0).
    const s0 = at + dirSign * (depth + 1.4), s1 = s0 + dirSign * 0.4;
    const approachSide = r.axis === 'x' ? -dirSign : dirSign;
    const c0 = approachSide > 0 ? 0.2 : -hw;
    const c1 = approachSide > 0 ? hw : -0.2;
    paintAlong(ctx, r, Math.min(s0, s1), Math.max(s0, s1), c0, c1, WHITE);
  };
  const busy = j.rx.major || j.signal;
  if (!busy) return;
  // arms of the x road (E and W of the junction)
  if (j.arms.E) zebra(j.rx, j.x + j.hx, +1);
  if (j.arms.W) zebra(j.rx, j.x - j.hx, -1);
  if (j.arms.N) zebra(j.rz, j.z - j.hz, -1);
  if (j.arms.S) zebra(j.rz, j.z + j.hz, +1);
}

export { toWorld, rectOf, openSpans, roadById };
