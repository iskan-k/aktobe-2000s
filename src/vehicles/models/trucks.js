import { rectLamp, roundLamp, CHROME, BLACK, LAMP, AMBER, RED } from './carBuilder.js';
import { gazelleFront } from './vans.js';
import { sideText } from './buses.js';
import { tone } from '../kit.js';

/* ------------------------------------------------------------------ *
 * Work vehicles, built on the van builder with a short cab (`cabEnd`)
 * and a load body behind it:
 *
 *   gazelle3302   GAZelle with a canvas tent, the bazaar's workhorse
 *   gazelleBread  GAZelle with the bread-factory box
 *   uaz452        the UAZ "bukhanka" (loaf) van
 *   gaz3307       bonneted GAZ truck with a drop-side platform
 *   zil130        ZIL-130 milk tanker
 *   kamaz5511     orange KamAZ dump truck, three axles
 * ------------------------------------------------------------------ */

const WOOD = 0x8a6a48;
const FRAME = 0x242424;

/** Seeded pick from a list. */
const pick = (list, seed, k = 0) => list[Math.abs(Math.floor(seed * 7.31 + k * 3.17)) % list.length];

/** Chassis rails from behind the cab to the tail, and the rear lamp bar. */
function chassis(P, c, y, { hw = 0.45, lamps = true } = {}) {
  for (const sgn of [1, -1]) P.span(sgn * (hw - 0.08), y - 0.2, c.zEnd - 0.2, sgn * hw, y, c.zR - 0.05, FRAME);
  P.span(-c.W / 2 + 0.05, y - 0.22, c.zR - 0.1, c.W / 2 - 0.05, y - 0.08, c.zR, FRAME);
  if (lamps) {
    rectLamp(P, c.W / 2 - 0.2, y - 0.15, c.zR + 0.005, 0.16, 0.09, RED, 1, 0.04);
    rectLamp(P, c.W / 2 - 0.36, y - 0.15, c.zR + 0.005, 0.1, 0.07, AMBER, 1, 0.04);
  }
}

/** Black mudguards over the rear wheels. */
function mudguards(P, c, hw) {
  for (const z of c.s.zRear) {
    for (const sgn of [1, -1]) P.span(sgn * (hw - 0.02), c.s.r * 2 + 0.05, z - c.s.r - 0.1, sgn * (hw - 0.5), c.s.r * 2 + 0.09, z + c.s.r + 0.1, BLACK);
  }
}

/** A flat deck with drop sides (boards) around it. */
function platform(P, c, { z0, z1, y, hw, h, color }) {
  P.span(-hw, y - 0.1, z0, hw, y, z1, WOOD);
  for (const sgn of [1, -1]) {
    P.span(sgn * hw, y, z0, sgn * (hw - 0.04), y + h, z1, color);
    for (const z of [z0 + (z1 - z0) / 3, z0 + (2 * (z1 - z0)) / 3]) P.box(0.05, h, 0.05, tone(color, 0.8), sgn * (hw + 0.02), y + h / 2, z);
  }
  P.span(-hw, y, z0, hw, y + h + 0.12, z0 + 0.05, color);
  P.span(-hw, y, z1 - 0.04, hw, y + h, z1, color);
  for (const sgn of [1, -1]) P.box(0.04, 0.06, 0.1, CHROME, sgn * (hw - 0.3), y + h - 0.08, z1 + 0.02);
}

/** A canvas tent over a platform: rounded top, straps, a rear flap. */
function tent(P, c, { z0, z1, y, hw, top, color }) {
  P.span(-hw, y, z0, hw, top - 0.08, z1, color);
  P.span(-hw + 0.08, top - 0.1, z0, hw - 0.08, top, z1, color);
  for (const sgn of [1, -1]) P.box(0.11, 0.11, z1 - z0, color, sgn * (hw - 0.08), top - 0.08, (z0 + z1) / 2, { rz: Math.PI / 4 });
  const strap = tone(color, 0.7);
  for (let z = z0 + 0.4; z < z1 - 0.2; z += 0.6) {
    for (const sgn of [1, -1]) P.box(0.012, top - y - 0.1, 0.03, strap, sgn * (hw + 0.006), (y + top) / 2, z);
  }
  P.box(hw * 2 - 0.1, 0.03, 0.012, strap, 0, y + 0.3, z1 + 0.006);
}

/* ---------------- GAZelle cab variants ---------------- */

const GAZELLE_CAB = {
  L: 5.54, W: 2.03, Wmax: 2.1, r: 0.35, tyreW: 0.19, track: 1.7, zFront: -1.73, zRear: [1.17], dual: true,
  skirt: 0.42, noseBottom: 0.42, noseRound: 0.07,
  nose: [[-2.77, 0.93], [-2.72, 0.99], [-2.5, 1.05], [-1.95, 1.22]],
  screen: [-1.95, -1.3], belt: 1.22, winTop: 1.98, roofY: 2.2, floorY: 0.64,
  cabB: -0.72, cabEnd: -0.5, driverZ: 0.88, browSlope: 0.14,
  plateFront: { y: 0.47, z: -2.86 },
  plateRear: { y: 0.72, z: 2.8 },
  lamps: {
    brake: [{ x: 0.85, y: 0.83, w: 0.16, h: 0.09 }],
    frontBlink: [{ x: 0.7, y: 0.64, w: 0.13, h: 0.06 }],
    rearBlink: [{ x: 0.69, y: 0.83, w: 0.1, h: 0.07 }],
  },
  front: gazelleFront,
  kind: 'truck', engine: 'petrol', fringe: false,
};

const gazelle3302 = {
  ...GAZELLE_CAB, id: 'gazelle3302', weight: 2, H: 2.47,
  colors: [[0xecebe4, 6], [0x3e5f8a, 2], [0xb8bcbe, 1]],
  load(P, c) {
    chassis(P, c, 0.9);
    mudguards(P, c, 1.02);
    const y = 1.0, hw = 1.05;
    platform(P, c, { z0: -0.42, z1: c.zR - 0.02, y, hw, h: 0.38, color: 0x7a7c78 });
    tent(P, c, { z0: -0.4, z1: c.zR - 0.04, y: y + 0.38, hw: hw - 0.01, top: 2.45, color: pick([0x3c5a7a, 0x4d5e3e, 0x7a7a70, 0x2f4f6f], c.seed) });
  },
};

const gazelleBread = {
  ...GAZELLE_CAB, id: 'gazelleBread', weight: 1, H: 2.52,
  colors: [[0xecebe4, 5], [0x3e5f8a, 1]],
  load(P, c) {
    chassis(P, c, 0.9);
    mudguards(P, c, 1.02);
    const z0 = -0.42, z1 = c.zR - 0.02, y = 1.0, hw = 1.05, top = 2.5;
    P.span(-hw, y, z0, hw, top, z1, 0xe9e6dc);
    P.span(-hw - 0.004, y + 0.18, z0, hw + 0.004, y + 0.28, z1, 0x2f5d9a);           // blue band
    for (const sgn of [1, -1]) {
      sideText(P, 'bread-ru', 'ХЛЕБ', sgn * (hw + 0.006), 1.95, (z0 + z1) / 2, 1.6, 0.46, '#a8321f', { bg: '#e9e6dc', ry: sgn * Math.PI / 2 });
      sideText(P, 'bread-kz', 'НАН · Ақтөбе нан комбинаты', sgn * (hw + 0.006), 1.55, (z0 + z1) / 2, 2.2, 0.2, '#2f3a4a', { bg: '#e9e6dc', ry: sgn * Math.PI / 2 });
    }
    // rear doors
    P.box(0.012, top - y - 0.1, 0.01, 0x8a8a86, 0, (y + top) / 2, z1 + 0.004);
    for (const sgn of [1, -1]) for (const yy of [y + 0.35, top - 0.35]) P.box(0.08, 0.04, 0.03, CHROME, sgn * (hw - 0.06), yy, z1 + 0.012);
  },
};

/* ---------------- UAZ-452 "bukhanka" ---------------- */

const uaz452 = {
  id: 'uaz452', kind: 'car', engine: 'petrol', weight: 2, company: false,
  L: 4.36, W: 1.94, r: 0.37, tyreW: 0.21, track: 1.45, zFront: -1.23, zRear: [1.07],
  skirt: 0.42, noseBottom: 0.42, noseRound: 0.16, roofRound: 0.17,
  nose: [[-2.18, 1.06], [-2.14, 1.16], [-2.06, 1.22]],
  screen: [-2.06, -1.95], belt: 1.22, winTop: 1.72, roofY: 2.06, floorY: 0.72,
  cabB: -1.2, driverZ: 0.72, browSlope: 0.24, eyeUp: 1.05,
  pillars: [-1.2, -0.2, 0.8, 1.82], glazed: true,
  rearWindow: [1.32, 1.68],
  colors: [[0x5b6a3c, 5], [0x5b6b73, 2], [0xd9d6c8, 2], [0x8a8a62, 1]],
  plateFront: { y: 0.52, z: -2.26 },
  plateRear: { y: 0.66, z: 2.192 },
  fringe: false, curtain: null,
  lamps: {
    brake: [{ x: 0.82, y: 0.78, w: 0.1, h: 0.1 }],
    frontBlink: [{ x: 0.66, y: 1.1, w: 0.1, h: 0.05 }],
    rearBlink: [{ x: 0.82, y: 0.92, w: 0.1, h: 0.07 }],
  },
  front(P, c) {
    const z = c.zF;
    roundLamp(P, 0.62, 0.9, z, 0.09, -1, { bezel: CHROME, depth: 0.05 });
    for (let i = -3; i <= 3; i++) P.box(0.035, 0.26, 0.02, 0x2a2a2a, i * 0.07, 0.86, z - 0.005);
    rectLamp(P, 0.66, 1.1, z + 0.02, 0.1, 0.05, AMBER, -1, 0.03);
    P.span(-c.hw + 0.05, 0.4, z - 0.1, c.hw - 0.05, 0.52, z + 0.05, 0x2a2b2c);
  },
  rear(P, c) {
    rectLamp(P, 0.82, 0.8, c.zR + 0.01, 0.12, 0.2, RED, 1, 0.04);
    P.box(0.03, 0.05, 0.14, CHROME, 0.15, 1.1, c.zR + 0.015);
  },
  details(P, c) {
    // the kerb-side hinged door behind the cab: seams and a handle
    for (const z of [-0.18, 0.72]) P.box(0.008, c.winTop - c.skirt - 0.1, 0.012, 0x2a2a2a, c.hw + 0.003, (c.winTop + c.skirt) / 2, z);
    P.box(0.03, 0.04, 0.14, CHROME, c.hw + 0.01, 1.05, 0.55);
    // the ladder to the roof rack is on the ambulance only; this one has a spare wheel
    P.cyl(0.33, 0.18, 0x1c1c1c, 0.5, 0.92, c.zR + 0.1, { axis: 'z', seg: 12 });
  },
};

/* ---------------- bonneted trucks ---------------- */

const gaz3307 = {
  id: 'gaz3307', kind: 'truck', engine: 'petrol', weight: 1, H: 2.36,
  L: 6.55, W: 2.2, Wmax: 2.38, r: 0.47, tyreW: 0.24, track: 1.8, zFront: -2.075, zRear: [1.695], dual: true,
  skirt: 0.95, noseBottom: 0.62, noseRound: 0.04,
  nose: [[-3.275, 1.36], [-3.2, 1.45], [-1.8, 1.56]],
  bonnet: { hw: 0.56, wingFront: 0.08, wing: [[-3.2, 0.9], [-3.05, 1.1], [-2.3, 1.15], [-1.8, 1.18]] },
  screen: [-1.8, -1.68], belt: 1.58, winTop: 2.08, roofY: 2.34, floorY: 1.12, roofRound: 0.12,
  cabB: -0.72, cabEnd: -0.52, driverZ: 0.78, browSlope: 0.08, eyeUp: 1.1, fringe: false,
  colors: [[0x2f5d8a, 4], [0x4a6a3a, 3], [0xd9d6c8, 2], [0x8a3a2a, 1]],
  plateFront: { y: 0.62, z: -3.37 },
  plateRear: { y: 0.95, z: 3.3 },
  lamps: {
    brake: [{ x: 0.99, y: 0.95, w: 0.16, h: 0.09 }],
    frontBlink: [{ x: 0.82, y: 1.02, w: 0.1, h: 0.06, z: -3.2 }],
    rearBlink: [{ x: 0.83, y: 0.95, w: 0.1, h: 0.07 }],
  },
  front(P, c) {
    const z = c.zF;
    // tall grille with vertical bars, lamps out in the wings
    P.box(0.9, 0.62, 0.03, 0x2a2b2c, 0, 1.02, z - 0.005);
    for (let i = -5; i <= 5; i++) P.box(0.03, 0.58, 0.02, 0x6a6c6c, i * 0.08, 1.02, z - 0.02);
    roundLamp(P, 0.86, 0.98, z + 0.08, 0.1, -1, { bezel: CHROME, depth: 0.06 });
    P.span(-c.W / 2 - 0.02, 0.5, z - 0.12, c.W / 2 + 0.02, 0.7, z + 0.02, 0x1f1f1f);
    for (const sgn of [1, -1]) P.box(0.08, 0.3, 0.3, 0x1f1f1f, sgn * 0.7, 0.8, z + 0.1);
  },
  load(P, c) {
    chassis(P, c, 1.2, { hw: 0.5 });
    mudguards(P, c, 1.19);
    platform(P, c, { z0: -0.42, z1: c.zR - 0.02, y: 1.32, hw: 1.19, h: 0.5, color: pick([0x5d6b4a, 0x6a6a64, 0x7a5a3a], c.seed) });
    // a few sacks on board (potatoes from the dacha, or cement)
    for (let i = 0; i < 4; i++) P.blob(0.32, 0.18, 0.24, pick([0xcfc5a8, 0xb9ad8a, 0xd9d2c0], c.seed, i), -0.6 + (i % 2) * 0.55, 1.5, 1.2 + Math.floor(i / 2) * 0.55);
  },
};

const zil130 = {
  id: 'zil130', kind: 'truck', engine: 'petrol', weight: 1, H: 2.8,
  L: 6.68, W: 2.36, Wmax: 2.5, r: 0.48, tyreW: 0.25, track: 1.9, zFront: -2.09, zRear: [1.71], dual: true,
  skirt: 0.98, noseBottom: 0.6, noseRound: 0.03,
  nose: [[-3.34, 1.3], [-3.25, 1.37], [-1.92, 1.52]],
  bonnet: { hw: 0.8, wingFront: 0.04, wing: [[-3.3, 0.95], [-3.12, 1.14], [-1.92, 1.2]] },
  screen: [-1.92, -1.74], belt: 1.52, winTop: 2.08, roofY: 2.4, floorY: 1.1, roofRound: 0.14,
  cabB: -0.8, cabEnd: -0.6, driverZ: 0.8, browSlope: 0.08, eyeUp: 1.1, fringe: false,
  colors: [[0x6f93ac, 4], [0x4f6f8a, 2], [0xd9d6c8, 1]],
  plateFront: { y: 0.64, z: -3.44 },
  plateRear: { y: 0.98, z: 3.36 },
  lamps: {
    brake: [{ x: 1.05, y: 0.96, w: 0.16, h: 0.09 }],
    frontBlink: [{ x: 0.95, y: 0.8, w: 0.1, h: 0.06 }],
    rearBlink: [{ x: 0.89, y: 0.96, w: 0.1, h: 0.07 }],
  },
  front(P, c) {
    const z = c.zF;
    // the wide ZIL grille with horizontal bars, lamps in the wings
    P.box(1.36, 0.36, 0.03, 0x2a2b2c, 0, 1.02, z - 0.005);
    for (const y of [0.9, 0.98, 1.06, 1.14]) P.box(1.32, 0.03, 0.02, CHROME, 0, y, z - 0.02);
    roundLamp(P, 0.92, 1.02, z + 0.05, 0.1, -1, { bezel: CHROME, depth: 0.06 });
    P.span(-c.W / 2, 0.52, z - 0.1, c.W / 2, 0.72, z + 0.02, 0x2a2a2a);
  },
  load(P, c) {
    chassis(P, c, 1.2, { hw: 0.5 });
    mudguards(P, c, 1.2);
    const z0 = -0.4, z1 = c.zR - 0.3, cy = 2.0, r = 0.78;
    P.span(-0.7, 1.2, z0, 0.7, 1.3, z1, FRAME);
    P.cyl(r, z1 - z0, 0xe7e2d0, 0, cy, (z0 + z1) / 2, { axis: 'z', seg: 16 });
    for (const z of [z0, z1]) P.cyl(r * 0.94, 0.08, tone(0xe7e2d0, 0.9), 0, cy, z, { axis: 'z', seg: 16 });
    P.cyl(r + 0.01, 0.34, 0x2f5d9a, 0, cy, (z0 + z1) / 2 - 1.0, { axis: 'z', seg: 16 });
    P.cyl(r + 0.01, 0.34, 0x2f5d9a, 0, cy, (z0 + z1) / 2 + 1.0, { axis: 'z', seg: 16 });
    for (const sgn of [1, -1]) sideText(P, 'milk', 'МОЛОКО', sgn * (r + 0.02), cy, (z0 + z1) / 2, 1.4, 0.34, '#2f5d9a', { bg: '#e7e2d0', ry: sgn * Math.PI / 2 });
    P.cyl(0.22, 0.12, 0xcfccc2, 0, cy + r, (z0 + z1) / 2, { seg: 10 });        // manhole
    P.span(-0.6, 1.2, z1, 0.6, 1.8, c.zR - 0.02, 0x8a8a86);                   // hose cabinet
    for (const y of [1.9, 2.1, 2.3, 2.5]) P.box(0.4, 0.03, 0.03, CHROME, 0.3, y, z1 + 0.05);
  },
};

/* ---------------- KamAZ dump truck ---------------- */

const kamaz5511 = {
  id: 'kamaz5511', kind: 'truck', engine: 'diesel', weight: 1, H: 2.95,
  L: 7.14, W: 2.5, r: 0.52, tyreW: 0.28, track: 2.02, zFront: -2.27, zRear: [0.93, 2.25], dual: true,
  skirt: 1.02, noseBottom: 0.95, noseRound: 0.03, roofRound: 0.1,
  nose: [[-3.57, 1.95], [-3.5, 2.0]],
  screen: [-3.5, -3.4], belt: 2.0, winTop: 2.6, roofY: 2.85, floorY: 1.45,
  cabB: -2.1, cabEnd: -1.8, driverX: 0.6, driverZ: 0.72, browSlope: 0.08, eyeUp: 1.12, fringe: 0x2a2a6a,
  colors: [[0xe0892e, 5], [0x2f5d8a, 2], [0xd9d6c8, 1]],
  plateFront: { y: 0.66, z: -3.66 },
  plateRear: { y: 0.9, z: 3.59 },
  lamps: {
    brake: [{ x: 1.1, y: 0.95, w: 0.16, h: 0.1 }],
    frontBlink: [{ x: 1.0, y: 0.78, w: 0.1, h: 0.07, z: -3.66 }],
    rearBlink: [{ x: 0.93, y: 0.95, w: 0.1, h: 0.08 }],
  },
  front(P, c) {
    const z = c.zF;
    // grille slots under the screen, the steel bumper with the lamps in it
    P.box(1.5, 0.4, 0.03, 0x2a2b2c, 0, 1.55, z - 0.005);
    for (const y of [1.42, 1.5, 1.58, 1.66]) P.box(1.46, 0.035, 0.02, tone(c.body, 0.8), 0, y, z - 0.02);
    sideText(P, 'kamaz', 'КАМАЗ', 0, 1.84, z - 0.02, 0.6, 0.12, '#e9e6dc', { bg: '#2a2b2c', ry: Math.PI });
    P.span(-c.W / 2, 0.55, z - 0.1, c.W / 2, 0.92, z + 0.05, 0x3a3b3c);
    rectLamp(P, 0.8, 0.78, z - 0.1, 0.22, 0.14, LAMP, -1, 0.04);
    // steps under the doors and the black arch below the cab
    for (const sgn of [1, -1]) {
      P.span(sgn * (c.hw - 0.02), 0.62, -2.9, sgn * (c.hw - 0.3), 0.66, -2.55, BLACK);
      P.span(sgn * c.hw, 1.0, -2.87, sgn * (c.hw - 0.4), 1.1, -1.67, BLACK);
    }
  },
  load(P, c) {
    chassis(P, c, 1.22, { hw: 0.5 });
    mudguards(P, c, 1.2);
    const z0 = -1.62, z1 = c.zR - 0.06, y = 1.42, top = 2.32, hw = 1.2;
    const col = pick([0xe0892e, 0x8a8a86, 0x6a6a64], c.seed);
    P.span(-hw, y, z0, hw, y + 0.08, z1, tone(col, 0.85));
    for (const sgn of [1, -1]) P.span(sgn * hw, y, z0, sgn * (hw - 0.06), top, z1, col);
    P.span(-hw, y, z0, hw, 2.95, z0 + 0.06, col);
    P.span(-hw, y, z1 - 0.06, hw, top, z1, col);
    for (const sgn of [1, -1]) for (let z = z0 + 0.6; z < z1; z += 0.8) P.box(0.06, top - y, 0.08, tone(col, 0.8), sgn * (hw + 0.03), (y + top) / 2, z);
    // the canopy over the back of the cab, and a load of gravel
    P.span(-hw, 2.9, c.zEnd - 0.4, hw, 2.95, z0 + 0.06, tone(col, 0.9));
    P.blob(hw - 0.1, 0.35, (z1 - z0) / 2 - 0.2, 0x9a9184, 0, top - 0.12, (z0 + z1) / 2, { detail: 1 });
  },
};

export const TRUCK_SPECS = { gazelle3302, gazelleBread, uaz452, gaz3307, zil130, kamaz5511 };
