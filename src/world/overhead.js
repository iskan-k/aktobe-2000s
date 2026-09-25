import { PAL } from '../core/palette.js';
import { JUNCTIONS, KERB_H, TROLLEY, halfWidth, roadById, BOUNDS } from './plan.js';

/* ------------------------------------------------------------------ *
 * The trolleybus overhead line on the avenue.
 *
 * Route 1 was the last trolleybus line in Aktobe (1982-2013) and it ran
 * down this avenue. Each direction has a pair of contact wires 0.6 m
 * apart, 5.8 m up over the centre of the kerb lane. They hang from span
 * wires strung across the whole avenue between concrete poles on the two
 * pavements, one pair of poles every 30 m, which is what gives the
 * avenue its web of wires against the sky.
 *
 * Pole positions go into ctx.spots.trolleyPoles so street furniture can
 * keep clear of them.
 * ------------------------------------------------------------------ */

const POLE_H = 9.2;
const SPAN_Y = 8.1;
const WIRE = 0x2a2826;

function sagTube(batch, ax, ay, az, bx, by, bz, sag, r, seg = 6) {
  let px = ax, py = ay, pz = az;
  for (let i = 1; i <= seg; i++) {
    const t = i / seg;
    const x = ax + (bx - ax) * t, z = az + (bz - az) * t;
    const y = ay + (by - ay) * t - Math.sin(Math.PI * t) * sag;
    batch.tube(px, py, pz, x, y, z, r, WIRE, { seg: 3, cast: false });
    px = x; py = y; pz = z;
  }
}

export function buildOverhead(ctx) {
  const { batch, colliders } = ctx;
  const r = roadById[TROLLEY.road];
  const hw = halfWidth(r);
  const laneC = hw - r.laneW / 2;
  const poleAcross = hw + 0.55;
  const junctions = JUNCTIONS.filter((j) => j.rx === r || j.rz === r);

  // along-positions of the supports, clear of junction boxes
  const supports = [];
  for (let a = -TROLLEY.reach; a <= TROLLEY.reach; a += TROLLEY.spacing) {
    const inJunction = junctions.some((j) => Math.abs(a - j.x) < j.hx + 7);
    if (!inJunction) supports.push(a);
  }

  const poles = [];
  for (const a of supports) {
    const inside = a > BOUNDS.x0 - 20 && a < BOUNDS.x1 + 20;
    for (const side of [-1, 1]) {
      const z = r.c + side * poleAcross;
      batch.cyl(0.17, POLE_H, PAL.concrete, a, KERB_H, z, { rTop: 0.11, seg: 8 });
      batch.cyl(0.13, 0.12, PAL.concreteDark, a, KERB_H + POLE_H, z, { seg: 8 });
      if (inside) colliders.circle(a, z, 0.22, { tag: 'trolley-pole' });
      poles.push({ x: a, z });
    }
    // span wire right across, and the droppers holding each contact wire
    sagTube(batch, a, SPAN_Y, r.c - poleAcross, a, SPAN_Y, r.c + poleAcross, 0.32, 0.011, 10);
    for (const side of [-1, 1]) {
      for (const off of [-TROLLEY.wireGap / 2, TROLLEY.wireGap / 2]) {
        const z = r.c + side * laneC + off;
        const t = (z - (r.c - poleAcross)) / (2 * poleAcross);
        const spanY = SPAN_Y - Math.sin(Math.PI * t) * 0.32;
        batch.tube(a, spanY, z, a, TROLLEY.wireY + 0.05, z, 0.008, WIRE, { seg: 3, cast: false });
        // insulator
        batch.cyl(0.035, 0.18, 0x6b4a36, a, spanY - 0.4, z, { seg: 5, cast: false });
      }
    }
  }

  // contact wires, support to support
  for (let i = 0; i < supports.length - 1; i++) {
    const a0 = supports[i], a1 = supports[i + 1];
    for (const side of [-1, 1]) {
      for (const off of [-TROLLEY.wireGap / 2, TROLLEY.wireGap / 2]) {
        const z = r.c + side * laneC + off;
        sagTube(batch, a0, TROLLEY.wireY, z, a1, TROLLEY.wireY, z, a1 - a0 > 40 ? 0.22 : 0.12, 0.012, 8);
      }
    }
  }

  ctx.spots.trolleyPoles = poles;
  return poles;
}
