import * as THREE from 'three';
import { cel } from '../../core/toon.js';
import { canvasTex, cached, centerText, FONT, weather } from '../../core/textures.js';

/* ------------------------------------------------------------------ *
 * Kit shared by the sights: a local-space sculpture builder, the stone
 * and bronze colours, the plaque texture, and a helper for the "read the
 * plaque" interactables.
 *
 * A Sculpt collects primitives authored at the origin facing -z (the
 * same convention as the rest of the project) and bakes them into the
 * static batch placed at (x, y, z) turned to `facing`. Statues are built
 * from tapered limbs and ellipsoids, like the Abulkhair Khan monument.
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
  khaki: 0x4f5a3a,          // the green of a museum T-34
  khakiDark: 0x3a4229,
};

const _up = new THREE.Vector3(0, 1, 0);
const _v = new THREE.Vector3();

export class Sculpt {
  constructor(batch, x, y, z, facing = 0, scale = 1) {
    this.batch = batch;
    this.m = new THREE.Matrix4().compose(new THREE.Vector3(x, y, z),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(0, facing, 0)), new THREE.Vector3(scale, scale, scale));
  }

  place(g, color) {
    g.applyMatrix4(this.m);
    this.batch.add(g, { color });
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

/**
 * A standing figure's legs, trunk and head in a long coat, which is what
 * both the Lenin and the Moldagulova statues are: heroic scale is set by
 * the Sculpt's scale. y = 0 is the top of the pedestal. Returns the
 * shoulder points so each statue adds its own arms.
 */
export function coatedFigure(s, color, dark, { coat = 1.28, stride = 0.16, girth = 1 } = {}) {
  const g = girth;
  // legs, one a little forward
  for (const side of [-1, 1]) {
    const fz = side < 0 ? -stride : stride * 0.4;
    s.limb([side * 0.11, 0.06, fz], [side * 0.12, 0.62, fz * 0.5], 0.065 * g, 0.08 * g, color);
    s.box(0.13 * g, 0.1, 0.28, [side * 0.11, 0.05, fz - 0.06], dark);
  }
  // the coat skirt: a flared frustum, split at the front
  s.cone(0.34 * g, coat - 0.5, [0, 0.5 + (coat - 0.5) / 2, 0], color, 14, [0, 0, 0], 0.2 * g);
  s.box(0.02, coat - 0.55, 0.05, [0, 0.52 + (coat - 0.55) / 2, -0.3 * g], dark, [0.12, 0, 0]);
  // trunk and chest
  s.limb([0, coat - 0.05, 0], [0, 1.45, 0], 0.2 * g, 0.2 * g, color, 12);
  s.ball([0, 1.42, 0], [0.26 * g, 0.13, 0.16 * g], color);          // shoulders
  s.box(0.2, 0.2, 0.06, [0, 1.35, -0.14 * g], dark, [0.2, 0, 0]);     // lapels
  s.limb([0, 1.5, 0], [0, 1.58, -0.01], 0.06, 0.055, color, 8);      // neck
  s.ball([0, 1.7, -0.02], [0.105, 0.125, 0.115], color);             // head
  return { left: [-0.23 * g, 1.42, 0], right: [0.23 * g, 1.42, 0] };
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
