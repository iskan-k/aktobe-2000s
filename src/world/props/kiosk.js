import * as THREE from 'three';
import { PAL } from '../../core/palette.js';
import { rotXZ, rngKit } from '../../core/util.js';
import { FONT, centerText } from '../../core/textures.js';
import { KERB_H } from '../plan.js';
import { atlasQuad, addQuad, boardGeo, posterGeo, ATLAS } from './signs.js';

/* ------------------------------------------------------------------ *
 * Kiosks and stalls of a 2007 pavement.
 *
 *   larek     the small steel kiosk (ларёк): sloped roof, barred window
 *             packed with bottles and cigarettes, a serving hatch
 *   pavilion  the long green pavilion with a red roof and a little red
 *             dome (photo c06)
 *   booth     a glazed booth with a yellow roof: newspapers, or the
 *             currency exchange
 *   icecream  a chest freezer on wheels under a striped umbrella
 *   kvass     the yellow КВАС barrel on its trailer, glasses on a table
 *   flowers   buckets of flowers under an umbrella
 *   payphone  a Kazakhtelecom card phone under its hood
 *   postbox   the blue box of Казпочта
 *
 * Each `add*` takes a frame { x, z, yaw } on the pavement (front toward
 * local -z, facing the walker on the pavement), writes into the batch,
 * registers colliders and returns { hx, hz } half extents in the local
 * frame so the placer can reserve its footprint. Interactions go
 * through ctx.interact and game.pay.
 * ------------------------------------------------------------------ */

export function frame(ctx, x, z, yaw, y = KERB_H) {
  return { ctx, batch: ctx.batch, x, y, z, yaw };
}

export function L(o, lx, ly, lz) {
  const [dx, dz] = rotXZ(lx, lz, o.yaw);
  return [o.x + dx, o.y + ly, o.z + dz];
}

export function box(o, w, h, d, color, lx, ly, lz, extra = {}) {
  const [x, y, z] = L(o, lx, ly, lz);
  o.batch.box(w, h, d, color, x, y, z, { ...extra, ry: o.yaw + (extra.ry || 0) });
}

export function cyl(o, r, h, color, lx, ly, lz, extra = {}) {
  const [x, y, z] = L(o, lx, ly, lz);
  o.batch.cyl(r, h, color, x, y, z, { ...extra, ry: o.yaw + (extra.ry || 0) });
}

export function quad(o, geo, lx, ly, lz, localYaw = 0, mat = ATLAS.material) {
  const [x, y, z] = L(o, lx, ly, lz);
  addQuad(o.batch, geo, x, y, z, o.yaw + localYaw, { mat });
}

/** Rotated footprint collider in the local frame. */
export function collide(o, lx, lz, w, d, top = 2.6) {
  const [cx, , cz] = L(o, lx, 0, lz);
  o.ctx.colliders.obb(cx, cz, w / 2, d / 2, o.yaw, { top: o.y + top, tag: 'kiosk' });
}

export function interact(o, lx, ly, lz, w, h, d, label, action, enabled) {
  const [x, y, z] = L(o, lx, ly, lz);
  return o.ctx.interact({ x, y, z, w, h, d, ry: o.yaw, label, action, enabled });
}

function shop(game) {
  if (!game.street) game.street = { phoneUnits: 0, papers: 0, icecreams: 0 };
  return game.street;
}

/* ------------------------------------------------------------------ *
 * Goods behind glass
 * ------------------------------------------------------------------ */

const BOTTLE_COLS = ['#b8202a', '#1f4fa0', '#e8841c', '#2f7d3a', '#6a3a1c', '#d8c040', '#e6e2d8', '#7a1e4a'];

/** Shelves of goods behind a kiosk window, painted once per variant. */
export function goodsGeo(variant, w, h) {
  return atlasQuad(`goods|${variant}|${w.toFixed(2)}|${h.toFixed(2)}`, w, h, (c, pw, ph) => {
    const r = rngKit(variant * 131 + 7);
    c.fillStyle = '#2c2a26';
    c.fillRect(0, 0, pw, ph);
    const rows = 4;
    for (let row = 0; row < rows; row++) {
      const y0 = (ph / rows) * row, rh = ph / rows;
      c.fillStyle = '#8a7a64';
      c.fillRect(0, y0 + rh - rh * 0.06, pw, rh * 0.06);
      let x = r.range(0, 6);
      const kind = (variant + row) % 4;
      while (x < pw - 4) {
        if (kind === 0) {
          // bottles of soda and beer
          const bw = rh * r.range(0.16, 0.22), bh = rh * r.range(0.62, 0.86);
          c.fillStyle = r.pick(BOTTLE_COLS);
          c.fillRect(x, y0 + rh * 0.94 - bh, bw, bh);
          c.fillRect(x + bw * 0.3, y0 + rh * 0.94 - bh - rh * 0.1, bw * 0.4, rh * 0.12);
          c.fillStyle = 'rgba(255,255,255,0.55)';
          c.fillRect(x, y0 + rh * 0.94 - bh * 0.6, bw, bh * 0.22);
          x += bw + 2;
        } else if (kind === 1) {
          // cigarette packs
          const bw = rh * 0.22, bh = rh * 0.34;
          for (let k = 0; k < 2; k++) {
            c.fillStyle = r.pick(['#f2f2f2', '#c8202a', '#1f3f8a', '#e8d9b0', '#202020', '#6a8c3a']);
            c.fillRect(x, y0 + rh * 0.9 - bh * (k + 1) - k * 2, bw, bh);
            c.fillStyle = r.pick(['#c8202a', '#e0b030', '#fff', '#1f3f8a']);
            c.fillRect(x, y0 + rh * 0.9 - bh * (k + 1) - k * 2 + bh * 0.35, bw, bh * 0.2);
          }
          x += bw + 3;
        } else if (kind === 2) {
          // crisps and croutons in bright bags
          const bw = rh * r.range(0.28, 0.4), bh = rh * r.range(0.5, 0.72);
          c.fillStyle = r.pick(['#e8b020', '#d0302a', '#2a8ad0', '#40a040', '#e87020', '#8a3ab0']);
          c.beginPath();
          c.moveTo(x, y0 + rh * 0.94);
          c.lineTo(x + bw * 0.08, y0 + rh * 0.94 - bh);
          c.lineTo(x + bw * 0.92, y0 + rh * 0.94 - bh);
          c.lineTo(x + bw, y0 + rh * 0.94);
          c.fill();
          c.fillStyle = 'rgba(255,255,255,0.7)';
          c.beginPath();
          c.arc(x + bw / 2, y0 + rh * 0.94 - bh * 0.5, bw * 0.18, 0, Math.PI * 2);
          c.fill();
          x += bw + 2;
        } else {
          // chocolate bars and gum standing in rows
          const bw = rh * 0.1, bh = rh * r.range(0.38, 0.5);
          c.fillStyle = r.pick(['#5a2a1a', '#2a4a9a', '#b82020', '#e0c020', '#f0f0f0', '#208040']);
          c.fillRect(x, y0 + rh * 0.94 - bh, bw, bh);
          x += bw + 1;
        }
      }
    }
    // price cards stuck to the glass
    for (let i = 0; i < 5; i++) {
      const x = r.range(0, pw - pw * 0.12), y = r.range(ph * 0.1, ph * 0.85);
      c.fillStyle = r.pick(['#fff8c0', '#ffffff', '#ffd0d0']);
      c.fillRect(x, y, pw * 0.1, ph * 0.08);
      c.fillStyle = '#222';
      c.font = `bold ${Math.round(ph * 0.05)}px ${FONT.narrow}`;
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.fillText(`${r.pick([40, 55, 60, 75, 90, 120, 150])} тг`, x + pw * 0.05, y + ph * 0.04);
    }
    // glare
    const g = c.createLinearGradient(0, 0, pw, ph);
    g.addColorStop(0, 'rgba(255,255,255,0.22)');
    g.addColorStop(0.35, 'rgba(255,255,255,0.02)');
    g.addColorStop(0.6, 'rgba(255,255,255,0.12)');
    g.addColorStop(1, 'rgba(255,255,255,0.02)');
    c.fillStyle = g;
    c.fillRect(0, 0, pw, ph);
  }, { ppm: 220 });
}

/** Newspapers and magazines pegged in a booth window. */
function pressGeo(w, h) {
  return atlasQuad(`press|${w.toFixed(2)}`, w, h, (c, pw, ph) => {
    const r = rngKit(77);
    c.fillStyle = '#e8e2d2';
    c.fillRect(0, 0, pw, ph);
    const titles = ['Диапазон', 'Ақтөбе', 'Актюбинский вестник', 'Караван', 'Экспресс К', 'Егемен Қазақстан', 'Комсомолка', 'Теленеделя', 'Спорт', 'Кроссворды'];
    let i = 0;
    for (let y = 4; y < ph - 20; y += ph / 3) {
      for (let x = 4; x < pw - 20; x += pw / 4) {
        const cw = pw / 4 - 8, ch = ph / 3 - 8;
        c.fillStyle = r.pick(['#ffffff', '#f6f0da', '#fbe7a0', '#dfe9f5']);
        c.fillRect(x, y, cw, ch);
        c.fillStyle = r.pick(['#c02020', '#1b3f8a', '#202020', '#1f7a3a']);
        c.fillRect(x, y, cw, ch * 0.2);
        centerText(c, titles[i++ % titles.length], x + cw / 2, y + ch * 0.1, cw * 0.92, ch * 0.13, '#fff', { family: FONT.narrow });
        c.fillStyle = 'rgba(40,40,40,0.5)';
        for (let k = 0; k < 6; k++) c.fillRect(x + cw * 0.08, y + ch * (0.3 + k * 0.1), cw * r.range(0.4, 0.84), ch * 0.04);
        c.fillStyle = r.pick(['#8aa0b8', '#b88a6a', '#90a070']);
        c.fillRect(x + cw * 0.55, y + ch * 0.3, cw * 0.36, ch * 0.3);
      }
    }
  }, { ppm: 220 });
}

/* ------------------------------------------------------------------ *
 * Small helpers
 * ------------------------------------------------------------------ */

/** An eight-panel market umbrella, alternating two colours. */
export function umbrella(o, lx, lz, { r = 1.3, h = 2.3, a = 0xc8302a, b = 0xf2eee4 } = {}) {
  cyl(o, 0.025, h, 0x8a8a88, lx, 0, lz, { seg: 5 });
  const [x, y, z] = L(o, lx, h, lz);
  for (let i = 0; i < 8; i++) {
    const a0 = (i / 8) * Math.PI * 2, a1 = ((i + 1) / 8) * Math.PI * 2;
    const g = new THREE.BufferGeometry();
    const p = [0, 0.32, 0, Math.cos(a0) * r, 0, Math.sin(a0) * r, Math.cos(a1) * r, 0, Math.sin(a1) * r];
    g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
    g.setIndex([0, 2, 1]);
    g.computeVertexNormals();
    const m = new THREE.Matrix4().makeTranslation(x, y - 0.05, z);
    o.batch.add(g, { color: i % 2 ? a : b, matrix: m });
    // underside, so it is not see-through from below
    const g2 = g.clone();
    g2.setIndex([0, 1, 2]);
    g2.computeVertexNormals();
    o.batch.add(g2, { color: i % 2 ? a : b, matrix: m, cast: false });
  }
}

export function priceCard(o, key, text, lx, ly, lz, localYaw = 0, w = 0.36, h = 0.24) {
  const geo = boardGeo(`price|${key}`, w, h, { bg: '#f6f2e4', fg: '#20308a', lines: text, family: FONT.narrow, wear: 0.2, weight: 'bold' });
  quad(o, geo, lx, ly, lz, localYaw);
}

/* ------------------------------------------------------------------ *
 * Kiosk types
 * ------------------------------------------------------------------ */

const LAREK_SCHEMES = [
  { wall: 0xe8e4da, trim: 0x2d5ea8, roof: 0x2d5ea8 },
  { wall: 0x5f9a6a, trim: 0xe8e4da, roof: 0x3f6f4a },
  { wall: 0xe0d6bc, trim: 0xb8342b, roof: 0xb8342b },
  { wall: 0xd8c65a, trim: 0x6a6f74, roof: 0x7f8488 },
  { wall: 0xc9d4d8, trim: 0xd06a28, roof: 0xd06a28 },
];

/**
 * The small steel kiosk. opts: { scheme, sign: [lines], item, variant }.
 * `item` = { label, price, what, toast, sound } for the serving hatch.
 */
export function addLarek(ctx, x, z, yaw, opts = {}) {
  const o = frame(ctx, x, z, yaw);
  const rng = rngKit(Math.round(x * 13 + z * 7));
  const s = opts.scheme ?? LAREK_SCHEMES[rng.int(0, LAREK_SCHEMES.length - 1)];
  const W = opts.w ?? 2.6, D = opts.d ?? 1.9, H = 2.35;
  // plinth and body
  box(o, W + 0.06, 0.16, D + 0.06, PAL.metalDark, 0, 0, 0);
  box(o, W, H - 0.16, D, s.wall, 0, 0.16, 0.0);
  // front: lower panel stripe, window band, top sign band
  box(o, W + 0.02, 0.06, 0.03, s.trim, 0, 0.92, -D / 2 - 0.01);
  const winW = W - 0.3, winH = 1.02;
  quad(o, goodsGeo(opts.variant ?? rng.int(0, 7), winW, winH), 0, 1.48, -D / 2 - 0.012, 0);
  // bars over the window
  for (let i = 0; i <= 14; i++) box(o, 0.018, winH, 0.018, 0x3a3a3a, -winW / 2 + (winW * i) / 14, 0.97, -D / 2 - 0.03);
  for (const yy of [0.97, 1.48, 1.97]) box(o, winW, 0.02, 0.02, 0x3a3a3a, 0, yy, -D / 2 - 0.03);
  // the hatch: a little opening with a counter shelf
  box(o, 0.5, 0.36, 0.02, 0x1e1c1a, 0.55, 1.02, -D / 2 - 0.035);
  box(o, 0.6, 0.03, 0.26, PAL.metalGrey, 0.55, 0.98, -D / 2 - 0.13);
  // sign band and roof, pitched back with an overhang over the window
  const signLines = opts.sign ?? ['Азық-түлік', 'Продукты'];
  const sign = boardGeo(`larek|${signLines.join('|')}|${s.trim}`, W - 0.1, 0.34, {
    bg: '#' + s.trim.toString(16).padStart(6, '0'), fg: '#ffffff', lines: [signLines.join('  ·  ')], family: FONT.narrow, wear: 0.45, seed: rng.int(1, 99),
  });
  quad(o, sign, 0, 2.15, -D / 2 - 0.012, 0);
  box(o, W + 0.3, 0.05, D + 0.55, s.roof, 0, H + 0.02, -0.12, { rx: -0.08 });
  box(o, W + 0.3, 0.12, 0.04, s.roof, 0, H - 0.05, -D / 2 - 0.37);
  // side door and posters on the side walls
  box(o, 0.02, 1.9, 0.8, 0x6f7478, W / 2 + 0.005, 0.18, 0.35);
  quad(o, posterGeo(rng.int(1, 500)), -W / 2 - 0.012, 1.4, 0.2, Math.PI / 2, ATLAS.cutout);
  if (opts.poster) quad(o, opts.poster, W / 2 + 0.012, 1.55, -0.35, -Math.PI / 2, ATLAS.cutout);
  collide(o, 0, 0, W + 0.1, D + 0.1, H);
  if (opts.item) {
    const it = opts.item;
    interact(o, 0.55, 1.1, -D / 2 - 0.2, 0.9, 0.7, 0.5, `${it.label} · ${it.price} ₸`, (game) => buy(game, it, L(o, 0.55, 1.1, -D / 2)));
  }
  return { hx: W / 2 + 0.15, hz: D / 2 + 0.3 };
}

/** Buy something: pay, play its sound, show its toast. */
export function buy(game, it, at) {
  if (!game.pay(it.price, it.what || it.label)) return false;
  const pos = at ? { x: at[0], y: at[1], z: at[2] } : undefined;
  game.audio.play('kioskWindow', { pos, volume: 0.6 });
  if (it.sound) setTimeout(() => game.audio.play(it.sound, { pos, volume: 0.9 }), 450);
  if (it.onBuy) it.onBuy(game);
  // food and drink go straight into your hand
  if (it.hold) game.hands?.give(it.hold);
  if (it.toast) game.hud.flash(it.toast, 2600);
  if (it.sms) setTimeout(() => { game.hud.sms(it.sms[0], it.sms[1]); game.audio.play('sms'); }, it.smsDelay ?? 2500);
  return true;
}

/** The long green pavilion with the red roof and the little red dome. */
export function addPavilion(ctx, x, z, yaw, opts = {}) {
  const o = frame(ctx, x, z, yaw);
  const rng = rngKit(Math.round(x * 17 + z * 3));
  const W = opts.w ?? 6.2, D = opts.d ?? 2.8, H = 2.7;
  const green = 0x7fa38a, red = 0xb3302b;
  box(o, W + 0.1, 0.2, D + 0.1, PAL.concreteDark, 0, 0, 0);
  box(o, W, H - 0.2, D, green, 0, 0.2, 0);
  const winW = (W - 1.6) / 2;
  for (const s of [-1, 1]) {
    const cx = s * (winW / 2 + 0.55);
    quad(o, goodsGeo(rng.int(0, 7), winW, 1.2), cx, 1.45, -D / 2 - 0.012, 0);
    for (let i = 0; i <= 10; i++) box(o, 0.02, 1.2, 0.02, 0x2f302e, cx - winW / 2 + (winW * i) / 10, 0.85, -D / 2 - 0.03);
    box(o, winW, 0.03, 0.03, 0x2f302e, cx, 1.45, -D / 2 - 0.03);
  }
  // door in the middle, glazed upper half
  box(o, 0.9, 2.0, 0.04, 0xd8d4c6, 0, 0.2, -D / 2 - 0.02);
  box(o, 0.7, 0.8, 0.02, 0x3a4652, 0, 1.2, -D / 2 - 0.045, { mat: 'glass' });
  // red corrugated fascia all round, a low red roof, the dome
  box(o, W + 0.5, 0.42, D + 0.5, red, 0, H - 0.2, 0);
  for (let i = 0; i < 30; i++) box(o, 0.04, 0.42, 0.04, 0x9a2824, -W / 2 - 0.2 + ((W + 0.4) * i) / 29, H - 0.2, -D / 2 - 0.26);
  box(o, W + 0.3, 0.1, D + 0.3, 0x9a2824, 0, H + 0.22, 0);
  {
    const [dx, dy, dz] = L(o, -W / 2 + 1.3, H + 0.3, 0);
    const g = new THREE.SphereGeometry(1.0, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2);
    g.scale(1, 1.25, 1);
    o.batch.add(g, { color: red, matrix: new THREE.Matrix4().makeTranslation(dx, dy, dz) });
    o.batch.cyl(0.04, 0.5, 0xe0b030, dx, dy + 1.2, dz, { seg: 5 });
  }
  const signLines = opts.sign ?? ['24 сағат', '24 часа', 'Азық-түлік · Продукты'];
  const sign = boardGeo(`pav|${signLines.join('|')}`, W * 0.8, 0.36, {
    bg: '#f6f0dc', fg: '#b3302b', lines: [signLines.join('  ·  ')], family: FONT.narrow, wear: 0.4,
  });
  quad(o, sign, 0, H + 0.01, -D / 2 - 0.27, 0);
  quad(o, posterGeo(rng.int(1, 500)), W / 2 + 0.012, 1.4, 0.3, -Math.PI / 2, ATLAS.cutout);
  collide(o, 0, 0, W + 0.1, D + 0.1, H);
  if (opts.item) {
    const it = opts.item;
    interact(o, 0, 1.2, -D / 2 - 0.25, 1.2, 1.4, 0.5, `${it.label} · ${it.price} ₸`, (game) => buy(game, it, L(o, 0, 1.2, -D / 2)));
  }
  return { hx: W / 2 + 0.3, hz: D / 2 + 0.3 };
}

/* The rate board in the exchange booth window, June 2007: [code, buy, sell]. */
const RATES = [['USD', '121.50', '122.30'], ['EUR', '163.00', '165.00'], ['RUB', '4.70', '4.78']];

/** A tiny flag beside each currency code, drawn in the cell at (x, y). */
function flagMark(c, code, x, y, w, h) {
  c.save();
  c.fillStyle = '#ffffff';
  c.fillRect(x - 2, y - 2, w + 4, h + 4);
  if (code === 'USD') {
    for (let i = 0; i < 7; i++) { c.fillStyle = i % 2 ? '#ffffff' : '#b8232f'; c.fillRect(x, y + (h * i) / 7, w, h / 7 + 0.5); }
    c.fillStyle = '#23336e';
    c.fillRect(x, y, w * 0.45, h * 0.55);
  } else if (code === 'EUR') {
    c.fillStyle = '#1f3d9a';
    c.fillRect(x, y, w, h);
    c.fillStyle = '#f2c230';
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      c.beginPath(); c.arc(x + w / 2 + Math.cos(a) * h * 0.32, y + h / 2 + Math.sin(a) * h * 0.32, h * 0.055, 0, Math.PI * 2); c.fill();
    }
  } else {
    ['#ffffff', '#2a4fa8', '#c8282e'].forEach((col, i) => { c.fillStyle = col; c.fillRect(x, y + (h * i) / 3, w, h / 3 + 0.5); });
  }
  c.restore();
}

/**
 * The painted rate board of a 2007 exchange booth: an aluminium frame,
 * a blue bilingual header, and white plastic number cards slotted in by
 * hand each morning. No LEDs yet. Three columns that never overlap:
 * currency, buy, sell.
 */
function drawRates(c, pw, ph) {
  const u = pw / 100;
  // aluminium frame and the dark board inside it
  c.fillStyle = '#b9bcbd';
  c.fillRect(0, 0, pw, ph);
  c.fillStyle = '#8d9092';
  c.fillRect(1.2 * u, 1.2 * u, pw - 2.4 * u, ph - 2.4 * u);
  c.fillStyle = '#1d2226';
  c.fillRect(2.4 * u, 2.4 * u, pw - 4.8 * u, ph - 4.8 * u);
  // header
  c.fillStyle = '#1b3f8a';
  c.fillRect(2.4 * u, 2.4 * u, pw - 4.8 * u, 17 * u);
  centerText(c, 'ВАЛЮТА БАҒАМЫ', pw / 2, 8 * u, 88 * u, 7 * u, '#ffffff', { family: FONT.narrow });
  centerText(c, 'КУРС ВАЛЮТ', pw / 2, 15 * u, 60 * u, 5.4 * u, '#f2c230', { family: FONT.narrow });
  // the date, on its own slotted card
  c.fillStyle = '#f1efe8';
  c.fillRect(34 * u, 21.5 * u, 32 * u, 6.5 * u);
  centerText(c, '15.06.2007', pw / 2, 24.9 * u, 29 * u, 5 * u, '#1d2226', { family: FONT.mono });
  // column heads
  const cols = { code: [4, 36], buy: [38, 67], sell: [69, 96] };
  const mid = ([a, b]) => ((a + b) / 2) * u;
  const wid = ([a, b]) => (b - a) * u;
  centerText(c, 'САТЫП АЛУ', mid(cols.buy), 32.5 * u, wid(cols.buy) - u, 3.9 * u, '#d9dcd6', { family: FONT.narrow });
  centerText(c, 'ПОКУПКА', mid(cols.buy), 37 * u, wid(cols.buy) - u, 3.9 * u, '#f2c230', { family: FONT.narrow });
  centerText(c, 'САТУ', mid(cols.sell), 32.5 * u, wid(cols.sell) - u, 3.9 * u, '#d9dcd6', { family: FONT.narrow });
  centerText(c, 'ПРОДАЖА', mid(cols.sell), 37 * u, wid(cols.sell) - u, 3.9 * u, '#f2c230', { family: FONT.narrow });
  c.fillStyle = '#5b6064';
  c.fillRect(4 * u, 40.5 * u, 92 * u, 0.6 * u);
  RATES.forEach(([code, buy, sell], i) => {
    const y = 43 + i * 18;
    const cy = (y + 7.5) * u;
    flagMark(c, code, 5.5 * u, (y + 4) * u, 9 * u, 7 * u);
    centerText(c, code, 26 * u, cy, 17 * u, 10 * u, '#ffffff', { family: FONT.narrow });
    for (const [col, val] of [[cols.buy, buy], [cols.sell, sell]]) {
      // the white number card with a slight shadow in its slot
      const x0 = (col[0] + 1) * u, w = wid(col) - 2 * u;
      c.fillStyle = 'rgba(0,0,0,.45)';
      c.fillRect(x0 + 0.6 * u, (y + 1.6) * u, w, 13 * u);
      c.fillStyle = '#f4f2ea';
      c.fillRect(x0, y * u, w, 13 * u);
      c.fillStyle = 'rgba(0,0,0,.12)';
      c.fillRect(x0, (y + 6.4) * u, w, 0.35 * u);
      centerText(c, val, x0 + w / 2, cy - 0.3 * u, w - 2.4 * u, 10 * u, '#161a1d', { family: FONT.mono });
    }
  });
  c.fillStyle = '#5b6064';
  c.fillRect(4 * u, 97 * u - 3 * u, 92 * u, 0.5 * u);
}

/** Glazed booth with a yellow roof: 'press' or 'exchange'. */
export function addBooth(ctx, x, z, yaw, opts = {}) {
  const o = frame(ctx, x, z, yaw);
  const kind = opts.kind ?? 'press';
  const W = 1.9, D = 1.7, H = 2.35;
  const frameC = 0xe8e6e0;
  box(o, W + 0.06, 0.2, D + 0.06, PAL.metalDark, 0, 0, 0);
  // glass box with the goods behind it
  box(o, W - 0.08, H - 0.3, D - 0.08, 0x2f3740, 0, 0.2, 0, { mat: 'glass' });
  if (kind === 'press') {
    const g = pressGeo(W - 0.2, 1.3);
    quad(o, g, 0, 1.25, -D / 2 - 0.01, 0);
    quad(o, pressGeo(D - 0.2, 1.3), -W / 2 - 0.01, 1.25, 0, Math.PI / 2);
  } else {
    const rates = atlasQuad('rates-2007', 0.92, 0.92, drawRates, { ppm: 560 });
    quad(o, rates, -0.35, 1.45, -D / 2 - 0.012, 0);
    box(o, 0.4, 0.3, 0.03, 0x1e1c1a, 0.5, 1.0, -D / 2 - 0.03);
  }
  for (const [lx, lz] of [[-W / 2, -D / 2], [W / 2, -D / 2], [-W / 2, D / 2], [W / 2, D / 2]]) box(o, 0.06, H - 0.2, 0.06, frameC, lx, 0.2, lz);
  box(o, W + 0.02, 0.06, D + 0.02, frameC, 0, 0.9, 0);
  // yellow roof with a lip and the sign
  box(o, W + 0.4, 0.28, D + 0.4, 0xe8c030, 0, H - 0.08, 0);
  const sign = kind === 'press'
    ? boardGeo('booth-press', W + 0.3, 0.26, { bg: '#e8c030', fg: '#1b3f8a', lines: ['Баспасөз · Печать'], family: FONT.narrow, wear: 0.3 })
    : boardGeo('booth-exch', W + 0.3, 0.26, { bg: '#e8c030', fg: '#1b3f8a', lines: ['Айырбастау · Обмен валют'], family: FONT.narrow, wear: 0.3 });
  quad(o, sign, 0, H + 0.06, -D / 2 - 0.21, 0);
  collide(o, 0, 0, W + 0.1, D + 0.1, H);
  if (kind === 'press') {
    interact(o, 0.3, 1.1, -D / 2 - 0.2, 0.9, 0.8, 0.5, 'Buy «Диапазон», the local paper · 50 ₸', (game) => {
      buy(game, {
        price: 50, what: 'the newspaper', sound: 'paper',
        toast: '«Диапазон»: the heat, the new mosque, and the tenge at 122.',
        onBuy: (g) => { shop(g).papers++; },
      }, L(o, 0.3, 1.1, -D / 2));
    });
    interact(o, -W / 2 - 0.2, 1.1, 0.0, 0.5, 0.8, 0.9, 'Buy a Kazakhtelecom phone card · 250 ₸', (game) => {
      buy(game, {
        price: 250, what: 'a phone card', sound: 'paper',
        toast: 'A Kazakhtelecom card, 50 units. The payphone by the stop takes it.',
        onBuy: (g) => { shop(g).phoneUnits += 50; },
      }, L(o, -W / 2, 1.1, 0));
    });
  } else {
    interact(o, 0.5, 1.1, -D / 2 - 0.2, 0.9, 0.8, 0.5, 'Exchange booth · dollars', (game) => {
      game.audio.play('kioskWindow', { volume: 0.5 });
      game.hud.flash(`USD ${RATES[0][1]} / ${RATES[0][2]} · EUR ${RATES[1][1]} / ${RATES[1][2]} · RUB ${RATES[2][1]} / ${RATES[2][2]}. You have no dollars.`, 3200);
    });
  }
  return { hx: W / 2 + 0.2, hz: D / 2 + 0.3 };
}

/** Chest freezer on wheels, under a striped umbrella. */
export function addIceCream(ctx, x, z, yaw) {
  const o = frame(ctx, x, z, yaw);
  box(o, 1.15, 0.75, 0.72, 0xf2f2ee, 0, 0.12, 0);
  box(o, 1.16, 0.16, 0.73, 0x2d5ea8, 0, 0.5, 0);
  box(o, 1.05, 0.03, 0.62, 0x3a4652, 0, 0.87, 0, { mat: 'glass' });
  for (const [lx, lz] of [[-0.45, -0.28], [0.45, -0.28], [-0.45, 0.28], [0.45, 0.28]]) cyl(o, 0.06, 0.12, 0x222222, lx, 0, lz, { seg: 8 });
  const label = boardGeo('icecream', 1.0, 0.3, { bg: '#2d5ea8', fg: '#ffffff', lines: ['Балмұздақ · Мороженое'], family: FONT.narrow, wear: 0.2 });
  quad(o, label, 0, 0.52, -0.37, 0);
  priceCard(o, 'plombir', ['Пломбир 50 тг', 'Эскимо 40 тг'], 0.3, 1.03, 0.1, 0, 0.42, 0.26);
  umbrella(o, 0.2, 0.55, { r: 1.25, h: 2.25, a: 0x2d5ea8, b: 0xf2eee4 });
  // the seller's folding stool
  box(o, 0.36, 0.04, 0.36, 0x2f6a3a, 0.9, 0.42, 0.45);
  for (const s of [-1, 1]) box(o, 0.03, 0.42, 0.34, 0x8a8a88, 0.9 + s * 0.15, 0, 0.45);
  collide(o, 0, 0, 1.2, 0.8, 0.9);
  interact(o, -0.25, 1.0, -0.2, 0.7, 0.6, 0.8, 'Пломбир in a waffle cup · 50 ₸', (game) => {
    buy(game, { price: 50, what: 'ice cream', sound: 'paper', hold: 'plombir', toast: 'Пломбир, the good kind. It melts faster than you can eat it.', onBuy: (g) => { shop(g).icecreams++; } });
  });
  interact(o, 0.35, 1.0, -0.2, 0.5, 0.6, 0.8, 'Эскимо on a stick · 40 ₸', (game) => {
    buy(game, { price: 40, what: 'ice cream', sound: 'paper', hold: 'eskimo', toast: 'Эскимо: vanilla in a chocolate coat, on a wooden stick.', onBuy: (g) => { shop(g).icecreams++; } });
  });
  return { hx: 1.4, hz: 1.2 };
}

/** The yellow kvass barrel on its trailer, with a table of glasses. */
export function addKvass(ctx, x, z, yaw) {
  const o = frame(ctx, x, z, yaw);
  const yellow = 0xe8b72a;
  // chassis, wheels, drawbar
  box(o, 2.0, 0.12, 0.9, 0x3a3c3e, 0, 0.42, 0);
  for (const s of [-1, 1]) {
    const [wx, wy, wz] = L(o, 0.1, 0.36, s * 0.55);
    const g = new THREE.CylinderGeometry(0.36, 0.36, 0.18, 14);
    g.rotateX(Math.PI / 2);
    o.batch.add(g, { color: 0x222222, matrix: new THREE.Matrix4().makeRotationY(o.yaw).setPosition(wx, wy, wz) });
  }
  {
    const [ax, ay, az] = L(o, -1.0, 0.45, 0);
    const [bx, by, bz] = L(o, -1.9, 0.18, 0);
    o.batch.tube(ax, ay, az, bx, by, bz, 0.04, 0x3a3c3e);
    const [sx, , sz] = L(o, -1.9, 0, 0);
    o.batch.cyl(0.03, 0.2, 0x3a3c3e, sx, o.y, sz, { seg: 5 });
  }
  // the tank, lying along local x
  {
    const [tx, ty, tz] = L(o, 0, 1.12, 0);
    const g = new THREE.CylinderGeometry(0.62, 0.62, 2.1, 20);
    g.rotateZ(Math.PI / 2);
    o.batch.add(g, { color: yellow, matrix: new THREE.Matrix4().makeRotationY(o.yaw).setPosition(tx, ty, tz) });
    const cap = new THREE.CylinderGeometry(0.2, 0.2, 0.14, 12);
    o.batch.add(cap, { color: yellow, matrix: new THREE.Matrix4().setPosition(tx, ty + 0.66, tz) });
  }
  // КВАС in red letters on both sides
  const letters = atlasQuad('kvass-letters', 1.3, 0.42, (c, pw, ph) => {
    c.clearRect(0, 0, pw, ph);
    centerText(c, 'КВАС', pw / 2, ph / 2, pw * 0.95, ph * 0.9, '#c0242a', { family: FONT.sans, stretch: 1 });
  }, { ppm: 300 });
  quad(o, letters, 0.1, 1.15, -0.63, 0, ATLAS.cutout);
  quad(o, letters, 0.1, 1.15, 0.63, Math.PI, ATLAS.cutout);
  // tap at the back end, a bucket under it
  box(o, 0.12, 0.08, 0.08, 0xb0b0b0, 1.1, 0.78, 0);
  cyl(o, 0.13, 0.25, 0x8aa0b0, 1.2, 0, 0, { seg: 10, rTop: 0.15 });
  // folding table with mugs and the price
  box(o, 0.8, 0.04, 0.55, 0xd8d4c6, 1.1, 0.72, -0.9);
  for (const s of [-1, 1]) box(o, 0.03, 0.72, 0.5, 0x8a8a88, 1.1 + s * 0.35, 0, -0.9);
  for (let i = 0; i < 5; i++) cyl(o, 0.04, 0.12, 0x9a6a2a, 0.85 + i * 0.12, 0.76, -0.85, { seg: 7 });
  priceCard(o, 'kvass', ['Квас · 1 стакан', '30 тг'], 1.1, 0.95, -1.08, 0, 0.4, 0.25);
  umbrella(o, 1.3, -0.6, { r: 1.2, h: 2.2, a: 0xc8302a, b: 0xe8c030 });
  collide(o, 0, 0, 2.2, 1.35, 1.8);
  interact(o, 1.1, 0.9, -0.95, 0.9, 0.6, 0.7, 'A glass of cold kvass · 30 ₸', (game) => {
    buy(game, { price: 30, what: 'kvass', sound: 'pour', hold: 'kvass', toast: 'Cold, sour-sweet kvass from the barrel. Worth the queue.' });
  });
  return { hx: 2.1, hz: 1.4 };
}

/** Buckets of flowers under an umbrella, the flower sellers by the akimat. */
export function addFlowers(ctx, x, z, yaw) {
  const o = frame(ctx, x, z, yaw);
  const rng = rngKit(Math.round(x * 5 + z * 11));
  box(o, 1.6, 0.04, 0.7, 0xd8d4c6, 0, 0.7, 0);
  for (const s of [-1, 1]) box(o, 0.03, 0.7, 0.66, 0x8a8a88, s * 0.72, 0, 0);
  for (let i = 0; i < 6; i++) {
    const lx = -0.6 + i * 0.24;
    cyl(o, 0.1, 0.3, 0x5a7a9a, lx, 0.74, 0, { seg: 8, rTop: 0.12 });
    const col = rng.pick([0xc8203a, 0xf2f0ea, 0xe86a9a, 0xe8c030, 0xd84a2a]);
    for (let k = 0; k < 5; k++) {
      const [fx, fy, fz] = L(o, lx + rng.range(-0.08, 0.08), 1.12 + rng.range(0, 0.12), rng.range(-0.08, 0.08));
      o.batch.add(new THREE.IcosahedronGeometry(0.06, 0), { color: col, matrix: new THREE.Matrix4().makeTranslation(fx, fy, fz) });
    }
    for (let k = 0; k < 3; k++) {
      const [ax, ay, az] = L(o, lx, 0.9, 0);
      const [bx, by, bz] = L(o, lx + rng.range(-0.08, 0.08), 1.14, rng.range(-0.06, 0.06));
      o.batch.tube(ax, ay, az, bx, by, bz, 0.008, 0x4f7236, { seg: 3, cast: false });
    }
  }
  priceCard(o, 'flowers', ['Гүлдер · Цветы', 'букет 400 тг'], 0, 0.84, -0.37, 0, 0.5, 0.26);
  umbrella(o, 0, 0.45, { r: 1.2, h: 2.2, a: 0x2f7a4a, b: 0xf2eee4 });
  collide(o, 0, 0, 1.7, 0.8, 1.0);
  interact(o, 0, 1.0, -0.3, 1.2, 0.6, 0.6, 'A bouquet of roses · 400 ₸', (game) => {
    buy(game, { price: 400, what: 'flowers', sound: 'paper', toast: 'Seven roses, wrapped in cellophane. For someone.' });
  });
  return { hx: 1.4, hz: 1.2 };
}

/** Kazakhtelecom card payphone under a half-shell hood. */
export function addPayphone(ctx, x, z, yaw) {
  const o = frame(ctx, x, z, yaw);
  cyl(o, 0.05, 2.1, 0x8e9294, 0, 0, 0.12, { seg: 6 });
  // hood: a curved shell, blue outside
  {
    const [hx, hy, hz] = L(o, 0, 1.45, 0.02);
    const g = new THREE.CylinderGeometry(0.42, 0.42, 1.05, 12, 1, true, -Math.PI / 2, Math.PI);
    o.batch.add(g, { color: 0x2d6ab8, matrix: new THREE.Matrix4().makeRotationY(o.yaw + Math.PI).setPosition(hx, hy, hz) });
    const top = new THREE.CylinderGeometry(0.44, 0.44, 0.05, 12, 1, false, -Math.PI / 2, Math.PI);
    o.batch.add(top, { color: 0xe8e8e2, matrix: new THREE.Matrix4().makeRotationY(o.yaw + Math.PI).setPosition(hx, hy + 0.54, hz) });
  }
  // the phone itself
  box(o, 0.24, 0.4, 0.12, 0xb8bcbe, 0, 1.1, 0.12);
  box(o, 0.12, 0.14, 0.01, 0x2a2c2e, 0, 1.18, 0.055);
  box(o, 0.06, 0.24, 0.07, 0x1e1e1e, -0.16, 1.18, 0.1);
  const label = boardGeo('telecom', 0.6, 0.12, { bg: '#e8e8e2', fg: '#1d4f9a', lines: ['Қазақтелеком'], family: FONT.narrow, wear: 0.2 });
  quad(o, label, 0, 1.92, -0.33, 0);
  ctx.colliders.circle(L(o, 0, 0, 0.12)[0], L(o, 0, 0, 0.12)[2], 0.2, { tag: 'payphone' });
  interact(o, 0, 1.2, -0.05, 0.6, 0.8, 0.5, () => 'Make a call from the payphone', (game) => callHome(game, L(o, 0, 1.2, 0.1)));
  return { hx: 0.5, hz: 0.5 };
}

let calling = false;
function callHome(game, at) {
  const st = shop(game);
  const pos = { x: at[0], y: at[1], z: at[2] };
  if (st.phoneUnits <= 0) {
    game.audio.play('click', { pos });
    game.hud.flash('It takes Kazakhtelecom cards. The newspaper kiosk sells them.', 2600);
    return;
  }
  if (calling) return;
  calling = true;
  st.phoneUnits = Math.max(0, st.phoneUnits - 3);
  game.audio.play('cardBeep', { pos });
  setTimeout(() => game.audio.play('dialTone', { pos }), 300);
  setTimeout(() => game.audio.play('dtmf', { pos, digits: '546213' }), 2000);
  setTimeout(() => game.audio.play('ringback', { pos }), 3300);
  setTimeout(() => {
    game.hud.flash(`Mum picks up: «Ужин в семь, не опаздывай!» · ${st.phoneUnits} units left`, 3400);
    calling = false;
  }, 5200);
}

/** Blue post box of Казпочта, on a post. */
export function addPostbox(ctx, x, z, yaw) {
  const o = frame(ctx, x, z, yaw);
  cyl(o, 0.04, 0.95, 0x6f7478, 0, 0, 0, { seg: 6 });
  box(o, 0.42, 0.55, 0.26, 0x1d56b0, 0, 0.9, 0);
  box(o, 0.44, 0.06, 0.28, 0x1a4a98, 0, 1.45, 0);
  box(o, 0.24, 0.03, 0.01, 0x111111, 0, 1.3, -0.135);
  const label = boardGeo('pochta', 0.36, 0.16, { bg: '#1d56b0', fg: '#f2c230', lines: ['ПОШТА', 'ПОЧТА'], family: FONT.narrow, wear: 0.2 });
  quad(o, label, 0, 1.1, -0.136, 0);
  ctx.colliders.circle(x, z, 0.28, { tag: 'postbox' });
  interact(o, 0, 1.1, -0.1, 0.5, 0.6, 0.4, 'Post box · Казпочта', (game) => {
    game.audio.play('paper', { volume: 0.4 });
    game.hud.flash('Collection at 9:00 and 17:00. The last one has gone.', 2200);
  });
  return { hx: 0.3, hz: 0.3 };
}

/** A bicycle leaning on a wall: a Кама or an Аист, the family's only one. */
export function addBicycle(ctx, x, z, yaw, color = 0x2f6a9a) {
  const o = frame(ctx, x, z, yaw);
  const lean = 0.22;
  const put = (lx, ly, lz) => {
    const [px, py, pz] = L(o, lx, ly, lz);
    const m = new THREE.Matrix4().compose(
      new THREE.Vector3(px, py, pz),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(lean, o.yaw, 0, 'YXZ')),
      new THREE.Vector3(1, 1, 1),
    );
    return m;
  };
  for (const lx of [-0.52, 0.52]) {
    const g = new THREE.TorusGeometry(0.3, 0.022, 5, 18);
    o.batch.add(g, { color: 0x1e1e1e, matrix: put(lx, 0.33, 0), cast: true });
    g.dispose();
  }
  // frame as tubes in the leaning plane
  const pts = [[-0.52, 0.33], [-0.05, 0.36], [0.35, 0.72], [-0.12, 0.72], [-0.05, 0.36], [0.35, 0.72], [0.52, 0.33], [-0.12, 0.72], [-0.52, 0.33]];
  const tilt = (lx, ly) => {
    const zOff = Math.sin(lean) * ly;
    const [px, , pz] = L(o, lx, 0, zOff);
    return [px, o.y + Math.cos(lean) * ly, pz];
  };
  for (let i = 0; i < pts.length - 1; i++) {
    const a = tilt(...pts[i]), b = tilt(...pts[i + 1]);
    o.batch.tube(a[0], a[1], a[2], b[0], b[1], b[2], 0.018, color, { seg: 4 });
  }
  const s = tilt(-0.12, 0.8), hb = tilt(0.38, 0.92);
  o.batch.box(0.22, 0.05, 0.1, 0x1e1e1e, s[0], s[1], s[2], { ry: o.yaw });
  o.batch.box(0.05, 0.03, 0.5, 0x9a9a9a, hb[0], hb[1], hb[2], { ry: o.yaw });
  return { hx: 0.9, hz: 0.4 };
}

/** Mobile operator and bank posters (text only), for kiosk walls. */
export function brandPoster(kind) {
  const designs = {
    kcell: { bg: '#1e3f8f', fg: '#ffffff', lines: ["K'Cell", 'Карты оплаты · Төлем карталары'], sizes: [2, 1] },
    activ: { bg: '#e8742a', fg: '#ffffff', lines: ['Activ', 'Сөйле! Говори!'], sizes: [2, 1] },
    kmobile: { bg: '#f2f2ee', fg: '#1f5aa8', lines: ['K-Mobile', 'Excess · карты здесь'], sizes: [2, 1] },
    beeline: { bg: '#f2c230', fg: '#111111', lines: ['Beeline', 'Живи на яркой стороне'], sizes: [2, 1] },
  };
  const d = designs[kind] || designs.kcell;
  return boardGeo(`brand|${kind}`, 0.62, 0.86, { ...d, family: FONT.sans, wear: 0.5, border: '#ffffff', seed: kind.length });
}

