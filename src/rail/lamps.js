import * as THREE from 'three';

/* ------------------------------------------------------------------ *
 * Every lit lens on the railway (signal aspects, crossing lights) in
 * one instanced mesh, so blinking costs one draw call. Lenses are flat
 * discs; `yaw` uses the project convention (0 looks north).
 * ------------------------------------------------------------------ */

export const LAMP = {
  off: 0x2a2624,
  red: 0xff3a24,
  redDim: 0x4a1612,
  yellow: 0xffc23a,
  green: 0x4dffa0,
  white: 0xf4f0ff,
};

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3();
const _c = new THREE.Color();

export function createLamps(parent, capacity = 64) {
  const mesh = new THREE.InstancedMesh(
    new THREE.CircleGeometry(1, 14),
    new THREE.MeshBasicMaterial({ color: 0xffffff }),
    capacity,
  );
  mesh.name = 'rail-lamps';
  mesh.count = 0;
  mesh.frustumCulled = false;
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  parent.add(mesh);
  const state = [];

  return {
    mesh,
    /** Add a lens and return its index. */
    add(x, y, z, yaw, r = 0.13) {
      const i = mesh.count;
      if (i >= capacity) throw new Error('rail lamps: capacity exceeded');
      _e.set(0, yaw + Math.PI, 0);
      _q.setFromEuler(_e);
      _m.compose(_p.set(x, y, z), _q, _s.set(r, r, r));
      mesh.setMatrixAt(i, _m);
      mesh.setColorAt(i, _c.set(LAMP.off));
      mesh.count = i + 1;
      state.push(LAMP.off);
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      return i;
    },
    set(i, color) {
      if (state[i] === color) return;
      state[i] = color;
      mesh.setColorAt(i, _c.set(color));
      mesh.instanceColor.needsUpdate = true;
    },
  };
}
