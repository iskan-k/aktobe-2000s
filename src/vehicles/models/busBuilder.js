import * as THREE from 'three';
import {
  Parts, bottomLine, wheelRig, lamps, seatedFigure, signMesh, signCards, fitText, GLASS, tone,
} from '../kit.js';
import { addPlates, randomPlate } from '../plates.js';
import { CHROME, BLACK, LAMP, AMBER, RED } from './carBuilder.js';

/* ------------------------------------------------------------------ *
 * Box-bodied buses and trolleybuses, built to be ridden in.
 *
 * The body is a hollow shell: side skins below the windows (with the
 * wheel arches cut out and gaps for the doors on the kerb side), a
 * band of pillars and glass, an upper band, a roof, a front with the
 * split windscreen and the destination board, a rear with the engine
 * grille. Inside: floor, ceiling, wheel housings, seats, grab poles and
 * rails, the driver's cab with a partition and the fare tray.
 *
 * Doors are separate leaves that fold inward about their outer edges
 * (Ikarus, LiAZ, ZiU) or push out and slide (plug doors on the MAN).
 * `seats` are eye points at empty seats and standing places, so the
 * ride camera never sits inside another passenger.
 * ------------------------------------------------------------------ */

const FLOOR = 0x3b3b3a;
const CEIL = 0xe4dfcf;
const WALL_IN = 0xcfc7b2;
const SEAT_BUS = 0x8a3b30;
const POLE = 0xd9d6cc;

export function buildBus(s, o = {}) {
  const group = new THREE.Group();
  const P = new Parts();
  const L = s.L, W = s.W, hw = W / 2;
  const zF = -L / 2, zR = L / 2;
  const r = s.r;
  const skirt = s.skirtY ?? 0.34;
  const belt = s.beltY, winTop = s.winTop, roofY = s.roofY;
  const floorY = s.floorY;
  const body = o.color ?? s.color;
  const t = 0.05;                    // skin thickness
  const wheelsZ = [s.zFront, ...s.zRear];
  const bottom = bottomLine(zF, zR, skirt, skirt, skirt, wheelsZ.map((z) => ({ z, r })), 0.07);
  const doors = s.doors;             // [{ z0, z1, kind }]
  const inDoor = (z0, z1) => doors.some((d) => z1 > d.z0 + 0.01 && z0 < d.z1 - 0.01);

  /* ---------------- side skins with livery bands ---------------- */
  // bands: [{ y0, y1, color }] from skirt to belt; defaults to one colour
  const bands = s.bands ?? [{ y0: skirt, y1: belt, color: body }];
  const skinRange = (z0, z1, sgn) => {
    for (const b of bands) {
      const top = [[zF, b.y1], [zR, b.y1]];
      const bot = bottom.map(([z, y]) => [z, Math.min(b.y1 - 0.001, Math.max(y, b.y0))]);
      const x0 = sgn > 0 ? hw - t : -hw, x1 = sgn > 0 ? hw : -hw + t;
      P.slab(top, bot, z0, z1, x0, x1, b.color);
    }
  };
  // left side full length; right side broken by the doors
  skinRange(zF + 0.06, zR - 0.06, -1);
  {
    let z = zF + 0.06;
    for (const d of [...doors].sort((a, b) => a.z0 - b.z0)) {
      if (d.z0 > z + 0.02) skinRange(z, d.z0, 1);
      z = d.z1;
    }
    if (zR - 0.06 > z + 0.02) skinRange(z, zR - 0.06, 1);
  }

  /* ---------------- window band ---------------- */
  const pw = s.pillarW ?? 0.09;
  const winZ0 = zF + (s.frontPillar ?? 0.35), winZ1 = zR - (s.rearPillar ?? 0.4);
  const pillarsAt = [];
  const bays = s.bays ?? Math.round((winZ1 - winZ0) / 1.35);
  for (let i = 0; i <= bays; i++) pillarsAt.push(winZ0 + ((winZ1 - winZ0) * i) / bays);
  const pillarColor = s.pillarColor ?? BLACK;
  const glass = s.glass ?? GLASS.bus;
  for (const sgn of [1, -1]) {
    const xo = sgn * (hw - t / 2);
    // corner posts
    P.box(t, winTop - belt, 0.35, s.frontColor ?? body, xo, (belt + winTop) / 2, zF + 0.2);
    P.box(t, winTop - belt, 0.4, body, xo, (belt + winTop) / 2, zR - 0.22);
    for (let i = 0; i < pillarsAt.length; i++) {
      const z = pillarsAt[i];
      if (sgn > 0 && inDoor(z - pw, z + pw)) continue;
      P.box(t + 0.006, winTop - belt, pw, pillarColor, xo, (belt + winTop) / 2, z);
      if (i < pillarsAt.length - 1) {
        const za = z + pw / 2, zb = pillarsAt[i + 1] - pw / 2;
        if (sgn > 0 && inDoor(za, zb)) continue;
        const gx = sgn * (hw - t * 0.6);
        P.quad([gx, belt + 0.02, za], [gx, belt + 0.02, zb], [gx, winTop - 0.02, zb], [gx, winTop - 0.02, za], glass, { glass: true });
        // sliding top light: a thin bar across the upper third
        P.box(0.012, 0.03, zb - za, pillarColor, sgn * (hw + 0.002), winTop - (winTop - belt) * 0.3, (za + zb) / 2);
      }
    }
    // rubber under the windows
    P.box(t + 0.012, 0.035, winZ1 - winZ0, 0x2a2a2a, xo, belt + 0.01, (winZ0 + winZ1) / 2);
  }
  // right side: glass above and inside each door leaf is part of the leaf

  /* ---------------- upper band and roof ---------------- */
  for (const sgn of [1, -1]) {
    P.span(sgn * (hw - t), winTop, zF + 0.05, sgn * hw, roofY, zR - 0.05, s.upperColor ?? body);
  }
  const roofC = s.roofColor ?? body;
  P.span(-hw + 0.02, roofY - 0.04, zF + 0.04, hw - 0.02, roofY + 0.06, zR - 0.04, roofC);
  P.span(-hw + 0.25, roofY + 0.05, zF + 0.3, hw - 0.25, roofY + 0.1, zR - 0.3, roofC);
  for (const z of s.hatches ?? [-2, 2]) P.span(-0.4, roofY + 0.09, z - 0.4, 0.4, roofY + 0.16, z + 0.4, tone(roofC, 0.92));
  // ceiling seen from inside
  P.span(-hw + t, roofY - 0.08, zF + 0.1, hw - t, roofY - 0.04, zR - 0.1, CEIL);

  /* ---------------- front ---------------- */
  const wsB = s.wsBottom ?? floorY + 0.2;
  const wsT = s.wsTop ?? winTop + 0.05;
  const rake = s.rake ?? 0.12;
  const frontC = s.frontColor ?? body;
  P.span(-hw, skirt, zF, hw, wsB, zF + t, frontC);
  if (s.frontBands) for (const b of s.frontBands) P.span(-hw - 0.004, b.y0, zF - 0.004, hw + 0.004, b.y1, zF + 0.01, b.color);
  // screen: two panes and a centre post
  const wz0 = zF + 0.02, wz1 = zF + 0.02 + rake;
  const half = hw - 0.08;
  P.quad([-half, wsB, wz0], [-0.03, wsB, wz0], [-0.03, wsT, wz1], [-half, wsT, wz1], glass, { glass: true });
  P.quad([0.03, wsB, wz0], [half, wsB, wz0], [half, wsT, wz1], [0.03, wsT, wz1], glass, { glass: true });
  P.box(0.06, wsT - wsB, 0.06, pillarColor, 0, (wsB + wsT) / 2, (wz0 + wz1) / 2, { rx: -Math.atan2(rake, wsT - wsB) });
  for (const sgn of [1, -1]) P.box(0.1, wsT - wsB, 0.1, frontC, sgn * (hw - 0.05), (wsB + wsT) / 2, zF + 0.05 + rake / 2);
  // destination board housing
  P.span(-hw, wsT, zF + rake * 0.9, hw, roofY + 0.02, zF + rake + 0.08, s.boardHousing ?? 0x1f1f20);
  P.span(-hw + 0.06, skirt + 0.02, zF - 0.05, hw - 0.06, skirt + 0.32, zF + 0.02, s.bumper ?? 0x2a2a2a);
  // wipers
  P.box(0.8, 0.015, 0.02, BLACK, -0.5, wsB + 0.04, zF - 0.01, { rz: 0.35 });
  P.box(0.8, 0.015, 0.02, BLACK, 0.5, wsB + 0.04, zF - 0.01, { rz: -0.35 });
  // mirrors on stalks, the big bus kind
  for (const sgn of [1, -1]) {
    P.tube([sgn * (hw - 0.05), wsT - 0.2, zF + 0.1], [sgn * (hw + 0.28), wsT - 0.05, zF - 0.25], 0.02, BLACK);
    P.box(0.05, 0.36, 0.2, BLACK, sgn * (hw + 0.3), wsT - 0.25, zF - 0.28);
  }
  if (s.front) s.front(P, { zF, hw, wsB, skirt, body, frontC });

  /* ---------------- rear ---------------- */
  const rw = s.rearWindow === null ? null : (s.rearWindow ?? [winTop - 0.7, winTop - 0.05]);
  const rearC = s.rearColor ?? body;
  if (rw) {
    // the rear wall has a real opening behind the rear glass
    P.span(-hw, skirt, zR - t, hw, rw[0], zR, rearC);
    P.span(-hw, rw[1], zR - t, hw, roofY, zR, rearC);
    for (const sgn of [1, -1]) P.span(sgn * hw, rw[0], zR - t, sgn * (hw - 0.3), rw[1], zR, rearC);
  } else P.span(-hw, skirt, zR - t, hw, roofY, zR, rearC);
  if (rw) P.quad([hw - 0.3, rw[0], zR + 0.004], [-hw + 0.3, rw[0], zR + 0.004], [-hw + 0.3, rw[1], zR + 0.004], [hw - 0.3, rw[1], zR + 0.004], glass, { glass: true });
  P.span(-hw + 0.06, skirt + 0.02, zR - 0.02, hw - 0.06, skirt + 0.3, zR + 0.06, s.bumper ?? 0x2a2a2a);
  if (s.rear) s.rear(P, { zR, hw, skirt, body });

  /* ---------------- floor and wheel housings ---------------- */
  P.span(-hw + t, skirt, zF + t, hw - t, floorY, zR - t, FLOOR);
  for (const z of wheelsZ) {
    for (const sgn of [1, -1]) {
      P.span(sgn * (hw - t), floorY, z - r - 0.1, sgn * (hw - t - 0.42), r * 2 + 0.2, z + r + 0.1, WALL_IN);
    }
  }
  // steps in the door wells
  for (const d of doors) {
    P.span(hw - 0.5, skirt, d.z0 + 0.05, hw - t, floorY - (floorY - skirt) * 0.5, d.z1 - 0.05, FLOOR);
  }
  // inner wall panels below the windows (a lighter trim)
  for (const sgn of [1, -1]) {
    P.span(sgn * (hw - t), floorY, zF + 1.1, sgn * (hw - t - 0.012), belt - 0.02, zR - 0.1, WALL_IN);
  }

  /* ---------------- driver's cab ---------------- */
  const dz = zF + (s.driverZ ?? 1.05);
  const dx = -hw + 0.62;
  P.span(-hw + t, floorY, zF + 0.1, -0.1, wsB + 0.05, zF + 0.55, 0x2c2c2e);          // dashboard
  const ring = new THREE.TorusGeometry(0.24, 0.025, 5, 16);
  P.add(ring, 0x1c1c1c, new THREE.Matrix4().compose(new THREE.Vector3(dx, floorY + 0.85, zF + 0.72),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(-1.1, 0, 0)), new THREE.Vector3(1, 1, 1)));
  P.span(dx - 0.25, floorY, dz - 0.25, dx + 0.25, floorY + 0.45, dz + 0.25, 0x2f3a4a);
  P.box(0.5, 0.65, 0.1, 0x2f3a4a, dx, floorY + 0.8, dz + 0.26);
  if (!o.parked) seatedFigure(P, dx, floorY + 0.45, dz, (o.seed ?? 1) + 3, { wheel: true });
  // partition behind the driver, glazed at the top
  P.span(-hw + t, floorY, dz + 0.4, -0.25, floorY + 1.15, dz + 0.44, s.partition ?? 0xb9b1a0);
  // the fare tray on the partition by the front door
  P.box(0.28, 0.05, 0.2, 0x8a8a86, -0.18, floorY + 1.0, dz + 0.3);

  /* ---------------- seats and poles ---------------- */
  const seatEyes = [];
  const standEyes = [];
  const rng = mulberry((o.seed ?? 1) * 97 + 13);
  const seatRows = [];
  const pitch = s.seatPitch ?? 0.78;
  const zStart = dz + 0.9;
  const zEnd = zR - 0.45;
  for (let z = zStart; z < zEnd; z += pitch) seatRows.push(z);
  const busy = new Set();
  for (const z of seatRows) {
    const overArch = wheelsZ.some((wz) => Math.abs(z - wz) < r + 0.25);
    for (const side of [-1, 1]) {
      if (side > 0 && doors.some((d) => z > d.z0 - 0.45 && z < d.z1 + 0.25)) continue;
      if (side > 0 && s.singleRight && Math.abs(z - zStart) < 0.01) continue;
      const count = side < 0 || !s.singleRight ? 2 : 1;
      for (let k = 0; k < count; k++) {
        const x = side * (hw - 0.3 - k * 0.45);
        // seats over the wheel arches sit on a low plinth
        const y = overArch ? Math.min(r * 2 + 0.22, floorY + 0.22) : floorY;
        seat(P, x, y, z);
        const key = `${x.toFixed(2)}|${z.toFixed(2)}`;
        // one passenger in about every third seat
        if (!o.parked && rng() < (s.fill ?? 0.3)) {
          seatedFigure(P, x, y + 0.42, z - 0.05, Math.floor(rng() * 1000), { scarf: rng() < 0.4 });
          busy.add(key);
        } else if (k === 0 && !overArch) {
          // no ride camera on the plinths: from up there the eye is at the window top
          seatEyes.push({ x, y: y + 1.2, z: z - 0.02, yaw: 0 });
        }
      }
    }
  }
  // grab poles at the doors and along the aisle, rails under the ceiling
  for (const d of doors) {
    for (const z of [d.z0 + 0.12, d.z1 - 0.12]) P.cyl(0.02, roofY - floorY, POLE, hw - 0.55, (floorY + roofY) / 2, z, { seg: 6 });
    standEyes.push({ x: hw - 1.0, y: floorY + 1.62, z: (d.z0 + d.z1) / 2, yaw: -Math.PI / 2 });
  }
  for (let z = zStart + 0.4; z < zEnd; z += 2.4) P.cyl(0.02, roofY - floorY, POLE, -0.2, (floorY + roofY) / 2, z, { seg: 6 });
  for (const sgn of [1, -1]) P.cyl(0.018, zEnd - dz, POLE, sgn * (hw - 0.55), roofY - 0.28, (dz + zEnd) / 2, { axis: 'z', seg: 6 });

  /* ---------------- plates and extras ---------------- */
  const plate = o.plate ?? randomPlate(o.seed ?? 1, { company: true });
  addPlates(P, plate, { y: skirt + 0.42, z: zF - 0.005 }, { y: skirt + 0.45, z: zR + 0.005 });
  if (s.details) s.details(P, { zF, zR, hw, belt, winTop, roofY, floorY, skirt, body, wsT, wsB, rake });

  const meshes = P.flush(group);
  if (meshes.body) meshes.body.castShadow = true;

  /* ---------------- doors ---------------- */
  const doorRigs = doors.map((d) => doorRig(group, d, { hw, floorY, skirt, top: winTop + 0.05, body: s.doorColor ?? body, glass: s.doorGlass ?? 0x6f8799, frame: pillarColor }));

  /* ---------------- wheels, lamps ---------------- */
  const rig = wheelRig(group, {
    r, w: s.tyreW ?? 0.3, track: s.track ?? W - 0.4, zFront: s.zFront, zRear: s.zRear,
    rim: s.rim ?? 0xcfccc2, hub: s.hub ?? 0x6a6a6a, style: 'steel', dual: true,
  });
  const lm = lamps(group, {
    zFront: zF, zRear: zR,
    brake: [{ x: hw - 0.18, y: skirt + 0.62, w: 0.16, h: 0.12 }],
    frontBlink: [{ x: hw - 0.22, y: skirt + 0.55, w: 0.14, h: 0.08 }],
    rearBlink: [{ x: hw - 0.18, y: skirt + 0.8, w: 0.16, h: 0.1 }],
  });

  /* ---------------- route boards ---------------- */
  const route = o.route;
  const front = signMesh(W - 0.4, roofY - wsT - 0.08, 512, paintFrontBoard(s.board ?? 'roll'));
  front.mesh.position.set(0, (wsT + roofY) / 2, zF + rake * 0.9 - 0.006);
  front.mesh.rotation.y = Math.PI;
  group.add(front.mesh);
  // the white card by the front door and the same card in the back window
  const card = signCards(0.5, 0.36, 256, paintCard, [
    { x: hw - 0.045, y: belt + 0.25, z: (doors[0]?.z1 ?? zF + 2) + 0.55, ry: Math.PI / 2 },
    { x: -hw + 0.5, y: (rw ? rw[0] + rw[1] : winTop * 2) / 2, z: zR - 0.07 },
  ]);
  group.add(card.mesh);
  const routeBoard = (label) => {
    const via = route?.via ?? '';
    front.paint(label, via, s.boardStyle);
    card.paint(label, via);
  };
  routeBoard(route?.label ?? '');

  /* ---------------- trolley poles ---------------- */
  let poleTips = null;
  if (s.trolley) {
    poleTips = trolleyPoles(group, { roofY: roofY + 0.1, baseZ: s.trolley.baseZ, wireY: s.trolley.wireY ?? 5.8, len: s.trolley.len ?? 6.0, zR });
  }

  const seats = [...seatEyes.filter((_, i) => i % 2 === 0).slice(0, 6), ...standEyes];

  return {
    group, type: s.id, kind: s.kind ?? 'bus',
    length: L, width: W, height: roofY + 0.1, wheelbase: s.zRear[s.zRear.length - 1] - s.zFront, wheelRadius: r,
    wheels: rig.wheels, steer: rig.steer, brake: lm.brake, blink: lm.blink,
    doors: doorRigs,
    doorPos: doors.map((d) => ({ x: hw + 0.75, z: (d.z0 + d.z1) / 2 })),
    driverEye: { x: dx, y: floorY + 1.2, z: dz + 0.05 },
    seats: seats.length ? seats : [{ x: 0, y: floorY + 1.62, z: 0, yaw: 0 }],
    engine: s.engine ?? 'bus',
    routeBoard, poleTips, plate, seed: o.seed ?? 1,
  };
}

/** A bus seat: frame, cushion, back with a grab handle. */
function seat(P, x, y, z) {
  P.span(x - 0.2, y, z - 0.2, x + 0.2, y + 0.42, z + 0.2, 0x4a4a4a);
  P.span(x - 0.21, y + 0.36, z - 0.22, x + 0.21, y + 0.46, z + 0.2, SEAT_BUS);
  P.box(0.42, 0.52, 0.07, SEAT_BUS, x, y + 0.72, z + 0.19, { rx: 0.12 });
  P.box(0.3, 0.03, 0.03, POLE, x, y + 1.0, z + 0.25);
}

/**
 * One door: two leaves. Folding doors swing inward about the outer
 * edges of the opening; plug doors step out and slide apart.
 */
function doorRig(group, d, { hw, floorY, skirt, top, body, glass, frame }) {
  const w = (d.z1 - d.z0) / 2;
  const h = top - skirt - 0.05;
  const leaves = [];
  for (const k of [0, 1]) {
    const P = new Parts();
    // leaf authored with its hinge edge at z = 0, extending toward +z (k=0) or -z (k=1)
    const sgn = k === 0 ? 1 : -1;
    const zc = sgn * w / 2;
    P.box(0.04, h, w - 0.02, frame, 0, skirt + 0.05 + h / 2, zc);
    P.box(0.045, h * 0.62, w - 0.14, glass, 0, skirt + 0.05 + h * 0.62, zc);
    P.box(0.05, h * 0.26, w - 0.1, body, 0, skirt + 0.05 + h * 0.14, zc);
    P.box(0.03, 0.03, w * 0.5, CHROME, -0.04, skirt + 0.05 + h * 0.45, zc);
    const pivot = new THREE.Group();
    pivot.position.set(hw - 0.03, 0, k === 0 ? d.z0 : d.z1);
    P.flush(pivot);
    group.add(pivot);
    leaves.push({ pivot, sgn });
  }
  return {
    set(t) {
      const e = t * t * (3 - 2 * t);
      for (const { pivot, sgn } of leaves) {
        if (d.kind === 'plug') {
          pivot.position.x = hw - 0.03 + e * 0.12;
          pivot.position.z = (sgn > 0 ? d.z0 : d.z1) - sgn * e * w * 0.95;
          pivot.rotation.y = 0;
        } else {
          // fold inward (toward -x) about the vertical hinge line
          pivot.rotation.y = -sgn * e * 1.45;
        }
      }
    },
  };
}

function trolleyPoles(group, { roofY, baseZ, wireY, len, zR }) {
  const P = new Parts();
  P.span(-0.55, roofY, baseZ - 0.5, 0.55, roofY + 0.18, baseZ + 0.5, 0x5a5a58);
  const tips = [];
  const rise = wireY - (roofY + 0.3);
  const run = Math.sqrt(Math.max(0.1, len * len - rise * rise));
  for (const x of [-0.3, 0.3]) {
    const a = [x, roofY + 0.3, baseZ];
    const b = [x, wireY - 0.04, baseZ + run];
    P.box(0.16, 0.14, 0.4, 0x3a3a3a, x, roofY + 0.24, baseZ);
    P.tube(a, b, 0.03, 0x2b2b2b, { seg: 6 });
    // the shoe that runs on the wire
    P.box(0.07, 0.07, 0.22, 0x555555, x, wireY - 0.035, baseZ + run);
    // retriever rope hanging back to the rear panel
    P.tube(b, [x * 0.8, roofY - 0.4, zR + 0.02], 0.006, 0x222222, { seg: 3 });
    tips.push({ x, y: wireY, z: baseZ + run });
  }
  P.flush(group);
  return tips;
}

/* ---------------- boards ---------------- */

function paintFrontBoard(style) {
  return (ctx, w, h, label = '', via = '', boardStyle = style) => {
    if (boardStyle === 'led') {
      ctx.fillStyle = '#141414';
      ctx.fillRect(0, 0, w, h);
      fitText(ctx, label, h * 0.6, h / 2 + 1, h, h * 0.8, '#ffb020', { family: 'Menlo, Consolas, monospace' });
      fitText(ctx, via.replace(/ – /g, ' – '), w * 0.58, h / 2 + 1, w * 0.8, h * 0.5, '#ffb020', { family: 'Menlo, Consolas, monospace', weight: 'normal' });
      return;
    }
    // roller blind: white card with black letters, a big red number
    ctx.fillStyle = '#1b1b1b';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#efeadb';
    ctx.fillRect(4, 4, w - 8, h - 8);
    fitText(ctx, label, h * 0.62, h / 2 + 1, h * 1.1, h * 0.85, '#b8261f');
    fitText(ctx, via, w * 0.58, h / 2 + 1, w * 0.76, h * 0.52, '#1b1b1b');
  };
}

/** The white card in the window by the door: number big, stops under it. */
export function paintCard(ctx, w, h, label = '', via = '') {
  ctx.fillStyle = '#f4f1e6';
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = '#2a2a2a';
  ctx.lineWidth = 4;
  ctx.strokeRect(3, 3, w - 6, h - 6);
  fitText(ctx, label, w / 2, h * 0.36, w * 0.8, h * 0.52, '#b8261f');
  const parts = via.split(' – ');
  parts.forEach((p, i) => fitText(ctx, p, w / 2, h * 0.68 + i * h * 0.1, w * 0.9, h * 0.1, '#1b1b1b', { weight: 'normal' }));
}

/** Tiny local PRNG (same algorithm as util's mulberry32). */
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

export { LAMP, AMBER, RED, CHROME, BLACK };
