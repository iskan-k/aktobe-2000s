import * as THREE from 'three';
import { UNIT_BOX_CLOSED } from '../../core/batch.js';
import { flat } from '../../core/toon.js';
import { PITCH, MASTS, MAST_H, STANDS, COL } from './layout.js';
import { scoreboard } from './textures.js';

/* ------------------------------------------------------------------ *
 * The floodlights and the scoreboard.
 *
 * Four tapered steel masts in the open corners (the 2005 upgrade gave
 * the ground 142 lamps; here each head carries 36), heads tilted at the
 * centre spot, red obstruction lamps on top for the aircraft coming in
 * to land south of town. They stop at 42 m for the same reason.
 *
 * The scoreboard stands on legs behind the south stand. The real one was
 * a 10 x 9 m screen put up in 2000; this is drawn as a board of lamps,
 * the older kind, which is what most grounds in the country still had.
 * ------------------------------------------------------------------ */

const _m = new THREE.Matrix4(), _l = new THREE.Matrix4();
const _p = new THREE.Vector3(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _e = new THREE.Euler();

let lensGeo = null;

function mast(b, colliders, x, z) {
  const H = MAST_H;
  b.box(2.6, 0.5, 2.6, COL.concreteDark, x, -0.05, z, { cast: false });
  b.cyl(0.72, H, COL.steel, x, 0.45, z, { seg: 12, rTop: 0.38 });
  // the ladder up the back and two rest platforms
  const yaw = Math.atan2(-(PITCH.x - x), -(PITCH.z - z));
  const bx = Math.sin(yaw) * 0.75, bz = Math.cos(yaw) * 0.75;
  const sx = Math.cos(yaw) * 0.22, sz = -Math.sin(yaw) * 0.22;
  for (const s of [-1, 1]) b.tube(x + bx + s * sx, 2.5, z + bz + s * sz, x + bx * 0.55 + s * sx, H - 1, z + bz * 0.55 + s * sz, 0.02, COL.steelDark, { seg: 3, cast: false });
  for (const y of [14, 28]) {
    b.cyl(1.3, 0.1, COL.steelDark, x, y, z, { seg: 12, cast: false });
    b.cyl(1.3, 1.0, COL.steelDark, x, y + 0.1, z, { seg: 12, open: true, cast: false });
  }
  colliders.circle(x, z, 1.1, { top: 0.45, tag: 'mast-base' });
  colliders.circle(x, z, 0.72, { tag: 'mast' });

  // the head: a frame tilted down at the centre spot, 6 x 6 lamps
  const top = H + 0.45;
  const dist = Math.hypot(PITCH.x - x, PITCH.z - z);
  const tilt = -Math.atan2(top - 2, dist) * 0.9;
  _e.set(tilt, yaw, 0, 'YXZ');
  _q.setFromEuler(_e);
  const head = new THREE.Matrix4().compose(_p.set(x, top + 2.6, z), _q, _s.set(1, 1, 1));
  const part = (w, h, d, lx, ly, lz, color, mat = 'solid') => {
    _l.compose(_p.set(lx, ly - h / 2, lz), new THREE.Quaternion(), _s.set(w, h, d));
    _m.multiplyMatrices(head, _l);
    b.add(UNIT_BOX_CLOSED, { color, matrix: _m, mat });
  };
  part(8.4, 0.18, 0.3, 0, 2.7, 0.35, COL.steelDark);
  part(8.4, 0.18, 0.3, 0, -2.7, 0.35, COL.steelDark);
  for (const lx of [-4.1, 4.1]) part(0.18, 5.6, 0.3, lx, 0, 0.35, COL.steelDark);
  part(0.3, 3, 0.3, 0, -3.8, 0.6, COL.steel);
  if (!lensGeo) {
    lensGeo = new THREE.CylinderGeometry(0.28, 0.28, 0.06, 12);
    lensGeo.rotateX(Math.PI / 2);
  }
  for (let i = 0; i < 6; i++) {
    for (let j = 0; j < 6; j++) {
      const lx = -3.3 + i * 1.32, ly = -2.2 + j * 0.88;
      part(0.72, 0.62, 0.5, lx, ly, 0.2, 0x3a3c3e);
      _l.makeTranslation(lx, ly, -0.08);
      _m.multiplyMatrices(head, _l);
      b.add(lensGeo, { color: 0xf2eedd, matrix: _m, mat: 'glow', cast: false });
    }
  }
  // the obstruction lamp
  b.add(new THREE.SphereGeometry(0.22, 8, 6).translate(x, top + 5.7, z), { color: 0xff3020, mat: 'glow', cast: false });
  b.cyl(0.05, 0.4, COL.steelDark, x, top + 5.3, z, { seg: 5 });
}

/** The scoreboard behind the south stand, facing up the pitch. Returns its updater. */
function buildScoreboard(ctx) {
  const { batch: b, colliders, root } = ctx;
  const s = STANDS.south;
  const z = s.origin.z + s.depth + 2.4;
  const board = scoreboard();
  const W = 16, H = W / board.aspect, y0 = s.top + 3.2;
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(W, H), flat({ map: board.tex, cache: false }));
  mesh.position.set(PITCH.x, y0 + H / 2, z - 0.26);
  mesh.rotation.y = Math.PI;
  mesh.name = 'stadium-scoreboard';
  root.add(mesh);
  b.box(W + 0.8, H + 0.8, 0.5, 0x26282a, PITCH.x, y0 - 0.4, z);
  b.box(W + 1.2, 0.3, 0.9, COL.red, PITCH.x, y0 + H + 0.4, z);
  for (const dx of [-6, 6]) {
    b.box(0.5, y0, 0.5, COL.steelDark, PITCH.x + dx, 0, z + 0.3);
    b.tube(PITCH.x + dx, 0, z + 3, PITCH.x + dx, y0 - 0.5, z + 0.5, 0.12, COL.steelDark, { seg: 5 });
    colliders.box(PITCH.x + dx - 0.3, z + 0.05, PITCH.x + dx + 0.3, z + 0.55, { tag: 'scoreboard' });
  }
  return board;
}

export function buildMasts(ctx) {
  for (const m of MASTS) mast(ctx.batch, ctx.colliders, m.x, m.z);
  return buildScoreboard(ctx);
}
