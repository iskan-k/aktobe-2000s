import * as THREE from 'three';
import { cel } from '../../core/toon.js';
import { canvasTex, cached, centerText, FONT, weather } from '../../core/textures.js';
import { rngKit } from '../../core/util.js';
import { loft, sweep, headGeo, hairGeo, handGeo, frame, chamferFrustum, boxUV, HEAD } from './figure.js';

/* ------------------------------------------------------------------ *
 * Kit shared by the sights: a local-space sculpture builder, the stone
 * and bronze colours, the plaque texture, and a helper for the "read the
 * plaque" interactables.
 *
 * A Sculpt collects primitives authored at the origin facing -z (the
 * same convention as the rest of the project) and bakes them into the
 * static batch placed at (x, y, z) turned to `facing`. Statues use the
 * forms in figure.js (lofted bodies, swept limbs, heads with faces,
 * hands) and bake into the statue material, with the cavity shade of a
 * face or a fold carried in the vertex colour. Pedestals are chamfered
 * granite blocks in a speckled stone material.
 * ------------------------------------------------------------------ */

export const STONE = {
  granite: 0x8a3a32,        // red granite, the Soviet memorial stone
  graniteDark: 0x5e2824,
  greyGranite: 0x8e8c88,
  greyDark: 0x5f5e5b,
  labradorite: 0x2c2e31,    // polished black stone of name walls
  concrete: 0xb4b0a6,
  slab: 0xa9a397,
};

export const METAL = {
  bronze: 0x5a4a34,
  bronzeDark: 0x3e3325,
  bronzeLight: 0x9a7a44,
  gilt: 0xc9a44a,
  statue: 0x7e6a4a,         // cast figures: a warm, lightly worn bronze
  statueDark: 0x5c4b33,
  khaki: 0x4f5a3a,          // the green of a museum T-34
  khakiDark: 0x3a4229,
};

const _up = new THREE.Vector3(0, 1, 0);
const _v = new THREE.Vector3();

/**
 * Cast bronze and painted statues: five light bands so a face and the
 * folds of a coat model softly, no dusty skirt (they stand on plinths).
 */
export function statueMat() {
  return cel({ vertexColors: true, bands: 'statue', grime: 0.035, dirt: 0 });
}

/** Polished granite: a fine speckle, tinted by the vertex colour. */
function graniteTex() {
  return cached('granite-speckle', () => canvasTex(256, 256, (c, W, H) => {
    const r = rngKit(4411);
    c.fillStyle = '#e6e6e6';
    c.fillRect(0, 0, W, H);
    // feldspar and quartz grains, then black mica flecks; drawn wrapped so the tile repeats
    const dot = (x, y, s, col, a) => {
      c.globalAlpha = a;
      c.fillStyle = col;
      for (const dx of [-W, 0, W]) for (const dy of [-H, 0, H]) c.fillRect(x + dx, y + dy, s, s * r.range(0.6, 1.4));
    };
    for (let i = 0; i < 2600; i++) dot(r.range(0, W), r.range(0, H), r.range(1, 4), r.pick(['#ffffff', '#f4f0ea', '#c8c4c0']), r.range(0.3, 0.8));
    for (let i = 0; i < 1400; i++) dot(r.range(0, W), r.range(0, H), r.range(1, 2.5), r.pick(['#3a3634', '#58524e', '#8a8480']), r.range(0.3, 0.9));
    c.globalAlpha = 1;
  }, { repeat: [1, 1] }));
}

let _granite = null;
export function graniteMat() {
  if (!_granite) _granite = cel({ map: graniteTex(), vertexColors: true, grime: 0.03, dirt: 0.2, cache: false });
  return _granite;
}

const _gm = new THREE.Matrix4();
const _gq = new THREE.Quaternion();
const _ge = new THREE.Euler();
const _gp = new THREE.Vector3();
const _gs = new THREE.Vector3(1, 1, 1);

/**
 * A chamfered granite block, base-anchored at (x, y, z), turned `ry`.
 * `top` gives a tapered block its top size [w1, d1].
 */
export function graniteBlock(batch, w, h, d, color, x, y, z, { ry = 0, c = 0.04, top = null, tile = 0.9, cast = true } = {}) {
  const [w1, d1] = top || [w, d];
  const g = boxUV(chamferFrustum(w, d, w1, d1, h, c), tile);
  _gm.compose(_gp.set(x, y, z), _gq.setFromEuler(_ge.set(0, ry, 0)), _gs);
  batch.add(g, { color, matrix: _gm, mat: graniteMat(), cast });
}

export class Sculpt {
  /** `statue` bakes into the statue material; otherwise the plain solid one. */
  constructor(batch, x, y, z, facing = 0, scale = 1, { statue = false } = {}) {
    this.batch = batch;
    this.mat = statue ? statueMat() : 'solid';
    this.m = new THREE.Matrix4().compose(new THREE.Vector3(x, y, z),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(0, facing, 0)), new THREE.Vector3(scale, scale, scale));
  }

  place(g, color) {
    g.applyMatrix4(this.m);
    const shade = g.attributes.shade;
    if (!shade) {
      this.batch.add(g, { color, mat: this.mat });
      return;
    }
    // bake the geometry's cavity shade into its vertex colour
    const base = new THREE.Color(color);
    const arr = new Float32Array(shade.count * 3);
    for (let i = 0; i < shade.count; i++) {
      const k = shade.getX(i);
      arr[i * 3] = base.r * k;
      arr[i * 3 + 1] = base.g * k;
      arr[i * 3 + 2] = base.b * k;
    }
    g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
    g.deleteAttribute('shade');
    this.batch.add(g, { color: null, mat: this.mat });
  }

  /** Tube along a smooth curve; see figure.js sweep. */
  sweep(pts, radii, color, o) { this.place(sweep(pts, radii, o), color); }

  /** Stacked rings; see figure.js loft. */
  loft(rings, color, o) { this.place(loft(rings, o), color); }

  /** A hand at the wrist, fingers along `along`, palm toward `toward`. */
  hand(wrist, along, toward, color, { kind = 'open', side = 1, size = 1 } = {}) {
    const f = frame(wrist, along, toward).scale(new THREE.Vector3(size, size, size));
    for (const g of handGeo(kind, side)) { g.applyMatrix4(f); this.place(g, color); }
  }

  /**
   * A head centred at `at`, turned by rot [pitch (+ lifts the chin), yaw
   * (+ turns to the figure's left), roll]. `hair` is a hairline function
   * or null; `ears` false under a hat.
   */
  head(at, rot, color, { hair = null, hairColor = color, hairOpts = {}, ears = true, size = 1, ...face } = {}) {
    const m = new THREE.Matrix4().compose(new THREE.Vector3(...at),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(rot[0], rot[1], rot[2] || 0, 'YXZ')), new THREE.Vector3(size, size, size));
    const add = (g, col) => { g.applyMatrix4(m); this.place(g, col); };
    add(headGeo(face), color);
    if (hair) add(hairGeo(hair, hairOpts), hairColor);
    if (ears) {
      for (const s of [-1, 1]) {
        const e = new THREE.SphereGeometry(1, 8, 6);
        e.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(s * HEAD.rx * 0.9, -0.01, HEAD.rz * 0.14),
          new THREE.Quaternion().setFromEuler(new THREE.Euler(0, s * 0.5, 0)), new THREE.Vector3(0.009, 0.026, 0.016)));
        add(e, color);
      }
    }
    return m;
  }

  /** Tapered cylinder from a to b, radius r0 at a and r1 at b. */
  limb(a, b, r0, r1, color, seg = 9) {
    const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b);
    const len = A.distanceTo(B);
    if (len < 1e-4) return;
    const g = new THREE.CylinderGeometry(r1, r0, len, seg, 1, false);
    g.translate(0, len / 2, 0);
    const q = new THREE.Quaternion().setFromUnitVectors(_up, _v.copy(B).sub(A).normalize());
    g.applyMatrix4(new THREE.Matrix4().compose(A, q, new THREE.Vector3(1, 1, 1)));
    this.place(g, color);
  }

  /** Ellipsoid at c; r is a number or [rx, ry, rz]; rot is [x, y, z] euler. */
  ball(c, r, color, seg = 12, rot = [0, 0, 0]) {
    const [rx, ry, rz] = Array.isArray(r) ? r : [r, r, r];
    const g = new THREE.SphereGeometry(1, seg, Math.max(6, seg - 4));
    g.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(...c),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(rot[0], rot[1], rot[2], 'YXZ')), new THREE.Vector3(rx, ry, rz)));
    this.place(g, color);
  }

  /** Box centred at c. */
  box(w, h, d, c, color, rot = [0, 0, 0]) {
    const g = new THREE.BoxGeometry(w, h, d);
    g.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(...c),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(rot[0], rot[1], rot[2], 'YXZ')), new THREE.Vector3(1, 1, 1)));
    this.place(g, color);
  }

  /** Cone or frustum centred at c (rTop = 0 for a cone). */
  cone(r, h, c, color, seg = 10, rot = [0, 0, 0], rTop = 0) {
    const g = new THREE.CylinderGeometry(rTop, r, h, seg, 1, false);
    g.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(...c),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(rot[0], rot[1], rot[2], 'YXZ')), new THREE.Vector3(1, 1, 1)));
    this.place(g, color);
  }

  /** Any geometry authored in local space. */
  geo(g, color) { this.place(g, color); }
}

/** Engraved plaque: pale letters cut into a dark stone or bronze panel. */
export function plaqueTex(key, lines, { bg = '#2c2e31', fg = '#d9c38a', w = 512, h = 320, family = FONT.serif } = {}) {
  return cached(`plaque|${key}`, () => canvasTex(w, h, (c) => {
    c.fillStyle = bg;
    c.fillRect(0, 0, w, h);
    c.strokeStyle = fg;
    c.globalAlpha = 0.6;
    c.lineWidth = 3;
    c.strokeRect(12, 12, w - 24, h - 24);
    c.globalAlpha = 1;
    const lh = (h - 48) / lines.length;
    lines.forEach((t, i) => {
      const size = i === 0 ? lh * 0.72 : lh * 0.56;
      centerText(c, t, w / 2, 24 + lh * (i + 0.5), w * 0.86, size, fg, { family, weight: i === 0 ? '700' : '600' });
    });
    weather(c, w, h, hashLine(key), 0.35);
  }));
}

function hashLine(s) {
  let h = 7;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h % 997;
}

/**
 * Letters cast in bronze and fixed to stone: an alpha-cut texture whose
 * letters carry a dark offset edge, so they read as standing proud of
 * the face. `lines` are [text, relative size] pairs top to bottom.
 */
export function castLettersTex(key, lines, { fg = '#c9a24e', edge = '#2a1e12', w = 1024, h = 512, family = FONT.serif } = {}) {
  return cached(`cast|${key}`, () => canvasTex(w, h, (c) => {
    c.clearRect(0, 0, w, h);
    const total = lines.reduce((a, [, k]) => a + k, 0);
    let y = 0;
    for (const [t, k] of lines) {
      const lh = (h * k) / total;
      const cy = y + lh / 2;
      centerText(c, t, w / 2 + 3, cy + 4, w * 0.94, lh * 0.8, edge, { family, weight: '700' });
      centerText(c, t, w / 2, cy, w * 0.94, lh * 0.8, fg, { family, weight: '700' });
      y += lh;
    }
  }));
}

/** A textured vertical quad (bottom centre at x, y, z) added to root, facing yaw. */
export function panel(root, map, w, h, x, y, z, facing, o = {}) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), cel({ map, grime: 0.02, dirt: 0, cache: false, ...o }));
  m.position.set(x, y + h / 2, z);
  m.rotation.y = facing + Math.PI;
  root.add(m);
  return m;
}

/**
 * Read-the-plaque interactable: the text arrives as a message, the way
 * the other plaques in town do it.
 */
export function plaque(ctx, { x, y = 1.1, z, w = 1.4, h = 1.2, d = 1.4, label, title, body, ms = 7000 }) {
  ctx.interact({
    x, y, z, w, h, d, label,
    action: (game) => { game.hud.sms(title, body, ms); game.audio.play('paper', { volume: 0.5 }); },
  });
}

/** Unit offsets for a yaw: forward (fx, fz) and right (rx, rz). */
export function axes(facing) {
  const fx = -Math.sin(facing), fz = -Math.cos(facing);
  return { fx, fz, rx: -fz, rz: fx };
}
