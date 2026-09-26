import * as THREE from 'three';
import { Batch } from '../../core/batch.js';
import { rotXZ } from '../../core/util.js';

/* ------------------------------------------------------------------ *
 * Ground equipment on the apron, Soviet-built and repainted: the ramp
 * stairs on a ГАЗ-53 chassis, the ТЗ-22 fuel bowser on a КрАЗ, the
 * low tow tractor, baggage carts. Each builder draws into a batch at
 * (x, z) turned by `yaw` (front toward local -z, like the cars).
 * ------------------------------------------------------------------ */

const CAB = 0xe8e4d6, TYRE = 0x222222, STEEL = 0x8a8e90;

/** A local-frame helper: box(w, h, d, color, lx, ly, lz, o) placed and turned. */
function frame(batch, x, z, yaw, y = 0) {
  return (w, h, d, color, lx, ly, lz, o = {}) => {
    const [dx, dz] = rotXZ(lx, lz, yaw);
    batch.box(w, h, d, color, x + dx, y + ly, z + dz, { ...o, ry: yaw + (o.ry || 0) });
  };
}

function wheels(batch, x, z, yaw, pts, r = 0.45, w = 0.3) {
  for (const [lx, lz] of pts) {
    const [dx, dz] = rotXZ(lx, lz, yaw);
    batch.cyl(r, w, TYRE, x + dx, r, z + dz, { rz: Math.PI / 2, ry: yaw, seg: 10 });
  }
}

/** A ГАЗ-53 with a stair unit on its back, the top platform facing local -x. */
export function stairsTruck(batch, x, z, yaw, { color = 0xe0a020, top = 3.4 } = {}) {
  const b = frame(batch, x, z, yaw);
  b(2.2, 0.9, 6.2, 0x3a3a3a, 0, 0.55, 0);
  b(2.2, 1.6, 1.9, CAB, 0, 1.0, -2.6);
  b(2.0, 0.55, 0.05, 0x3a4a56, 0, 1.95, -3.56, { mat: 'glass' });
  b(2.1, 0.8, 1.4, CAB, 0, 0.9, -3.9);
  wheels(batch, x, z, yaw, [[-0.95, -3.2], [0.95, -3.2], [-0.95, 1.8], [0.95, 1.8]]);
  // the stair unit: a sloping flight with rails and a platform at the top, toward -x
  const n = 12;
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    b(1.3, 0.06, 0.34, STEEL, -0.2 - t * 1.4, 1.5 + t * (top - 1.5), 2.6 - t * 5.0);
  }
  for (const s of [-1, 1]) {
    const [ax, az] = rotXZ(-0.2 + s * 0.68, 2.6, yaw), [bx, bz] = rotXZ(-1.6 + s * 0.68, -2.4, yaw);
    batch.tube(x + ax, 2.5, z + az, x + bx, top + 1.0, z + bz, 0.04, color, { seg: 4 });
    batch.tube(x + ax, 1.5, z + az, x + bx, top, z + bz, 0.06, color, { seg: 4 });
  }
  b(1.8, 0.1, 1.6, STEEL, -1.8, top, -2.8);
  b(1.8, 1.0, 0.05, color, -1.8, top, -3.6);
  b(0.08, top, 0.08, color, -1.0, 1.4, -2.2);
}

/** The ТЗ-22 fuel bowser: a long tank semi-trailer behind a КрАЗ tractor. */
export function fuelBowser(batch, x, z, yaw) {
  const b = frame(batch, x, z, yaw);
  b(2.5, 1.9, 2.4, 0x3a6a3a, 0, 1.0, -5.2);
  b(2.3, 0.6, 0.05, 0x3a4a56, 0, 2.2, -6.42, { mat: 'glass' });
  b(2.5, 1.2, 1.6, 0x3a6a3a, 0, 0.9, -7.1);
  b(2.4, 0.5, 11, 0x2a2a2a, 0, 0.8, 0.8);
  const [tx, tz] = rotXZ(0, 1.2, yaw);
  batch.cyl(1.25, 9.4, 0xd8d4c8, x + tx, 2.6, z + tz, { rx: Math.PI / 2, ry: yaw, seg: 14 });
  b(0.3, 0.3, 9.4, 0xc8302a, 0, 3.1, 1.2);
  wheels(batch, x, z, yaw, [[-1.05, -6.4], [1.05, -6.4], [-1.05, -3.6], [1.05, -3.6], [-1.05, 4.2], [1.05, 4.2], [-1.05, 5.4], [1.05, 5.4]], 0.55, 0.4);
}

/** A baggage cart, and a train of them. */
export function baggageCarts(batch, x, z, yaw, n = 3) {
  for (let i = 0; i < n; i++) {
    const [dx, dz] = rotXZ(0, i * 3.4, yaw);
    const b = frame(batch, x + dx, z + dz, yaw);
    b(1.5, 0.12, 2.6, 0x5a6a7a, 0, 0.45, 0);
    for (const s of [-1, 1]) b(0.06, 1.2, 2.6, 0x5a6a7a, s * 0.72, 0.55, 0);
    b(1.5, 0.06, 2.7, 0x3a5a8a, 0, 1.75, 0);
    wheels(batch, x + dx, z + dz, yaw, [[-0.6, -1.0], [0.6, -1.0], [-0.6, 1.0], [0.6, 1.0]], 0.22, 0.14);
    if (i % 2 === 0) b(0.9, 0.5, 0.6, 0x6a4a3a, 0.2, 0.6, 0.4);
  }
}

/** The low tow tractor, drawn into `batch` at the origin facing -z. */
function tugInto(batch) {
  const b = frame(batch, 0, 0, 0);
  b(2.3, 0.9, 5.0, 0xe0b020, 0, 0.35, 0);
  b(2.1, 0.2, 4.6, 0x2a2a2a, 0, 0.25, 0);
  b(1.2, 1.1, 1.3, 0xe0b020, 0.4, 1.25, 1.3);
  b(1.0, 0.5, 0.05, 0x3a4a56, 0.4, 1.7, 0.64, { mat: 'glass' });
  b(0.6, 0.3, 0.4, 0xff8a1a, 0.4, 2.35, 1.3, { mat: 'glow' });
  b(0.3, 0.2, 0.5, 0x2a2a2a, 0, 0.5, -2.7);
  wheels(batch, 0, 0, 0, [[-1.05, -1.6], [1.05, -1.6], [-1.05, 1.6], [1.05, 1.6]], 0.42, 0.34);
}

/** A tow tractor as its own movable group. */
export function makeTug() {
  const batch = new Batch({ name: 'tug', cell: Infinity });
  tugInto(batch);
  const group = new THREE.Group();
  group.name = 'tug';
  batch.flush(group);
  group.traverse((o) => { if (o.isMesh) { o.castShadow = true; } });
  return group;
}

/** A parked tow tractor baked into a batch. */
export function parkedTug(batch, x, z, yaw) {
  const tmp = new Batch({ name: 'tmp', cell: Infinity });
  tugInto(tmp);
  const g = new THREE.Group();
  tmp.flush(g);
  const m = new THREE.Matrix4().compose(new THREE.Vector3(x, 0, z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw), new THREE.Vector3(1, 1, 1));
  g.traverse((o) => {
    if (!o.isMesh) return;
    batch.add(o.geometry, { color: null, matrix: m, mat: o.material });
  });
}
