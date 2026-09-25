import * as THREE from 'three';
import { Batch } from '../core/batch.js';
import { bogie, coupler, ladder, handrail, zCyl, xCyl, DARK, STEEL } from './stockParts.js';

/* ------------------------------------------------------------------ *
 * Freight wagons, 1520 mm Soviet types, each on two 18-100 bogies with
 * SA-3 couplers (no side buffers on this gauge).
 *
 *   gondola  open wagon (полувагон) 12-532, red-brown, ribbed sides,
 *            bottom discharge doors, heaped with coal
 *   tank     tank car 15-1443, black, on saddles, with the dome platform
 *   hopper   covered hopper for cement or grain, grey-beige
 *   boxcar   covered wagon (крытый вагон) 11-066, brown, sliding doors
 *
 * Front toward local -z, origin on the rail top at mid length; each
 * builder returns { b, length } with length over the couplers.
 * ------------------------------------------------------------------ */

/** Underframe common to all four: centre sill, side sills, brake gear. */
function underframe(b, L, W, y, color = DARK) {
  b.box(0.45, 0.4, L, color, 0, y - 0.4, 0);
  for (const s of [-1, 1]) b.box(0.18, 0.28, L, color, s * (W / 2 - 0.12), y - 0.28, 0);
  // cross bearers over the bogies
  for (const e of [-1, 1]) b.box(W - 0.2, 0.3, 0.35, color, 0, y - 0.3, e * (L / 2 - 2.1));
  // brake cylinder, reservoir and the pipe along the car
  zCyl(b, 0.17, -0.9, -0.3, -0.55, y - 0.42, STEEL, 8);
  zCyl(b, 0.2, 0.2, 1.3, 0.6, y - 0.45, STEEL, 8);
  b.box(0.05, 0.05, L - 0.4, 0x1c1c1c, 0.3, y - 0.47, 0);
}

export function gondola() {
  const b = new Batch({ cell: Infinity });
  const L = 12.7, W = 3.13, y0 = 1.28, y1 = 3.36;
  const c = 0x7a3a2a, rib = 0x6a3122;
  underframe(b, L, W, y0);
  bogie(b, -4.3, 'freight');
  bogie(b, 4.3, 'freight');
  coupler(b, -L / 2 - 0.62, -1, { beamW: W - 0.1, beam: c });
  coupler(b, L / 2 + 0.62, 1, { beamW: W - 0.1, beam: c });
  // floor with the bottom doors hinged under it, the coal heaped inside
  b.box(W - 0.1, 0.1, L - 0.1, 0x3e2a22, 0, y0, 0);
  for (let i = 0; i < 7; i++) {
    for (const s of [-1, 1]) b.box(1.3, 0.06, 1.0, 0x5e2e22, s * 0.72, y0 - 0.06, -L / 2 + 2.9 + i * 1.17);
  }
  b.box(W - 0.3, 1.3, L - 0.4, 0x26231f, 0, y0 + 0.1, 0);
  for (const [dz, h, w] of [[-4, 0.5, 2.1], [-1.3, 0.62, 2.3], [1.4, 0.58, 2.2], [4.1, 0.46, 2.0]]) {
    b.box(w, h, 2.4, 0x2c2925, 0, y0 + 1.36, dz, { ry: dz * 0.05 });
  }
  for (const s of [-1, 1]) {
    b.box(0.08, y1 - y0, L, c, s * (W / 2 - 0.04), y0, 0);
    b.box(W, y1 - y0, 0.08, c, 0, y0, s * (L / 2 - 0.04));
    // stamped side stakes and the top chord
    for (let i = 0; i <= 10; i++) {
      b.box(0.12, y1 - y0, 0.14, rib, s * (W / 2 + 0.02), y0, -L / 2 + 0.3 + i * ((L - 0.6) / 10));
    }
    b.box(0.13, 0.12, L, rib, s * (W / 2 + 0.03), y1 - 0.12, 0);
    b.box(0.12, 0.1, L, rib, s * (W / 2 + 0.03), y0 + 0.02, 0);
    // end walls: horizontal pressings, a corner ladder
    for (let k = 0; k < 3; k++) b.box(W - 0.2, 0.1, 0.06, rib, 0, y0 + 0.5 + k * 0.55, s * (L / 2 + 0.01));
    ladder(b, 1.1, s * (L / 2 + 0.06), y0 - 0.3, y1 - 0.1, { along: 'x', color: rib });
  }
  return { b, length: 13.92 };
}

export function tank() {
  const b = new Batch({ cell: Infinity });
  const L = 11.0, y0 = 1.2, R = 1.5, yc = 2.75;
  const c = 0x2b2b2d;
  underframe(b, L + 0.6, 2.8, y0);
  bogie(b, -3.6, 'freight');
  bogie(b, 3.6, 'freight');
  coupler(b, -6.01, -1, { beamW: 2.7, beam: DARK });
  coupler(b, 6.01, 1, { beamW: 2.7, beam: DARK });
  // barrel, dished ends, the steel bands and the saddles it rests on
  b.cyl(R, L, c, 0, yc, -L / 2, { rx: Math.PI / 2, seg: 20 });
  for (const s of [-1, 1]) {
    const cap = new THREE.SphereGeometry(R, 18, 8, 0, Math.PI * 2, 0, Math.PI / 2);
    cap.scale(1, 1, 0.35);
    cap.rotateX(s * Math.PI / 2);
    cap.translate(0, yc, s * L / 2);
    b.add(cap, { color: c });
  }
  for (const z of [-3.9, 3.9]) {
    zCyl(b, R + 0.03, z - 0.06, z + 0.06, 0, yc, 0x222224, 20);
    b.box(2.7, 0.45, 0.35, DARK, 0, y0 - 0.02, z);
    for (const s of [-1, 1]) b.box(0.35, 0.5, 0.3, DARK, s * 1.05, y0 + 0.35, z, { rz: -s * 0.5 });
  }
  // dome with its lid, the platform round it and the two ladders up
  b.cyl(0.45, 0.5, c, 0, yc + R - 0.1, 0, { seg: 14 });
  b.cyl(0.5, 0.08, 0x262628, 0, yc + R + 0.4, 0, { seg: 14 });
  b.box(1.6, 0.05, 1.4, 0x6f6f6a, 0, yc + R - 0.05, 0);
  for (const s of [-1, 1]) {
    for (const e of [-1, 1]) b.box(0.04, 0.95, 0.04, 0x8a8a84, s * 0.78, yc + R, e * 0.68);
    handrail(b, s * 0.78, yc + R + 0.95, -0.68, s * 0.78, yc + R + 0.95, 0.68, 0x8a8a84);
    handrail(b, -0.78, yc + R + 0.95, s * 0.68, 0.78, yc + R + 0.95, s * 0.68, 0x8a8a84);
    ladder(b, s * (R + 0.08), 0.1, y0 - 0.2, yc + R - 0.05, { along: 'z', w: 0.42, color: 0x8a8a84 });
  }
  // bottom outlet valve under the middle
  b.cyl(0.14, 0.4, DARK, 0, yc - R - 0.35, 0, { seg: 8 });
  return { b, length: 12.02 };
}

export function hopper() {
  const b = new Batch({ cell: Infinity });
  const L = 13.4, W = 3.1, y0 = 1.3, c = 0x9b958a, rib = 0x847e73;
  underframe(b, L, W - 0.3, y0);
  bogie(b, -4.6, 'freight');
  bogie(b, 4.6, 'freight');
  coupler(b, -L / 2 - 0.66, -1, { beamW: W - 0.3, beam: rib });
  coupler(b, L / 2 + 0.66, 1, { beamW: W - 0.3, beam: rib });
  b.box(W, 2.2, L - 1.4, c, 0, 2.2, 0);
  // sloped ends down to the frame
  for (const s of [-1, 1]) b.box(W, 1.6, 1.3, c, 0, 1.55, s * (L / 2 - 1.05), { rx: s * 0.45 });
  b.box(W - 0.3, 0.3, L - 1.8, 0x8c867b, 0, 4.4, 0);
  // the three discharge hoppers with their gates
  for (const z of [-3.4, 0, 3.4]) {
    b.box(W - 0.6, 0.9, 2.2, 0x8f897e, 0, 1.3, z);
    b.box(0.9, 0.3, 0.9, rib, 0, 0.95, z);
    b.box(W - 0.4, 0.05, 0.05, 0x3a3936, 0, 1.1, z + 0.6);
  }
  for (const s of [-1, 1]) {
    for (let i = 0; i < 7; i++) b.box(0.08, 2.2, 0.12, rib, s * (W / 2 + 0.02), 2.2, -L / 2 + 1.0 + i * ((L - 2) / 6));
    b.box(0.1, 0.1, L - 1.4, rib, s * (W / 2 + 0.03), 4.3, 0);
    ladder(b, s * 1.0, s * (L / 2 - 0.3), y0 - 0.3, 4.3, { along: 'x', color: 0x3a3936 });
    // end platform
    b.box(W - 0.3, 0.05, 0.6, 0x3a3936, 0, y0 + 0.05, s * (L / 2 - 0.1));
  }
  for (let i = 0; i < 4; i++) b.cyl(0.35, 0.12, 0x6f6a61, 0, 4.7, -4.5 + i * 3, { seg: 10 });
  b.box(0.6, 0.04, L - 2, 0x5d5a52, 0, 4.72, 0);                            // roof walkway
  return { b, length: 14.72 };
}

export function boxcar() {
  const b = new Batch({ cell: Infinity });
  const L = 13.8, W = 2.95, y0 = 1.3, y1 = 4.2, c = 0x6e4a34, rib = 0x5c3c2b;
  underframe(b, L, W, y0);
  bogie(b, -4.6, 'freight');
  bogie(b, 4.6, 'freight');
  coupler(b, -L / 2 - 0.47, -1, { beamW: W - 0.1, beam: rib });
  coupler(b, L / 2 + 0.47, 1, { beamW: W - 0.1, beam: rib });
  b.box(W, y1 - y0, L, c, 0, y0, 0);
  // arched roof: three steps and the ribs over it
  b.box(W - 0.1, 0.18, L, 0x5f4030, 0, y1, 0);
  b.box(W - 0.8, 0.12, L - 0.2, 0x644433, 0, y1 + 0.18, 0);
  for (let i = 0; i < 10; i++) b.box(W - 0.2, 0.05, 0.08, 0x523626, 0, y1 + 0.18, -L / 2 + 0.6 + i * ((L - 1.2) / 9));
  for (const s of [-1, 1]) {
    // sliding door: panel, its frame, the handle and the rails top and bottom
    b.box(0.06, 2.4, 3.8, rib, s * (W / 2 + 0.02), y0 + 0.15, 0);
    for (const dz of [-1.9, 1.9]) b.box(0.08, 2.5, 0.1, 0x4c3222, s * (W / 2 + 0.05), y0 + 0.1, dz);
    for (const k of [0.8, 1.6]) b.box(0.07, 0.06, 3.7, 0x4c3222, s * (W / 2 + 0.05), y0 + 0.15 + k, 0);
    b.box(0.08, 0.1, 4.6, 0x3a3a38, s * (W / 2 + 0.03), y1 - 0.1, 0);
    b.box(0.08, 0.1, 4.6, 0x3a3a38, s * (W / 2 + 0.03), y0 + 0.05, 0);
    b.box(0.08, 0.4, 0.06, 0xa9a59a, s * (W / 2 + 0.08), y0 + 1.1, 1.6);
    // body stakes either side of the door, the vent hatches
    for (let i = 0; i < 9; i++) if (Math.abs(i - 4) > 1) b.box(0.08, y1 - y0, 0.1, rib, s * (W / 2 + 0.02), y0, -L / 2 + 0.4 + i * ((L - 0.8) / 8));
    for (const e of [-1, 1]) b.box(0.06, 0.5, 0.9, 0x3e342c, s * (W / 2 + 0.02), 3.2, e * (L / 2 - 1.4));
    // end: corner ladder and a grab rail
    ladder(b, 1.0, s * (L / 2 + 0.05), y0 - 0.3, y1 - 0.2, { along: 'x', color: 0x3a3936 });
    handrail(b, -1.2, y0 + 0.4, s * (L / 2 + 0.06), -1.2, y0 + 1.4, s * (L / 2 + 0.06), 0x3a3936);
  }
  xCyl(b, 0.02, -W / 2, W / 2, y1 + 0.3, 0, 0x3a3936, 4);
  return { b, length: 14.73 };
}
