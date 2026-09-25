import * as THREE from 'three';
import { canvasTex } from '../../core/textures.js';
import { cel } from '../../core/toon.js';

/* ------------------------------------------------------------------ *
 * Sign sheets.
 *
 * Every shop fascia, door plate and notice is its own canvas texture,
 * and so its own draw call. A SignSheet collects them for one district,
 * packs their canvases into a single atlas and emits one mesh, so ten
 * signs cost one draw call instead of ten.
 *
 *   const sheet = new SignSheet();
 *   placeSign(ctx, sheet, tex, w, h, x, y, z, ry);   // ry as for a PlaneGeometry
 *   sheet.flush(ctx.root);
 *
 * Without a sheet, placeSign falls back to a plain mesh.
 * ------------------------------------------------------------------ */

const SHEET_W = 2048;
const PAD = 4;

export class SignSheet {
  constructor(name = 'signs') {
    this.name = name;
    this.items = [];
  }

  add(tex, w, h, x, y, z, ry) {
    this.items.push({ img: tex.image, w, h, x, y, z, ry });
  }

  /** Pack the canvases on shelves, draw the atlas, build one mesh under `parent`. */
  flush(parent) {
    if (!this.items.length) return null;
    // shelf packing, tallest first
    const order = [...this.items].sort((a, b) => b.img.height - a.img.height);
    let x = PAD, y = PAD, shelf = 0;
    const place = new Map();
    for (const it of order) {
      const iw = Math.min(it.img.width, SHEET_W - 2 * PAD), ih = it.img.height;
      if (x + iw + PAD > SHEET_W) { x = PAD; y += shelf + PAD; shelf = 0; }
      place.set(it, { px: x, py: y, pw: iw, ph: ih });
      x += iw + PAD;
      shelf = Math.max(shelf, ih);
    }
    const H = THREE.MathUtils.ceilPowerOfTwo(y + shelf + PAD);
    const tex = canvasTex(SHEET_W, H, (ctx) => {
      ctx.fillStyle = '#808080';
      ctx.fillRect(0, 0, SHEET_W, H);
      for (const it of this.items) {
        const p = place.get(it);
        // smear the edge pixels into the padding so mipmaps do not bleed
        ctx.drawImage(it.img, p.px - 2, p.py - 2, p.pw + 4, p.ph + 4);
        ctx.drawImage(it.img, p.px, p.py, p.pw, p.ph);
      }
    }, { mips: true });
    tex.anisotropy = 8;
    const pos = [], nor = [], uv = [], idx = [];
    for (const it of this.items) {
      const p = place.get(it);
      const n = [Math.sin(it.ry), 0, Math.cos(it.ry)];
      const r = [Math.cos(it.ry), 0, -Math.sin(it.ry)];
      const u0 = p.px / SHEET_W, u1 = (p.px + p.pw) / SHEET_W;
      const vT = 1 - p.py / H, vB = 1 - (p.py + p.ph) / H;
      const base = pos.length / 3;
      for (const [a, b, u, v] of [[-1, -1, u0, vB], [1, -1, u1, vB], [1, 1, u1, vT], [-1, 1, u0, vT]]) {
        pos.push(it.x + r[0] * a * it.w / 2, it.y + b * it.h / 2, it.z + r[2] * a * it.w / 2);
        nor.push(...n);
        uv.push(u, v);
      }
      idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    g.computeBoundingSphere();
    const mesh = new THREE.Mesh(g, cel({ map: tex, bands: 3, grime: 0.02, dirt: 0, polygonOffset: 1, cache: false }));
    mesh.name = this.name;
    mesh.receiveShadow = true;
    mesh.matrixAutoUpdate = false;
    parent.add(mesh);
    this.items = [];
    return mesh;
  }
}

/**
 * A sign `w` x `h` metres centred at (x, y, z), turned like a PlaneGeometry
 * with rotation.y = ry (its face points to (sin ry, 0, cos ry)).
 */
export function placeSign(ctx, sheet, tex, w, h, x, y, z, ry) {
  if (sheet) { sheet.add(tex, w, h, x, y, z, ry); return null; }
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), cel({ map: tex, bands: 3, grime: 0.02, dirt: 0, cache: false }));
  m.position.set(x, y, z);
  m.rotation.y = ry;
  ctx.root.add(m);
  return m;
}
