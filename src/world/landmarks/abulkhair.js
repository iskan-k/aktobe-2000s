import * as THREE from 'three';
import { HAIRLINE, loft } from './figure.js';

/* ------------------------------------------------------------------ *
 * Abulkhair Khan on his horse (the monument of 2000 by the akimat),
 * authored in the monument's own space: y = 0 the top of the pedestal,
 * the horse walking toward -z, horse and rider about 1.35 times life.
 *
 * The horse has a real barrel, a deep chest and a round rump, an arched
 * neck and a wedge of a head, legs with knees, fetlocks and hooves, the
 * front left lifted in the step. The khan sits upright in a long
 * shapan spread over the horse's back, a fur-trimmed hat rising to a
 * point with a plume, a full beard; his right arm is raised forward, his
 * left hand holds the reins, a sabre hangs at his hip.
 * ------------------------------------------------------------------ */

const B = 0x6e6446, BD = 0x4c4532, BL = 0x8a7e58;

/** A loft authored along +y, laid on its side so +y runs to -z (the front). */
function lying(rings, o) {
  const g = loft(rings, o);
  g.rotateX(-Math.PI / 2);
  return g;
}

function horse(s) {
  // barrel from the buttock (t = -1.45) to the breast (t = 1.24);
  // after laying down, a ring's rf is the belly, rb the back, z the height
  const body = lying([
    { y: -1.46, rx: 0.22, rf: 0.24, rb: 0.2, z: 0.2 },
    { y: -1.34, rx: 0.44, rf: 0.48, rb: 0.44, z: 0.17 },
    { y: -1.05, rx: 0.56, rf: 0.6, rb: 0.52, z: 0.12 },
    { y: -0.55, rx: 0.56, rf: 0.64, rb: 0.5, z: 0.03 },
    { y: 0.1, rx: 0.55, rf: 0.64, rb: 0.47, z: 0.0 },
    { y: 0.6, rx: 0.52, rf: 0.62, rb: 0.5, z: 0.08 },
    { y: 0.95, rx: 0.46, rf: 0.56, rb: 0.5, z: 0.16 },
    { y: 1.15, rx: 0.36, rf: 0.42, rb: 0.42, z: 0.22 },
    { y: 1.26, rx: 0.18, rf: 0.2, rb: 0.24, z: 0.26 },
  ], { seg: 28, capTop: true, capBottom: true });
  body.translate(0, 2.05, 0);
  s.geo(body, B);
  // the arched neck, the head, the jaw, the muzzle
  s.sweep([[0, 2.3, -0.9], [0, 2.8, -1.22], [0, 3.22, -1.46], [0, 3.42, -1.6]], [0.44, 0.36, 0.28, 0.22], B, { seg: 16 });
  s.sweep([[0, 3.46, -1.6], [0, 3.3, -1.86], [0, 3.1, -2.12], [0, 2.98, -2.24]], [0.2, 0.19, 0.16, 0.13], B, { seg: 14 });
  s.ball([0, 3.2, -1.76], [0.16, 0.2, 0.2], B, 12);
  s.ball([0, 2.98, -2.24], [0.15, 0.14, 0.16], B, 12);
  for (const sd of [-1, 1]) {
    s.ball([sd * 0.08, 2.98, -2.37], [0.035, 0.03, 0.02], BD, 6);        // nostrils
    s.ball([sd * 0.17, 3.36, -1.78], [0.04, 0.035, 0.05], BD, 6);        // eyes
    s.cone(0.065, 0.24, [sd * 0.1, 3.68, -1.56], B, 6, [0.25, 0, sd * -0.18]);   // ears
  }
  // bridle: headstall, noseband, the bit rings
  s.sweep([[-0.18, 3.5, -1.55], [0, 3.62, -1.55], [0.18, 3.5, -1.55]], 0.018, BD, { seg: 5 });
  s.sweep([[-0.15, 3.0, -2.1], [0, 3.12, -2.14], [0.15, 3.0, -2.1]], 0.018, BD, { seg: 5 });
  // the mane standing along the crest, the forelock
  s.sweep([[0, 2.72, -0.95], [0, 3.15, -1.24], [0, 3.52, -1.5], [0, 3.66, -1.6]], [0.05, 0.1, 0.1, 0.06], BD, { seg: 8, flat: 0.4 });
  s.sweep([[0, 3.62, -1.64], [0, 3.52, -1.8]], [0.05, 0.03], BD, { seg: 6 });

  // legs: shoulder or stifle, knee or hock, fetlock, hoof; the front left lifted
  const legs = [
    [[-0.3, 1.85, -0.95], [-0.33, 1.32, -1.35], [-0.32, 0.95, -1.18], [-0.31, 0.82, -1.08]],
    [[0.3, 1.85, -0.95], [0.3, 1.0, -1.0], [0.3, 0.3, -1.05], [0.3, 0.12, -1.07]],
    [[-0.33, 1.95, 0.95], [-0.34, 1.05, 1.25], [-0.32, 0.32, 1.08], [-0.32, 0.12, 1.05]],
    [[0.33, 1.95, 0.95], [0.34, 1.05, 1.25], [0.32, 0.32, 1.08], [0.32, 0.12, 1.05]],
  ];
  for (const [top, joint, fet, hoof] of legs) {
    s.sweep([top, joint, fet], [0.22, 0.12, 0.09], B, { seg: 12, caps: [false, true] });
    s.ball(joint, 0.12, B, 10);
    s.ball(fet, 0.1, B, 10);
    s.sweep([fet, hoof], [0.085, 0.09], B, { seg: 10 });
    s.cone(0.13, 0.16, [hoof[0], hoof[1] - 0.04, hoof[2]], BD, 12, [0, 0, 0], 0.095);
  }
  // the tail: thick at the dock, falling in a sweep
  s.sweep([[0, 2.42, 1.45], [0, 2.2, 1.75], [0, 1.7, 1.95], [0, 1.15, 1.9], [0, 0.85, 1.8]], [0.12, 0.15, 0.14, 0.11, 0.05], BD, { seg: 12 });
  // saddle cloth with its fringe line
  s.geo(saddleCloth(), BD);
}

/** A saddle cloth laid over the back: a curved slab hanging down both flanks. */
function saddleCloth() {
  const g = new THREE.CylinderGeometry(0.64, 0.64, 1.15, 20, 1, true, -Math.PI * 0.42, Math.PI * 0.84);
  g.rotateX(Math.PI / 2);
  g.scale(1.02, 1.0, 1);
  g.translate(0, 2.1, 0.05);
  g.computeVertexNormals();
  return g;
}

function rider(s) {
  // legs down the horse's flanks, feet in the stirrups
  for (const sd of [-1, 1]) {
    s.sweep([[sd * 0.26, 2.9, 0.08], [sd * 0.6, 2.42, -0.3], [sd * 0.63, 1.86, -0.16]], [0.17, 0.13, 0.11], B, { seg: 12 });
    s.ball([sd * 0.6, 2.42, -0.3], 0.13, B, 10);
    s.ball([sd * 0.64, 1.76, -0.26], [0.09, 0.085, 0.2], BD, 10);
    s.sweep([[sd * 0.56, 2.6, 0.02], [sd * 0.62, 1.72, -0.24]], 0.015, BD, { seg: 4 });    // stirrup leather
  }
  // the shapan: skirts spread over the horse's back, then the body
  s.loft([
    { y: 2.42, z: 0.22, rx: 0.72, rf: 0.42, rb: 0.78, fold: 0.07, folds: 9, phase: 0.6, openR: 0.55, openL: 0.55 },
    { y: 2.7, z: 0.1, rx: 0.6, rf: 0.38, rb: 0.58, fold: 0.05, folds: 9, phase: 0.6, openR: 0.4, openL: 0.4 },
    { y: 2.98, rx: 0.44, rf: 0.32, rb: 0.38, fold: 0.02, folds: 7, phase: 0.6, openR: 0.15, openL: 0.15 },
  ], B, { seg: 36 });
  s.loft([
    { y: 2.9, rx: 0.42, rf: 0.31, rb: 0.36 },
    { y: 3.15, rx: 0.39, rf: 0.29, rb: 0.3 },
    { y: 3.42, rx: 0.42, rf: 0.31, rb: 0.28 },
    { y: 3.62, rx: 0.48, rf: 0.27, rb: 0.27 },
    { y: 3.74, rx: 0.3, rf: 0.19, rb: 0.21 },
    { y: 3.8, rx: 0.15, rf: 0.14, rb: 0.15 },
  ], B, { seg: 36, capTop: true });
  s.loft([{ y: 2.96, rx: 0.44, rf: 0.33, rb: 0.37 }, { y: 3.05, rx: 0.44, rf: 0.33, rb: 0.37 }], BD, { seg: 32, capTop: true, capBottom: true });   // sash
  s.sweep([[0.17, 3.74, -0.2], [0.1, 3.4, -0.31], [0.12, 3.05, -0.34]], 0.025, BD, { seg: 6, flat: 0.4 });   // the robe's front edge
  for (const sd of [-1, 1]) s.ball([sd * 0.44, 3.6, 0], 0.15, B, 12);
  s.loft([{ y: 3.74, rx: 0.17, rf: 0.16, rb: 0.17, openR: 0.3, openL: 0.3 }, { y: 3.86, rx: 0.14, rf: 0.13, rb: 0.15, openR: 0.4, openL: 0.4 }], BD, { seg: 20 });

  // head, bearded, under the tall hat
  s.sweep([[0, 3.76, 0], [0, 3.86, -0.02], [0, 3.94, -0.03]], [0.12, 0.115, 0.11], B, { seg: 12 });
  const hm = s.head([0, 4.1, -0.04], [0.08, 0, 0], B, {
    size: 1.42, beard: 'full', moustache: true, brow: 0.09, hair: HAIRLINE.short, hairOpts: { thick: 0.03, groove: 0.01 },
  });
  hat(s, hm);

  // right arm raised forward, open hand; left arm with the reins
  const rWrist = [0.74, 4.5, -0.84];
  s.sweep([[0.44, 3.62, 0], [0.55, 3.84, -0.22], [0.63, 4.08, -0.45], [0.7, 4.3, -0.66], rWrist], [0.14, 0.125, 0.105, 0.095, 0.08], B, { seg: 12 });
  s.hand(rWrist, [0.2, 0.5, -0.84], [0, -0.4, 1], B, { kind: 'open', side: 1, size: 1.25 });
  const lWrist = [-0.3, 3.02, -0.66];
  s.sweep([[-0.44, 3.62, 0], [-0.5, 3.35, -0.12], [-0.5, 3.12, -0.3], [-0.42, 3.05, -0.5], lWrist], [0.15, 0.14, 0.12, 0.11, 0.095], B, { seg: 12 });
  s.hand(lWrist, [0.4, -0.2, -0.9], [0, 1, 0], B, { kind: 'fist', side: -1, size: 1.4 });
  for (const x of [-0.14, 0.14]) s.sweep([[-0.27, 3.0, -0.76], [x * 0.5, 3.02, -1.5], [x, 3.0, -2.12]], 0.02, BD, { seg: 4 });
  // the sabre in its scabbard at the left hip
  s.sweep([[-0.46, 2.95, 0.25], [-0.52, 2.55, 0.6], [-0.56, 2.2, 0.98]], [0.045, 0.04, 0.035], BD, { seg: 7 });
  s.sweep([[-0.44, 3.02, 0.18], [-0.42, 3.2, 0.02]], 0.03, BL, { seg: 6 });
}

/** A khan's hat: a thick fur brim and a tall crown rising to a point, a plume at the top. */
function hat(s, hm) {
  const fur = loft([
    { y: 0.075, rx: 0.13, rf: 0.14, rb: 0.15, fold: 0.07, folds: 22 },
    { y: 0.12, rx: 0.14, rf: 0.15, rb: 0.16, fold: 0.08, folds: 22, phase: 0.8 },
    { y: 0.17, rx: 0.12, rf: 0.13, rb: 0.14, fold: 0.06, folds: 22, phase: 1.6 },
  ], { seg: 44, capBottom: true });
  const crown = loft([
    { y: 0.15, rx: 0.1, rf: 0.105, rb: 0.11 },
    { y: 0.26, rx: 0.1, rf: 0.105, rb: 0.11 },
    { y: 0.36, rx: 0.075, rf: 0.08, rb: 0.085 },
    { y: 0.44, rx: 0.035, rf: 0.035, rb: 0.04 },
    { y: 0.48, rx: 0.008, rf: 0.008 },
  ], { seg: 24 });
  const plume = loft([{ y: 0.46, rx: 0.012, rf: 0.012 }, { y: 0.62, z: 0.06, rx: 0.02, rf: 0.008 }, { y: 0.7, z: 0.14, rx: 0.004, rf: 0.004 }], { seg: 6 });
  for (const [g, col] of [[fur, BD], [crown, B], [plume, BL]]) {
    g.translate(0, 0.02, 0.004);
    g.applyMatrix4(hm);
    s.geo(g, col);
  }
}

/** The whole sculpture onto a Sculpt at the top of the pedestal. */
export function abulkhairSculpture(s) {
  s.box(1.5, 0.14, 3.6, [0, 0.07, 0], BD);     // bronze base slab the hooves stand on
  horse(s);
  rider(s);
}
