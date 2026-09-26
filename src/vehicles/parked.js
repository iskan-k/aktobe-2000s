import * as THREE from 'three';
import { Batch } from '../core/batch.js';
import { rngKit } from '../core/util.js';
import { buildVehicle, PARKED_TYPES, randomCarColor } from './catalog.js';

/* ------------------------------------------------------------------ *
 * Parked cars: every spot a district pushed onto ctx.parking gets a
 * vehicle, baked into one static batch (a parked car costs nothing to
 * draw) with a rotated-box collider. A spot may name its `kind`
 * (a catalogue type) or leave it to chance; `chance` < 1 leaves some
 * spots empty, which reads more real than a full car park.
 * ------------------------------------------------------------------ */

const _m = new THREE.Matrix4();

/** Bake a vehicle model's visible meshes into a batch at `matrix`. */
export function bakeModel(batch, model, matrix) {
  model.group.updateMatrixWorld(true);
  model.group.traverse((o) => {
    if (!o.isMesh || !o.visible) return;
    let hidden = false;
    for (let p = o; p; p = p.parent) if (p.visible === false || p.userData.noBake) hidden = true;
    if (hidden || (model.interior && isInside(o, model.interior))) return;
    const mat = Array.isArray(o.material) ? o.material[0] : o.material;
    if (mat.transparent && mat.opacity < 0.05) return;
    _m.multiplyMatrices(matrix, o.matrixWorld);
    batch.add(o.geometry, { color: null, matrix: _m, mat, cast: o.castShadow, receive: true });
  });
}

function isInside(o, root) {
  for (let p = o; p; p = p.parent) if (p === root) return true;
  return false;
}

const CELL = 128;         // parked cars are grouped in ground cells of this size
const NEAR = 60;         // m from the camera to a cell's edge where the full models show
const _cam = new THREE.Vector3();

/**
 * A stand-in for a parked car seen from far off: the lower body, the
 * glasshouse and a dark band for the wheels, three boxes in the car's
 * own colour. From beyond ~100 m it reads the same at a sliver of the cost.
 */
function bakeProxy(batch, model, s, color) {
  const w = model.width, l = model.length, h = model.height;
  const o = { ry: s.ry ?? 0 };
  const y = s.y ?? 0;
  const tall = h > 2;
  batch.box(w * 0.94, h * 0.22, l * 0.78, 0x26262a, s.x, y, s.z, o);
  if (tall) {
    batch.box(w, h * 0.72, l, color, s.x, y + h * 0.2, s.z, o);
    batch.box(w * 1.01, h * 0.16, l * 0.96, 0x3e4a54, s.x, y + h * 0.6, s.z, o);
  } else {
    batch.box(w, h * 0.36, l, color, s.x, y + h * 0.18, s.z, o);
    batch.box(w * 0.86, h * 0.44, l * 0.5, 0x46525c, s.x, y + h * 0.54, s.z, o);
  }
}

export function createParked(game) {
  const spots = game.world.parking;
  if (!spots.length) return null;
  const rng = rngKit(4242);
  const root = new THREE.Group();
  root.name = 'parked';
  game.scene.add(root);
  const cells = new Map();
  const cellOf = (x, z) => {
    const key = `${Math.floor(x / CELL)}|${Math.floor(z / CELL)}`;
    if (!cells.has(key)) {
      cells.set(key, {
        near: new Batch({ name: 'parked', cell: 4096 }),
        far: new Batch({ name: 'parked-far', cell: 4096 }),
        cx: (Math.floor(x / CELL) + 0.5) * CELL,
        cz: (Math.floor(z / CELL) + 0.5) * CELL,
      });
    }
    return cells.get(key);
  };
  let n = 0;
  for (const s of spots) {
    if (s.chance !== undefined && !rng.chance(s.chance)) continue;
    const type = s.kind || rng.pick(PARKED_TYPES);
    const color = s.color ?? randomCarColor(rng, type);
    const model = buildVehicle(type, { seed: 500 + n, color, parked: true });
    model.group.position.set(0, 0, 0);
    model.group.rotation.set(0, 0, 0);
    // doors shut, lights off
    if (model.brake) model.brake.visible = false;
    if (model.blink) { model.blink.left.visible = false; model.blink.right.visible = false; }
    const m = new THREE.Matrix4().compose(
      new THREE.Vector3(s.x, s.y ?? 0, s.z),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(0, s.ry ?? 0, 0)),
      new THREE.Vector3(1, 1, 1),
    );
    const cell = cellOf(s.x, s.z);
    bakeModel(cell.near, model, m);
    bakeProxy(cell.far, model, s, color ?? 0x9a9a96);
    game.world.colliders.obb(s.x, s.z, model.width / 2, model.length / 2, s.ry ?? 0, { top: model.height, tag: 'parked' });
    n++;
  }
  const lods = [...cells.values()].map((c) => {
    const near = new THREE.Group();
    const far = new THREE.Group();
    c.near.flush(near);
    c.far.flush(far);
    root.add(near, far);
    return { near, far, cx: c.cx, cz: c.cz };
  });
  const reach = NEAR + CELL * 0.71;
  return {
    count: n,
    update() {
      game.camera.getWorldPosition(_cam);
      for (const c of lods) {
        const dx = _cam.x - c.cx, dz = _cam.z - c.cz;
        const close = dx * dx + dz * dz + _cam.y * _cam.y < reach * reach;
        c.near.visible = close;
        c.far.visible = !close;
      }
    },
  };
}
