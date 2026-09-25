import * as THREE from 'three';
import { cel } from '../core/toon.js';
import { canvasTex, cached, centerText, FONT } from '../core/textures.js';

/* ------------------------------------------------------------------ *
 * The Er 791-57 on its plinth by the depot (set up in 2004): a Soviet
 * Эр class 0-10-0 freight engine with its four-axle tender, at real size.
 *
 * Proportions from the class: 1320 mm drivers on five coupled axles,
 * boiler centre 2.9 m above the rail, 4.85 m to the chimney top, about
 * 21 m over both couplers. Plinth colours as these engines are kept:
 * black body, red frames, wheels and buffer beams, white tyre rims.
 *
 * Local frame: the engine runs along x with the smokebox toward -x and
 * the tender toward +x; z is across. `y0` is the top of the plinth rail.
 * ------------------------------------------------------------------ */

const BLACK = 0x1f2021;
const SOOT = 0x151617;
const RED = 0xb3262b;
const WHITE = 0xe8e4da;
const STEEL = 0x9ea3a4;
const IRON = 0x3a3b3c;

const R_DRV = 0.66;
const AXLES = [-6.5, -5.1, -3.7, -2.3, -0.9];      // coupled axles, main driver third
const MAIN = 2;
const CRANK = 0.33;
const BOILER_Y = 2.9;
const CYL_Y = 1.0;
const BOARD_Y = 1.72;                               // running boards
const WHEEL_Z = 0.77;                               // tread line
const ROD_Z = 0.95;
const MAINROD_Z = 1.04;
const CYL_Z = 1.1;

function plateTex() {
  return cached('depot|er-plate', () => canvasTex(512, 128, (c, W, H) => {
    c.fillStyle = '#18191a';
    c.fillRect(0, 0, W, H);
    c.strokeStyle = '#e8e4da';
    c.lineWidth = 5;
    c.strokeRect(8, 8, W - 16, H - 16);
    centerText(c, 'Эр 791-57', W / 2, H / 2 + 3, W - 60, 78, 0xefe9da, { family: FONT.sans });
  }));
}

/** Along-x cylinder from xa to xb. */
function xc(b, r, xa, xb, y, z, color, seg = 14, o = {}) {
  b.cyl(r, xb - xa, color, xa, y, z, { rz: -Math.PI / 2, seg, ...o });
}

/** Along-z cylinder from za to zb. */
function zc(b, r, za, zb, x, y, color, seg = 12) {
  b.cyl(r, zb - za, color, x, y, za, { rx: Math.PI / 2, seg });
}

/** A flat part on a wheel face: a box rotated about the axle. */
function spoke(b, cx, cy, z, a, r0, r1, w, color) {
  b.box(w, r1 - r0, 0.04, color, cx + Math.cos(a) * r0, cy + Math.sin(a) * r0, z, { rz: a - Math.PI / 2 });
}

/** White painted tyre face: a flat ring on the outer face of a wheel. */
function rimRing(b, cx, cy, z, s, r0, r1) {
  const g = new THREE.RingGeometry(r0, r1, 28, 1);
  if (s < 0) g.rotateY(Math.PI);
  g.translate(cx, cy, z);
  b.add(g, { color: WHITE, cast: false });
}

/**
 * A spoked driving wheel: dark tyre, white rim face, red spokes, hub,
 * counterweight opposite the crank, and the crank pin at angle `crank`.
 */
function driver(b, cx, cy, z, s, crank) {
  const zi = z + s * (WHEEL_Z - 0.07), zo = z + s * (WHEEL_Z + 0.07);
  zc(b, R_DRV, Math.min(zi, zo), Math.max(zi, zo), cx, cy, IRON, 20);
  zc(b, R_DRV + 0.035, s > 0 ? zi - 0.04 : zi, s > 0 ? zi : zi + 0.04, cx, cy, IRON, 20);   // flange
  const face = zo + s * 0.002;
  zc(b, 0.56, Math.min(face, face + s * 0.004), Math.max(face, face + s * 0.004), cx, cy, SOOT, 20);
  rimRing(b, cx, cy, zo + s * 0.008, s, 0.56, R_DRV);
  const zs = zo + s * 0.03;
  for (let i = 0; i < 14; i++) spoke(b, cx, cy, zs, (i / 14) * Math.PI * 2 + 0.1, 0.15, 0.57, 0.05, RED);
  // counterweight: a block across the spokes opposite the crank pin
  const cw = crank + Math.PI;
  for (const d of [-0.32, -0.16, 0, 0.16, 0.32]) spoke(b, cx, cy, zs + s * 0.01, cw + d, 0.3, 0.55, 0.13, RED);
  zc(b, 0.17, Math.min(zo, zo + s * 0.1), Math.max(zo, zo + s * 0.1), cx, cy, RED, 12);
  const px = cx + Math.cos(crank) * CRANK, py = cy + Math.sin(crank) * CRANK;
  const zp = z + s * (MAINROD_Z + 0.06);
  zc(b, 0.08, Math.min(zo, zp), Math.max(zo, zp), px, py, STEEL, 10);
  return { px, py };
}

function frames(b, x, z, y0) {
  // bar frames inside the wheels, the stretchers between them
  for (const s of [-1, 1]) b.box(12.0, 1.1, 0.12, RED, x - 4.05, y0 + 0.3, z + s * 0.56);
  for (const dx of [-9.6, -7.2, -4.4, -1.6, 1.4]) b.box(0.25, 0.7, 1.0, RED, x + dx, y0 + 0.55, z);
  // the space under the boiler, closed so nothing shows through
  b.box(5.4, 0.85, 1.12, SOOT, x - 5.2, y0 + 1.35, z);
  // front buffer beam with marker lamps and the SA-3 coupler
  b.box(0.26, 0.62, 3.0, RED, x - 10.08, y0 + 0.72, z);
  b.box(0.27, 0.05, 3.0, WHITE, x - 10.08, y0 + 1.28, z);
  for (const s of [-1, 1]) {
    b.box(0.2, 0.26, 0.22, BLACK, x - 10.3, y0 + 1.36, z + s * 1.1);
    b.box(0.03, 0.14, 0.14, 0xfff2cc, x - 10.41, y0 + 1.42, z + s * 1.1, { mat: 'glow' });
  }
  b.box(0.6, 0.3, 0.3, IRON, x - 10.45, y0 + 0.82, z);
  b.box(0.22, 0.36, 0.34, IRON, x - 10.8, y0 + 0.79, z + 0.02);
  // pilot (cowcatcher) under the beam
  for (const s of [-1, 1]) b.box(0.1, 0.5, 1.5, SOOT, x - 10.25, y0 + 0.18, z + s * 0.62, { ry: s * 0.5, rz: 0.25 });
}

function cylinders(b, x, z, y0) {
  // saddle under the smokebox, cylinders and valve chests either side
  b.box(1.8, 1.55, 1.8, BLACK, x - 8.6, y0 + 0.6, z);
  for (const s of [-1, 1]) {
    const cz = z + s * CYL_Z;
    xc(b, 0.34, x - 9.35, x - 7.85, y0 + CYL_Y, cz, BLACK, 16);
    xc(b, 0.38, x - 9.4, x - 9.3, y0 + CYL_Y, cz, IRON, 16);
    xc(b, 0.38, x - 7.9, x - 7.8, y0 + CYL_Y, cz, IRON, 16);
    xc(b, 0.18, x - 9.3, x - 7.9, y0 + 1.5, z + s * 1.02, BLACK, 12);
    b.box(1.5, 0.5, 0.35, BLACK, x - 8.6, y0 + 1.1, z + s * 0.95);
    // outside steam pipe from the smokebox down to the chest
    b.tube(x - 8.7, y0 + 2.45, z + s * 0.82, x - 8.6, y0 + 1.66, z + s * 1.02, 0.1, BLACK, { seg: 8 });
    // drain cocks and their pipes
    b.tube(x - 9.2, y0 + 0.66, cz, x - 9.6, y0 + 0.3, cz, 0.025, IRON, { seg: 4 });
  }
}

/** Slide bars, crosshead, piston rod, main rod and valve gear on side s. */
function motion(b, x, z, y0, s, pins, crank) {
  const zz = (d) => z + s * d;
  const yc = y0 + CYL_Y;
  const main = pins[MAIN];
  const L = 3.3;
  const xh = main.px - Math.sqrt(L * L - (main.py - yc) ** 2);
  for (const dy of [-0.18, 0.18]) b.box(2.3, 0.05, 0.08, STEEL, x - 6.7, yc + dy - 0.025, zz(CYL_Z));
  b.box(0.36, 0.3, 0.16, IRON, xh, yc - 0.15, zz(CYL_Z));
  b.tube(x - 7.85, yc, zz(CYL_Z), xh, yc, zz(CYL_Z), 0.045, STEEL, { seg: 6 });
  // main rod from the crosshead to the third axle's crank pin, red
  b.tube(xh, yc, zz(MAINROD_Z), main.px, main.py, zz(MAINROD_Z), 0.075, RED, { seg: 6 });
  // coupling rods joining the five crank pins
  for (let i = 0; i < pins.length - 1; i++) {
    b.box(pins[i + 1].px - pins[i].px, 0.13, 0.07, RED, (pins[i].px + pins[i + 1].px) / 2, pins[i].py - 0.065, zz(ROD_Z));
  }
  // Walschaerts gear: return crank, eccentric rod, expansion link,
  // radius rod forward to the combination lever at the valve crosshead
  const ra = crank + Math.PI / 2;
  const ex = main.px + Math.cos(ra) * 0.22, ey = main.py + Math.sin(ra) * 0.22;
  b.tube(main.px, main.py, zz(MAINROD_Z + 0.08), ex, ey, zz(MAINROD_Z + 0.1), 0.04, STEEL, { seg: 5 });
  const lx = x - 5.3, ly = y0 + 1.25;
  b.tube(ex, ey, zz(MAINROD_Z + 0.1), lx, ly - 0.1, zz(MAINROD_Z + 0.1), 0.035, STEEL, { seg: 5 });
  b.box(0.1, 0.55, 0.07, IRON, lx, ly - 0.35, zz(MAINROD_Z + 0.1), { rz: 0.12 });
  b.box(0.3, 0.3, 0.08, BLACK, lx + 0.1, ly - 0.05, zz(MAINROD_Z + 0.14));
  const vx = x - 7.7, vy = y0 + 1.5;
  b.tube(lx, ly, zz(MAINROD_Z + 0.1), vx, vy, zz(MAINROD_Z + 0.02), 0.035, STEEL, { seg: 5 });
  b.tube(vx, vy + 0.05, zz(MAINROD_Z + 0.02), xh + 0.05, yc - 0.15, zz(MAINROD_Z), 0.035, STEEL, { seg: 5 });
  b.tube(x - 9.3, vy, zz(1.02), vx, vy, zz(MAINROD_Z + 0.02), 0.03, STEEL, { seg: 5 });
  // reversing rod along the top of the running board to the cab, and the
  // lifting arm down through the board to the link
  b.tube(lx, y0 + BOARD_Y + 0.14, zz(1.32), x - 0.45, y0 + BOARD_Y + 0.2, zz(1.32), 0.03, IRON, { seg: 4 });
  b.tube(lx, y0 + BOARD_Y + 0.14, zz(1.32), lx + 0.1, ly + 0.05, zz(MAINROD_Z + 0.14), 0.03, IRON, { seg: 4 });
}

function runningGear(b, x, z, y0) {
  const cy = y0 + R_DRV;
  for (const s of [-1, 1]) {
    // right-hand cranks lead the left by a quarter turn, as on every two-cylinder engine
    const crank = s > 0 ? 0.55 : 0.55 + Math.PI / 2;
    const pins = AXLES.map((ax) => driver(b, x + ax, cy, z, s, crank));
    motion(b, x, z, y0, s, pins, crank);
    for (const ax of AXLES) {
      // axle box in the frame, brake shoe and its hanger ahead of the tyre
      b.box(0.34, 0.4, 0.2, IRON, x + ax, cy - 0.2, z + s * 0.56);
      b.box(0.1, 0.42, 0.1, IRON, x + ax - R_DRV - 0.06, cy - 0.3, z + s * WHEEL_Z);
      b.box(0.05, 0.6, 0.05, IRON, x + ax - R_DRV - 0.06, cy + 0.1, z + s * WHEEL_Z);
    }
    // sand pipes down to the rail in front of the first and third drivers
    for (const i of [0, 2]) b.tube(x + AXLES[i] - 0.5, y0 + 1.7, z + s * 0.9, x + AXLES[i] - 0.72, y0 + 0.08, z + s * WHEEL_Z, 0.025, IRON, { seg: 4 });
  }
  for (const ax of AXLES) zc(b, 0.1, z - 0.56, z + 0.56, x + ax, cy, IRON, 6);
}

function boiler(b, x, z, y0) {
  const by = y0 + BOILER_Y;
  // smokebox with its door, hinges, handrail and the red star
  xc(b, 0.97, x - 9.7, x - 8.0, by, z, SOOT, 24);
  xc(b, 0.82, x - 9.78, x - 9.7, by, z, BLACK, 24);
  xc(b, 0.18, x - 9.86, x - 9.78, by, z, IRON, 10);
  for (const dy of [-0.35, 0.35]) b.box(0.03, 0.06, 1.4, IRON, x - 9.8, by + dy, z + 0.15);
  b.tube(x - 9.82, by + 0.55, z - 0.4, x - 9.82, by + 0.55, z + 0.4, 0.02, STEEL, { seg: 4 });
  const star = new THREE.Shape();
  for (let i = 0; i < 10; i++) {
    const a = Math.PI / 2 + (i * Math.PI) / 5, rr = i % 2 ? 0.12 : 0.3;
    if (i) star.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); else star.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
  }
  const sg = new THREE.ShapeGeometry(star);
  sg.rotateY(-Math.PI / 2);
  sg.translate(x - 9.875, by + 0.18, z);
  b.add(sg, { color: RED });
  // barrel and round-top firebox as one, lagging bands along it
  xc(b, 0.9, x - 8.0, x - 0.35, by, z, BLACK, 24);
  for (let bx = -7.4; bx < -0.6; bx += 1.3) xc(b, 0.915, x + bx, x + bx + 0.06, by, z, IRON, 24);
  // firebox sides down between the frames and over the rear drivers
  b.box(2.4, 1.1, 1.84, BLACK, x - 1.55, y0 + 1.85, z);
  b.box(2.4, 0.75, 1.2, BLACK, x - 1.55, y0 + 1.2, z);
  b.box(2.2, 0.55, 1.0, SOOT, x - 1.2, y0 + 0.65, z);           // ashpan
  // boiler handrails on stanchions
  for (const s of [-1, 1]) {
    b.tube(x - 9.4, by + 0.45, z + s * 0.98, x - 0.5, by + 0.45, z + s * 0.98, 0.022, STEEL, { seg: 4 });
    for (let hx = -9.2; hx < -0.4; hx += 1.8) b.box(0.03, 0.03, 0.12, STEEL, x + hx, by + 0.43, z + s * 0.9);
  }
}

function boilerTop(b, x, z, y0) {
  const top = y0 + BOILER_Y + 0.85;
  // chimney with its lip, the feedwater heater across the smokebox front
  b.cyl(0.29, y0 + 4.78 - top, BLACK, x - 9.0, top, z, { seg: 14, rTop: 0.31 });
  b.cyl(0.36, 0.08, BLACK, x - 9.0, y0 + 4.77, z, { seg: 14 });
  zc(b, 0.2, z - 0.7, z + 0.7, x - 9.55, top + 0.02, BLACK, 12);
  // headlamp at the front of the smokebox top
  b.box(0.42, 0.42, 0.42, BLACK, x - 9.5, top + 0.12, z + 0.0);
  b.box(0.03, 0.26, 0.26, 0xfff3c8, x - 9.72, top + 0.2, z, { mat: 'glow' });
  // turbo-generator, sand dome, steam dome, whistle, safety valves
  b.cyl(0.14, 0.3, IRON, x - 8.3, top, z + 0.3, { seg: 10 });
  for (const [dx, r, h] of [[-6.4, 0.46, 0.5], [-4.6, 0.42, 0.55]]) {
    b.cyl(r, h, BLACK, x + dx, top - 0.1, z, { seg: 18 });
    const cap = new THREE.SphereGeometry(r, 18, 6, 0, Math.PI * 2, 0, Math.PI / 2);
    cap.scale(1, 0.35, 1);
    cap.translate(x + dx, top - 0.1 + h, z);
    b.add(cap, { color: BLACK });
  }
  b.cyl(0.04, 0.3, STEEL, x - 3.7, top, z, { seg: 6 });
  b.cyl(0.07, 0.2, 0xb49a52, x - 3.7, top + 0.3, z, { seg: 8 });
  for (const dz of [-0.2, 0.2]) b.cyl(0.07, 0.3, 0xb49a52, x - 1.0, top - 0.02, z + dz, { seg: 8 });
  // air pump on the right running board, its pipes
  b.cyl(0.17, 1.15, BLACK, x - 7.3, y0 + BOARD_Y + 0.06, z + 1.25, { seg: 12 });
  b.cyl(0.2, 0.12, IRON, x - 7.3, y0 + BOARD_Y + 1.2, z + 1.25, { seg: 12 });
  b.tube(x - 7.3, y0 + BOARD_Y + 0.8, z + 1.1, x - 8.2, y0 + 2.6, z + 0.82, 0.04, IRON, { seg: 5 });
  // injector and feed pipes along the left side
  b.tube(x - 0.6, y0 + 2.2, z - 1.0, x - 7.6, y0 + 2.35, z - 0.94, 0.05, IRON, { seg: 5 });
}

function boards(b, x, z, y0) {
  for (const s of [-1, 1]) {
    const zb = z + s * 1.21;
    b.box(9.3, 0.06, 0.58, BLACK, x - 5.05, y0 + BOARD_Y, zb);
    b.box(9.3, 0.18, 0.04, RED, x - 5.05, y0 + BOARD_Y - 0.14, z + s * 1.5);
    b.box(9.3, 0.03, 0.05, WHITE, x - 5.05, y0 + BOARD_Y + 0.04, z + s * 1.5);
    for (let bx = -9.4; bx < -0.6; bx += 1.5) b.box(0.06, 0.32, 0.5, BLACK, x + bx, y0 + BOARD_Y - 0.32, zb - s * 0.02, { rx: s * 0.4 });
    // steps up to the board at the front
    for (const dy of [0.5, 1.1]) b.box(0.35, 0.05, 0.3, IRON, x - 9.7, y0 + dy, z + s * 1.3);
    b.box(0.05, 1.3, 0.05, IRON, x - 9.7, y0 + 0.4, z + s * 1.45);
  }
}

function cab(b, x, z, y0, plate) {
  const x0 = x - 0.4, x1 = x + 1.9, W = 3.0, yF = y0 + BOARD_Y, yT = y0 + 4.15;
  // side sheets, front and the arched roof
  for (const s of [-1, 1]) {
    b.box(x1 - x0, yT - yF + 0.3, 0.06, BLACK, (x0 + x1) / 2, yF - 0.3, z + s * W / 2);
    // front and side windows in frames, the door opening at the back
    b.box(0.7, 0.62, 0.02, 0x2a2f33, x0 + 0.65, yF + 1.35, z + s * (W / 2 + 0.03), { mat: 'glass' });
    b.box(0.8, 0.72, 0.03, IRON, x0 + 0.65, yF + 1.3, z + s * (W / 2 + 0.025));
    b.box(0.5, 1.7, 0.03, SOOT, x1 - 0.4, yF + 0.2, z + s * (W / 2 + 0.03));
    b.box(x1 - x0 - 0.1, 0.06, 0.04, RED, (x0 + x1) / 2, yF + 0.95, z + s * (W / 2 + 0.03));
    b.box(0.04, 0.5, 0.5, 0x2a2f33, x0 - 0.02, yF + 1.35, z + s * 0.95, { mat: 'glass' });
    b.box(0.05, 0.62, 0.62, IRON, x0 - 0.01, yF + 1.29, z + s * 0.95);
    handrail(b, x1 - 0.1, y0 + 0.4, z + s * (W / 2 + 0.08), x1 - 0.1, yF + 1.5, z + s * (W / 2 + 0.08));
    for (const dy of [0.45, 1.05]) b.box(0.35, 0.05, 0.32, IRON, x1 - 0.35, y0 + dy, z + s * (W / 2 - 0.05));
    // the number on the cab side
    const g = new THREE.PlaneGeometry(1.3, 0.32);
    if (s < 0) g.rotateY(Math.PI);
    g.translate(x0 + 1.0, yF + 0.6, z + s * (W / 2 + 0.035));
    b.add(g, { mat: plate, color: 0xffffff, cast: false });
  }
  b.box(0.06, yT - yF, W, BLACK, x0, yF, z);
  b.box(x1 - x0, 0.06, W, SOOT, (x0 + x1) / 2, yF - 0.02, z);
  const sh = new THREE.Shape();
  sh.moveTo(-W / 2 - 0.1, 0);
  sh.absellipse(0, 0, W / 2 + 0.1, 0.4, Math.PI, 0, true);
  sh.lineTo(-W / 2 - 0.1, 0);
  const roof = new THREE.ExtrudeGeometry(sh, { depth: x1 - x0 + 0.4, bevelEnabled: false, curveSegments: 10 });
  roof.rotateY(Math.PI / 2);
  roof.translate(x0 - 0.2, yT, z);
  b.add(roof, { color: BLACK });
  b.cyl(0.12, 0.2, BLACK, x + 0.8, yT + 0.36, z, { seg: 8 });
}

function tenderBogie(b, x, z, y0) {
  const r = 0.525, cy = y0 + r;
  for (const dx of [-0.85, 0.85]) {
    for (const s of [-1, 1]) {
      const zi = s * (WHEEL_Z - 0.07), zo = s * (WHEEL_Z + 0.07);
      zc(b, r, z + Math.min(zi, zo), z + Math.max(zi, zo), x + dx, cy, RED, 16);
      rimRing(b, x + dx, cy, z + zo + s * 0.004, s, r - 0.07, r);
      zc(b, 0.1, z + Math.min(zo, zo + s * 0.08), z + Math.max(zo, zo + s * 0.08), x + dx, cy, IRON, 8);
    }
    zc(b, 0.08, z - 0.77, z + 0.77, x + dx, cy, IRON, 6);
  }
  for (const s of [-1, 1]) {
    // diamond frame: top and bottom bars, the spring pack in the middle
    b.box(2.9, 0.12, 0.12, RED, x, cy + 0.34, z + s * 1.0);
    b.box(1.3, 0.1, 0.1, RED, x - 0.6, cy - 0.3, z + s * 1.0, { rz: -0.15 });
    b.box(1.3, 0.1, 0.1, RED, x + 0.6, cy - 0.3, z + s * 1.0, { rz: 0.15 });
    for (const dx of [-0.85, 0.85]) b.box(0.3, 0.34, 0.2, IRON, x + dx, cy - 0.12, z + s * 1.0);
    for (const dx of [-0.15, 0.15]) b.cyl(0.08, 0.3, IRON, x + dx, cy - 0.05, z + s * 1.0, { seg: 8 });
  }
  b.box(0.5, 0.3, 2.3, RED, x, cy + 0.3, z);
}

function tender(b, x, z, y0) {
  const x0 = x + 2.05, x1 = x + 10.5, W = 3.0;
  tenderBogie(b, x + 4.1, z, y0);
  tenderBogie(b, x + 8.5, z, y0);
  // frame, the drawbar to the engine, the rear beam with lamps and coupler
  b.box(x1 - x0, 0.35, 2.6, RED, (x0 + x1) / 2, y0 + 1.0, z);
  b.box(0.4, 0.2, 0.3, IRON, x + 1.95, y0 + 1.15, z);
  b.box(0.26, 0.6, 3.0, RED, x1 + 0.1, y0 + 0.75, z);
  for (const s of [-1, 1]) {
    b.box(0.2, 0.26, 0.22, BLACK, x1 + 0.3, y0 + 1.36, z + s * 1.1);
    b.box(0.03, 0.14, 0.14, 0xd8342a, x1 + 0.41, y0 + 1.42, z + s * 1.1, { mat: 'glow' });
  }
  b.box(0.6, 0.3, 0.3, IRON, x1 + 0.45, y0 + 0.82, z);
  // water tank with the lining, the coal space with raised sides at the front
  b.box(x1 - x0, 2.1, W, BLACK, (x0 + x1) / 2, y0 + 1.35, z);
  for (const s of [-1, 1]) {
    b.box(x1 - x0 - 0.1, 0.05, 0.02, RED, (x0 + x1) / 2, y0 + 1.6, z + s * (W / 2 + 0.01));
    b.box(x1 - x0 - 0.1, 0.03, 0.02, WHITE, (x0 + x1) / 2, y0 + 3.2, z + s * (W / 2 + 0.01));
    b.box(4.2, 0.55, 0.08, BLACK, x0 + 2.1, y0 + 3.45, z + s * (W / 2 - 0.04), { rx: s * -0.25 });
    handrail(b, x0 + 0.1, y0 + 1.3, z + s * (W / 2 + 0.08), x0 + 0.1, y0 + 3.2, z + s * (W / 2 + 0.08));
    handrail(b, x1 - 0.1, y0 + 1.3, z + s * (W / 2 + 0.08), x1 - 0.1, y0 + 3.2, z + s * (W / 2 + 0.08));
    for (const dy of [0.5, 1.1]) b.box(0.3, 0.05, 0.3, IRON, x0 + 0.2, y0 + dy, z + s * (W / 2 - 0.05));
  }
  b.box(0.08, 0.55, W, BLACK, x0 + 4.2, y0 + 3.45, z);
  b.box(4.1, 0.08, W - 0.3, SOOT, x0 + 2.1, y0 + 3.4, z);
  for (const [dx, dz, w, h] of [[1.1, -0.4, 1.4, 0.45], [2.4, 0.3, 1.6, 0.55], [3.3, -0.5, 1.2, 0.35], [1.8, 0.8, 1.0, 0.3]]) {
    b.box(w, h, 1.0, 0x1b1b1c, x0 + dx, y0 + 3.44, z + dz, { ry: dz });
  }
  // water hatch, toolboxes, the rear ladder
  b.cyl(0.35, 0.18, BLACK, x1 - 1.4, y0 + 3.45, z, { seg: 14 });
  b.box(0.9, 0.35, 0.5, BLACK, x1 - 3.0, y0 + 3.45, z + 0.9);
  for (let dy = 0.5; dy < 3.3; dy += 0.35) b.box(0.04, 0.03, 0.5, IRON, x1 + 0.04, y0 + dy, z - 0.8);
}

function handrail(b, ax, ay, az, bx, by, bz) {
  b.tube(ax, ay, az, bx, by, bz, 0.02, STEEL, { seg: 4 });
}

/**
 * Build the engine and tender on the plinth rail top at height y0.
 * @returns {{ x0: number, x1: number }} extent along x, for the collider
 */
export function buildEr(b, x, z, y0) {
  const plate = cached('depot|er-plate-mat', () => cel({ map: plateTex(), grime: 0.03, dirt: 0 }));
  frames(b, x, z, y0);
  cylinders(b, x, z, y0);
  runningGear(b, x, z, y0);
  boiler(b, x, z, y0);
  boilerTop(b, x, z, y0);
  boards(b, x, z, y0);
  cab(b, x, z, y0, plate);
  tender(b, x, z, y0);
  // front number plate on the smokebox door, below the star
  const g = new THREE.PlaneGeometry(0.8, 0.2);
  g.rotateY(-Math.PI / 2);
  g.translate(x - 9.8, y0 + BOILER_Y - 0.36, z);
  b.add(g, { mat: plate, color: 0xffffff, cast: false });
  return { x0: x - 10.9, x1: x + 10.9 };
}
