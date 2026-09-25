import * as THREE from 'three';
import { cel, flat } from '../core/toon.js';
import { canvasTex, cached, centerText, FONT, weather } from '../core/textures.js';
import { texPlane, letters } from '../world/buildings/landmarks.js';
import { STATION, PLATFORM } from './layout.js';

/* ------------------------------------------------------------------ *
 * Aktobe-1, the station house.
 *
 * A long white two-storey hall with light blue bands, its front and back
 * a row of tall blue lancet niches, АКТОБЕ in blue letters on the roof.
 * At the east end a taller block wears a crown of pointed gables over
 * the ҚАЗАҚСТАН ТЕМІР ЖОЛЫ sign, a big lancet window and the clock.
 * On the platform side a canopy on slim columns runs the length of it.
 * ------------------------------------------------------------------ */

const WHITE = 0xf1efe7;
const BLUE = 0x7fb8e6;
const DEEP_BLUE = 0x2f6fc0;
const ROOF = 0x8a8c88;
const HALL = { x0: STATION.x0, x1: -30, z0: STATION.zBack, z1: STATION.zBack + STATION.depth, h: 12 };
const TOWER = { x0: -30, x1: STATION.x1, z0: STATION.zBack, z1: STATION.zBack + 20, h: 19 };
const BAY = HALL.x1 - HALL.x0;
const NICHES = 20;
export const ENTRANCE = { x: (HALL.x0 + HALL.x1) / 2, z: HALL.z1 };

/* ---------------- textures ---------------- */

/** One bay: a pointed blue niche with glazing, bands above and below. 256 px = bay width. */
function lancetTex() {
  return cached('station|lancet', () => canvasTex(256, 832, (c, W, H) => {
    const m = H / HALL.h;                       // px per metre
    c.fillStyle = '#f1efe7';
    c.fillRect(0, 0, W, H);
    // bands: frieze under the parapet, plinth at the foot
    c.fillStyle = '#7fb8e6';
    c.fillRect(0, 0.25 * m, W, 0.4 * m);
    c.fillRect(0, H - 0.9 * m, W, 0.9 * m);
    c.fillStyle = '#6aa4d4';
    c.fillRect(0, H - 0.95 * m, W, 0.06 * m);
    // the niche
    const nw = W * 0.62, x0 = (W - nw) / 2, top = 1.3 * m, bottom = H - 1.4 * m, arch = 1.7 * m;
    const lancet = (inset) => {
      c.beginPath();
      c.moveTo(x0 + inset, bottom);
      c.lineTo(x0 + inset, top + arch);
      c.quadraticCurveTo(x0 + inset, top + inset * 0.6, W / 2, top + inset);
      c.quadraticCurveTo(x0 + nw - inset, top + inset * 0.6, x0 + nw - inset, top + arch);
      c.lineTo(x0 + nw - inset, bottom);
      c.closePath();
    };
    c.fillStyle = '#d9d6cc';
    lancet(-6); c.fill();
    const g = c.createLinearGradient(0, top, 0, bottom);
    g.addColorStop(0, '#3a7cc6');
    g.addColorStop(1, '#2f69ad');
    c.fillStyle = g;
    lancet(0); c.fill();
    // glazing inside, split by the floor line
    const gl = c.createLinearGradient(0, top, 0, bottom);
    gl.addColorStop(0, '#9fc3dc');
    gl.addColorStop(0.5, '#4e6f86');
    gl.addColorStop(1, '#3c566a');
    c.fillStyle = gl;
    lancet(16); c.fill();
    c.fillStyle = '#e8eef2';
    const floor = top + (bottom - top) * 0.52;
    c.fillRect(x0 + 10, floor - 5, nw - 20, 10);
    for (const f of [0.33, 0.67]) c.fillRect(x0 + nw * f - 2, top + arch, 4, bottom - top - arch);
    c.fillRect(x0 + 10, top + (floor - top) * 0.5, nw - 20, 4);
    c.fillRect(x0 + 10, floor + (bottom - floor) * 0.5, nw - 20, 4);
    c.fillStyle = 'rgba(255,255,255,0.18)';
    c.fillRect(x0 + nw * 0.2, top + arch, 10, bottom - top - arch);
    weather(c, W, H, 81, 0.6);
  }, { repeat: [1, 1] }));
}

function lancetMat() {
  return cached('station|lancet-mat', () => cel({ map: lancetTex(), grime: 0.03, dirt: 0.25, cache: false }));
}

/** The tower's great window: a single lancet of blue glass with a grid. */
function towerWindowTex() {
  return cached('station|tower-window', () => canvasTex(256, 512, (c, W, H) => {
    c.clearRect(0, 0, W, H);
    const shape = (inset) => {
      c.beginPath();
      c.moveTo(inset, H);
      c.lineTo(inset, H * 0.28);
      c.quadraticCurveTo(inset, inset, W / 2, inset);
      c.quadraticCurveTo(W - inset, inset, W - inset, H * 0.28);
      c.lineTo(W - inset, H);
      c.closePath();
    };
    c.fillStyle = '#2f6fc0';
    shape(0); c.fill();
    const g = c.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#a8cbe4');
    g.addColorStop(0.55, '#4f7898');
    g.addColorStop(1, '#3a5a72');
    c.fillStyle = g;
    shape(12); c.fill();
    c.fillStyle = '#e6eef4';
    for (let i = 1; i < 5; i++) c.fillRect((W * i) / 5 - 2, 20, 4, H);
    for (let j = 1; j < 9; j++) c.fillRect(0, (H * j) / 9 - 2, W, 4);
    c.fillStyle = 'rgba(255,255,255,0.16)';
    c.fillRect(W * 0.18, 30, 16, H);
  }));
}

function signTex(text, w, h, size) {
  return cached(`station|sign|${text}`, () => canvasTex(w, h, (c) => {
    c.clearRect(0, 0, w, h);
    centerText(c, text, w / 2, h / 2, w * 0.98, size, '#2f6fc0', { family: FONT.display, weight: '800' });
  }));
}

function dialTex() {
  return cached('station|dial', () => canvasTex(256, 256, (c, W) => {
    const r = W / 2;
    c.fillStyle = '#2f6fc0';
    c.beginPath(); c.arc(r, r, r, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#f7f5ee';
    c.beginPath(); c.arc(r, r, r - 12, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#1d2a36';
    for (let i = 0; i < 12; i++) {
      c.save();
      c.translate(r, r);
      c.rotate((i * Math.PI) / 6);
      c.fillRect(-4, -r + 22, 8, i % 3 ? 18 : 30);
      c.restore();
    }
  }));
}

/* ---------------- geometry ---------------- */

function gable(w, h, t) {
  const s = new THREE.Shape();
  s.moveTo(-w / 2, 0);
  s.lineTo(w / 2, 0);
  s.lineTo(0, h);
  s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: t, bevelEnabled: false });
  g.translate(0, 0, -t / 2);
  return g;
}

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _v = new THREE.Vector3();
const _one = new THREE.Vector3(1, 1, 1);
const _e = new THREE.Euler();

/** A row of pointed gables along one side of the tower's top. */
function crownSide(b, cx, cz, len, ry, y) {
  const n = Math.max(3, Math.round(len / 4.4));
  const w = len / n;
  const big = gable(w, 2.8, 0.4), inner = gable(w * 0.46, 1.5, 0.44);
  for (let i = 0; i < n; i++) {
    const u = -len / 2 + w * (i + 0.5);
    _v.set(cx + Math.cos(ry) * u, y, cz - Math.sin(ry) * u);
    _q.setFromEuler(_e.set(0, ry, 0));
    _m.compose(_v, _q, _one);
    b.add(big, { color: WHITE, matrix: _m });
    _v.y = y + 0.35;
    _m.compose(_v, _q, _one);
    b.add(inner, { color: DEEP_BLUE, matrix: _m });
  }
}

function hall(ctx) {
  const b = ctx.batch;
  const { x0, x1, z0, z1, h } = HALL;
  const xc = (x0 + x1) / 2, zc = (z0 + z1) / 2;
  b.span(x0, 0, z0 + 0.05, x1, h, z1 - 0.05, WHITE);
  const mat = lancetMat();
  const tile = BAY / NICHES;
  texPlane(b, mat, BAY, h, xc, 0, z1 + 0.01, Math.PI, { tileU: tile, tileV: h, cast: true });
  texPlane(b, mat, BAY, h, xc, 0, z0 - 0.01, 0, { tileU: tile, tileV: h, cast: true });
  // end wall bands
  b.span(x0 - 0.02, 0, z0, x0, 0.9, z1, BLUE);
  b.span(x0 - 0.02, h - 0.65, z0, x0, h - 0.25, z1, BLUE);
  // parapet and roof
  b.span(x0 - 0.15, h, z0 - 0.15, x1, h + 0.12, z1 + 0.15, 0xdedbd2);
  b.span(x0, h + 0.12, z0, x1, h + 0.2, z1, ROOF, { cast: false });
  for (let i = 0; i < 5; i++) b.box(2.2, 1.1, 1.6, 0x9a9c98, x0 + 10 + i * 13, h + 0.2, zc + 2);
  ctx.colliders.box(x0, z0, x1, z1, { top: h, tag: 'station' });
  entrance(ctx, xc, z1);
  letters(ctx.root, 'АКТОБЕ', xc, h + 0.25, z1 - 1.2, Math.PI, { width: 17, height: 2.6, color: '#2f6fc0', back: '#1b3f73' });
  for (let i = -3; i <= 3; i++) b.box(0.12, 0.3 + (i % 2 ? 0 : 0.2), 0.12, 0x5a5d5f, xc + i * 2.6, h + 0.2, z1 - 1.25);
  b.box(18, 0.1, 0.12, 0x5a5d5f, xc, h + 0.45, z1 - 1.25);
}

function entrance(ctx, xc, zf) {
  const b = ctx.batch;
  const w = 14, d = 1.4, h = 7.2;
  b.box(w, h, d, WHITE, xc, 0, zf + d / 2);
  b.box(w + 0.1, 0.4, d + 0.05, BLUE, xc, h - 0.7, zf + d / 2);
  b.box(w + 0.1, 0.9, d + 0.05, BLUE, xc, 0, zf + d / 2);
  for (const dx of [-4, 0, 4]) {
    b.box(2.8, 3.0, 0.1, 0x2d3d48, xc + dx, 0.15, zf + d + 0.02, { mat: 'glass' });
    b.box(0.08, 3.0, 0.12, 0xd9dcd8, xc + dx, 0.15, zf + d + 0.03);
    b.box(2.9, 0.1, 0.12, 0xd9dcd8, xc + dx, 3.12, zf + d + 0.03);
  }
  // canopy on two columns
  const cz = zf + d + 1.6;
  b.box(w + 2, 0.35, 3.4, 0xe6e4dc, xc, 4.2, cz, { closed: true });
  b.box(w + 2.02, 0.2, 3.42, BLUE, xc, 4.35, cz);
  for (const s of [-1, 1]) {
    b.cyl(0.22, 4.2, WHITE, xc + s * (w / 2 - 0.4), 0, cz + 1.3, { seg: 10 });
    ctx.colliders.circle(xc + s * (w / 2 - 0.4), cz + 1.3, 0.3, { top: 4.2 });
  }
  const sign = cached('station|entry-sign-mat', () => flat({ map: signTex('АҚТӨБЕ ВОКЗАЛЫ · ВОКЗАЛ АКТОБЕ', 1024, 96, 64), alphaTest: 0.5 }));
  texPlane(b, sign, 12, 0.9, xc, 5.0, zf + d + 0.03, Math.PI);
  ctx.colliders.box(xc - w / 2, zf, xc + w / 2, zf + d, { top: h, tag: 'station' });
  // granite steps up to the doors
  b.box(w + 2, 0.15, 3.4, 0x8a3a32, xc, 0, cz);
  ctx.ground.flat(xc - w / 2 - 1, cz - 1.7, xc + w / 2 + 1, cz + 1.7, 0.15, 'steps');
}

function tower(ctx, clocks) {
  const b = ctx.batch;
  const { x0, x1, z0, z1, h } = TOWER;
  const xc = (x0 + x1) / 2, zc = (z0 + z1) / 2;
  b.span(x0, 0, z0, x1, h, z1, WHITE);
  for (const y of [0, h - 1.2]) b.span(x0 - 0.03, y, z0 - 0.03, x1 + 0.03, y + (y ? 0.5 : 0.9), z1 + 0.03, BLUE);
  b.span(x0 - 0.03, 12.1, z0 - 0.03, x1 + 0.03, 12.35, z1 + 0.03, BLUE);
  b.span(x0 - 0.1, h, z0 - 0.1, x1 + 0.1, h + 0.2, z1 + 0.1, 0xdedbd2);
  crownSide(b, xc, z1 - 0.2, x1 - x0, 0, h + 0.2);
  crownSide(b, xc, z0 + 0.2, x1 - x0, Math.PI, h + 0.2);
  crownSide(b, x1 - 0.2, zc, z1 - z0, Math.PI / 2, h + 0.2);
  crownSide(b, x0 + 0.2, zc, z1 - z0, -Math.PI / 2, h + 0.2);
  b.span(x0 + 0.3, h + 0.2, z0 + 0.3, x1 - 0.3, h + 0.3, z1 - 0.3, ROOF, { cast: false });

  // the great window, front and back
  const win = cached('station|tower-window-mat', () => cel({ map: towerWindowTex(), alphaTest: 0.5, grime: 0.01, dirt: 0, cache: false }));
  texPlane(b, win, 7, 10.5, xc, 0.9, z1 + 0.02, Math.PI);
  texPlane(b, win, 7, 10.5, xc, 0.9, z0 - 0.02, 0);
  b.box(8, 0.35, 0.5, WHITE, xc, 0.9, z1 + 0.25);
  // side windows in narrow lancets
  for (const side of [-1, 1]) {
    for (let i = 0; i < 4; i++) {
      const z = z0 + 3 + i * 4.6;
      const x = side < 0 ? x0 - 0.02 : x1 + 0.02;
      texPlane(b, win, 1.6, 7, x, 3, z, side < 0 ? Math.PI / 2 : -Math.PI / 2);
    }
  }
  const kzt = cached('station|ktzh-mat', () => flat({ map: signTex('ҚАЗАҚСТАН ТЕМІР ЖОЛЫ', 2048, 160, 120), alphaTest: 0.5 }));
  texPlane(b, kzt, 20, 1.5, xc, h - 3.1, z1 + 0.04, Math.PI);
  ctx.colliders.box(x0, z0, x1, z1, { top: h, tag: 'station' });
  return clocks.face(b, xc, 13.9, z1 + 0.05, Math.PI);
}

/*
 * Clocks: dials are baked into the batch, and every hand of every clock
 * is one instance of a single mesh, set once a frame.
 */
const _F = new THREE.Matrix4();
const _R = new THREE.Matrix4();
const _T = new THREE.Matrix4();
const _S = new THREE.Matrix4();

export function createClocks(root, capacity = 8) {
  const geo = new THREE.BoxGeometry(1, 1, 0.04);
  geo.translate(0, 0.5, 0);
  const hands = new THREE.InstancedMesh(geo, flat({ color: 0x1d2a36 }), capacity * 2);
  hands.name = 'clock-hands';
  hands.count = 0;
  hands.frustumCulled = false;
  root.add(hands);
  const faces = [];
  const dialMat = cached('station|dial-mat', () => flat({ map: dialTex() }));

  function hand(i, f, angle, len, w) {
    _F.copy(f.m).multiply(_R.makeRotationZ(-angle)).multiply(_T.makeTranslation(0, -0.09 * f.r, 0.03 + i * 0.002)).multiply(_S.makeScale(w, len, 1));
    hands.setMatrixAt(i, _F);
  }

  return {
    /** A dial looking toward yaw `facing` (0 = north), radius r. */
    face(batch, x, y, z, facing, r = 1.35) {
      if (faces.length >= capacity) throw new Error('clocks: capacity exceeded');
      _e.set(0, facing + Math.PI, 0);
      const m = new THREE.Matrix4().compose(_v.set(x, y, z), _q.setFromEuler(_e), _one);
      batch.add(new THREE.CircleGeometry(r, 32).applyMatrix4(m), { mat: dialMat, color: null, cast: false });
      faces.push({ m, r });
      hands.count = faces.length * 2;
      return { x, y, z };
    },
    /** Set every clock to `sec` seconds after midnight. */
    set(sec) {
      const minute = ((sec % 3600) / 3600) * Math.PI * 2;
      const hour = ((sec % 43200) / 43200) * Math.PI * 2;
      faces.forEach((f, k) => {
        hand(k * 2, f, hour, 0.53 * f.r, 0.09 * f.r);
        hand(k * 2 + 1, f, minute, 0.8 * f.r, 0.06 * f.r);
      });
      hands.instanceMatrix.needsUpdate = true;
    },
  };
}

function canopy(ctx) {
  const b = ctx.batch;
  const x0 = HALL.x0 + 1, x1 = TOWER.x1 - 1;
  const zBack = STATION.zBack, zEdge = PLATFORM.z0 + 0.8;
  const y = PLATFORM.y + 3.6;
  b.span(x0, y, zEdge, x1, y + 0.28, zBack, 0xe7e5de, { closed: true });
  b.span(x0 - 0.05, y + 0.28, zEdge - 0.05, x1 + 0.05, y + 0.5, zEdge + 0.25, BLUE);
  const n = Math.round((x1 - x0) / 7.5);
  for (let i = 0; i <= n; i++) {
    const x = x0 + ((x1 - x0) * i) / n;
    b.cyl(0.14, 3.6, 0xdcdad2, x, PLATFORM.y, zEdge + 0.8, { seg: 8 });
    b.box(0.2, 0.4, zBack - zEdge - 0.8, 0xcfcdc5, x, y - 0.4, (zEdge + 0.8 + zBack) / 2);
    ctx.colliders.circle(x, zEdge + 0.8, 0.2, { top: y });
    if (i < n) b.box(2.4, 0.06, 0.25, 0xfff4d8, x + 3.75, y - 0.06, zEdge + 2.6, { mat: 'glow', cast: false });
  }
  // platform-side doors under the canopy
  for (const dx of [-26, 0, 26]) {
    const x = ENTRANCE.x + dx;
    b.box(3, 2.8, 0.1, 0x2d3d48, x, PLATFORM.y, zBack - 0.02, { mat: 'glass' });
    b.box(3.2, 0.12, 0.14, 0xd9dcd8, x, PLATFORM.y + 2.8, zBack - 0.04);
  }
}

/** The whole station house. Returns the clock rig and the ticket hall door. */
export function buildStationHouse(ctx, clocks) {
  hall(ctx);
  const clk = tower(ctx, clocks);
  canopy(ctx);
  return { clock: clk, door: { x: ENTRANCE.x, z: ENTRANCE.z + 1.5 }, tower: TOWER, hall: HALL };
}
