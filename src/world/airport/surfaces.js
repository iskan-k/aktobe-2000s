import * as THREE from 'three';
import { cel } from '../../core/toon.js';
import { canvasTex, cached } from '../../core/textures.js';
import { rngKit } from '../../core/util.js';
import { SURF } from '../../core/surfaces.js';

/* ------------------------------------------------------------------ *
 * Airfield surfaces: the 6 x 2 m aerodrome slabs (ПАГ-14) with their
 * bitumen joints, the worn white and yellow paint on top, and the
 * chain-link of the airside fence.
 *
 * Out past the walkable bounds the steppe is drawn with a polygon
 * offset (see edgesSouth.js), so these carry a larger one to sit on
 * top of it; the paint carries a larger one still.
 * ------------------------------------------------------------------ */

export const SLAB_TILE = 12;         // metres per texture tile: 2 x 6 slabs

function slabTex() {
  return cached('aero-slabs', () => canvasTex(512, 512, (c, W, H) => {
    const r = rngKit(707);
    c.fillStyle = '#b4b0a6';
    c.fillRect(0, 0, W, H);
    const sw = W / 2, sh = H / 6;                 // 6 m across, 2 m down
    for (let i = 0; i < 2; i++) {
      for (let j = 0; j < 6; j++) {
        c.fillStyle = r.pick(['#b6b2a8', '#b0aca2', '#bab6ac', '#aeaaa0', '#b3afa5']);
        c.fillRect(i * sw + 2, j * sh + 2, sw - 4, sh - 4);
      }
    }
    for (let k = 0; k < 9000; k++) {
      c.globalAlpha = r.range(0.1, 0.4);
      c.fillStyle = r.pick(['#8f8a80', '#c8c4ba', '#9c978d']);
      const s = r.range(1, 3);
      c.fillRect(r.range(0, W), r.range(0, H), s, s);
    }
    // a few cracks and oil spots
    c.globalAlpha = 0.35;
    c.strokeStyle = '#6e6a62';
    c.lineWidth = 1.2;
    for (let k = 0; k < 6; k++) {
      let x = r.range(0, W), y = r.range(0, H);
      c.beginPath();
      c.moveTo(x, y);
      for (let s = 0; s < 6; s++) { x += r.range(-14, 14); y += r.range(-14, 14); c.lineTo(x, y); }
      c.stroke();
    }
    for (let k = 0; k < 2; k++) {
      c.globalAlpha = r.range(0.05, 0.1);
      c.fillStyle = '#3a3630';
      c.beginPath();
      c.ellipse(r.range(0, W), r.range(0, H), r.range(8, 30), r.range(6, 20), r.range(0, 3), 0, Math.PI * 2);
      c.fill();
    }
    c.globalAlpha = 1;
    // bitumen-sealed joints
    c.fillStyle = '#77736b';
    for (let i = 0; i <= 2; i++) c.fillRect(i * sw - 1.5, 0, 3, H);
    for (let j = 0; j <= 6; j++) c.fillRect(0, j * sh - 1, W, 2);
  }, { repeat: [1, 1] }));
}

let slabMat = null;
/** Vertex-coloured slab concrete, world-mapped at SLAB_TILE. */
export function slabs() {
  if (!slabMat) {
    slabMat = cel({ map: slabTex(), vertexColors: true, grime: 0.05, dirt: 0, bands: 3, polygonOffset: 5, cache: false });
  }
  return slabMat;
}

let paintMat = null;
/** Worn paint (white or yellow by vertex colour) on top of the slabs. */
export function paint() {
  if (!paintMat) {
    paintMat = cel({
      map: SURF.paint.map, vertexColors: true, alphaTest: 0.38, bands: 3, grime: 0.03, dirt: 0,
      polygonOffset: 8, cache: false,
    });
  }
  return paintMat;
}

function meshTex() {
  return cached('aero-chainlink', () => canvasTex(64, 64, (c, W, H) => {
    c.clearRect(0, 0, W, H);
    c.strokeStyle = 'rgba(120,124,122,1)';
    c.lineWidth = 3;
    c.beginPath();
    c.moveTo(0, 0); c.lineTo(W, H);
    c.moveTo(W, 0); c.lineTo(0, H);
    c.stroke();
  }, { repeat: [1, 1] }));
}

let meshMat = null;
/** Chain-link: alpha-tested diamonds, both sides. uv in metres / 0.25. */
export function chainLink() {
  if (!meshMat) {
    meshMat = cel({ map: meshTex(), alphaTest: 0.4, side: THREE.DoubleSide, grime: 0, dirt: 0, bands: 3, cache: false });
    meshMat.userData.batchCell = 400;
  }
  return meshMat;
}
