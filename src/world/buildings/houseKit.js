import * as THREE from 'three';
import { cel, flat } from '../../core/toon.js';
import { canvasTex, cached } from '../../core/textures.js';
import { rngKit } from '../../core/util.js';

/* ------------------------------------------------------------------ *
 * Building kit for the private sector, the bazaar, the edges and the
 * skyline.
 *
 * Textures here are drawn light and nearly grey on purpose: the colour
 * comes from the vertex colour each piece is batched with, so one
 * "boards" material paints a maroon wall, a sky-blue gable and a grey
 * weathered fence, and they all merge into one draw call.
 *
 *   KIT.boards      vertical wooden cladding and plank fences
 *   KIT.seam        standing-seam sheet metal roofs
 *   KIT.plaster     lime plaster and stucco
 *   KIT.corrugated  profiled steel sheet (fences, gates, sheds)
 *   KIT.brick       brick walls (tint red, sand or silicate)
 *   KIT.garageDoor  ribbed steel garage doors
 *   KIT.tile        metal roof tile (the bazaar's blue side roofs)
 *   KIT.curtains    window glass with curtains (unlit, 4 variants)
 *
 * `tbox()` makes a base-anchored box whose uv is in metres divided by
 * the tile size, so a texture keeps its scale on any size of box.
 * ------------------------------------------------------------------ */

export const TILES = {
  boards: [1.12, 2.0],
  seam: [0.6, 2.0],
  plaster: [3.0, 3.0],
  corrugated: [1.0, 1.0],
  brick: [1.0, 0.5],
  garageDoor: [2.8, 2.3],
  tile: [1.4, 1.4],
};

function boardsTex() {
  return cached('kit-boards', () => canvasTex(256, 256, (ctx, w, h) => {
    const r = rngKit(31);
    const n = 8, bw = w / n;
    for (let i = 0; i < n; i++) {
      const v = r.int(222, 246);
      ctx.fillStyle = `rgb(${v},${v},${v})`;
      ctx.fillRect(i * bw, 0, bw, h);
      // grain
      ctx.strokeStyle = 'rgba(120,120,120,0.18)';
      ctx.lineWidth = 1;
      for (let g = 0; g < 5; g++) {
        const x = i * bw + r.range(3, bw - 3);
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.bezierCurveTo(x + r.range(-3, 3), h * 0.3, x + r.range(-3, 3), h * 0.7, x, h);
        ctx.stroke();
      }
      // a knot or two
      if (r.chance(0.5)) {
        ctx.fillStyle = 'rgba(90,90,90,0.25)';
        ctx.beginPath();
        ctx.ellipse(i * bw + bw / 2, r.range(0, h), 3, 5, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      // the gap between boards
      ctx.fillStyle = 'rgba(40,40,40,0.55)';
      ctx.fillRect(i * bw, 0, 2, h);
    }
    // weathering at the bottom
    const g = ctx.createLinearGradient(0, h * 0.7, 0, h);
    g.addColorStop(0, 'rgba(90,80,70,0)');
    g.addColorStop(1, 'rgba(90,80,70,0.25)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }, { repeat: [1, 1] }));
}

function seamTex() {
  return cached('kit-seam', () => canvasTex(64, 256, (ctx, w, h) => {
    const r = rngKit(32);
    const g = ctx.createLinearGradient(0, 0, w, 0);
    g.addColorStop(0, '#dcdcdc');
    g.addColorStop(0.5, '#f4f4f4');
    g.addColorStop(1, '#e2e2e2');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    // the standing seam
    ctx.fillStyle = '#9a9a9a';
    ctx.fillRect(0, 0, 3, h);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(3, 0, 2, h);
    // streaks of dust and rust
    for (let i = 0; i < 10; i++) {
      ctx.fillStyle = `rgba(120,100,80,${r.range(0.04, 0.12)})`;
      ctx.fillRect(r.range(6, w - 4), r.range(0, h), r.range(1, 3), r.range(20, 120));
    }
  }, { repeat: [1, 1] }));
}

function plasterTex() {
  return cached('kit-plaster', () => canvasTex(256, 256, (ctx, w, h) => {
    const r = rngKit(33);
    ctx.fillStyle = '#f2f2f0';
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 40; i++) {
      const x = r.range(0, w), y = r.range(0, h), rad = r.range(10, 50);
      const gr = ctx.createRadialGradient(x, y, 1, x, y, rad);
      const c = r.chance(0.5) ? '255,255,255' : '200,196,188';
      gr.addColorStop(0, `rgba(${c},0.35)`);
      gr.addColorStop(1, `rgba(${c},0)`);
      ctx.fillStyle = gr;
      ctx.fillRect(0, 0, w, h);
    }
    // hairline cracks and a patch where the plaster was redone
    ctx.strokeStyle = 'rgba(110,105,100,0.35)';
    for (let i = 0; i < 4; i++) {
      ctx.lineWidth = 1;
      ctx.beginPath();
      let x = r.range(0, w), y = r.range(0, h);
      ctx.moveTo(x, y);
      for (let k = 0; k < 6; k++) { x += r.range(-12, 12); y += r.range(4, 16); ctx.lineTo(x, y); }
      ctx.stroke();
    }
  }, { repeat: [1, 1] }));
}

function corrugatedTex() {
  return cached('kit-corrugated', () => canvasTex(128, 128, (ctx, w, h) => {
    const r = rngKit(34);
    const ribs = 5;
    for (let i = 0; i < ribs; i++) {
      const g = ctx.createLinearGradient(i * w / ribs, 0, (i + 1) * w / ribs, 0);
      g.addColorStop(0, '#bdbdbd');
      g.addColorStop(0.25, '#f5f5f5');
      g.addColorStop(0.55, '#e0e0e0');
      g.addColorStop(0.8, '#a8a8a8');
      g.addColorStop(1, '#bdbdbd');
      ctx.fillStyle = g;
      ctx.fillRect(i * w / ribs, 0, w / ribs, h);
    }
    for (let i = 0; i < 6; i++) {
      ctx.fillStyle = `rgba(110,80,50,${r.range(0.05, 0.15)})`;
      ctx.fillRect(r.range(0, w), r.range(h * 0.5, h), r.range(2, 8), r.range(10, 60));
    }
  }, { repeat: [1, 1] }));
}

function brickTex() {
  return cached('kit-brick', () => canvasTex(256, 128, (ctx, w, h) => {
    const r = rngKit(35);
    ctx.fillStyle = '#c9c6c0';
    ctx.fillRect(0, 0, w, h);
    const rows = 8, cols = 4;
    const bh = h / rows, bw = w / cols;
    for (let y = 0; y < rows; y++) {
      const off = y % 2 ? bw / 2 : 0;
      for (let x = -1; x <= cols; x++) {
        const v = r.int(222, 250);
        ctx.fillStyle = `rgb(${v},${v - 2},${v - 4})`;
        ctx.fillRect(x * bw + off + 2, y * bh + 2, bw - 4, bh - 4);
      }
    }
  }, { repeat: [1, 1] }));
}

function garageDoorTex() {
  return cached('kit-garage', () => canvasTex(256, 212, (ctx, w, h) => {
    const r = rngKit(36);
    ctx.fillStyle = '#e8e8e8';
    ctx.fillRect(0, 0, w, h);
    // two leaves with a centre seam, ribs, a padlock hasp
    for (let i = 0; i < 16; i++) {
      ctx.fillStyle = i % 2 ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.25)';
      ctx.fillRect(0, (i * h) / 16, w, h / 32);
    }
    ctx.fillStyle = 'rgba(30,30,30,0.6)';
    ctx.fillRect(w / 2 - 2, 0, 4, h);
    ctx.strokeStyle = 'rgba(30,30,30,0.5)';
    ctx.lineWidth = 4;
    ctx.strokeRect(2, 2, w - 4, h - 4);
    ctx.fillStyle = '#555';
    ctx.fillRect(w / 2 - 14, h * 0.55, 28, 10);
    ctx.fillStyle = '#333';
    ctx.fillRect(w / 2 - 5, h * 0.59, 10, 14);
    // rust at the bottom
    for (let i = 0; i < 30; i++) {
      ctx.fillStyle = `rgba(130,70,30,${r.range(0.05, 0.25)})`;
      ctx.fillRect(r.range(0, w), h - r.range(2, 30), r.range(3, 14), r.range(2, 20));
    }
  }));
}

function tileTex() {
  return cached('kit-tile', () => canvasTex(128, 128, (ctx, w, h) => {
    ctx.fillStyle = '#e6e6e6';
    ctx.fillRect(0, 0, w, h);
    const rows = 4, cols = 4;
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const g = ctx.createLinearGradient(0, y * h / rows, 0, (y + 1) * h / rows);
        g.addColorStop(0, '#ffffff');
        g.addColorStop(0.7, '#dadada');
        g.addColorStop(1, '#9a9a9a');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.ellipse((x + 0.5) * w / cols, (y + 0.45) * h / rows, w / cols * 0.52, h / rows * 0.55, 0, 0, Math.PI);
        ctx.fill();
      }
    }
  }, { repeat: [1, 1] }));
}

/** Window glass with curtains: a 4 x 1 atlas of variants. */
function curtainTex() {
  return cached('kit-curtains', () => canvasTex(512, 128, (ctx, w, h) => {
    const r = rngKit(37);
    const cw = w / 4;
    const looks = [
      ['#5d7488', '#f4f1e8', 'lace'],     // white tulle
      ['#4f6478', '#e0a24a', 'drape'],    // orange drapes
      ['#546a80', '#f1ede2', 'half'],     // tulle half drawn
      ['#3f5264', '#7f9a5a', 'drape'],    // green drapes
    ];
    looks.forEach(([glass, cur, kind], i) => {
      const x0 = i * cw;
      const g = ctx.createLinearGradient(x0, 0, x0 + cw, h);
      g.addColorStop(0, glass);
      g.addColorStop(0.5, '#8aa3b8');
      g.addColorStop(1, glass);
      ctx.fillStyle = g;
      ctx.fillRect(x0, 0, cw, h);
      ctx.fillStyle = cur;
      if (kind === 'lace') {
        ctx.globalAlpha = 0.8;
        ctx.fillRect(x0, 0, cw, h);
        ctx.globalAlpha = 1;
        ctx.strokeStyle = 'rgba(160,150,130,0.5)';
        for (let k = 0; k < 10; k++) {
          ctx.beginPath();
          ctx.arc(x0 + r.range(0, cw), r.range(0, h), r.range(3, 8), 0, Math.PI * 2);
          ctx.stroke();
        }
      } else if (kind === 'half') {
        ctx.globalAlpha = 0.85;
        ctx.fillRect(x0, 0, cw * 0.38, h);
        ctx.fillRect(x0 + cw * 0.66, 0, cw * 0.34, h);
        ctx.globalAlpha = 1;
      } else {
        ctx.fillRect(x0, 0, cw * 0.3, h);
        ctx.fillRect(x0 + cw * 0.7, 0, cw * 0.3, h);
        ctx.fillStyle = 'rgba(0,0,0,0.18)';
        for (let k = 0; k < 6; k++) {
          ctx.fillRect(x0 + k * cw * 0.05, 0, 2, h);
          ctx.fillRect(x0 + cw * 0.7 + k * cw * 0.05, 0, 2, h);
        }
      }
      // a pot plant on the sill in some
      if (i % 2 === 0) {
        ctx.fillStyle = '#b5552e';
        ctx.fillRect(x0 + cw * 0.42, h * 0.84, cw * 0.14, h * 0.16);
        ctx.fillStyle = '#4f7a34';
        ctx.beginPath();
        ctx.arc(x0 + cw * 0.49, h * 0.8, cw * 0.1, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = 'rgba(255,255,255,0.2)';
      ctx.beginPath();
      ctx.moveTo(x0 + cw * 0.1, 0);
      ctx.lineTo(x0 + cw * 0.3, 0);
      ctx.lineTo(x0 + cw * 0.05, h * 0.6);
      ctx.lineTo(x0, h * 0.6);
      ctx.fill();
    });
  }));
}

const mats = {};
function kitMat(key, texFn, o = {}) {
  if (!mats[key]) mats[key] = cel({ map: texFn(), vertexColors: true, cache: false, grime: 0.05, dirt: 0.3, ...o });
  return mats[key];
}

export const KIT = {
  get boards() { return kitMat('boards', boardsTex); },
  get seam() { return kitMat('seam', seamTex, { dirt: 0 }); },
  get plaster() { return kitMat('plaster', plasterTex); },
  get corrugated() { return kitMat('corrugated', corrugatedTex); },
  get brick() { return kitMat('brick', brickTex); },
  get garageDoor() { return kitMat('garageDoor', garageDoorTex); },
  get tile() { return kitMat('tile', tileTex, { dirt: 0 }); },
  get curtains() {
    if (!mats.curtains) mats.curtains = flat({ map: curtainTex(), cache: false });
    return mats.curtains;
  },
};

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3(1, 1, 1);

/** Matrix for position (x, y, z) and yaw ry (then pitch rx, roll rz). */
export function mtx(x, y, z, ry = 0, rx = 0, rz = 0) {
  _p.set(x, y, z);
  _e.set(rx, ry, rz, 'YXZ');
  _q.setFromEuler(_e);
  return _m.compose(_p, _q, _s);
}

/**
 * Base-anchored box w x h x d with uv in metres / tile. Face order of
 * BoxGeometry: +x, -x, +y, -y, +z, -z, four vertices each.
 */
export function tboxGeo(w, h, d, tile = [1, 1], bottom = false) {
  const g = new THREE.BoxGeometry(w, h, d);
  g.translate(0, h / 2, 0);
  const uv = g.attributes.uv;
  const dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let f = 0; f < 6; f++) {
    const [fw, fh] = dims[f];
    for (let k = 0; k < 4; k++) {
      const i = f * 4 + k;
      uv.setXY(i, (uv.getX(i) * fw) / tile[0], (uv.getY(i) * fh) / tile[1]);
    }
  }
  if (!bottom) {
    const idx = Array.from(g.index.array);
    g.setIndex(idx.slice(0, 18).concat(idx.slice(24)));
  }
  return g;
}

/** Add a textured box to a batch: base centre (x, y, z), yaw ry. */
export function tbox(batch, mat, tile, w, h, d, color, x, y, z, ry = 0, o = {}) {
  return batch.add(tboxGeo(w, h, d, tile), { mat, color, matrix: mtx(x, y, z, ry, o.rx || 0, o.rz || 0), cast: o.cast ?? true, receive: o.receive ?? true });
}

/** Scale an existing geometry's uv by 1 / tile (for shape-based pieces in metres). */
export function scaleUV(g, tile) {
  const uv = g.attributes.uv;
  if (!uv) return g;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / tile[0], uv.getY(i) / tile[1]);
  return g;
}

/** A vertical quad (w x h) facing local -z, base at y = 0, with a uv sub-rectangle. */
export function quadGeo(w, h, u0 = 0, v0 = 0, u1 = 1, v1 = 1) {
  const g = new THREE.PlaneGeometry(w, h);
  g.translate(0, h / 2, 0);
  g.rotateY(Math.PI);
  const uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) {
    uv.setXY(i, u0 + (u1 - u0) * uv.getX(i), v0 + (v1 - v0) * uv.getY(i));
  }
  return g;
}

/**
 * Local-to-world helper for a rotated frame: returns a function that maps
 * local (lx, lz) to world [x, z] for origin (ox, oz) and yaw ry.
 */
export function frame(ox, oz, ry) {
  const c = Math.cos(ry), s = Math.sin(ry);
  return (lx, lz) => [ox + lx * c + lz * s, oz - lx * s + lz * c];
}
