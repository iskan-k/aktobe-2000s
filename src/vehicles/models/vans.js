import { rectLamp, CHROME, BLACK, LAMP, AMBER, RED } from './carBuilder.js';
import { buildVan } from './vanBuilder.js';

/* ------------------------------------------------------------------ *
 * Marshrutkas: the GAZelle GAZ-3221 (the 1994 face, still most of the
 * fleet in 2007) and a Mercedes Sprinter T1N high roof bought used from
 * Germany. Both are ridden from inside.
 * ------------------------------------------------------------------ */

/** Lamp housings seen by day (the lit parts are separate meshes). */
function rearClusters(P, c, x, y, w, h) {
  rectLamp(P, x, y, c.zR + 0.01, w, h, RED, 1, 0.04);
  rectLamp(P, x, y + h / 2 + 0.05, c.zR + 0.01, w, 0.08, AMBER, 1, 0.04);
}

const gazelle3221 = {
  id: 'gazelle3221', kind: 'marshrutka', engine: 'petrol',
  L: 5.54, W: 2.03, r: 0.35, tyreW: 0.2, track: 1.72, zFront: -1.73, zRear: [1.17],
  skirt: 0.42, noseBottom: 0.42, noseRound: 0.07,
  nose: [[-2.77, 0.93], [-2.72, 0.99], [-2.5, 1.05], [-1.95, 1.22]],
  screen: [-1.95, -1.3], belt: 1.22, winTop: 1.98, roofY: 2.2, floorY: 0.64,
  cabB: -0.72, driverZ: 0.88, browSlope: 0.14,
  saloon: { pillars: [-0.72, 0.3, 1.45, 2.5], door: [-0.66, 0.3], pitch: 0.74, fill: 0.4, bench: 4 },
  rearWindow: [1.45, 1.94],
  color: 0xecebe4,
  plateFront: { y: 0.47, z: -2.86 },
  plateRear: { y: 0.66, z: 2.778 },
  lamps: {
    brake: [{ x: 0.9, y: 0.8, w: 0.12, h: 0.12 }],
    frontBlink: [{ x: 0.7, y: 0.64, w: 0.13, h: 0.06 }],
    rearBlink: [{ x: 0.9, y: 0.93, w: 0.12, h: 0.07 }],
  },
  front: gazelleFront,
  rear(P, c) { rearClusters(P, c, 0.9, 0.8, 0.12, 0.13); },
};

/** The first GAZelle face: square lamps either side of a black grille. */
export function gazelleFront(P, c) {
  const z = c.zF;
  rectLamp(P, 0.66, 0.77, z, 0.3, 0.16, LAMP, -1, 0.04);
  rectLamp(P, 0.66, 0.77, z + 0.005, 0.33, 0.19, BLACK, -1, 0.03);
  P.box(0.92, 0.22, 0.03, 0x1e1f20, 0, 0.77, z - 0.004);
  for (const y of [0.71, 0.77, 0.83]) P.box(0.88, 0.018, 0.02, 0x3a3b3c, 0, y, z - 0.02);
  P.box(0.1, 0.07, 0.02, CHROME, 0, 0.9, z - 0.01);                    // the deer badge
  rectLamp(P, 0.7, 0.64, z, 0.13, 0.06, AMBER, -1, 0.03);
  P.span(-c.hw + 0.02, 0.36, z - 0.09, c.hw - 0.02, 0.57, z + 0.12, 0x262728);   // bumper
  P.span(-0.4, 0.38, z - 0.1, 0.4, 0.42, z - 0.08, 0x1a1a1a);
}

const sprinter = {
  id: 'sprinter', kind: 'marshrutka', engine: 'diesel',
  L: 5.64, W: 1.93, r: 0.34, tyreW: 0.2, track: 1.66, zFront: -1.96, zRear: [1.59],
  skirt: 0.42, noseBottom: 0.44, noseRound: 0.1,
  nose: [[-2.82, 0.96], [-2.74, 1.03], [-2.3, 1.15], [-2.06, 1.22]],
  screen: [-2.06, -1.32], belt: 1.22, winTop: 1.92, roofY: 2.6, floorY: 0.6,
  cabB: -0.95, driverZ: 0.95, browSlope: 0.55, roofRound: 0.09,
  saloon: { pillars: [-0.95, 0.35, 1.5, 2.6], door: [-0.9, 0.35], pitch: 0.76, fill: 0.35, bench: 4 },
  rearWindow: [1.4, 1.9],
  color: 0xe9e9e6,
  fringe: 0x2f4a7a,
  plateFront: { y: 0.47, z: -2.9 },
  plateRear: { y: 0.66, z: 2.828 },
  lamps: {
    brake: [{ x: 0.87, y: 1.0, w: 0.1, h: 0.16 }],
    frontBlink: [{ x: 0.82, y: 0.86, w: 0.1, h: 0.12 }],
    rearBlink: [{ x: 0.87, y: 1.18, w: 0.1, h: 0.1 }],
  },
  front(P, c) {
    const z = c.zF;
    // big swept lamps, a three-bar grille and the star
    rectLamp(P, 0.56, 0.86, z + 0.02, 0.4, 0.2, LAMP, -1, 0.05, { ry: 0 });
    rectLamp(P, 0.82, 0.86, z + 0.03, 0.1, 0.13, AMBER, -1, 0.05);
    P.box(0.62, 0.24, 0.03, 0x2a2b2d, 0, 0.84, z - 0.004);
    for (const y of [0.77, 0.84, 0.91]) P.box(0.6, 0.025, 0.02, 0x9a9c9d, 0, y, z - 0.02);
    P.cyl(0.06, 0.02, CHROME, 0, 0.85, z - 0.03, { axis: 'z', seg: 12 });
    P.span(-c.hw + 0.03, 0.34, z - 0.08, c.hw - 0.03, 0.6, z + 0.14, 0x55585b);
    P.span(-0.45, 0.4, z - 0.09, 0.45, 0.5, z - 0.08, 0x2a2a2a);
  },
  rear(P, c) {
    // tall lamp clusters in the rear pillars
    rectLamp(P, 0.87, 1.02, c.zR + 0.01, 0.12, 0.34, RED, 1, 0.04);
    rectLamp(P, 0.87, 1.24, c.zR + 0.01, 0.12, 0.1, AMBER, 1, 0.04);
  },
};

export const VAN_SPECS = { gazelle3221, sprinter };
export { buildVan };
