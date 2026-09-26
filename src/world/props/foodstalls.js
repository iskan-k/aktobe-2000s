import * as THREE from 'three';
import { rngKit } from '../../core/util.js';
import { FONT } from '../../core/textures.js';
import { KERB_H } from '../plan.js';
import { atlasQuad, boardGeo } from './signs.js';
import { frame, L, box, cyl, quad, collide, interact, umbrella, priceCard, buy } from './kiosk.js';
import { addSmoke, addSizzle } from './foodSmoke.js';

/* ------------------------------------------------------------------ *
 * Street food of a 2007 summer, stall by stall.
 *
 *   samsa      a whitewashed tandyr with its clay mouth glowing, a
 *              counter with a tray of hot triangles under a blue tarp
 *   shashlik   a steel mangal on legs, skewers over the coals, smoke;
 *              a white table of onions and lepyoshka under a red umbrella
 *   chebureki  a white trailer booth with a propped-up hatch, chebureki
 *              and belyashi on the counter, the fryer seething inside
 *   chai       a table with an oilcloth, a chrome samovar, pialas, a
 *              basin of baursaks, under a green umbrella
 *   kumys      jars and canisters of kumys and shubat under an orange
 *              tarp, a hand-painted board with a horse on it
 *
 * Every `add*Stall(ctx, x, z, yaw, { y })` takes the frame kiosks use
 * (front toward local -z, facing the customer; y defaults to kerb
 * height), batches its parts, adds colliders, smoke and a buy point,
 * and returns { hx, hz } half extents in the local frame.
 *
 * Prices are estimates for June 2007, scaled from what the town already
 * charges (ice cream 50, kvass 30, a loaf 40, a can of Pepsi 90).
 * ------------------------------------------------------------------ */

export const FOOD_PRICES = { samsa: 60, shashlik: 200, cheburek: 70, belyash: 50, tea: 30, baursak: 50, kumys: 100, shubat: 120 };

const P = FOOD_PRICES;
const STEEL = 0xb4b8ba, DARK_STEEL = 0x2e2c2a, WHITE = 0xeeece4, GOLD = 0xcf8a3c;
const GLOW = { mat: 'glow', cast: false };

const at = (o, lx, ly, lz) => { const [x, y, z] = L(o, lx, ly, lz); return { x, y, z }; };

/** A small piece of food lying on a tray: rotated in the frame, one batch part. */
function piece(o, geo, color, lx, ly, lz, ry = 0) {
  const [x, y, z] = L(o, lx, ly, lz);
  const m = new THREE.Matrix4().compose(
    new THREE.Vector3(x, y, z),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(0, o.yaw + ry, 0)),
    new THREE.Vector3(1, 1, 1),
  );
  o.batch.add(geo, { color, matrix: m, cast: false });
}

/** Four table legs under a top at height h, w by d, centred on (lx, lz). */
function legs(o, w, d, h, lx, lz, color = 0x8a8a88, t = 0.035) {
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(o, t, h, t, color, lx + sx * (w / 2 - 0.05), 0, lz + sz * (d / 2 - 0.05));
}

/** A low wooden stool for the seller. */
function stool(o, lx, lz, h = 0.42, color = 0x6a4a2e) {
  box(o, 0.34, 0.04, 0.34, color, lx, h, lz);
  legs(o, 0.34, 0.34, h, lx, lz, color, 0.03);
}

/** Four posts and a sloping tarp, tilted down toward the front. */
function tarp(o, lx, lz, w, d, h, color, trim) {
  for (const sx of [-1, 1]) {
    box(o, 0.04, h + 0.06, 0.04, 0x7a7a78, lx + sx * (w / 2 - 0.05), 0, lz + d / 2 - 0.05);
    box(o, 0.04, h - 0.08, 0.04, 0x7a7a78, lx + sx * (w / 2 - 0.05), 0, lz - d / 2 + 0.05);
  }
  box(o, w + 0.12, 0.03, d + 0.12, color, lx, h - 0.03, lz, { rx: 0.07, closed: true });
  box(o, w + 0.12, 0.16, 0.02, trim, lx, h - 0.2, lz - d / 2 - 0.06, { closed: true });
}

/* ------------------------------------------------------------------ samsa */

const SAMSA_GEO = (() => {
  const g = new THREE.CylinderGeometry(0.028, 0.072, 0.05, 3);
  g.translate(0, 0.025, 0);
  return g;
})();

/**
 * The tandyr samsa stall. The tandyr is a clay jar set mouth-up in a
 * whitewashed brick plinth; the samsa bake stuck to its inner wall.
 */
export function addSamsaStall(ctx, x, z, yaw, opts = {}) {
  const o = frame(ctx, x, z, yaw, opts.y ?? KERB_H);
  const rng = rngKit(Math.round(x * 7 + z * 13));
  const TX = -0.85, TZ = 0.2;
  // the tandyr
  box(o, 1.0, 0.55, 1.0, 0xe2dccd, TX, 0, TZ);
  box(o, 1.04, 0.05, 1.04, 0xc8c0ae, TX, 0.55, TZ);
  cyl(o, 0.47, 0.42, 0xc28f5c, TX, 0.6, TZ, { seg: 16, rTop: 0.36 });
  cyl(o, 0.37, 0.06, 0x9a6a40, TX, 1.02, TZ, { seg: 16 });
  cyl(o, 0.28, 0.01, 0x24140a, TX, 1.075, TZ, { seg: 14, cast: false });
  cyl(o, 0.2, 0.01, 0xff8a3a, TX, 1.08, TZ, { seg: 12, ...GLOW });
  // soot round the mouth, the steel lid leaning on the plinth
  cyl(o, 0.4, 0.004, 0x5a4a3a, TX, 1.0, TZ, { seg: 16, cast: false });
  cyl(o, 0.3, 0.02, 0x5a5a58, TX - 0.6, 0.32, TZ + 0.15, { seg: 12, rz: 1.3 });
  // a stack of split firewood
  for (let i = 0; i < 7; i++) {
    const [ax, , az] = L(o, TX - 0.2 + (i % 4) * 0.13, 0, TZ + 0.75);
    const [bx, , bz] = L(o, TX - 0.2 + (i % 4) * 0.13, 0, TZ + 1.15);
    const y = o.y + 0.06 + Math.floor(i / 4) * 0.11;
    o.batch.tube(ax, y, az, bx, y, bz, 0.055, rng.pick([0x8a6a48, 0x7a5a3a, 0x9a7a52]), { seg: 5 });
  }
  // the counter, painted blue, an enamel tray of samsa, a cloth over half
  const CX = 0.6;
  box(o, 1.3, 0.8, 0.62, 0x2d6aa8, CX, 0, 0.05);
  box(o, 1.36, 0.04, 0.68, 0xeae6da, CX, 0.8, 0.05);
  box(o, 1.0, 0.03, 0.42, 0xf4f2ec, CX, 0.84, 0.02);
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 5; c++) {
      if (r === 2 && c > 2) continue;
      piece(o, SAMSA_GEO, rng.pick([GOLD, 0xc47e32, 0xd89648]), CX - 0.38 + c * 0.17 + (r % 2) * 0.06, 0.87, -0.1 + r * 0.13, rng.range(0, 2));
    }
  }
  box(o, 0.42, 0.05, 0.4, 0xf2eee0, CX + 0.33, 0.87, 0.14, { ry: 0.08 });
  // the tarp over the counter and the sign along its front
  tarp(o, CX, 0.05, 1.6, 1.2, 2.25, 0x2d5ea8, 0xf2eee4);
  const sign = boardGeo('stall-samsa', 1.6, 0.32, { bg: '#f2eee4', fg: '#b8342b', lines: ['Ыстық самса · Тандыр самса'], family: FONT.narrow, wear: 0.35, seed: 11 });
  quad(o, sign, CX, 1.98, -0.64);
  priceCard(o, 'samsa', ['Самса', `${P.samsa} тг`], CX - 0.45, 0.98, -0.28, 0, 0.3, 0.24);
  stool(o, CX + 0.2, 0.75);
  collide(o, TX, TZ, 1.05, 1.05, 1.1);
  collide(o, CX, 0.05, 1.4, 0.7, 0.9);
  addSmoke(ctx, at(o, TX, 1.1, TZ), { strength: 0.35, color: 0xb8b2a8 });
  interact(o, CX, 1.0, -0.4, 1.2, 0.6, 0.5, `Hot samsa from the tandyr · ${P.samsa} ₸`, (game) => buy(game, {
    price: P.samsa, what: 'samsa', sound: 'paper', hold: 'samsa',
    toast: 'Samsa straight off the tandyr wall, in a square of greaseproof paper. Mind, it is hot.',
  }, L(o, CX, 1.0, -0.3)));
  return { hx: 1.6, hz: 1.0 };
}

/* ------------------------------------------------------------------ shashlik */

/** Lamb on a skewer across the mangal: a flat steel strip and five pieces. */
function skewer(o, lx, ly, rng, len = 0.5) {
  const [ax, ay, az] = L(o, lx, ly, -len / 2);
  const [bx, by, bz] = L(o, lx, ly, len / 2 + 0.08);
  o.batch.tube(ax, ay, az, bx, by, bz, 0.005, STEEL, { seg: 3, cast: false });
  for (let k = 0; k < 5; k++) {
    box(o, 0.055, 0.05, 0.05, rng.pick([0x6e3a1e, 0x7e4626, 0x5e3018]), lx, ly - 0.025, -0.16 + k * 0.08, { ry: rng.range(0, 1), cast: false });
  }
}

export function addShashlikStall(ctx, x, z, yaw, opts = {}) {
  const o = frame(ctx, x, z, yaw, opts.y ?? KERB_H);
  const rng = rngKit(Math.round(x * 11 + z * 5));
  const MX = -0.4;
  // the mangal: a steel trough on legs, embers glowing, skewers across
  legs(o, 1.0, 0.3, 0.72, MX, 0, 0x2a2a2a, 0.03);
  box(o, 1.0, 0.02, 0.3, DARK_STEEL, MX, 0.72, 0);
  for (const s of [-1, 1]) {
    box(o, 1.0, 0.22, 0.02, DARK_STEEL, MX, 0.72, s * 0.14);
    box(o, 0.02, 0.22, 0.3, DARK_STEEL, MX + s * 0.49, 0.72, 0);
  }
  box(o, 0.96, 0.1, 0.26, 0xff7a2a, MX, 0.8, 0, GLOW);
  for (let i = 0; i < 12; i++) box(o, 0.07, 0.04, 0.06, rng.pick([0x2a1a12, 0x4a2a18, 0x8a3a1a]), MX - 0.42 + i * 0.077, 0.88, rng.range(-0.08, 0.08), { ry: rng.range(0, 2), cast: false });
  for (let i = 0; i < 7; i++) skewer(o, MX - 0.39 + i * 0.13, 1.0, rng, 0.36);
  // a white enamel bucket of lamb in marinade, and one of water
  cyl(o, 0.15, 0.3, WHITE, MX - 0.75, 0, 0.35, { seg: 10, rTop: 0.17, open: true });
  cyl(o, 0.155, 0.02, 0xb8342b, MX - 0.75, 0.29, 0.35, { seg: 10 });
  cyl(o, 0.14, 0.02, 0x8a4a2a, MX - 0.75, 0.24, 0.35, { seg: 10, cast: false });
  cyl(o, 0.14, 0.28, 0x6a8a9a, MX - 0.8, 0, -0.1, { seg: 10, rTop: 0.16, open: true });
  // the table: onions, a stack of lepyoshka, ketchup and vinegar
  const TX = 0.75, TZ = 0.15;
  box(o, 0.8, 0.04, 0.8, WHITE, TX, 0.7, TZ);
  legs(o, 0.8, 0.8, 0.7, TX, TZ, WHITE, 0.05);
  cyl(o, 0.14, 0.02, 0xf4f2ec, TX - 0.15, 0.74, TZ - 0.1, { seg: 12 });
  for (let i = 0; i < 6; i++) cyl(o, 0.04, 0.012, 0xece2cc, TX - 0.2 + (i % 3) * 0.05, 0.76, TZ - 0.14 + Math.floor(i / 3) * 0.07, { seg: 7, cast: false });
  for (let i = 0; i < 4; i++) cyl(o, 0.13, 0.035, i % 2 ? 0xc27a36 : 0xb86d2c, TX + 0.18, 0.74 + i * 0.035, TZ + 0.1, { seg: 12 });
  cyl(o, 0.03, 0.18, 0xc8202a, TX + 0.2, 0.74, TZ - 0.22, { seg: 7 });
  cyl(o, 0.025, 0.2, 0xd8d0b0, TX + 0.28, 0.74, TZ - 0.18, { seg: 7 });
  umbrella(o, TX, TZ + 0.15, { r: 1.2, h: 2.25, a: 0xc8202a, b: 0xf2eee4 });
  // the board on its easel legs
  const sign = boardGeo('stall-shashlik', 0.9, 0.62, {
    bg: '#fbf4e0', fg: '#8a1e1a', lines: ['ШАШЛЫҚ', 'Шашлык из баранины', `${P.shashlik} тг`], sizes: [1.6, 0.8, 1], family: FONT.narrow, wear: 0.4, border: '#8a1e1a', seed: 12,
  });
  quad(o, sign, TX + 0.55, 0.75, -0.62, -0.45);
  for (const s of [-1, 1]) {
    const [lx, lz] = [TX + 0.55 + Math.cos(0.45) * s * 0.4, -0.6 + Math.sin(0.45) * s * 0.4];
    box(o, 0.03, 1.05, 0.03, 0x6a4a2e, lx, 0, lz, { ry: -0.45, rx: -0.12 });
  }
  stool(o, MX + 0.2, 0.6);
  collide(o, MX, 0, 1.1, 0.4, 1.0);
  collide(o, TX, TZ, 0.85, 0.85, 0.8);
  addSmoke(ctx, at(o, MX, 1.05, 0), { strength: 1 });
  addSizzle(ctx, at(o, MX, 1.0, 0), 'grill', 0.55);
  interact(o, MX, 1.1, -0.35, 1.2, 0.6, 0.4, `A skewer of lamb shashlik · ${P.shashlik} ₸`, (game) => buy(game, {
    price: P.shashlik, what: 'shashlik', sound: 'paper', hold: 'shashlik',
    toast: 'Шашлык off the coals, with raw onion and a torn piece of lepyoshka. Bring the skewer back.',
  }, L(o, MX, 1.1, -0.2)));
  return { hx: 1.5, hz: 1.1 };
}

/* ------------------------------------------------------------------ chebureki */

const CHEBUREK_GEO = (() => {
  const g = new THREE.CylinderGeometry(0.09, 0.09, 0.016, 10, 1, false, 0, Math.PI);
  return g;
})();
const BELYASH_GEO = new THREE.CylinderGeometry(0.045, 0.048, 0.03, 10);

/** The white trailer booth selling chebureki and belyashi through a hatch. */
export function addCheburekStall(ctx, x, z, yaw, opts = {}) {
  const o = frame(ctx, x, z, yaw, opts.y ?? KERB_H);
  const rng = rngKit(Math.round(x * 3 + z * 19));
  const W = 2.2, D = 1.6, Y0 = 0.35, H = 2.1;
  // wheels, drawbar and the corner jacks
  for (const s of [-1, 1]) {
    const [wx, wy, wz] = L(o, 0, 0.3, s * (D / 2 + 0.02));
    const g = new THREE.CylinderGeometry(0.3, 0.3, 0.16, 14);
    g.rotateX(Math.PI / 2);
    o.batch.add(g, { color: 0x222222, matrix: new THREE.Matrix4().makeRotationY(o.yaw).setPosition(wx, wy, wz) });
    box(o, 0.7, 0.06, 0.08, 0xd8d8d2, 0, 0.62, s * (D / 2 + 0.04));
  }
  {
    const [ax, ay, az] = L(o, W / 2, 0.45, 0);
    const [bx, by, bz] = L(o, W / 2 + 0.75, 0.32, 0);
    o.batch.tube(ax, ay, az, bx, by, bz, 0.04, 0x3a3c3e);
    cyl(o, 0.03, 0.32, 0x3a3c3e, W / 2 + 0.72, 0, 0, { seg: 5 });
  }
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(o, 0.05, Y0, 0.05, 0x5a5a58, sx * (W / 2 - 0.1), 0, sz * (D / 2 - 0.1));
  // the body: white, a red band, a rounded roof edge
  box(o, W, H, D, 0xf0eee6, 0, Y0, 0);
  box(o, W + 0.02, 0.12, D + 0.02, 0xc8302a, 0, Y0 + 0.5, 0);
  box(o, W + 0.08, 0.08, D + 0.08, 0xd8d8d2, 0, Y0 + H, 0);
  // the hatch: dark inside, a steel counter, the flap propped up over it
  const HX = -0.2;
  box(o, 1.3, 0.78, 0.02, 0x1e1c1a, HX, 1.15, -D / 2 - 0.005);
  box(o, 1.2, 0.3, 0.02, 0x9aa0a4, HX, 1.2, -D / 2 + 0.02);
  box(o, 1.44, 0.04, 0.32, STEEL, HX, 1.1, -D / 2 - 0.16);
  box(o, 1.5, 0.04, 0.72, 0xc8302a, HX, Y0 + 1.62, -D / 2 - 0.34, { rx: -0.3 });
  for (const s of [-1, 1]) {
    const [ax, ay, az] = L(o, HX + s * 0.6, 1.14, -D / 2 - 0.02);
    const [bx, by, bz] = L(o, HX + s * 0.6, 1.78, -D / 2 - 0.62);
    o.batch.tube(ax, ay, az, bx, by, bz, 0.012, 0x6a6a68, { seg: 4, cast: false });
  }
  // trays on the counter: chebureki on the left, belyashi on the right
  box(o, 0.56, 0.02, 0.26, WHITE, HX - 0.34, 1.14, -D / 2 - 0.16);
  box(o, 0.5, 0.02, 0.26, WHITE, HX + 0.36, 1.14, -D / 2 - 0.16);
  for (let i = 0; i < 4; i++) piece(o, CHEBUREK_GEO, rng.pick([0xdca55c, 0xd09448]), HX - 0.52 + i * 0.12, 1.17 + i * 0.012, -D / 2 - 0.18, Math.PI / 2 + rng.range(-0.2, 0.2));
  for (let i = 0; i < 6; i++) piece(o, BELYASH_GEO, rng.pick([0xb8742e, 0xc4803a]), HX + 0.2 + (i % 3) * 0.11, 1.16, -D / 2 - 0.22 + Math.floor(i / 3) * 0.11);
  // the name on a board on the roof
  const sign = boardGeo('stall-cheburek', 2.1, 0.42, {
    bg: '#f0eee6', fg: '#b8242a', lines: ['Шебурек · Беляш', 'Чебуреки · Беляши'], sizes: [1, 1], family: FONT.narrow, wear: 0.3, border: '#b8242a', seed: 13,
  });
  box(o, 2.0, 0.42, 0.04, 0xd8d8d2, 0, Y0 + H + 0.08, -D / 2 + 0.12);
  quad(o, sign, 0, Y0 + H + 0.29, -D / 2 + 0.095);
  priceCard(o, 'cheburek', [`Чебурек ${P.cheburek} тг`, `Беляш ${P.belyash} тг`], 0.82, 1.3, -D / 2 - 0.012, 0, 0.4, 0.3);
  // the red gas bottle by the side and the fryer's vent pipe on the roof
  cyl(o, 0.15, 0.62, 0xc8302a, W / 2 + 0.22, 0, 0.45, { seg: 10 });
  cyl(o, 0.08, 0.1, 0xc8302a, W / 2 + 0.22, 0.62, 0.45, { seg: 8, rTop: 0.04 });
  cyl(o, 0.07, 0.4, 0x8a8e90, 0.6, Y0 + H + 0.08, 0.3, { seg: 8 });
  collide(o, 0, 0, W + 0.1, D + 0.1, Y0 + H + 0.2);
  addSmoke(ctx, at(o, 0.6, Y0 + H + 0.5, 0.3), { strength: 0.3, color: 0xd4d0c8 });
  addSizzle(ctx, at(o, HX, 1.3, 0), 'fryer', 0.45);
  interact(o, HX - 0.35, 1.25, -D / 2 - 0.25, 0.6, 0.6, 0.5, `A cheburek with lamb · ${P.cheburek} ₸`, (game) => buy(game, {
    price: P.cheburek, what: 'a cheburek', sound: 'paper', hold: 'cheburek',
    toast: 'A cheburek the size of your hand, fresh from the oil. Bite a corner first and let the steam out.',
  }, L(o, HX - 0.35, 1.25, -D / 2)));
  interact(o, HX + 0.35, 1.25, -D / 2 - 0.25, 0.6, 0.6, 0.5, `A belyash · ${P.belyash} ₸`, (game) => buy(game, {
    price: P.belyash, what: 'a belyash', sound: 'paper', hold: 'belyash',
    toast: 'A belyash, open in the middle over the meat. The napkin is already see-through.',
  }, L(o, HX + 0.35, 1.25, -D / 2)));
  return { hx: 1.9, hz: 1.2 };
}

/* ------------------------------------------------------------------ chai */

/** A chrome electric samovar with brass trim, a teapot keeping warm on top. */
function samovar(o, lx, ly, lz) {
  const CHROME = 0xc8ccce, BRASS = 0xc9a24a;
  cyl(o, 0.1, 0.05, BRASS, lx, ly, lz, { seg: 10, rTop: 0.07 });
  cyl(o, 0.05, 0.05, CHROME, lx, ly + 0.05, lz, { seg: 8 });
  cyl(o, 0.13, 0.32, CHROME, lx, ly + 0.1, lz, { seg: 14, rTop: 0.15 });
  cyl(o, 0.155, 0.03, BRASS, lx, ly + 0.42, lz, { seg: 14 });
  cyl(o, 0.1, 0.06, CHROME, lx, ly + 0.45, lz, { seg: 12, rTop: 0.06 });
  // handles, the tap
  for (const s of [-1, 1]) box(o, 0.06, 0.03, 0.02, 0x2a2a2a, lx + s * 0.17, ly + 0.36, lz);
  box(o, 0.03, 0.03, 0.1, BRASS, lx, ly + 0.14, lz - 0.16);
  box(o, 0.03, 0.05, 0.03, BRASS, lx, ly + 0.1, lz - 0.2);
  // the china teapot on the crown
  const [tx, ty, tz] = L(o, lx, ly + 0.58, lz);
  const pot = new THREE.SphereGeometry(0.08, 12, 8);
  pot.scale(1, 0.8, 1);
  o.batch.add(pot, { color: 0xf4f2ec, matrix: new THREE.Matrix4().makeTranslation(tx, ty, tz) });
  const [sx, sy, sz] = L(o, lx, ly + 0.56, lz - 0.07);
  const [ex, ey, ez] = L(o, lx, ly + 0.64, lz - 0.14);
  o.batch.tube(sx, sy, sz, ex, ey, ez, 0.012, 0xf4f2ec, { seg: 5, cast: false });
  cyl(o, 0.035, 0.02, 0x1f3f9a, lx, ly + 0.63, lz, { seg: 8 });
}

const PIALA_GEO = (() => {
  const g = new THREE.CylinderGeometry(0.048, 0.024, 0.05, 10, 1, true);
  g.translate(0, 0.025, 0);
  return g;
})();
const BAURSAK_GEO = new THREE.BoxGeometry(0.05, 0.035, 0.05);

export function addChaiStall(ctx, x, z, yaw, opts = {}) {
  const o = frame(ctx, x, z, yaw, opts.y ?? KERB_H);
  const rng = rngKit(Math.round(x * 17 + z * 23));
  // the table under a red-and-white oilcloth that hangs over the front
  box(o, 1.4, 0.04, 0.8, 0xc9443a, 0, 0.72, 0);
  box(o, 1.42, 0.2, 0.01, 0xc9443a, 0, 0.54, -0.405);
  for (let i = 0; i < 7; i++) box(o, 0.08, 0.2, 0.012, 0xf2eee4, -0.6 + i * 0.2, 0.54, -0.41);
  legs(o, 1.4, 0.8, 0.72, 0, 0);
  samovar(o, -0.4, 0.76, 0.1);
  // pialas upside down in stacks, and two poured, steaming
  for (let s = 0; s < 3; s++) {
    for (let k = 0; k < 4; k++) {
      const [px, py, pz] = L(o, 0.02 + s * 0.12, 0.76 + 0.05 + k * 0.018, 0.18);
      const m = new THREE.Matrix4().makeRotationX(Math.PI).setPosition(px, py, pz);
      o.batch.add(PIALA_GEO, { color: 0xf4f2ec, matrix: m, cast: false });
    }
  }
  for (const s of [-1, 1]) {
    const [px, py, pz] = L(o, 0.05 + s * 0.09, 0.76, -0.18);
    o.batch.add(PIALA_GEO, { color: 0xf4f2ec, matrix: new THREE.Matrix4().makeTranslation(px, py, pz), cast: false });
    cyl(o, 0.04, 0.004, 0x8a4414, 0.05 + s * 0.09, 0.8, -0.18, { seg: 10, cast: false });
  }
  // an enamel basin heaped with baursaks, and a red thermos
  const BX = 0.45, BZ = 0.02;
  cyl(o, 0.22, 0.12, 0xf4f2ec, BX, 0.76, BZ, { seg: 14, rTop: 0.27, open: true });
  cyl(o, 0.275, 0.015, 0x2d5ea8, BX, 0.875, BZ, { seg: 14 });
  for (let i = 0; i < 26; i++) {
    const a = rng.range(0, Math.PI * 2), d = Math.sqrt(rng.next()) * 0.22;
    piece(o, BAURSAK_GEO, rng.pick([0xd49848, 0xc88a3a, 0xdcaa5c]), BX + Math.cos(a) * d, 0.8 + (0.22 - d) * 0.35, BZ + Math.sin(a) * d, rng.range(0, 2));
  }
  cyl(o, 0.06, 0.32, 0xc8302a, 0.62, 0.76, 0.28, { seg: 10 });
  cyl(o, 0.045, 0.06, 0xd8d8d2, 0.62, 1.08, 0.28, { seg: 8 });
  umbrella(o, 0, 0.35, { r: 1.25, h: 2.25, a: 0x2f7a4a, b: 0xf2eee4 });
  const sign = boardGeo('stall-chai', 1.3, 0.36, { bg: '#f6f0dc', fg: '#2f6a3a', lines: ['Шай · Бауырсақ', 'Чай · Баурсаки'], family: FONT.narrow, wear: 0.3, border: '#2f6a3a', seed: 14 });
  quad(o, sign, 0, 2.02, -0.02, 0);
  quad(o, sign, 0, 2.02, 0.02, Math.PI);
  priceCard(o, 'chai', [`Шай ${P.tea} тг`, `Бауырсақ ${P.baursak} тг`], -0.1, 0.9, -0.3, 0, 0.36, 0.24);
  stool(o, -0.35, 0.75);
  stool(o, 0.35, 0.8);
  collide(o, 0, 0, 1.5, 0.9, 0.9);
  addSmoke(ctx, at(o, -0.4, 1.45, 0.1), { strength: 0.12, color: 0xe8e6e0 });
  interact(o, -0.3, 1.0, -0.35, 0.7, 0.6, 0.4, `A piala of hot tea · ${P.tea} ₸`, (game) => buy(game, {
    price: P.tea, what: 'tea', sound: 'pour', hold: 'tea',
    toast: 'Strong black tea with milk, poured a third full so it stays hot and you come back for more.',
  }, L(o, -0.3, 1.0, -0.2)));
  interact(o, 0.4, 1.0, -0.35, 0.6, 0.6, 0.4, `A cone of warm baursaks · ${P.baursak} ₸`, (game) => buy(game, {
    price: P.baursak, what: 'baursaks', sound: 'paper', hold: 'baursak',
    toast: 'A twist of paper full of baursaks, still warm and a little greasy. Nobody eats just one.',
  }, L(o, 0.4, 1.0, -0.2)));
  return { hx: 1.4, hz: 1.2 };
}

/* ------------------------------------------------------------------ kumys */

/** A mare and foal in brown on the board below the name, as painted by hand. */
function horseGeo() {
  return atlasQuad('stall-kumys-horse', 0.8, 0.36, (c, pw, ph) => {
    c.fillStyle = '#f4efe0';
    c.fillRect(0, 0, pw, ph);
    const horse = (cx, cy, s, col) => {
      c.fillStyle = col;
      c.beginPath(); c.ellipse(cx, cy, 40 * s, 18 * s, 0, 0, Math.PI * 2); c.fill();
      c.beginPath();
      c.moveTo(cx + 26 * s, cy - 8 * s); c.lineTo(cx + 48 * s, cy - 40 * s); c.lineTo(cx + 60 * s, cy - 36 * s); c.lineTo(cx + 40 * s, cy + 2 * s);
      c.fill();
      c.beginPath(); c.ellipse(cx + 60 * s, cy - 34 * s, 13 * s, 7 * s, 0.5, 0, Math.PI * 2); c.fill();
      for (const lx of [-30, -20, 22, 32]) c.fillRect(cx + lx * s, cy + 8 * s, 6 * s, 34 * s);
      c.lineWidth = 6 * s;
      c.strokeStyle = col;
      c.beginPath(); c.moveTo(cx - 38 * s, cy - 6 * s); c.quadraticCurveTo(cx - 58 * s, cy, cx - 52 * s, cy + 26 * s); c.stroke();
    };
    const k = ph / 110;
    horse(pw * 0.36, ph * 0.5, k, '#7a4a2a');
    horse(pw * 0.7, ph * 0.6, k * 0.6, '#a86a3a');
    c.strokeStyle = '#1f3f9a';
    c.lineWidth = 4;
    c.strokeRect(4, 4, pw - 8, ph - 8);
  }, { ppm: 200 });
}

export function addKumysStall(ctx, x, z, yaw, opts = {}) {
  const o = frame(ctx, x, z, yaw, opts.y ?? KERB_H);
  const rng = rngKit(Math.round(x * 29 + z * 3));
  // a table with a white cloth, three-litre jars and plastic bottles of it
  box(o, 1.4, 0.04, 0.7, 0xf2f0ea, 0, 0.72, 0);
  box(o, 1.42, 0.25, 0.01, 0xf2f0ea, 0, 0.5, -0.355);
  legs(o, 1.4, 0.7, 0.72, 0, 0);
  for (let i = 0; i < 5; i++) {
    const lx = -0.55 + i * 0.2, milk = i === 4 ? 0xf7f2e2 : 0xf1eee4;
    cyl(o, 0.075, 0.22, milk, lx, 0.76, 0.12, { seg: 10 });
    cyl(o, 0.05, 0.03, 0xe8e6e0, lx, 0.98, 0.12, { seg: 8 });
    cyl(o, 0.052, 0.02, 0x2a5ab8, lx, 1.01, 0.12, { seg: 8 });
  }
  for (let i = 0; i < 4; i++) {
    cyl(o, 0.04, 0.2, 0xf1eee4, -0.5 + i * 0.13, 0.76, -0.16, { seg: 8 });
    cyl(o, 0.018, 0.04, rng.pick([0x2a5ab8, 0xc8302a]), -0.5 + i * 0.13, 0.96, -0.16, { seg: 6 });
  }
  // two poured pialas
  for (const s of [-1, 1]) {
    const [px, py, pz] = L(o, 0.4 + s * 0.1, 0.76, -0.14);
    o.batch.add(PIALA_GEO, { color: 0xf4f2ec, matrix: new THREE.Matrix4().makeTranslation(px, py, pz), cast: false });
    cyl(o, 0.042, 0.004, 0xf4f0e4, 0.4 + s * 0.1, 0.8, -0.14, { seg: 10, cast: false });
  }
  // white five-litre canisters on the ground, a wooden tub with its churn
  for (let i = 0; i < 3; i++) {
    box(o, 0.2, 0.32, 0.15, 0xf2f2ee, -0.85 + i * 0.05, 0, 0.3 - i * 0.24, { ry: rng.range(-0.3, 0.3) });
    box(o, 0.08, 0.05, 0.03, 0x2a5ab8, -0.85 + i * 0.05, 0.32, 0.3 - i * 0.24);
  }
  cyl(o, 0.2, 0.55, 0x8a6440, 0.95, 0, 0.25, { seg: 12, rTop: 0.17 });
  for (const h of [0.08, 0.42]) cyl(o, 0.205, 0.035, 0x3a3a38, 0.95, h, 0.25, { seg: 12 });
  {
    const [ax, ay, az] = L(o, 0.95, 0.5, 0.25);
    const [bx, by, bz] = L(o, 0.98, 1.3, 0.22);
    o.batch.tube(ax, ay, az, bx, by, bz, 0.02, 0xa88a60, { seg: 5 });
  }
  tarp(o, 0, 0.05, 2.2, 1.4, 2.15, 0xd87a2a, 0xd87a2a);
  // the hand-painted board on a stake at the front corner
  const name = boardGeo('stall-kumys', 0.8, 0.46, {
    bg: '#f4efe0', fg: '#1f3f9a', lines: ['ҚЫМЫЗ · ШҰБАТ', 'Кумыс · Шубат'], sizes: [1.2, 1], family: FONT.narrow, wear: 0.45, seed: 15,
  });
  box(o, 0.05, 1.45, 0.05, 0x6a5a44, -0.95, 0, -0.78);
  quad(o, name, -0.95, 1.2, -0.81, 0.25);
  quad(o, horseGeo(), -0.95, 0.8, -0.81, 0.25);
  priceCard(o, 'kumys', [`Қымыз ${P.kumys} тг`, `Шұбат ${P.shubat} тг`], 0.05, 0.9, -0.3, 0, 0.4, 0.24);
  stool(o, 0.3, 0.7);
  collide(o, 0, 0, 1.5, 0.8, 0.9);
  collide(o, 0.95, 0.25, 0.44, 0.44, 0.6);
  interact(o, -0.3, 1.0, -0.35, 0.7, 0.6, 0.4, `A piala of kumys · ${P.kumys} ₸`, (game) => buy(game, {
    price: P.kumys, what: 'kumys', sound: 'pour', hold: 'kumys',
    toast: 'Қымыз, this morning\'s milking. Sour, fizzy, and it goes to your head a little.',
  }, L(o, -0.3, 1.0, -0.2)));
  interact(o, 0.35, 1.0, -0.35, 0.6, 0.6, 0.4, `A piala of shubat · ${P.shubat} ₸`, (game) => buy(game, {
    price: P.shubat, what: 'shubat', sound: 'pour', hold: 'shubat',
    toast: 'Шұбат, camel\'s milk from a farm down the Orsk road. Thicker than kumys and good for you, they say.',
  }, L(o, 0.35, 1.0, -0.2)));
  return { hx: 1.5, hz: 1.2 };
}

/** Footprint (along, across) each stall needs on a pavement, for placers. */
export const FOOD_FOOT = {
  samsa: [3.4, 2.3],
  shashlik: [3.2, 2.4],
  chebureki: [3.1, 2.5],
  chai: [2.8, 2.4],
  kumys: [3.0, 2.4],
};

export const FOOD_BUILD = {
  samsa: addSamsaStall,
  shashlik: addShashlikStall,
  chebureki: addCheburekStall,
  chai: addChaiStall,
  kumys: addKumysStall,
};
