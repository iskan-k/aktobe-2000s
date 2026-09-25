import * as THREE from 'three';
import { bakeType, CAR_TYPES, BODY } from './rolling.js';
import { RAIL_Y, REACH } from './layout.js';

/* ------------------------------------------------------------------ *
 * Drawing and bumping into trains.
 *
 * Each car type is baked once and drawn as one InstancedMesh per
 * material, so a fifty-wagon freight costs a handful of draw calls.
 * Cars past the portals or more than HIDE metres from the camera are
 * skipped. A small pool of box colliders follows the cars nearest the
 * player, so you cannot walk or drive through a train.
 * ------------------------------------------------------------------ */

const CAPACITY = {
  loco_green: 6, loco_blue: 6, coach_grey: 16, coach_green: 16,
  gondola: 52, tank: 52, hopper: 52, boxcar: 52,
};
const HIDE = 450;
const POOL = 40;
const NEAR = 70;
const FAR = 1e7;

const _m = new THREE.Matrix4();

export function createFleet(game, parent) {
  const meshes = {};
  const counts = {};
  for (const type of CAR_TYPES) {
    const baked = bakeType(type);
    meshes[type] = baked.parts.map((p) => {
      const m = new THREE.InstancedMesh(p.geometry, p.material, CAPACITY[type]);
      m.name = `train-${type}`;
      m.count = 0;
      m.visible = false;
      m.frustumCulled = false;
      m.castShadow = true;
      m.receiveShadow = true;
      parent.add(m);
      return m;
    });
    counts[type] = 0;
  }

  const pool = Array.from({ length: POOL }, () => {
    const c = { kind: 'obb', cx: FAR, cz: FAR, hx: 1, hz: 1, cos: 1, sin: 0, top: 5, bottom: -1, train: null };
    game.world.dynamic.push(c);
    return c;
  });

  /** World x of a car's centre. */
  const carX = (tr, car) => tr.head - tr.dir * car.off;

  return {
    /** Lay out every car of every train for this frame. */
    draw(trains, cam) {
      for (const t of CAR_TYPES) counts[t] = 0;
      for (const tr of trains) {
        const yaw = tr.dir > 0 ? -Math.PI / 2 : Math.PI / 2;
        for (const car of tr.cars) {
          const x = carX(tr, car);
          if (Math.abs(x) > REACH + car.len / 2) continue;
          if (Math.hypot(x - cam.x, tr.z - cam.z) > HIDE) continue;
          const n = counts[car.type];
          if (n >= CAPACITY[car.type]) continue;
          _m.makeRotationY(yaw + (car.flip ? Math.PI : 0));
          _m.setPosition(x, RAIL_Y, tr.z);
          for (const m of meshes[car.type]) m.setMatrixAt(n, _m);
          counts[car.type] = n + 1;
        }
      }
      for (const t of CAR_TYPES) {
        for (const m of meshes[t]) {
          m.count = counts[t];
          m.visible = counts[t] > 0;
          if (m.visible) m.instanceMatrix.needsUpdate = true;
        }
      }
    },

    /** Move the collider pool onto the cars nearest `p`. */
    collide(trains, p) {
      let i = 0;
      for (const tr of trains) {
        if (Math.abs(tr.z - p.z) > 12) continue;
        for (const car of tr.cars) {
          if (i >= POOL) break;
          const x = carX(tr, car);
          if (Math.abs(x - p.x) > NEAR || Math.abs(x) > REACH) continue;
          const c = pool[i++];
          const [hw, top] = BODY[car.type];
          c.cx = x;
          c.cz = tr.z;
          c.hx = car.len / 2 - 0.25;
          c.hz = hw;
          c.top = top;
          c.train = tr;
        }
      }
      for (; i < POOL; i++) { pool[i].cx = FAR; pool[i].cz = FAR; pool[i].train = null; }
    },

    carX,
  };
}
