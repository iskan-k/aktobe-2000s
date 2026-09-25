import { buildBus, LAMP, AMBER, CHROME, BLACK } from './busBuilder.js';
import { roundLamp, rectLamp } from './carBuilder.js';
import { ATLAS, fitText } from '../kit.js';

/* ------------------------------------------------------------------ *
 * The route vehicles of Aktobe in the mid-2000s.
 *
 *   ikarus260  the Hungarian city bus every Soviet town had: ochre
 *              yellow with a cream roof, four round lamps in a black
 *              mask, three pairs of folding doors
 *   manSL202   a used German city bus in its old cream livery with a
 *              green band and the German operator's name still on it,
 *              plug doors
 *   paz3205    the small Pavlovsk bus with the rounded brow
 *   county     a white Hyundai County midibus with yellow stripes
 *   ziu682     trolleybus on route 1: cream with two red stripes
 *   btz5276    the new Bashkir trolleybus of 2006: white, deep blue
 *              skirt, a digital destination board
 * ------------------------------------------------------------------ */

const OCHRE = 0xd9a63a;
const CREAM = 0xe8e2cf;
const ZIU_CREAM = 0xede9da;
const ZIU_RED = 0xc8282e;
const BTZ_BLUE = 0x1e56c8;

/** Painted text on a side panel, from the atlas. */
export function sideText(P, key, text, x, y, z, w, h, color, { bg = null, ry = Math.PI / 2, family } = {}) {
  const px = Math.round(w * 180);
  const ph = Math.round(h * 180);
  const uv = ATLAS.slot(key, px, ph, (ctx, x0, y0, cw, ch) => {
    ctx.fillStyle = bg ?? '#ffffff';
    ctx.fillRect(x0, y0, cw, ch);
    fitText(ctx, text, x0 + cw / 2, y0 + ch / 2 + 1, cw * 0.96, ch * 0.9, color, family ? { family } : {});
  });
  P.decal(w, h, uv, x, y, z, { ry });
}

export const ikarus260 = {
  id: 'ikarus260', kind: 'bus', engine: 'bus',
  L: 11.0, W: 2.5, r: 0.51, tyreW: 0.3, track: 2.08,
  zFront: -3.05, zRear: [2.35],
  floorY: 0.9, beltY: 1.5, winTop: 2.55, roofY: 2.94, skirtY: 0.36,
  wsBottom: 1.12, wsTop: 2.6, rake: 0.14,
  color: OCHRE,
  bands: [
    { y0: 0.36, y1: 1.2, color: OCHRE },
    { y0: 1.2, y1: 1.3, color: CREAM },
    { y0: 1.3, y1: 1.5, color: OCHRE },
  ],
  upperColor: CREAM, roofColor: CREAM,
  doors: [
    { z0: -5.28, z1: -4.1, kind: 'fold' },
    { z0: -0.95, z1: 0.25, kind: 'fold' },
    { z0: 3.15, z1: 4.35, kind: 'fold' },
  ],
  hatches: [-2.5, 1.5],
  driverZ: 1.05, fill: 0.32,
  front(P, c) {
    const { zF, skirt } = c;
    // the black mask with four round lamps, the Ikarus face
    P.span(-1.2, skirt + 0.34, zF - 0.02, 1.2, skirt + 0.66, zF + 0.01, 0x1c1c1c);
    roundLamp(P, 0.98, skirt + 0.5, zF - 0.02, 0.08, -1, { bezel: CHROME });
    roundLamp(P, 0.78, skirt + 0.5, zF - 0.02, 0.07, -1, { bezel: CHROME });
    for (let i = 0; i < 4; i++) P.box(0.9, 0.02, 0.02, 0x8a8a86, 0, skirt + 0.4 + i * 0.06, zF - 0.03);
    P.box(0.22, 0.05, 0.02, CHROME, 0, skirt + 0.72, zF - 0.02);
    rectLamp(P, 1.1, skirt + 0.72, zF, 0.12, 0.06, AMBER, -1, 0.03);
  },
  rear(P, c) {
    const { zR, skirt } = c;
    for (let i = 0; i < 7; i++) P.box(1.6, 0.03, 0.03, 0x2a2a2a, 0, skirt + 0.5 + i * 0.08, zR + 0.01);
    rectLamp(P, 1.07, skirt + 0.7, zR, 0.18, 0.3, 0xa83028, 1, 0.03);
  },
  details(P, c) {
    const { hw, roofY } = c;
    // Ikarus lettering on the upper band
    sideText(P, 'ikarus-name', 'IKARUS', hw + 0.004, roofY - 0.18, 1.5, 0.9, 0.16, '#1b1b1b', { bg: '#e8e2cf' });
    sideText(P, 'ikarus-name-l', 'IKARUS', -hw - 0.004, roofY - 0.18, 1.5, 0.9, 0.16, '#1b1b1b', { bg: '#e8e2cf', ry: -Math.PI / 2 });
  },
};

export const manSL202 = {
  id: 'manSL202', kind: 'bus', engine: 'bus',
  L: 11.5, W: 2.5, r: 0.5, tyreW: 0.3, track: 2.08,
  zFront: -3.15, zRear: [2.6],
  floorY: 0.86, beltY: 1.42, winTop: 2.5, roofY: 2.88, skirtY: 0.34,
  wsBottom: 1.0, wsTop: 2.56, rake: 0.08,
  color: 0xe9e2c6,
  bands: [
    { y0: 0.34, y1: 0.95, color: 0xe9e2c6 },
    { y0: 0.95, y1: 1.18, color: 0x2e6a4a },
    { y0: 1.18, y1: 1.42, color: 0xe9e2c6 },
  ],
  pillarColor: 0x2a2a2a, board: 'roll',
  doors: [
    { z0: -5.5, z1: -4.3, kind: 'plug' },
    { z0: -0.85, z1: 0.35, kind: 'plug' },
    { z0: 3.55, z1: 4.75, kind: 'plug' },
  ],
  driverZ: 1.1, fill: 0.28,
  front(P, c) {
    const { zF, skirt } = c;
    P.span(-1.25, skirt + 0.3, zF - 0.015, 1.25, skirt + 0.58, zF + 0.01, 0x2a2a2a);
    rectLamp(P, 0.95, skirt + 0.44, zF - 0.02, 0.36, 0.14, LAMP, -1, 0.03);
    rectLamp(P, 0.6, skirt + 0.44, zF - 0.02, 0.14, 0.14, AMBER, -1, 0.03);
    P.box(0.3, 0.1, 0.02, CHROME, 0, skirt + 0.44, zF - 0.03);
    // green band carried across the front
    P.span(-1.25, 0.95, zF - 0.01, 1.25, 1.0, zF + 0.01, 0x2e6a4a);
  },
  rear(P, c) {
    const { zR, skirt } = c;
    for (let i = 0; i < 6; i++) P.box(1.8, 0.03, 0.03, 0x2a2a2a, 0, skirt + 0.55 + i * 0.08, zR + 0.01);
    rectLamp(P, 1.08, skirt + 0.75, zR, 0.2, 0.34, 0xa83028, 1, 0.03);
  },
  details(P, c) {
    const { hw } = c;
    // the German operator's name, never painted over
    sideText(P, 'man-stadtwerke', 'Stadtwerke  ·  Linienverkehr', -hw - 0.004, 1.07, 0.6, 3.2, 0.2, '#f1ecd8', { bg: '#2e6a4a', ry: -Math.PI / 2 });
    sideText(P, 'man-stadtwerke-r', 'Stadtwerke', hw + 0.004, 1.07, 1.6, 1.8, 0.2, '#f1ecd8', { bg: '#2e6a4a' });
    sideText(P, 'man-logo', 'MAN', 0, 0.78, c.zF - 0.02, 0.3, 0.1, '#1b1b1b', { bg: '#e9e2c6', ry: Math.PI });
  },
};

export const paz3205 = {
  id: 'paz3205', kind: 'bus', engine: 'petrol',
  L: 7.0, W: 2.5, r: 0.46, tyreW: 0.26, track: 2.0,
  zFront: -2.07, zRear: [1.53],
  floorY: 0.84, beltY: 1.36, winTop: 2.28, roofY: 2.78, skirtY: 0.4,
  wsBottom: 1.05, wsTop: 2.32, rake: 0.3,
  color: 0xf0ede2,
  bands: [
    { y0: 0.4, y1: 0.95, color: 0xf0ede2 },
    { y0: 0.95, y1: 1.08, color: 0x2d5aa0 },
    { y0: 1.08, y1: 1.36, color: 0xf0ede2 },
  ],
  bays: 4, frontPillar: 0.5, rearPillar: 0.35,
  doors: [
    { z0: -3.25, z1: -2.55, kind: 'fold' },
    { z0: 0.28, z1: 1.0, kind: 'fold' },
  ],
  hatches: [0.2], driverZ: 0.95, seatPitch: 0.76, singleRight: true, fill: 0.35,
  front(P, c) {
    const { zF, skirt, frontC } = c;
    // the rounded brow over the screen and the grille panel
    P.span(-1.2, 2.3, zF + 0.2, 1.2, 2.72, zF + 0.4, frontC);
    P.span(-0.7, skirt + 0.25, zF - 0.02, 0.7, skirt + 0.52, zF + 0.01, 0x2a2a2a);
    for (let i = 0; i < 4; i++) P.box(1.3, 0.02, 0.02, 0x8a8a86, 0, skirt + 0.3 + i * 0.06, zF - 0.03);
    roundLamp(P, 0.95, skirt + 0.42, zF - 0.02, 0.09, -1, { bezel: CHROME });
    rectLamp(P, 0.95, skirt + 0.6, zF, 0.12, 0.05, AMBER, -1, 0.03);
    P.span(-1.25, 0.95, zF - 0.01, 1.25, 1.08, zF + 0.01, 0x2d5aa0);
  },
  rear(P, c) {
    const { zR, skirt } = c;
    rectLamp(P, 1.05, skirt + 0.62, zR, 0.16, 0.26, 0xa83028, 1, 0.03);
  },
  details(P, c) {
    const { floorY, zF } = c;
    // the engine cover beside the driver
    P.span(-0.1, floorY, zF + 0.55, 0.6, floorY + 0.5, zF + 1.4, 0x5a5a58);
    sideText(P, 'paz-logo', 'ПАЗ', 0, 0.95, zF - 0.02, 0.36, 0.12, '#1b1b1b', { bg: '#d9d6cc', ry: Math.PI });
  },
};

export const county = {
  id: 'county', kind: 'bus', engine: 'diesel',
  L: 7.08, W: 2.035, r: 0.4, tyreW: 0.22, track: 1.66,
  zFront: -2.45, zRear: [1.63],
  floorY: 0.76, beltY: 1.26, winTop: 2.12, roofY: 2.52, skirtY: 0.36,
  wsBottom: 1.0, wsTop: 2.16, rake: 0.22,
  color: 0xf2f0ea,
  bands: [
    { y0: 0.36, y1: 0.86, color: 0xf2f0ea },
    { y0: 0.86, y1: 0.96, color: 0xe7b52c },
    { y0: 0.96, y1: 1.03, color: 0xf2f0ea },
    { y0: 1.03, y1: 1.08, color: 0xe7b52c },
    { y0: 1.08, y1: 1.26, color: 0xf2f0ea },
  ],
  pillarColor: 0x222222, bays: 5, frontPillar: 0.55, rearPillar: 0.3,
  doors: [{ z0: -3.4, z1: -2.82, kind: 'fold' }],
  hatches: [0], driverZ: 0.95, seatPitch: 0.74, singleRight: false, fill: 0.3,
  front(P, c) {
    const { zF, skirt } = c;
    P.span(-0.9, skirt + 0.24, zF - 0.02, 0.9, skirt + 0.5, zF + 0.01, 0x2a2a2a);
    rectLamp(P, 0.72, skirt + 0.38, zF - 0.02, 0.3, 0.14, LAMP, -1, 0.03);
    P.box(0.5, 0.1, 0.02, CHROME, 0, skirt + 0.38, zF - 0.03);
  },
  rear(P, c) {
    rectLamp(P, 0.86, c.skirt + 0.62, c.zR, 0.14, 0.3, 0xa83028, 1, 0.03);
  },
};

export const ziu682 = {
  id: 'ziu682', kind: 'bus', engine: 'electric',
  L: 11.83, W: 2.5, r: 0.51, tyreW: 0.3, track: 2.08,
  zFront: -3.4, zRear: [2.6],
  floorY: 0.94, beltY: 1.48, winTop: 2.6, roofY: 3.08, skirtY: 0.38,
  wsBottom: 1.14, wsTop: 2.66, rake: 0.12,
  color: ZIU_CREAM,
  bands: [
    { y0: 0.38, y1: 0.62, color: ZIU_RED },
    { y0: 0.62, y1: 1.3, color: ZIU_CREAM },
    { y0: 1.3, y1: 1.4, color: ZIU_RED },
    { y0: 1.4, y1: 1.48, color: ZIU_CREAM },
  ],
  frontBands: [{ y0: 0.38, y1: 0.62, color: ZIU_RED }, { y0: 0.98, y1: 1.08, color: ZIU_RED }],
  pillarColor: 0x3a3a3a,
  doors: [
    { z0: -5.65, z1: -4.45, kind: 'fold' },
    { z0: -0.9, z1: 0.3, kind: 'fold' },
    { z0: 3.6, z1: 4.8, kind: 'fold' },
  ],
  hatches: [-3.2], driverZ: 1.1, fill: 0.3,
  trolley: { baseZ: 0.1, len: 6.0, wireY: 5.8 },
  front(P, c) {
    const { zF, skirt } = c;
    roundLamp(P, 0.9, skirt + 0.46, zF - 0.02, 0.09, -1, { bezel: CHROME });
    rectLamp(P, 0.6, skirt + 0.46, zF, 0.1, 0.07, AMBER, -1, 0.03);
    // the ZiU winged badge
    P.box(0.34, 0.08, 0.02, CHROME, 0, 0.84, zF - 0.02);
  },
  rear(P, c) {
    rectLamp(P, 1.08, c.skirt + 0.7, c.zR, 0.16, 0.28, 0xa83028, 1, 0.03);
  },
  details(P, c) {
    const { hw, roofY, zF } = c;
    // red fleet number on the front and sides
    sideText(P, 'ziu-72-f', '72', -0.7, 1.0, zF - 0.02, 0.36, 0.2, '#c8282e', { bg: '#ede9da', ry: Math.PI });
    sideText(P, 'ziu-72-s', '72', hw + 0.004, 1.0, -2.2, 0.36, 0.2, '#c8282e', { bg: '#ede9da' });
    // equipment boxes on the roof
    P.span(-0.8, roofY + 0.06, -2.4, 0.8, roofY + 0.36, -0.8, 0x9a9a96);
    P.span(-0.6, roofY + 0.06, 1.2, 0.6, roofY + 0.3, 2.6, 0x9a9a96);
  },
};

export const btz5276 = {
  id: 'btz5276', kind: 'bus', engine: 'electric',
  L: 11.9, W: 2.5, r: 0.5, tyreW: 0.3, track: 2.08,
  zFront: -3.3, zRear: [2.6],
  floorY: 0.8, beltY: 1.36, winTop: 2.6, roofY: 3.05, skirtY: 0.34,
  wsBottom: 0.95, wsTop: 2.7, rake: 0.1,
  color: 0xf4f4f0, frontColor: BTZ_BLUE,
  bands: [
    { y0: 0.34, y1: 1.0, color: BTZ_BLUE },
    { y0: 1.0, y1: 1.36, color: 0xf4f4f0 },
  ],
  pillarColor: 0x222222, board: 'led', boardStyle: 'led',
  doors: [
    { z0: -5.7, z1: -4.5, kind: 'fold' },
    { z0: -0.8, z1: 0.4, kind: 'fold' },
    { z0: 3.7, z1: 4.9, kind: 'fold' },
  ],
  hatches: [-3.0], driverZ: 1.1, fill: 0.3,
  trolley: { baseZ: 0.2, len: 6.0, wireY: 5.8 },
  front(P, c) {
    const { zF, skirt } = c;
    rectLamp(P, 0.9, skirt + 0.42, zF - 0.02, 0.36, 0.13, LAMP, -1, 0.03);
    rectLamp(P, 0.62, skirt + 0.42, zF - 0.02, 0.12, 0.13, AMBER, -1, 0.03);
    sideText(P, 'btz-logo', 'БТЗ', 0, 0.7, zF - 0.02, 0.4, 0.14, '#ffffff', { bg: '#1e56c8', ry: Math.PI });
  },
  rear(P, c) {
    rectLamp(P, 1.06, c.skirt + 0.72, c.zR, 0.18, 0.3, 0xa83028, 1, 0.03);
  },
  details(P, c) {
    const { hw, roofY } = c;
    sideText(P, 'btz-num-s', '012', hw + 0.004, 1.18, -2.3, 0.4, 0.2, '#c8282e', { bg: '#f4f4f0' });
    P.span(-0.9, roofY + 0.06, -2.8, 0.9, roofY + 0.4, -0.9, 0xd8d8d4);
    P.span(-0.7, roofY + 0.06, 1.4, 0.7, roofY + 0.32, 2.8, 0xd8d8d4);
  },
};

export const BUS_SPECS = { ikarus260, manSL202, paz3205, county, ziu682, btz5276 };
export { buildBus, BLACK };
