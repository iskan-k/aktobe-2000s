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

export function createParked(game) {
  const spots = game.world.parking;
  if (!spots.length) return null;
  const rng = rngKit(4242);
  const batch = new Batch({ name: 'parked' });
  const root = new THREE.Group();
  root.name = 'parked';
  game.scene.add(root);
  let n = 0;
  for (const s of spots) {
    if (s.chance !== undefined && !rng.chance(s.chance)) continue;
    const type = s.kind || rng.pick(PARKED_TYPES);
    const model = buildVehicle(type, { seed: 500 + n, color: s.color ?? randomCarColor(rng), parked: true });
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
    bakeModel(batch, model, m);
    game.world.colliders.obb(s.x, s.z, model.width / 2, model.length / 2, s.ry ?? 0, { top: model.height, tag: 'parked' });
    n++;
  }
  batch.flush(root);
  return { count: n, update() {} };
}
