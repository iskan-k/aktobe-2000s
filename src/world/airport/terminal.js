import * as THREE from 'three';
import { cel, flat } from '../../core/toon.js';
import { canvasTex, cached, centerText, FONT } from '../../core/textures.js';
import { rngKit } from '../../core/util.js';
import { PAL } from '../../core/palette.js';
import { tboxGeo, mtx } from '../buildings/houseKit.js';
import { flagpole } from '../buildings/civic.js';
import { TERMINAL, TOWER } from './layout.js';

/* ------------------------------------------------------------------ *
 * The terminal and the control tower.
 *
 * The aerovokzal opened in 1975 and was rebuilt in 2004, when the
 * airport went international: two low wings in pale composite cladding
 * with ribbon windows of blue-green glass, and between them a tall hall
 * glazed front and back under an arched roof, with a wavy canopy over
 * the doors. АҚТӨБЕ stands in letters on the roof on both sides; the
 * departures board by the doors reads the live flights.
 *
 * The tower (КДП) is the usual Soviet one: a two-storey block, a square
 * shaft, a gallery, the glazed cab leaning out, and a striped mast.
 * ------------------------------------------------------------------ */

const T = TERMINAL;
const HALL = { x0: T.hall[0], x1: T.hall[1] };
const WING_H = 8.6, HALL_H = 11.5, ARC = 3.2;
const CLAD = 0xe6e4de, ROOF = 0x8e9092, METAL = 0xc4c8ca;

/* ---------------- textures ---------------- */

/** One storey (4.2 m) by 6 m of cladding with a ribbon window. */
function ribbonTex() {
  return cached('aero-ribbon', () => canvasTex(256, 180, (c, W, H) => {
    const r = rngKit(31);
    c.fillStyle = '#e8e6e0';
    c.fillRect(0, 0, W, H);
    // cladding panel joints
    c.fillStyle = '#c8c6c0';
    for (let x = 0; x < W; x += W / 4) c.fillRect(x, 0, 2, H);
    c.fillRect(0, H * 0.22, W, 2);
    c.fillRect(0, H * 0.75, W, 2);
    // the window band: blue-green glass with a sky reflection and mullions
    const y0 = H * 0.24, y1 = H * 0.74;
    const g = c.createLinearGradient(0, y0, 0, y1);
    g.addColorStop(0, '#6f97a4');
    g.addColorStop(0.5, '#3f6676');
    g.addColorStop(1, '#2f4e5c');
    c.fillStyle = g;
    c.fillRect(0, y0, W, y1 - y0);
    c.fillStyle = 'rgba(255,255,255,0.12)';
    for (let i = 0; i < 3; i++) c.fillRect(r.range(0, W), y0, r.range(10, 40), y1 - y0);
    c.fillStyle = '#b8bcbc';
    for (let x = 0; x <= W; x += W / 4) c.fillRect(x - 2, y0, 4, y1 - y0);
    c.fillRect(0, y0, W, 3);
    c.fillRect(0, y1 - 3, W, 3);
  }, { repeat: [1, 1] }));
}

/** A 3 x 3 m bay of curtain wall: four panes, silver mullions, the sky in the glass. */
function curtainTex() {
  return cached('aero-curtain', () => canvasTex(128, 128, (c, W, H) => {
    const g = c.createLinearGradient(0, 0, W * 0.3, H);
    g.addColorStop(0, '#86aab4');
    g.addColorStop(0.55, '#4b7482');
    g.addColorStop(1, '#35596a');
    c.fillStyle = g;
    c.fillRect(0, 0, W, H);
    c.fillStyle = 'rgba(255,255,255,0.10)';
    c.beginPath();
    c.moveTo(W * 0.1, H); c.lineTo(W * 0.45, 0); c.lineTo(W * 0.62, 0); c.lineTo(W * 0.27, H);
    c.fill();
    c.fillStyle = '#c8cccc';
    c.fillRect(0, 0, W, 4);
    c.fillRect(0, H / 2 - 1.5, W, 3);
    c.fillRect(0, 0, 4, H);
    c.fillRect(W / 2 - 1.5, 0, 3, H);
  }, { repeat: [1, 1] }));
}

/** Letters on a transparent ground, for signs that stand free of any board. */
function lettersTex(key, text, { w = 1024, h = 160, color = '#f4f2ea', family = FONT.sans, weight = '800', stroke = '#26343c' } = {}) {
  return cached(`aero-letters|${key}`, () => canvasTex(w, h, (c) => {
    c.clearRect(0, 0, w, h);
    centerText(c, text, w / 2, h * 0.54, w * 0.96, h * 0.82, color, { family, weight, stretch: 0.92, stroke, strokeW: h * 0.04 });
  }));
}

/** The split-flap departures board, drawn once; the live lines come by message. */
function boardTex() {
  return cached('aero-board', () => canvasTex(512, 320, (c, W, H) => {
    c.fillStyle = '#1e2226';
    c.fillRect(0, 0, W, H);
    c.fillStyle = '#2c6a9a';
    c.fillRect(0, 0, W, 44);
    centerText(c, 'ВЫЛЕТ · ҰШУ', W / 2, 24, W - 20, 28, '#ffffff', { family: FONT.sans, weight: '800' });
    const rows = [['KC 941', 'АЛМАТЫ', '20:10'], ['5B 322', 'МОСКВА', '20:45'], ['DV 708', 'УРАЛЬСК', '21:30'], ['SL 103', 'АСТАНА', '22:05']];
    rows.forEach(([f, city, time], i) => {
      const y = 70 + i * 60;
      for (let k = 0; k < 20; k++) {
        c.fillStyle = '#111416';
        c.fillRect(14 + k * 24.5, y - 18, 22, 40);
        c.fillStyle = '#2a2e32';
        c.fillRect(14 + k * 24.5, y + 1, 22, 1);
      }
      c.fillStyle = '#f2e6b8';
      c.font = `700 30px ${FONT.mono}`;
      c.textBaseline = 'middle';
      c.fillText(f, 18, y + 2);
      c.fillText(city, 170, y + 2);
      c.fillText(time, 404, y + 2);
    });
  }));
}

/* ---------------- helpers ---------------- */

let ribbonMat = null, curtainMat = null;
const ribbon = () => (ribbonMat ||= cel({ map: ribbonTex(), vertexColors: true, grime: 0.04, dirt: 0.2, cache: false }));
const curtain = () => (curtainMat ||= flat({ map: curtainTex(), vertexColors: true, cache: false }));

/** A vertical glass quad from (x0, z) to (x1, z), y from y0 to y1, facing `face` (-1 north, +1 south). */
function glassStrip(batch, x0, x1, z, y0, y1, face) {
  const g = new THREE.PlaneGeometry(x1 - x0, y1 - y0);
  const uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, (uv.getX(i) * (x1 - x0) + x0) / 3, (uv.getY(i) * (y1 - y0) + y0) / 3);
  if (face < 0) g.rotateY(Math.PI);
  g.translate((x0 + x1) / 2, (y0 + y1) / 2, z);
  batch.add(g, { mat: curtain(), color: 0xffffff, cast: false });
}

const hallTop = (x) => {
  const u = (x - (HALL.x0 + HALL.x1) / 2) / ((HALL.x1 - HALL.x0) / 2);
  return HALL_H + ARC * (1 - u * u);
};

/**
 * Free-standing letters and the board face, packed into one canvas and
 * one alpha-tested mesh: one draw call for every sign at the terminal.
 */
class LetterSheet {
  constructor() { this.items = []; }

  add(tex, w, h, x, y, z, ry) { this.items.push({ img: tex.image, w, h, x, y, z, ry }); }

  flush(root) {
    const W = Math.max(...this.items.map((it) => it.img.width));
    let y = 0;
    const place = this.items.map((it) => { const p = y; y += it.img.height + 4; return p; });
    const H = THREE.MathUtils.ceilPowerOfTwo(y);
    const tex = canvasTex(W, H, (c) => {
      c.clearRect(0, 0, W, H);
      this.items.forEach((it, i) => c.drawImage(it.img, 0, place[i]));
    });
    const pos = [], nor = [], uv = [], idx = [];
    this.items.forEach((it, i) => {
      const n = [Math.sin(it.ry), 0, Math.cos(it.ry)], r = [Math.cos(it.ry), 0, -Math.sin(it.ry)];
      const u1 = it.img.width / W, vT = 1 - place[i] / H, vB = 1 - (place[i] + it.img.height) / H;
      const base = pos.length / 3;
      for (const [a, b, u, v] of [[-1, -1, 0, vB], [1, -1, u1, vB], [1, 1, u1, vT], [-1, 1, 0, vT]]) {
        pos.push(it.x + r[0] * a * it.w / 2, it.y + b * it.h / 2, it.z + r[2] * a * it.w / 2);
        nor.push(...n);
        uv.push(u, v);
      }
      idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
    });
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    g.computeBoundingSphere();
    const m = new THREE.Mesh(g, cel({ map: tex, alphaTest: 0.5, bands: 3, grime: 0, dirt: 0, cache: false }));
    m.name = 'airport-letters';
    m.matrixAutoUpdate = false;
    root.add(m);
  }
}

/* ---------------- the terminal ---------------- */

function wings(ctx) {
  const b = ctx.batch;
  for (const [x0, x1] of [[T.x0, HALL.x0], [HALL.x1, T.x1]]) {
    const w = x1 - x0, d = T.z1 - (T.z0 + 2), cx = (x0 + x1) / 2, cz = (T.z0 + 2 + T.z1) / 2;
    b.add(tboxGeo(w, WING_H, d, [6, 4.2]), { mat: ribbon(), color: 0xffffff, matrix: mtx(cx, 0, cz) });
    b.box(w + 0.1, 0.6, d + 0.1, PAL.concreteDark, cx, 0, cz);
    b.box(w + 0.3, 0.7, d + 0.3, CLAD, cx, WING_H - 0.1, cz);
    b.box(w - 0.4, 0.1, d - 0.4, ROOF, cx, WING_H + 0.35, cz);
    // air-conditioning units and a vent stack on the roof
    const r = rngKit(Math.round(x0));
    for (let i = 0; i < 4; i++) {
      b.box(2.2, 1.3, 1.6, 0xb8bcbe, x0 + 4 + i * (w - 8) / 3, WING_H + 0.45, cz + r.range(-5, 5));
    }
  }
}

function hall(ctx) {
  const b = ctx.batch;
  const n = 23, sw = (HALL.x1 - HALL.x0) / n;
  for (let i = 0; i < n; i++) {
    const x0 = HALL.x0 + i * sw, x1 = x0 + sw;
    const top = Math.min(hallTop(x0), hallTop(x1));
    glassStrip(b, x0, x1, T.z0 - 0.02, 0.6, top, -1);
    glassStrip(b, x0, x1, T.z1 + 0.02, 0.6, top, 1);
    // the arched roof in 2 m slats, and its fascia
    const xa = x0, xb = x1, ya = hallTop(xa), yb = hallTop(xb);
    const len = Math.hypot(xb - xa, yb - ya);
    b.box(len + 0.02, 0.55, T.z1 - T.z0 + 1.6, METAL, (xa + xb) / 2, (ya + yb) / 2 - 0.2, (T.z0 + T.z1) / 2, { rz: Math.atan2(yb - ya, xb - xa) });
    // mullions standing proud of the glass
    b.box(0.12, top - 0.6, 0.18, 0xbfc3c4, x0, 0.6, T.z0 - 0.08);
    b.box(0.12, top - 0.6, 0.18, 0xbfc3c4, x0, 0.6, T.z1 + 0.08);
  }
  // the hall's box behind the glass: dark interior, end walls in cladding
  b.box(HALL.x1 - HALL.x0 - 0.4, HALL_H, T.z1 - T.z0 - 0.4, 0x3a4248, (HALL.x0 + HALL.x1) / 2, 0, (T.z0 + T.z1) / 2);
  b.box(HALL.x1 - HALL.x0 + 0.2, 0.6, T.z1 - T.z0 + 0.2, PAL.concreteDark, (HALL.x0 + HALL.x1) / 2, 0, (T.z0 + T.z1) / 2);
  // the gallery floor line across the glass
  b.box(HALL.x1 - HALL.x0, 0.35, 0.3, CLAD, (HALL.x0 + HALL.x1) / 2, 4.6, T.z0 - 0.1);
  b.box(HALL.x1 - HALL.x0, 0.35, 0.3, CLAD, (HALL.x0 + HALL.x1) / 2, 4.6, T.z1 + 0.1);
}

/** The wavy canopy over the doors, on slender columns. */
function canopy(ctx) {
  const b = ctx.batch;
  const x0 = HALL.x0 - 4, x1 = HALL.x1 + 4, back = T.z0, y = 5.3;
  const depth = (x) => 6.2 + 1.1 * Math.sin(((x - x0) / (x1 - x0)) * Math.PI * 3);
  const s = new THREE.Shape();
  s.moveTo(x0, -back);
  const N = 48;
  for (let i = 0; i <= N; i++) {
    const x = x0 + ((x1 - x0) * i) / N;
    s.lineTo(x, -(back - depth(x)));
  }
  s.lineTo(x1, -back);
  s.lineTo(x0, -back);
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.45, bevelEnabled: false, curveSegments: 1 });
  g.rotateX(-Math.PI / 2);
  g.translate(0, y, 0);
  b.add(g, { color: 0xe4e6e4 });
  // the fascia's underside lights, a strip of little glow squares
  for (let i = 1; i < N; i += 2) {
    const x = x0 + ((x1 - x0) * i) / N;
    b.box(0.35, 0.05, 0.35, 0xfff2cc, x, y - 0.04, back - depth(x) + 1.2, { mat: 'glow', cast: false });
  }
  for (let i = 0; i < 7; i++) {
    const x = x0 + 3 + (i * (x1 - x0 - 6)) / 6;
    const z = back - depth(x) + 1.0;
    b.cyl(0.16, y, METAL, x, 0, z, { seg: 10 });
    ctx.colliders.circle(x, z, 0.2, { tag: 'column' });
  }
  // the doors: three glazed portals with dark frames and a step
  for (const x of [-126, -115, -104]) {
    b.box(4.2, 3.0, 0.3, 0x3a3e42, x, 0.6, T.z0 - 0.15);
    b.box(3.8, 2.7, 0.05, 0x5a7a88, x, 0.6, T.z0 - 0.33, { mat: 'glass' });
    b.box(0.08, 2.7, 0.1, 0x9aa0a4, x, 0.6, T.z0 - 0.36);
  }
  b.box(x1 - x0, 0.15, 8, PAL.concrete, (x0 + x1) / 2, 0, back - 4);
  ctx.ground.flat(x0, back - 8, x1, back, 0.15);
}

function signs(ctx, sheet) {
  const cx = (HALL.x0 + HALL.x1) / 2;
  // АҚТӨБЕ on the roof, facing the forecourt and the apron, on a steel frame
  const top = HALL_H + ARC;
  for (const [z, ry] of [[T.z0 + 3, Math.PI], [T.z1 - 3, 0]]) {
    sheet.add(lettersTex('aktobe', 'АҚТӨБЕ', { w: 1024, h: 180 }), 20, 3.5, cx, top + 1.9, z + (ry ? -0.05 : 0.05), ry);
    ctx.batch.box(19, 0.12, 0.12, 0x5a5e62, cx, top + 0.3, z);
    for (let i = 0; i <= 4; i++) ctx.batch.box(0.12, 1.2, 0.12, 0x5a5e62, cx - 9 + i * 4.5, top - 0.6, z);
  }
  // ӘУЕЖАЙ · АЭРОПОРТ across the glass over the canopy
  sheet.add(lettersTex('aero', 'ӘУЕЖАЙ  ·  АЭРОПОРТ', { w: 1024, h: 110, color: '#ffffff', stroke: '#1e3a48' }), 30, 3.2, cx, 8.4, T.z0 - 0.2, Math.PI);
}

/** The departures board under the canopy, and the ticket office window. */
function interactions(ctx, sheet) {
  const b = ctx.batch;
  const bx = -133, bz = T.z0 - 5.5;
  b.box(0.2, 1.4, 0.2, 0x3a3e42, bx - 1.2, 0.15, bz);
  b.box(0.2, 1.4, 0.2, 0x3a3e42, bx + 1.2, 0.15, bz);
  b.box(3.0, 1.9, 0.3, 0x2a2e32, bx, 1.5, bz);
  sheet.add(boardTex(), 2.8, 1.75, bx, 2.45, bz - 0.16, Math.PI);
  ctx.colliders.box(bx - 1.6, bz - 0.25, bx + 1.6, bz + 0.25, { tag: 'board' });
  ctx.interact({
    x: bx, y: 2.3, z: bz - 0.3, w: 3, h: 2, d: 0.6, label: 'Read the departures board · Табло',
    action: (game) => {
      const bd = game.flights?.board();
      if (!bd) return;
      const line = (r) => `${r.flight}  ${r.city}  ${r.status}`;
      const dep = bd.dep.slice(0, 3).map(line).join('\n') || '—';
      const arr = bd.arr.slice(0, 2).map(line).join('\n') || '—';
      game.hud.sms('Табло · Ұшу / Вылет', `${dep}\n\nПрилёт:\n${arr}`, 9000);
      game.audio.play('paper', { volume: 0.3 });
    },
  });
  // авиакассы: a window in the east wing with a sign over it
  const kx = -80, kz = T.z0 + 2;
  b.box(3.2, 2.0, 0.2, 0x3a3e42, kx, 0.9, kz - 0.1);
  b.box(2.8, 1.6, 0.05, 0x6a8a98, kx, 1.1, kz - 0.22, { mat: 'glass' });
  sheet.add(lettersTex('kassy', 'АВИАКАССЫ', { w: 512, h: 96, color: '#1f4e8c', stroke: '#ffffff' }), 4.2, 0.8, kx, 3.4, kz - 0.25, Math.PI);
  ctx.interact({
    x: kx, y: 1.5, z: kz - 0.6, w: 2.8, h: 1.8, d: 0.8, label: 'Ask for a ticket · Авиакассы',
    action: (game) => {
      game.hud.sms('Авиакассы', `Алматы, Air Astana, tomorrow at 07:10: 23 800 тенге, one way. You have ${game.wallet} ₸. The cashier is already looking at the next in the queue.`, 7000);
      game.audio.play('deny', { volume: 0.4 });
    },
  });
}

/* ---------------- the tower ---------------- */

function tower(ctx) {
  const b = ctx.batch;
  const { x, z } = TOWER;
  const base = 7.2, shaftTop = 21.5;
  b.add(tboxGeo(13, base, 9, [6, 4.2]), { mat: ribbon(), color: 0xffffff, matrix: mtx(x, 0, z) });
  b.box(13.3, 0.6, 9.3, CLAD, x, base - 0.1, z);
  b.box(5.6, shaftTop - base, 5.6, 0xece8de, x + 2, base, z + 1);
  // a slot of stair windows up the shaft
  for (let y = base + 1.5; y < shaftTop - 1; y += 3) b.box(0.9, 1.6, 0.05, 0x3a4a56, x + 2, y, z + 1 - 2.83, { mat: 'glass' });
  // the gallery and the cab: eight panes leaning out, a flat roof, antennas
  b.cyl(4.6, 0.3, CLAD, x + 2, shaftTop, z + 1, { seg: 8, ry: Math.PI / 8 });
  b.cyl(3.6, 0.9, 0xd8d6d0, x + 2, shaftTop + 0.3, z + 1, { seg: 8, ry: Math.PI / 8 });
  b.cyl(3.6, 2.8, 0x2e4450, x + 2, shaftTop + 1.2, z + 1, { seg: 8, rTop: 4.2, ry: Math.PI / 8, mat: 'glass' });
  b.cyl(4.5, 0.45, CLAD, x + 2, shaftTop + 4.0, z + 1, { seg: 8, ry: Math.PI / 8 });
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
    b.tube(x + 2 + Math.cos(a) * 3.6, shaftTop + 1.2, z + 1 + Math.sin(a) * 3.6, x + 2 + Math.cos(a) * 4.2, shaftTop + 4.0, z + 1 + Math.sin(a) * 4.2, 0.06, 0x3a3e42, { seg: 4 });
  }
  // the mast, red and white, with its obstruction light
  for (let i = 0; i < 5; i++) b.cyl(0.14, 1.0, i % 2 ? 0xf2f0e8 : 0xc8302a, x + 2, shaftTop + 4.45 + i, z + 1, { seg: 6 });
  b.box(0.3, 0.3, 0.3, 0xff3a2a, x + 2, shaftTop + 9.5, z + 1, { mat: 'glow' });
  for (const [dx, dz, h] of [[3, 2.5, 3], [0.5, -0.8, 2.2]]) b.cyl(0.04, h, 0x8a8e90, x + 2 + dx, shaftTop + 4.45, z + 1 + dz, { seg: 4 });
  ctx.colliders.box(x - 6.6, z - 4.6, x + 6.6, z + 4.6, { tag: 'building' });
  // the door, and a plate by it
  b.box(1.6, 2.2, 0.1, 0x6b4a34, x - 3, 0, z - 4.55);
}

export function buildTerminal(ctx) {
  wings(ctx);
  hall(ctx);
  canopy(ctx);
  const sheet = new LetterSheet();
  signs(ctx, sheet);
  interactions(ctx, sheet);
  sheet.flush(ctx.root);
  tower(ctx);
  ctx.colliders.box(T.x0, T.z0, T.x1, T.z1, { tag: 'building' });
  for (const fx of [-146, -84]) flagpole(ctx, fx, T.z0 - 12, 10);
}
