import * as THREE from 'three';
import { rotXZ } from '../../core/util.js';
import { FONT, centerText, weather } from '../../core/textures.js';
import { KERB_H } from '../plan.js';
import { Atlas, atlasQuad, addQuad, ATLAS } from './signs.js';

/* ------------------------------------------------------------------ *
 * Billboards and banners along the avenue.
 *
 * The patriotic boards of the 2000s ("Жаса, жайна Қазақстан!", the
 * "Қазақстан — 2030" strategy), and the phone and bank adverts of June
 * 2007, as text-only designs: K'Cell, Beeline (two years old then),
 * Halyk Bank, Казкоммерцбанк and БанкТуранАлем (it only became "BTA
 * Bank" in 2008).
 *
 * All the 6 x 3 m faces share one atlas, so every board is one draw call
 * between them. Big boards stand on a single mast in the avenue median,
 * facing the traffic both ways; smaller two-post boards stand at the back
 * of a pavement; banners hang in pairs on the median lamp posts.
 * ------------------------------------------------------------------ */

const BOARDS = new Atlas(2048);
const FACE_W = 6, FACE_H = 3;

function ornamentBand(c, x, y, w, h, color) {
  // the koshkar-muiz ram's-horn ornament as a repeating band
  c.save();
  c.strokeStyle = color;
  c.lineWidth = h * 0.12;
  const step = h * 1.4;
  for (let px = x + step / 2; px < x + w; px += step) {
    c.beginPath();
    c.arc(px - h * 0.22, y + h / 2, h * 0.26, Math.PI * 0.2, Math.PI * 1.6);
    c.stroke();
    c.beginPath();
    c.arc(px + h * 0.22, y + h / 2, h * 0.26, Math.PI * 1.4, Math.PI * 0.8, true);
    c.stroke();
  }
  c.restore();
}

function sun(c, cx, cy, r, color) {
  c.fillStyle = color;
  for (let i = 0; i < 32; i++) {
    const a = (i / 32) * Math.PI * 2;
    c.beginPath();
    c.moveTo(cx + Math.cos(a - 0.05) * r * 1.15, cy + Math.sin(a - 0.05) * r * 1.15);
    c.lineTo(cx + Math.cos(a) * r * 1.7, cy + Math.sin(a) * r * 1.7);
    c.lineTo(cx + Math.cos(a + 0.05) * r * 1.15, cy + Math.sin(a + 0.05) * r * 1.15);
    c.fill();
  }
  c.beginPath();
  c.arc(cx, cy, r, 0, Math.PI * 2);
  c.fill();
}

const DESIGNS = {
  zhasa(c, w, h) {
    const g = c.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#2a8fd8');
    g.addColorStop(1, '#9fd4f2');
    c.fillStyle = g;
    c.fillRect(0, 0, w, h);
    c.fillStyle = '#1b56a8';
    c.fillRect(0, 0, w, h * 0.08);
    c.fillRect(0, h * 0.92, w, h * 0.08);
    ornamentBand(c, 0, 0, w, h * 0.08, '#f2c230');
    ornamentBand(c, 0, h * 0.92, w, h * 0.08, '#f2c230');
    centerText(c, 'Жаса,', w * 0.33, h * 0.32, w * 0.6, h * 0.2, '#c8202a', { family: FONT.serif, align: 'center' });
    centerText(c, 'жайна', w * 0.33, h * 0.52, w * 0.6, h * 0.2, '#c8202a', { family: FONT.serif });
    centerText(c, 'Қазақстан!', w * 0.33, h * 0.73, w * 0.62, h * 0.2, '#c8202a', { family: FONT.serif });
    // the golden warrior on the snow leopard, on his column
    c.fillStyle = '#d8a430';
    c.fillRect(w * 0.79, h * 0.1, w * 0.035, h * 0.55);
    c.beginPath();
    c.ellipse(w * 0.81, h * 0.72, w * 0.09, h * 0.07, -0.1, 0, Math.PI * 2);
    c.fill();
    c.fillRect(w * 0.8, h * 0.62, w * 0.02, h * 0.1);
    c.beginPath();
    c.arc(w * 0.807, h * 0.08, h * 0.035, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = '#b8862a';
    c.beginPath();
    c.moveTo(w * 0.72, h * 0.8); c.lineTo(w * 0.9, h * 0.8); c.lineTo(w * 0.87, h * 0.86); c.lineTo(w * 0.75, h * 0.86);
    c.fill();
  },
  guldene(c, w, h) {
    c.fillStyle = '#1d4f9a';
    c.fillRect(0, 0, w, h);
    const g = c.createRadialGradient(w * 0.16, h * 0.5, 4, w * 0.16, h * 0.5, h * 0.7);
    g.addColorStop(0, 'rgba(0,175,202,0.9)');
    g.addColorStop(1, 'rgba(0,175,202,0)');
    c.fillStyle = g;
    c.fillRect(0, 0, w, h);
    sun(c, w * 0.16, h * 0.46, h * 0.16, '#fec50c');
    ornamentBand(c, w * 0.02, h * 0.84, w * 0.28, h * 0.08, '#fec50c');
    centerText(c, 'Гүлдене бер,', w * 0.64, h * 0.3, w * 0.6, h * 0.19, '#ffffff', { family: FONT.serif });
    centerText(c, 'сүйікті Отаным —', w * 0.64, h * 0.52, w * 0.62, h * 0.17, '#ffffff', { family: FONT.serif });
    centerText(c, 'Қазақстан!', w * 0.64, h * 0.75, w * 0.6, h * 0.2, '#fec50c', { family: FONT.serif });
  },
  s2030(c, w, h) {
    c.fillStyle = '#f4f2ea';
    c.fillRect(0, 0, w, h);
    c.fillStyle = '#00afca';
    c.fillRect(0, 0, w * 0.36, h);
    sun(c, w * 0.18, h * 0.42, h * 0.15, '#fec50c');
    centerText(c, 'ҚАЗАҚСТАН', w * 0.18, h * 0.8, w * 0.32, h * 0.12, '#ffffff', { family: FONT.sans });
    centerText(c, '2030', w * 0.68, h * 0.38, w * 0.56, h * 0.46, '#1d4f9a', { family: FONT.display, stretch: 1 });
    centerText(c, 'Барлық қазақстандықтардың өркендеуі,', w * 0.68, h * 0.72, w * 0.58, h * 0.07, '#333', { family: FONT.sans, weight: 'normal' });
    centerText(c, 'қауіпсіздігі және әл-ауқатының артуы', w * 0.68, h * 0.82, w * 0.58, h * 0.07, '#333', { family: FONT.sans, weight: 'normal' });
  },
  kcell(c, w, h) {
    const g = c.createLinearGradient(0, 0, w, h);
    g.addColorStop(0, '#16307a');
    g.addColorStop(1, '#2d64c0');
    c.fillStyle = g;
    c.fillRect(0, 0, w, h);
    c.strokeStyle = 'rgba(255,255,255,0.25)';
    c.lineWidth = h * 0.02;
    for (let i = 1; i < 5; i++) { c.beginPath(); c.arc(w * 0.82, h * 0.5, h * 0.1 * i, -0.9, 0.9); c.stroke(); }
    centerText(c, "K'Cell", w * 0.38, h * 0.38, w * 0.6, h * 0.36, '#ffffff', { family: FONT.display, stretch: 1 });
    centerText(c, 'Бірінші. Первый.', w * 0.38, h * 0.66, w * 0.6, h * 0.12, '#f2c230', { family: FONT.sans });
    centerText(c, 'Связь по всему Казахстану', w * 0.38, h * 0.82, w * 0.6, h * 0.08, '#e8eef8', { family: FONT.sans, weight: 'normal' });
  },
  beeline(c, w, h) {
    c.fillStyle = '#f2c230';
    c.fillRect(0, 0, w, h);
    // the striped ball
    c.save();
    c.beginPath();
    c.arc(w * 0.2, h * 0.5, h * 0.32, 0, Math.PI * 2);
    c.clip();
    for (let i = -6; i < 6; i++) {
      c.fillStyle = i % 2 ? '#111' : '#f2c230';
      c.fillRect(w * 0.2 - h * 0.4, h * 0.5 + i * h * 0.08, h * 0.8, h * 0.08);
    }
    c.restore();
    centerText(c, 'Beeline', w * 0.64, h * 0.4, w * 0.56, h * 0.34, '#111', { family: FONT.sans, stretch: 1 });
    centerText(c, 'Живи на яркой стороне', w * 0.64, h * 0.7, w * 0.6, h * 0.12, '#111', { family: FONT.sans, weight: 'normal' });
  },
  halyk(c, w, h) {
    c.fillStyle = '#0f7a4a';
    c.fillRect(0, 0, w, h);
    c.fillStyle = '#f2c230';
    c.fillRect(0, h * 0.86, w, h * 0.04);
    centerText(c, 'Halyk Bank', w / 2, h * 0.3, w * 0.8, h * 0.28, '#ffffff', { family: FONT.serif });
    centerText(c, 'Халық банкі · Народный банк Казахстана', w / 2, h * 0.55, w * 0.86, h * 0.1, '#e8f4ea', { family: FONT.sans });
    centerText(c, 'Депозиты до 12% годовых', w / 2, h * 0.73, w * 0.7, h * 0.12, '#f2c230', { family: FONT.sans });
  },
  kkb(c, w, h) {
    c.fillStyle = '#f4f4f0';
    c.fillRect(0, 0, w, h);
    c.fillStyle = '#1b56a8';
    c.fillRect(0, 0, w, h * 0.3);
    centerText(c, 'Казкоммерцбанк', w / 2, h * 0.15, w * 0.8, h * 0.18, '#ffffff', { family: FONT.sans });
    centerText(c, 'Потребительский кредит', w / 2, h * 0.48, w * 0.8, h * 0.16, '#1b56a8', { family: FONT.sans });
    centerText(c, 'за один день!', w / 2, h * 0.68, w * 0.6, h * 0.16, '#c8202a', { family: FONT.sans });
    centerText(c, 'Тұтыну несиесі бір күнде', w / 2, h * 0.86, w * 0.7, h * 0.08, '#555', { family: FONT.sans, weight: 'normal' });
  },
  bta(c, w, h) {
    c.fillStyle = '#123a7a';
    c.fillRect(0, 0, w, h);
    c.fillStyle = '#d23a30';
    c.beginPath();
    c.moveTo(0, h); c.lineTo(w * 0.35, h); c.lineTo(w * 0.5, 0); c.lineTo(w * 0.15, 0); c.fill();
    centerText(c, 'БанкТуранАлем', w * 0.66, h * 0.32, w * 0.6, h * 0.18, '#ffffff', { family: FONT.sans });
    centerText(c, 'Ипотека · Ипотека', w * 0.66, h * 0.55, w * 0.6, h * 0.14, '#f2c230', { family: FONT.sans });
    centerText(c, 'Свой дом — это просто', w * 0.66, h * 0.75, w * 0.6, h * 0.1, '#e8eef8', { family: FONT.sans, weight: 'normal' });
  },
};

export const BOARD_KEYS = Object.keys(DESIGNS);

function faceGeo(key, seed) {
  const rect = BOARDS.slot(key, 1000, 500, (c, w, h) => {
    DESIGNS[key](c, w, h);
    weather(c, w, h, seed, 0.9);
  });
  const g = new THREE.PlaneGeometry(FACE_W, FACE_H);
  return BOARDS.remap(g, rect);
}

function place(batch, geo, x, y, z, yaw, mat) {
  addQuad(batch, geo, x, y, z, yaw, { mat });
}

/**
 * A 6 x 3 m board on a single mast, double-sided. `yaw` is the direction
 * the front face looks; the back shows `backKey`.
 */
export function addMastBoard(ctx, x, z, yaw, frontKey, backKey, { y = KERB_H, bottom = 5.3 } = {}) {
  const { batch, colliders } = ctx;
  const steel = 0x7d8386;
  batch.cyl(0.26, bottom + FACE_H / 2, steel, x, y, z, { seg: 10, rTop: 0.2 });
  batch.cyl(0.42, 0.3, 0x6a6f72, x, y, z, { seg: 10 });
  const cy = y + bottom + FACE_H / 2;
  // the frame box, a little bigger than the faces
  batch.box(FACE_W + 0.24, FACE_H + 0.24, 0.34, steel, x, cy - FACE_H / 2 - 0.12, z, { ry: yaw });
  const [fx, fz] = rotXZ(0, -0.18, yaw);
  place(batch, faceGeo(frontKey, 11), x + fx, cy, z + fz, yaw, BOARDS.material);
  place(batch, faceGeo(backKey, 23), x - fx, cy, z - fz, yaw + Math.PI, BOARDS.material);
  // catwalk and three lamps on arms each side
  for (const side of [-1, 1]) {
    const [cx, cz] = rotXZ(0, side * 0.55, yaw);
    batch.box(FACE_W, 0.05, 0.5, 0x5f6466, x + cx, cy - FACE_H / 2 - 0.3, z + cz, { ry: yaw });
    for (let i = -1; i <= 1; i++) {
      const [lx, lz] = rotXZ(i * 2.0, side * 1.0, yaw);
      const [ax, az] = rotXZ(i * 2.0, side * 0.18, yaw);
      batch.tube(x + ax, cy + FACE_H / 2 + 0.1, z + az, x + lx, cy + FACE_H / 2 + 0.45, z + lz, 0.025, steel, { seg: 4, cast: false });
      batch.box(0.3, 0.1, 0.18, 0x3a3e40, x + lx, cy + FACE_H / 2 + 0.38, z + lz, { ry: yaw, cast: false });
    }
  }
  colliders.circle(x, z, 0.45, { tag: 'billboard' });
}

/** A 6 x 3 m board on two posts at the back of a pavement, one-sided. */
export function addPostBoard(ctx, x, z, yaw, key, { y = KERB_H, bottom = 2.5 } = {}) {
  const { batch, colliders } = ctx;
  const steel = 0x7d8386;
  for (const s of [-1, 1]) {
    const [px, pz] = rotXZ(s * 1.9, 0.12, yaw);
    batch.box(0.16, bottom + FACE_H, 0.16, steel, x + px, y, z + pz, { ry: yaw });
    colliders.circle(x + px, z + pz, 0.16, { tag: 'billboard' });
    // a strut behind each post
    const [bx, bz] = rotXZ(s * 1.9, 1.1, yaw);
    batch.tube(x + px, y + bottom + 0.6, z + pz, x + bx, y, z + bz, 0.05, steel, { seg: 4 });
  }
  const cy = y + bottom + FACE_H / 2;
  batch.box(FACE_W + 0.2, FACE_H + 0.2, 0.12, 0x6a6f72, x, cy - FACE_H / 2 - 0.1, z, { ry: yaw });
  const [fx, fz] = rotXZ(0, -0.07, yaw);
  place(batch, faceGeo(key, 31), x + fx, cy, z + fz, yaw, BOARDS.material);
}

/** A pair of vertical banners hung on a lamp post, facing along the road. */
export function addLampBanners(ctx, x, z, alongYaw, key, { y = KERB_H } = {}) {
  const geo = atlasQuad(`banner|${key}`, 0.62, 1.7, (c, w, h) => {
    const blue = '#00afca', gold = '#fec50c';
    c.fillStyle = key === 'b' ? '#1d4f9a' : blue;
    c.fillRect(0, 0, w, h);
    c.fillStyle = gold;
    c.fillRect(0, 0, w, h * 0.04);
    c.fillRect(0, h * 0.96, w, h * 0.04);
    ornamentBand(c, 0, h * 0.06, w, w * 0.18, gold);
    sun(c, w / 2, h * 0.3, w * 0.16, gold);
    c.save();
    c.translate(w / 2, h * 0.7);
    c.rotate(-Math.PI / 2);
    centerText(c, key === 'b' ? 'Жаса, Қазақстан!' : 'Қазақстан — 2030', 0, 0, h * 0.5, w * 0.34, '#ffffff', { family: FONT.sans });
    c.restore();
    weather(c, w, h, key.charCodeAt(0), 0.5);
  }, { ppm: 200 });
  for (const side of [-1, 1]) {
    // hang each banner beside the pole, perpendicular to the road
    const [ox, oz] = rotXZ(side * 0.45, 0, alongYaw);
    const bx = x + ox, bz = z + oz;
    ctx.batch.box(0.9, 0.04, 0.04, 0x9a9a98, x + ox * 0.5, y + 6.95, z + oz * 0.5, { ry: alongYaw });
    ctx.batch.box(0.9, 0.04, 0.04, 0x9a9a98, x + ox * 0.5, y + 5.1, z + oz * 0.5, { ry: alongYaw });
    addQuad(ctx.batch, geo, bx, y + 6.02, bz, alongYaw, { mat: ATLAS.material });
    addQuad(ctx.batch, geo, bx, y + 6.02, bz, alongYaw + Math.PI, { mat: ATLAS.material });
  }
}
