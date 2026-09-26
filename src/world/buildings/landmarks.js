import * as THREE from 'three';
import { cel } from '../../core/toon.js';
import { canvasTex, cached, centerText, FONT, weather } from '../../core/textures.js';
import { rngKit } from '../../core/util.js';
import { Sculpt, graniteBlock } from '../landmarks/kit.js';
import { abulkhairSculpture } from '../landmarks/abulkhair.js';

/* ------------------------------------------------------------------ *
 * Landmark kit and the centre's two landmarks.
 *
 * Kit (used by the square, the station and the cinema):
 *   texBox     a base-anchored box whose uv is in metres, so a facade
 *              texture tiles one window bay per repeat
 *   texPlane   a vertical textured quad facing a given yaw
 *   letters    rooftop letters: a lit, alpha-tested canvas quad with a
 *              darker quad behind it for the thickness of the letters
 *   limb, ball smooth primitives for sculpture
 *
 * Landmarks:
 *   buildAkimat     the regional akimat (1971): a long 6-storey cream
 *                   block with a taller centre of dark green glass
 *                   strips, the gilded emblem and the flag on top
 *   buildMonument   Abulkhair Khan on horseback (2000), dark bronze on
 *                   a red granite pedestal and a stepped platform
 *
 * Facing: a yaw where 0 means the front looks north (-z), the same
 * convention as the rest of the project.
 * ------------------------------------------------------------------ */

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3(1, 1, 1);
const _up = new THREE.Vector3(0, 1, 0);

/**
 * Box with its base at (x, y, z) and uv scaled to metres / tile.
 * @returns {THREE.BufferGeometry} the transformed geometry (already added)
 */
export function texBox(batch, mat, w, h, d, x, y, z, { ry = 0, tileU = 3, tileV = 3.4, cast = true } = {}) {
  const g = new THREE.BoxGeometry(w, h, d);
  const uv = g.attributes.uv;
  // face order: +x, -x, +y, -y, +z, -z; four vertices each
  const dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let f = 0; f < 6; f++) {
    const [fu, fv] = dims[f];
    for (let k = 0; k < 4; k++) {
      const i = f * 4 + k;
      uv.setXY(i, (uv.getX(i) * fu) / tileU, (uv.getY(i) * fv) / tileV);
    }
  }
  g.translate(0, h / 2, 0);
  _e.set(0, ry, 0);
  _q.setFromEuler(_e);
  _m.compose(_p.set(x, y, z), _q, _s);
  g.applyMatrix4(_m);
  batch.add(g, { mat, color: null, cast });
  return g;
}

/**
 * Vertical quad of w x h metres, bottom edge centred at (x, y, z), its
 * face looking toward yaw `facing` (0 = north). uv spans u0..u0+w/tileU.
 */
export function texPlane(batch, mat, w, h, x, y, z, facing, { tileU = w, tileV = h, cast = false, u0 = 0, v0 = 0 } = {}) {
  const g = new THREE.PlaneGeometry(w, h);
  const uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, u0 + (uv.getX(i) * w) / tileU, v0 + (uv.getY(i) * h) / tileV);
  g.translate(0, h / 2, 0);
  // PlaneGeometry faces +z; turn it to face (-sin f, -cos f)
  g.rotateY(facing + Math.PI);
  g.translate(x, y, z);
  batch.add(g, { mat, color: null, cast });
  return g;
}

/** Canvas of big letters on a transparent ground. */
export function lettersTex(text, { color = '#2f6fc0', family = FONT.display, weight = '800', w = 1024, h = 192, stretch = 1 } = {}) {
  return cached(`letters|${text}|${color}|${family}|${w}x${h}|${stretch}`, () => canvasTex(w, h, (c) => {
    c.clearRect(0, 0, w, h);
    centerText(c, text, w / 2, h / 2, w * 0.98, h * 0.9, color, { family, weight, stretch });
  }, { mips: true }));
}

/**
 * Rooftop letters: a lit alpha-tested quad and a darker one 0.12 m behind
 * it, so the letters read as solid at an angle. Added straight to `root`.
 */
export function letters(root, text, x, y, z, facing, { width = 12, height = 2.2, color = '#2f6fc0', back = '#1b3f73', family, stretch } = {}) {
  const front = new THREE.Mesh(new THREE.PlaneGeometry(width, height),
    cel({ map: lettersTex(text, { color, family, stretch }), alphaTest: 0.5, side: THREE.DoubleSide, grime: 0.01, dirt: 0 }));
  const rear = new THREE.Mesh(new THREE.PlaneGeometry(width, height),
    cel({ map: lettersTex(text, { color: back, family, stretch }), alphaTest: 0.5, side: THREE.DoubleSide, grime: 0, dirt: 0 }));
  const g = new THREE.Group();
  g.position.set(x, y + height / 2, z);
  g.rotation.y = facing + Math.PI;
  rear.position.z = -0.12;
  front.castShadow = true;
  g.add(rear, front);
  root.add(g);
  return g;
}

/** Tapered cylinder from point a to point b (arrays [x, y, z]). */
export function limb(batch, a, b, r0, r1, color, seg = 9) {
  const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b);
  const len = A.distanceTo(B);
  if (len < 1e-4) return;
  const g = new THREE.CylinderGeometry(r1, r0, len, seg, 1, false);
  g.translate(0, len / 2, 0);
  _q.setFromUnitVectors(_up, B.clone().sub(A).normalize());
  _m.compose(A, _q, _s.set(1, 1, 1));
  batch.add(g, { color, matrix: _m });
}

/** Smooth ellipsoid at c with radii r (number or [rx, ry, rz]). */
export function ball(batch, c, r, color, seg = 14) {
  const g = new THREE.SphereGeometry(1, seg, Math.max(6, seg - 4));
  const [rx, ry, rz] = Array.isArray(r) ? r : [r, r, r];
  _m.compose(_p.set(...c), _q.identity(), _s.set(rx, ry, rz));
  batch.add(g, { color, matrix: _m });
}

/* ------------------------------------------------------------------ *
 * Facade textures
 * ------------------------------------------------------------------ */

/** Soviet office window: white frame, three panes, a transom; varied blinds. */
function officeWindow(c, x, y, w, h, r) {
  c.fillStyle = '#eeebe2';
  c.fillRect(x - 3, y - 3, w + 6, h + 6);
  const g = c.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, '#8ea5b4');
  g.addColorStop(0.45, '#4f616b');
  g.addColorStop(1, '#3b4a52');
  c.fillStyle = g;
  c.fillRect(x, y, w, h);
  const kind = r.next();
  if (kind < 0.35) {
    // vertical blinds, the office standard
    c.fillStyle = 'rgba(226,224,214,0.85)';
    const drop = h * r.range(0.4, 1);
    for (let i = 0; i < 9; i++) c.fillRect(x + (i * w) / 9 + 1, y, w / 9 - 2, drop);
  } else if (kind < 0.55) {
    c.fillStyle = 'rgba(240,238,228,0.7)';
    c.fillRect(x, y, w * 0.45, h);
    c.fillRect(x + w * 0.55, y, w * 0.45, h);
  } else if (kind < 0.62) {
    c.fillStyle = 'rgba(170,120,80,0.75)';
    c.fillRect(x, y, w, h * 0.7);
  }
  // frame bars
  c.fillStyle = '#e8e5dc';
  c.fillRect(x, y + h * 0.28, w, 3);
  c.fillRect(x + w / 3 - 1.5, y + h * 0.28, 3, h * 0.72);
  c.fillRect(x + (2 * w) / 3 - 1.5, y + h * 0.28, 3, h * 0.72);
  // a stripe of sky in the glass
  c.fillStyle = 'rgba(210,225,235,0.18)';
  c.fillRect(x + w * 0.1, y, w * 0.12, h);
}

/** Akimat wing facade: 4 bays of 3 m by 2 storeys of 3.4 m per tile. */
export function akimatFacadeTex() {
  return cached('akimat-facade', () => canvasTex(1024, 580, (c, W, H) => {
    const r = rngKit(71);
    const px = W / 12;   // pixels per metre
    c.fillStyle = '#e6d8b8';
    c.fillRect(0, 0, W, H);
    for (let s = 0; s < 2; s++) {
      const y0 = s * 3.4 * px;
      // spandrel band under the windows
      c.fillStyle = '#dccba5';
      c.fillRect(0, y0 + 2.75 * px, W, 0.65 * px);
      for (let b = 0; b < 4; b++) {
        const x0 = b * 3 * px;
        // pilaster between bays
        c.fillStyle = '#ece1c8';
        c.fillRect(x0, y0, 0.28 * px, 3.4 * px);
        officeWindow(c, x0 + 0.6 * px, y0 + 0.55 * px, 1.8 * px, 2.05 * px, r);
      }
    }
    weather(c, W, H, 7, 0.5);
  }, { repeat: [1, 1] }));
}

/** Dark green curtain wall strip with mullions: 1.6 m by 3.4 m per tile. */
export function greenGlassTex() {
  return cached('akimat-glass', () => canvasTex(256, 544, (c, W, H) => {
    const g = c.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, '#4d7a68');
    g.addColorStop(0.5, '#3e6b5a');
    g.addColorStop(1, '#335a4b');
    c.fillStyle = g;
    c.fillRect(0, 0, W, H);
    c.fillStyle = 'rgba(190,220,210,0.14)';
    c.fillRect(W * 0.15, 0, W * 0.18, H);
    c.fillStyle = '#26382f';
    c.fillRect(0, H * 0.78, W, 10);
    c.fillRect(W / 2 - 3, 0, 6, H);
    c.fillRect(0, 0, 6, H);
  }, { repeat: [1, 1] }));
}

/** Ground floor cladding: warm stone slabs with tall windows, 3 m per tile. */
export function stoneBaseTex() {
  return cached('akimat-base', () => canvasTex(512, 640, (c, W, H) => {
    const r = rngKit(72);
    c.fillStyle = '#cdbf9f';
    c.fillRect(0, 0, W, H);
    c.strokeStyle = 'rgba(120,104,80,0.4)';
    c.lineWidth = 2;
    for (let y = 0; y < H; y += H / 8) { c.beginPath(); c.moveTo(0, y); c.lineTo(W, y); c.stroke(); }
    for (let x = 0; x < W; x += W / 3) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, H); c.stroke(); }
    officeWindow(c, W * 0.18, H * 0.2, W * 0.64, H * 0.62, r);
    weather(c, W, H, 5, 0.6);
  }, { repeat: [1, 1] }));
}

/** The emblem of Kazakhstan, simplified: gold rim, blue field, shanyrak, tulpars. */
export function emblemTex() {
  return cached('emblem-kz', () => canvasTex(512, 512, (c, W) => {
    c.clearRect(0, 0, W, W);
    const cx = W / 2, cy = W / 2, R = W * 0.47;
    const gold = '#e7b53a', goldDark = '#b0801f', blue = '#1f8fb8';
    c.fillStyle = gold;
    c.beginPath(); c.arc(cx, cy, R, 0, Math.PI * 2); c.fill();
    c.fillStyle = goldDark;
    c.beginPath(); c.arc(cx, cy, R * 0.9, 0, Math.PI * 2); c.fill();
    c.fillStyle = blue;
    c.beginPath(); c.arc(cx, cy, R * 0.82, 0, Math.PI * 2); c.fill();
    // shanyrak: the yurt's crown ring with rays
    c.strokeStyle = gold;
    c.lineWidth = W * 0.018;
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2;
      c.beginPath();
      c.moveTo(cx + Math.cos(a) * R * 0.2, cy + Math.sin(a) * R * 0.2);
      c.lineTo(cx + Math.cos(a) * R * 0.8, cy + Math.sin(a) * R * 0.8);
      c.stroke();
    }
    c.fillStyle = gold;
    c.beginPath(); c.arc(cx, cy, R * 0.24, 0, Math.PI * 2); c.fill();
    c.fillStyle = blue;
    c.beginPath(); c.arc(cx, cy, R * 0.15, 0, Math.PI * 2); c.fill();
    // two winged horses, as gold silhouettes left and right
    for (const s of [-1, 1]) {
      c.save();
      c.translate(cx + s * R * 0.5, cy + R * 0.12);
      c.scale(s, 1);
      c.fillStyle = gold;
      c.beginPath();
      c.moveTo(-R * 0.18, R * 0.28);
      c.quadraticCurveTo(-R * 0.22, -R * 0.05, -R * 0.02, -R * 0.12);
      c.quadraticCurveTo(R * 0.06, -R * 0.42, R * 0.2, -R * 0.5);
      c.quadraticCurveTo(R * 0.12, -R * 0.18, R * 0.16, R * 0.05);
      c.quadraticCurveTo(R * 0.05, R * 0.2, R * 0.02, R * 0.34);
      c.closePath();
      c.fill();
      c.restore();
    }
    // star above, name below
    c.fillStyle = gold;
    const sy = cy - R * 0.66, sr = R * 0.1;
    c.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (i * Math.PI) / 5;
      const rr = i % 2 ? sr * 0.45 : sr;
      c.lineTo(cx + Math.cos(a) * rr, sy + Math.sin(a) * rr);
    }
    c.fill();
    centerText(c, 'ҚАЗАҚСТАН', cx, cy + R * 0.7, R * 0.9, R * 0.16, gold, { family: FONT.sans });
  }));
}

/* ------------------------------------------------------------------ *
 * The akimat
 * ------------------------------------------------------------------ */

const CREAM = 0xe6d8b8;
const CREAM_LIGHT = 0xefe5cc;
const STONE = 0xcdbf9f;
const GRANITE = 0x8a3a32;
const GRANITE_DARK = 0x6e2c27;

/**
 * @param {object} ctx  world build context
 * @param {object} o
 * @param {number} o.x      centre x of the building
 * @param {number} o.zFront z of the wings' front (north) wall
 * @returns {{ flagTop: number[], door: number[], emblem: number[], back: number }}
 */
export function buildAkimat(ctx, { x, zFront }) {
  const { batch, colliders, ground, root } = ctx;
  const facade = cel({ map: akimatFacadeTex(), grime: 0.035, dirt: 0.25, cache: false });
  const glass = cel({ map: greenGlassTex(), grime: 0.01, dirt: 0, cache: false });
  const base = cel({ map: stoneBaseTex(), grime: 0.03, dirt: 0.3, cache: false });

  const wingW = 36, centreW = 24, depth = 15, storey = 3.4, floors = 6;
  const groundH = 4.2;
  const wingH = groundH + (floors - 1) * storey;         // 21.2
  const centreH = wingH + 2.6;
  const zBack = zFront + depth;

  for (const side of [-1, 1]) {
    const cx = x + side * (centreW / 2 + wingW / 2);
    // ground floor in stone, a touch recessed, then the office storeys
    texBox(batch, base, wingW, groundH, depth - 0.3, cx, 0, zFront + depth / 2 + 0.15, { tileU: 3, tileV: groundH });
    texBox(batch, facade, wingW, wingH - groundH, depth, cx, groundH, zFront + depth / 2, { tileU: 12, tileV: 6.8 });
    batch.box(wingW + 0.6, 0.7, depth + 0.6, CREAM_LIGHT, cx, wingH, zFront + depth / 2);
    batch.box(wingW, 0.2, depth, 0x7c7468, cx, wingH + 0.7, zFront + depth / 2);
    // end pavilions: a blind cream bay at each far end
    const endX = x + side * (centreW / 2 + wingW - 1.6);
    batch.box(3.4, wingH + 0.4, depth + 0.8, CREAM, endX, 0, zFront + depth / 2);
    // roof clutter
    for (let i = 0; i < 3; i++) batch.box(1.6, 1.1, 1.6, 0xb9b3a6, cx - 10 + i * 9, wingH + 0.9, zFront + depth / 2 + 3);
  }

  // centre: protrudes 2 m, taller, with the glass strips
  const cz0 = zFront - 2;
  texBox(batch, base, centreW, groundH, depth + 2, x, 0, cz0 + (depth + 2) / 2, { tileU: 3, tileV: groundH });
  batch.box(centreW, centreH - groundH, depth + 2, CREAM, x, groundH, cz0 + (depth + 2) / 2);
  // strips: 8 glass strips between cream pilasters on the north face
  const strips = 8;
  const bayW = centreW / strips;
  for (let i = 0; i < strips; i++) {
    const sx = x - centreW / 2 + bayW * (i + 0.5);
    texBox(batch, glass, bayW - 1.1, centreH - groundH - 1.4, 0.3, sx, groundH + 0.4, cz0 - 0.05, { tileU: bayW - 1.1, tileV: storey });
  }
  for (let i = 0; i <= strips; i++) {
    const sx = x - centreW / 2 + bayW * i;
    batch.box(0.9, centreH - groundH - 0.4, 0.5, CREAM_LIGHT, sx, groundH, cz0 - 0.1);
  }
  // attic with the emblem
  batch.box(centreW - 2, 3.6, 5, CREAM, x, centreH, cz0 + 1.8);
  batch.box(centreW - 1.4, 0.4, 5.6, CREAM_LIGHT, x, centreH + 3.6, cz0 + 1.8);
  const em = new THREE.Mesh(new THREE.CircleGeometry(1.45, 40), cel({ map: emblemTex(), alphaTest: 0.4, grime: 0, dirt: 0, cache: false }));
  em.position.set(x, centreH + 1.85, cz0 - 0.72);
  em.rotation.y = Math.PI;
  root.add(em);
  batch.cyl(1.55, 0.15, 0xb0801f, x, centreH + 1.85 - 0.0, cz0 - 0.7, { rx: Math.PI / 2, seg: 28 });

  // entrance: a thin canopy slab on two columns and wide granite steps
  const doorZ = cz0 - 0.05;
  batch.box(12, 0.45, 5, CREAM_LIGHT, x, 3.4, doorZ - 2.4);
  for (const s of [-1, 1]) batch.cyl(0.32, 3.4, CREAM_LIGHT, x + s * 5.3, 0.5, doorZ - 4.4, { seg: 12 });
  batch.box(8, 2.6, 0.2, 0x3f5a52, x, 0.5, doorZ - 0.1, { mat: 'glass' });
  for (let i = 0; i < 3; i++) {
    batch.box(16 - i * 1.2, 0.17, 6 - i * 0.6, GRANITE, x, i * 0.17, doorZ - 3 + i * 0.3);
  }
  ground.flat(x - 7.4, doorZ - 5.4, x + 7.4, doorZ + 0.1, 0.51, 'akimat-steps');

  const x0 = x - centreW / 2 - wingW, x1 = x + centreW / 2 + wingW;
  colliders.box(x0 - 0.3, zFront, x1 + 0.3, zBack, { tag: 'akimat' });
  colliders.box(x - centreW / 2, cz0, x + centreW / 2, zFront, { tag: 'akimat' });
  for (const s of [-1, 1]) colliders.circle(x + s * 5.3, doorZ - 4.4, 0.35);

  return {
    flagTop: [x, centreH + 4.0, cz0 + 1.8],
    door: [x, 1.4, doorZ - 0.4],
    emblem: [x, centreH + 1.85, cz0 - 0.8],
    back: zBack,
    x0, x1,
  };
}

/* ------------------------------------------------------------------ *
 * Abulkhair Khan
 * ------------------------------------------------------------------ */

const BRONZE = 0x4c4736;
const BRONZE_LIGHT = 0x6a634a;

/**
 * The equestrian monument. (x, z) is the centre; the horse faces
 * `facing` (0 = north). Returns the plaque position.
 */
export function buildMonument(ctx, { x, z, facing = 0 }) {
  const { batch, colliders, ground } = ctx;
  const local = new THREE.Group();

  // stepped red granite platform, walkable
  const tiers = [[17, 12.5], [15.8, 11.3], [14.6, 10.1]];
  tiers.forEach(([w, d], i) => graniteBlock(batch, w, 0.3, d, i % 2 ? GRANITE_DARK : GRANITE, x, i * 0.3, z, { c: 0.035 }));
  ground.flat(x - 8.5, z - 6.25, x + 8.5, z + 6.25, 0.3, 'monument');
  ground.flat(x - 7.9, z - 5.65, x + 7.9, z + 5.65, 0.6, 'monument');
  ground.flat(x - 7.3, z - 5.05, x + 7.3, z + 5.05, 0.9, 'monument');

  // pedestal: plinth, shaft, cornice
  const top = 0.9 + 0.6 + 5.6 + 0.5;
  graniteBlock(batch, 4.6, 0.6, 6.6, GRANITE_DARK, x, 0.9, z, { c: 0.06 });
  graniteBlock(batch, 3.4, 5.6, 5.4, GRANITE, x, 1.5, z, { c: 0.03 });
  graniteBlock(batch, 3.3, 0.25, 5.3, GRANITE_DARK, x, 4.2, z, { c: 0.02 });
  graniteBlock(batch, 3.62, 0.14, 5.62, GRANITE_DARK, x, 6.96, z, { c: 0.03 });
  graniteBlock(batch, 4.0, 0.5, 6.0, GRANITE_DARK, x, 7.1, z, { c: 0.07 });
  colliders.box(x - 2.3, z - 3.3, x + 2.3, z + 3.3, { tag: 'monument' });

  // bronze plaque on the front face
  const fz = -Math.cos(facing), fx = -Math.sin(facing);
  const plaqueOff = 2.72;
  batch.box(1.8, 1.1, 0.06, BRONZE_LIGHT, x + fx * plaqueOff, 2.6, z + fz * plaqueOff, { ry: facing });
  // a sunk panel on each long face, and the name in bronze letters
  for (const s of [-1, 1]) batch.box(0.06, 3.6, 3.6, GRANITE_DARK, x + s * 1.71, 2.3, z);
  batch.box(2.6, 3.4, 0.06, GRANITE_DARK, x + fx * 2.71, 1.7, z + fz * 2.71, { ry: facing });
  const name = new THREE.Mesh(new THREE.PlaneGeometry(3.0, 0.5),
    cel({ map: lettersTex('ӘБІЛҚАЙЫР ХАН', { color: '#b89a5a', family: FONT.serif, weight: '700', w: 1024, h: 170, stretch: 0.9 }), alphaTest: 0.5, grime: 0, dirt: 0, cache: false }));
  name.position.set(x + fx * 2.76, 5.3, z + fz * 2.76);
  name.rotation.y = facing + Math.PI;
  ctx.root.add(name);

  // the sculpture is authored facing -z at the origin, then placed
  abulkhairSculpture(new Sculpt(batch, x, top, z, facing, 1, { statue: true }));

  return { plaque: [x + fx * (plaqueOff + 0.6), 3.1, z + fz * (plaqueOff + 0.6)], top };
}

export const LANDMARK_COLORS = { CREAM, CREAM_LIGHT, STONE, GRANITE, GRANITE_DARK, BRONZE };
