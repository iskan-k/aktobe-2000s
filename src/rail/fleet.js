import * as THREE from 'three';
import { bakeType, CAR_TYPES, BODY } from './rolling.js';
import { RAIL_Y, REACH } from './layout.js';
import { attachDecalRows, serviceRow, numberRow, WIDE, LOCO_NUMBERS } from './decals.js';

/* ------------------------------------------------------------------ *
 * Drawing and bumping into trains.
 *
 * Each car type is baked once and drawn as one InstancedMesh per
 * material, so a fifty-wagon freight costs a handful of draw calls.
 * The lettering mesh of a type carries per-instance atlas rows, so each
 * coach shows its own service and number and each loco its own plate.
 * Cars beyond LOD metres use a coarse bake of their type (rolling.js),
 * and cars past the portals or more than HIDE metres away are skipped. A small pool of box colliders follows the cars nearest the
 * player, so you cannot walk or drive through a train.
 * ------------------------------------------------------------------ */

const CAPACITY = {
  loco_green: 6, loco_blue: 6, coach_grey: 16, coach_green: 16,
  gondola: 52, tank: 52, hopper: 52, boxcar: 52,
};
const HIDE = 450;
const LOD = 90;
const POOL = 40;
const NEAR = 70;
const FAR = 1e7;

const _m = new THREE.Matrix4();

export function createFleet(game, parent) {
  const meshes = { near: {}, far: {} };
  const counts = { near: {}, far: {} };
  const rows = {};
  for (const type of CAR_TYPES) {
    for (const lod of ['near', 'far']) {
      const baked = bakeType(type, lod === 'far');
      meshes[lod][type] = baked.parts.map((p) => {
        const m = new THREE.InstancedMesh(p.geometry, p.material, CAPACITY[type]);
        if (p.decal) rows[type] = attachDecalRows(m, CAPACITY[type]);
        m.name = `train-${type}-${lod}`;
        m.count = 0;
        m.visible = false;
        m.frustumCulled = false;
        m.castShadow = true;
        m.receiveShadow = true;
        parent.add(m);
        return m;
      });
      counts[lod][type] = 0;
    }
  }

  const pool = Array.from({ length: POOL }, () => {
    const c = { kind: 'obb', cx: FAR, cz: FAR, hx: 1, hz: 1, cos: 1, sin: 0, top: 5, bottom: -1, train: null };
    game.world.dynamic.push(c);
    return c;
  });

  /** World x of a car's centre. */
  const carX = (tr, car) => tr.head - tr.dir * car.off;

  /** A train's lettering, worked out once: its board row and loco plate. */
  function lettering(tr) {
    if (!tr.lettering) {
      const seed = Math.abs(Math.round(tr.vMax * 1000));
      tr.lettering = { board: serviceRow(tr.name), plate: WIDE.loco0 + (seed % LOCO_NUMBERS.length) };
    }
    return tr.lettering;
  }

  return {
    /** Lay out every car of every train for this frame. */
    draw(trains, cam) {
      for (const t of CAR_TYPES) { counts.near[t] = 0; counts.far[t] = 0; }
      for (const tr of trains) {
        const yaw = tr.dir > 0 ? -Math.PI / 2 : Math.PI / 2;
        const lt = lettering(tr);
        let coachNo = 0;
        for (const car of tr.cars) {
          const isCoach = car.type.startsWith('coach');
          if (isCoach) coachNo++;
          const x = carX(tr, car);
          if (Math.abs(x) > REACH + car.len / 2) continue;
          const d = Math.hypot(x - cam.x, tr.z - cam.z);
          if (d > HIDE) continue;
          const lod = d - car.len / 2 < LOD ? 'near' : 'far';
          const n = counts[lod][car.type];
          if (n >= CAPACITY[car.type]) continue;
          _m.makeRotationY(yaw + (car.flip ? Math.PI : 0));
          _m.setPosition(x, RAIL_Y, tr.z);
          for (const m of meshes[lod][car.type]) m.setMatrixAt(n, _m);
          const r = lod === 'near' && rows[car.type];
          if (r) r.setXY(n, isCoach ? lt.board : lt.plate, isCoach ? numberRow(coachNo) : 0);
          counts[lod][car.type] = n + 1;
        }
      }
      for (const lod of ['near', 'far']) {
        for (const t of CAR_TYPES) {
          for (const m of meshes[lod][t]) {
            m.count = counts[lod][t];
            m.visible = counts[lod][t] > 0;
            if (m.visible) m.instanceMatrix.needsUpdate = true;
          }
        }
      }
      for (const t of CAR_TYPES) if (rows[t] && counts.near[t]) rows[t].needsUpdate = true;
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
