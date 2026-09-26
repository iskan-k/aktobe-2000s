import * as THREE from 'three';
import { METAL } from './kit.js';
import { HAIRLINE, mosinGeo, shashkaGeo, alongFrame, starGeo, loft, HEAD } from './figure.js';

/* ------------------------------------------------------------------ *
 * The figures of the Memorial of Glory, each authored at life size in
 * a Sculpt's local space (y = 0 the top of its plinth, facing -z, the
 * figure's right is +x). The Sculpt's scale makes them heroic.
 *
 *   aliyaFigure    Aliya Moldagulova as in the 2005 bronze on
 *                  пр. Молдагуловой: full height, bareheaded, in her
 *                  gymnastyorka, belt and skirt, the greatcoat thrown
 *                  over her shoulders, her left hand holding it closed
 *                  at the breast, the sniper rifle grounded at her
 *                  right side, the Hero's gold star on her chest, her
 *                  pilotka tucked under the belt. She looks up and a
 *                  little to her left.
 *   redArmyman     the soldier of the Obelisk of Glory (1970): a Red
 *                  Army man of the Civil War in a budenovka and a long
 *                  greatcoat with the chest bars, the shashka raised in
 *                  his right hand, the left clenched.
 * ------------------------------------------------------------------ */

const C = METAL.statue, D = METAL.statueDark, L = METAL.bronzeLight, G = METAL.gilt;

function ball(s, c, r, color, rot = [0, 0, 0], seg = 12) { s.ball(c, r, color, seg, rot); }

/** Kirza boots from the top of the shaft to a foot pointing along yaw. */
function boot(s, top, ankle, yaw, color, { shaft = 0.055 } = {}) {
  s.sweep([top, [lerp3(top, ankle, 0.5)[0], lerp3(top, ankle, 0.5)[1], lerp3(top, ankle, 0.5)[2] - 0.004], ankle], [shaft, shaft * 0.92, shaft * 0.78], color, { seg: 12, caps: [true, false] });
  const fx = -Math.sin(yaw), fz = -Math.cos(yaw);
  ball(s, [ankle[0] + fx * 0.06, 0.047, ankle[2] + fz * 0.06], [0.047, 0.047, 0.125], color, [0, yaw, 0]);
  s.box(0.085, 0.024, 0.26, [ankle[0] + fx * 0.055, 0.012, ankle[2] + fz * 0.055], D, [0, yaw, 0]);
}

function lerp3(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; }

/** A rifle or sabre (wood and steel parts) placed along from -> to. */
function arm(s, parts, from, to, top, colors) {
  const m = alongFrame(from, to, top);
  for (const [k, list] of Object.entries(parts)) {
    for (const g of list) { g.applyMatrix4(m); s.geo(g, colors[k]); }
  }
}

/* ---------------- Aliya Moldagulova ---------------- */

export function aliyaFigure(s) {
  // the bronze ground the figure stands on
  s.geo(roughSlab(0.62, 0.46, 0.05), D);

  // legs: weight on the right, the left a half step forward and out
  const legs = [
    { hip: [0.085, 0.86, 0.01], knee: [0.078, 0.47, -0.004], ankle: [0.072, 0.085, 0.012], yaw: -0.32 },
    { hip: [-0.085, 0.86, 0.0], knee: [-0.112, 0.475, -0.085], ankle: [-0.138, 0.085, -0.07], yaw: 0.22 },
  ];
  for (const l of legs) {
    const top = lerp3(l.knee, l.ankle, 0.17);
    s.sweep([l.hip, l.knee, top], [0.075, 0.05, 0.05], C, { seg: 12, caps: [false, false] });
    boot(s, top, l.ankle, l.yaw, D);
  }

  // skirt to the knee, stretched over the forward knee, soft folds
  s.loft([
    { y: 0.5, x: -0.02, z: -0.035, rx: 0.2, rf: 0.155, rb: 0.165, fold: 0.05, folds: 9, phase: 0.5 },
    { y: 0.62, x: -0.012, z: -0.025, rx: 0.195, rf: 0.14, rb: 0.16, fold: 0.04, folds: 9, phase: 0.5 },
    { y: 0.76, x: -0.005, z: -0.012, rx: 0.186, rf: 0.128, rb: 0.152, fold: 0.022, folds: 9, phase: 0.5 },
    { y: 0.9, rx: 0.17, rf: 0.116, rb: 0.14, fold: 0.008, folds: 9, phase: 0.5 },
    { y: 0.98, rx: 0.15, rf: 0.1, rb: 0.116 },
    { y: 1.04, rx: 0.136, rf: 0.092, rb: 0.1 },
  ], C, { seg: 36, capBottom: true });

  // the gymnastyorka: bloused over the belt, the bust, the shoulders
  s.loft([
    { y: 0.99, rx: 0.138, rf: 0.095, rb: 0.1 },
    { y: 1.1, rx: 0.143, rf: 0.1, rb: 0.101, fold: 0.018, folds: 7 },
    { y: 1.19, rx: 0.15, rf: 0.118, rb: 0.101 },
    { y: 1.265, rx: 0.155, rf: 0.134, rb: 0.102 },
    { y: 1.33, rx: 0.162, rf: 0.121, rb: 0.1 },
    { y: 1.385, rx: 0.168, rf: 0.1, rb: 0.095 },
    { y: 1.425, rx: 0.12, rf: 0.076, rb: 0.08 },
    { y: 1.452, rx: 0.058, rf: 0.05, rb: 0.054 },
  ], C, { seg: 36 });
  for (const sd of [-1, 1]) ball(s, [sd * 0.168, 1.372, 0.0], 0.056, C);   // shoulders
  // turn-down collar
  s.loft([
    { y: 1.425, rx: 0.07, rf: 0.064, rb: 0.068, openR: 0.32, openL: 0.32 },
    { y: 1.47, rx: 0.06, rf: 0.054, rb: 0.062, openR: 0.5, openL: 0.5 },
  ], D, { seg: 20 });
  // belt and buckle, the cross strap from the right shoulder
  s.loft([{ y: 0.995, rx: 0.147, rf: 0.104, rb: 0.108 }, { y: 1.05, rx: 0.147, rf: 0.104, rb: 0.108 }], D, { seg: 32, capTop: true, capBottom: true });
  s.box(0.056, 0.05, 0.014, [0, 1.022, -0.108], L);
  s.sweep([[0.115, 1.43, -0.035], [0.07, 1.36, -0.112], [0.0, 1.25, -0.138], [-0.07, 1.14, -0.106], [-0.122, 1.05, -0.088]], 0.01, D, { seg: 6, flat: 0.35 });
  // breast pockets with their flaps, the placket, the Hero's star
  for (const sd of [-1, 1]) s.box(0.058, 0.018, 0.014, [sd * 0.072, 1.325, -0.126 + Math.abs(sd) * 0.002], D, [-0.35, sd * 0.25, 0]);
  s.box(0.02, 0.09, 0.01, [0, 1.385, -0.104], D, [-0.25, 0, 0]);
  const star = starGeo(0.021, 0.008);
  star.rotateX(0.3);
  star.translate(-0.075, 1.37, -0.126);
  s.geo(star, G);
  // the pilotka tucked under the belt at the left hip
  s.box(0.1, 0.05, 0.022, [-0.128, 0.965, -0.075], D, [0.1, 0.95, 0.25]);
  s.box(0.1, 0.018, 0.03, [-0.128, 0.99, -0.075], D, [0.1, 0.95, 0.25]);

  // neck and head: chin up, turned a little to her left
  s.sweep([[0, 1.41, 0.006], [0, 1.47, -0.004], [0, 1.525, -0.012]], [0.047, 0.045, 0.043], C, { seg: 12 });
  const hm = s.head([0, 1.608, -0.014], [0.1, 0.24, 0.03], C, {
    female: true, hair: HAIRLINE.swept, hairColor: C, hairOpts: { thick: 0.07, comb: 'back', groove: 0.025 },
  });
  const bun = new THREE.SphereGeometry(1, 12, 9);
  bun.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(0, -0.04, HEAD.rz * 1.02),
    new THREE.Quaternion(), new THREE.Vector3(0.036, 0.03, 0.03)));
  bun.applyMatrix4(hm);
  s.geo(bun, C);

  // right arm down to the rifle's fore-end; left hand holding the coat at the breast
  const grip = [0.262, 0.99, -0.142];
  const rAlong = [0.3, -0.28, -0.91];
  const rWrist = [grip[0] - rAlong[0] * 0.05, grip[1] - rAlong[1] * 0.05, grip[2] - rAlong[2] * 0.05];
  s.sweep([[0.172, 1.385, 0.0], [0.2, 1.26, 0.012], [0.222, 1.13, -0.018], [0.236, 1.05, -0.07], rWrist],
    [0.05, 0.047, 0.041, 0.038, 0.03], C, { seg: 12 });
  s.hand(rWrist, rAlong, [0.9, 0, 0.3], C, { kind: 'fist', side: 1 });
  const lWrist = [-0.135, 1.2, -0.148];
  s.sweep([[-0.172, 1.385, 0.0], [-0.21, 1.25, 0.0], [-0.232, 1.12, -0.03], [-0.19, 1.15, -0.12], lWrist],
    [0.05, 0.047, 0.041, 0.037, 0.03], C, { seg: 12 });
  s.hand(lWrist, [0.55, 0.35, -0.25], [0.2, 0, 1], C, { kind: 'fist', side: -1 });

  // the greatcoat over her shoulders, open down the front, swinging back
  s.loft([
    { y: 0.26, x: 0.03, z: 0.11, rx: 0.34, rf: 0.23, rb: 0.31, fold: 0.07, folds: 9, phase: 1.1, openR: 1.2, openL: 1.1 },
    { y: 0.5, x: 0.025, z: 0.08, rx: 0.33, rf: 0.22, rb: 0.29, fold: 0.06, folds: 8, phase: 1.1, openR: 1.15, openL: 1.02 },
    { y: 0.8, x: 0.015, z: 0.045, rx: 0.315, rf: 0.2, rb: 0.25, fold: 0.045, folds: 7, phase: 1.1, openR: 1.1, openL: 0.9 },
    { y: 1.1, x: 0.005, z: 0.015, rx: 0.3, rf: 0.17, rb: 0.2, fold: 0.022, folds: 5, phase: 1.1, openR: 1.05, openL: 0.68 },
    { y: 1.3, rx: 0.265, rf: 0.142, rb: 0.155, openR: 0.95, openL: 0.58 },
    { y: 1.4, rx: 0.236, rf: 0.122, rb: 0.126, openR: 0.85, openL: 0.58 },
    { y: 1.455, rx: 0.13, rf: 0.086, rb: 0.1, openR: 0.6, openL: 0.5 },
    { y: 1.505, rx: 0.08, rf: 0.07, rb: 0.08, openR: 0.45, openL: 0.4 },
  ], C, { seg: 40 });

  // the sniper rifle grounded by her right foot
  arm(s, mosinGeo({ scope: true }), [0.28, 0.035, -0.17], [0.258, 1.26, -0.128], [0.2, 0, 1], { wood: C, steel: D });
}

/** A low uneven bronze ground under a figure's feet. */
function roughSlab(w, d, h) {
  const g = new THREE.CylinderGeometry(1, 1.04, h, 18, 1);
  g.scale(w, 1, d);
  g.translate(0, h / 2 - 0.01, 0);
  return g;
}

/* ---------------- the Red Army man of the obelisk ---------------- */

export function redArmyman(s) {
  s.geo(roughSlab(0.6, 0.5, 0.05), D);
  // a wide stance, the left foot forward
  const legs = [
    { hip: [0.095, 0.9, 0.02], knee: [0.13, 0.49, 0.05], ankle: [0.15, 0.09, 0.08], yaw: -0.35 },
    { hip: [-0.095, 0.9, -0.01], knee: [-0.12, 0.5, -0.12], ankle: [-0.12, 0.09, -0.16], yaw: 0.15 },
  ];
  for (const l of legs) {
    const top = lerp3(l.knee, l.ankle, 0.1);
    s.sweep([l.hip, l.knee, top], [0.08, 0.056, 0.055], C, { seg: 12, caps: [false, false] });
    boot(s, top, l.ankle, l.yaw, D, { shaft: 0.058 });
  }
  // the long greatcoat to mid-calf, the skirt split and flung back by the stride
  s.loft([
    { y: 0.3, x: 0.0, z: 0.05, rx: 0.33, rf: 0.2, rb: 0.3, fold: 0.07, folds: 9, phase: 0.3, openR: 0.35, openL: 0.35 },
    { y: 0.55, x: 0.0, z: 0.03, rx: 0.29, rf: 0.19, rb: 0.24, fold: 0.05, folds: 8, phase: 0.3, openR: 0.22, openL: 0.22 },
    { y: 0.82, rx: 0.22, rf: 0.155, rb: 0.17, fold: 0.03, folds: 7, phase: 0.3, openR: 0.1, openL: 0.1 },
    { y: 1.0, rx: 0.175, rf: 0.125, rb: 0.13, openR: 0.02, openL: 0.02 },
    { y: 1.06, rx: 0.172, rf: 0.125, rb: 0.128, openR: 0.02, openL: 0.02 },
  ], C, { seg: 40 });
  // chest and shoulders
  s.loft([
    { y: 1.04, rx: 0.172, rf: 0.125, rb: 0.128 },
    { y: 1.2, rx: 0.18, rf: 0.14, rb: 0.125 },
    { y: 1.33, rx: 0.19, rf: 0.14, rb: 0.12 },
    { y: 1.42, rx: 0.2, rf: 0.115, rb: 0.11 },
    { y: 1.47, rx: 0.13, rf: 0.085, rb: 0.09 },
    { y: 1.51, rx: 0.075, rf: 0.07, rb: 0.075 },
  ], C, { seg: 36, capTop: true });
  for (const sd of [-1, 1]) ball(s, [sd * 0.198, 1.41, 0], 0.066, C);
  s.loft([{ y: 1.02, rx: 0.178, rf: 0.131, rb: 0.134 }, { y: 1.08, rx: 0.178, rf: 0.131, rb: 0.134 }], D, { seg: 32, capTop: true, capBottom: true });
  s.box(0.06, 0.055, 0.014, [0, 1.05, -0.134], L);
  // the three "razgovor" bars across the breast, the tall collar
  for (let i = 0; i < 3; i++) {
    const y = 1.36 - i * 0.075;
    s.box(0.2 - i * 0.012, 0.028, 0.012, [0, y, -0.14 + i * 0.002], D, [-0.12, 0, 0]);
  }
  s.loft([
    { y: 1.48, rx: 0.085, rf: 0.08, rb: 0.085, openR: 0.25, openL: 0.25 },
    { y: 1.55, rx: 0.075, rf: 0.07, rb: 0.078, openR: 0.3, openL: 0.3 },
  ], D, { seg: 20 });

  // head in the budenovka, looking down at the flame
  s.sweep([[0, 1.48, 0.01], [0, 1.54, 0.0], [0, 1.59, -0.012]], [0.055, 0.052, 0.05], C, { seg: 12 });
  const hm = s.head([0, 1.672, -0.018], [-0.12, -0.12, 0], C, { nose: 1.05, brow: 0.08, ears: false });
  budenovka(s, hm);

  // right arm up with the shashka, left arm down, fist clenched
  const rHand = [0.33, 1.98, -0.08];
  s.sweep([[0.2, 1.42, 0.0], [0.27, 1.56, -0.03], [0.31, 1.72, -0.06], [0.325, 1.85, -0.075], rHand],
    [0.058, 0.054, 0.046, 0.042, 0.034], C, { seg: 12 });
  s.hand(rHand, [0.05, 1, -0.02], [-1, 0, 0], C, { kind: 'fist', side: 1 });
  arm(s, shashkaGeo(0.9), [0.335, 2.02, -0.08], [0.31, 2.9, -0.2], [1, 0, 0], { blade: L, hilt: D });
  const lWrist = [-0.25, 0.98, -0.07];
  s.sweep([[-0.2, 1.42, 0.0], [-0.24, 1.28, 0.0], [-0.255, 1.14, -0.02], lWrist], [0.058, 0.054, 0.046, 0.036], C, { seg: 12 });
  s.hand(lWrist, [-0.05, -1, -0.12], [1, 0, 0], C, { kind: 'fist', side: -1 });
}

/** The budenovka: a cloth helmet rising to a spike, the flaps buttoned up round it, a peak and a star. */
function budenovka(s, hm) {
  const k = HEAD.ry;
  const dome = loft([
    { y: 0.18 * k, rx: HEAD.rx * 1.14, rf: HEAD.rz * 1.1, rb: HEAD.rz * 1.18 },
    { y: 0.55 * k, rx: HEAD.rx * 1.1, rf: HEAD.rz * 1.06, rb: HEAD.rz * 1.12 },
    { y: 0.95 * k, rx: HEAD.rx * 0.82, rf: HEAD.rz * 0.8, rb: HEAD.rz * 0.84 },
    { y: 1.22 * k, rx: HEAD.rx * 0.42, rf: HEAD.rz * 0.4, rb: HEAD.rz * 0.42 },
    { y: 1.5 * k, rx: HEAD.rx * 0.12, rf: HEAD.rz * 0.12, rb: HEAD.rz * 0.12 },
    { y: 1.62 * k, rx: 0.004, rf: 0.004 },
  ], { seg: 28, capBottom: true });
  // the flaps, buttoned up, make a thick band round the crown
  const band = loft([
    { y: 0.12 * k, rx: HEAD.rx * 1.2, rf: HEAD.rz * 1.16, rb: HEAD.rz * 1.24 },
    { y: 0.5 * k, rx: HEAD.rx * 1.17, rf: HEAD.rz * 1.13, rb: HEAD.rz * 1.2 },
  ], { seg: 28, capTop: true, capBottom: true });
  const peak = new THREE.SphereGeometry(1, 14, 6, 0, Math.PI * 2, 0, Math.PI / 2);
  peak.scale(HEAD.rx * 1.05, 0.012, HEAD.rz * 0.75);
  peak.rotateX(0.12);
  peak.translate(0, 0.12 * k, -HEAD.rz * 1.02);
  const star = starGeo(0.028, 0.008);
  star.rotateX(0.25);
  star.translate(0, 0.72 * k, -HEAD.rz * 1.03);
  for (const [g, col] of [[dome, C], [band, D], [peak, D], [star, L]]) { g.applyMatrix4(hm); s.geo(g, col); }
  for (const sd of [-1, 1]) {
    const b = new THREE.SphereGeometry(0.009, 6, 4);
    b.translate(sd * HEAD.rx * 1.18, 0.34 * k, -HEAD.rz * 0.2);
    b.applyMatrix4(hm);
    s.geo(b, L);
  }
}

