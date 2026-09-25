import * as THREE from 'three';
import { rngKit } from './util.js';

/* ------------------------------------------------------------------ *
 * Canvas textures.
 *
 * There are no image files in this project. Every sign, facade, number
 * plate and poster is drawn here at runtime with Canvas2D, which keeps
 * the repository free of other people's pictures and lets text be real
 * Cyrillic and Kazakh typography.
 *
 * Fonts are system fonts. The stacks below all carry Cyrillic and the
 * Kazakh letters (Ә Ғ Қ Ң Ө Ұ Ү Һ І) on macOS, Windows and most Linux.
 * ------------------------------------------------------------------ */

export const FONT = {
  sans: '"PT Sans", "Segoe UI", Arial, "Liberation Sans", sans-serif',
  narrow: '"PT Sans Narrow", "Arial Narrow", "Roboto Condensed", "Liberation Sans Narrow", Arial, sans-serif',
  serif: '"PT Serif", Georgia, "Times New Roman", serif',
  mono: '"PT Mono", Menlo, Consolas, "Courier New", monospace',
  display: '"Futura", "Century Gothic", "PT Sans", Arial, sans-serif',
};

const cache = new Map();

/** Memoise a texture by key: most signs are drawn once and reused. */
export function cached(key, fn) {
  if (!cache.has(key)) cache.set(key, fn());
  return cache.get(key);
}

/**
 * Make a CanvasTexture of w x h pixels. `draw(ctx, w, h)` paints it.
 * @param {object} [o]
 * @param {boolean} [o.srgb=true]  colour data (false for masks / data)
 * @param {[number,number]|null} [o.repeat]  enable wrapping with this repeat
 * @param {boolean} [o.mips=true]
 */
export function canvasTex(w, h, draw, { srgb = true, repeat = null, mips = true, aniso = 8, nearest = false } = {}) {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  draw(ctx, w, h);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  tex.anisotropy = aniso;
  tex.generateMipmaps = mips;
  tex.minFilter = mips ? THREE.LinearMipmapLinearFilter : THREE.LinearFilter;
  if (nearest) { tex.magFilter = THREE.NearestFilter; tex.minFilter = THREE.NearestFilter; tex.generateMipmaps = false; }
  if (repeat) {
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(repeat[0], repeat[1]);
  }
  return tex;
}

export function hex(c) {
  return typeof c === 'string' ? c : '#' + c.toString(16).padStart(6, '0');
}

/** Set a font that makes `text` fit in maxW, starting from `size` px. */
export function fitFont(ctx, text, maxW, size, family = FONT.sans, weight = 'bold') {
  let s = size;
  ctx.font = `${weight} ${s}px ${family}`;
  while (s > 6 && ctx.measureText(text).width > maxW) {
    s -= 1;
    ctx.font = `${weight} ${s}px ${family}`;
  }
  return s;
}

/**
 * Draw text centred on (x, y), shrunk to fit maxW. `stretch` < 1 condenses
 * the glyphs horizontally, which is how most shop fascias of the era look.
 */
export function centerText(ctx, text, x, y, maxW, size, color, o = {}) {
  const { family = FONT.sans, weight = 'bold', stretch = 1, stroke = null, strokeW = 0, align = 'center' } = o;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(stretch, 1);
  fitFont(ctx, text, maxW / stretch, size, family, weight);
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  if (stroke) {
    ctx.lineJoin = 'round';
    ctx.lineWidth = strokeW;
    ctx.strokeStyle = hex(stroke);
    ctx.strokeText(text, 0, 0);
  }
  ctx.fillStyle = hex(color);
  ctx.fillText(text, 0, 0);
  ctx.restore();
}

/** Light speckle and streak wear over a whole canvas. */
export function weather(ctx, w, h, seed = 1, amount = 1) {
  const r = rngKit(seed);
  ctx.save();
  for (let i = 0; i < 60 * amount; i++) {
    ctx.globalAlpha = r.range(0.02, 0.08);
    ctx.fillStyle = r.chance(0.5) ? '#000' : '#fff';
    const x = r.range(0, w), y = r.range(0, h);
    ctx.fillRect(x, y, r.range(1, w * 0.04), r.range(1, h * 0.04));
  }
  // rain streaks from the top edge
  for (let i = 0; i < 14 * amount; i++) {
    ctx.globalAlpha = r.range(0.03, 0.08);
    ctx.fillStyle = '#3a3026';
    const x = r.range(0, w);
    ctx.fillRect(x, 0, r.range(1, 3), r.range(h * 0.1, h * 0.6));
  }
  ctx.restore();
}

/**
 * General sign painter.
 * @param {object} o
 * @param {number} o.w, o.h  pixel size (keep the aspect of the 3D board)
 * @param {string|number} o.bg  background colour
 * @param {string|number} o.fg  text colour
 * @param {string[]} o.lines  one or more lines of text, drawn top to bottom
 * @param {number[]} [o.sizes]  relative line heights (default equal)
 * @param {string} [o.family]
 * @param {number} [o.stretch=0.86]
 * @param {string|number} [o.border]  inner border colour
 * @param {number} [o.seed]  for weathering
 * @param {number} [o.wear=0.6]
 */
export function signTex(o) {
  const {
    w = 512, h = 128, bg = '#1f4e8c', fg = '#ffffff', lines = ['МАГАЗИН'],
    sizes = null, family = FONT.sans, stretch = 0.86, border = null,
    seed = 7, wear = 0.6, weight = 'bold', stroke = null, strokeW = 0, key = null,
  } = o;
  const k = key || 'sign|' + JSON.stringify(o);
  return cached(k, () => canvasTex(w, h, (ctx) => {
    ctx.fillStyle = hex(bg);
    ctx.fillRect(0, 0, w, h);
    if (border) {
      ctx.strokeStyle = hex(border);
      ctx.lineWidth = Math.max(2, h * 0.04);
      const m = h * 0.07;
      ctx.strokeRect(m, m, w - 2 * m, h - 2 * m);
    }
    const rel = sizes || lines.map(() => 1);
    const total = rel.reduce((a, b) => a + b, 0);
    let y = 0;
    const pad = h * 0.1;
    const avail = h - pad * 2;
    lines.forEach((line, i) => {
      const lh = (avail * rel[i]) / total;
      centerText(ctx, line, w / 2, pad + y + lh / 2 + lh * 0.04, w * 0.9, lh * 0.8, fg,
        { family, stretch, weight, stroke, strokeW });
      y += lh;
    });
    if (wear > 0) weather(ctx, w, h, seed, wear);
  }));
}

/** Soft round puff for cumulus clouds. */
export function cloudTex() {
  return cached('cloud', () => canvasTex(512, 256, (ctx, w, h) => {
    const r = rngKit(99);
    ctx.clearRect(0, 0, w, h);
    const puffs = [];
    for (let i = 0; i < 16; i++) {
      const x = r.range(0.14, 0.86) * w;
      const base = h * 0.78;
      const rad = r.range(0.14, 0.3) * h * (1 - Math.abs(x / w - 0.5) * 1.1);
      puffs.push([x, base - rad * r.range(0.5, 1.2), rad]);
    }
    // shaded underside first, then the lit body offset upward
    for (const [x, y, rad] of puffs) {
      const g = ctx.createRadialGradient(x, y + rad * 0.2, rad * 0.2, x, y + rad * 0.2, rad);
      g.addColorStop(0, 'rgba(206,212,226,0.95)');
      g.addColorStop(0.8, 'rgba(206,212,226,0.8)');
      g.addColorStop(1, 'rgba(206,212,226,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(x, y + rad * 0.2, rad, 0, Math.PI * 2); ctx.fill();
    }
    for (const [x, y, rad] of puffs) {
      const g = ctx.createRadialGradient(x - rad * 0.2, y - rad * 0.25, rad * 0.1, x, y, rad * 0.92);
      g.addColorStop(0, 'rgba(255,253,248,1)');
      g.addColorStop(0.75, 'rgba(250,248,243,0.92)');
      g.addColorStop(1, 'rgba(250,248,243,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(x, y, rad * 0.92, 0, Math.PI * 2); ctx.fill();
    }
    // flat base, cumulus style
    ctx.globalCompositeOperation = 'destination-out';
    const fade = ctx.createLinearGradient(0, h * 0.72, 0, h * 0.86);
    fade.addColorStop(0, 'rgba(0,0,0,0)');
    fade.addColorStop(1, 'rgba(0,0,0,1)');
    ctx.fillStyle = fade;
    ctx.fillRect(0, h * 0.72, w, h * 0.28);
  }, { mips: true }));
}

/** Thin wispy cirrus band. */
export function cirrusTex() {
  return cached('cirrus', () => canvasTex(1024, 128, (ctx, w, h) => {
    const r = rngKit(5);
    ctx.clearRect(0, 0, w, h);
    for (let i = 0; i < 90; i++) {
      const x = r.range(0, w), y = r.range(h * 0.3, h * 0.7);
      const len = r.range(60, 260);
      const g = ctx.createLinearGradient(x, 0, x + len, 0);
      g.addColorStop(0, 'rgba(255,255,255,0)');
      g.addColorStop(0.5, `rgba(255,255,255,${r.range(0.1, 0.35)})`);
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.strokeStyle = g;
      ctx.lineWidth = r.range(1, 5);
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.quadraticCurveTo(x + len / 2, y - r.range(-10, 10), x + len, y + r.range(-6, 6));
      ctx.stroke();
    }
  }));
}

/** Tileable greyscale noise, handy as an alpha or roughness mask. */
export function noiseTex(size = 256, seed = 3, scale = 1) {
  return cached(`noise|${size}|${seed}|${scale}`, () => canvasTex(size, size, (ctx, w, h) => {
    const r = rngKit(seed);
    const img = ctx.createImageData(w, h);
    for (let i = 0; i < w * h; i++) {
      const v = 128 + (r.next() - 0.5) * 255 * scale;
      img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = v;
      img.data[i * 4 + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
  }, { srgb: false, repeat: [1, 1] }));
}

/**
 * A textured quad material helper: returns a plane geometry of w x h
 * metres whose UVs map the whole texture, for signs and posters.
 */
export function signPlane(w, h) {
  return new THREE.PlaneGeometry(w, h);
}

/**
 * The flag of Kazakhstan: sky-blue field, a gold sun of 32 rays, a
 * steppe eagle beneath it, and the gold "koshkar muiz" ornament down the
 * hoist. 2:1. Drawn simply enough to read at flagpole distance.
 */
export function flagTex() {
  return cached('flag-kz', () => canvasTex(512, 256, (ctx, w, h) => {
    const blue = '#00afca', gold = '#fec50c';
    ctx.fillStyle = blue;
    ctx.fillRect(0, 0, w, h);
    const cx = w * 0.56, cy = h * 0.42, r = h * 0.15;
    ctx.fillStyle = gold;
    // rays
    for (let i = 0; i < 32; i++) {
      const a = (i / 32) * Math.PI * 2;
      const a0 = a - 0.05, a1 = a + 0.05;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a0) * r * 1.15, cy + Math.sin(a0) * r * 1.15);
      ctx.lineTo(cx + Math.cos(a) * r * 1.75, cy + Math.sin(a) * r * 1.75);
      ctx.lineTo(cx + Math.cos(a1) * r * 1.15, cy + Math.sin(a1) * r * 1.15);
      ctx.fill();
    }
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
    // eagle: spread wings in a shallow arc under the sun
    ctx.beginPath();
    const ey = cy + r * 2.05;
    ctx.moveTo(cx - r * 2.6, ey - r * 0.55);
    ctx.quadraticCurveTo(cx - r * 1.2, ey - r * 0.1, cx - r * 0.25, ey + r * 0.05);
    ctx.lineTo(cx, ey + r * 0.55);
    ctx.lineTo(cx + r * 0.25, ey + r * 0.05);
    ctx.quadraticCurveTo(cx + r * 1.2, ey - r * 0.1, cx + r * 2.6, ey - r * 0.55);
    ctx.quadraticCurveTo(cx + r * 1.3, ey + r * 0.45, cx + r * 0.2, ey + r * 0.35);
    ctx.lineTo(cx, ey + r * 0.8);
    ctx.lineTo(cx - r * 0.2, ey + r * 0.35);
    ctx.quadraticCurveTo(cx - r * 1.3, ey + r * 0.45, cx - r * 2.6, ey - r * 0.55);
    ctx.fill();
    // hoist ornament: a column of paired curls
    const ox = w * 0.07, step = h / 8;
    ctx.strokeStyle = gold;
    ctx.lineWidth = w * 0.012;
    for (let i = 0; i < 8; i++) {
      const y = step * (i + 0.5);
      ctx.beginPath();
      ctx.arc(ox - step * 0.22, y, step * 0.2, -Math.PI * 0.5, Math.PI * 0.9);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(ox + step * 0.22, y, step * 0.2, Math.PI * 0.1, Math.PI * 1.5);
      ctx.stroke();
      ctx.fillRect(ox - w * 0.004, y - step * 0.5, w * 0.008, step);
    }
  }));
}
