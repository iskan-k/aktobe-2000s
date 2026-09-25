import * as THREE from 'three';
import { cel, flat } from '../core/toon.js';
import { canvasTex, cached, centerText, FONT, weather } from '../core/textures.js';
import { rngKit } from '../core/util.js';
import { texBox, texPlane, letters } from '../world/buildings/landmarks.js';

/* ------------------------------------------------------------------ *
 * The Lokomotiv cinema, the railwaymen's picture house by the station:
 * red brick, two rounded towers at the front corners, rows of porthole
 * windows, a grey canopy over the glazed doors and ЛОКОМОТИВ in red
 * letters on the roof. Posters for June 2007 either side of the doors.
 * ------------------------------------------------------------------ */

export const CINEMA = { x0: 47, x1: 81, z0: -153, z1: -134, h: 12, towerR: 3.2, towerH: 14.5 };
const TRIM = 0xe9e3d6;
const CANOPY = 0x8e9294;
const TILE = 3;

/* ---------------- textures ---------------- */

function brick(c, W, H, seed) {
  const r = rngKit(seed);
  c.fillStyle = '#b3262b';
  c.fillRect(0, 0, W, H);
  const bh = 8, bw = 24;
  for (let y = 0; y < H; y += bh) {
    const off = (y / bh) % 2 ? bw / 2 : 0;
    for (let x = -bw; x < W + bw; x += bw) {
      c.fillStyle = r.pick(['#b3262b', '#a82328', '#bb2e30', '#9f2226', '#b52a2c']);
      c.fillRect(x + off + 1, y + 1, bw - 2, bh - 2);
    }
  }
  c.fillStyle = 'rgba(80,20,20,0.35)';
  for (let y = 0; y < H; y += bh) c.fillRect(0, y, W, 1);
}

/** Brick with one porthole per tile (3 m x 3 m). */
function portholeTex() {
  return cached('cinema|porthole', () => canvasTex(256, 256, (c, W, H) => {
    brick(c, W, H, 91);
    const cx = W / 2, cy = H / 2, r = W * 0.19;
    c.fillStyle = '#eae4d8';
    c.beginPath(); c.arc(cx, cy, r + 10, 0, Math.PI * 2); c.fill();
    const g = c.createLinearGradient(0, cy - r, 0, cy + r);
    g.addColorStop(0, '#9dbbd0');
    g.addColorStop(1, '#3f5566');
    c.fillStyle = g;
    c.beginPath(); c.arc(cx, cy, r, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#eae4d8';
    c.fillRect(cx - 2, cy - r, 4, r * 2);
    c.fillRect(cx - r, cy - 2, r * 2, 4);
    weather(c, W, H, 92, 0.5);
  }, { repeat: [1, 1] }));
}

function brickTex() {
  return cached('cinema|brick', () => canvasTex(256, 256, (c, W, H) => {
    brick(c, W, H, 93);
    weather(c, W, H, 94, 0.5);
  }, { repeat: [1, 1] }));
}

/** June 2007: what was on. Film titles as they ran in Russian. */
export const PROGRAMME = [
  ['Пираты Карибского моря: На краю света', '12:00 · 15:30 · 19:00'],
  ['Шрек Третий', '10:00 · 13:40 · 17:20'],
  ['Человек-паук 3: Враг в отражении', '21:30'],
];

function posterTex() {
  return cached('cinema|poster', () => canvasTex(256, 384, (c, W, H) => {
    c.fillStyle = '#1f2c4a';
    c.fillRect(0, 0, W, H);
    c.fillStyle = '#e8c547';
    c.fillRect(10, 10, W - 20, 50);
    centerText(c, 'ЛОКОМОТИВ', W / 2, 36, W - 40, 34, '#7a1414', { family: FONT.display, weight: '800' });
    centerText(c, 'ИЮНЬ 2007', W / 2, 84, W - 40, 22, '#f1ede2', { family: FONT.sans, weight: '700' });
    let y = 130;
    for (const [title, times] of PROGRAMME) {
      c.fillStyle = '#2c3f66';
      c.fillRect(16, y - 26, W - 32, 70);
      centerText(c, title, W / 2, y, W - 44, 20, '#ffffff', { family: FONT.narrow, weight: '700' });
      centerText(c, times, W / 2, y + 26, W - 44, 16, '#e8c547', { family: FONT.sans, weight: '700' });
      y += 86;
    }
    centerText(c, 'Билеты 300 – 500 тг', W / 2, H - 28, W - 40, 18, '#f1ede2', { family: FONT.sans, weight: '700' });
  }));
}

/* ---------------- geometry ---------------- */

/** Cylinder whose uv tiles in metres, for the towers. */
function towerGeo(r, h) {
  const g = new THREE.CylinderGeometry(r, r, h, 20, 1, true);
  const uv = g.attributes.uv;
  const around = (2 * Math.PI * r) / TILE;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * Math.round(around), (uv.getY(i) * h) / TILE);
  g.translate(0, h / 2, 0);
  return g;
}

function towers(ctx, porthole) {
  const { x0, x1, z1, towerR: r, towerH: h } = CINEMA;
  const b = ctx.batch;
  const spots = [[x0 + r - 0.4, z1 - r + 0.4], [x1 - r + 0.4, z1 - r + 0.4]];
  for (const [x, z] of spots) {
    const m = new THREE.Matrix4().makeTranslation(x, 0, z);
    b.add(towerGeo(r, h), { mat: porthole, color: null, matrix: m });
    b.cyl(r + 0.25, 0.5, TRIM, x, h, z, { seg: 20 });
    b.cyl(r - 0.2, 0.9, CANOPY, x, h + 0.5, z, { seg: 20, rTop: r - 1.2 });
    b.cyl(r + 0.15, 0.9, 0x8a1d20, x, 0, z, { seg: 20 });
    ctx.colliders.circle(x, z, r, { top: h });
  }
}

function body(ctx) {
  const b = ctx.batch;
  const { x0, x1, z0, z1, h } = CINEMA;
  const porthole = cached('cinema|porthole-mat', () => cel({ map: portholeTex(), grime: 0.04, dirt: 0.3, cache: false }));
  const plain = cached('cinema|brick-mat', () => cel({ map: brickTex(), grime: 0.04, dirt: 0.3, cache: false }));
  texBox(b, plain, x1 - x0, h, z1 - z0, (x0 + x1) / 2, 0, (z0 + z1) / 2, { tileU: TILE, tileV: TILE });
  // a band of portholes along each side and the upper front
  for (const x of [x0 - 0.02, x1 + 0.02]) {
    texPlane(b, porthole, 15, 3, x, 6.5, (z0 + z1) / 2 - 1, x < x0 ? Math.PI / 2 : -Math.PI / 2, { tileU: TILE, tileV: TILE });
  }
  texPlane(b, porthole, 18, 3, (x0 + x1) / 2, 6.6, z1 + 0.02, Math.PI, { tileU: TILE, tileV: TILE });
  b.span(x0 - 0.2, h, z0 - 0.2, x1 + 0.2, h + 0.4, z1 + 0.2, TRIM);
  b.span(x0, h + 0.4, z0, x1, h + 0.5, z1, 0x6f716f, { cast: false });
  b.span(x0 - 0.05, 0, z0 - 0.05, x1 + 0.05, 0.8, z1 + 0.05, 0x8a1d20);
  towers(ctx, porthole);
  ctx.colliders.box(x0, z0, x1, z1, { top: h, tag: 'cinema' });
}

function front(ctx) {
  const b = ctx.batch;
  const { x0, x1, z1 } = CINEMA;
  const xc = (x0 + x1) / 2;
  // glazed doors
  b.box(15, 3.2, 0.12, 0x2b3a44, xc, 0.2, z1 + 0.04, { mat: 'glass' });
  for (let i = 0; i <= 6; i++) b.box(0.12, 3.2, 0.16, 0xd8d6cf, xc - 7.5 + i * 2.5, 0.2, z1 + 0.06);
  b.box(15.2, 0.14, 0.16, 0xd8d6cf, xc, 3.3, z1 + 0.06);
  // canopy on thin steel posts
  b.box(19, 0.35, 3.6, CANOPY, xc, 3.9, z1 + 1.8, { closed: true });
  b.box(19.05, 0.12, 3.65, 0x6f7375, xc, 4.25, z1 + 1.8);
  for (const s of [-1, 1]) {
    b.cyl(0.1, 3.9, 0x6f7375, xc + s * 9, 0, z1 + 3.3, { seg: 6 });
    ctx.colliders.circle(xc + s * 9, z1 + 3.3, 0.2, { top: 3.9 });
  }
  b.box(19, 0.15, 5, 0x8f8b82, xc, 0, z1 + 2.5);
  ctx.ground.flat(xc - 9.5, z1, xc + 9.5, z1 + 5, 0.15, 'steps');
  // posters either side of the doors
  const poster = cached('cinema|poster-mat', () => flat({ map: posterTex() }));
  const spots = [];
  for (const dx of [-8.9, 8.9]) {
    const x = xc + dx;
    b.box(1.6, 2.3, 0.1, 0x3a3a38, x, 0.8, z1 + 0.06);
    texPlane(b, poster, 1.4, 2.1, x, 0.9, z1 + 0.13, Math.PI);
    spots.push({ x, z: z1 + 0.5 });
  }
  letters(ctx.root, 'ЛОКОМОТИВ', xc, CINEMA.h + 0.5, z1 - 1, Math.PI, { width: 19, height: 2.3, color: '#d12a26', back: '#7a1414' });
  for (let i = -3; i <= 3; i++) b.box(0.1, 0.5, 0.1, 0x4a4d50, xc + i * 2.9, CINEMA.h + 0.5, z1 - 1.08);
  b.box(19.5, 0.1, 0.1, 0x4a4d50, xc, CINEMA.h + 0.95, z1 - 1.08);
  return spots;
}

/** The cinema. Returns where its posters hang. */
export function buildCinema(ctx) {
  body(ctx);
  return { posters: front(ctx) };
}
