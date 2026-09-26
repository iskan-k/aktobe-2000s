import * as THREE from 'three';
import { SURF, TILE, hQuad, splitRect } from '../../core/surfaces.js';
import { rngKit } from '../../core/util.js';
import { addTree } from '../props/trees.js';
import { addBench, addLamp } from '../props/street.js';
import { Sculpt, STONE, panel, plaque, graniteBlock, castLettersTex } from './kit.js';
import { HAIRLINE } from './figure.js';
import { MAIN } from './heating.js';

/* ------------------------------------------------------------------ *
 * A small square with the Lenin statue (1983), which stood in Aktobe
 * until 2018, so in 2007 it is still there. On the real town plan it is
 * on пр. Победы; here it is a pocket square beside the Memorial of Glory,
 * which is flavour.
 *
 * Grey granite pedestal, a bronze-coloured figure in an open coat, the
 * right arm out toward the street, the left hand at the lapel. Blue
 * spruces round it in a ring, a bed of red salvias, benches.
 * ------------------------------------------------------------------ */

const LENIN = { x: -208, z: 137 };
const Y = -0.015;
const GREY = 0x9a948a;          // the statue is painted, as many were, in grey-silver
const GREY_DARK = 0x6f6a62;

export function buildLenin(ctx, z0) {
  const { batch: b, colliders, root } = ctx;
  const { x, z } = LENIN;
  for (const [a, c, d, e] of splitRect(-228, z0, -196, MAIN.z[0] - 1.1, 40)) b.add(hQuad(a, c, d, e, Y, TILE.slabs), { mat: SURF.slabs, color: null, cast: false });

  // round bed of red salvias the pedestal stands in
  b.cyl(5.2, 0.28, STONE.greyGranite, x, Y, z, { seg: 28 });
  b.cyl(4.9, 0.3, 0x4f3a2a, x, Y, z, { seg: 28 });
  const rng = rngKit(1983);
  for (let i = 0; i < 90; i++) {
    const a = rng.range(0, Math.PI * 2), r = rng.range(2.4, 4.7);
    b.box(0.2, 0.16, 0.2, rng.chance(0.82) ? 0xc42f2a : 0xe8e2d6, x + Math.cos(a) * r, 0.3, z + Math.sin(a) * r, { cast: false });
  }
  colliders.circle(x, z, 5.2, { top: 0.3, tag: 'bed' });

  // the pedestal: a stepped grey granite block with the name
  graniteBlock(b, 3.6, 0.5, 3.6, STONE.greyDark, x, 0.3, z, { c: 0.05 });
  graniteBlock(b, 2.4, 3.6, 2.4, STONE.greyGranite, x, 0.8, z, { c: 0.03, top: [2.3, 2.3] });
  graniteBlock(b, 2.56, 0.12, 2.56, STONE.greyDark, x, 4.4, z, { c: 0.03 });
  graniteBlock(b, 2.8, 0.2, 2.8, STONE.greyDark, x, 4.52, z, { c: 0.06 });
  colliders.box(x - 1.8, z - 1.8, x + 1.8, z + 1.8, { tag: 'statue' });
  panel(root, castLettersTex('lenin', [['ЛЕНИН', 1]], { w: 512, h: 128 }), 1.8, 0.45, x, 3.4, z - 1.19, 0, { alphaTest: 0.5, grime: 0 });

  // the figure, about 2.3 times life size
  leninFigure(new Sculpt(b, x, 4.72, z, 0, 2.3, { statue: true }));

  plaque(ctx, {
    x, z: z - 5.8, y: 1.2, w: 2.4, label: 'Read the pedestal',
    title: 'Памятник В. И. Ленину',
    body: 'Открыт в 1983 году. В. И. Ленин (1870–1924). Стоит здесь и в 2007-м, хотя проспект Ленина переименован в проспект Абулхаир хана ещё в 1997-м.',
  });

  // a ring of blue spruces and benches facing the statue
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
    if (Math.sin(a) < -0.6) continue;               // keep the street side open
    const tx = x + Math.cos(a) * 9.5, tz = z + Math.sin(a) * 9.5;
    addTree(b, 'spruce', tx, tz, 1983 + i, { scale: 0.8 });
    colliders.circle(tx, tz, 0.5, { top: 3 });
  }
  for (const s2 of [-1, 1]) {
    addBench(b, x + s2 * 7, z - 5, s2 > 0 ? -Math.PI * 0.75 : Math.PI * 0.75, { style: 'park', color: 0x5f7fa6 });
    colliders.circle(x + s2 * 7, z - 5, 0.8, { top: 0.5 });
  }
  addLamp(b, -198, z0 + 2, 0, { height: 6 });
  colliders.circle(-198, z0 + 2, 0.2, { top: 6 });
}

/**
 * Lenin in the pose of the 1983 statue, life size in the Sculpt's local
 * space: an open overcoat blown back, jacket, waistcoat and tie, the
 * left foot forward, the right arm out and up toward the street with the
 * hand open, the left hand gripping the lapel. The high bald crown, the
 * fringe of hair, the moustache and the pointed beard.
 */
function leninFigure(s) {
  const C = GREY, D = GREY_DARK, J = 0x817b72;
  s.geo(slab(), D);
  const legs = [
    { hip: [0.09, 0.88, 0.02], knee: [0.1, 0.48, 0.03], ankle: [0.11, 0.085, 0.06], yaw: -0.25 },
    { hip: [-0.09, 0.88, -0.02], knee: [-0.11, 0.49, -0.12], ankle: [-0.12, 0.085, -0.16], yaw: 0.15 },
  ];
  for (const l of legs) {
    s.sweep([l.hip, l.knee, l.ankle], [0.085, 0.064, 0.056], J, { seg: 12 });
    const fx = -Math.sin(l.yaw), fz = -Math.cos(l.yaw);
    s.ball([l.ankle[0] + fx * 0.06, 0.045, l.ankle[2] + fz * 0.06], [0.048, 0.045, 0.13], D, 12, [0, l.yaw, 0]);
    s.box(0.09, 0.022, 0.27, [l.ankle[0] + fx * 0.055, 0.011, l.ankle[2] + fz * 0.055], D, [0, l.yaw, 0]);
  }
  // jacket and waistcoat under the coat, the tie
  s.loft([
    { y: 0.8, rx: 0.17, rf: 0.115, rb: 0.12 },
    { y: 1.0, rx: 0.165, rf: 0.125, rb: 0.115 },
    { y: 1.2, rx: 0.175, rf: 0.13, rb: 0.115 },
    { y: 1.38, rx: 0.19, rf: 0.115, rb: 0.105 },
    { y: 1.46, rx: 0.1, rf: 0.07, rb: 0.075 },
  ], J, { seg: 32, capBottom: true });
  s.box(0.035, 0.2, 0.012, [0, 1.3, -0.127], D, [-0.1, 0, 0]);
  s.ball([0, 1.415, -0.108], [0.022, 0.02, 0.014], D, 8);   // the knot of the tie
  for (const sd of [-1, 1]) {
    s.box(0.05, 0.26, 0.012, [sd * 0.06, 1.27, -0.128], D, [-0.12, 0, sd * 0.28]);   // jacket lapels
    s.ball([sd * 0.2, 1.405, 0], 0.066, C);
  }
  // the overcoat, open, the skirts swinging back from the stride
  s.loft([
    { y: 0.4, x: 0.0, z: 0.1, rx: 0.3, rf: 0.2, rb: 0.3, fold: 0.06, folds: 8, phase: 0.2, openR: 0.95, openL: 0.8 },
    { y: 0.64, z: 0.06, rx: 0.27, rf: 0.17, rb: 0.24, fold: 0.045, folds: 8, phase: 0.2, openR: 0.82, openL: 0.7 },
    { y: 0.9, z: 0.02, rx: 0.222, rf: 0.145, rb: 0.175, fold: 0.02, folds: 6, phase: 0.2, openR: 0.68, openL: 0.55 },
    { y: 1.1, rx: 0.2, rf: 0.14, rb: 0.14, openR: 0.6, openL: 0.5 },
    { y: 1.3, rx: 0.205, rf: 0.145, rb: 0.13, openR: 0.55, openL: 0.45 },
    { y: 1.42, rx: 0.215, rf: 0.125, rb: 0.12, openR: 0.6, openL: 0.5 },
    { y: 1.48, rx: 0.125, rf: 0.095, rb: 0.105, openR: 0.62, openL: 0.6 },
    { y: 1.535, rx: 0.085, rf: 0.08, rb: 0.09, openR: 0.5, openL: 0.5 },
  ], C, { seg: 40 });
  for (const sd of [-1, 1]) s.box(0.07, 0.3, 0.014, [sd * 0.13, 1.3, -0.145], C, [-0.1, sd * 0.3, sd * 0.25]);   // coat lapels

  // head: looking up and out over the street
  s.sweep([[0, 1.45, 0.005], [0, 1.5, -0.004], [0, 1.545, -0.012]], [0.052, 0.05, 0.048], C, { seg: 12 });
  s.head([0, 1.645, -0.02], [0.14, -0.04, 0], C, {
    beard: 'goatee', moustache: true, brow: 0.085, hair: HAIRLINE.fringe, hairOpts: { thick: 0.035, comb: 'down', groove: 0.015 },
  });

  // right arm out and up, open hand; left hand at the lapel
  const rWrist = [0.5, 1.62, -0.47];
  s.sweep([[0.2, 1.42, 0], [0.29, 1.44, -0.1], [0.37, 1.48, -0.23], [0.44, 1.55, -0.36], rWrist],
    [0.062, 0.058, 0.052, 0.048, 0.04], C, { seg: 12 });
  s.hand(rWrist, [0.4, 0.28, -0.87], [0.1, -1, -0.2], C, { kind: 'open', side: 1 });
  const lWrist = [-0.1, 1.28, -0.155];
  s.sweep([[-0.2, 1.42, 0], [-0.25, 1.28, 0.0], [-0.27, 1.14, -0.05], [-0.2, 1.2, -0.13], lWrist],
    [0.062, 0.058, 0.05, 0.046, 0.038], C, { seg: 12 });
  s.hand(lWrist, [0.3, 0.9, -0.2], [0, 0, 1], C, { kind: 'fist', side: -1 });
}

function slab() {
  const g = new THREE.CylinderGeometry(0.5, 0.52, 0.05, 18);
  g.scale(1, 1, 0.8);
  g.translate(0, 0.015, 0);
  return g;
}
