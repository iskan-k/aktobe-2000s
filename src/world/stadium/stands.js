import * as THREE from 'three';
import { cel, MAT } from '../../core/toon.js';
import { ROW, FRONT_H, STANDS, standToWorld, standRect, COL } from './layout.js';
import { facadeTex, boardTex } from './textures.js';
import { panelAt } from './util.js';

/* ------------------------------------------------------------------ *
 * The four stands.
 *
 * Each stand is built in its own frame (x = out from the pitch, y up,
 * z = along the stand) and turned into the world by its yaw. The
 * concrete body is one stepped profile extruded along the stand, so the
 * terraces are real steps and the end walls come free as the caps.
 * Every row is walkable ground with a collider as high as its tread, so
 * you climb the terraces a row at a time and cannot walk into the side
 * of a stand from the ground.
 *
 *   west    the main stand: 24 rows of red plastic seats, VIP seats in
 *           the middle, the press box on the top walkway, a steel roof
 *   east    20 rows of seats, АКТОБЕ spelled in white seats on red
 *   north   14 rows of painted benches, red and white by sector
 *   south   the same, with the scoreboard behind it
 * ------------------------------------------------------------------ */

const AISLE_EVERY = 19;   // metres between aisles
const AISLE_W = 1.3;
const SEAT_PITCH = 0.5;

const rowY = (r) => FRONT_H + r * ROW.rise;

function standMatrix(s) {
  return new THREE.Matrix4().compose(
    new THREE.Vector3(s.origin.x, 0, s.origin.z),
    new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), s.yaw),
    new THREE.Vector3(1, 1, 1),
  );
}

/** A box in a stand's own frame: (out, y, along) is the centre of its base. */
function lbox(b, s, w, h, d, color, out, y, along, o = {}) {
  const p = standToWorld(s, out, along);
  b.box(w, h, d, color, p.x, y, p.z, { ...o, ry: s.yaw + (o.ry || 0) });
}

function aislesOf(s) {
  const n = Math.max(1, Math.round(s.len / AISLE_EVERY));
  const out = [];
  for (let i = 0; i <= n; i++) out.push(0.9 + ((s.len - 1.8) * i) / n);
  return out;
}

/* ---------------- concrete ---------------- */

function body(b, s, M) {
  const sh = new THREE.Shape();
  sh.moveTo(0, 0);
  sh.lineTo(0, FRONT_H);
  for (let r = 0; r < s.rows; r++) {
    const y = rowY(r);
    sh.lineTo((r + 1) * ROW.depth, y);
    if (r < s.rows - 1) sh.lineTo((r + 1) * ROW.depth, rowY(r + 1));
  }
  sh.lineTo(s.depth, s.top);
  sh.lineTo(s.depth, 0);
  sh.closePath();
  const g = new THREE.ExtrudeGeometry(sh, { depth: s.len, bevelEnabled: false, steps: 1, curveSegments: 1 });
  g.applyMatrix4(M);
  b.add(g, { color: COL.concrete });
  g.dispose();
  // parapet round the back of the top walkway
  lbox(b, s, 0.3, 1.1, s.len, COL.concreteLight, s.depth - 0.15, s.top, s.len / 2);
  // the front wall painted red with a white band, and its coping
  lbox(b, s, 0.03, FRONT_H - 0.05, s.len, COL.red, -0.015, 0, s.len / 2);
  lbox(b, s, 0.035, 0.18, s.len, COL.white, -0.02, FRONT_H - 0.45, s.len / 2);
  // the end walls get a painted edge too, so they read against the sky
  for (const a of [0, s.len]) {
    lbox(b, s, s.depth, 0.3, 0.06, COL.concreteDark, s.depth / 2, s.top + 0.8, a);
  }
}

/** Painted tread edges: a thin white strip at every row nose, as the steps were marked. */
function noses(b, s) {
  for (let r = 1; r < s.rows; r += 1) {
    lbox(b, s, 0.06, 0.02, s.len, r % 5 === 0 ? COL.white : COL.concreteLight, r * ROW.depth - 0.03, rowY(r - 1), s.len / 2, { cast: false });
  }
}

/** Aisle stairs: a half step in every row, and steps from the grass up to the first row. */
function aisles(b, ctx, s) {
  const { ground } = ctx;
  for (const a of aislesOf(s)) {
    for (let r = 0; r < s.rows; r++) {
      lbox(b, s, ROW.depth / 2, ROW.rise / 2, AISLE_W, COL.concreteLight, r * ROW.depth + ROW.depth * 0.75, rowY(r), a, { cast: false });
    }
    // three steps up the front wall from the grass
    const steps = 3;
    for (let i = 0; i < steps; i++) {
      const h = (FRONT_H * (i + 1)) / (steps + 1);
      const o0 = -0.4 * (steps - i), o1 = o0 + 0.4;
      lbox(b, s, 0.4, h, AISLE_W, COL.concreteLight, (o0 + o1) / 2, 0, a, { cast: false });
      const [x0, z0, x1, z1] = standRect(s, o0, o1, a - AISLE_W / 2, a + AISLE_W / 2);
      ground.flat(x0, z0, x1, z1, h, 'stand-steps');
    }
    // handrails either side of the steps
    for (const side of [-1, 1]) {
      const p0 = standToWorld(s, -0.4 * steps, a + side * (AISLE_W / 2 + 0.05));
      const p1 = standToWorld(s, 0, a + side * (AISLE_W / 2 + 0.05));
      b.tube(p0.x, 0.95, p0.z, p1.x, FRONT_H + 0.95, p1.z, 0.03, COL.steel, { seg: 5 });
      b.tube(p0.x, 0, p0.z, p0.x, 0.95, p0.z, 0.03, COL.steel, { seg: 5 });
    }
  }
}

/** The railing along the front of the first row, broken at the aisles. */
function frontRail(b, s) {
  const as = aislesOf(s);
  for (let i = 0; i < as.length - 1; i++) {
    const a0 = as[i] + AISLE_W / 2 + 0.1, a1 = as[i + 1] - AISLE_W / 2 - 0.1;
    const p0 = standToWorld(s, 0.12, a0), p1 = standToWorld(s, 0.12, a1);
    b.tube(p0.x, FRONT_H + 0.95, p0.z, p1.x, FRONT_H + 0.95, p1.z, 0.03, COL.steel, { seg: 5 });
    b.tube(p0.x, FRONT_H + 0.5, p0.z, p1.x, FRONT_H + 0.5, p1.z, 0.02, COL.steel, { seg: 4, cast: false });
    const n = Math.max(1, Math.round((a1 - a0) / 2.5));
    for (let k = 0; k <= n; k++) {
      const p = standToWorld(s, 0.12, a0 + ((a1 - a0) * k) / n);
      b.cyl(0.03, 0.95, COL.steel, p.x, FRONT_H, p.z, { seg: 5, cast: false });
    }
  }
}

/** Walkable rows and the colliders that keep the ground-level walker out of the concrete. */
function physics(ctx, s) {
  const { ground, colliders } = ctx;
  for (let r = 0; r < s.rows; r++) {
    const last = r === s.rows - 1;
    const o0 = r * ROW.depth, o1 = last ? s.depth - 0.3 : (r + 1) * ROW.depth;
    const [x0, z0, x1, z1] = standRect(s, o0, o1, 0, s.len);
    ground.flat(x0, z0, x1, z1, rowY(r), 'stand');
    colliders.box(x0, z0, x1, z1, { top: rowY(r), tag: 'stand' });
  }
  const [x0, z0, x1, z1] = standRect(s, s.depth - 0.3, s.depth + 0.36, 0, s.len);
  colliders.box(x0, z0, x1, z1, { top: s.top + 1.1, tag: 'stand-back' });
  // the end walls rise above a walker on the rows: keep people from stepping off the ends
  for (const a of [0, s.len]) {
    const [ex0, ez0, ex1, ez1] = standRect(s, 0.3, s.depth - 0.3, a - 0.05, a + 0.05);
    colliders.box(ex0, ez0, ex1, ez1, { top: s.top + 0.3, bottom: FRONT_H + 0.8, tag: 'stand-end' });
  }
}

/* ---------------- seats ---------------- */

let seatGeo = null;
/** A moulded plastic seat: pan and back, in the stand frame (back toward +out). */
function seatGeometry() {
  if (seatGeo) return seatGeo;
  const pan = new THREE.BoxGeometry(0.34, 0.07, 0.44);
  pan.translate(-0.02, 0.4, 0);
  const back = new THREE.BoxGeometry(0.06, 0.34, 0.42);
  back.rotateZ(-0.12);
  back.translate(0.17, 0.6, 0);
  // no legs: under the pan they are lost in shadow, and 9000 of them cost 100 k triangles
  const parts = [pan, back].map((g) => g.toNonIndexed());
  const n = parts.reduce((a, g) => a + g.attributes.position.count, 0);
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), col = new Float32Array(n * 3).fill(1);
  let o = 0;
  parts.forEach((g) => {
    pos.set(g.attributes.position.array, o * 3);
    nor.set(g.attributes.normal.array, o * 3);
    o += g.attributes.position.count;
  });
  seatGeo = new THREE.BufferGeometry();
  seatGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  seatGeo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  seatGeo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return seatGeo;
}

/** Which seats of the east stand spell the club name: a row x column mask. */
function letterMask(text, cols, rows) {
  const c = document.createElement('canvas');
  c.width = cols;
  c.height = rows;
  const g = c.getContext('2d', { willReadFrequently: true });
  g.fillStyle = '#000';
  g.fillRect(0, 0, cols, rows);
  g.fillStyle = '#fff';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.font = `bold ${Math.round(rows * 0.8)}px Arial, sans-serif`;
  const w = g.measureText(text).width;
  g.save();
  g.translate(cols / 2, rows / 2 + 1);
  g.scale(Math.min(1, (cols * 0.8) / w) * 1.6, 1);
  g.fillText(text, 0, 0);
  g.restore();
  const d = g.getImageData(0, 0, cols, rows).data;
  return (col, row) => d[(row * cols + col) * 4] > 110;
}

/**
 * Seat positions of a plastic-seat stand, with their colours. The VIP
 * block in the middle of the west stand has wider padded seats.
 */
function seatList(s, key) {
  const list = [];
  const as = aislesOf(s);
  const inAisle = (a) => as.some((x) => Math.abs(a - x) < AISLE_W / 2 + 0.2);
  const cols = Math.floor(s.len / SEAT_PITCH);
  const mask = s.letters ? letterMask(s.letters, cols, s.rows) : null;
  const vip = key === 'west' ? { a0: s.len / 2 - 9, a1: s.len / 2 + 9, r0: 7, r1: 13 } : null;
  for (let r = 0; r < s.rows; r++) {
    for (let i = 0; i < cols; i++) {
      const a = (i + 0.5) * SEAT_PITCH;
      if (inAisle(a)) continue;
      const isVip = vip && r >= vip.r0 && r <= vip.r1 && a > vip.a0 && a < vip.a1;
      if (isVip && i % 5 === 4) continue;   // padded seats are wider: fewer of them
      let color = COL.red;
      if (mask) {
        // the viewer on the pitch sees along running left to right
        const lit = mask(i, s.rows - 1 - r);
        color = lit ? COL.white : COL.red;
      } else if (isVip) {
        color = 0x6a1418;
      } else if (key === 'west' && (r === 0 || r === s.rows - 1)) {
        color = COL.white;
      }
      list.push({ out: r * ROW.depth + 0.42, y: rowY(r), along: a, color, wide: isVip });
    }
  }
  return list;
}

function plasticSeats(ctx, stands) {
  const all = [];
  for (const [key, s] of stands) {
    for (const seat of seatList(s, key)) all.push({ s, ...seat });
  }
  const mesh = new THREE.InstancedMesh(seatGeometry(), MAT.solid, all.length);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), sc = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0), c = new THREE.Color();
  all.forEach((seat, i) => {
    const w = standToWorld(seat.s, seat.out, seat.along);
    p.set(w.x, seat.y, w.z);
    q.setFromAxisAngle(up, seat.s.yaw);
    sc.set(seat.wide ? 1.15 : 1, seat.wide ? 1.1 : 1, seat.wide ? 1.2 : 1);
    m.compose(p, q, sc);
    mesh.setMatrixAt(i, m);
    mesh.setColorAt(i, c.set(seat.color));
  });
  mesh.instanceMatrix.needsUpdate = true;
  mesh.instanceColor.needsUpdate = true;
  mesh.castShadow = false;
  mesh.receiveShadow = true;
  mesh.computeBoundingSphere();
  mesh.name = 'stadium-seats';
  ctx.root.add(mesh);
  return all.length;
}

/**
 * Wooden benches on steel feet, painted red and white by sector, the
 * risers under them painted to match, so from the pitch each sector
 * reads as a block of colour.
 */
function benches(b, s) {
  const as = aislesOf(s);
  for (let r = 0; r < s.rows; r++) {
    for (let i = 0; i < as.length - 1; i++) {
      const a0 = as[i] + AISLE_W / 2 + 0.1, a1 = as[i + 1] - AISLE_W / 2 - 0.1;
      const color = i % 2 ? COL.white : COL.red;
      const out = r * ROW.depth + 0.4, y = rowY(r);
      if (r > 0) lbox(b, s, 0.03, ROW.rise, a1 - a0 + 0.2, i % 2 ? 0xe4dfd4 : COL.redDark, r * ROW.depth - 0.02, rowY(r - 1), (a0 + a1) / 2, { cast: false });
      lbox(b, s, 0.38, 0.07, a1 - a0, color, out, y + 0.38, (a0 + a1) / 2);
      const n = Math.max(1, Math.round((a1 - a0) / 2));
      for (let k = 0; k <= n; k++) {
        lbox(b, s, 0.05, 0.4, 0.05, COL.steelDark, out, y, a0 + 0.1 + ((a1 - a0 - 0.2) * k) / n, { cast: false });
      }
    }
  }
}

/* ---------------- the backs ---------------- */

let facadeMat = null;
function facade(b, s, M) {
  if (!facadeMat) facadeMat = cel({ map: facadeTex(), cache: false, grime: 0.04, dirt: 0.3 });
  const h = s.top + 1.1;
  const g = new THREE.PlaneGeometry(s.len, h);
  g.rotateY(Math.PI / 2);
  g.translate(s.depth + 0.02, h / 2, s.len / 2);
  const pos = g.attributes.position, uv = g.attributes.uv;
  for (let i = 0; i < pos.count; i++) uv.setXY(i, pos.getZ(i) / 6, pos.getY(i) / 6);
  g.applyMatrix4(M);
  b.add(g, { mat: facadeMat, color: null });
  g.dispose();
  // pilasters every 6 m, and a red band with a white line along the top
  const doors = aislesOf(s);
  for (let a = 3; a < s.len - 1; a += 6) {
    if (doors.some((d) => Math.abs(d - a) < 1.7)) continue;
    lbox(b, s, 0.35, h - 0.9, 0.7, COL.concreteLight, s.depth + 0.17, 0, a);
  }
  lbox(b, s, 0.12, 0.7, s.len, COL.red, s.depth + 0.06, h - 0.85, s.len / 2, { cast: false });
  lbox(b, s, 0.14, 0.12, s.len, COL.white, s.depth + 0.07, h - 1.05, s.len / 2, { cast: false });
  // ground-floor doors into the stand, one behind every aisle
  for (const a of aislesOf(s)) {
    lbox(b, s, 0.08, 2.4, 2.2, 0x4a4238, s.depth + 0.04, 0, a);
    lbox(b, s, 0.1, 0.12, 2.5, COL.concreteDark, s.depth + 0.05, 2.4, a);
  }
}

/* ---------------- the main stand ---------------- */

/**
 * The steel roof over the main stand: columns on the top walkway, a
 * truss from each one cantilevered out over the rows, profiled sheet on
 * top, a red fascia at the front edge.
 */
function roof(b, colliders, s) {
  const back = s.depth - 0.7, tip = -1.2;
  const yBack = s.top + 8.2, yTip = s.top + 6.4;
  const L = back - tip + 0.9;
  const tilt = Math.atan2(yBack - yTip, back - tip);
  const n = Math.round(s.len / 9.5);
  const yAt = (o) => yTip + ((o - tip) / (back - tip)) * (yBack - yTip);
  for (let i = 0; i <= n; i++) {
    const a = 0.4 + ((s.len - 0.8) * i) / n;
    const col = standToWorld(s, back, a);
    b.cyl(0.26, yBack - s.top, COL.steelDark, col.x, s.top, col.z, { seg: 8 });
    colliders.circle(col.x, col.z, 0.28, { bottom: s.top - 0.2, tag: 'roof-column' });
    // the truss: top chord under the sheet, bottom chord rising to meet it at the tip
    const low = s.top + 4.6;
    const p = (o, y) => { const w = standToWorld(s, o, a); return [w.x, y, w.z]; };
    const T0 = p(back, yBack - 0.25), T1 = p(tip, yTip - 0.25);
    const B0 = p(back, low);
    b.tube(...T0, ...T1, 0.12, COL.steel, { seg: 6 });
    b.tube(...B0, ...T1, 0.1, COL.steel, { seg: 6 });
    const k = 6;
    for (let j = 0; j < k; j++) {
      const t0 = j / k, t1 = (j + 1) / k;
      const oA = back + (tip - back) * t0, oB = back + (tip - back) * t1;
      const lowA = low + (yTip - 0.25 - low) * t0, lowB = low + (yTip - 0.25 - low) * t1;
      b.tube(...p(oA, lowA), ...p(oB, yAt(oB) - 0.25), 0.05, COL.steel, { seg: 4, cast: false });
      b.tube(...p(oB, lowB), ...p(oB, yAt(oB) - 0.25), 0.05, COL.steel, { seg: 4, cast: false });
    }
    // a back stay down to the parapet
    b.tube(...p(back, yBack - 0.25), ...p(s.depth - 0.1, s.top + 1.1), 0.06, COL.steelDark, { seg: 4 });
  }
  // the sheet, in bays so the ridges of the profiled steel read
  const mid = (back + tip) / 2 - 0.45 + 0.45;
  lbox(b, s, L, 0.14, s.len + 1.2, 0xd8d6d0, mid, yAt(mid) - 0.1, s.len / 2, { rz: tilt, closed: true });
  for (let a = 1.5; a < s.len; a += 3) {
    lbox(b, s, L - 0.4, 0.05, 0.12, 0xc4c2bc, mid, yAt(mid) + 0.04, a, { rz: tilt, cast: false });
  }
  // the fascia: red, a white line
  lbox(b, s, 0.2, 0.9, s.len + 1.3, COL.red, tip - 0.5, yTip - 0.75, s.len / 2, { closed: true });
  lbox(b, s, 0.22, 0.12, s.len + 1.32, COL.white, tip - 0.5, yTip - 0.45, s.len / 2, { cast: false });
}

/** The glazed press box on the top walkway, with the TV platform beside it. */
function pressBox(ctx, b, s) {
  const { colliders } = ctx;
  const a0 = s.len / 2 - 10, a1 = s.len / 2 + 10;
  const o0 = s.rows * ROW.depth + 0.4, o1 = s.depth - 0.35;
  const y = s.top, h = 2.9;
  lbox(b, s, o1 - o0, 0.9, a1 - a0, COL.concreteLight, (o0 + o1) / 2, y, (a0 + a1) / 2);
  lbox(b, s, 0.06, h - 1.2, a1 - a0 - 0.2, 0x2c3a44, o0 + 0.03, y + 0.9, (a0 + a1) / 2, { mat: 'glass' });
  for (let a = a0; a <= a1 + 0.01; a += 2) lbox(b, s, 0.1, h - 0.9, 0.1, 0xe8e4da, o0 + 0.05, y + 0.9, a);
  for (const a of [a0, a1]) lbox(b, s, o1 - o0, h, 0.2, 0xe8e4da, (o0 + o1) / 2, y, a);
  lbox(b, s, o1 - o0 + 0.6, 0.3, a1 - a0 + 0.6, 0xe8e4da, (o0 + o1) / 2 - 0.2, y + h, (a0 + a1) / 2, { closed: true });
  const [x0, z0, x1, z1] = standRect(s, o0, o1, a0, a1);
  colliders.box(x0, z0, x1, z1, { top: y + h + 0.3, tag: 'press' });
  panelAt(ctx.batch, boardTex('press', ['ПРЕСС-ЦЕНТР · БАСПАСӨЗ'], { bg: '#f2efe8', fg: '#8e1a1f', border: '#c0242a', w: 1024, h: 128 }),
    6, 0.75, standToWorld(s, o0 - 0.02, (a0 + a1) / 2), y + h - 0.02, s.yaw + Math.PI / 2);
  // the TV platform: a scaffold deck with a camera on its tripod
  const ta = a1 + 3;
  lbox(b, s, 2.2, 0.12, 2.4, COL.steelDark, o0 + 0.6, y + 1.2, ta, { closed: true });
  for (const [dx, da] of [[-0.9, -1], [0.9, -1], [-0.9, 1], [0.9, 1]]) lbox(b, s, 0.07, 1.2, 0.07, COL.steel, o0 + 0.6 + dx, y, ta + da);
  lbox(b, s, 0.5, 0.35, 0.3, 0x2a2c2e, o0 + 0.3, y + 2.3, ta);
  lbox(b, s, 0.2, 0.18, 0.18, 0x1e2022, o0 - 0.05, y + 2.38, ta);
  const w = standToWorld(s, o0 + 0.3, ta);
  b.cyl(0.03, 1.0, 0x2a2c2e, w.x, y + 1.32, w.z, { seg: 5 });
}

/** Glass screens either side of the VIP block, and a padded rail in front of it. */
function vipBox(b, s) {
  const a0 = s.len / 2 - 9, a1 = s.len / 2 + 9;
  const o0 = 7 * ROW.depth, o1 = 14 * ROW.depth;
  for (const a of [a0, a1]) {
    for (let r = 7; r < 14; r++) lbox(b, s, ROW.depth, 1.1, 0.05, 0x7aa0b0, r * ROW.depth + ROW.depth / 2, rowY(r), a, { mat: 'glass', cast: false });
  }
  lbox(b, s, 0.12, 0.9, a1 - a0, 0x6a1418, o0 + 0.06, rowY(6), (a0 + a1) / 2);
  void o1;
}

/* ---------------- banners on the stands ---------------- */

function banners(ctx, stands) {
  const hang = [
    ['north', 'fan-n', ['АЛҒА, АҚТӨБЕ!', 'ВПЕРЁД, КРАСНО-БЕЛЫЕ!']],
    ['south', 'fan-s', ['АҚТӨБЕ — ЧЕМПИОН!', 'ЧЕМПИОН КАЗАХСТАНА 2005']],
  ];
  for (const [key, id, lines] of hang) {
    const s = stands[key];
    const tex = boardTex(id, lines, { bg: '#c0242a', fg: '#ffffff', w: 1536, h: 256, wear: 0.25 });
    // hung over the parapet, facing the pitch
    const p = standToWorld(s, s.depth - 0.34, s.len / 2);
    panelAt(ctx.batch, tex, 18, 2.6, p, s.top - 1.6, s.yaw + Math.PI / 2);
  }
}

export function buildStands(ctx) {
  const b = ctx.batch;
  const list = Object.entries(STANDS);
  for (const [key, s] of list) {
    const M = standMatrix(s);
    body(b, s, M);
    noses(b, s);
    aisles(b, ctx, s);
    frontRail(b, s);
    physics(ctx, s);
    facade(b, s, M);
    if (s.seats === 'bench') benches(b, s);
    if (key === 'west') {
      roof(b, ctx.colliders, s);
      pressBox(ctx, b, s);
      vipBox(b, s);
    }
  }
  const seats = plasticSeats(ctx, list.filter(([, s]) => s.seats === 'plastic'));
  banners(ctx, STANDS);
  return { seats };
}

export { rowY, aislesOf };
