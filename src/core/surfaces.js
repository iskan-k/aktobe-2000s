import * as THREE from 'three';
import { cel } from './toon.js';
import { canvasTex, cached } from './textures.js';
import { rngKit } from './util.js';

/* ------------------------------------------------------------------ *
 * Ground surfaces: asphalt, pavement, bare earth, steppe grass, concrete
 * slabs and worn road paint. Each is a small tileable canvas texture on
 * a cel material, mapped in world space (see `hQuad`), so neighbouring
 * pieces line up without seams.
 *
 * Use them through `SURF.<name>` (a material) and `hQuad()` / `worldUV()`
 * (geometry whose uv is world x / z divided by the tile size).
 * ------------------------------------------------------------------ */

/** Tile size in metres for each surface texture. */
export const TILE = {
  asphalt: 9, walk: 7, dirt: 8, grass: 10, slabs: 6, paint: 3, sand: 8, yard: 8,
};

function speckle(ctx, w, h, r, n, colors, sMin = 1, sMax = 3, alpha = [0.15, 0.5]) {
  for (let i = 0; i < n; i++) {
    ctx.globalAlpha = r.range(alpha[0], alpha[1]);
    ctx.fillStyle = r.pick(colors);
    const s = r.range(sMin, sMax);
    ctx.fillRect(r.range(0, w), r.range(0, h), s, s);
  }
  ctx.globalAlpha = 1;
}

/** A wandering hairline crack, wrapped so the tile stays seamless. */
function crack(ctx, w, h, r, color, width) {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  let x = r.range(0, w), y = r.range(0, h);
  let a = r.range(0, Math.PI * 2);
  const steps = r.int(8, 22);
  const pts = [[x, y]];
  for (let i = 0; i < steps; i++) {
    a += r.range(-0.7, 0.7);
    x += Math.cos(a) * r.range(6, 16);
    y += Math.sin(a) * r.range(6, 16);
    pts.push([x, y]);
  }
  for (const [ox, oy] of [[0, 0], [-w, 0], [w, 0], [0, -h], [0, h]]) {
    ctx.beginPath();
    pts.forEach(([px, py], i) => (i ? ctx.lineTo(px + ox, py + oy) : ctx.moveTo(px + ox, py + oy)));
    ctx.stroke();
  }
}

function asphaltTex() {
  return cached('surf-asphalt', () => canvasTex(512, 512, (ctx, w, h) => {
    const r = rngKit(11);
    ctx.fillStyle = '#6a6b6e';
    ctx.fillRect(0, 0, w, h);
    // repaired patches, slightly darker and with hard edges
    for (let i = 0; i < 5; i++) {
      ctx.fillStyle = r.pick(['#5a5b5f', '#606165', '#56575b']);
      const pw = r.range(40, 160), ph = r.range(30, 120);
      const px = r.range(0, w - pw), py = r.range(0, h - ph);
      ctx.fillRect(px, py, pw, ph);
      ctx.strokeStyle = 'rgba(40,40,42,0.35)';
      ctx.lineWidth = 2;
      ctx.strokeRect(px, py, pw, ph);
    }
    speckle(ctx, w, h, r, 9000, ['#4b4c50', '#7c7c7c', '#8a8886', '#55565a'], 1, 3);
    // pale sun-bleached wear
    for (let i = 0; i < 14; i++) {
      const g = ctx.createRadialGradient(r.range(0, w), r.range(0, h), 2, r.range(0, w), r.range(0, h), r.range(40, 120));
      g.addColorStop(0, 'rgba(150,146,138,0.14)');
      g.addColorStop(1, 'rgba(150,146,138,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
    }
    for (let i = 0; i < 7; i++) crack(ctx, w, h, r, 'rgba(38,38,40,0.55)', r.range(1, 2.2));
  }, { repeat: [1, 1] }));
}

function walkTex() {
  return cached('surf-walk', () => canvasTex(512, 512, (ctx, w, h) => {
    const r = rngKit(12);
    ctx.fillStyle = '#8a8680';
    ctx.fillRect(0, 0, w, h);
    speckle(ctx, w, h, r, 7000, ['#77736d', '#9b968e', '#a8a298', '#6f6b66'], 1, 3);
    for (let i = 0; i < 10; i++) {
      const g = ctx.createRadialGradient(r.range(0, w), r.range(0, h), 2, r.range(0, w), r.range(0, h), r.range(30, 90));
      g.addColorStop(0, 'rgba(150,130,100,0.16)');
      g.addColorStop(1, 'rgba(150,130,100,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
    }
    for (let i = 0; i < 12; i++) crack(ctx, w, h, r, 'rgba(60,56,50,0.5)', r.range(1, 2));
    // weeds in the cracks
    speckle(ctx, w, h, r, 260, ['#6f8a42', '#86994c'], 2, 5, [0.4, 0.8]);
  }, { repeat: [1, 1] }));
}

function dirtTex() {
  return cached('surf-dirt', () => canvasTex(512, 512, (ctx, w, h) => {
    const r = rngKit(13);
    ctx.fillStyle = '#ad9674';
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 26; i++) {
      const x = r.range(0, w), y = r.range(0, h), rad = r.range(30, 110);
      const g = ctx.createRadialGradient(x, y, 2, x, y, rad);
      const c = r.pick(['160,138,104', '146,124,92', '186,166,130']);
      g.addColorStop(0, `rgba(${c},0.5)`);
      g.addColorStop(1, `rgba(${c},0)`);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
    }
    speckle(ctx, w, h, r, 6000, ['#8c775a', '#c2ac88', '#9d8666', '#7a6850'], 1, 4);
    speckle(ctx, w, h, r, 300, ['#7f8f4c', '#98a058'], 2, 6, [0.3, 0.7]);
  }, { repeat: [1, 1] }));
}

function grassTex() {
  return cached('surf-grass', () => canvasTex(512, 512, (ctx, w, h) => {
    const r = rngKit(14);
    ctx.fillStyle = '#869650';
    ctx.fillRect(0, 0, w, h);
    // big patches of greener and drier grass
    for (let i = 0; i < 30; i++) {
      const x = r.range(0, w), y = r.range(0, h), rad = r.range(40, 140);
      for (const [ox, oy] of [[0, 0], [-w, 0], [w, 0], [0, -h], [0, h]]) {
        const g = ctx.createRadialGradient(x + ox, y + oy, 4, x + ox, y + oy, rad);
        const c = r.pick(['112,140,66', '160,158,96', '98,128,58', '176,164,106']);
        g.addColorStop(0, `rgba(${c},0.55)`);
        g.addColorStop(1, `rgba(${c},0)`);
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, w, h);
      }
    }
    // blades
    for (let i = 0; i < 9000; i++) {
      const x = r.range(0, w), y = r.range(0, h);
      ctx.strokeStyle = r.pick(['#5f7a38', '#99a458', '#738c42', '#b3ad6c', '#4f6a30']);
      ctx.globalAlpha = r.range(0.3, 0.8);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + r.range(-2, 2), y - r.range(2, 6));
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    // bare spots
    for (let i = 0; i < 8; i++) {
      const x = r.range(0, w), y = r.range(0, h), rad = r.range(10, 34);
      const g = ctx.createRadialGradient(x, y, 1, x, y, rad);
      g.addColorStop(0, 'rgba(170,146,110,0.7)');
      g.addColorStop(1, 'rgba(170,146,110,0)');
      ctx.fillStyle = g;
      ctx.fillRect(x - rad, y - rad, rad * 2, rad * 2);
    }
  }, { repeat: [1, 1] }));
}

function slabsTex() {
  return cached('surf-slabs', () => canvasTex(512, 512, (ctx, w, h) => {
    const r = rngKit(15);
    // 1.5 m x 1.5 m concrete slabs, four across the 6 m tile
    const n = 4, s = w / n;
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        const v = r.int(150, 176);
        ctx.fillStyle = `rgb(${v},${v - 4},${v - 10})`;
        ctx.fillRect(i * s, j * s, s, s);
      }
    }
    speckle(ctx, w, h, r, 6000, ['#8f8a80', '#b9b3a8', '#a09a90'], 1, 3);
    ctx.strokeStyle = 'rgba(80,76,68,0.7)';
    ctx.lineWidth = 3;
    for (let i = 0; i <= n; i++) {
      ctx.beginPath(); ctx.moveTo(i * s, 0); ctx.lineTo(i * s, h); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, i * s); ctx.lineTo(w, i * s); ctx.stroke();
    }
    // grass in the joints
    ctx.strokeStyle = 'rgba(110,138,64,0.6)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 40; i++) {
      const horizontal = r.chance(0.5);
      const k = r.int(0, n) * s, t = r.range(0, w);
      ctx.beginPath();
      if (horizontal) { ctx.moveTo(t, k); ctx.lineTo(t + r.range(8, 40), k); } else { ctx.moveTo(k, t); ctx.lineTo(k, t + r.range(8, 40)); }
      ctx.stroke();
    }
    for (let i = 0; i < 6; i++) crack(ctx, w, h, r, 'rgba(70,66,60,0.45)', 1.5);
  }, { repeat: [1, 1] }));
}

function sandTex() {
  return cached('surf-sand', () => canvasTex(256, 256, (ctx, w, h) => {
    const r = rngKit(16);
    ctx.fillStyle = '#d2bf93';
    ctx.fillRect(0, 0, w, h);
    speckle(ctx, w, h, r, 5000, ['#b9a57a', '#e0d0a6', '#c4af84'], 1, 2);
  }, { repeat: [1, 1] }));
}

/** Packed-earth courtyard: dirt with trodden grass and fine gravel. */
function yardTex() {
  return cached('surf-yard', () => canvasTex(512, 512, (ctx, w, h) => {
    const r = rngKit(17);
    ctx.fillStyle = '#a39070';
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 24; i++) {
      const x = r.range(0, w), y = r.range(0, h), rad = r.range(30, 120);
      const g = ctx.createRadialGradient(x, y, 2, x, y, rad);
      const c = r.pick(['128,140,78', '150,130,98', '118,132,70', '172,154,120']);
      g.addColorStop(0, `rgba(${c},0.5)`);
      g.addColorStop(1, `rgba(${c},0)`);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
    }
    speckle(ctx, w, h, r, 7000, ['#857254', '#b8a482', '#6f7d44', '#95a15a'], 1, 3);
  }, { repeat: [1, 1] }));
}

/** Worn road paint: white with the asphalt showing through in places. */
function paintTex() {
  return cached('surf-paint', () => canvasTex(256, 256, (ctx, w, h) => {
    const r = rngKit(18);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, w, h);
    ctx.globalCompositeOperation = 'destination-out';
    for (let i = 0; i < 1600; i++) {
      ctx.globalAlpha = r.range(0.4, 1);
      const s = r.range(1, 5);
      ctx.fillRect(r.range(0, w), r.range(0, h), s, s * r.range(0.5, 2));
    }
    for (let i = 0; i < 18; i++) {
      const x = r.range(0, w), y = r.range(0, h), rad = r.range(6, 22);
      const g = ctx.createRadialGradient(x, y, 1, x, y, rad);
      g.addColorStop(0, 'rgba(0,0,0,0.9)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.globalAlpha = 1;
      ctx.fillRect(x - rad, y - rad, rad * 2, rad * 2);
    }
  }, { repeat: [1, 1] }));
}

const mats = {};
function surfMat(key, texFn, o = {}) {
  if (!mats[key]) {
    mats[key] = cel({ map: texFn(), bands: 3, grime: o.grime ?? 0.05, dirt: 0, cache: false, ...o });
    mats[key].userData.tile = TILE[key];
    mats[key].userData.batchCell = 160;
  }
  return mats[key];
}

export const SURF = {
  get asphalt() { return surfMat('asphalt', asphaltTex); },
  get walk() { return surfMat('walk', walkTex); },
  get dirt() { return surfMat('dirt', dirtTex); },
  get grass() { return surfMat('grass', grassTex, { grime: 0.08 }); },
  get slabs() { return surfMat('slabs', slabsTex); },
  get sand() { return surfMat('sand', sandTex); },
  get yard() { return surfMat('yard', yardTex, { grime: 0.07 }); },
  /** vertex-coloured, alpha-tested worn paint, for road markings */
  get paint() {
    if (!mats.paint) {
      mats.paint = cel({
        map: paintTex(), vertexColors: true, alphaTest: 0.5, bands: 3, grime: 0.03, dirt: 0,
        polygonOffset: 2, cache: false,
      });
      mats.paint.userData.tile = TILE.paint;
      mats.paint.userData.batchCell = 160;
    }
    return mats.paint;
  },
};

/**
 * Horizontal quad from (x0, z0) to (x1, z1) at height y, facing up, with
 * uv = world position / tile. The geometry is already in world space.
 */
export function hQuad(x0, z0, x1, z1, y, tile) {
  const g = new THREE.PlaneGeometry(Math.abs(x1 - x0), Math.abs(z1 - z0));
  g.rotateX(-Math.PI / 2);
  g.translate((x0 + x1) / 2, y, (z0 + z1) / 2);
  return worldUV(g, tile);
}

/** Overwrite a geometry's uv with its world x / z divided by `tile`. */
export function worldUV(g, tile, axis = 'y') {
  const p = g.attributes.position;
  const uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) {
    if (axis === 'y') {
      uv[i * 2] = p.getX(i) / tile;
      uv[i * 2 + 1] = -p.getZ(i) / tile;
    } else if (axis === 'x') {
      uv[i * 2] = p.getZ(i) / tile;
      uv[i * 2 + 1] = p.getY(i) / tile;
    } else {
      uv[i * 2] = p.getX(i) / tile;
      uv[i * 2 + 1] = p.getY(i) / tile;
    }
  }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return g;
}

/** Split a long rectangle into pieces no longer than `max`, for culling. */
export function splitRect(x0, z0, x1, z1, max = 48) {
  const out = [];
  const nx = Math.max(1, Math.ceil(Math.abs(x1 - x0) / max));
  const nz = Math.max(1, Math.ceil(Math.abs(z1 - z0) / max));
  for (let i = 0; i < nx; i++) {
    for (let j = 0; j < nz; j++) {
      out.push([
        x0 + ((x1 - x0) * i) / nx, z0 + ((z1 - z0) * j) / nz,
        x0 + ((x1 - x0) * (i + 1)) / nx, z0 + ((z1 - z0) * (j + 1)) / nz,
      ]);
    }
  }
  return out;
}
