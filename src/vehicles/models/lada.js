import {
  buildCar, rectLamp, roundLamp, bumper, doorLines, mirrors,
  CHROME, BLACK, RUBBER, LAMP, AMBER, RED, DARKRED,
} from './carBuilder.js';
import { buildInterior2107 } from './interior2107.js';

/* ------------------------------------------------------------------ *
 * The Zhiguli family and its descendants, the most common cars in
 * Aktobe in the 2000s (about a quarter of the fleet was LADA).
 *
 *   2106  "шестёрка": round twin headlamps in a chrome-edged panel,
 *         chrome bumpers with rubber strips, long horizontal tail lamps
 *   2107  "семёрка": square headlamps, the tall chrome grille that
 *         stands proud of the bonnet, big square tail lamps with the
 *         plate between them
 *   2104  the estate with the 2105 front
 *   2109  "девятка": the wedge five-door hatch, black plastic bumpers
 *   2110  "десятка": the rounded 90s saloon, body-coloured bumpers
 *   2121  Niva: short, tall, round lamps, wheel-arch flares
 * ------------------------------------------------------------------ */

const CLASSIC = {
  L: 4.145, W: 1.62, H: 1.446, wb: 2.424, r: 0.29, tyreW: 0.165, track: 1.36,
  sill: 0.23, noseY: 0.3, tailY: 0.33,
  cabin: [-0.98, 1.3],
  gh: {
    aBase: [-0.98, 0.875], aTop: [-0.41, 1.415], roofRear: [0.78, 1.42], cBase: [1.3, 0.9],
    hwBelt: 0.79, hwRoof: 0.655, pillars: [0.13], pW: [0.075, 0.05, 0.22, 0.09],
  },
  hipFront: -0.02, hipRear: 0.82,
};

function classicCommon(P, c, { roundLights }) {
  const { hw, zF, zR } = c;
  // drip rails and chrome window surround, the classic's jewellery
  for (const s of [1, -1]) {
    P.box(0.018, 0.018, 1.28, CHROME, s * 0.66, 1.405, 0.2);
    P.box(0.012, 0.012, 2.25, CHROME, s * (hw + 0.004), 0.64, 0.05);   // side molding
  }
  doorLines(P, hw, [-0.93, 0.13, 1.2], 0.25, 0.86, [[-0.18, 0.79], [1.0, 0.79]]);
  mirrors(P, hw, -0.82, 0.93, CHROME, false);
  // wipers parked at the base of the screen
  P.box(0.5, 0.012, 0.02, BLACK, -0.25, 0.9, -0.93, { ry: 0.05 });
  P.box(0.5, 0.012, 0.02, BLACK, 0.3, 0.9, -0.93, { ry: 0.05 });
  // exhaust
  P.cyl(0.028, 0.18, 0x444444, 0.45, 0.24, zR + 0.02, { axis: 'z', seg: 6 });
  if (roundLights) {
    // 2106: black panel with chrome edge and the four round lamps
    P.box(1.42, 0.24, 0.04, BLACK, 0, 0.64, zF - 0.005);
    P.box(1.46, 0.02, 0.05, CHROME, 0, 0.765, zF - 0.01);
    P.box(1.46, 0.02, 0.05, CHROME, 0, 0.515, zF - 0.01);
    roundLamp(P, 0.55, 0.64, zF - 0.01, 0.085);
    roundLamp(P, 0.35, 0.64, zF - 0.01, 0.07);
    for (let i = 0; i < 6; i++) P.box(0.4, 0.012, 0.02, CHROME, 0, 0.56 + i * 0.03, zF - 0.03);
  }
}

export const lada2106 = {
  id: 'lada2106', ...CLASSIC, L: 4.166, weight: 8, engine: 'petrol',
  top: [[-2.083, 0.78], [-2.03, 0.8], [-1.3, 0.83], [-0.98, 0.87], [1.3, 0.895], [1.96, 0.885], [2.083, 0.84]],
  plateFront: { y: 0.38 }, plateRear: { y: 0.6 },
  lamps: {
    brake: [{ x: 0.56, y: 0.62, w: 0.26, h: 0.06 }],
    frontBlink: [{ x: 0.63, y: 0.43, w: 0.12, h: 0.05 }],
    rearBlink: [{ x: 0.7, y: 0.56, w: 0.1, h: 0.05 }],
  },
  details(P, c) {
    classicCommon(P, c, { roundLights: true });
    const { zF, zR } = c;
    bumper(P, zF - 0.03, 0.38, 0.1, 0.8, -1, { strip: RUBBER });
    bumper(P, zR + 0.03, 0.4, 0.1, 0.8, 1, { strip: RUBBER });
    for (const s of [1, -1]) {
      P.box(0.05, 0.16, 0.05, CHROME, s * 0.4, 0.4, zF - 0.1);   // overriders
      P.box(0.05, 0.16, 0.05, CHROME, s * 0.4, 0.42, zR + 0.1);
    }
    // long tail lamps with a chrome frame
    rectLamp(P, 0.56, 0.6, zR + 0.005, 0.44, 0.16, CHROME, 1, 0.03);
    rectLamp(P, 0.56, 0.62, zR + 0.012, 0.42, 0.07, RED, 1, 0.03);
    rectLamp(P, 0.56, 0.56, zR + 0.012, 0.42, 0.05, AMBER, 1, 0.03);
    // C-pillar vent grilles
    for (const s of [1, -1]) P.box(0.01, 0.1, 0.16, CHROME, s * 0.73, 1.05, 1.08);
  },
};

export const lada2107 = {
  id: 'lada2107', ...CLASSIC, weight: 12, engine: 'petrol', interior: buildInterior2107,
  top: [[-2.072, 0.76], [-2.02, 0.78], [-1.3, 0.83], [-0.98, 0.875], [1.3, 0.9], [1.95, 0.89], [2.072, 0.84]],
  plateFront: { y: 0.36 }, plateRear: { y: 0.63 },
  lamps: {
    brake: [{ x: 0.56, y: 0.69, w: 0.34, h: 0.07 }],
    frontBlink: [{ x: 0.66, y: 0.45, w: 0.13, h: 0.05 }],
    rearBlink: [{ x: 0.56, y: 0.6, w: 0.34, h: 0.05 }],
  },
  details(P, c) {
    classicCommon(P, c, { roundLights: false });
    const { zF, zR } = c;
    // square headlamps in black surrounds
    rectLamp(P, 0.53, 0.64, zF, 0.3, 0.17, BLACK, -1, 0.05);
    rectLamp(P, 0.53, 0.64, zF - 0.012, 0.26, 0.13, LAMP, -1, 0.05);
    // the proud chrome grille
    P.box(0.5, 0.36, 0.06, CHROME, 0, 0.62, zF - 0.02);
    P.box(0.44, 0.3, 0.04, BLACK, 0, 0.62, zF - 0.035);
    for (let i = 0; i < 9; i++) P.box(0.012, 0.29, 0.02, CHROME, -0.2 + i * 0.05, 0.62, zF - 0.05);
    P.box(0.52, 0.03, 0.08, CHROME, 0, 0.8, zF + 0.01);
    // aluminium bumpers with black plastic ends
    bumper(P, zF - 0.03, 0.37, 0.11, 0.8, -1, { color: 0xb5b7b6, ends: BLACK, strip: RUBBER });
    bumper(P, zR + 0.03, 0.4, 0.11, 0.8, 1, { color: 0xb5b7b6, ends: BLACK, strip: RUBBER });
    // big tail lamps: red over amber over white, in black frames
    rectLamp(P, 0.56, 0.64, zR + 0.004, 0.4, 0.22, BLACK, 1, 0.03);
    rectLamp(P, 0.56, 0.69, zR + 0.012, 0.36, 0.08, RED, 1, 0.03);
    rectLamp(P, 0.56, 0.61, zR + 0.012, 0.36, 0.06, AMBER, 1, 0.03);
    rectLamp(P, 0.56, 0.56, zR + 0.012, 0.36, 0.04, 0xe8e2d2, 1, 0.03);
    // chrome strip on the boot lid
    P.box(0.6, 0.02, 0.02, CHROME, 0, 0.8, zR + 0.005);
  },
};

export const lada2104 = {
  id: 'lada2104', ...CLASSIC, weight: 3, engine: 'petrol',
  L: 4.115, H: 1.443,
  top: [[-2.057, 0.76], [-2, 0.78], [-1.3, 0.83], [-0.98, 0.875], [1.9, 0.9], [2.057, 0.88]],
  cabin: [-0.98, 1.9],
  gh: {
    aBase: [-0.98, 0.875], aTop: [-0.41, 1.415], roofRear: [1.96, 1.42], cBase: [2.03, 0.9],
    hwBelt: 0.79, hwRoof: 0.67, pillars: [0.13, 1.25], pW: [0.075, 0.05, 0.12, 0.09],
  },
  plateFront: { y: 0.36 }, plateRear: { y: 0.58 },
  lamps: {
    brake: [{ x: 0.64, y: 0.72, w: 0.14, h: 0.1 }],
    frontBlink: [{ x: 0.66, y: 0.45, w: 0.13, h: 0.05 }],
    rearBlink: [{ x: 0.64, y: 0.58, w: 0.14, h: 0.06 }],
  },
  details(P, c) {
    const { hw, zF, zR } = c;
    doorLines(P, hw, [-0.93, 0.13, 1.2], 0.25, 0.86, [[-0.18, 0.79], [1.0, 0.79]]);
    mirrors(P, hw, -0.82, 0.93, BLACK, false);
    rectLamp(P, 0.5, 0.64, zF, 0.34, 0.16, BLACK, -1, 0.05);
    rectLamp(P, 0.5, 0.64, zF - 0.012, 0.3, 0.12, LAMP, -1, 0.05);
    P.box(0.62, 0.14, 0.04, BLACK, 0, 0.64, zF - 0.01);
    bumper(P, zF - 0.03, 0.37, 0.11, 0.8, -1, { color: 0xb5b7b6, ends: BLACK, strip: RUBBER });
    bumper(P, zR + 0.03, 0.4, 0.11, 0.8, 1, { color: 0xb5b7b6, ends: BLACK, strip: RUBBER });
    // tall vertical tail lamps either side of the tailgate
    rectLamp(P, 0.64, 0.66, zR + 0.006, 0.16, 0.3, RED, 1, 0.03);
    rectLamp(P, 0.64, 0.57, zR + 0.012, 0.15, 0.07, AMBER, 1, 0.03);
    // roof rack, as every estate had one
    for (const s of [1, -1]) P.box(0.03, 0.05, 1.9, 0x3a3a3a, s * 0.55, 1.46, 0.5);
    for (const z of [-0.2, 0.6, 1.4]) P.box(1.14, 0.03, 0.03, 0x3a3a3a, 0, 1.49, z);
  },
};

export const lada2109 = {
  id: 'lada2109', weight: 7, engine: 'petrol',
  L: 4.006, W: 1.65, H: 1.402, wb: 2.46, r: 0.28, tyreW: 0.165, track: 1.39,
  sill: 0.24, noseY: 0.26, tailY: 0.34,
  top: [[-2.003, 0.66], [-1.92, 0.7], [-1, 0.86], [-0.84, 0.88], [1.55, 0.92], [2.003, 0.9]],
  cabin: [-0.84, 1.55],
  gh: {
    aBase: [-0.84, 0.88], aTop: [-0.16, 1.37], roofRear: [1.38, 1.36], cBase: [1.98, 0.92],
    hwBelt: 0.8, hwRoof: 0.64, pillars: [0.3, 1.2], pW: [0.07, 0.05, 0.12, 0.08], pillarColor: BLACK,
  },
  plateFront: { y: 0.34 }, plateRear: { y: 0.55 },
  hipFront: 0.1, hipRear: 0.98,
  lamps: {
    brake: [{ x: 0.6, y: 0.78, w: 0.28, h: 0.07 }],
    frontBlink: [{ x: 0.7, y: 0.6, w: 0.08, h: 0.08 }],
    rearBlink: [{ x: 0.6, y: 0.71, w: 0.28, h: 0.05 }],
  },
  details(P, c) {
    const { hw, zF, zR } = c;
    doorLines(P, hw, [-0.8, 0.3, 1.25], 0.26, 0.89, [[-0.1, 0.82], [1.0, 0.84]]);
    mirrors(P, hw, -0.7, 0.93, BLACK);
    // the low wedge nose: slim lamps and a slot grille
    rectLamp(P, 0.48, 0.6, zF, 0.4, 0.11, BLACK, -1, 0.05);
    rectLamp(P, 0.48, 0.6, zF - 0.012, 0.36, 0.08, LAMP, -1, 0.05);
    rectLamp(P, 0.71, 0.6, zF - 0.012, 0.08, 0.08, AMBER, -1, 0.05);
    P.box(0.5, 0.07, 0.04, BLACK, 0, 0.6, zF - 0.01);
    // black plastic bumpers, the 90s look
    bumper(P, zF - 0.04, 0.36, 0.2, 0.83, -1, { color: BLACK, depth: 0.14, wrap: 0.3 });
    bumper(P, zR + 0.04, 0.4, 0.2, 0.83, 1, { color: BLACK, depth: 0.14, wrap: 0.3 });
    // tail lamps along the hatch
    rectLamp(P, 0.6, 0.75, zR + 0.006, 0.32, 0.15, RED, 1, 0.03);
    P.box(0.52, 0.12, 0.02, BLACK, 0, 0.74, zR + 0.012);
    // black side protection strip
    for (const s of [1, -1]) P.box(0.02, 0.06, 2.2, BLACK, s * (hw + 0.008), 0.52, 0.2);
  },
};

export const lada2110 = {
  id: 'lada2110', weight: 4, engine: 'petrol',
  L: 4.265, W: 1.68, H: 1.42, wb: 2.49, r: 0.28, tyreW: 0.175, track: 1.4,
  sill: 0.25, noseY: 0.26, tailY: 0.34, taper: 0.09, taperZone: 0.45,
  top: [[-2.132, 0.66], [-2.05, 0.72], [-1.2, 0.84], [-0.9, 0.9], [1.25, 0.94], [1.95, 0.93], [2.132, 0.88]],
  cabin: [-0.9, 1.25],
  gh: {
    aBase: [-0.9, 0.9], aTop: [-0.22, 1.39], roofRear: [0.85, 1.4], cBase: [1.28, 0.94],
    hwBelt: 0.81, hwRoof: 0.66, pillars: [0.28], pW: [0.07, 0.05, 0.18, 0.08], pillarColor: BLACK,
  },
  plateFront: { y: 0.34 }, plateRear: { y: 0.57 },
  hipFront: 0.06, hipRear: 0.86, wheelStyle: 'cap',
  lamps: {
    brake: [{ x: 0.6, y: 0.8, w: 0.26, h: 0.07 }],
    frontBlink: [{ x: 0.66, y: 0.66, w: 0.1, h: 0.06 }],
    rearBlink: [{ x: 0.68, y: 0.74, w: 0.12, h: 0.05 }],
  },
  details(P, c) {
    const { hw, zF, zR, color } = c;
    doorLines(P, hw, [-0.86, 0.28, 1.2], 0.27, 0.92, [[-0.1, 0.85], [1.0, 0.86]]);
    mirrors(P, hw, -0.76, 0.96, color);
    // teardrop lamps, the "десятка" face
    rectLamp(P, 0.5, 0.64, zF - 0.01, 0.34, 0.13, LAMP, -1, 0.05, { rz: 0.1 });
    P.box(0.46, 0.09, 0.04, BLACK, 0, 0.64, zF - 0.01);
    bumper(P, zF - 0.02, 0.38, 0.22, 0.84, -1, { color, depth: 0.12, wrap: 0.35 });
    bumper(P, zR + 0.02, 0.42, 0.22, 0.84, 1, { color, depth: 0.12, wrap: 0.35 });
    P.box(0.6, 0.08, 0.04, BLACK, 0, 0.32, zF - 0.09);
    rectLamp(P, 0.6, 0.77, zR + 0.006, 0.3, 0.14, RED, 1, 0.03);
  },
};

export const niva = {
  id: 'niva', weight: 3, engine: 'petrol',
  L: 3.72, W: 1.68, H: 1.64, wb: 2.2, r: 0.35, tyreW: 0.18, track: 1.43,
  sill: 0.4, noseY: 0.4, tailY: 0.44, taper: 0.03,
  top: [[-1.86, 0.95], [-1.78, 0.98], [-0.8, 1.03], [-0.62, 1.05], [1.55, 1.07], [1.86, 1.06]],
  cabin: [-0.62, 1.6],
  gh: {
    aBase: [-0.62, 1.05], aTop: [-0.2, 1.6], roofRear: [1.8, 1.6], cBase: [1.84, 1.07],
    hwBelt: 0.82, hwRoof: 0.72, pillars: [0.55], pW: [0.08, 0.05, 0.1, 0.12],
  },
  plateFront: { y: 0.55 }, plateRear: { y: 0.72 },
  hipFront: 0.1, hipRear: 0.95, eyeUp: 0.72,
  wheelStyle: 'steel', rim: 0xd8d6cf,
  lamps: {
    brake: [{ x: 0.66, y: 0.88, w: 0.12, h: 0.1 }],
    frontBlink: [{ x: 0.66, y: 0.66, w: 0.1, h: 0.06 }],
    rearBlink: [{ x: 0.66, y: 0.78, w: 0.12, h: 0.06 }],
  },
  details(P, c) {
    const { hw, zF, zR } = c;
    doorLines(P, hw, [-0.58, 0.55], 0.42, 1.04, [[0.4, 0.98]]);
    mirrors(P, hw, -0.5, 1.12, BLACK);
    P.box(1.1, 0.26, 0.04, BLACK, 0, 0.8, zF - 0.01);
    roundLamp(P, 0.56, 0.82, zF - 0.01, 0.09);
    for (let i = 0; i < 4; i++) P.box(0.6, 0.02, 0.02, 0x3a3a3a, 0, 0.72 + i * 0.05, zF - 0.03);
    bumper(P, zF - 0.03, 0.5, 0.12, 0.84, -1, { color: 0xb5b7b6, ends: BLACK });
    bumper(P, zR + 0.03, 0.54, 0.12, 0.84, 1, { color: 0xb5b7b6, ends: BLACK });
    rectLamp(P, 0.66, 0.84, zR + 0.006, 0.14, 0.24, RED, 1, 0.03);
    // plastic wheel-arch flares
    for (const s of [1, -1]) {
      for (const z of [c.wf, c.wr]) {
        P.box(0.05, 0.06, 0.8, BLACK, s * (hw + 0.01), 0.78, z);
      }
    }
    // the spare wheel shows on the bonnet side? no: the Niva keeps it under the bonnet
    P.box(0.02, 0.04, 1.8, 0x3a3a3a, 0, 1.62, 0.8);
  },
};

export const CLASSIC_SPECS = { lada2107, lada2106, lada2109, lada2104, lada2110, niva };
export { buildCar, DARKRED };
