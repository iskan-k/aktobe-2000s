import '../../core/sounds.js';
import { PAL } from '../../core/palette.js';
import { rngKit } from '../../core/util.js';
import {
  ROADS, JUNCTIONS, BLOCKS, BOUNDS, RAIL, STOPS, KERB_H, KERB_W,
  halfWidth, onCarriageway, onStreet, stopPlacement, roadById,
} from '../plan.js';
import { addBench, addBin } from '../props/street.js';
import { addShelter, SHELTER_SIZE } from '../props/busstop.js';
import {
  addLarek, addPavilion, addBooth, addIceCream, addKvass, addFlowers,
  addPayphone, addPostbox, addBicycle, brandPoster,
} from '../props/kiosk.js';
import { addMastBoard, addPostBoard, addLampBanners } from '../props/billboards.js';
import {
  ATLAS, addQuad, roadSignGeo, signBackGeo, streetPlateGeo, addSignPost,
  litterGeo, crackGeo, stainGeo, fluffGeo,
} from '../props/signs.js';
import { addDog, addPigeonFlock, addSparrows } from '../props/animals.js';

/* ------------------------------------------------------------------ *
 * Street life: everything on the pavements between the blocks.
 *
 *   shelters  one at every stop in plan.js STOPS (props/busstop.js)
 *   kiosks    lareks, pavilions, booths, ice cream and kvass, flowers,
 *             payphones and post boxes, clustered round the stops
 *   boards    6 x 3 m billboards on the avenue median and on posts,
 *             banners on the median lamps
 *   signs     GOST road signs, street name plates, pedestrian rails
 *   clutter   benches and bins, husks and butts, bottles, cracks, dried
 *             puddles, bicycles, and poplar fluff in the gutters
 *   animals   stray dogs, pigeons, sparrows (props/animals.js)
 *
 * Every placement goes through one Placer. It knows the pavement band
 * of every street and refuses a spot that overlaps a collider, the
 * carriageway, a trolleybus or signal pole, a junction corner, a block,
 * or something street life already put there. What it took is published
 * in ctx.spots.streetlife for the district builders that run after it.
 * ------------------------------------------------------------------ */

const JUNCTION_CLEAR = 2.5;   // keep this far past a crossing street's corridor
const EDGE = 3;               // and this far inside the town bounds
const BLOCK_LIST = Object.values(BLOCKS);
const GROUND_PITCH = -Math.PI / 2;
const QUADRANTS = [['N', 'E', 1, -1], ['N', 'W', -1, -1], ['S', 'E', 1, 1], ['S', 'W', -1, 1]];

/* ------------------------------------------------------------------ *
 * What the kiosks sell
 * ------------------------------------------------------------------ */

const ITEMS = {
  kcell: {
    label: "K'Cell top-up card", price: 500, what: 'a top-up card', sound: 'paper',
    toast: "A K'Cell card for 500. You scratch off the silver strip and type in the code.",
    sms: ["K'Cell", "Ваш баланс пополнен на 500 тг. Спасибо, что выбрали K'Cell!"],
  },
  seeds: {
    label: 'A paper cone of семечки', price: 20, what: 'sunflower seeds', sound: 'paper',
    toast: 'Salted семечки in a twist of newspaper. Now you know where the husks come from.',
  },
  pepsi: {
    label: 'A cold can of Pepsi', price: 90, what: 'a Pepsi', sound: 'canOpen',
    toast: 'Pepsi, cold from the fridge at the back. The can says «Пепси».',
  },
  tarkhun: {
    label: 'A bottle of «Тархун»', price: 60, what: 'lemonade', sound: 'canOpen',
    toast: 'Green Тархун lemonade. It tastes of tarragon and 1985.',
  },
  turbo: {
    label: '«Turbo» chewing gum', price: 15, what: 'chewing gum', sound: 'paper',
    toast: 'Turbo gum. The insert is a Lamborghini Countach. Keep it.',
  },
  bread: {
    label: 'A loaf of white bread', price: 40, what: 'bread', sound: 'paper',
    toast: 'A warm brick of white bread. The crust is gone before you get home.',
  },
};

/* ------------------------------------------------------------------ *
 * Where things go. Along-positions are x on east-west streets and z on
 * north-south ones; side 0 is the north / west pavement. The Placer
 * nudges each one along the pavement until it fits.
 * ------------------------------------------------------------------ */

const KIOSKS = [
  // avenue, north side: the bazaar stop. The bazaar gate (x 47..63) stays clear.
  { road: 'ave', side: 0, at: 39.9, kind: 'booth', o: { kind: 'press' } },
  { road: 'ave', side: 0, at: 43.0, kind: 'larek', o: { sign: ['24 сағат', '24 часа'], item: ITEMS.kcell, variant: 1, poster: 'kcell' }, sparrows: true },
  { road: 'ave', side: 0, at: 68.8, kind: 'icecream' },
  { road: 'ave', side: 0, at: 74.2, kind: 'pavilion', o: { w: 5.6, d: 2.4, item: ITEMS.bread }, sparrows: true },
  { road: 'ave', side: 0, at: 80.3, kind: 'kvass' },
  { road: 'ave', side: 0, at: 85.2, kind: 'larek', o: { sign: ['Сусындар', 'Напитки'], item: ITEMS.pepsi, variant: 3, poster: 'activ' } },
  // avenue, north side: by the akimat
  { road: 'ave', side: 0, at: -62.4, kind: 'booth', o: { kind: 'exchange' } },
  { road: 'ave', side: 0, at: -58.9, kind: 'flowers' },
  { road: 'ave', side: 0, at: -56.0, kind: 'payphone' },
  { road: 'ave', side: 0, at: -54.9, kind: 'payphone' },
  { road: 'ave', side: 0, at: -79.4, kind: 'larek', o: { sign: ['Темекі', 'Табак'], item: ITEMS.turbo, variant: 5, poster: 'kmobile' } },
  { road: 'ave', side: 0, at: -82.2, kind: 'postbox' },
  { road: 'ave', side: 0, at: -190, kind: 'larek', o: { item: ITEMS.tarkhun, variant: 0 } },
  // avenue, south side
  { road: 'ave', side: 1, at: 66.4, kind: 'larek', o: { sign: ['Азық-түлік', 'Продукты'], item: ITEMS.seeds, variant: 2, poster: 'beeline' }, sparrows: true },
  { road: 'ave', side: 1, at: 51.6, kind: 'payphone' },
  { road: 'ave', side: 1, at: 50.5, kind: 'payphone' },
  { road: 'ave', side: 1, at: 49.3, kind: 'postbox' },
  { road: 'ave', side: 1, at: -86.8, kind: 'larek', o: { sign: ['24 сағат', '24 часа'], item: ITEMS.kcell, variant: 4, poster: 'kcell' } },
  { road: 'ave', side: 1, at: -106.5, kind: 'booth', o: { kind: 'press' } },
  { road: 'ave', side: 1, at: 150, kind: 'larek', o: { item: ITEMS.tarkhun, variant: 6 }, sparrows: true },
  { road: 'ave', side: 1, at: 153.2, kind: 'larek', o: { sign: ['Сыра', 'Пиво'], variant: 7, poster: 'beeline' } },
  { road: 'ave', side: 1, at: 188, kind: 'pavilion', o: { w: 5.6, d: 2.4, sign: ['Дүкен', 'Магазин «Айгүл»'], item: ITEMS.bread } },
  // Вокзальная, the station side
  { road: 'vokzal', side: 0, at: -56, kind: 'larek', o: { w: 2.3, d: 1.6, item: ITEMS.pepsi, variant: 1 }, sparrows: true, bike: true },
  { road: 'vokzal', side: 0, at: -59.2, kind: 'larek', o: { w: 2.3, d: 1.6, sign: ['Самса', 'Беляши'], variant: 2, poster: 'kcell' } },
  { road: 'vokzal', side: 0, at: -38, kind: 'icecream' },
  { road: 'vokzal', side: 0, at: -41.2, kind: 'payphone' },
  // one larek each on Маресьева and Пушкина
  { road: 'south', side: 1, at: 46, kind: 'larek', o: { w: 2.2, d: 1.5, item: ITEMS.seeds, variant: 5 }, bike: true },
  { road: 'west', side: 0, at: 30, kind: 'larek', o: { w: 2.2, d: 1.5, item: ITEMS.turbo, variant: 3, poster: 'activ' } },
  // payphones and post boxes by the side-street stops
  { road: 'mid', side: 0, at: 41, kind: 'payphone' },
  { road: 'mid', side: 0, at: 42.2, kind: 'postbox' },
  { road: 'east', side: 0, at: -55, kind: 'payphone' },
];

/**
 * World rectangles kept clear of anything that stands up: the avenue
 * pavement in front of the bazaar gate (gate at x 56 on the block edge).
 * Same as KEEP_CLEAR in the lead's plan.js, which this branch predates.
 */
const KEEP_CLEAR = [
  { x0: 45, x1: 67, z0: -15, z1: -7.6, what: 'bazaar gate' },
];

const MASTS = [[-178, 'zhasa', 'kcell'], [-115, 'halyk', 's2030'], [-55, 'guldene', 'beeline'], [70, 'kkb', 'zhasa'], [150, 's2030', 'bta']];
const POST_BOARDS = [
  { road: 'ave', side: 1, at: -205, key: 'kkb' },
  { road: 'ave', side: 0, at: 205, key: 'halyk' },
  { road: 'south', side: 1, at: -90, key: 'beeline' },
  { road: 'south', side: 1, at: 150, key: 'guldene' },
];

const FLOCKS = [
  { x: 55, z: -12.2, n: 14, rx: 3.6, rz: 1.0 },    // in front of the bazaar gate
  { x: 45.5, z: 12.3, n: 10, rx: 2.4, rz: 0.8 },   // rynok-s
  { x: -63.8, z: -11.1, n: 9, rx: 1.8, rz: 0.6 },  // akimat-n
  { x: -60, z: 12.3, n: 14, rx: 3.2, rz: 1.0 },    // the square
  { x: -33, z: -117.5, n: 12, rx: 2.4, rz: 0.6 },  // the station
  { x: -26.7, z: 58, n: 8, rx: 0.5, rz: 2.4 },     // 12 microdistrict
];

const DOGS = [
  { road: 'ave', side: 0, at: 88.6, across: 'back', coat: 0 },
  { road: 'vokzal', side: 0, at: -64, across: 'back', coat: 1 },
  { road: 'ave', side: 1, at: -128, across: 9.6, coat: 2 },
];

/* ------------------------------------------------------------------ *
 * Pavement model
 * ------------------------------------------------------------------ */

function subtract(spans, c0, c1) {
  const out = [];
  for (const [a, b] of spans) {
    if (c1 <= a || c0 >= b) { out.push([a, b]); continue; }
    if (c0 > a) out.push([a, c0]);
    if (c1 < b) out.push([c1, b]);
  }
  return out;
}

/** Along-intervals of road r where street life may stand. */
function stripSpans(r) {
  let spans = [[r.a, r.b]];
  const cut = (a, b) => { spans = subtract(spans, a, b); };
  for (const j of JUNCTIONS) {
    if ((r.axis === 'x' ? j.rx : j.rz) !== r) continue;
    const C = r.axis === 'x' ? j.rz : j.rx;
    cut(C.c - halfWidth(C) - C.walk[0] - JUNCTION_CLEAR, C.c + halfWidth(C) + C.walk[1] + JUNCTION_CLEAR);
  }
  const lo = r.axis === 'x' ? BOUNDS.x0 : BOUNDS.z0;
  const hi = r.axis === 'x' ? BOUNDS.x1 : BOUNDS.z1;
  cut(-Infinity, lo + EDGE);
  cut(hi - EDGE, Infinity);
  if (r.axis === 'z') cut(RAIL.corridor[0] - 4, RAIL.corridor[1] + 4);
  // side streets that run on through a block rectangle (the station
  // approach, beyond the south road) belong to that block's builder; the
  // avenue stays street all the way to the edge of town
  if (!r.major) {
    for (const b of BLOCK_LIST) {
      if (r.axis === 'x' && r.c > b.z0 && r.c < b.z1) cut(b.x0, b.x1);
      if (r.axis === 'z' && r.c > b.x0 && r.c < b.x1) cut(b.z0, b.z1);
    }
  }
  return spans.filter(([a, b]) => b - a > 3);
}

/**
 * One pavement: road r, side 0 / 1. Across distances are measured from
 * the road's centreline. band0..band1 is the free walking band (behind
 * the tree strip where there is one); `facing` is the yaw of something
 * standing on it with its front to the road.
 */
function makeStrips() {
  const out = new Map();
  for (const r of ROADS) {
    const hw = halfWidth(r);
    for (const side of [0, 1]) {
      if (!(r.walk[side] > 0)) continue;
      const sgn = side ? 1 : -1;
      const trees = r.trees[side];
      out.set(`${r.id}/${side}`, {
        r, side, sgn, hw,
        band0: hw + KERB_W + (trees > 0 ? 0.1 + trees + 0.12 : 0.12),
        band1: hw + r.walk[side],
        facing: r.axis === 'x' ? (sgn > 0 ? 0 : Math.PI) : (sgn > 0 ? Math.PI / 2 : -Math.PI / 2),
        spans: stripSpans(r),
      });
    }
  }
  return out;
}

const at = (s, along, across) => (s.r.axis === 'x' ? [along, s.r.c + s.sgn * across] : [s.r.c + s.sgn * across, along]);

function rectOf(s, a0, a1, c0, c1) {
  const [x0, z0] = at(s, a0, c0);
  const [x1, z1] = at(s, a1, c1);
  return [Math.min(x0, x1), Math.min(z0, z1), Math.max(x0, x1), Math.max(z0, z1)];
}

const inSpans = (s, a0, a1) => s.spans.some(([p, q]) => a0 >= p && a1 <= q);

/** World direction of "along, decreasing" on a strip's road. */
const backAlong = (s) => (s.r.axis === 'x' ? [-1, 0] : [0, -1]);

function aabbOf(c) {
  if (c.kind === 'box') return [c.x0, c.z0, c.x1, c.z1];
  if (c.kind === 'circle') return [c.cx - c.r, c.cz - c.r, c.cx + c.r, c.cz + c.r];
  const ex = Math.abs(c.hx * c.cos) + Math.abs(c.hz * c.sin);
  const ez = Math.abs(c.hx * c.sin) + Math.abs(c.hz * c.cos);
  return [c.cx - ex, c.cz - ez, c.cx + ex, c.cz + ez];
}

class Placer {
  constructor(ctx) {
    this.ctx = ctx;
    this.strips = makeStrips();
    this.taken = [];
    this.poles = [...(ctx.spots.trolleyPoles || [])];
    // traffic-light poles stand 1.2 m in from each carriageway corner (traffic/signals.js)
    for (const j of JUNCTIONS) {
      if (!j.signal) continue;
      for (const [, , sx, sz] of QUADRANTS) this.poles.push({ x: j.x + sx * (j.hx + 1.2), z: j.z + sz * (j.hz + 1.2) });
    }
    this.corners = JUNCTIONS.map((j) => [
      j.x - j.hx - j.rz.walk[0] - JUNCTION_CLEAR, j.z - j.hz - j.rx.walk[0] - JUNCTION_CLEAR,
      j.x + j.hx + j.rz.walk[1] + JUNCTION_CLEAR, j.z + j.hz + j.rx.walk[1] + JUNCTION_CLEAR,
    ]);
  }

  strip(road, side) { return this.strips.get(`${road}/${side}`); }

  /** Is the world rectangle [x0, z0, x1, z1] clear, with `pad` metres round it? */
  free(rect, { pad = 0.3, junction = true, taken = true } = {}) {
    const [x0, z0, x1, z1] = rect;
    const X0 = x0 - pad, Z0 = z0 - pad, X1 = x1 + pad, Z1 = z1 + pad;
    if (x0 < BOUNDS.x0 + EDGE || x1 > BOUNDS.x1 - EDGE || z0 < BOUNDS.z0 + EDGE || z1 > BOUNDS.z1 - EDGE) return false;
    if (z1 > RAIL.corridor[0] - 4 && z0 < RAIL.corridor[1] + 4) return false;
    const pts = [[x0, z0], [x1, z0], [x0, z1], [x1, z1], [(x0 + x1) / 2, (z0 + z1) / 2]];
    if (pts.some(([x, z]) => !onStreet(x, z) || onCarriageway(x, z, 0.15))) return false;
    if (KEEP_CLEAR.some((k) => x1 > k.x0 && x0 < k.x1 && z1 > k.z0 && z0 < k.z1)) return false;
    if (junction && this.corners.some((c) => X1 > c[0] && X0 < c[2] && Z1 > c[1] && Z0 < c[3])) return false;
    if (this.poles.some((p) => p.x > X0 - 0.3 && p.x < X1 + 0.3 && p.z > Z0 - 0.3 && p.z < Z1 + 0.3)) return false;
    for (const c of this.ctx.colliders.near(X0, Z0, X1, Z1)) {
      const a = aabbOf(c);
      if (a[0] < X1 && a[2] > X0 && a[1] < Z1 && a[3] > Z0) return false;
    }
    if (taken && this.taken.some((t) => t.x0 < X1 && t.x1 > X0 && t.z0 < Z1 && t.z1 > Z0)) return false;
    return true;
  }

  take(rect, kind) {
    this.taken.push({ x0: rect[0], z0: rect[1], x1: rect[2], z1: rect[3], kind });
  }

  /**
   * Find room for a wa (along) x da (across) footprint on strip s near
   * `along`, stepping outward up to `search` metres. `across` is 'back'
   * (against the block), 'front' (behind the tree strip) or a distance.
   */
  slot(s, along, wa, da, { across = 'back', search = 4, step = 0.5, kind = '', pad = 0.3, junction = true } = {}) {
    const c = across === 'back' ? s.band1 - da / 2 - 0.1 : across === 'front' ? s.band0 + da / 2 + 0.1 : across;
    const n = Math.round(search / step);
    for (let k = 0; k <= 2 * n; k++) {
      const a = along + (k % 2 ? 1 : -1) * Math.ceil(k / 2) * step;
      if (!inSpans(s, a - wa / 2, a + wa / 2)) continue;
      const rect = rectOf(s, a - wa / 2, a + wa / 2, c - da / 2, c + da / 2);
      if (!this.free(rect, { pad, junction })) continue;
      this.take(rect, kind);
      const [x, z] = at(s, a, c);
      return { x, z, yaw: s.facing, along: a, across: c, rect };
    }
    return null;
  }

  /** A signpost at (x, z) or a little beside it; false if nowhere fits. */
  post(x, z, yaw, faces, opts = {}) {
    const nudges = [[0, 0], [0.4, 0], [-0.4, 0], [0, 0.4], [0, -0.4], [0.8, 0], [-0.8, 0], [0, 0.8], [0, -0.8]];
    for (const [dx, dz] of nudges) {
      const px = x + dx, pz = z + dz;
      const rect = [px - 0.12, pz - 0.12, px + 0.12, pz + 0.12];
      if (!this.free(rect, { pad: 0.15, junction: false })) continue;
      this.take(rect, 'sign');
      addSignPost(this.ctx, px, pz, yaw, faces, { y: KERB_H, ...opts });
      return true;
    }
    return false;
  }
}

/** A flat mark on the ground. */
function mark(ctx, geo, x, z, yaw, mat = ATLAS.decal, y = KERB_H + 0.006) {
  addQuad(ctx.batch, geo, x, y, z, yaw, { mat, pitch: GROUND_PITCH });
}

/** A beer or lemonade bottle, standing or knocked over. */
function bottle(ctx, x, z, yaw, lying, color) {
  const b = ctx.batch;
  if (!lying) {
    b.cyl(0.032, 0.17, color, x, KERB_H, z, { seg: 7 });
    b.cyl(0.032, 0.05, color, x, KERB_H + 0.17, z, { seg: 7, rTop: 0.014 });
    b.cyl(0.013, 0.07, color, x, KERB_H + 0.22, z, { seg: 5 });
    return;
  }
  b.cyl(0.032, 0.17, color, x, KERB_H + 0.032, z, { seg: 7, ry: yaw, rz: Math.PI / 2 });
  const dx = -Math.cos(yaw) * 0.17, dz = Math.sin(yaw) * 0.17;
  b.cyl(0.013, 0.1, color, x + dx, KERB_H + 0.032, z + dz, { seg: 5, ry: yaw, rz: Math.PI / 2 });
}

/* ------------------------------------------------------------------ *
 * Builders
 * ------------------------------------------------------------------ */

function buildShelters(ctx, P, rng) {
  for (const stop of STOPS) {
    const p = stopPlacement(stop);
    const s = P.strip(p.road.id, p.side);
    const kind = p.road.major ? 'pavilion' : 'concrete';
    // stopPlacement's spot, pushed back so the shelter's back stands near
    // the back of the pavement and the walk passes in front of it
    const planned = Math.abs((p.road.axis === 'x' ? p.shelter.z : p.shelter.x) - p.road.c);
    const across = Math.max(planned, s.band1 - SHELTER_SIZE[kind].depth / 2 - 0.3);
    const [x, z] = at(s, stop.at, across);
    // the stop sign stands at the kerb, where the bus pulls in
    const signZ = -(across - (s.hw + KERB_W + 0.6));
    const sh = addShelter(ctx, stop, x, z, p.facing, kind, { signZ });
    const lx = p.road.axis === 'x' ? s.sgn : -s.sgn;   // along-direction of the shelter's local +x
    // keep the shelter and its waiting room clear, more at the sign end
    const ends = [stop.at - sh.length / 2 - (lx > 0 ? 0.8 : 1.5), stop.at + sh.length / 2 + (lx > 0 ? 1.5 : 0.8)];
    P.take(rectOf(s, ends[0], ends[1], s.hw, across + sh.depth / 2 + 0.35), 'shelter');
    const front = across - sh.depth / 2;
    // a bin at the tail end, the litter every stop collects
    const binAlong = stop.at - lx * (sh.length / 2 + 0.55);
    const [bx, bz] = at(s, binAlong, front + 0.35);
    if (P.free([bx - 0.3, bz - 0.3, bx + 0.3, bz + 0.3], { pad: 0.05, taken: false })) {
      addBin(ctx.batch, bx, bz, s.facing, KERB_H);
      ctx.colliders.circle(bx, bz, 0.28, { top: KERB_H + 0.75, tag: 'bin' });
      const [ux, uz] = at(s, binAlong, front - 0.2);
      mark(ctx, litterGeo('butts', rng.int(0, 2)), ux, uz, rng.range(0, 6.3));
    }
    const [hx, hz] = at(s, stop.at + lx * 0.4, across + sh.depth / 2 - 0.55);
    mark(ctx, litterGeo('husks', rng.int(0, 2)), hx, hz, rng.range(0, 6.3));
    const [lx0, lz0] = at(s, stop.at - lx * 1.2, front - 0.6);
    mark(ctx, litterGeo('litter', rng.int(0, 2)), lx0, lz0, rng.range(0, 6.3));
    // fluff blown into the back corners
    for (const e of [-1, 1]) {
      const [fx, fz] = at(s, stop.at + e * (sh.length / 2 - 0.35), across + sh.depth / 2 - 0.3);
      mark(ctx, fluffGeo('heap', rng.int(0, 2), 0.8, 0.8), fx, fz, rng.range(0, 6.3), ATLAS.soft, KERB_H + 0.01);
    }
  }
}

const FOOT = {
  larek: (o) => [(o.w ?? 2.6) + 0.3, (o.d ?? 1.9) + 0.6],
  pavilion: (o) => [(o.w ?? 6.2) + 0.6, (o.d ?? 2.8) + 0.6],
  booth: () => [2.3, 2.3],
  icecream: () => [2.8, 2.4],
  kvass: () => [4.2, 2.8],
  flowers: () => [2.8, 2.4],
  payphone: () => [1.0, 1.0],
  postbox: () => [0.6, 0.6],
};
const BUILD = {
  larek: addLarek, pavilion: addPavilion, booth: addBooth, icecream: addIceCream,
  kvass: addKvass, flowers: addFlowers, payphone: addPayphone, postbox: addPostbox,
};
const BOTTLES = [0x5a3a1a, 0x3c6a3a, 0x6a4a22, 0x2e5a36];

function buildKiosks(ctx, P, rng) {
  const placed = [];
  for (const k of KIOSKS) {
    const s = P.strip(k.road, k.side);
    const o = { ...(k.o || {}) };
    const [wa, da] = FOOT[k.kind](o);
    const spot = P.slot(s, k.at, wa, da, { kind: k.kind, search: 3 });
    if (!spot) continue;
    if (o.poster) o.poster = brandPoster(o.poster);
    BUILD[k.kind](ctx, spot.x, spot.z, spot.yaw, o);
    placed.push({ k, s, spot, wa, da });
  }
  for (const { k, s, spot, wa, da } of placed) {
    if (k.kind === 'payphone' || k.kind === 'postbox') continue;
    const front = spot.across - da / 2;
    // what gathers at a kiosk window: husks, wrappers, a bottle or two
    const [mx, mz] = at(s, spot.along + rng.range(-0.5, 0.5), front - 0.45);
    mark(ctx, litterGeo(rng.chance(0.5) ? 'litter' : 'husks', rng.int(0, 2)), mx, mz, rng.range(0, 6.3));
    const nb = rng.int(0, 2);
    for (let i = 0; i < nb; i++) {
      const [bx, bz] = at(s, spot.along + (rng.sign() * wa) / 2 + rng.range(-0.15, 0.15), front + rng.range(0.1, 0.5));
      bottle(ctx, bx, bz, rng.range(0, 6.3), rng.chance(0.5), rng.pick(BOTTLES));
    }
    const [fx, fz] = at(s, spot.along + (rng.sign() * (wa / 2 + 0.1)), spot.across + da / 2 - 0.35);
    mark(ctx, fluffGeo('heap', rng.int(0, 2), 0.9, 0.9), fx, fz, rng.range(0, 6.3), ATLAS.soft, KERB_H + 0.01);
    if (k.sparrows) {
      const [sx, sz] = at(s, spot.along, front - 0.9);
      addSparrows(ctx, sx, sz, 6, { r: 1.1, seed: Math.round(spot.along) });
    }
    if (k.bike) {
      const bs = P.slot(s, spot.along + wa / 2 + 0.45, 0.8, 1.8, { across: spot.across, search: 0.5, kind: 'bicycle', pad: 0.05 });
      if (bs) {
        const [dx, dz] = backAlong(s);
        addBicycle(ctx, bs.x, bs.z, Math.atan2(dx, dz), rng.pick([0x2f6a9a, 0x9a2f2f, 0x2f7a4a]));
      }
    }
  }
}

function buildBoards(ctx, P) {
  const ave = roadById.ave;
  const lamps = ctx.streets.lampSpots.filter((l) => l.double && l.road === 'ave').sort((a, b) => a.x - b.x);
  const supports = (ctx.spots.trolleyPoles || []).map((p) => p.x);
  const masts = [];
  for (const [x0, front, back] of MASTS) {
    let x = null;
    for (let k = 0; k < 30 && x === null; k++) {
      const c = x0 + (k % 2 ? 1 : -1) * Math.ceil(k / 2);
      if (lamps.some((l) => Math.abs(l.x - c) < 8)) continue;
      if (supports.some((a) => Math.abs(a - c) < 5)) continue;
      if (JUNCTIONS.some((j) => j.rx === ave && Math.abs(j.x - c) < 25)) continue;
      x = c;
    }
    if (x === null) continue;
    addMastBoard(ctx, x, ave.c, -Math.PI / 2, front, back, { y: KERB_H });
    P.take([x - 0.5, ave.c - 0.5, x + 0.5, ave.c + 0.5], 'billboard');
    masts.push(x);
  }
  // flag banners on every other median lamp
  lamps.forEach((l, i) => {
    if (i % 2 || masts.some((m) => Math.abs(m - l.x) < 12)) return;
    addLampBanners(ctx, l.x, l.z, -Math.PI / 2, i % 4 === 0 ? 'a' : 'b', { y: KERB_H });
  });
  for (const b of POST_BOARDS) {
    const s = P.strip(b.road, b.side);
    const c = s.band1 - 1.35;
    const spot = P.slot(s, b.at, 6.6, 1.6, { across: c + 0.5, search: 8, kind: 'billboard' });
    if (!spot) continue;
    const [x, z] = at(s, spot.along, c);
    addPostBoard(ctx, x, z, s.facing, b.key, { y: KERB_H });
  }
}

/** The right-hand pavement of traffic approaching junction j on `arm`, `dist` m out. */
function approach(j, arm, dist) {
  const r = arm === 'E' || arm === 'W' ? j.rx : j.rz;
  const C = r === j.rx ? j.rz : j.rx;
  const out = arm === 'E' || arm === 'S' ? 1 : -1;
  const along = (r.axis === 'x' ? j.x : j.z) + out * (halfWidth(C) + C.walk[out > 0 ? 1 : 0] + dist);
  const travel = -out;
  const sgn = r.axis === 'x' ? travel : -travel;
  const across = r.c + sgn * (halfWidth(r) + KERB_W + 0.55);
  const yaw = r.axis === 'x' ? (travel > 0 ? Math.PI / 2 : -Math.PI / 2) : (travel > 0 ? 0 : Math.PI);
  return r.axis === 'x' ? { x: along, z: across, yaw } : { x: across, z: along, yaw };
}

function buildSigns(ctx, P) {
  const back = signBackGeo(0.7);
  const backRound = signBackGeo(0.7, true);
  const face = (type) => [{ geo: roadSignGeo(type), backGeo: type === 'speed60' || type === 'noentry' || type === 'nostop' ? backRound : back }];
  const sign = (a, b, arms, dist, type) => {
    const j = JUNCTIONS.find((jj) => jj.id === `${a}/${b}`);
    if (!j) return;
    for (const arm of arms) {
      if (!j.arms[arm]) continue;
      const p = approach(j, arm, dist);
      P.post(p.x, p.z, p.yaw, face(type));
    }
  };

  for (const j of JUNCTIONS) {
    // pedestrian crossing signs at every zebra, on the approaching driver's right
    if (j.rx.major || j.signal) {
      const spots = {
        E: [j.x + j.hx + 3.6, j.z - j.hz - 0.8, -Math.PI / 2],
        W: [j.x - j.hx - 3.6, j.z + j.hz + 0.8, Math.PI / 2],
        N: [j.x - j.hx - 0.8, j.z - j.hz - 3.6, 0],
        S: [j.x + j.hx + 0.8, j.z + j.hz + 3.6, Math.PI],
      };
      for (const arm of Object.keys(spots)) {
        if (j.arms[arm]) P.post(spots[arm][0], spots[arm][1], spots[arm][2], face('crossing'));
      }
    }
    // street name plates on a post at the back of every corner
    for (const [ns, ew, sx, sz] of QUADRANTS) {
      if (!j.arms[ns] || !j.arms[ew]) continue;
      const Wx = j.rz.walk[sx > 0 ? 1 : 0], Wz = j.rx.walk[sz > 0 ? 1 : 0];
      plates(ctx, P, j, j.x + sx * (j.hx + Wx - 0.45), j.z + sz * (j.hz + Wz - 0.45), sx, sz);
    }
  }

  // priority and give way where there are no lights
  sign('ave', 'west', ['E', 'W'], 16, 'priority');
  sign('ave', 'west', ['N', 'S'], 1.5, 'giveway');
  sign('vokzal', 'mid', ['S'], 1.5, 'giveway');
  sign('vokzal', 'east', ['E', 'W'], 1.5, 'giveway');
  sign('vokzal', 'east', ['S'], 16, 'priority');
  sign('south', 'west', ['N'], 1.5, 'giveway');
  sign('south', 'east', ['N'], 1.5, 'giveway');
  sign('south', 'mid', ['N', 'S'], 1.5, 'giveway');
  sign('south', 'mid', ['E', 'W'], 16, 'priority');

  // the town limit, and no stopping by the bazaar gate and the akimat
  const ave = roadById.ave;
  const edge = halfWidth(ave) + KERB_W + 0.55;
  P.post(BOUNDS.x0 + 14, ave.c + edge, Math.PI / 2, face('speed60'));
  P.post(BOUNDS.x1 - 14, ave.c - edge, -Math.PI / 2, face('speed60'));
  P.post(69, ave.c - edge, -Math.PI / 2, face('nostop'));
  P.post(-82, ave.c + edge, Math.PI / 2, face('nostop'));
}

const PLATE_W = 1.25, PLATE_H = 0.42;

/** Two blue plates on one post: the x street's facing it, the z street's below. */
function plates(ctx, P, j, x, z, sx, sz) {
  const rect = [x - 0.15, z - 0.15, x + 0.15, z + 0.15];
  if (!P.free(rect, { pad: 0.1, junction: false })) return;
  P.take(rect, 'plate');
  const b = ctx.batch;
  b.cyl(0.04, 2.85, 0x8e9294, x, KERB_H, z, { seg: 6 });
  b.cyl(0.042, 0.4, PAL.whitewash, x, KERB_H + 0.1, z, { seg: 6 });
  const one = (road, yaw, cy) => {
    const fx = -Math.sin(yaw), fz = -Math.cos(yaw);
    b.box(PLATE_W, PLATE_H, 0.02, 0x7a7e80, x + fx * 0.045, cy - PLATE_H / 2, z + fz * 0.045, { ry: yaw });
    addQuad(b, streetPlateGeo(road, PLATE_W, PLATE_H), x + fx * 0.07, cy, z + fz * 0.07, yaw);
  };
  one(j.rx, sz > 0 ? 0 : Math.PI, KERB_H + 2.55);
  one(j.rz, sx > 0 ? Math.PI / 2 : -Math.PI / 2, KERB_H + 2.05);
  ctx.colliders.circle(x, z, 0.1, { tag: 'signpost' });
}

const RAIL_COLOR = 0xc9ccc6;
const PANEL = 2.0;

/** Grey steel pedestrian rails along the kerbs at the signalled crossings. */
function buildRails(ctx, P) {
  const b = ctx.batch;
  const run = (x0, z0, dx, dz, n) => {
    for (let i = 0; i < n; i++) {
      const ax = x0 + dx * PANEL * i, az = z0 + dz * PANEL * i;
      const bx = ax + dx * PANEL, bz = az + dz * PANEL;
      const rect = [Math.min(ax, bx) - 0.05, Math.min(az, bz) - 0.05, Math.max(ax, bx) + 0.05, Math.max(az, bz) + 0.05];
      if (!P.free(rect, { pad: 0.1, junction: false })) continue;
      P.take(rect, 'rail');
      for (const [px, pz] of [[ax, az], [bx, bz]]) b.cyl(0.03, 1.0, RAIL_COLOR, px, KERB_H, pz, { seg: 5 });
      for (const h of [0.3, 0.95]) b.tube(ax, KERB_H + h, az, bx, KERB_H + h, bz, 0.022, RAIL_COLOR, { seg: 4 });
      for (let k = 1; k < 7; k++) {
        const t = k / 7;
        const px = ax + (bx - ax) * t, pz = az + (bz - az) * t;
        b.tube(px, KERB_H + 0.3, pz, px, KERB_H + 0.95, pz, 0.01, RAIL_COLOR, { seg: 3, cast: false });
      }
      ctx.colliders.box(rect[0], rect[1], rect[2], rect[3], { top: KERB_H + 1.0, tag: 'rail' });
    }
  };
  for (const j of JUNCTIONS) {
    if (!j.signal) continue;
    for (const [ns, ew, sx, sz] of QUADRANTS) {
      if (!j.arms[ns] || !j.arms[ew]) continue;
      // along the side street, past its zebra, and along the avenue past the other
      run(j.x + sx * (j.hx + 0.45), j.z + sz * (j.hz + 4.6), 0, sz, 6);
      run(j.x + sx * (j.hx + 4.6), j.z + sz * (j.hz + 0.45), sx, 0, 5);
    }
  }
}

/** Benches under the avenue trees and bins along every street. */
function buildFurniture(ctx, P, rng) {
  for (const s of P.strips.values()) {
    const major = s.r.major;
    for (const [a0, a1] of s.spans) {
      for (let a = a0 + rng.range(4, 12); a < a1 - 3; a += major ? rng.range(22, 30) : rng.range(40, 55)) {
        if (major && rng.chance(0.8)) {
          const spot = P.slot(s, a, 2.1, 0.75, { across: 'front', search: 3, kind: 'bench' });
          if (!spot) continue;
          const yaw = s.facing + Math.PI;   // back to the trees, facing the walk
          addBench(ctx.batch, spot.x, spot.z, yaw, { y: KERB_H, color: rng.pick([PAL.greenPaint, PAL.wood, 0x3f6d9a]) });
          ctx.colliders.obb(spot.x, spot.z, 0.98, 0.3, yaw, { top: KERB_H + 0.85, tag: 'bench' });
          const [hx, hz] = at(s, spot.along + rng.range(-0.4, 0.4), spot.across + 0.75);
          mark(ctx, litterGeo('husks', rng.int(0, 2)), hx, hz, rng.range(0, 6.3));
          if (rng.chance(0.6)) bin(ctx, P, s, spot.along + 1.5, rng);
        } else {
          bin(ctx, P, s, a, rng, 'back');
        }
      }
    }
  }
}

function bin(ctx, P, s, along, rng, across = 'front') {
  const spot = P.slot(s, along, 0.6, 0.6, { across, search: 1, kind: 'bin', pad: 0.1 });
  if (!spot) return;
  addBin(ctx.batch, spot.x, spot.z, s.facing + (across === 'back' ? 0 : Math.PI), KERB_H);
  ctx.colliders.circle(spot.x, spot.z, 0.28, { top: KERB_H + 0.75, tag: 'bin' });
  const [ux, uz] = at(s, spot.along, spot.across + (across === 'back' ? -0.5 : 0.5));
  mark(ctx, litterGeo('butts', rng.int(0, 2)), ux, uz, rng.range(0, 6.3));
}

/** Cracks, patches, dried puddles and the odd bit of litter on every pavement. */
function buildMarks(ctx, P, rng) {
  for (const s of P.strips.values()) {
    const c0 = s.band0 + 0.6, c1 = s.band1 - 0.6;
    if (c1 <= c0) continue;
    for (const [a0, a1] of s.spans) {
      for (let a = a0 + rng.range(2, 8); a < a1 - 1; a += rng.range(6, 12)) {
        const roll = rng.next();
        if (roll < 0.22) {
          const [x, z] = at(s, a, rng.range(c0, c1));
          mark(ctx, crackGeo(rng.int(0, 5)), x, z, s.facing + rng.range(-0.4, 0.4) + (rng.chance(0.5) ? Math.PI / 2 : 0));
        } else if (roll < 0.32) {
          const [x, z] = at(s, a, Math.min(c1, s.band0 + 0.8));
          mark(ctx, stainGeo(rng.int(0, 3)), x, z, s.facing + rng.range(-0.3, 0.3), ATLAS.soft, KERB_H + 0.005);
        } else if (roll < 0.38) {
          const [x, z] = at(s, a, rng.range(c0, c1));
          mark(ctx, litterGeo('litter', rng.int(0, 2)), x, z, rng.range(0, 6.3));
        }
      }
    }
  }
}

/** Poplar fluff gathered in the gutters, along the walls and the tree-strip edging. */
function buildDrifts(ctx, P, rng) {
  const len = 2.4, w = 0.34;
  for (const s of P.strips.values()) {
    const trees = s.r.trees[s.side] > 0;
    for (const [a0, a1] of s.spans) {
      for (let a = a0 + len / 2; a < a1 - len / 2; a += len) {
        if (rng.chance(0.32)) {
          const [x, z] = at(s, a + rng.range(-0.3, 0.3), s.hw - w / 2);
          mark(ctx, fluffGeo('strip', rng.int(0, 3), len, w), x, z, s.facing, ATLAS.soft, 0.012);
        }
        if (rng.chance(0.12)) {
          const [x, z] = at(s, a, s.band1 - w / 2);
          mark(ctx, fluffGeo('strip', rng.int(0, 3), len, w), x, z, s.facing, ATLAS.soft, KERB_H + 0.008);
        }
        if (trees && rng.chance(0.12)) {
          const [x, z] = at(s, a, s.band0 + 0.13);
          mark(ctx, fluffGeo('strip', rng.int(0, 3), len, w), x, z, s.facing + Math.PI, ATLAS.soft, KERB_H + 0.008);
        }
      }
    }
  }
}

function buildAnimals(ctx, P) {
  FLOCKS.forEach((f, i) => addPigeonFlock(ctx, f.x, f.z, f.n, { rx: f.rx, rz: f.rz, seed: 31 + i * 7 }));
  for (const d of DOGS) {
    const s = P.strip(d.road, d.side);
    const spot = P.slot(s, d.at, 1.3, 0.8, { across: d.across, search: 6, kind: 'dog' });
    if (spot) addDog(ctx, spot.x, spot.z, s.facing + Math.PI / 2 + 0.25 * (d.coat - 1), d.coat, KERB_H + 0.004);
  }
}

export const streetlife = {
  name: 'streetlife',
  build(ctx) {
    const P = new Placer(ctx);
    const rng = rngKit(2007);
    buildShelters(ctx, P, rng);
    buildKiosks(ctx, P, rng);
    buildBoards(ctx, P);
    buildSigns(ctx, P);
    buildRails(ctx, P);
    buildAnimals(ctx, P);
    buildFurniture(ctx, P, rng);
    buildMarks(ctx, P, rng);
    buildDrifts(ctx, P, rng);
    ctx.spots.streetlife = P.taken;
  },
};
