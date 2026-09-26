import * as THREE from 'three';
import { Parts, ATLAS, signMesh, fitText, tone } from '../kit.js';
import { CHROME } from './carBuilder.js';

/* ------------------------------------------------------------------ *
 * The inside of the player's VAZ-2107, seen only from the driver's
 * seat: the dashboard with its two big dials, the two-spoke wheel with
 * the boat badge, seats with wooden-bead covers, door cards with window
 * cranks, the gear lever, sun visors, the mirror and the amulet that
 * hangs from it.
 *
 * The wheel turns with the front wheels, the needles follow the speed,
 * and the amulet swings when you brake or turn. All of it is read off
 * the model itself (steer pivots and the group's motion), so the
 * driving code needs to know nothing about it.
 * ------------------------------------------------------------------ */

const DASH = 0x1d1e20;
const PAD = 0x26272a;
const VINYL = 0x34353a;
const VELOUR = 0x51463c;
const BEAD = 0xb27c46;

const SPEED_MAX = 180;       // km/h on the dial
const RPM_MAX = 8;           // x1000
const DIAL_START = Math.PI * 1.25;
const DIAL_SWEEP = Math.PI * 1.5;
const GEARS = [0, 18, 38, 62, 88];   // km/h where each gear starts
const TELEPORT = 70;                 // m/s; faster than this the car was moved, not driven

/**
 * @param {object} model  the car's VehicleModel (for steer pivots and group)
 * @param {object} a      anchors from buildCar
 * @param {object} gh     the car's greenhouse spec (for the mirror and visors)
 * @returns {THREE.Group}
 */
export function buildInterior2107(model, a, gh) {
  const interior = new THREE.Group();
  interior.name = 'interior';
  const P = new Parts();
  const motion = motionReader(model);
  dashboard(P, a);
  for (const x of [-0.36, 0.36]) frontSeat(P, a, x);
  doorCards(P, a);
  centreConsole(P, a);
  roofBits(P, a, gh);
  pillarTrims(P, a, gh);
  dashTouches(P, a);
  P.flush(interior);
  for (const m of interior.children) { m.castShadow = false; m.receiveShadow = false; }
  interior.add(cluster(a, motion));
  interior.add(steeringWheel(a, motion));
  interior.add(amulet(a, gh, motion));
  return interior;
}

/* ---------------- motion ---------------- */

/**
 * Speed, acceleration, yaw rate and steer, sampled once per frame from
 * the model's group and its steer pivots.
 */
function motionReader(model) {
  const st = { t: 0, speed: 0, accel: 0, lat: 0, steer: 0, x: 0, z: 0, yaw: 0, primed: false };
  st.sample = () => {
    const now = performance.now() / 1000;
    const dt = now - st.t;
    if (dt < 0.004) return st;
    const g = model.group;
    const v = Math.hypot(g.position.x - st.x, g.position.z - st.z) / dt;
    // a jump (summoned, placed) is not driving
    if (st.primed && dt < 0.5 && v < TELEPORT) {
      const yawRate = wrap(g.rotation.y - st.yaw) / dt;
      const k = 1 - Math.exp(-dt * 6);
      st.accel += ((v - st.speed) / dt - st.accel) * k;
      st.speed += (v - st.speed) * k;
      st.lat += (st.speed * yawRate - st.lat) * k;
    }
    st.primed = true;
    st.t = now;
    st.x = g.position.x; st.z = g.position.z; st.yaw = g.rotation.y;
    st.steer = model.steer[0]?.rotation.y ?? 0;
    return st;
  };
  return st;
}

const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

/** Let a mesh set its own rotation just before it is drawn. */
function live(mesh, fn) {
  mesh.onBeforeRender = () => {
    fn(mesh);
    mesh.updateMatrix();
    mesh.matrixWorld.multiplyMatrices(mesh.parent.matrixWorld, mesh.matrix);
  };
}

/* ---------------- static parts ---------------- */

function dashboard(P, a) {
  const { hw, skin, belt, dashZ } = a;
  const x0 = -hw + skin, x1 = hw - skin;
  // main body, a padded top that dips toward the glass, the cluster hood
  P.span(x0, belt - 0.27, dashZ + 0.04, x1, belt - 0.02, dashZ + 0.34, DASH);
  P.box(x1 - x0, 0.05, 0.3, PAD, 0, belt - 0.005, dashZ + 0.19, { rx: -0.12 });
  P.span(-0.62, belt + 0.1, dashZ + 0.18, -0.1, belt + 0.125, dashZ + 0.37, PAD);
  for (const x of [-0.62, -0.1]) P.span(x - 0.012, belt - 0.03, dashZ + 0.2, x + 0.012, belt + 0.11, dashZ + 0.41, PAD);
  // glovebox with its chrome lock, and a vent at each end
  P.span(0.12, belt - 0.2, dashZ + 0.338, 0.62, belt - 0.06, dashZ + 0.345, tone(DASH, 1.25));
  P.box(0.05, 0.02, 0.01, CHROME, 0.37, belt - 0.08, dashZ + 0.35);
  for (const x of [-0.68, 0.68]) {
    P.span(x - 0.05, belt - 0.12, dashZ + 0.338, x + 0.05, belt - 0.05, dashZ + 0.346, 0x111112);
    for (const y of [-0.105, -0.09, -0.075]) P.box(0.09, 0.006, 0.01, 0x3a3a3c, x, belt + y, dashZ + 0.348);
  }
  // a cassette left on the dash
  P.box(0.1, 0.012, 0.064, 0x2a2a30, 0.3, belt + 0.03, dashZ + 0.18, { ry: 0.3 });
  P.box(0.06, 0.013, 0.03, 0xd9d2c0, 0.3, belt + 0.03, dashZ + 0.18, { ry: 0.3 });
}

/** A classic front seat: cushion, back, headrest on posts, a bead cover. */
function frontSeat(P, a, x) {
  const { floorY, seatY, hipF } = a;
  P.span(x - 0.23, floorY + 0.04, hipF - 0.26, x + 0.23, seatY, hipF + 0.24, VELOUR);
  P.box(0.47, 0.6, 0.13, VELOUR, x, seatY + 0.3, hipF + 0.27, { rx: 0.16 });
  for (const s of [-1, 1]) P.box(0.02, 0.1, 0.02, CHROME, x + s * 0.08, seatY + 0.64, hipF + 0.35, { rx: 0.16 });
  P.box(0.28, 0.16, 0.1, VELOUR, x, seatY + 0.74, hipF + 0.37, { rx: 0.16 });
  const beads = beadUV();
  // back: the cover's front face leans with the seat
  P.decal(0.42, 0.56, beads, x, seatY + 0.31, hipF + 0.199, { ry: Math.PI, rx: -0.16 });
  P.decal(0.42, 0.44, beads, x, seatY + 0.004, hipF - 0.02, { rx: -Math.PI / 2 });
  // a row of real beads along the front edge of the cushion
  for (let i = 0; i < 9; i++) P.blob(0.022, 0.022, 0.022, i % 2 ? BEAD : tone(BEAD, 0.8), x - 0.2 + i * 0.05, seatY - 0.01, hipF - 0.25, { detail: 0 });
}

/** Wooden beads on a string grid, as a texture in the shared atlas. */
function beadUV() {
  return ATLAS.slot('beads', 96, 120, (ctx, x0, y0, w, h) => {
    ctx.fillStyle = '#3a2c22';
    ctx.fillRect(x0, y0, w, h);
    const n = 8, m = 10;
    for (let j = 0; j < m; j++) {
      for (let i = 0; i < n; i++) {
        const cx = x0 + (i + 0.5) * (w / n), cy = y0 + (j + 0.5) * (h / m);
        const g = ctx.createRadialGradient(cx - 2, cy - 2, 1, cx, cy, w / n / 2);
        const dark = (i + j) % 3 === 0;
        g.addColorStop(0, dark ? '#c99a62' : '#e0b27a');
        g.addColorStop(1, dark ? '#6e4726' : '#8e5e32');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(cx, cy, w / n / 2 - 0.6, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  });
}

/** Door cards: vinyl panel, armrest, the chrome pull and the window crank. */
function doorCards(P, a) {
  const { hw, skin, floorY, belt, cab0, hipF } = a;
  for (const s of [-1, 1]) {
    const x = s * (hw - skin - 0.03);
    P.span(x, floorY + 0.12, cab0 + 0.12, x - s * 0.012, belt - 0.03, hipF + 0.45, VINYL);
    P.span(x - s * 0.012, belt - 0.33, hipF - 0.35, x - s * 0.07, belt - 0.27, hipF + 0.1, tone(VINYL, 0.8));   // armrest
    P.span(x - s * 0.012, floorY + 0.14, cab0 + 0.2, x - s * 0.02, floorY + 0.34, hipF - 0.1, tone(VINYL, 0.85)); // map pocket
    P.box(0.015, 0.03, 0.1, CHROME, x - s * 0.02, belt - 0.13, hipF - 0.42);               // door pull
    // window crank: a boss, the arm and its knob
    const cz = hipF - 0.08, cy = belt - 0.19;
    P.cyl(0.025, 0.02, CHROME, x - s * 0.02, cy, cz, { axis: 'x', seg: 8 });
    P.box(0.012, 0.018, 0.1, CHROME, x - s * 0.03, cy - 0.03, cz - 0.03, { rx: 0.6 });
    P.cyl(0.013, 0.05, 0x1c1c1c, x - s * 0.055, cy - 0.06, cz - 0.07, { axis: 'x', seg: 6 });
  }
}

/** Centre console: heater sliders, the clock, a cassette radio, gear lever, handbrake. */
function centreConsole(P, a) {
  const { belt, dashZ, floorY, hipF } = a;
  const z = dashZ + 0.34;
  P.span(-0.13, floorY + 0.06, z - 0.02, 0.13, belt - 0.02, z + 0.2, DASH);
  P.span(-0.1, belt - 0.12, z + 0.2, 0.1, belt - 0.05, z + 0.205, 0x111112);
  for (const x of [-0.06, 0, 0.06]) P.box(0.012, 0.03, 0.01, 0xb8b4a8, x, belt - 0.085, z + 0.21);
  P.cyl(0.028, 0.01, 0x0e0e0e, 0, belt - 0.17, z + 0.205, { axis: 'z', seg: 12 });       // clock
  // the radio: an aftermarket deck with a green display
  P.span(-0.09, belt - 0.29, z + 0.2, 0.09, belt - 0.23, z + 0.21, 0x3c3d40);
  P.box(0.08, 0.012, 0.004, 0x5fd08a, -0.03, belt - 0.255, z + 0.212);
  P.box(0.07, 0.008, 0.004, 0x0c0c0c, 0.04, belt - 0.27, z + 0.212);
  // tunnel, gear lever with its rubber boot, handbrake
  P.span(-0.12, floorY, z + 0.2, 0.12, floorY + 0.14, hipF + 0.35, DASH);
  const gz = hipF - 0.42;
  P.box(0.12, 0.05, 0.12, 0x151515, 0, floorY + 0.16, gz);
  P.tube([0, floorY + 0.16, gz], [0, floorY + 0.5, gz + 0.09], 0.008, CHROME);
  P.blob(0.028, 0.028, 0.028, 0x121212, 0, floorY + 0.51, gz + 0.09, { detail: 1 });
  P.tube([0, floorY + 0.16, hipF - 0.08], [0, floorY + 0.26, hipF + 0.1], 0.015, 0x1a1a1a);
}

/** Sun visors and the rear-view mirror at the top of the windscreen. */
function roofBits(P, a, gh) {
  const [zTop, yTop] = gh.aTop;
  for (const x of [-0.37, 0.37]) P.box(0.36, 0.012, 0.14, 0x8f877a, x, yTop - 0.035, zTop + 0.1, { rx: 0.04 });
  P.box(0.016, 0.04, 0.016, 0x1c1c1c, 0, yTop - 0.045, zTop + 0.04);
  P.box(0.2, 0.06, 0.028, 0x1c1c1c, 0, yTop - 0.085, zTop + 0.045);
  P.box(0.18, 0.045, 0.004, 0x8fa3b0, 0, yTop - 0.085, zTop + 0.06);
}

/** Dark plastic over the A pillars, and the beige headliner's front edge. */
function pillarTrims(P, a, gh) {
  const [zb, yb] = gh.aBase, [zt, yt] = gh.aTop;
  const xAt = (y) => gh.hwBelt - ((y - yb) / (yt - yb)) * (gh.hwBelt - gh.hwRoof);
  for (const s of [-1, 1]) {
    P.tube([s * (xAt(yb) - 0.05), yb + 0.02, zb + 0.07], [s * (xAt(yt) - 0.05), yt - 0.05, zt + 0.06], 0.035, 0x2c2a28, { seg: 5 });
  }
  P.span(-gh.hwRoof + 0.05, yt - 0.075, zt + 0.02, gh.hwRoof - 0.05, yt - 0.05, zt + 0.12, 0xa8a090);
}

/*
 * What a driver puts on a семёрка dash: a strip of fake fur along the
 * top, a folded paper icon card by the screen, a box of matches.
 */
function dashTouches(P, a) {
  const { belt, dashZ } = a;
  const fur = furUV();
  P.decal(0.9, 0.2, fur, 0.12, belt + 0.03, dashZ + 0.16, { rx: -Math.PI / 2 + 0.12 });
  // the little folding icon: three gilt panels standing on the dash
  const icon = iconUV();
  for (const [dx, ry] of [[-0.05, 0.5], [0, 0], [0.05, -0.5]]) {
    P.decal(0.05, 0.07, icon, 0.28 + dx, belt + 0.07, dashZ + 0.12 + Math.abs(dx) * 0.3, { ry: -ry });
  }
  P.box(0.05, 0.015, 0.035, 0xc8a24a, 0.45, belt + 0.035, dashZ + 0.22, { ry: 0.4 });
}

/** Grey-brown fake fur, as a texture in the shared atlas. */
function furUV() {
  return ATLAS.slot('dash-fur', 128, 32, (ctx, x0, y0, w, h) => {
    ctx.fillStyle = '#6e6154';
    ctx.fillRect(x0, y0, w, h);
    for (let i = 0; i < 420; i++) {
      const x = x0 + ((i * 37) % w), y = y0 + ((i * 53) % h);
      ctx.strokeStyle = i % 3 ? 'rgba(170,150,125,0.55)' : 'rgba(40,32,26,0.5)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + ((i % 5) - 2), y + 3);
      ctx.stroke();
    }
  });
}

/** A small printed icon card: gilt border, a dark figure, a halo. */
function iconUV() {
  return ATLAS.slot('dash-icon', 40, 56, (ctx, x0, y0, w, h) => {
    ctx.fillStyle = '#c9a24a';
    ctx.fillRect(x0, y0, w, h);
    ctx.fillStyle = '#6a2a1e';
    ctx.fillRect(x0 + 4, y0 + 4, w - 8, h - 8);
    ctx.fillStyle = '#e6c56a';
    ctx.beginPath(); ctx.arc(x0 + w / 2, y0 + 18, 9, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#d9b48a';
    ctx.beginPath(); ctx.arc(x0 + w / 2, y0 + 18, 5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#2a3a5a';
    ctx.fillRect(x0 + w / 2 - 8, y0 + 26, 16, 22);
  });
}

/* ---------------- animated parts ---------------- */

/** The instrument cluster: a painted face and two live needles. */
function cluster(a, motion) {
  const w = 0.46, h = 0.17;
  const face = signMesh(w, h, 512, paintCluster);
  face.paint();
  // painted dials read better unlit, a little dimmed as if in the hood's shade
  face.mesh.material = new THREE.MeshBasicMaterial({ map: face.mesh.material.map, color: 0xc8c8c8 });
  // tipped back so it faces the driver's eyes under the hood
  face.mesh.position.set(-0.36, a.belt + 0.035, a.dashZ + 0.37);
  face.mesh.rotation.x = -0.45;
  const needleMat = new THREE.MeshBasicMaterial({ color: 0xff7a2a });
  const geo = new THREE.PlaneGeometry(0.066, 0.004).translate(0.028, 0, 0);
  const needle = (cx, value) => {
    const m = new THREE.Mesh(geo, needleMat);
    m.position.set(cx * w - w / 2, 0, 0.004);
    live(m, (n) => { n.rotation.z = DIAL_START - DIAL_SWEEP * value(motion.sample()); });
    face.mesh.add(m);
    return m;
  };
  needle(0.25, (st) => Math.min(1, (st.speed * 3.6) / SPEED_MAX));
  needle(0.75, (st) => rpm(st.speed * 3.6) / RPM_MAX);
  return face.mesh;
}

/** Rough revs from road speed through a four-speed box, x1000. */
function rpm(kmh) {
  if (kmh < 1) return 0.85;
  let g = 0;
  while (g < GEARS.length - 1 && kmh > GEARS[g + 1]) g++;
  const lo = GEARS[g], hi = GEARS[g + 1] ?? 150;
  return Math.min(RPM_MAX * 0.95, 1.6 + ((kmh - lo) / (hi - lo)) * 3.6);
}

function paintCluster(ctx, w, h) {
  ctx.fillStyle = '#0d0d0e';
  ctx.fillRect(0, 0, w, h);
  dial(ctx, w * 0.25, h / 2, h * 0.44, SPEED_MAX, 20, 'км/ч', null);
  dial(ctx, w * 0.75, h / 2, h * 0.44, RPM_MAX, 1, 'об/мин ×1000', 6);
  // fuel and temperature between the dials, and the warning lamps
  for (const [y, label] of [[h * 0.3, 'Т°'], [h * 0.66, 'БЕНЗ']]) {
    ctx.strokeStyle = '#d9d6cc';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(w / 2, y + 12, 22, Math.PI * 1.2, Math.PI * 1.8);
    ctx.stroke();
    fitText(ctx, label, w / 2, y + 16, 40, 11, '#d9d6cc', { weight: 'normal' });
  }
  const lamps = ['#3fae4a', '#e0962e', '#c8322a', '#3a6ad0'];
  lamps.forEach((c, i) => { ctx.fillStyle = c; ctx.globalAlpha = 0.45; ctx.fillRect(w / 2 - 26 + i * 14, h - 18, 10, 8); });
  ctx.globalAlpha = 1;
}

function dial(ctx, cx, cy, r, max, step, unit, red) {
  ctx.strokeStyle = '#3a3a3c';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(cx, cy, r + 2, 0, Math.PI * 2);
  ctx.stroke();
  const at = (v) => DIAL_START - DIAL_SWEEP * (v / max);
  if (red) {
    ctx.strokeStyle = '#c8322a';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(cx, cy, r - 4, -at(red), -at(max));
    ctx.stroke();
  }
  ctx.fillStyle = '#e9e6dc';
  ctx.strokeStyle = '#e9e6dc';
  for (let v = 0; v <= max + 1e-6; v += step / 2) {
    const ang = at(v);
    const major = Math.abs(v / step - Math.round(v / step)) < 1e-6;
    const r0 = major ? r - 10 : r - 6;
    ctx.lineWidth = major ? 2.5 : 1.2;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(ang) * r0, cy - Math.sin(ang) * r0);
    ctx.lineTo(cx + Math.cos(ang) * (r - 1), cy - Math.sin(ang) * (r - 1));
    ctx.stroke();
    if (major) fitText(ctx, String(Math.round(v)), cx + Math.cos(ang) * (r - 22), cy - Math.sin(ang) * (r - 22), 26, 13, '#e9e6dc');
  }
  fitText(ctx, unit, cx, cy + r * 0.45, r, 10, '#b9b6ac', { weight: 'normal' });
  ctx.fillStyle = '#2a2a2c';
  ctx.beginPath();
  ctx.arc(cx, cy, 5, 0, Math.PI * 2);
  ctx.fill();
}

/** The two-spoke wheel with the boat badge; turns with the front wheels. */
function steeringWheel(a, motion) {
  const P = new Parts();
  const ring = new THREE.TorusGeometry(0.19, 0.021, 6, 22);
  P.add(ring, 0x161616);
  for (const s of [-1, 1]) P.box(0.16, 0.035, 0.02, 0x1c1c1c, s * 0.1, -0.03, 0.01, { rz: s * 0.28 });
  P.box(0.13, 0.09, 0.05, 0x1f1f1f, 0, -0.03, 0.02);
  P.box(0.05, 0.035, 0.01, 0xb8261f, 0, -0.02, 0.048);
  P.box(0.028, 0.012, 0.012, CHROME, 0, -0.022, 0.052);           // the silver boat
  const mount = new THREE.Group();
  mount.position.set(-0.36, a.swY - 0.03, a.swZ + 0.04);
  mount.rotation.x = -0.45;
  const spin = new THREE.Group();
  P.flush(spin);
  mount.add(spin);
  // the column stays put
  const col = new Parts();
  col.box(0.06, 0.06, 0.3, 0x1a1a1a, 0, -0.02, -0.16);
  col.flush(mount);
  const mesh = spin.children[0];
  if (mesh) live(mesh, (m) => { m.rotation.z = motion.sample().steer * 5; });
  return mount;
}

/** A small tumar amulet with a tassel, hanging from the mirror. */
function amulet(a, gh, motion) {
  const [zTop, yTop] = gh.aTop;
  const P = new Parts();
  const len = 0.16;
  P.tube([0, 0, 0], [0, -len, 0], 0.002, 0xb8261f, { seg: 3 });
  P.box(0.045, 0.045, 0.008, 0xb8261f, 0, -len - 0.02, 0, { rz: Math.PI / 4 });
  P.box(0.032, 0.032, 0.01, 0xd9b44a, 0, -len - 0.02, 0, { rz: Math.PI / 4 });
  P.box(0.012, 0.05, 0.012, 0xd9b44a, 0, -len - 0.07, 0);
  const pivot = new THREE.Group();
  pivot.position.set(0.02, yTop - 0.115, zTop + 0.045);
  P.flush(pivot);
  const swing = { x: 0, z: 0, vx: 0, vz: 0, t: 0 };
  const mesh = pivot.children[0];
  if (mesh) {
    live(mesh, (m) => {
      const st = motion.sample();
      if (st.t !== swing.t) {
        const dt = Math.min(0.05, st.t - swing.t);
        swing.t = st.t;
        // a damped pendulum pushed by braking and cornering
        const tx = Math.max(-0.6, Math.min(0.6, -st.accel * 0.06));
        const tz = Math.max(-0.6, Math.min(0.6, st.lat * 0.05));
        swing.vx += ((tx - swing.x) * 40 - swing.vx * 2.5) * dt;
        swing.vz += ((tz - swing.z) * 40 - swing.vz * 2.5) * dt;
        swing.x += swing.vx * dt;
        swing.z += swing.vz * dt;
      }
      m.rotation.set(swing.x, 0, swing.z);
    });
  }
  return pivot;
}
