import * as THREE from 'three';
import { cel } from '../core/toon.js';
import { canvasTex, cached, centerText, FONT } from '../core/textures.js';
import { SERVICE_LIST } from './services.js';

/* ------------------------------------------------------------------ *
 * Lettering on rolling stock: coach route boards, coach numbers and
 * locomotive number plates, all from one canvas atlas and one material.
 *
 * The atlas has ROWS rows. The left three quarters of a row hold a
 * wide board (a route or a locomotive number), the right quarter a
 * coach number. A decal quad is authored against a default row; when
 * the car is drawn instanced, the per-instance attribute `aDecal`
 * (x: wide row, y: number row) picks the row instead, so one baked coach
 * can carry any service and any number without extra draw calls.
 * ------------------------------------------------------------------ */

export const ROWS = 16;
const SPLIT = 0.75;             // u where the number column starts
const INSET = 0.06;             // share of a row kept clear at top and bottom

/** Wide rows: 0 the railway's name, 1.. the services, then loco numbers. */
export const WIDE = { railway: 0, service0: 1, loco0: 1 + SERVICE_LIST.length };
export const LOCO_NUMBERS = ['2ТЭ10М-3412', '2ТЭ10М-3187', '2ТЭ10М-3530', '2ТЭ10М-3044', '2ТЭ10М-3296', '2ТЭ10М-3618', '2ТЭ10М-3371'];

/** Board row for a service name (the railway's name if unknown). */
export function serviceRow(name) {
  const i = SERVICE_LIST.indexOf(name);
  return i < 0 ? WIDE.railway : WIDE.service0 + i;
}

/** Number-column row for coach number n (1-based). */
export const numberRow = (n) => Math.max(0, Math.min(ROWS - 1, n - 1));

function routeText(name) {
  const m = /^(№\d+)\s+(.*)$/.exec(name);
  return m ? { no: m[1], route: m[2].toUpperCase() } : { no: '', route: name.toUpperCase() };
}

function drawWide(c, r, y, rh, ww) {
  if (r >= WIDE.loco0 && r < WIDE.loco0 + LOCO_NUMBERS.length) {
    // cast plate: dark red with a cream rim and cream figures
    c.fillStyle = '#7a1f1c';
    c.fillRect(0, y, ww, rh);
    c.strokeStyle = '#e8dcb8';
    c.lineWidth = 5;
    c.strokeRect(8, y + 7, ww - 16, rh - 14);
    centerText(c, LOCO_NUMBERS[r - WIDE.loco0], ww / 2, y + rh / 2 + 1, ww - 70, 44, 0xefe4c0, { family: FONT.narrow });
    return;
  }
  c.fillStyle = '#f2f0e8';
  c.fillRect(0, y, ww, rh);
  c.strokeStyle = '#1d2a44';
  c.lineWidth = 4;
  c.strokeRect(5, y + 6, ww - 10, rh - 12);
  if (r === WIDE.railway) {
    centerText(c, 'ҚАЗАҚСТАН ТЕМІР ЖОЛЫ', ww / 2, y + rh / 2 + 1, ww - 60, 40, 0x1d2a44, { family: FONT.narrow });
  } else if (r - WIDE.service0 < SERVICE_LIST.length) {
    const { no, route } = routeText(SERVICE_LIST[r - WIDE.service0]);
    centerText(c, no, 58, y + rh / 2 + 1, 90, 30, 0x9a2420, { family: FONT.narrow });
    centerText(c, route, ww / 2 + 36, y + rh / 2 + 1, ww - 170, 42, 0x1d2a44, { family: FONT.narrow });
  }
}

function atlas() {
  return cached('rail|decals', () => canvasTex(1024, 1024, (c, W, H) => {
    const rh = H / ROWS, ww = W * SPLIT;
    for (let r = 0; r < ROWS; r++) {
      const y = r * rh;
      drawWide(c, r, y, rh, ww);
      // coach number: white enamel plate, black figure
      c.fillStyle = '#f4f2ea';
      c.fillRect(ww, y, W - ww, rh);
      c.strokeStyle = '#1b1b1b';
      c.lineWidth = 4;
      c.strokeRect(ww + 6, y + 6, W - ww - 12, rh - 12);
      centerText(c, String(r + 1), ww + (W - ww) / 2, y + rh / 2 + 2, W - ww - 40, 50, 0x1b1b1b, { family: FONT.sans });
    }
  }));
}

const DECAL_VERT = /* glsl */ `
  #include <uv_vertex>
  #if defined( USE_INSTANCING ) && defined( USE_MAP )
  {
    float lv = fract( vMapUv.y * ${ROWS.toFixed(1)} );
    float row = vMapUv.x < ${SPLIT.toFixed(3)} ? aDecal.x : aDecal.y;
    vMapUv.y = 1.0 - ( row + 1.0 ) / ${ROWS.toFixed(1)} + lv / ${ROWS.toFixed(1)};
  }
  #endif
`;

/** The shared lit material for all rail lettering. */
export function decalMaterial() {
  return cached('rail|decal-mat', () => {
    const mat = cel({ map: atlas(), grime: 0.03, dirt: 0.15, cache: false });
    const base = mat.onBeforeCompile;
    mat.onBeforeCompile = (shader, renderer) => {
      base(shader, renderer);
      shader.vertexShader = 'attribute vec2 aDecal;\n' +
        shader.vertexShader.replace('#include <uv_vertex>', DECAL_VERT);
    };
    mat.customProgramCacheKey = () => 'cel2-raildecal';
    return mat;
  });
}

/**
 * A lettering quad on the side of a car, facing outward (side s = +1 is
 * +x). `column` 'wide' or 'number'; `row` is the default row shown when
 * not drawn instanced. (x, y, z) is the centre of the quad.
 */
export function sideDecal(b, s, w, h, x, y, z, column, row) {
  const g = new THREE.PlaneGeometry(w, h);
  const uv = g.attributes.uv;
  const [u0, u1] = column === 'wide' ? [0.004, SPLIT - 0.004] : [SPLIT + 0.004, 0.996];
  const vb = 1 - (row + 1) / ROWS, vr = 1 / ROWS;
  for (let i = 0; i < uv.count; i++) {
    uv.setXY(i, u0 + uv.getX(i) * (u1 - u0), vb + vr * (INSET + uv.getY(i) * (1 - 2 * INSET)));
  }
  g.rotateY(s * Math.PI / 2);
  g.translate(x, y, z);
  b.add(g, { mat: decalMaterial(), color: 0xffffff, cast: false });
}

/** Give an instanced mesh's geometry its per-instance decal rows. */
export function attachDecalRows(mesh, capacity) {
  const attr = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 2), 2);
  attr.setUsage(THREE.DynamicDrawUsage);
  mesh.geometry.setAttribute('aDecal', attr);
  return attr;
}
