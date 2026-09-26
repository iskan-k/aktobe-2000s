import * as THREE from 'three';
import { TILE, hQuad } from '../../core/surfaces.js';
import { RUNWAY, TAXIWAY, LINK_X, APRON, FENCE, B } from './layout.js';
import { slabs, paint, chainLink, SLAB_TILE } from './surfaces.js';

/* ------------------------------------------------------------------ *
 * The airfield out in the steppe: the 3.2 km runway with its paint and
 * edge lights, the parallel taxiway and its links, the approach light
 * line to the east, the PAPI, a windsock, and the perimeter fence along
 * the far end of ул. Айтеке би. It all goes into the airport's one-cell batch.
 * ------------------------------------------------------------------ */

const WHITE = 0xf2f0e8, YELLOW = 0xe8b830;
const CONC = 0xffffff, CONC_TAXI = 0xeeece6, RUBBER = 0xd2cec6;

/** Concrete from (x0, z0) to (x1, z1) with a vertex tint. */
function slab(batch, x0, z0, x1, z1, tint = CONC) {
  batch.add(hQuad(Math.min(x0, x1), Math.min(z0, z1), Math.max(x0, x1), Math.max(z0, z1), 0.0, SLAB_TILE),
    { mat: slabs(), color: tint, cast: false });
}

/** A painted rectangle. */
export function mark(batch, x0, z0, x1, z1, color = WHITE) {
  batch.add(hQuad(Math.min(x0, x1), Math.min(z0, z1), Math.max(x0, x1), Math.max(z0, z1), 0.01, TILE.paint),
    { mat: paint(), color, cast: false });
}

/* ---------------- runway numerals from a 5 x 7 grid ---------------- */

const GLYPHS = {
  0: ['01110', '10001', '10011', '10101', '11001', '10001', '01110'],
  1: ['00100', '01100', '00100', '00100', '00100', '00100', '01110'],
  2: ['01110', '10001', '00001', '00010', '00100', '01000', '11111'],
  3: ['11110', '00001', '00001', '01110', '00001', '00001', '11110'],
  4: ['00010', '00110', '01010', '10010', '11111', '00010', '00010'],
};

/**
 * Paint `text` for a pilot moving along [fx, fz]: the tops of the digits
 * point the way they travel. `scale` 1 is runway size (9 m tall).
 */
export function numerals(batch, text, x, z, [fx, fz], scale = 1, color = WHITE) {
  const cw = 0.62 * scale, ch = 1.3 * scale, gap = 1.6 * scale;
  const width = text.length * 5 * cw + (text.length - 1) * gap;
  // local frame: u to the pilot's right, v forward
  const right = [-fz, fx], fwd = [fx, fz];
  let u0 = -width / 2;
  for (const d of text) {
    const g = GLYPHS[d];
    for (let row = 0; row < 7; row++) {
      for (let col = 0; col < 5; col++) {
        if (g[row][col] !== '1') continue;
        const u = u0 + col * cw, v = (6 - row) * ch;
        const ax = x + right[0] * u + fwd[0] * v, az = z + right[1] * u + fwd[1] * v;
        const bx = ax + right[0] * cw + fwd[0] * ch, bz = az + right[1] * cw + fwd[1] * ch;
        mark(batch, ax, az, bx, bz, color);
      }
    }
    u0 += 5 * cw + gap;
  }
}

/* ---------------- runway ---------------- */

function runway(batch) {
  const { z, w, east, west, touchdown } = RUNWAY;
  const hw = w / 2;
  // concrete in lengths, darker with rubber in the touchdown zones
  for (let x = west; x < east; x += 200) {
    const x1 = Math.min(east, x + 200);
    const mid = (x + x1) / 2;
    const tdz = (mid < east - 60 && mid > east - 900) || (mid > west + 60 && mid < west + 700);
    slab(batch, x, z - hw, x1, z + hw, tdz ? RUBBER : CONC);
  }
  // blast pads and shoulders
  slab(batch, east, z - hw, east + 60, z + hw, 0xd8d4ca);
  slab(batch, west - 60, z - hw, west, z + hw, 0xd8d4ca);
  // paint: edges, centreline, threshold keys, numerals, aiming points, touchdown bars
  mark(batch, west, z - hw + 0.3, east, z - hw + 1.2);
  mark(batch, west, z + hw - 1.2, east, z + hw - 0.3);
  for (let x = east - 70; x > west + 70; x -= 50) mark(batch, x - 30, z - 0.45, x, z + 0.45);
  for (const [tx, dir] of [[east, -1], [west, 1]]) {
    for (let i = 0; i < 8; i++) {
      for (const s of [-1, 1]) {
        const zc = z + s * (3 + i * 2.3);
        mark(batch, tx + dir * 6, zc - 0.85, tx + dir * 36, zc + 0.85);
      }
    }
  }
  numerals(batch, '30', east - 60, z, [-1, 0]);
  numerals(batch, '12', west + 60, z, [1, 0]);
  for (const [ap, dir] of [[touchdown, -1], [west + 300, 1]]) {
    for (const s of [-1, 1]) mark(batch, ap - 30, z + s * 6, ap + 30, z + s * 16);
    for (const d of [150, 450, 600]) {
      for (const s of [-1, 1]) {
        const xc = dir < 0 ? east - d : west + d;
        for (const k of [0, 1]) mark(batch, xc - 11, z + s * (6 + k * 3.2), xc + 11, z + s * (7.8 + k * 3.2));
      }
    }
  }
}

/* ---------------- taxiways ---------------- */

function taxiways(batch) {
  const { z, w, x0, x1 } = TAXIWAY;
  const hw = w / 2;
  slab(batch, x0, z - hw, x1, z + hw, CONC_TAXI);
  // yellow centreline and the links: to the apron, the rapid exit, the east end, the take-off intersection
  mark(batch, x0 + 10, z - 0.15, x1 - 10, z + 0.15, YELLOW);
  const links = [
    { x: LINK_X, z0: APRON.z1 - 2, z1: z },
    { x: RUNWAY.exit, z0: z, z1: RUNWAY.z },
    { x: RUNWAY.lineup, z0: z, z1: RUNWAY.z },
    { x: RUNWAY.east - 20, z0: z, z1: RUNWAY.z },
  ];
  for (const l of links) {
    slab(batch, l.x - hw, l.z0, l.x + hw, l.z1 + (l.z1 === RUNWAY.z ? -RUNWAY.w / 2 : 0), CONC_TAXI);
    mark(batch, l.x - 0.15, l.z0 + 2, l.x + 0.15, l.z1 - (l.z1 === RUNWAY.z ? RUNWAY.w / 2 : hw), YELLOW);
    if (l.z1 === RUNWAY.z) {
      // the holding position: two solid and two dashed yellow lines across the link
      const hz = RUNWAY.z - RUNWAY.w / 2 - 20;
      mark(batch, l.x - hw, hz - 0.15, l.x + hw, hz + 0.15, YELLOW);
      mark(batch, l.x - hw, hz + 0.45, l.x + hw, hz + 0.75, YELLOW);
      for (let k = -hw; k < hw; k += 2) {
        mark(batch, l.x + k, hz + 1.2, l.x + k + 1, hz + 1.5, YELLOW);
        mark(batch, l.x + k, hz + 2.0, l.x + k + 1, hz + 2.3, YELLOW);
      }
    }
  }
  // fillets at the corners of the apron link
  slab(batch, LINK_X - hw - 12, z - hw - 8, LINK_X + hw + 12, z - hw, CONC_TAXI);
}

/* ---------------- lights, windsock, fence ---------------- */

function lamp(batch, x, z, color, h = 0.35) {
  batch.cyl(0.05, h, 0x5a5c5e, x, 0, z, { seg: 4, cast: false });
  batch.box(0.26, 0.2, 0.26, color, x, h, z, { mat: 'glow', cast: false });
}

function edgeLights(batch) {
  const { z, w, east, west } = RUNWAY;
  for (let x = west; x <= east; x += 60) {
    lamp(batch, x, z - w / 2 - 1.5, 0xfff4d8);
    lamp(batch, x, z + w / 2 + 1.5, 0xfff4d8);
  }
  // thresholds: green across the landing end, red across the far end
  for (let k = -w / 2; k <= w / 2; k += 3) {
    lamp(batch, east + 1, z + k, 0x6aff8a);
    lamp(batch, west - 1, z + k, 0xff5a4a);
  }
  // taxiway edges in blue
  for (let x = TAXIWAY.x0; x <= TAXIWAY.x1; x += 30) {
    lamp(batch, x, TAXIWAY.z - TAXIWAY.w / 2 - 1, 0x5a8aff, 0.3);
    lamp(batch, x, TAXIWAY.z + TAXIWAY.w / 2 + 1, 0x5a8aff, 0.3);
  }
  // PAPI: four boxes on the south side abeam the aiming point
  for (let i = 0; i < 4; i++) {
    const px = RUNWAY.touchdown, pz = z + w / 2 + 12 + i * 9;
    batch.box(1.2, 0.8, 0.8, 0xd8d4ca, px, 0, pz, { cast: false });
    batch.box(0.9, 0.4, 0.1, i < 2 ? 0xff5a4a : 0xfff4d8, px + 0.5, 0.3, pz, { mat: 'glow', ry: Math.PI / 2, cast: false });
  }
}

/** The approach lights: a line of short masts east of the threshold with crossbars. */
function approachLights(batch) {
  const { z, east } = RUNWAY;
  // 780 m of them: the steppe ends not far past the last mast
  for (let d = 30; d <= 780; d += 30) {
    const x = east + d;
    const h = 1.2 + d * 0.004;
    batch.box(0.25, h, 0.25, 0xd8d4ca, x, 0, z, { cast: false });
    batch.box(0.12, 0.12, 4.2, 0x7a7c7e, x, h, z, { cast: false });
    for (let k = -2; k <= 2; k++) batch.box(0.3, 0.3, 0.3, 0xfff4d8, x, h + 0.12, z + k * 1.0, { mat: 'glow', cast: false });
    if (d === 300 || d === 600) {
      batch.box(0.12, 0.12, 30, 0x7a7c7e, x, h, z, { cast: false });
      for (let k = -14; k <= 14; k += 2) batch.box(0.3, 0.3, 0.3, 0xfff4d8, x, h + 0.12, z + k, { mat: 'glow', cast: false });
    }
  }
}

function windsock(batch, x, z) {
  batch.cyl(0.08, 6, 0xe8e6e0, x, 0, z, { seg: 6, cast: false });
  // an orange and white cone, streaming west in the evening breeze
  for (let i = 0; i < 5; i++) {
    const g = new THREE.CylinderGeometry(0.42 - i * 0.05, 0.37 - i * 0.05, 0.9, 10, 1, true);
    g.rotateZ(Math.PI / 2);
    g.translate(x - 0.5 - i * 0.9, 5.7 - i * 0.08, z);
    batch.add(g, { color: i % 2 ? 0xf2f0e8 : 0xe8642a, cast: false });
  }
}

/** Chain-link fence from (x0, z0) to (x1, z1): concrete posts, mesh, three strands of barbed wire. */
export function meshFence(batch, x0, z0, x1, z1, { h = 2.4, cast = false } = {}) {
  const len = Math.hypot(x1 - x0, z1 - z0);
  const n = Math.max(1, Math.round(len / 3));
  const dx = (x1 - x0) / len, dz = (z1 - z0) / len;
  for (let i = 0; i <= n; i++) {
    const x = x0 + (x1 - x0) * (i / n), z = z0 + (z1 - z0) * (i / n);
    batch.box(0.14, h + 0.45, 0.14, 0xb4b0a6, x, 0, z, { cast });
  }
  // the mesh: one quad, uv in 0.25 m diamonds
  const g = new THREE.PlaneGeometry(len, h);
  const uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * len / 0.25, uv.getY(i) * h / 0.25);
  g.rotateY(Math.atan2(-dz, dx));
  g.translate((x0 + x1) / 2, h / 2 + 0.05, (z0 + z1) / 2);
  batch.add(g, { mat: chainLink(), color: 0xffffff, cast: false });
  for (const y of [h + 0.12, h + 0.26, h + 0.4]) batch.tube(x0, y, z0, x1, y, z1, 0.012, 0x4a4c4e, { seg: 3, cast: false });
  batch.tube(x0, h, z0, x1, h, z1, 0.02, 0x6a6c6e, { seg: 3, cast: false });
}

/** Build the airfield into `far`, a batch with one huge cell. */
export function buildAirfield(far) {
  runway(far);
  taxiways(far);
  edgeLights(far);
  approachLights(far);
  windsock(far, RUNWAY.touchdown - 80, RUNWAY.z + RUNWAY.w / 2 + 40);
  windsock(far, RUNWAY.lineup + 120, RUNWAY.z - RUNWAY.w / 2 - 40);
  // the perimeter fence: down the airport side of ул. Айтеке би past the
  // walkable land, across the end of the road, and on east into the steppe
  meshFence(far, FENCE.x, B.z1, FENCE.x, FENCE.zEnd);
  meshFence(far, FENCE.x, FENCE.zEnd, 1400, FENCE.zEnd);
  meshFence(far, -640, FENCE.z, B.x0, FENCE.z);
}
