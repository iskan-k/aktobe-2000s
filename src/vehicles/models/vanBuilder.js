import * as THREE from 'three';
import {
  Parts, bottomLine, lineAt, wheelRig, lamps, seatedFigure, signCards, fitText, GLASS, tone,
} from '../kit.js';
import { addPlates, randomPlate } from '../plates.js';
import { CHROME, BLACK, DASH, archLiners } from './carBuilder.js';
import { paintCard, kazVia } from './busBuilder.js';

/* ------------------------------------------------------------------ *
 * Forward-control and short-nose vans: the GAZelle marshrutka, the
 * Sprinter, and the cabs of light trucks.
 *
 * The body is hollow like a bus: a solid nose (bonnet and grille), then
 * side skins up to the belt, a band of pillars and glass, an upper band
 * and a roof. A passenger van (`saloon`) is glazed along its length and
 * has a sliding door on the kerb side; a truck cab (`cabEnd`) stops
 * behind the seats and a load body is added by `s.load`.
 *
 * Spec numbers are metres in the local frame (front at -z):
 *   L, W, r, zFront, zRear[]   size and axles
 *   nose  [[z, y], ...]        top line of the nose, last point [zWs0, belt]
 *   screen [zWs0, zWs1]        windscreen base and top (z); top y = winTop
 *   belt, winTop, roofY, floorY, skirt
 *   cabB                       z of the B pillar (end of the cab door)
 *   saloon { pillars[], door:[z0, z1], pitch, fill, bench }
 * ------------------------------------------------------------------ */

const FLOOR = 0x3a3a39;
const CEIL = 0xd9d4c4;
const WALL_IN = 0xc4bca8;
const POLE = 0xcfcbc0;
const T = 0.045;                 // skin thickness

export function buildVan(s, o = {}) {
  const group = new THREE.Group();
  const P = new Parts();
  const c = frame(s, o);
  shell(P, s, c);
  cab(P, s, c, o);
  const inside = c.saloon ? saloon(P, s, c, o) : { seatEyes: [], standEyes: [] };
  if (s.load) s.load(P, c);
  const plate = o.plate ?? randomPlate(o.seed ?? 1, { company: s.company ?? true });
  addPlates(P, plate, s.plateFront ?? { y: c.skirt + 0.18, z: c.zF - 0.08 }, s.plateRear ?? { y: c.skirt + 0.25, z: c.zR + 0.012 });
  for (const f of [s.front, s.rear, s.details]) if (f) f(P, c);
  const meshes = P.flush(group);
  if (meshes.body) meshes.body.castShadow = true;

  const doors = c.saloon ? [slidingDoor(group, s, c)] : [];
  const rig = wheelRig(group, {
    r: s.r, w: s.tyreW ?? 0.2, track: s.track ?? c.W - 0.3, zFront: s.zFront, zRear: s.zRear,
    rim: s.rim ?? 0xd6d3ca, hub: s.hub ?? 0x8a8a86, style: 'steel', dual: !!s.dual,
  });
  const lm = lamps(group, { zFront: c.zF - (s.lampFrontOut ?? 0), zRear: c.zR + (s.lampRearOut ?? 0), ...s.lamps });
  const board = c.saloon ? routeCards(group, s, c, o) : null;

  const seats = [...inside.seatEyes, ...inside.standEyes];
  return {
    group, type: s.id, kind: s.kind ?? 'marshrutka',
    length: c.L, width: s.Wmax ?? c.W, height: s.H ?? s.roofY + 0.02,
    wheelbase: s.zRear[s.zRear.length - 1] - s.zFront, wheelRadius: s.r,
    wheels: rig.wheels, steer: rig.steer, brake: lm.brake, blink: lm.blink,
    doors,
    doorPos: c.saloon ? [{ x: c.hw + 0.7, z: (c.door[0] + c.door[1]) / 2 }] : [],
    driverEye: { x: c.dx, y: c.floorY + (s.eyeUp ?? 1.12), z: c.dz + 0.06 },
    seats: seats.length ? seats : [{ x: 0.35, y: c.floorY + 1.2, z: c.dz, yaw: 0 }],
    engine: s.engine ?? 'petrol',
    routeBoard: board, plate, seed: o.seed ?? 1,
  };
}

/** Shared numbers every part below needs. */
function frame(s, o) {
  const L = s.L, W = s.W, hw = W / 2;
  const zF = -L / 2, zR = L / 2;
  const zEnd = s.cabEnd ?? zR;
  const skirt = s.skirt ?? 0.4;
  const wheelsZ = [s.zFront, ...s.zRear];
  const arches = wheelsZ.filter((z) => z < zEnd).map((z) => ({ z, r: s.r }));
  const bottom = bottomLine(zF, zEnd, s.noseBottom ?? skirt, skirt, skirt, arches, 0.06);
  const [zWs0, zWs1] = s.screen;
  const aLine = (y) => zWs0 + ((y - s.belt) / (s.winTop - s.belt)) * (zWs1 - zWs0);
  const dz = zWs0 + (s.driverZ ?? 0.9);
  const zB = zWs1 + (s.browSlope ?? 0.12);
  return {
    s, L, W, hw, zF, zR, zEnd, skirt, bottom, zWs0, zWs1, zB, aLine,
    belt: s.belt, winTop: s.winTop, roofY: s.roofY, floorY: s.floorY,
    body: o.color ?? s.color, pillar: s.pillarColor ?? BLACK,
    glass: s.glass ?? GLASS.bus, dx: -hw + (s.driverX ?? 0.5), dz,
    saloon: !s.cabEnd && s.saloon ? s.saloon : null,
    door: s.saloon?.door ?? [0, 0],
    seed: o.seed ?? 1,
  };
}

/* ---------------- outer shell ---------------- */

function shell(P, s, c) {
  const { hw, zF, zEnd, belt, winTop, roofY, body, bottom, zWs0, zWs1 } = c;
  // nose: bonnet, wings and the front face, rounded a little in plan
  const round = s.noseRound ?? 0.06;
  const taper = (z, y) => {
    const f = Math.max(0, 1 - (z - zF) / 0.45);
    const edge = Math.max(0, Math.min(1, (y - lineAt(s.nose, z) + 0.12) / 0.12));
    return 1 - round * f * f - 0.025 * edge;
  };
  if (s.bonnet) bonnet(P, s, c, taper);
  else P.slab(s.nose, bottom, zF, zWs0 + 0.03, -hw, hw, body, { taper });
  // side skins from the nose back, the kerb side broken by the sliding door
  const door = c.saloon ? c.door : null;
  for (const sgn of [-1, 1]) {
    const cut = sgn > 0 && door ? [[zWs0, door[0]], [door[1], zEnd - 0.01]] : [[zWs0, zEnd - 0.01]];
    for (const [z0, z1] of cut) skin(P, c, sgn, z0, z1, s.stripes ?? []);
  }
  windowBand(P, s, c);
  archLiners(P, [s.zFront, ...s.zRear].filter((z) => z < zEnd).map((z) => ({ z, r: s.r })), s.r + 0.06, hw - T, s.cabEnd ? 0.36 : 0.3);
  // upper band, roof with rounded edges, brow over the windscreen
  const upper = s.upperColor ?? body;
  const roofC = s.roofColor ?? body;
  const rr = s.roofRound ?? 0.07;
  // the brow over the windscreen slopes back to the roof (a lot on a high roof)
  const zB = c.zB;
  const browTop = [[zWs1, winTop + 0.02], [zB, roofY - rr], [zEnd, roofY - rr]];
  for (const sgn of [1, -1]) {
    P.slab(browTop, [[zWs1, winTop], [zEnd, winTop]], zWs1, zEnd - 0.01, sgn > 0 ? hw - T : -hw, sgn > 0 ? hw : -hw + T, upper);
    P.box(rr * 1.41, rr * 1.41, zEnd - zB + 0.02, roofC, sgn * (hw - rr), roofY - rr, (zB + zEnd) / 2, { rz: Math.PI / 4 });
  }
  P.span(-hw + rr * 0.6, roofY - 0.06, zB - 0.02, hw - rr * 0.6, roofY, zEnd - 0.01, roofC);
  P.slab([[zWs1 - 0.04, winTop + 0.03], [zB, roofY + 0.001]], [[zWs1 - 0.04, winTop - 0.03], [zB, roofY - 0.07]], zWs1 - 0.04, zB, -hw + 0.02, hw - 0.02, s.browColor ?? upper);
  // windscreen, one pane, with the rubber surround and wipers
  const half = hw - 0.09;
  P.quad([-half, belt + 0.02, zWs0 + 0.02], [half, belt + 0.02, zWs0 + 0.02], [half, winTop, zWs1], [-half, winTop, zWs1], c.glass, { glass: true });
  const rake = Math.atan2(zWs1 - zWs0, winTop - belt);
  P.box(half * 2, 0.035, 0.03, BLACK, 0, winTop + 0.005, zWs1, {});
  for (const x of [-0.35, 0.3]) P.box(0.55, 0.015, 0.02, BLACK, x, belt + 0.07, zWs0 + 0.02, { rz: 0.28, rx: -rake * 0.1 });
  if (s.cabEnd) cabBack(P, c); else rearEnd(P, s, c);
  mirrorArms(P, c, s.mirrorY ?? belt + 0.05);
}

/**
 * A bonneted truck's front: a narrow bonnet between wide wings, and the
 * cowl across the front of the cab above the wings.
 */
function bonnet(P, s, c, taper) {
  const { hw, zF, zWs0, belt, body, bottom } = c;
  const b = s.bonnet;
  const flat = [[zF, s.noseBottom ?? c.skirt], [zWs0 + 0.03, s.noseBottom ?? c.skirt]];
  P.slab(s.nose, flat, zF, zWs0 + 0.03, -b.hw, b.hw, body, { taper });
  const round = (z) => 1 - 0.08 * Math.max(0, 1 - (z - zF - (b.wingFront ?? 0)) / 0.5) ** 2;
  P.slab(b.wing, bottom, zF + (b.wingFront ?? 0), zWs0 + 0.03, -hw, hw, b.wingColor ?? body, { taper: round });
  P.span(-hw, lineAt(b.wing, zWs0) - 0.02, zWs0, hw, belt, zWs0 + T, body);
}

/** One side's lower skin from the bottom line up to the belt, with stripes. */
function skin(P, c, sgn, z0, z1, stripes) {
  const { hw, zF, zR, belt, bottom, body } = c;
  if (z1 - z0 < 0.02) return;
  const x0 = sgn > 0 ? hw - T : -hw, x1 = sgn > 0 ? hw : -hw + T;
  P.slab([[zF, belt], [zR, belt]], bottom, z0, z1, x0, x1, body);
  for (const st of stripes) {
    const bot = bottom.map(([z, y]) => [z, Math.min(st.y1 - 0.001, Math.max(y, st.y0))]);
    const xs0 = sgn > 0 ? hw : -hw - 0.004, xs1 = sgn > 0 ? hw + 0.004 : -hw;
    P.slab([[zF, st.y1], [zR, st.y1]], bot, z0, z1, xs0, xs1, st.color);
  }
}

/** Pillars and glass between the belt and the window tops, both sides. */
function windowBand(P, s, c) {
  const { hw, belt, winTop, zEnd, pillar, glass, aLine, body } = c;
  const pw = s.pillarW ?? 0.08;
  const pillars = c.saloon?.pillars ?? s.pillars ?? [s.cabB];
  const glazed = !!c.saloon || !!s.glazed;
  const inDoor = (z0, z1) => c.saloon && z1 > c.door[0] + 0.01 && z0 < c.door[1] - 0.01;
  for (const sgn of [1, -1]) {
    const xo = sgn * (hw - T / 2);
    const gx = sgn * (hw - T * 0.6);
    // A pillar along the windscreen edge
    P.tube([sgn * (hw - 0.05), belt, c.zWs0 + 0.03], [sgn * (hw - 0.05), winTop, c.zWs1 + 0.03], 0.05, s.aPillarColor ?? body, { seg: 6 });
    // cab door window: its front edge follows the A pillar
    const b0 = pillars[0] - pw / 2;
    P.quad([gx, belt + 0.02, aLine(belt) + 0.07], [gx, belt + 0.02, b0], [gx, winTop - 0.02, b0], [gx, winTop - 0.02, aLine(winTop) + 0.07], glass, { glass: true });
    for (let i = 0; i < pillars.length; i++) {
      const z = pillars[i];
      if (!(sgn > 0 && inDoor(z - pw, z + pw))) P.box(T + 0.006, winTop - belt, pw, pillar, xo, (belt + winTop) / 2, z);
      const za = z + pw / 2, zb = i < pillars.length - 1 ? pillars[i + 1] - pw / 2 : null;
      if (zb === null || (sgn > 0 && inDoor(za, zb))) continue;
      if (glazed) {
        P.quad([gx, belt + 0.02, za], [gx, belt + 0.02, zb], [gx, winTop - 0.02, zb], [gx, winTop - 0.02, za], glass, { glass: true });
        P.box(0.012, 0.025, zb - za, pillar, sgn * (hw + 0.002), winTop - (winTop - belt) * 0.35, (za + zb) / 2);
      } else P.span(sgn * (hw - T), belt, za, sgn * hw, winTop, zb, body);
    }
    // behind the last pillar: a closed corner (or the whole side of a panel van)
    const last = pillars[pillars.length - 1] + pw / 2;
    if (zEnd - last > 0.02) P.span(sgn * (hw - T), belt, last, sgn * hw, winTop, zEnd - 0.01, s.upperColor ?? body);
    P.box(T + 0.012, 0.03, zEnd - c.zWs0 - 0.2, 0x2a2a2a, xo, belt + 0.012, (c.zWs0 + 0.2 + zEnd) / 2);
    if (glazed) P.box(T + 0.012, 0.026, zEnd - c.zWs0 - 0.3, 0x2a2a2a, xo, winTop - 0.008, (c.zWs0 + 0.3 + zEnd) / 2);
  }
}

/** Big van mirrors on bent arms from the A-pillar base. */
function mirrorArms(P, c, y) {
  for (const sgn of [1, -1]) {
    const a = [sgn * (c.hw - 0.02), y, c.zWs0 + 0.12];
    const b = [sgn * (c.hw + 0.2), y + 0.12, c.zWs0 + 0.05];
    P.tube(a, b, 0.014, BLACK);
    P.box(0.05, 0.3, 0.16, BLACK, sgn * (c.hw + 0.23), y + 0.2, c.zWs0 + 0.05);
    P.box(0.006, 0.26, 0.13, 0x8fa3b0, sgn * (c.hw + 0.23), y + 0.2, c.zWs0 + 0.135);
  }
}

/** The back of a truck cab: a wall with a small window. */
function cabBack(P, c) {
  const { hw, skirt, zEnd, roofY, belt, body } = c;
  P.span(-hw, skirt, zEnd - T, hw, belt + 0.05, zEnd, body);
  P.span(-hw, belt + 0.45, zEnd - T, hw, roofY, zEnd, body);
  for (const sgn of [1, -1]) P.span(sgn * hw, belt + 0.05, zEnd - T, sgn * 0.45, belt + 0.45, zEnd, body);
  P.quad([-0.45, belt + 0.05, zEnd - 0.02], [0.45, belt + 0.05, zEnd - 0.02], [0.45, belt + 0.45, zEnd - 0.02], [-0.45, belt + 0.45, zEnd - 0.02], c.glass, { glass: true });
}

/** Rear of a passenger van: split doors with windows, bumper, handles. */
function rearEnd(P, s, c) {
  const { hw, skirt, zR, roofY, winTop, glass } = c;
  const rearC = s.rearColor ?? c.body;
  const rw = s.rearWindow ?? [winTop - 0.5, winTop - 0.04];
  P.span(-hw, skirt, zR - T, hw, rw[0], zR, rearC);
  P.span(-hw, rw[1], zR - T, hw, roofY - 0.03, zR, rearC);
  for (const sgn of [1, -1]) P.span(sgn * hw, rw[0], zR - T, sgn * (hw - 0.14), rw[1], zR, rearC);
  P.span(-0.05, rw[0], zR - T, 0.05, rw[1], zR, rearC);
  for (const sgn of [1, -1]) {
    const x0 = sgn * 0.06, x1 = sgn * (hw - 0.15);
    P.quad([x0, rw[0], zR - 0.02], [x1, rw[0], zR - 0.02], [x1, rw[1], zR - 0.02], [x0, rw[1], zR - 0.02], glass, { glass: true });
  }
  P.box(0.012, rw[0] - skirt - 0.05, 0.008, 0x2a2a2a, 0, (rw[0] + skirt) / 2, zR + 0.002);
  P.box(0.03, 0.05, 0.16, CHROME, 0.14, rw[0] - 0.2, zR + 0.015, { ry: Math.PI / 2 });
  P.span(-hw + 0.02, skirt - 0.08, zR - 0.04, hw - 0.02, skirt + 0.12, zR + 0.08, s.bumperColor ?? 0x2b2b2b);
  P.span(-0.3, skirt + 0.12, zR - 0.02, 0.3, skirt + 0.16, zR + 0.18, 0x3a3a3a);   // the step
}

/* ---------------- cab interior ---------------- */

function cab(P, s, c, o) {
  const { hw, zWs0, belt, floorY, skirt, zEnd, dx, dz } = c;
  P.span(-hw + T, skirt, zWs0, hw - T, floorY, zEnd - T, FLOOR);
  P.span(-hw + T, floorY, zWs0, hw - T, belt - 0.26, zWs0 + 0.06, 0x2a2a2a);
  P.span(-hw + T, belt - 0.26, zWs0, hw - T, belt + 0.02, zWs0 + 0.34, DASH);
  P.span(dx - 0.2, belt - 0.02, zWs0 + 0.28, dx + 0.2, belt + 0.1, zWs0 + 0.36, 0x1f1f20);   // binnacle
  const ring = new THREE.TorusGeometry(0.2, 0.022, 5, 16);
  P.add(ring, 0x1c1c1c, new THREE.Matrix4().compose(new THREE.Vector3(dx, belt - 0.02, zWs0 + 0.52),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(-1.05, 0, 0)), new THREE.Vector3(1, 1, 1)));
  P.tube([dx, belt - 0.2, zWs0 + 0.3], [dx, belt - 0.05, zWs0 + 0.48], 0.03, 0x1c1c1c);
  // driver seat, and a double passenger seat beside it
  const seatC = s.cabSeat ?? 0x3a3d44;
  const hip = floorY + 0.44;
  P.span(dx - 0.24, floorY, dz - 0.22, dx + 0.24, hip, dz + 0.22, seatC);
  P.box(0.48, 0.66, 0.1, seatC, dx, hip + 0.33, dz + 0.27, { rx: 0.14 });
  P.span(0.05, floorY, dz - 0.22, hw - T - 0.02, hip, dz + 0.22, seatC);
  P.box(hw - 0.1, 0.62, 0.1, seatC, (hw + 0.02) / 2, hip + 0.31, dz + 0.27, { rx: 0.14 });
  if (!o.parked) {
    seatedFigure(P, dx, hip, dz, (o.seed ?? 1) + 5, { wheel: true });
    if ((o.seed ?? 1) % 3 === 0) seatedFigure(P, hw - 0.42, hip, dz, (o.seed ?? 1) + 8);
  }
  // inside the cab: door cards and the headliner
  for (const sgn of [1, -1]) P.span(sgn * (hw - T), floorY, zWs0 + 0.3, sgn * (hw - T - 0.012), belt, s.cabB, WALL_IN);
  P.span(-hw + T, c.roofY - 0.08, c.zB, hw - T, c.roofY - 0.05, zEnd - T, CEIL);
  // a fringe along the top of the windscreen and a dash mat: the driver's own touch
  if (s.fringe !== false) {
    P.box(hw * 1.7, 0.03, 0.02, s.fringe ?? 0x8a2430, 0, c.winTop - 0.02, c.zWs1 + 0.03);
    P.box(hw * 1.7, 0.01, 0.022, 0xd9b44a, 0, c.winTop - 0.036, c.zWs1 + 0.028);
  }
  P.span(-0.1, belt + 0.02, zWs0 + 0.04, hw - 0.2, belt + 0.03, zWs0 + 0.3, 0x5a2a2e);
}

/* ---------------- saloon ---------------- */

function saloon(P, s, c, o) {
  const { hw, zR, floorY, roofY, door, saloon: sl } = c;
  const rng = mulberry((o.seed ?? 1) * 131 + 7);
  const seatEyes = [], standEyes = [];
  const add = (x, z, yaw = 0) => {
    seat(P, x, floorY, z, s.seatColor ?? 0x4d5566, yaw);
    if (!o.parked && rng() < (sl.fill ?? 0.35)) {
      seatedFigure(yaw ? turned(P, x, z) : P, x, floorY + 0.42, z - 0.05, Math.floor(rng() * 1000), { scarf: rng() < 0.4 });
    } else seatEyes.push({ x, y: floorY + 1.2, z: z - (yaw ? -0.02 : 0.02), yaw });
  };
  const z0 = s.cabB + 0.42, bench = zR - 0.42;
  for (let z = z0 + (sl.facing !== false ? 0.75 : 0); z < bench - 0.55; z += sl.pitch ?? 0.74) {
    for (const k of [0, 1]) add(-hw + 0.3 + k * 0.44, z);
    if (z > door[1] + 0.12) add(hw - 0.3, z);
  }
  // the back bench across the full width
  const n = sl.bench ?? 4;
  for (let k = 0; k < n; k++) add(-hw + 0.3 + (k * (c.W - 0.6)) / (n - 1), bench);
  // one pair behind the driver faces backward, as in a real GAZelle
  // (added last, so a rider is offered a forward seat first)
  if (sl.facing !== false) for (const k of [0, 1]) add(-hw + 0.3 + k * 0.44, z0, Math.PI);
  // wheel housings, wall trim, grab rails, the pole by the door
  for (const z of c.s.zRear) for (const sgn of [1, -1]) P.span(sgn * (hw - T), floorY, z - c.s.r - 0.08, sgn * (hw - T - 0.26), c.s.r * 2 + 0.14, z + c.s.r + 0.08, WALL_IN);
  for (const sgn of [1, -1]) {
    P.span(sgn * (hw - T), floorY, c.s.cabB, sgn * (hw - T - 0.012), c.belt, zR - T, WALL_IN);
    P.cyl(0.014, zR - c.s.cabB - 0.4, POLE, sgn * (hw - 0.32), roofY - 0.22, (c.s.cabB + zR) / 2, { axis: 'z', seg: 5 });
  }
  P.cyl(0.018, roofY - floorY, POLE, hw - 0.28, (floorY + roofY) / 2, door[1] + 0.06, { seg: 6 });
  P.span(hw - 0.55, c.skirt + 0.02, door[0] + 0.04, hw - T, floorY - 0.2, door[1] - 0.04, FLOOR);   // the step well
  curtains(P, c);
  if (roofY - floorY > 1.75) standEyes.push({ x: 0.1, y: floorY + 1.62, z: (door[0] + door[1]) / 2 + 0.3, yaw: -Math.PI / 2 });
  return { seatEyes, standEyes };
}

/** A van seat facing -z (or backward with yaw = PI). */
function seat(P, x, y, z, color, yaw = 0) {
  const b = yaw ? -1 : 1;
  P.span(x - 0.2, y, z - 0.18, x + 0.2, y + 0.4, z + 0.18, 0x3a3a3a);
  P.span(x - 0.21, y + 0.34, z - 0.21, x + 0.21, y + 0.44, z + 0.19, color);
  P.box(0.42, 0.56, 0.08, color, x, y + 0.72, z + b * 0.2, { rx: b * 0.12 });
  P.box(0.3, 0.1, 0.085, tone(color, 0.8), x, y + 1.03, z + b * 0.23, { rx: b * 0.12 });   // head rest
}

/** A Parts stand-in that turns what is drawn half a circle about (x, z). */
function turned(P, x, z) {
  const flip = (o = {}) => ({ ...o, ry: (o.ry ?? 0) + Math.PI });
  return {
    box: (w, h, d, color, px, py, pz, o) => P.box(w, h, d, color, 2 * x - px, py, 2 * z - pz, flip(o)),
    blob: (rx, ry, rz, color, px, py, pz, o) => P.blob(rx, ry, rz, color, 2 * x - px, py, 2 * z - pz, flip(o)),
  };
}

/** Gathered curtains at the saloon pillars, as most marshrutkas had. */
function curtains(P, c) {
  const col = c.s.curtain ?? 0x6a2f3a;
  for (const sgn of [1, -1]) {
    for (const z of c.saloon.pillars.slice(1)) {
      if (sgn > 0 && z > c.door[0] - 0.05 && z < c.door[1] + 0.05) continue;
      P.box(0.05, c.winTop - c.belt - 0.12, 0.1, col, sgn * (c.hw - 0.09), (c.winTop + c.belt) / 2 + 0.04, z + 0.07);
    }
    P.box(0.02, 0.02, c.zR - c.s.cabB, 0x9a9a96, sgn * (c.hw - 0.08), c.winTop - 0.03, (c.zR + c.s.cabB) / 2);
  }
}

/* ---------------- sliding door ---------------- */

function slidingDoor(group, s, c) {
  const [z0, z1] = c.door;
  const w = z1 - z0;
  const { skirt, belt, winTop, body, pillar } = c;
  const P = new Parts();
  // authored with its front edge at z = 0 and its outer face at x = 0
  P.span(-T, skirt + 0.03, 0.01, 0, belt, w - 0.01, body);
  P.span(-T, winTop - 0.04, 0.01, 0, winTop + 0.02, w - 0.01, pillar);
  for (const [a, b] of [[0.01, 0.08], [w - 0.08, w - 0.01]]) P.span(-T, belt, a, 0, winTop, b, pillar);
  P.quad([-0.02, belt, 0.08], [-0.02, belt, w - 0.08], [-0.02, winTop, w - 0.08], [-0.02, winTop, 0.08], c.glass, { glass: true });
  P.box(0.03, 0.05, 0.2, CHROME, 0.012, belt - 0.14, 0.22);
  P.box(0.008, belt - skirt - 0.06, 0.012, 0x2a2a2a, 0.002, (belt + skirt) / 2, 0.012);
  for (const st of s.stripes ?? []) P.span(0, st.y0, 0.01, 0.004, st.y1, w - 0.01, st.color);
  const pivot = new THREE.Group();
  pivot.position.set(c.hw, 0, z0);
  P.flush(pivot);
  group.add(pivot);
  // the rail it runs on, below the rear window
  return {
    set(t) {
      const e = t * t * (3 - 2 * t);
      pivot.position.x = c.hw + 0.07 * Math.min(1, e * 6);
      pivot.position.z = z0 + Math.max(0, (e - 0.12) / 0.88) * (w + 0.03);
    },
  };
}

/* ---------------- route cards ---------------- */

/**
 * The marshrutka's route: a white card behind the windscreen on the
 * kerb side, one in the side window after the door, one in the back.
 */
function routeCards(group, s, c, o) {
  const { hw, belt, zWs0, zWs1, winTop, zR } = c;
  const rake = Math.atan2(zWs1 - zWs0, winTop - belt);
  const y = belt + 0.2;
  const zs = zWs0 + ((y - belt) / (winTop - belt)) * (zWs1 - zWs0) + 0.05;
  const pillars = c.saloon.pillars;
  const after = pillars.find((z) => z >= c.door[1] - 0.05) ?? c.door[1];
  const cards = signCards(0.46, 0.32, 256, paintCard, [
    { x: hw - 0.42, y, z: zs, ry: Math.PI, rx: -rake },
    { x: hw - 0.05, y: belt + 0.2, z: after + 0.35, ry: Math.PI / 2 },
    { x: hw * 0.5, y: (s.rearWindow?.[0] ?? winTop - 0.5) + 0.22, z: zR - 0.06 },
  ]);
  group.add(cards.mesh);
  // and the driver's own: a strip of cardboard lettered in marker, propped
  // on the dash across the middle of the screen
  const yh = belt + 0.09;
  const zh = zWs0 + ((yh - belt) / (winTop - belt)) * (zWs1 - zWs0) + 0.07;
  const hand = signCards(0.78, 0.17, 384, paintHandCard, [
    { x: -0.1, y: yh, z: zh, ry: Math.PI, rx: -rake * 0.8 },
    { x: -hw + 0.05, y: belt + 0.14, z: after + 0.5, ry: -Math.PI / 2 },
  ]);
  group.add(hand.mesh);
  const via = o.route?.via ?? '';
  const paint = (label) => {
    cards.paint(label, via);
    hand.paint(label, via, c.seed);
  };
  paint(o.route?.label ?? '');
  return paint;
}

/**
 * A hand-lettered destination card: the number in red marker, the stops
 * in blue, on a strip cut from a box, slightly uneven.
 */
function paintHandCard(ctx, w, h, label = '', via = '', seed = 1) {
  ctx.fillStyle = '#e9e0c9';
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = 'rgba(150,120,80,0.18)';
  for (let i = 0; i < 6; i++) ctx.fillRect(0, (h / 6) * i + 2, w, 1);
  const hand = '"Marker Felt", "Comic Sans MS", "Segoe Print", cursive';
  const tilt = ((seed % 7) - 3) * 0.006;
  ctx.save();
  ctx.translate(w / 2, h / 2);
  ctx.rotate(tilt);
  ctx.translate(-w / 2, -h / 2);
  fitText(ctx, label, h * 0.62, h * 0.54, h * 1.1, h * 0.84, '#c0221c', { family: hand });
  const stops = via.split(' – ').join(' - ');
  fitText(ctx, stops, w * 0.6, h * 0.36, w * 0.74, h * 0.36, '#1f3f99', { family: hand });
  fitText(ctx, kazVia(via).split(' – ').join(' - '), w * 0.6, h * 0.74, w * 0.74, h * 0.28, '#1f3f99', { family: hand, weight: 'normal' });
  ctx.restore();
  // tape at the corners
  ctx.fillStyle = 'rgba(235,230,200,0.7)';
  ctx.fillRect(0, 0, 22, 12);
  ctx.fillRect(w - 22, 0, 22, 12);
}

/** Tiny local PRNG (mulberry32). */
function mulberry(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
