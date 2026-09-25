import * as THREE from 'three';
import {
  Parts, greenhouse, bottomLine, lineAt, wheelRig, lamps, seatedFigure, GLASS, tone, lensUV,
} from '../kit.js';
import { withInside } from '../../core/batch.js';
import { addPlates, randomPlate } from '../plates.js';

/* ------------------------------------------------------------------ *
 * Generic passenger-car builder.
 *
 * A car spec is mostly numbers taken off the real car: overall size,
 * wheelbase, wheel size, a side-profile top line, the greenhouse
 * corners, and where the lamps, grille and bumpers sit. `details` adds
 * anything that makes the model itself (a Volga's chrome, a Niva's
 * wheel-arch flares) with the same Parts helpers.
 *
 * The lower body is three slabs: the front (bonnet and wings), the rear
 * (boot) and, between them, only the door skins and a floor, so the
 * cabin is hollow and the seats, the dashboard and the driver show
 * through the glass.
 * ------------------------------------------------------------------ */

export const CHROME = 0xcfd1cf;
export const BLACK = 0x232425;
export const RUBBER = 0x1b1c1d;
export const LAMP = 0xf2ecd8;
export const AMBER = 0xe0962e;
export const RED = 0xb52a22;
export const DARKRED = 0x7e1d18;
export const SEAT = 0x3a3431;
export const DASH = 0x2a2a2c;

/** Which lens texture a lamp colour gets, if any. */
const LENS_OF = new Map([[0xb52a22, 'red'], [0x7e1d18, 'smoke'], [0xe0962e, 'amber'], [0xf2ecd8, 'head'], [0xe8e2d2, 'white']]);

/**
 * Mirrored pair of rectangular lamps on a face at z, facing `face` (-1
 * front / +1 rear). Lamp colours get a painted lens on their outer face;
 * `o.lens` names one ('red', 'amber', 'white', 'head', ...) or false.
 */
export function rectLamp(P, x, y, z, w, h, color, face, depth = 0.04, o = {}) {
  const lens = o.lens === undefined ? LENS_OF.get(color) : o.lens;
  for (const s of [1, -1]) {
    P.box(w, h, depth, color, s * x, y, z + face * (depth / 2 - 0.012), o);
    if (lens) {
      P.decal(w * 0.96, h * 0.92, lensUV(lens), s * x, y, z + face * (depth - 0.012 + 0.002),
        { ry: face < 0 ? Math.PI : 0, rz: (o.rz ?? 0) * (face < 0 ? -1 : 1) * s });
    }
  }
}

/** Mirrored pair of round lamps (headlights), with a bezel ring and a ribbed lens. */
export function roundLamp(P, x, y, z, r, face = -1, { bezel = CHROME, glass = LAMP, depth = 0.05, lens = null } = {}) {
  const kind = lens ?? (glass === LAMP ? 'round' : LENS_OF.get(glass));
  for (const s of [1, -1]) {
    P.cyl(r + 0.018, depth * 0.6, bezel, s * x, y, z + face * depth * 0.2, { axis: 'z', seg: 16 });
    P.cyl(r, depth, glass, s * x, y, z + face * depth * 0.45, { axis: 'z', seg: 16 });
    if (kind) P.disc(r * 0.97, lensUV(kind), s * x, y, z + face * (depth * 0.95 + 0.002), { ry: face < 0 ? Math.PI : 0 });
  }
}

const LINER = 0x141414;

/**
 * Dark wheelhouses: a half-tube just inside each arch and an inner wall,
 * so the arches read deep and nobody sees daylight through a car.
 */
export function archLiners(P, wheels, ra, hw, depth = 0.3) {
  const tube = withInside(new THREE.CylinderGeometry(1, 1, 1, 12, 1, true, 0, Math.PI).rotateZ(Math.PI / 2));
  const wall = withInside(new THREE.CircleGeometry(1, 12, 0, Math.PI).rotateY(Math.PI / 2));
  const m = new THREE.Matrix4();
  for (const w of wheels) {
    for (const s of [1, -1]) {
      m.compose(new THREE.Vector3(s * (hw - depth / 2 - 0.012), w.r, w.z), new THREE.Quaternion(), new THREE.Vector3(depth, ra - 0.006, ra - 0.006));
      P.add(tube, LINER, m);
      m.compose(new THREE.Vector3(s * (hw - depth - 0.01), w.r, w.z), new THREE.Quaternion(), new THREE.Vector3(1, ra, ra));
      P.add(wall, LINER, m);
    }
  }
}

/** A thin shut line laid along a top polyline between z0 and z1 at +-x. */
export function topSeam(P, top, z0, z1, xs, color = 0x3a3632) {
  const pts = [[z0, lineAt(top, z0)], ...top.filter(([z]) => z > z0 + 0.01 && z < z1 - 0.01), [z1, lineAt(top, z1)]];
  for (let i = 0; i < pts.length - 1; i++) {
    const [za, ya] = pts[i], [zb, yb] = pts[i + 1];
    const len = Math.hypot(zb - za, yb - ya);
    if (len < 0.01) continue;
    for (const x of xs) P.box(0.006, 0.004, len, color, x, (ya + yb) / 2 + 0.002, (za + zb) / 2, { rx: -Math.atan2(yb - ya, zb - za) });
  }
}

/** A full-width bumper bar at z with optional rubber strip and end caps. */
export function bumper(P, z, y, h, halfW, face, { color = CHROME, depth = 0.1, strip = null, ends = null, wrap = 0.18 } = {}) {
  P.box(halfW * 2, h, depth, color, 0, y, z + face * depth * 0.3);
  // wrap-around ends
  for (const s of [1, -1]) P.box(0.06, h, wrap, ends ?? color, s * (halfW - 0.03), y, z - face * (wrap / 2 - depth * 0.6));
  if (strip) P.box(halfW * 2 - 0.1, h * 0.35, depth * 0.3, strip, 0, y, z + face * depth * 0.75);
}

/*
 * While a car's details are built, the side of its body is known as a
 * function x(z, y), so seams and handles can lie on the rounded shoulder
 * instead of standing off it. Other builders leave it null.
 */
let surface = null;

/** Half width of the body side at (z, y), or `hw` outside buildCar. */
export function sideX(hw, z, y) {
  return surface ? surface(z, y) : hw;
}

/** Door seam lines and handles on both sides. */
export function doorLines(P, hw, seams, ySill, yBelt, handles = [], color = 0x2a2a2a) {
  const N = 4;
  for (const s of [1, -1]) {
    for (const z of seams) {
      for (let i = 0; i < N; i++) {
        const ya = ySill + ((yBelt - 0.04 - ySill) * i) / N, yb = ySill + ((yBelt - 0.04 - ySill) * (i + 1)) / N;
        P.tube([s * (sideX(hw, z, ya) + 0.002), ya, z], [s * (sideX(hw, z, yb) + 0.002), yb, z], 0.004, color, { seg: 3 });
      }
    }
    for (const [z, y] of handles) P.box(0.02, 0.03, 0.12, CHROME, s * (sideX(hw, z, y) + 0.008), y, z);
  }
}

/** Door mirror on a stalk near the A-pillar base. */
export function mirrors(P, hw, z, y, color = BLACK, both = true) {
  const x = sideX(hw, z, y);
  for (const s of both ? [1, -1] : [-1]) {
    P.box(0.08, 0.03, 0.05, color, s * (x + 0.03), y, z);
    P.box(0.06, 0.1, 0.13, color, s * (x + 0.1), y + 0.05, z + 0.02);
    P.box(0.005, 0.08, 0.1, 0x9fb1bd, s * (x + 0.1), y + 0.05, z + 0.087);
  }
}

/**
 * Build a car from a spec.
 * @param {object} s  spec (see models/cars.js for examples)
 * @param {object} o  { color, seed, plate, parked, player }
 * @returns {object} VehicleModel
 */
export function buildCar(s, o = {}) {
  const color = o.color ?? s.defaultColor ?? 0xe8e4d8;
  const group = new THREE.Group();
  const P = new Parts();
  const L = s.L, W = s.W, hw = W / 2;
  const zF = -L / 2, zR = L / 2;
  const wf = -s.wb / 2 + (s.axleShift ?? 0), wr = s.wb / 2 + (s.axleShift ?? 0);
  const r = s.r;
  const sill = s.sill ?? r * 0.75;
  const bottom = bottomLine(zF, zR, s.noseY ?? sill + 0.08, s.tailY ?? sill + 0.1, sill,
    [{ z: wf, r }, { z: wr, r }], s.archGap ?? 0.05);
  const top = s.top;
  const [cab0, cab1] = s.cabin;
  const zone = s.taperZone ?? 0.32;
  const tc = s.taper ?? 0.05;
  const taper = (z) => {
    const d = Math.max(0, Math.abs(z) - (L / 2 - zone)) / zone;
    return 1 - tc * d * d;
  };
  const lower = s.lowerColor ?? color;

  // The body in section: widest at a shoulder crease a hand below the
  // top line, rounding in above it and tucking under toward the sills.
  const drop = s.shoulderDrop ?? 0.1;
  const crown = s.crown ?? 0.045;
  const tuck = s.tuck ?? 0.022;
  const shoulder = top.map(([z, y]) => [z, Math.max(lineAt(bottom, z) + 0.03, y - drop)]);
  const upper = (z, y) => {
    const t = lineAt(top, z), sh = lineAt(shoulder, z);
    return 1 - crown * Math.max(0, Math.min(1, (y - sh) / Math.max(t - sh, 1e-3)));
  };
  const under = (z, y) => {
    const b = lineAt(bottom, z), sh = lineAt(shoulder, z);
    return 1 - tuck * Math.max(0, Math.min(1, (sh - y) / Math.max(sh - b, 1e-3)));
  };
  const body = (z0, z1, x0, x1, plan) => {
    P.slab(top, shoulder, z0, z1, x0, x1, lower, { taper: (z, y) => (plan ? taper(z) : 1) * upper(z, y) });
    P.slab(shoulder, bottom, z0, z1, x0, x1, lower, { taper: (z, y) => (plan ? taper(z) : 1) * under(z, y) });
  };

  // front, rear, and the hollow door section
  body(zF, cab0, -hw, hw, true);
  body(cab1, zR, -hw, hw, true);
  const skin = 0.055;
  body(cab0, cab1, hw - skin, hw, false);
  body(cab0, cab1, -hw, -hw + skin, false);
  archLiners(P, [{ z: wf, r }, { z: wr, r }], r + (s.archGap ?? 0.05), hw * (1 - tuck * 0.5));
  // bonnet and boot shut lines
  const topW = hw * (1 - crown);
  if (s.seams !== false) {
    topSeam(P, top, zF + 0.1, cab0 - 0.07, [topW - 0.07, -topW + 0.07]);
    if (cab1 < zR - 0.35) topSeam(P, top, cab1 + 0.07, zR - 0.06, [topW - 0.08, -topW + 0.08]);
  }
  const belt = lineAt(top, (cab0 + cab1) / 2);
  const floorY = sill + 0.02;
  P.span(-hw + skin, sill - 0.02, cab0, hw - skin, floorY + 0.04, cab1, 0x262626);
  // door trims inside, a shade darker than the seats
  for (const sg of [1, -1]) P.span(sg * (hw - skin), floorY + 0.1, cab0 + 0.05, sg * (hw - skin - 0.03), belt - 0.02, cab1 - 0.05, s.trim ?? 0x4a4440);

  // greenhouse
  // the greenhouse stands on the rounded-in shoulder, not proud of it
  const hwBelt = Math.min(s.gh.hwBelt, topW - 0.004);
  const ghSpec = { ...s.gh, hwBelt, hwRoof: s.gh.hwRoof - (s.gh.hwBelt - hwBelt) * 0.6, glass: s.glass ?? GLASS.clear };
  const gh = greenhouse(P, ghSpec, s.gh.color ?? color);

  // interior: dashboard, seats, wheel, parcel shelf. In the player's car
  // these simple ones go with the driver figure, hidden from the seat view
  const IP = o.player ? new Parts() : P;
  const dashZ = cab0 + 0.02;
  IP.span(-hw + skin, belt - 0.24, dashZ, hw - skin, belt + 0.04, dashZ + (s.dashDepth ?? 0.36), DASH);
  const hipF = s.hipFront ?? cab0 + 0.98;
  const hipR = s.hipRear ?? cab1 - 0.32;
  const seatY = floorY + 0.28;
  for (const x of [-0.36, 0.36]) {
    IP.span(x - 0.23, floorY + 0.04, hipF - 0.26, x + 0.23, seatY, hipF + 0.24, SEAT);
    IP.box(0.46, 0.6, 0.12, SEAT, x, seatY + 0.3, hipF + 0.26, { rx: 0.16 });
    IP.box(0.26, 0.14, 0.1, SEAT, x, seatY + 0.66, hipF + 0.33, { rx: 0.16 });
  }
  if (hipR > hipF + 0.6) {
    P.span(-hw + skin + 0.05, floorY + 0.04, hipR - 0.28, hw - skin - 0.05, seatY - 0.02, hipR + 0.2, SEAT);
    P.span(-hw + skin + 0.05, seatY - 0.02, hipR + 0.18, hw - skin - 0.05, seatY + 0.5, hipR + 0.32, SEAT);
  }
  // steering wheel
  const swZ = dashZ + (s.dashDepth ?? 0.36) + 0.06;
  const swY = belt + 0.06;
  const ring = new THREE.TorusGeometry(0.19, 0.022, 5, 14);
  IP.add(ring, 0x1d1d1d, new THREE.Matrix4().compose(new THREE.Vector3(-0.36, swY, swZ),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.45, 0, 0)), new THREE.Vector3(1, 1, 1)));
  IP.box(0.05, 0.05, 0.22, 0x1d1d1d, -0.36, swY - 0.05, swZ - 0.1, { rx: 0.6 });

  // the driver, unless the car is parked or it is yours
  let driverGroup = null;
  const seed = o.seed ?? 1;
  if (!o.parked && !o.player) {
    seatedFigure(P, -0.36, seatY, hipF, seed, { wheel: true });
    if (seed % 3 === 0) seatedFigure(P, 0.36, seatY, hipF, seed + 5);
  }

  // plates
  const plate = o.plate ?? randomPlate(seed, { company: s.company });
  addPlates(P, plate, s.plateFront ? { y: s.plateFront.y, z: s.plateFront.z ?? zF } : null,
    s.plateRear ? { y: s.plateRear.y, z: s.plateRear.z ?? zR } : null, { tiltRear: s.plateRear?.tilt ?? 0 });

  surface = (z, y) => hw * (y > lineAt(shoulder, z) ? upper(z, y) : under(z, y)) * (z < cab0 || z > cab1 ? taper(z) : 1);
  if (s.details) s.details(P, { color, hw, zF, zR, wf, wr, r, sill, top, bottom, belt, gh, seed, o, lineAt: (z) => lineAt(top, z) });

  surface = null;
  const meshes = P.flush(group);
  if (meshes.body) meshes.body.castShadow = true;

  // wheels
  const rig = wheelRig(group, {
    r, w: s.tyreW ?? 0.17, track: s.track ?? W - 0.26, zFront: wf, zRear: wr,
    rim: s.rim ?? 0xbdbbb4, hub: s.hub ?? 0xdddbd4, style: s.wheelStyle ?? 'cap',
  });

  const lm = lamps(group, { ...s.lamps, zFront: s.lamps?.zFront ?? zF, zRear: s.lamps?.zRear ?? zR });

  // the player's own car shows a driver from outside and hides them from the seat
  if (o.player) {
    seatedFigure(IP, -0.36, seatY, hipF, 11, { wheel: true });
    driverGroup = new THREE.Group();
    driverGroup.name = 'driver';
    IP.flush(driverGroup);
    group.add(driverGroup);
  }

  const model = {
    group, type: s.id, kind: s.kind ?? 'car',
    length: L, width: W, height: s.H, wheelbase: s.wb, wheelRadius: r,
    wheels: rig.wheels, steer: rig.steer,
    brake: lm.brake, blink: lm.blink,
    doors: [], doorPos: [],
    driverEye: { x: -0.36, y: seatY + (s.eyeUp ?? 0.74), z: hipF + 0.12 },
    seats: [], engine: s.engine ?? 'petrol', routeBoard: null,
    plate, seed,
    driverGroup,
    anchors: { belt, seatY, hipF, dashZ, swZ, swY, floorY, hw, skin, cab0, cab1, ghXAt: gh.xAt },
  };
  if (o.player && s.interior) attachInterior(model, s.interior(model, model.anchors, s.gh));
  return model;
}

/**
 * Hang the detailed cockpit on the model. The driving code toggles
 * `interior.visible` for the seat camera; the simple interior and the
 * driver figure swap the other way, so they never overlap.
 */
function attachInterior(model, interior) {
  let shown = false;
  Object.defineProperty(interior, 'visible', {
    get: () => shown,
    set: (v) => {
      shown = !!v;
      if (model.driverGroup) model.driverGroup.visible = !shown;
    },
    configurable: true,
  });
  model.group.add(interior);
  model.interior = interior;
}

export { tone };
