import { SURF, TILE, hQuad, splitRect } from '../../core/surfaces.js';
import { addTree } from '../props/trees.js';
import { addFlowerBed, ringSpots } from '../props/plants.js';
import { addBench, addLamp } from '../props/street.js';
import { Sculpt, STONE, coatedFigure, plaqueTex, panel, plaque } from './kit.js';
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
  addFlowerBed(b, ringSpots(x, z, 2.4, 4.6, 1983, 0.16), 1983,
    { y: 0.28, colors: [0xc42f2a, 0xc42f2a, 0xc42f2a, 0xc42f2a, 0xe8e2d6], height: 0.26, heads: 4 });
  colliders.circle(x, z, 5.2, { top: 0.3, tag: 'bed' });

  // the pedestal: a stepped grey granite block with the name
  b.box(3.6, 0.5, 3.6, STONE.greyDark, x, 0.3, z);
  b.box(2.4, 3.6, 2.4, STONE.greyGranite, x, 0.8, z);
  b.box(2.8, 0.3, 2.8, STONE.greyDark, x, 4.4, z);
  colliders.box(x - 1.8, z - 1.8, x + 1.8, z + 1.8, { tag: 'statue' });
  panel(root, plaqueTex('lenin', ['ЛЕНИН'], { bg: '#8e8c88', fg: '#c9a44a', h: 128, w: 512 }), 1.8, 0.45, x, 3.4, z - 1.215, 0);

  // the figure, about 2.3 times life size
  const s = new Sculpt(b, x, 4.7, z, 0, 2.3);
  coatedFigure(s, GREY, GREY_DARK, { coat: 1.3, stride: 0.2, girth: 1.02 });
  // the open coat's collar turned back over the shoulders
  s.box(0.42, 0.08, 0.2, [0, 1.49, 0.02], GREY_DARK, [-0.3, 0, 0]);
  // bald crown, beard and moustache
  s.ball([0, 1.74, -0.01], [0.1, 0.1, 0.11], GREY_DARK, 10);
  s.cone(0.07, 0.12, [0, 1.6, -0.1], GREY_DARK, 7, [-2.7, 0, 0]);
  // right arm out and up toward the street, open hand
  s.limb([0.24, 1.42, 0], [0.42, 1.52, -0.26], 0.06, 0.052, GREY);
  s.ball([0.42, 1.52, -0.26], 0.052, GREY);
  s.limb([0.42, 1.52, -0.26], [0.56, 1.66, -0.55], 0.05, 0.043, GREY);
  s.ball([0.58, 1.68, -0.6], [0.045, 0.02, 0.07], GREY, 8, [0.3, 0, 0]);
  // left hand gripping the lapel
  s.limb([-0.24, 1.42, 0], [-0.3, 1.14, -0.08], 0.06, 0.052, GREY);
  s.limb([-0.3, 1.14, -0.08], [-0.1, 1.3, -0.17], 0.05, 0.045, GREY);
  s.ball([-0.08, 1.31, -0.18], 0.045, GREY);

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
