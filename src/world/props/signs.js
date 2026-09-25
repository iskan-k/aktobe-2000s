import * as THREE from 'three';
import { cel } from '../../core/toon.js';
import { FONT, centerText, fitFont, weather, hex } from '../../core/textures.js';
import { rngKit } from '../../core/util.js';
import { PAL } from '../../core/palette.js';

/* ------------------------------------------------------------------ *
 * Signs of the street: road signs, street name plates, stop boards,
 * posters, price cards and every other small painted face.
 *
 * They all live in one shared texture atlas, so a hundred signs cost a
 * handful of draw calls: `atlasQuad(key, w, h, draw)` allocates a slot,
 * paints it once with Canvas2D and returns a plane geometry of w x h
 * metres whose uv points into that slot. Add the geometry to the static
 * batch with `mat: ATLAS.material` and it merges with every other sign.
 *
 * Road signs follow the Soviet GOST standard still used in Kazakhstan in
 * 2007: blue squares for information, red-rimmed circles for bans, the
 * yellow diamond for the main road, the inverted triangle for give way.
 * ------------------------------------------------------------------ */

const SIZE = 4096;
const PAD = 6;

class Atlas {
  constructor(size = SIZE) {
    this.size = size;
    this.canvas = document.createElement('canvas');
    this.canvas.width = this.canvas.height = size;
    this.ctx = this.canvas.getContext('2d', { willReadFrequently: true });
    this.slots = new Map();
    // shelf packing: each shelf holds slots of about its own height
    this.shelves = [];
    this.bottom = PAD;
    this.tex = new THREE.CanvasTexture(this.canvas);
    this.tex.colorSpace = THREE.SRGBColorSpace;
    this.tex.anisotropy = 8;
    this.tex.generateMipmaps = true;
    this.tex.minFilter = THREE.LinearMipmapLinearFilter;
    this.material = cel({ map: this.tex, bands: 3, grime: 0.03, dirt: 0, cache: false });
    this.glow = new THREE.MeshBasicMaterial({ map: this.tex });
    this.cutout = cel({ map: this.tex, bands: 3, grime: 0.02, dirt: 0, alphaTest: 0.5, cache: false });
    // flat on the ground: litter, stains, fluff drifts
    this.decal = cel({ map: this.tex, bands: 3, grime: 0.02, dirt: 0, alphaTest: 0.45, polygonOffset: 3, cache: false });
    this.soft = cel({ map: this.tex, bands: 'soft', grime: 0, dirt: 0, transparent: true, depthWrite: false, polygonOffset: 3, cache: false });
    this.full = false;
  }

  /** Reserve a w x h pixel slot, paint it with draw(ctx, w, h) and return its rect. */
  slot(key, pw, ph, draw) {
    if (this.slots.has(key)) return this.slots.get(key);
    const fits = (s) => ph <= s.h && s.x + pw + PAD <= this.size;
    let shelf = this.shelves.find((s) => fits(s) && ph >= s.h * 0.6);
    if (!shelf && this.bottom + ph + PAD <= this.size) {
      shelf = { x: PAD, y: this.bottom, h: ph };
      this.shelves.push(shelf);
      this.bottom += ph + PAD * 2;
    }
    if (!shelf) shelf = this.shelves.find(fits);
    if (!shelf) {
      console.warn('[signs] atlas full, reusing a slot for', key);
      this.full = true;
      return this.slots.values().next().value;
    }
    const rect = { x: shelf.x, y: shelf.y, w: pw, h: ph };
    const c = this.ctx;
    c.save();
    c.translate(rect.x, rect.y);
    c.beginPath();
    c.rect(0, 0, pw, ph);
    c.clip();
    draw(c, pw, ph);
    c.restore();
    // bleed the edge pixels into the padding so mipmaps do not pick up the neighbours
    const img = c.getImageData(rect.x, rect.y, pw, ph);
    c.putImageData(img, rect.x - 1, rect.y);
    c.putImageData(img, rect.x + 1, rect.y);
    c.putImageData(img, rect.x, rect.y - 1);
    c.putImageData(img, rect.x, rect.y + 1);
    c.putImageData(img, rect.x, rect.y);
    shelf.x += pw + PAD * 2;
    this.slots.set(key, rect);
    this.tex.needsUpdate = true;
    return rect;
  }

  /** Map a geometry's 0..1 uv into a slot. */
  remap(g, rect, flipU = false) {
    const uv = g.attributes.uv;
    const S = this.size;
    const u0 = rect.x / S, u1 = (rect.x + rect.w) / S;
    const vTop = 1 - rect.y / S, vBot = 1 - (rect.y + rect.h) / S;
    for (let i = 0; i < uv.count; i++) {
      let u = uv.getX(i);
      if (flipU) u = 1 - u;
      uv.setXY(i, u0 + u * (u1 - u0), vBot + uv.getY(i) * (vTop - vBot));
    }
    uv.needsUpdate = true;
    return g;
  }
}

export const ATLAS = new Atlas();
export { Atlas };

/**
 * A w x h metre plane (facing +z, centred at the origin) showing the
 * atlas slot `key`, painted by draw(ctx, pw, ph) at `ppm` pixels per metre.
 */
export function atlasQuad(key, w, h, draw, { ppm = 160, flipU = false, maxPx = 1024 } = {}) {
  let pw = Math.max(8, Math.round(w * ppm));
  let ph = Math.max(8, Math.round(h * ppm));
  const k = Math.min(1, maxPx / Math.max(pw, ph));
  pw = Math.round(pw * k);
  ph = Math.round(ph * k);
  const rect = ATLAS.slot(key, pw, ph, draw);
  const g = new THREE.PlaneGeometry(w, h);
  return ATLAS.remap(g, rect, flipU);
}

/** Place an atlas quad in the batch at (x, y, z) facing yaw (front toward local -z by default). */
export function addQuad(batch, geo, x, y, z, yaw, { mat = ATLAS.material, pitch = 0, back = false } = {}) {
  const m = new THREE.Matrix4().compose(
    new THREE.Vector3(x, y, z),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(pitch, yaw + (back ? 0 : Math.PI), 0, 'YXZ')),
    new THREE.Vector3(1, 1, 1),
  );
  batch.add(geo, { matrix: m, mat, color: null, cast: false });
}

/* ------------------------------------------------------------------ *
 * Painters
 * ------------------------------------------------------------------ */

function roundRect(c, x, y, w, h, r) {
  c.beginPath();
  c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + h, r);
  c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r);
  c.arcTo(x, y, x + w, y, r);
  c.closePath();
}

/** Tiny walking man for the crossing sign. */
function walker(c, cx, cy, s, color) {
  c.fillStyle = color;
  c.strokeStyle = color;
  c.lineCap = 'round';
  c.lineWidth = s * 0.16;
  c.beginPath(); c.arc(cx + s * 0.08, cy - s * 0.62, s * 0.13, 0, Math.PI * 2); c.fill();
  c.beginPath();
  c.moveTo(cx + s * 0.04, cy - s * 0.45); c.lineTo(cx - s * 0.04, cy + s * 0.05);
  c.moveTo(cx - s * 0.04, cy + s * 0.05); c.lineTo(cx - s * 0.3, cy + s * 0.55);
  c.moveTo(cx - s * 0.04, cy + s * 0.05); c.lineTo(cx + s * 0.25, cy + s * 0.55);
  c.moveTo(cx + s * 0.02, cy - s * 0.35); c.lineTo(cx - s * 0.3, cy - s * 0.05);
  c.moveTo(cx + s * 0.02, cy - s * 0.35); c.lineTo(cx + s * 0.3, cy - s * 0.1);
  c.stroke();
}

function busIcon(c, x, y, w, h, color) {
  c.fillStyle = color;
  roundRect(c, x, y, w, h * 0.78, h * 0.12);
  c.fill();
  c.fillStyle = '#fff';
  const n = 4;
  for (let i = 0; i < n; i++) c.fillRect(x + w * (0.08 + i * 0.22), y + h * 0.12, w * 0.16, h * 0.28);
  c.fillStyle = color;
  c.beginPath(); c.arc(x + w * 0.25, y + h * 0.8, h * 0.13, 0, Math.PI * 2); c.fill();
  c.beginPath(); c.arc(x + w * 0.75, y + h * 0.8, h * 0.13, 0, Math.PI * 2); c.fill();
}

/**
 * Road sign faces, 0.7 m. Types: crossing, busstop, trolleystop,
 * priority, giveway, speed60, noentry, nostop, noparking.
 */
export function roadSignGeo(type, size = 0.7) {
  const draw = (c, w, h) => {
    c.clearRect(0, 0, w, h);
    const m = w * 0.04;
    if (type === 'crossing' || type === 'busstop' || type === 'trolleystop') {
      c.fillStyle = '#1b56a8';
      roundRect(c, m, m, w - 2 * m, h - 2 * m, w * 0.06);
      c.fill();
      c.strokeStyle = '#fff';
      c.lineWidth = w * 0.025;
      roundRect(c, m * 2, m * 2, w - 4 * m, h - 4 * m, w * 0.05);
      c.stroke();
      if (type === 'crossing') {
        c.fillStyle = '#fff';
        c.beginPath();
        c.moveTo(w * 0.5, h * 0.16); c.lineTo(w * 0.86, h * 0.82); c.lineTo(w * 0.14, h * 0.82);
        c.closePath(); c.fill();
        // zebra stripes under the walker
        c.fillStyle = '#1b56a8';
        for (let i = 0; i < 4; i++) c.fillRect(w * (0.3 + i * 0.11), h * 0.72, w * 0.06, h * 0.06);
        walker(c, w * 0.5, h * 0.55, w * 0.34, '#111');
      } else {
        c.fillStyle = '#fff';
        c.fillRect(w * 0.2, h * 0.2, w * 0.6, h * 0.6);
        if (type === 'busstop') busIcon(c, w * 0.26, h * 0.3, w * 0.48, h * 0.4, '#111');
        else {
          busIcon(c, w * 0.26, h * 0.36, w * 0.48, h * 0.34, '#111');
          c.strokeStyle = '#111';
          c.lineWidth = w * 0.02;
          c.beginPath(); c.moveTo(w * 0.42, h * 0.36); c.lineTo(w * 0.34, h * 0.22);
          c.moveTo(w * 0.52, h * 0.36); c.lineTo(w * 0.44, h * 0.22); c.stroke();
        }
      }
    } else if (type === 'priority') {
      c.save();
      c.translate(w / 2, h / 2);
      c.rotate(Math.PI / 4);
      c.fillStyle = '#fff';
      c.fillRect(-w * 0.34, -h * 0.34, w * 0.68, h * 0.68);
      c.strokeStyle = '#222';
      c.lineWidth = w * 0.015;
      c.strokeRect(-w * 0.34, -h * 0.34, w * 0.68, h * 0.68);
      c.fillStyle = '#f2c019';
      c.fillRect(-w * 0.24, -h * 0.24, w * 0.48, h * 0.48);
      c.restore();
    } else if (type === 'giveway') {
      c.fillStyle = '#fff';
      c.beginPath(); c.moveTo(w * 0.04, h * 0.1); c.lineTo(w * 0.96, h * 0.1); c.lineTo(w * 0.5, h * 0.92); c.closePath(); c.fill();
      c.strokeStyle = '#d0231f';
      c.lineWidth = w * 0.09;
      c.lineJoin = 'round';
      c.beginPath(); c.moveTo(w * 0.12, h * 0.15); c.lineTo(w * 0.88, h * 0.15); c.lineTo(w * 0.5, h * 0.84); c.closePath(); c.stroke();
    } else {
      // round signs
      const r = w * 0.46;
      c.beginPath(); c.arc(w / 2, h / 2, r, 0, Math.PI * 2);
      c.fillStyle = type === 'noentry' ? '#d0231f' : type === 'speed60' ? '#fff' : '#1b56a8';
      c.fill();
      if (type === 'speed60') {
        c.strokeStyle = '#d0231f';
        c.lineWidth = w * 0.1;
        c.beginPath(); c.arc(w / 2, h / 2, r - w * 0.05, 0, Math.PI * 2); c.stroke();
        centerText(c, '60', w / 2, h / 2 + h * 0.02, w * 0.6, h * 0.42, '#111', { family: FONT.sans });
      } else if (type === 'noentry') {
        c.fillStyle = '#fff';
        c.fillRect(w * 0.18, h * 0.43, w * 0.64, h * 0.14);
      } else {
        c.strokeStyle = '#d0231f';
        c.lineWidth = w * 0.09;
        c.beginPath(); c.arc(w / 2, h / 2, r - w * 0.045, 0, Math.PI * 2); c.stroke();
        c.lineWidth = w * 0.08;
        c.beginPath();
        c.moveTo(w * 0.24, h * 0.24); c.lineTo(w * 0.76, h * 0.76);
        if (type === 'nostop') { c.moveTo(w * 0.76, h * 0.24); c.lineTo(w * 0.24, h * 0.76); }
        c.stroke();
      }
    }
  };
  return atlasQuad(`road|${type}`, size, size, draw, { ppm: 256 });
}

/** Back of a road sign: plain grey steel. */
export function signBackGeo(size = 0.7, round = false) {
  return atlasQuad(`back|${round ? 'r' : 's'}`, size, size, (c, w, h) => {
    c.clearRect(0, 0, w, h);
    c.fillStyle = '#8c8e8f';
    if (round) { c.beginPath(); c.arc(w / 2, h / 2, w * 0.46, 0, Math.PI * 2); c.fill(); } else c.fillRect(w * 0.04, h * 0.04, w * 0.92, h * 0.92);
  }, { ppm: 64 });
}

/** Blue street name plate: Kazakh on top, Russian below. */
export function streetPlateGeo(road, w = 1.25, h = 0.42) {
  return atlasQuad(`plate|${road.id}`, w, h, (c, pw, ph) => {
    c.fillStyle = '#1d4f9a';
    c.fillRect(0, 0, pw, ph);
    c.strokeStyle = '#f2f2f2';
    c.lineWidth = ph * 0.04;
    c.strokeRect(ph * 0.05, ph * 0.05, pw - ph * 0.1, ph - ph * 0.1);
    centerText(c, road.nameKz, pw / 2, ph * 0.34, pw * 0.9, ph * 0.3, '#fff', { family: FONT.narrow, stretch: 0.9 });
    centerText(c, road.name, pw / 2, ph * 0.7, pw * 0.9, ph * 0.28, '#fff', { family: FONT.narrow, stretch: 0.9 });
    weather(c, pw, ph, road.id.length * 7, 0.4);
  }, { ppm: 300 });
}

/** A generic painted board: bg, lines of text. */
export function boardGeo(key, w, h, { bg = '#fff', fg = '#222', lines = [], sizes = null, family = FONT.sans, border = null, stretch = 0.88, wear = 0.5, ppm = 160, seed = 3, weight = 'bold', paint = null } = {}) {
  return atlasQuad(`board|${key}`, w, h, (c, pw, ph) => {
    c.fillStyle = hex(bg);
    c.fillRect(0, 0, pw, ph);
    if (border) {
      c.strokeStyle = hex(border);
      c.lineWidth = Math.max(2, ph * 0.05);
      c.strokeRect(ph * 0.06, ph * 0.06, pw - ph * 0.12, ph - ph * 0.12);
    }
    if (paint) paint(c, pw, ph);
    const rel = sizes || lines.map(() => 1);
    const total = rel.reduce((a, b) => a + b, 0) || 1;
    const pad = ph * 0.1;
    let y = pad;
    lines.forEach((line, i) => {
      const lh = ((ph - pad * 2) * rel[i]) / total;
      centerText(c, line, pw / 2, y + lh / 2, pw * 0.9, lh * 0.82, fg, { family, stretch, weight });
      y += lh;
    });
    if (wear) weather(c, pw, ph, seed, wear);
  }, { ppm });
}

const POSTER_VARIANTS = 18;

/** Posters glued to walls and poles: small ads, half torn. */
export function posterGeo(anySeed, w = 0.42, h = 0.6) {
  const seed = ((Math.round(anySeed) % POSTER_VARIANTS) + POSTER_VARIANTS) % POSTER_VARIANTS;
  const r = rngKit(seed * 7919 + 13);
  const kinds = [
    ['СДАЮ КВАРТИРУ', '2-комн., 12 мкр', 'тел. 55-14-07'],
    ['РЕПЕТИТОР', 'математика, физика', 'тел. 21-33-80'],
    ['КУПЛЮ', 'золото, серебро', 'дорого'],
    ['КОМПЬЮТЕРНЫЙ КЛУБ', 'Counter-Strike 1.6', '100 тг/час'],
    ['ПЕРЕВОЗКИ', 'Газель, грузчики', 'тел. 8-701-...'],
    ['ПРОДАЮ', 'ВАЗ-2106, 1989 г.', 'в хор. сост.'],
    ['ЦИРК!', 'только 3 дня', 'Центр. стадион'],
    ['ЖҰМЫС / РАБОТА', 'на рынок, продавец', 'тел. 51-02-66'],
  ];
  const k = r.pick(kinds);
  const bg = r.pick(['#f4f0e0', '#fbe79a', '#d8ecf6', '#f7d0c8', '#ffffff']);
  const torn = r.chance(0.5);
  return atlasQuad(`poster|${seed}`, w, h, (c, pw, ph) => {
    c.clearRect(0, 0, pw, ph);
    c.fillStyle = bg;
    c.fillRect(0, 0, pw, ph);
    centerText(c, k[0], pw / 2, ph * 0.18, pw * 0.9, ph * 0.12, '#222', { family: FONT.narrow });
    centerText(c, k[1], pw / 2, ph * 0.4, pw * 0.9, ph * 0.08, '#333', { family: FONT.sans, weight: 'normal' });
    centerText(c, k[2], pw / 2, ph * 0.56, pw * 0.9, ph * 0.08, '#333', { family: FONT.sans, weight: 'normal' });
    // tear-off phone tabs along the bottom
    c.strokeStyle = '#555';
    c.lineWidth = 1;
    const n = 7;
    for (let i = 0; i < n; i++) {
      const x = (pw / n) * i;
      if (r.chance(0.35)) { c.clearRect(x, ph * 0.72, pw / n, ph * 0.28); continue; }
      c.strokeRect(x, ph * 0.72, pw / n, ph * 0.28);
      c.save();
      c.translate(x + pw / n / 2, ph * 0.86);
      c.rotate(-Math.PI / 2);
      c.fillStyle = '#333';
      fitFont(c, '55-14-07', ph * 0.26, pw / n * 0.6, FONT.sans, 'normal');
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.fillText('55-14-07', 0, 0);
      c.restore();
    }
    if (torn) {
      c.globalCompositeOperation = 'destination-out';
      c.beginPath();
      c.moveTo(pw, 0);
      c.lineTo(pw * r.range(0.4, 0.7), 0);
      for (let i = 0; i < 6; i++) c.lineTo(pw * r.range(0.55, 1), ph * (i / 6) * 0.5);
      c.lineTo(pw, ph * 0.5);
      c.closePath();
      c.fill();
      c.globalCompositeOperation = 'source-over';
    }
    weather(c, pw, ph, seed, 0.8);
  }, { ppm: 300 });
}

/** A signpost: a grey steel tube with sign faces stacked from the top. */
export function addSignPost(ctx, x, z, facing, faces, { y = 0.15, height = 2.9, collide = true } = {}) {
  const { batch } = ctx;
  batch.cyl(0.035, height, 0x8e9294, x, y, z, { seg: 6 });
  // the bottom of every signpost was painted in stripes
  batch.cyl(0.037, 0.4, PAL.whitewash, x, y + 0.1, z, { seg: 6 });
  let top = y + height;
  const fx = -Math.sin(facing), fz = -Math.cos(facing);
  for (const f of faces) {
    const size = f.size ?? 0.7;
    const h = f.h ?? size;
    const cy = top - h / 2 - 0.02;
    const px = x + fx * 0.05, pz = z + fz * 0.05;
    addQuad(batch, f.geo, px, cy, pz, facing, { mat: f.mat ?? ATLAS.cutout });
    if (f.backGeo) addQuad(batch, f.backGeo, x - fx * 0.01, cy, z - fz * 0.01, facing + Math.PI, { mat: ATLAS.cutout });
    top -= h + 0.06;
  }
  if (collide) ctx.colliders.circle(x, z, 0.1, { tag: 'signpost' });
}

/* ------------------------------------------------------------------ *
 * Ground marks: litter, cracks, stains and poplar fluff, lying flat on
 * the pavement. A few variants each, so they share atlas slots. Use
 * `ATLAS.decal` for the crisp ones and `ATLAS.soft` for stains and
 * fluff, placed with `addQuad(..., { pitch: -Math.PI / 2 })`.
 * ------------------------------------------------------------------ */

function husk(c, x, y, s, a, open) {
  c.save();
  c.translate(x, y);
  c.rotate(a);
  c.fillStyle = open ? '#3a3632' : '#1e1c1b';
  c.beginPath();
  c.ellipse(0, 0, s, s * 0.5, 0, 0, Math.PI * 2);
  c.fill();
  c.strokeStyle = open ? '#b8b0a2' : '#8d887e';
  c.lineWidth = Math.max(1, s * 0.18);
  c.beginPath();
  c.moveTo(-s * 0.7, 0);
  c.lineTo(s * 0.7, 0);
  c.stroke();
  c.restore();
}

function butt(c, x, y, s, a) {
  c.save();
  c.translate(x, y);
  c.rotate(a);
  c.fillStyle = '#d99c5a';
  c.fillRect(-s, -s * 0.3, s * 1.1, s * 0.6);
  c.fillStyle = '#eeeae0';
  c.fillRect(s * 0.1, -s * 0.28, s * 0.7, s * 0.56);
  c.fillStyle = '#5a5048';
  c.fillRect(s * 0.8, -s * 0.28, s * 0.15, s * 0.56);
  c.restore();
}

/**
 * A round patch of litter, about a metre across. Kinds:
 *   husks   sunflower husks spat round a bench, with a few butts
 *   butts   cigarette ends round a bin or a stop
 *   litter  wrappers, caps, a crushed can, a bus ticket
 */
const LITTER_SIZE = { husks: 1.3, butts: 1.1, litter: 1.1 };

export function litterGeo(kind, variant = 0) {
  const size = LITTER_SIZE[kind] ?? 1.1;
  return atlasQuad(`litter|${kind}|${variant}`, size, size, (c, w, h) => {
    c.clearRect(0, 0, w, h);
    const r = rngKit(variant * 131 + kind.length * 17 + 5);
    const scatter = (p) => {
      const a = r.range(0, Math.PI * 2), d = Math.pow(r.next(), p) * 0.46;
      return [w / 2 + Math.cos(a) * d * w, h / 2 + Math.sin(a) * d * h];
    };
    const px = w / size;   // pixels per metre
    const husks = (n, s) => {
      for (let i = 0; i < n; i++) {
        const [x, y] = scatter(0.75);
        husk(c, x, y, px * s * r.range(0.8, 1.15), r.range(0, 6.3), r.chance(0.35));
      }
    };
    const butts = (n) => {
      for (let i = 0; i < n; i++) {
        const [x, y] = scatter(0.9);
        butt(c, x, y, px * r.range(0.01, 0.013), r.range(0, 6.3));
      }
    };
    if (kind === 'husks') {
      husks(320, 0.0065);
      butts(6);
      return;
    }
    if (kind === 'butts') {
      butts(22);
      husks(60, 0.006);
      return;
    }
    const colours = ['#c8302a', '#2a5aa8', '#e8c440', '#f2efe6', '#6b3a1e', '#3f8a4a'];
    for (let i = 0; i < 7; i++) {
      const [x, y] = scatter(1);
      const ww = px * r.range(0.05, 0.11), hh = px * r.range(0.03, 0.06);
      c.save();
      c.translate(x, y);
      c.rotate(r.range(0, 6.3));
      c.fillStyle = r.pick(colours);
      c.beginPath();
      c.moveTo(-ww / 2, -hh / 2);
      c.lineTo(ww / 2, -hh / 2 + r.range(-2, 2));
      c.lineTo(ww / 2 + r.range(-3, 0), hh / 2);
      c.lineTo(-ww / 2 + r.range(0, 3), hh / 2 + r.range(-2, 2));
      c.closePath();
      c.fill();
      c.fillStyle = 'rgba(255,255,255,0.8)';
      c.fillRect(-ww * 0.3, -hh * 0.12, ww * 0.6, hh * 0.24);
      c.restore();
    }
    for (let i = 0; i < 5; i++) {
      const [x, y] = scatter(1);
      c.fillStyle = r.pick(['#b89a3a', '#9a9ca0', '#c8302a']);
      c.beginPath();
      c.arc(x, y, px * 0.013, 0, Math.PI * 2);
      c.fill();
    }
    // a bus ticket and a crushed can
    const [tx, ty] = scatter(1);
    c.fillStyle = '#e4dcc4';
    c.fillRect(tx, ty, px * 0.05, px * 0.03);
    const [kx, ky] = scatter(1);
    c.save();
    c.translate(kx, ky);
    c.rotate(r.range(0, 6.3));
    c.fillStyle = '#b8bcc0';
    c.fillRect(-px * 0.05, -px * 0.03, px * 0.1, px * 0.06);
    c.fillStyle = r.pick(['#1d4f9a', '#c8302a']);
    c.fillRect(-px * 0.03, -px * 0.03, px * 0.06, px * 0.06);
    c.restore();
    husks(70, 0.006);
  }, { ppm: 300 });
}

/** A crack network in the pavement asphalt, or (every third variant) a darker patch. */
export function crackGeo(variant = 0, w = 1.6, h = 1.1) {
  return atlasQuad(`crack|${variant}`, w, h, (c, pw, ph) => {
    c.clearRect(0, 0, pw, ph);
    const r = rngKit(variant * 71 + 9);
    const patch = variant % 3 === 2;
    if (patch) {
      // newer, darker asphalt with a ragged edge
      c.fillStyle = '#5f5d5a';
      c.beginPath();
      const n = 14;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        const x = pw / 2 + Math.cos(a) * pw * r.range(0.3, 0.44), y = ph / 2 + Math.sin(a) * ph * r.range(0.3, 0.44);
        if (i === 0) c.moveTo(x, y); else c.lineTo(x, y);
      }
      c.closePath();
      c.fill();
    }
    c.strokeStyle = 'rgba(62, 59, 56, 0.85)';
    c.lineCap = 'round';
    const branch = (x, y, a, len, width, depth) => {
      c.lineWidth = width;
      c.beginPath();
      c.moveTo(x, y);
      let cx = x, cy = y;
      const steps = 6;
      for (let i = 0; i < steps; i++) {
        a += r.range(-0.5, 0.5);
        cx += Math.cos(a) * len / steps;
        cy += Math.sin(a) * len / steps;
        c.lineTo(cx, cy);
      }
      c.stroke();
      if (depth <= 0) return;
      for (let k = 0; k < 2; k++) {
        if (r.chance(0.7)) branch(cx, cy, a + r.sign() * r.range(0.5, 1.2), len * 0.6, width * 0.7, depth - 1);
      }
    };
    branch(r.range(0.1, 0.3) * pw, r.range(0.3, 0.7) * ph, r.range(-0.4, 0.4), pw * 0.4, Math.max(1.5, pw * 0.005), 2);
    if (!patch) branch(pw * 0.5, ph * 0.5, r.range(1.2, 2.0), ph * 0.35, Math.max(1.5, pw * 0.004), 1);
  }, { ppm: 200 });
}

/** The pale silt ring a dried puddle leaves on the pavement. */
export function stainGeo(variant = 0, w = 1.8, h = 1.1) {
  return atlasQuad(`stain|${variant}`, w, h, (c, pw, ph) => {
    c.clearRect(0, 0, pw, ph);
    const r = rngKit(variant * 37 + 3);
    const blob = (grow) => {
      c.beginPath();
      const n = 18;
      for (let i = 0; i <= n; i++) {
        const a = (i / n) * Math.PI * 2;
        const k = 0.34 + 0.08 * Math.sin(a * 3 + variant) + grow;
        const x = pw / 2 + Math.cos(a) * pw * k, y = ph / 2 + Math.sin(a) * ph * k;
        if (i === 0) c.moveTo(x, y); else c.lineTo(x, y);
      }
      c.closePath();
    };
    c.filter = `blur(${Math.round(pw * 0.015)}px)`;
    c.fillStyle = 'rgba(122, 112, 98, 0.36)';
    blob(0.06);
    c.fill();
    c.fillStyle = 'rgba(196, 186, 166, 0.5)';
    blob(0.02);
    c.fill();
    c.filter = 'none';
    for (let i = 0; i < 40; i++) {
      c.fillStyle = `rgba(90, 82, 70, ${r.range(0.1, 0.3)})`;
      c.beginPath();
      c.arc(pw * r.range(0.25, 0.75), ph * r.range(0.25, 0.75), r.range(1, 3), 0, Math.PI * 2);
      c.fill();
    }
  }, { ppm: 120 });
}

/**
 * Poplar fluff gathered on the ground: 'strip' for gutters and kerb
 * lines (long along x, densest along the top edge), 'heap' for corners.
 */
export function fluffGeo(kind = 'strip', variant = 0, w = 2.4, h = 0.34) {
  return atlasQuad(`fluff|${kind}|${variant}`, w, h, (c, pw, ph) => {
    c.clearRect(0, 0, pw, ph);
    const r = rngKit(variant * 53 + (kind === 'heap' ? 900 : 11));
    const tuft = (x, y, rad, a) => {
      const g = c.createRadialGradient(x, y, 0, x, y, rad);
      g.addColorStop(0, `rgba(244, 240, 230, ${a})`);
      g.addColorStop(0.5, `rgba(236, 232, 220, ${a * 0.65})`);
      g.addColorStop(1, 'rgba(226, 222, 210, 0)');
      c.fillStyle = g;
      c.beginPath();
      c.arc(x, y, rad, 0, Math.PI * 2);
      c.fill();
    };
    if (kind === 'heap') {
      for (let i = 0; i < 70; i++) {
        const a = r.range(0, Math.PI * 2), d = Math.pow(r.next(), 0.8) * 0.36;
        tuft(pw / 2 + Math.cos(a) * d * pw, ph / 2 + Math.sin(a) * d * ph, pw * r.range(0.04, 0.12), r.range(0.22, 0.5));
      }
    } else {
      // loose clumps along the kerb with bare gaps between, thinning into the road
      const clumps = r.int(3, 5);
      for (let k = 0; k < clumps; k++) {
        const cx = pw * r.range(0.1, 0.9), spread = pw * r.range(0.04, 0.12);
        const n = r.int(10, 22);
        for (let i = 0; i < n; i++) {
          const y = ph * (0.08 + Math.pow(r.next(), 1.8) * 0.75);
          tuft(cx + r.range(-1, 1) * spread, y, ph * r.range(0.1, 0.3), r.range(0.12, 0.32));
        }
      }
    }
    // loose single tufts, each with its seed speck
    for (let i = 0; i < 12; i++) {
      const x = pw * r.range(0.05, 0.95), y = ph * r.range(0.1, 0.9);
      tuft(x, y, Math.min(pw, ph) * r.range(0.05, 0.1), 0.4);
      c.fillStyle = 'rgba(120, 104, 80, 0.7)';
      c.fillRect(x, y, 1.5, 1.5);
    }
  }, { ppm: 150 });
}
