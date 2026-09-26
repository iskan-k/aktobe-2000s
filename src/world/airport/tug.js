import * as THREE from 'three';
import { clamp, wrapAngle } from '../../core/util.js';
import { makeTug } from './gse.js';
import { TUG_PARK, FENCE, TAXILANE_Z } from './layout.js';

/* ------------------------------------------------------------------ *
 * The pushback tug: it waits at its stand by the terminal, drives out
 * along the service road in front of the noses when a departure is
 * boarded, hooks on, pushes the aircraft back, and once released pulls
 * off to the side into the stand just vacated and home again.
 * ------------------------------------------------------------------ */

const ROAD_Z = FENCE.z + 5;
const _f = new THREE.Vector3(), _e = new THREE.Euler();

/** Where a tug hooks on to an aircraft: ahead of its nose gear, facing it. */
function hookOf(aircraft) {
  const g = aircraft.group;
  _f.set(0, 0, -(aircraft.type.nose + 3.2)).applyEuler(_e.set(0, g.rotation.y, 0));
  return { x: g.position.x + _f.x, z: g.position.z + _f.z, yaw: wrapAngle(g.rotation.y + Math.PI) };
}

export function createTug(root) {
  const group = makeTug();
  root.add(group);
  const s = { mode: 'park', x: TUG_PARK.x, z: TUG_PARK.z, yaw: TUG_PARK.yaw, path: [], aircraft: null };

  /** Drive along the waypoints; true once the last one is reached. */
  function drive(dt) {
    while (s.path.length) {
      const [tx, tz] = s.path[0];
      const dx = tx - s.x, dz = tz - s.z;
      const d = Math.hypot(dx, dz);
      if (d < 0.4) { s.path.shift(); continue; }
      const err = wrapAngle(Math.atan2(-dx, -dz) - s.yaw);
      s.yaw = wrapAngle(s.yaw + clamp(err, -1.3 * dt, 1.3 * dt));
      const v = Math.min(5, d + 0.5) * (Math.abs(err) < 0.5 ? 1 : 0.25);
      s.x -= Math.sin(s.yaw) * v * dt;
      s.z -= Math.cos(s.yaw) * v * dt;
      return false;
    }
    return true;
  }

  return {
    get attached() { return s.mode === 'attached'; },
    /** Go and hook on to `aircraft`. */
    fetch(aircraft) {
      const h = hookOf(aircraft);
      Object.assign(s, { mode: 'fetch', aircraft, path: [[s.x, ROAD_Z], [h.x, ROAD_Z], [h.x, h.z]] });
    },
    /** Unhook and go home. */
    release() {
      Object.assign(s, {
        mode: 'leave', aircraft: null,
        path: [[s.x, TAXILANE_Z - 50], [s.x, ROAD_Z], [TUG_PARK.x, ROAD_Z], [TUG_PARK.x, TUG_PARK.z]],
      });
    },
    /** Back on its stand at once (dev). */
    reset() { Object.assign(s, { mode: 'park', x: TUG_PARK.x, z: TUG_PARK.z, yaw: TUG_PARK.yaw, path: [], aircraft: null }); },
    update(dt) {
      if (s.mode === 'attached') Object.assign(s, hookOf(s.aircraft));
      else if (s.mode === 'fetch' && drive(dt)) { s.mode = 'attached'; Object.assign(s, hookOf(s.aircraft)); }
      else if (s.mode === 'leave' && drive(dt)) { s.mode = 'park'; s.yaw = TUG_PARK.yaw; }
      group.position.set(s.x, 0, s.z);
      group.rotation.y = s.yaw;
    },
  };
}
