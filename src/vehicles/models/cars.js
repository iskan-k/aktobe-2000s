import {
  rectLamp, roundLamp, bumper, doorLines, mirrors,
  CHROME, BLACK, RUBBER, LAMP, AMBER, RED,
} from './carBuilder.js';
import { ATLAS, fitText } from '../kit.js';

/* ------------------------------------------------------------------ *
 * Everything else on the road: the used German imports that flooded in
 * during the 1990s (Audi 80 "бочка", Audi 100, the W124, Passat B3,
 * Vectra A, Golf II, BMW E34), the Soviet big saloons (GAZ-24 and
 * GAZ-3110 Volgas, Moskvich-2141), the Uzbek-built Nexia, the Camry
 * XV30 of the new money, a Land Cruiser 80 and an army-green UAZ-469.
 * Taxis are a red Passat B3 estate and a Volga, each with a roof sign.
 * ------------------------------------------------------------------ */

const GREY_PLASTIC = 0x4a4c4e;

function headRect(P, zF, x, y, w, h, { surround = BLACK, lamp = LAMP, rz = 0 } = {}) {
  rectLamp(P, x, y, zF, w + 0.03, h + 0.03, surround, -1, 0.04, { rz });
  rectLamp(P, x, y, zF - 0.012, w, h, lamp, -1, 0.04, { rz });
}

function grille(P, zF, w, h, y, { frame = CHROME, fill = BLACK, bars = 'h', n = 4, barColor = CHROME, depth = 0.04 } = {}) {
  P.box(w, h, depth, frame, 0, y, zF - depth * 0.3);
  P.box(w - 0.04, h - 0.04, depth, fill, 0, y, zF - depth * 0.45);
  for (let i = 0; i < n; i++) {
    if (bars === 'h') P.box(w - 0.06, 0.012, 0.02, barColor, 0, y - h / 2 + ((i + 1) * h) / (n + 1), zF - depth);
    else P.box(0.012, h - 0.06, 0.02, barColor, -w / 2 + ((i + 1) * w) / (n + 1), y, zF - depth);
  }
}

function tailBand(P, zR, x, y, w, h, { red = RED, amber = AMBER, frame = BLACK } = {}) {
  rectLamp(P, x, y, zR + 0.004, w + 0.03, h + 0.03, frame, 1, 0.03);
  rectLamp(P, x, y + h * 0.18, zR + 0.012, w, h * 0.55, red, 1, 0.03);
  rectLamp(P, x, y - h * 0.3, zR + 0.012, w, h * 0.35, amber, 1, 0.03);
}

/** Roof taxi sign: a small yellow box reading "ТАКСИ" / "TAXI". */
function taxiSign(P, y, z) {
  const uv = ATLAS.slot('taxi-sign', 160, 48, (ctx, x0, y0, w, h) => {
    ctx.fillStyle = '#f2c230';
    ctx.fillRect(x0, y0, w, h);
    fitText(ctx, 'TAXI · ТАКСИ', x0 + w / 2, y0 + h / 2 + 1, w - 12, 32, '#1a1a1a');
  });
  P.box(0.08, 0.05, 0.16, BLACK, 0, y + 0.025, z);
  P.box(0.5, 0.15, 0.16, 0xf2c230, 0, y + 0.12, z);
  P.decal(0.46, 0.12, uv, 0, y + 0.12, z - 0.082, { ry: Math.PI });
  P.decal(0.46, 0.12, uv, 0, y + 0.12, z + 0.082);
}

/** Black and yellow checker strip along both sides. */
function checkers(P, hw, y, z0, z1) {
  const uv = ATLAS.slot('checkers', 240, 24, (ctx, x0, y0, w, h) => {
    const s = h / 2;
    for (let i = 0; i < w / s; i++) {
      for (let j = 0; j < 2; j++) {
        ctx.fillStyle = (i + j) % 2 ? '#1a1a1a' : '#f2c230';
        ctx.fillRect(x0 + i * s, y0 + j * s, s, s);
      }
    }
  });
  const len = z1 - z0;
  for (const sgn of [1, -1]) {
    P.decal(len, 0.07, uv, sgn * (hw + 0.006), y, (z0 + z1) / 2, { ry: sgn * Math.PI / 2 });
  }
}

/** Four rings on an Audi grille, as four tiny white discs. */
function rings(P, zF, y) {
  for (let i = 0; i < 4; i++) P.cyl(0.022, 0.01, 0xe9e9e4, -0.075 + i * 0.05, y, zF - 0.045, { axis: 'z', seg: 8 });
}

/* ------------------------------------------------------------ specs */

export const audi80 = {
  id: 'audi80', weight: 7,
  L: 4.393, W: 1.695, H: 1.397, wb: 2.546, r: 0.29, tyreW: 0.175, track: 1.42,
  sill: 0.24, noseY: 0.28, tailY: 0.34, taper: 0.09, taperZone: 0.5,
  top: [[-2.196, 0.64], [-2.12, 0.71], [-1.2, 0.83], [-0.92, 0.88], [1.24, 0.92], [2.0, 0.925], [2.196, 0.88]],
  cabin: [-0.92, 1.28],
  gh: {
    aBase: [-0.92, 0.88], aTop: [-0.2, 1.37], roofRear: [0.84, 1.385], cBase: [1.32, 0.92],
    hwBelt: 0.83, hwRoof: 0.64, pillars: [0.26], pW: [0.07, 0.05, 0.19, 0.08], pillarColor: BLACK,
  },
  hipFront: 0.02, hipRear: 0.9, wheelStyle: 'alloy', rim: 0xc8c8c4,
  plateFront: { y: 0.38 }, plateRear: { y: 0.58 },
  lamps: {
    brake: [{ x: 0.55, y: 0.74, w: 0.3, h: 0.06 }],
    frontBlink: [{ x: 0.74, y: 0.64, w: 0.07, h: 0.1 }],
    rearBlink: [{ x: 0.55, y: 0.67, w: 0.3, h: 0.04 }],
  },
  details(P, c) {
    const { hw, zF, zR, color } = c;
    doorLines(P, hw, [-0.88, 0.26, 1.22], 0.26, 0.9, [[-0.12, 0.84], [0.98, 0.85]]);
    mirrors(P, hw, -0.8, 0.95, BLACK);
    headRect(P, zF, 0.5, 0.64, 0.32, 0.12);
    rectLamp(P, 0.74, 0.64, zF - 0.008, 0.06, 0.1, AMBER, -1, 0.04);
    grille(P, zF, 0.34, 0.12, 0.64, { frame: CHROME, bars: 'h', n: 3, barColor: 0x555555 });
    rings(P, zF, 0.64);
    bumper(P, zF - 0.03, 0.4, 0.16, 0.85, -1, { color: GREY_PLASTIC, depth: 0.12, wrap: 0.35 });
    bumper(P, zR + 0.03, 0.42, 0.16, 0.85, 1, { color: GREY_PLASTIC, depth: 0.12, wrap: 0.35 });
    tailBand(P, zR, 0.55, 0.72, 0.34, 0.14);
    P.box(0.46, 0.14, 0.02, BLACK, 0, 0.72, zR + 0.01);
    for (const s of [1, -1]) P.box(0.02, 0.05, 2.4, GREY_PLASTIC, s * (hw + 0.008), 0.55, 0.1);
    void color;
  },
};

export const audi100 = {
  id: 'audi100', weight: 4,
  L: 4.79, W: 1.814, H: 1.422, wb: 2.687, r: 0.3, tyreW: 0.185, track: 1.47,
  sill: 0.25, noseY: 0.28, tailY: 0.36, taper: 0.09, taperZone: 0.55,
  top: [[-2.395, 0.62], [-2.3, 0.72], [-1.3, 0.84], [-1.0, 0.9], [1.42, 0.93], [2.2, 0.945], [2.395, 0.9]],
  cabin: [-1.0, 1.45],
  gh: {
    aBase: [-1.0, 0.9], aTop: [-0.28, 1.4], roofRear: [0.98, 1.41], cBase: [1.5, 0.93],
    hwBelt: 0.89, hwRoof: 0.7, pillars: [0.33], pW: [0.07, 0.05, 0.2, 0.09], pillarColor: BLACK,
  },
  hipFront: 0.02, hipRear: 1.0, wheelStyle: 'cap', rim: 0xc5c6c4,
  plateFront: { y: 0.38 }, plateRear: { y: 0.6 },
  lamps: {
    brake: [{ x: 0.6, y: 0.76, w: 0.34, h: 0.06 }],
    frontBlink: [{ x: 0.82, y: 0.64, w: 0.06, h: 0.1 }],
    rearBlink: [{ x: 0.6, y: 0.69, w: 0.34, h: 0.04 }],
  },
  details(P, c) {
    const { hw, zF, zR } = c;
    doorLines(P, hw, [-0.96, 0.33, 1.4], 0.27, 0.91, [[-0.1, 0.85], [1.1, 0.86]]);
    mirrors(P, hw, -0.88, 0.97, BLACK);
    headRect(P, zF, 0.56, 0.64, 0.4, 0.12);
    grille(P, zF, 0.44, 0.12, 0.64, { bars: 'h', n: 4, barColor: 0x555555 });
    rings(P, zF, 0.64);
    bumper(P, zF - 0.03, 0.4, 0.15, 0.9, -1, { color: GREY_PLASTIC, depth: 0.12, wrap: 0.4 });
    bumper(P, zR + 0.03, 0.42, 0.15, 0.9, 1, { color: GREY_PLASTIC, depth: 0.12, wrap: 0.4 });
    P.box(1.7, 0.16, 0.02, RED, 0, 0.73, zR + 0.012);
    P.box(0.5, 0.16, 0.022, BLACK, 0, 0.73, zR + 0.014);
  },
};

export const mercW124 = {
  id: 'mercW124', weight: 4,
  L: 4.74, W: 1.74, H: 1.44, wb: 2.8, r: 0.31, tyreW: 0.195, track: 1.49,
  sill: 0.25, noseY: 0.3, tailY: 0.36, taper: 0.06, taperZone: 0.4,
  top: [[-2.37, 0.68], [-2.3, 0.77], [-1.3, 0.855], [-1.05, 0.9], [1.35, 0.95], [2.15, 0.96], [2.37, 0.92]],
  cabin: [-1.05, 1.38],
  gh: {
    aBase: [-1.05, 0.9], aTop: [-0.36, 1.42], roofRear: [0.9, 1.43], cBase: [1.42, 0.95],
    hwBelt: 0.85, hwRoof: 0.68, pillars: [0.26], pW: [0.07, 0.05, 0.2, 0.09],
  },
  hipFront: 0.02, hipRear: 1.0, wheelStyle: 'alloy', rim: 0xbfc1c2,
  plateFront: { y: 0.4 }, plateRear: { y: 0.6 },
  lamps: {
    brake: [{ x: 0.56, y: 0.76, w: 0.28, h: 0.07 }],
    frontBlink: [{ x: 0.76, y: 0.7, w: 0.07, h: 0.12 }],
    rearBlink: [{ x: 0.56, y: 0.68, w: 0.28, h: 0.05 }],
  },
  details(P, c) {
    const { hw, zF, zR } = c;
    doorLines(P, hw, [-1.0, 0.27, 1.36], 0.27, 0.93, [[-0.1, 0.86], [1.1, 0.87]]);
    mirrors(P, hw, -0.95, 0.98, BLACK);
    headRect(P, zF, 0.52, 0.7, 0.34, 0.14);
    rectLamp(P, 0.76, 0.7, zF - 0.01, 0.07, 0.14, AMBER, -1, 0.04);
    // the upright chrome grille and the star
    grille(P, zF - 0.02, 0.34, 0.24, 0.74, { frame: CHROME, bars: 'h', n: 5, barColor: CHROME, depth: 0.06 });
    P.cyl(0.035, 0.01, CHROME, 0, 0.89, zF + 0.06, { axis: 'x', seg: 10 });
    P.box(0.006, 0.07, 0.006, CHROME, 0, 0.9, zF + 0.06);
    // Sacco boards: grey cladding along the sides, grey bumpers
    for (const s of [1, -1]) P.box(0.03, 0.2, 2.9, 0x6e7072, s * (hw + 0.01), 0.42, 0.0);
    bumper(P, zF - 0.03, 0.42, 0.2, 0.87, -1, { color: 0x6e7072, depth: 0.14, wrap: 0.4 });
    bumper(P, zR + 0.03, 0.44, 0.2, 0.87, 1, { color: 0x6e7072, depth: 0.14, wrap: 0.4 });
    // ribbed tail lamps
    tailBand(P, zR, 0.56, 0.72, 0.36, 0.2);
    for (let i = 0; i < 5; i++) rectLamp(P, 0.56, 0.64 + i * 0.035, zR + 0.03, 0.36, 0.006, 0x3a1010, 1, 0.01);
    for (const s of [1, -1]) P.box(0.018, 0.018, 1.3, CHROME, s * 0.68, 1.41, 0.26);
  },
};

const passatFront = (P, c) => {
  const { hw, zF } = c;
  // no grille: one black band from lamp to lamp, the B3's face
  P.box(1.5, 0.15, 0.04, BLACK, 0, 0.66, zF - 0.008);
  headRect(P, zF - 0.01, 0.6, 0.66, 0.26, 0.12, { surround: BLACK });
  P.cyl(0.05, 0.01, CHROME, 0, 0.66, zF - 0.035, { axis: 'z', seg: 12 });
  mirrors(P, hw, -0.84, 0.96, BLACK);
  bumper(P, zF - 0.03, 0.4, 0.17, 0.86, -1, { color: BLACK, depth: 0.13, wrap: 0.35 });
};

export const passatB3 = {
  id: 'passatB3', weight: 6,
  L: 4.575, W: 1.705, H: 1.43, wb: 2.623, r: 0.3, tyreW: 0.185, track: 1.44,
  sill: 0.25, noseY: 0.3, tailY: 0.36, taper: 0.08, taperZone: 0.5,
  top: [[-2.287, 0.66], [-2.2, 0.73], [-1.2, 0.85], [-0.95, 0.9], [1.3, 0.93], [2.1, 0.94], [2.287, 0.9]],
  cabin: [-0.95, 1.36],
  gh: {
    aBase: [-0.95, 0.9], aTop: [-0.2, 1.41], roofRear: [0.95, 1.42], cBase: [1.42, 0.94],
    hwBelt: 0.83, hwRoof: 0.67, pillars: [0.33], pW: [0.07, 0.05, 0.18, 0.09], pillarColor: BLACK,
  },
  hipFront: 0.05, hipRear: 1.0,
  plateFront: { y: 0.4 }, plateRear: { y: 0.6 },
  lamps: {
    brake: [{ x: 0.58, y: 0.77, w: 0.3, h: 0.06 }],
    frontBlink: [{ x: 0.78, y: 0.66, w: 0.05, h: 0.1 }],
    rearBlink: [{ x: 0.58, y: 0.7, w: 0.3, h: 0.04 }],
  },
  details(P, c) {
    const { hw, zR } = c;
    passatFront(P, c);
    doorLines(P, hw, [-0.9, 0.33, 1.32], 0.27, 0.91, [[-0.1, 0.85], [1.05, 0.86]]);
    bumper(P, zR + 0.03, 0.42, 0.17, 0.86, 1, { color: BLACK, depth: 0.13, wrap: 0.35 });
    tailBand(P, zR, 0.58, 0.74, 0.34, 0.15);
    P.box(0.5, 0.15, 0.02, RED, 0, 0.74, zR + 0.011);
    for (const s of [1, -1]) P.box(0.02, 0.05, 2.3, BLACK, s * (hw + 0.008), 0.56, 0.1);
  },
};

export const passatTaxi = {
  ...passatB3, id: 'passatTaxi', weight: 2, company: true,
  top: [[-2.287, 0.66], [-2.2, 0.73], [-1.2, 0.85], [-0.95, 0.9], [2.15, 0.94], [2.287, 0.93]],
  cabin: [-0.95, 2.1],
  gh: {
    aBase: [-0.95, 0.9], aTop: [-0.2, 1.41], roofRear: [2.2, 1.43], cBase: [2.27, 0.94],
    hwBelt: 0.83, hwRoof: 0.68, pillars: [0.33, 1.33], pW: [0.07, 0.05, 0.12, 0.09], pillarColor: BLACK,
  },
  plateRear: { y: 0.58 },
  lamps: {
    brake: [{ x: 0.66, y: 0.8, w: 0.14, h: 0.14 }],
    frontBlink: [{ x: 0.78, y: 0.66, w: 0.05, h: 0.1 }],
    rearBlink: [{ x: 0.66, y: 0.7, w: 0.14, h: 0.05 }],
  },
  details(P, c) {
    const { hw, zR } = c;
    passatFront(P, c);
    doorLines(P, hw, [-0.9, 0.33, 1.32], 0.27, 0.91, [[-0.1, 0.85], [1.05, 0.86]]);
    bumper(P, zR + 0.03, 0.42, 0.17, 0.86, 1, { color: BLACK, depth: 0.13, wrap: 0.35 });
    rectLamp(P, 0.66, 0.76, zR + 0.006, 0.16, 0.26, RED, 1, 0.03);
    for (const s of [1, -1]) P.box(0.03, 0.04, 2.0, 0x2a2a2a, s * 0.55, 1.46, 0.9);
    taxiSign(P, 1.44, 0.2);
    checkers(P, hw, 0.66, -0.85, 1.25);
  },
};

export const vectraA = {
  id: 'vectraA', weight: 5,
  L: 4.43, W: 1.7, H: 1.4, wb: 2.6, r: 0.29, tyreW: 0.185, track: 1.42,
  sill: 0.25, noseY: 0.3, tailY: 0.36, taper: 0.09, taperZone: 0.5,
  top: [[-2.215, 0.62], [-2.12, 0.7], [-1.2, 0.84], [-0.95, 0.89], [1.25, 0.94], [2.02, 0.95], [2.215, 0.9]],
  cabin: [-0.95, 1.3],
  gh: {
    aBase: [-0.95, 0.89], aTop: [-0.25, 1.37], roofRear: [0.8, 1.39], cBase: [1.33, 0.94],
    hwBelt: 0.83, hwRoof: 0.66, pillars: [0.26], pW: [0.07, 0.05, 0.2, 0.09], pillarColor: BLACK,
  },
  hipFront: 0.02, hipRear: 0.94,
  plateFront: { y: 0.38 }, plateRear: { y: 0.58 },
  lamps: {
    brake: [{ x: 0.58, y: 0.76, w: 0.3, h: 0.06 }],
    frontBlink: [{ x: 0.74, y: 0.62, w: 0.08, h: 0.08 }],
    rearBlink: [{ x: 0.58, y: 0.69, w: 0.3, h: 0.04 }],
  },
  details(P, c) {
    const { hw, zF, zR, color } = c;
    doorLines(P, hw, [-0.9, 0.26, 1.28], 0.27, 0.92, [[-0.1, 0.86], [1.0, 0.87]]);
    mirrors(P, hw, -0.84, 0.96, color);
    headRect(P, zF, 0.5, 0.63, 0.34, 0.1);
    grille(P, zF, 0.34, 0.08, 0.63, { frame: BLACK, bars: 'h', n: 1, barColor: CHROME });
    P.box(0.05, 0.05, 0.02, CHROME, 0, 0.64, zF - 0.05);
    bumper(P, zF - 0.02, 0.4, 0.18, 0.86, -1, { color, depth: 0.12, wrap: 0.4 });
    bumper(P, zR + 0.02, 0.42, 0.18, 0.86, 1, { color, depth: 0.12, wrap: 0.4 });
    P.box(0.5, 0.06, 0.03, BLACK, 0, 0.34, zF - 0.09);
    tailBand(P, zR, 0.58, 0.72, 0.34, 0.14);
    for (const s of [1, -1]) P.box(0.02, 0.05, 2.2, BLACK, s * (hw + 0.008), 0.56, 0.1);
  },
};

export const nexia = {
  ...vectraA, id: 'nexia', weight: 3,
  L: 4.482, W: 1.662, H: 1.393, wb: 2.52, r: 0.28,
  top: [[-2.241, 0.62], [-2.15, 0.7], [-1.2, 0.83], [-0.95, 0.88], [1.3, 0.93], [2.05, 0.94], [2.241, 0.9]],
  gh: {
    aBase: [-0.95, 0.88], aTop: [-0.28, 1.37], roofRear: [0.78, 1.38], cBase: [1.36, 0.93],
    hwBelt: 0.81, hwRoof: 0.64, pillars: [0.24], pW: [0.07, 0.05, 0.2, 0.09], pillarColor: BLACK,
  },
  details(P, c) {
    const { hw, zF, zR, color } = c;
    doorLines(P, hw, [-0.9, 0.24, 1.3], 0.26, 0.91, [[-0.1, 0.85], [1.0, 0.86]]);
    mirrors(P, hw, -0.84, 0.95, BLACK);
    headRect(P, zF, 0.5, 0.63, 0.3, 0.12);
    // the Daewoo grille with its chrome bar and badge
    grille(P, zF, 0.4, 0.1, 0.63, { frame: CHROME, bars: 'h', n: 1, barColor: CHROME });
    P.cyl(0.03, 0.01, CHROME, 0, 0.63, zF - 0.05, { axis: 'z', seg: 10 });
    bumper(P, zF - 0.02, 0.4, 0.18, 0.84, -1, { color, depth: 0.12, wrap: 0.4 });
    bumper(P, zR + 0.02, 0.42, 0.18, 0.84, 1, { color, depth: 0.12, wrap: 0.4 });
    P.box(0.6, 0.07, 0.03, BLACK, 0, 0.35, zF - 0.09);
    tailBand(P, zR, 0.56, 0.72, 0.32, 0.15);
  },
};

export const camry30 = {
  id: 'camry30', weight: 3,
  L: 4.815, W: 1.795, H: 1.49, wb: 2.72, r: 0.32, tyreW: 0.205, track: 1.54,
  sill: 0.27, noseY: 0.3, tailY: 0.38, taper: 0.12, taperZone: 0.6,
  top: [[-2.407, 0.66], [-2.3, 0.77], [-1.3, 0.89], [-0.98, 0.95], [1.4, 1.0], [2.2, 1.02], [2.407, 0.97]],
  cabin: [-0.98, 1.45],
  gh: {
    aBase: [-0.98, 0.95], aTop: [-0.18, 1.47], roofRear: [0.95, 1.48], cBase: [1.52, 1.0],
    hwBelt: 0.88, hwRoof: 0.7, pillars: [0.35], pW: [0.08, 0.05, 0.22, 0.09], pillarColor: BLACK,
  },
  hipFront: 0.06, hipRear: 1.04, wheelStyle: 'alloy', rim: 0xc6c8c9,
  plateFront: { y: 0.42 }, plateRear: { y: 0.66 },
  lamps: {
    brake: [{ x: 0.62, y: 0.84, w: 0.3, h: 0.08 }],
    frontBlink: [{ x: 0.76, y: 0.72, w: 0.08, h: 0.08 }],
    rearBlink: [{ x: 0.62, y: 0.76, w: 0.3, h: 0.05 }],
  },
  details(P, c) {
    const { hw, zF, zR, color } = c;
    doorLines(P, hw, [-0.94, 0.35, 1.44], 0.29, 0.98, [[-0.08, 0.92], [1.15, 0.93]]);
    mirrors(P, hw, -0.86, 1.03, color);
    headRect(P, zF, 0.56, 0.71, 0.42, 0.15, { surround: 0x9aa0a4, rz: 0.08 });
    grille(P, zF, 0.5, 0.12, 0.72, { frame: CHROME, bars: 'h', n: 2, barColor: CHROME });
    P.cyl(0.04, 0.01, CHROME, 0, 0.72, zF - 0.05, { axis: 'z', seg: 12 });
    bumper(P, zF - 0.02, 0.42, 0.24, 0.9, -1, { color, depth: 0.12, wrap: 0.5 });
    bumper(P, zR + 0.02, 0.45, 0.22, 0.9, 1, { color, depth: 0.12, wrap: 0.5 });
    tailBand(P, zR, 0.62, 0.8, 0.36, 0.18);
    P.box(0.6, 0.03, 0.02, CHROME, 0, 0.84, zR + 0.012);
  },
};

export const bmwE34 = {
  id: 'bmwE34', weight: 2,
  L: 4.72, W: 1.751, H: 1.412, wb: 2.761, r: 0.3, tyreW: 0.205, track: 1.47,
  sill: 0.25, noseY: 0.3, tailY: 0.36, taper: 0.06, taperZone: 0.4,
  top: [[-2.36, 0.66], [-2.29, 0.75], [-1.3, 0.83], [-1.02, 0.88], [1.35, 0.92], [2.15, 0.93], [2.36, 0.9]],
  cabin: [-1.02, 1.38],
  gh: {
    aBase: [-1.02, 0.88], aTop: [-0.32, 1.39], roofRear: [0.9, 1.4], cBase: [1.4, 0.92],
    hwBelt: 0.86, hwRoof: 0.68, pillars: [0.28], pW: [0.07, 0.05, 0.2, 0.09], pillarColor: BLACK,
  },
  hipFront: 0.02, hipRear: 1.0, wheelStyle: 'alloy', rim: 0xb9bbbd,
  plateFront: { y: 0.38 }, plateRear: { y: 0.6 },
  lamps: {
    brake: [{ x: 0.6, y: 0.75, w: 0.3, h: 0.07 }],
    frontBlink: [{ x: 0.78, y: 0.55, w: 0.07, h: 0.05 }],
    rearBlink: [{ x: 0.6, y: 0.68, w: 0.3, h: 0.04 }],
  },
  details(P, c) {
    const { hw, zF, zR } = c;
    doorLines(P, hw, [-0.97, 0.28, 1.36], 0.27, 0.9, [[-0.1, 0.84], [1.1, 0.85]]);
    mirrors(P, hw, -0.92, 0.94, BLACK);
    // four round lamps in a black band, and the kidneys
    P.box(1.52, 0.17, 0.04, BLACK, 0, 0.67, zF - 0.005);
    roundLamp(P, 0.66, 0.67, zF - 0.01, 0.07, -1, { bezel: BLACK });
    roundLamp(P, 0.46, 0.67, zF - 0.01, 0.06, -1, { bezel: BLACK });
    for (const s of [1, -1]) {
      P.box(0.13, 0.17, 0.05, CHROME, s * 0.08, 0.68, zF - 0.02);
      P.box(0.1, 0.14, 0.05, 0x222222, s * 0.08, 0.68, zF - 0.03);
    }
    bumper(P, zF - 0.03, 0.4, 0.16, 0.88, -1, { color: 0x3b3d3f, depth: 0.12, wrap: 0.4, strip: CHROME });
    bumper(P, zR + 0.03, 0.42, 0.16, 0.88, 1, { color: 0x3b3d3f, depth: 0.12, wrap: 0.4, strip: CHROME });
    tailBand(P, zR, 0.6, 0.72, 0.36, 0.16);
  },
};

export const golf2 = {
  id: 'golf2', weight: 3,
  L: 3.985, W: 1.665, H: 1.415, wb: 2.475, r: 0.28, tyreW: 0.175, track: 1.42,
  sill: 0.25, noseY: 0.3, tailY: 0.38, taper: 0.06, taperZone: 0.35,
  top: [[-1.992, 0.66], [-1.92, 0.73], [-1.1, 0.85], [-0.86, 0.9], [1.72, 0.95], [1.992, 0.93]],
  cabin: [-0.86, 1.7],
  gh: {
    aBase: [-0.86, 0.9], aTop: [-0.22, 1.39], roofRear: [1.5, 1.4], cBase: [1.95, 0.95],
    hwBelt: 0.81, hwRoof: 0.65, pillars: [0.3, 1.2], pW: [0.07, 0.05, 0.16, 0.08], pillarColor: BLACK,
  },
  hipFront: 0.08, hipRear: 0.98,
  plateFront: { y: 0.38 }, plateRear: { y: 0.6 },
  lamps: {
    brake: [{ x: 0.62, y: 0.78, w: 0.2, h: 0.08 }],
    frontBlink: [{ x: 0.72, y: 0.48, w: 0.1, h: 0.05 }],
    rearBlink: [{ x: 0.62, y: 0.7, w: 0.2, h: 0.05 }],
  },
  details(P, c) {
    const { hw, zF, zR } = c;
    doorLines(P, hw, [-0.82, 0.3, 1.25], 0.27, 0.93, [[-0.1, 0.86], [0.98, 0.87]]);
    mirrors(P, hw, -0.76, 0.96, BLACK);
    P.box(1.4, 0.18, 0.04, BLACK, 0, 0.67, zF - 0.006);
    roundLamp(P, 0.55, 0.67, zF - 0.01, 0.08, -1, { bezel: BLACK });
    for (let i = 0; i < 3; i++) P.box(0.6, 0.012, 0.02, 0x555555, 0, 0.63 + i * 0.04, zF - 0.03);
    P.cyl(0.04, 0.01, CHROME, 0, 0.67, zF - 0.035, { axis: 'z', seg: 10 });
    bumper(P, zF - 0.03, 0.4, 0.14, 0.84, -1, { color: BLACK, depth: 0.12, wrap: 0.3 });
    bumper(P, zR + 0.03, 0.42, 0.14, 0.84, 1, { color: BLACK, depth: 0.12, wrap: 0.3 });
    rectLamp(P, 0.62, 0.74, zR + 0.006, 0.22, 0.2, RED, 1, 0.03);
  },
};

const volgaCommon = (P, c) => {
  const { hw, zF, zR } = c;
  doorLines(P, hw, [-0.97, 0.22, 1.4], 0.3, 0.93, [[-0.2, 0.86], [1.05, 0.87]]);
  mirrors(P, hw, -0.9, 0.98, CHROME, false);
  for (const s of [1, -1]) {
    P.box(0.012, 0.012, 2.6, CHROME, s * (hw + 0.004), 0.7, 0.1);
    P.box(0.018, 0.018, 1.3, CHROME, s * 0.72, 1.43, 0.23);
  }
  P.cyl(0.03, 0.2, 0x444444, 0.5, 0.26, zR + 0.03, { axis: 'z', seg: 6 });
};

export const volga24 = {
  id: 'volga24', weight: 2,
  L: 4.735, W: 1.8, H: 1.49, wb: 2.8, r: 0.33, tyreW: 0.185, track: 1.48,
  sill: 0.28, noseY: 0.34, tailY: 0.38, taper: 0.05, taperZone: 0.4,
  top: [[-2.367, 0.7], [-2.32, 0.77], [-1.3, 0.86], [-1.02, 0.9], [1.4, 0.95], [2.1, 0.935], [2.367, 0.88]],
  cabin: [-1.02, 1.42],
  gh: {
    aBase: [-1.02, 0.9], aTop: [-0.42, 1.44], roofRear: [0.86, 1.45], cBase: [1.46, 0.95],
    hwBelt: 0.87, hwRoof: 0.72, pillars: [0.2], pW: [0.075, 0.05, 0.24, 0.09],
  },
  hipFront: -0.02, hipRear: 0.95,
  plateFront: { y: 0.42 }, plateRear: { y: 0.62 },
  lamps: {
    brake: [{ x: 0.66, y: 0.66, w: 0.2, h: 0.08 }],
    frontBlink: [{ x: 0.72, y: 0.52, w: 0.12, h: 0.05 }],
    rearBlink: [{ x: 0.66, y: 0.58, w: 0.2, h: 0.05 }],
  },
  details(P, c) {
    volgaCommon(P, c);
    const { zF, zR } = c;
    // wide chrome grille between round lamps, vertical bars
    grille(P, zF, 1.0, 0.22, 0.66, { frame: CHROME, bars: 'v', n: 22, barColor: CHROME, depth: 0.05 });
    roundLamp(P, 0.66, 0.66, zF - 0.01, 0.09);
    bumper(P, zF - 0.04, 0.42, 0.11, 0.9, -1, { color: CHROME, strip: RUBBER });
    bumper(P, zR + 0.04, 0.44, 0.11, 0.9, 1, { color: CHROME, strip: RUBBER });
    for (const s of [1, -1]) {
      P.box(0.06, 0.2, 0.06, CHROME, s * 0.38, 0.45, zF - 0.12);
      P.box(0.06, 0.2, 0.06, CHROME, s * 0.38, 0.47, zR + 0.12);
    }
    rectLamp(P, 0.66, 0.62, zR + 0.005, 0.24, 0.18, CHROME, 1, 0.03);
    rectLamp(P, 0.66, 0.64, zR + 0.012, 0.2, 0.12, RED, 1, 0.03);
  },
};

export const volgaTaxi = {
  ...volga24, id: 'volgaTaxi', weight: 1, company: true,
  details(P, c) {
    volga24.details(P, c);
    taxiSign(P, 1.46, 0.25);
    checkers(P, c.hw, 0.78, -0.95, 1.35);
  },
};

export const volga3110 = {
  ...volga24, id: 'volga3110', weight: 3,
  L: 4.88, top: [[-2.44, 0.7], [-2.38, 0.78], [-1.3, 0.87], [-1.02, 0.91], [1.45, 0.96], [2.2, 0.95], [2.44, 0.9]],
  cabin: [-1.02, 1.45],
  gh: {
    aBase: [-1.02, 0.91], aTop: [-0.4, 1.44], roofRear: [0.9, 1.45], cBase: [1.5, 0.96],
    hwBelt: 0.87, hwRoof: 0.72, pillars: [0.22], pW: [0.075, 0.05, 0.22, 0.09], pillarColor: BLACK,
  },
  lamps: {
    brake: [{ x: 0.62, y: 0.72, w: 0.3, h: 0.07 }],
    frontBlink: [{ x: 0.8, y: 0.66, w: 0.06, h: 0.1 }],
    rearBlink: [{ x: 0.62, y: 0.65, w: 0.3, h: 0.04 }],
  },
  details(P, c) {
    volgaCommon(P, c);
    const { zF, zR, color } = c;
    headRect(P, zF, 0.6, 0.67, 0.34, 0.14);
    grille(P, zF, 0.62, 0.22, 0.68, { frame: CHROME, bars: 'v', n: 12, barColor: CHROME, depth: 0.06 });
    P.box(0.08, 0.1, 0.02, CHROME, 0, 0.72, zF - 0.07);   // the stag badge
    bumper(P, zF - 0.03, 0.42, 0.18, 0.9, -1, { color, depth: 0.12, wrap: 0.35, strip: BLACK });
    bumper(P, zR + 0.03, 0.44, 0.18, 0.9, 1, { color, depth: 0.12, wrap: 0.35, strip: BLACK });
    tailBand(P, zR, 0.62, 0.69, 0.36, 0.16);
  },
};

export const moskvich2141 = {
  id: 'moskvich2141', weight: 2,
  L: 4.35, W: 1.69, H: 1.4, wb: 2.58, r: 0.29, tyreW: 0.175, track: 1.44,
  sill: 0.26, noseY: 0.3, tailY: 0.38, taper: 0.05, taperZone: 0.4,
  top: [[-2.175, 0.64], [-2.1, 0.71], [-1.1, 0.84], [-0.9, 0.89], [1.85, 0.95], [2.175, 0.93]],
  cabin: [-0.9, 1.8],
  gh: {
    aBase: [-0.9, 0.89], aTop: [-0.2, 1.36], roofRear: [1.35, 1.38], cBase: [2.1, 0.96],
    hwBelt: 0.82, hwRoof: 0.64, pillars: [0.3, 1.22], pW: [0.07, 0.05, 0.14, 0.09], pillarColor: BLACK,
  },
  hipFront: 0.08, hipRear: 1.0,
  plateFront: { y: 0.38 }, plateRear: { y: 0.6 },
  lamps: {
    brake: [{ x: 0.62, y: 0.78, w: 0.22, h: 0.08 }],
    frontBlink: [{ x: 0.74, y: 0.64, w: 0.06, h: 0.08 }],
    rearBlink: [{ x: 0.62, y: 0.7, w: 0.22, h: 0.05 }],
  },
  details(P, c) {
    const { hw, zF, zR } = c;
    doorLines(P, hw, [-0.86, 0.3, 1.3], 0.28, 0.93, [[-0.1, 0.86], [1.0, 0.87]]);
    mirrors(P, hw, -0.8, 0.95, BLACK);
    P.box(1.44, 0.14, 0.04, BLACK, 0, 0.64, zF - 0.006);
    headRect(P, zF - 0.01, 0.54, 0.64, 0.34, 0.1);
    bumper(P, zF - 0.03, 0.4, 0.16, 0.85, -1, { color: BLACK, depth: 0.12, wrap: 0.3 });
    bumper(P, zR + 0.03, 0.42, 0.16, 0.85, 1, { color: BLACK, depth: 0.12, wrap: 0.3 });
    rectLamp(P, 0.62, 0.74, zR + 0.006, 0.26, 0.16, RED, 1, 0.03);
  },
};

export const landCruiser80 = {
  id: 'landCruiser80', weight: 2,
  L: 4.82, W: 1.93, H: 1.86, wb: 2.85, r: 0.39, tyreW: 0.26, track: 1.6,
  sill: 0.48, noseY: 0.5, tailY: 0.55, taper: 0.04, taperZone: 0.4,
  top: [[-2.41, 1.0], [-2.36, 1.06], [-1.3, 1.12], [-1.05, 1.15], [2.33, 1.18], [2.41, 1.17]],
  cabin: [-1.05, 2.3],
  gh: {
    aBase: [-1.05, 1.15], aTop: [-0.55, 1.8], roofRear: [2.33, 1.82], cBase: [2.38, 1.18],
    hwBelt: 0.93, hwRoof: 0.84, pillars: [0.25, 1.25], pW: [0.08, 0.05, 0.14, 0.1], pillarColor: BLACK,
  },
  hipFront: 0.05, hipRear: 1.1, eyeUp: 0.76, wheelStyle: 'alloy', rim: 0xbfc0c0,
  plateFront: { y: 0.6 }, plateRear: { y: 0.82 },
  lamps: {
    brake: [{ x: 0.82, y: 1.0, w: 0.12, h: 0.14 }],
    frontBlink: [{ x: 0.82, y: 0.92, w: 0.1, h: 0.06 }],
    rearBlink: [{ x: 0.82, y: 0.88, w: 0.12, h: 0.08 }],
  },
  details(P, c) {
    const { hw, zF, zR, wf, wr } = c;
    doorLines(P, hw, [-1.0, 0.25, 1.3], 0.5, 1.16, [[-0.1, 1.1], [1.1, 1.1]]);
    mirrors(P, hw, -0.95, 1.22, BLACK);
    headRect(P, zF, 0.62, 0.92, 0.38, 0.16);
    grille(P, zF, 0.66, 0.2, 0.92, { frame: CHROME, bars: 'h', n: 4, barColor: CHROME });
    bumper(P, zF - 0.05, 0.62, 0.2, 0.97, -1, { color: 0x3a3c3e, depth: 0.16, wrap: 0.3 });
    bumper(P, zR + 0.05, 0.64, 0.2, 0.97, 1, { color: 0x3a3c3e, depth: 0.16, wrap: 0.3 });
    rectLamp(P, 0.82, 0.95, zR + 0.006, 0.14, 0.3, RED, 1, 0.03);
    for (const s of [1, -1]) {
      for (const z of [wf, wr]) P.box(0.06, 0.1, 1.0, 0x3a3c3e, s * (hw + 0.02), 0.95, z);
      P.box(0.04, 0.05, 2.6, 0x2c2c2c, s * 0.72, 1.87, 0.9);
      // side step
      P.box(0.18, 0.05, 2.0, 0x3a3c3e, s * (hw - 0.04), 0.42, 0.55);
    }
  },
};

export const uaz469 = {
  id: 'uaz469', weight: 1, defaultColor: 0x5b6a3c,
  L: 4.025, W: 1.785, H: 2.05, wb: 2.38, r: 0.39, tyreW: 0.22, track: 1.44,
  sill: 0.5, noseY: 0.52, tailY: 0.55, taper: 0.02, taperZone: 0.3,
  top: [[-2.012, 1.0], [-1.95, 1.04], [-1.0, 1.08], [-0.78, 1.12], [2.012, 1.16]],
  cabin: [-0.78, 1.98],
  gh: {
    aBase: [-0.78, 1.12], aTop: [-0.72, 1.96], roofRear: [1.96, 1.99], cBase: [2.0, 1.16],
    hwBelt: 0.87, hwRoof: 0.84, pillars: [0.3, 1.1], pW: [0.06, 0.06, 0.08, 0.1],
    roofColor: 0x4a5236, pillarColor: 0x4a5236,
  },
  hipFront: 0.1, hipRear: 1.1, eyeUp: 0.76, wheelStyle: 'steel', rim: 0x4d5a33, hub: 0x3a3a3a,
  plateFront: { y: 0.66 }, plateRear: { y: 0.82 },
  lamps: {
    brake: [{ x: 0.8, y: 0.98, w: 0.1, h: 0.1 }],
    frontBlink: [{ x: 0.7, y: 0.86, w: 0.08, h: 0.06 }],
    rearBlink: [{ x: 0.8, y: 0.88, w: 0.1, h: 0.06 }],
  },
  details(P, c) {
    const { hw, zF, zR, color } = c;
    doorLines(P, hw, [-0.74, 0.3, 1.1], 0.52, 1.1, [[-0.3, 1.02], [0.8, 1.02]]);
    mirrors(P, hw, -0.7, 1.25, BLACK);
    // vertical grille slots and round lamps on the flat face
    for (let i = 0; i < 7; i++) P.box(0.035, 0.28, 0.03, 0x2a2e22, -0.27 + i * 0.09, 0.9, zF - 0.012);
    roundLamp(P, 0.6, 0.92, zF - 0.01, 0.09, -1, { bezel: color });
    bumper(P, zF - 0.06, 0.62, 0.12, 0.85, -1, { color: 0x2a2a2a, depth: 0.1, wrap: 0.1 });
    bumper(P, zR + 0.06, 0.64, 0.12, 0.85, 1, { color: 0x2a2a2a, depth: 0.1, wrap: 0.1 });
    rectLamp(P, 0.8, 0.94, zR + 0.006, 0.1, 0.2, RED, 1, 0.03);
    // the spare wheel on the tailgate
    P.cyl(0.36, 0.2, 0x262626, 0.25, 1.2, zR + 0.13, { axis: 'z', seg: 14 });
    P.cyl(0.22, 0.22, color, 0.25, 1.2, zR + 0.13, { axis: 'z', seg: 10 });
    for (const s of [1, -1]) P.box(0.05, 0.08, 0.9, 0x2a2e22, s * (hw + 0.01), 1.0, c.wf);
  },
};

export const IMPORT_SPECS = { audi80, audi100, mercW124, passatB3, vectraA, golf2, bmwE34 };
export const OTHER_SPECS = { nexia, camry30, volga24, volga3110, moskvich2141, landCruiser80, uaz469 };
export const TAXI_SPECS = { passatTaxi, volgaTaxi };
