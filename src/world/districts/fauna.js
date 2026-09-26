import { rngKit } from '../../core/util.js';
import { BOUNDS } from '../plan.js';
import { BENCHES } from '../props/street.js';
import { PERCHES } from '../buildings/panel.js';
import { MAIN } from '../landmarks/heating.js';
import { GATE_X } from './bazaar.js';
import { addDog } from '../props/fauna/dog.js';
import { addCat } from '../props/fauna/cat.js';
import { addHorse, addCart } from '../props/fauna/horse.js';

/* ------------------------------------------------------------------ *
 * The town's animals, scattered where they belong. Runs after every
 * other district, so the benches, entrance canopies, window sills and
 * parked cars they sit on are already in place.
 *
 *   strays    packs at the garages, the waste ground, the bazaar hall
 *             and the station square; one asleep on the dumped slabs;
 *             the garage watchman's alabai on its chain
 *   cats      on courtyard benches, podyezd canopies and ground-floor
 *             sills, on a parked Zhiguli's bonnet or two, waiting at
 *             the meat hall door, and walking the heating main
 *   horses    tethered on the grass behind the garages and on the
 *             waste ground, one in the private sector's empty lot, a
 *             cart horse on the lane, and a herd grazing out on the
 *             steppe beyond the east edge of town
 * The yard dogs are in privateSector.js, the kumys horses in
 * landmarks/roadside.js, the pavement strays in streetlife.js.
 * ------------------------------------------------------------------ */

const PIPE_TOP = MAIN.y + MAIN.r;

/* ------------------------------------------------------------------ dogs */

/** [x, z, yaw, coat, mode, extra] */
const STRAYS = [
  // the west garage lane: two asleep at the doors, one about
  [-38.5, 132.4, 2.6, 'ginger', 'sleep'],
  [-41.2, 132.2, -2.8, 'grey', 'sleep', { curl: true }],
  [-45, 135, 1.2, 'cream', 'roam', { r: 3 }],
  // the waste ground: a pack of four, and one on the slabs
  [96, 150, 0.4, 'shepherd', 'roam', { r: 6 }],
  [92, 152, -1.2, 'blackTan', 'roam', { r: 6 }],
  [101.5, 149.2, 2.0, 'brown', 'sleep'],
  [88, 147, 0.9, 'ginger', 'roam', { r: 5, curl: true }],
  [-2, 134.3, 0.1, 'blackWhite', 'sleep', { y: 0.66 }],
  // by the covered market's door and along its east wall
  [86.5, -83.2, -1.4, 'grey', 'sleep'],
  [88.2, -80.8, -2.2, 'fawn', 'sleep', { curl: true }],
  [78, -79.5, 0.5, 'ginger', 'roam', { r: 3.5 }],
  // the station square: a sleeper by the planters, two about
  [-18, -124.5, 1.9, 'cream', 'sleep'],
  [48, -127, -0.8, 'blackTan', 'roam', { r: 5 }],
  [52, -124, 2.4, 'shepherd', 'roam', { r: 5, curl: true }],
];

function strays(ctx) {
  STRAYS.forEach(([x, z, yaw, coat, mode, extra = {}]) => addDog(ctx, x, z, yaw, { coat, mode, ...extra }));
}

/**
 * The watchman's alabai at the mouth of the east garage cooperative,
 * chained by its kennel: the one guard dog you can see from the road.
 */
function watchDog(ctx) {
  const b = ctx.batch;
  const kx = 191.2, kz = 137.8;
  b.box(1.2, 0.95, 1.4, 0x7a5c40, kx, 0, kz);
  b.box(1.45, 0.05, 1.6, 0x6e6a64, kx, 1.1, kz, { rz: 0.35 });
  b.box(0.46, 0.55, 0.02, 0x1d1a16, kx, 0.05, kz - 0.71);
  b.cyl(0.13, 0.07, 0x8a8a86, kx + 0.6, 0, kz - 1.1, { rTop: 0.15, seg: 10 });
  ctx.colliders.box(kx - 0.65, kz - 0.75, kx + 0.65, kz + 0.75, { top: 1.1, tag: 'kennel' });
  ctx.colliders.circle(kx, kz - 0.72, 0.1, { tag: 'post' });
  addDog(ctx, kx - 0.4, kz - 2.0, Math.PI * 0.1, { build: 'alabai', coat: 'cream', mode: 'chain', chain: { x: kx, z: kz - 0.72, len: 2.6 } });
}

/* ------------------------------------------------------------------ cats */

const COATS = ['ginger', 'greyTabby', 'brownTabby', 'black', 'blackWhite', 'white', 'greyWhite', 'cream'];

function cats(ctx) {
  const rng = rngKit(4711);
  const coat = () => rng.pick(COATS);

  // courtyard benches by the podyezds (the short yard ones), one cat in five
  const yardBenches = BENCHES.filter((b) => b.len < 1.7);
  yardBenches.forEach((b, i) => {
    if (i % 5 !== 2) return;
    const off = rng.range(-0.4, 0.4);
    const x = b.x + Math.cos(b.facing) * off, z = b.z - Math.sin(b.facing) * off;
    const mode = rng.weighted([['curl', 2], ['loaf', 2], ['sit', 1]]);
    addCat(ctx, x, b.y + 0.455, z, b.facing + rng.range(-0.8, 0.8) + (mode === 'curl' ? rng.range(0, 6) : 0), { coat: coat(), mode, collide: false });
  });

  // on the canopies over the podyezd doors, one in six
  PERCHES.canopies.forEach((c, i) => {
    if (i % 6 !== 3) return;
    addCat(ctx, c.x, c.y, c.z, c.yaw + rng.range(-0.5, 0.5), { coat: coat(), mode: rng.chance(0.5) ? 'loaf' : 'sit', collide: false });
  });

  // on ground-floor window sills, looking out
  PERCHES.sills.forEach((sl, i) => {
    if (i % 41 !== 7) return;
    addCat(ctx, sl.x, sl.y, sl.z, sl.yaw + rng.range(-0.3, 0.3), { coat: coat(), mode: 'sit', collide: false });
  });

  // waiting at the meat hall door
  const hallZ = -84.25;
  addCat(ctx, GATE_X - 2.6, 0, hallZ + 1.2, 0.2, { coat: 'ginger', mode: 'sit' });
  addCat(ctx, GATE_X + 2.7, 0, hallZ + 1.0, -0.3, { coat: 'greyWhite', mode: 'sit' });
  addCat(ctx, GATE_X + 4.1, 0, hallZ + 1.5, 1.2, { coat: 'brownTabby', mode: 'loaf' });

  // walking along the top of the heating main behind the garages, and one sat on it
  const z0 = MAIN.z[0];
  addCat(ctx, -60, PIPE_TOP, z0, Math.PI / 2, { coat: 'black', mode: 'walk', path: [[-66, z0], [-50, z0]], pathY: PIPE_TOP, collide: false });
  addCat(ctx, -41, PIPE_TOP, MAIN.z[1], Math.PI, { coat: 'cream', mode: 'loaf', collide: false });

  // on the bonnet of a parked Zhiguli, warm from the sun: two courtyard spots
  const spots = ctx.parking.filter((p) => p.x > -10 && p.x < 100 && p.z > 20 && p.z < 110);
  for (const sp of [spots[3], spots[Math.floor(spots.length / 2) + 1]]) {
    if (!sp) continue;
    sp.kind = 'lada2107';
    sp.chance = 1;
    const ry = sp.ry ?? 0;
    const bx = sp.x - Math.sin(ry) * 1.25, bz = sp.z - Math.cos(ry) * 1.25;
    addCat(ctx, bx, 0.93, bz, ry + Math.PI + rng.range(-0.6, 0.6), { coat: coat(), mode: rng.chance(0.5) ? 'loaf' : 'curl', collide: false });
  }

  // a cat on its rounds along a courtyard kerb
  addCat(ctx, 30, 0, 60, 0, { coat: 'greyTabby', mode: 'walk', path: [[30, 60], [30, 48]], pathY: null });
}

/* ------------------------------------------------------------------ horses */

function horses(ctx) {
  const b = ctx.batch;
  const stake = (x, z) => b.cyl(0.04, 0.35, 0x6a5a44, x, 0, z, { seg: 5 });
  const tethered = (x, z, yaw, coat, extra = {}) => {
    const tx = x + Math.sin(yaw) * 1.6, tz = z + Math.cos(yaw) * 1.6;
    stake(tx, tz);
    return addHorse(ctx, x, z, yaw, { coat, mode: 'graze', tether: { x: tx, z: tz, len: 2.4 }, ...extra });
  };
  // on the grass behind the west garages, south of the heating main
  tethered(-70, 153.5, 1.9, 'dun');
  tethered(-52, 155, -2.6, 'darkBay');
  // on the waste ground, by the path
  tethered(66, 151.5, 0.7, 'grey');
  // in the private sector's empty lot, for sale with the land
  tethered(-60, -73, 2.3, 'chestnut');

  // a cart horse waiting on the private sector's lane, the cart loaded with hay
  addHorse(ctx, -64, -59.5, -Math.PI / 2, { coat: 'bay', mode: 'harness', tack: 'harness' });
  addCart(ctx, -64, -59.5, -Math.PI / 2, { load: 'hay', seed: 11 });

  // a herd out on the steppe beyond the east edge, with a foal
  const rng = rngKit(1207);
  const hx = BOUNDS.x1 + 42, hz = 205;
  const coats = ['bay', 'dun', 'chestnut', 'darkBay', 'grey', 'bay', 'black'];
  coats.forEach((coat, i) => {
    const a = (i / coats.length) * Math.PI * 2 + rng.range(-0.3, 0.3);
    const r = rng.range(3, 11);
    addHorse(ctx, hx + Math.cos(a) * r, hz + Math.sin(a) * r * 1.4, rng.range(0, Math.PI * 2), { coat, mode: 'graze', collide: false });
  });
  addHorse(ctx, hx + 2, hz + 4, 0.8, { coat: 'dun', mode: 'stand', s: 0.62, collide: false });
}

export const fauna = {
  name: 'fauna',
  build(ctx) {
    strays(ctx);
    watchDog(ctx);
    cats(ctx);
    horses(ctx);
  },
};
