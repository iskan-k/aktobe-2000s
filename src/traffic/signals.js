import * as THREE from 'three';
import { PAL } from '../core/palette.js';
import { cel } from '../core/toon.js';
import { KERB_H, halfWidth } from '../world/plan.js';
import { Batch } from '../core/batch.js';

/* ------------------------------------------------------------------ *
 * Traffic lights at the signalled junctions.
 *
 * Cycle: the avenue (east-west arms) gets the long green, the side
 * street the short one, with amber and a short all-red between. Before
 * green comes red plus amber together, as on every Soviet-built signal.
 * The last three seconds of green blink, which is also how they were
 * set up in Kazakhstan.
 *
 * Each approach arm has a three-lamp head on a pole at the right-hand
 * corner, facing the traffic that has to obey it, and a two-lamp
 * pedestrian head on the same pole facing across the street.
 * ------------------------------------------------------------------ */

const PHASES = [
  // [E-W state, N-S state, seconds]
  ['G', 'R', 22],
  ['g', 'R', 3],     // blinking green
  ['Y', 'R', 3],
  ['R', 'R', 1.5],
  ['R', 'RY', 1.5],
  ['R', 'G', 13],
  ['R', 'g', 3],
  ['R', 'Y', 3],
  ['R', 'R', 1.5],
  ['RY', 'R', 1.5],
];
const CYCLE = PHASES.reduce((s, p) => s + p[2], 0);

const LAMP_ON = { R: new THREE.Color(0xff3b2a), Y: new THREE.Color(0xffb52a), G: new THREE.Color(0x3dff9a) };
const LAMP_OFF = { R: new THREE.Color(0x3a1714), Y: new THREE.Color(0x3a2a10), G: new THREE.Color(0x0f2d20) };

/** Placeholder for a lens: the mesh is tagged and later becomes an instance. */
function lampMat() {
  const m = new THREE.MeshBasicMaterial({ color: 0x222222 });
  m.userData.lens = true;
  return m;
}

/** Build one signal head on a pole; returns the lamp materials. */
function signalPole(root, x, z, yaw, pedYaw) {
  const g = new THREE.Group();
  g.position.set(x, KERB_H, z);
  root.add(g);
  const body = cel({ color: PAL.metalDark });
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.08, 3.6, 8), cel({ color: 0x5b6166 }));
  pole.position.y = 1.8;
  pole.castShadow = true;
  g.add(pole);
  // stripes on the pole: black and white, like the kerbs
  const band = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.085, 0.25, 8), cel({ color: PAL.whitewash }));
  band.position.y = 0.5;
  g.add(band);

  const head = new THREE.Group();
  head.position.y = 3.05;
  head.rotation.y = yaw;
  g.add(head);
  const box = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.98, 0.26), body);
  box.castShadow = true;
  head.add(box);
  const lamps = {};
  ['R', 'Y', 'G'].forEach((k, i) => {
    const m = lampMat();
    const lens = new THREE.Mesh(new THREE.CircleGeometry(0.11, 16), m);
    lens.position.set(0, 0.3 - i * 0.3, -0.135);
    lens.rotation.y = Math.PI;
    head.add(lens);
    // visor over each lamp
    const visor = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.14, 12, 1, true, -Math.PI / 2, Math.PI), body);
    visor.rotation.x = Math.PI / 2;
    visor.position.set(0, 0.3 - i * 0.3 + 0.02, -0.2);
    head.add(visor);
    lamps[k] = m;
  });
  // back plate with the white border every Soviet signal had
  const plate = new THREE.Mesh(new THREE.BoxGeometry(0.56, 1.22, 0.02), cel({ color: 0x1d1f21 }));
  plate.position.z = 0.14;
  head.add(plate);

  // pedestrian head
  const ped = new THREE.Group();
  ped.position.y = 2.3;
  ped.rotation.y = pedYaw;
  g.add(ped);
  const pbox = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.6, 0.2), body);
  ped.add(pbox);
  const pl = {};
  ['R', 'G'].forEach((k, i) => {
    const m = lampMat();
    const lens = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.22), m);
    lens.position.set(0, 0.14 - i * 0.28, -0.105);
    lens.rotation.y = Math.PI;
    ped.add(lens);
    pl[k] = m;
  });
  return { lamps, ped: pl };
}

/** A bare three-lamp head, lens toward local -z, hanging from its top. */
function hangingHead(parent, x, y, z, yaw) {
  const head = new THREE.Group();
  head.position.set(x, y, z);
  head.rotation.y = yaw;
  parent.add(head);
  const body = cel({ color: PAL.metalDark });
  const box = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.98, 0.26), body);
  box.position.y = -0.62;
  box.castShadow = true;
  head.add(box);
  const hanger = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.14, 0.06), body);
  hanger.position.y = -0.07;
  head.add(hanger);
  const lamps = {};
  ['R', 'Y', 'G'].forEach((k, i) => {
    const m = lampMat();
    const lens = new THREE.Mesh(new THREE.CircleGeometry(0.11, 16), m);
    lens.position.set(0, -0.32 - i * 0.3, -0.135);
    lens.rotation.y = Math.PI;
    head.add(lens);
    lamps[k] = m;
  });
  const plate = new THREE.Mesh(new THREE.BoxGeometry(0.56, 1.22, 0.02), cel({ color: 0x1d1f21 }));
  plate.position.set(0, -0.62, 0.14);
  head.add(plate);
  return lamps;
}

/**
 * White box-truss gantry right across the avenue at an approach's stop
 * line, as at the big Aktobe junctions, with a head over each lane of
 * the approaching direction. Returns the lamp sets.
 */
function gantry(root, j, arm) {
  const r = j.rx;
  const hw = halfWidth(r);
  const sgn = arm === 'W' ? -1 : 1;
  const x = j.x + sgn * (j.hx + 5.9);
  const z0 = r.c - hw - 0.7, z1 = r.c + hw + 0.7;
  const H = 6.4;
  const white = 0xe9e7e0;
  const b = new Batch({ cell: 1e6, name: 'gantry' });
  for (const z of [z0, z1]) {
    b.cyl(0.2, 0.35, 0x3b3a39, x, KERB_H, z, { seg: 10 });
    b.cyl(0.16, H + 0.4, white, x, KERB_H, z, { seg: 10 });
  }
  // box truss: four chords and zig-zag webs on the two long faces
  const ty = KERB_H + H, d = 0.5;
  for (const [dy, dx] of [[0, -d / 2], [0, d / 2], [d, -d / 2], [d, d / 2]]) {
    b.tube(x + dx, ty + dy, z0, x + dx, ty + dy, z1, 0.035, white, { seg: 5 });
  }
  const n = Math.round((z1 - z0) / 0.9);
  for (let i = 0; i < n; i++) {
    const za = z0 + ((z1 - z0) * i) / n, zb = z0 + ((z1 - z0) * (i + 1)) / n;
    for (const dx of [-d / 2, d / 2]) b.tube(x + dx, ty + (i % 2 ? d : 0), za, x + dx, ty + (i % 2 ? 0 : d), zb, 0.02, white, { seg: 4 });
    b.tube(x - d / 2, ty + d, za, x + d / 2, ty + d, za, 0.018, white, { seg: 4 });
  }
  b.flush(root);
  // heads over the approaching lanes; traffic from W drives east on the south half
  const heads = [];
  const yaw = arm === 'W' ? Math.PI / 2 : -Math.PI / 2;
  const across = arm === 'W' ? 1 : -1;
  for (let i = 0; i < r.lanes; i++) {
    const zc = r.c + across * (hw - (i + 0.5) * r.laneW);
    heads.push(hangingHead(root, x, ty, zc, yaw));
  }
  return heads;
}

export function buildSignals(net, root) {
  const junctions = new Map();
  const signalled = new Set(net.connectors.filter((c) => c.junction.signal).map((c) => c.junction));
  for (const j of signalled) {
    const heads = [];
    // Approaching from the W arm means driving east, so the pole stands on
    // the right-hand (south-west) corner and the lens faces west, toward
    // the driver. The pedestrian head faces across the same arm.
    const off = 1.2;
    const corners = {
      W: { x: j.x - j.hx - off, z: j.z + j.hz + off, yaw: Math.PI / 2, ped: 0 },
      E: { x: j.x + j.hx + off, z: j.z - j.hz - off, yaw: -Math.PI / 2, ped: Math.PI },
      N: { x: j.x - j.hx - off, z: j.z - j.hz - off, yaw: 0, ped: -Math.PI / 2 },
      S: { x: j.x + j.hx + off, z: j.z + j.hz + off, yaw: Math.PI, ped: Math.PI / 2 },
    };
    for (const arm of ['W', 'E', 'N', 'S']) {
      if (!j.arms[arm]) continue;
      const c = corners[arm];
      const h = signalPole(root, c.x, c.z, c.yaw, c.ped);
      heads.push({ arm, ...h });
      if ((arm === 'W' || arm === 'E') && j.rx.major) {
        for (const lamps of gantry(root, j, arm)) heads.push({ arm, lamps, ped: null });
      }
    }
    junctions.set(j, { j, heads, t: (j.x * 0.37) % CYCLE });
  }

  /* Bake: static parts into one batch, every lens into one of two
   * instanced meshes whose per-instance colour the update loop sets. */
  root.updateMatrixWorld(true);
  const staticBatch = new Batch({ cell: 1e6, name: 'signals' });
  const circles = [], plates = [];
  const lensSlot = new Map();   // material -> { mesh, index }
  const drop = [];
  root.traverse((o) => {
    if (!o.isMesh || o.userData.baked || o.isInstancedMesh) return;
    if (o.name === 'gantry' || o.name === 'signals') return;
    if (o.material.userData.lens) {
      (o.geometry.type === 'CircleGeometry' ? circles : plates).push(o);
    } else {
      staticBatch.add(o.geometry, { color: null, matrix: o.matrixWorld, mat: o.material, cast: o.castShadow });
    }
    drop.push(o);
  });
  for (const o of drop) o.parent.remove(o);
  staticBatch.flush(root);
  for (const [list, geo] of [[circles, new THREE.CircleGeometry(0.11, 16)], [plates, new THREE.PlaneGeometry(0.2, 0.22)]]) {
    if (!list.length) continue;
    const im = new THREE.InstancedMesh(geo, new THREE.MeshBasicMaterial({ color: 0xffffff }), list.length);
    list.forEach((o, i) => {
      im.setMatrixAt(i, o.matrixWorld);
      im.setColorAt(i, LAMP_OFF.R);
      lensSlot.set(o.material, { mesh: im, index: i });
    });
    im.frustumCulled = false;
    root.add(im);
  }
  const setLamp = (mat, color) => {
    const slot = lensSlot.get(mat);
    if (slot) { slot.mesh.setColorAt(slot.index, color); slot.mesh.instanceColor.needsUpdate = true; }
  };

  function phaseOf(state) {
    let t = state.t % CYCLE;
    for (const p of PHASES) {
      if (t < p[2]) return { ew: p[0], ns: p[1], left: p[2] - t, dur: p[2] };
      t -= p[2];
    }
    return { ew: 'R', ns: 'R', left: 1, dur: 1 };
  }

  let blink = 0;
  return {
    junctions,
    /** Light shown to traffic entering from `arm`: 'G' | 'Y' | 'R' (blinking green reads as G). */
    stateFor(j, arm) {
      const s = junctions.get(j);
      if (!s) return 'G';
      const p = phaseOf(s);
      const v = arm === 'W' || arm === 'E' ? p.ew : p.ns;
      if (v === 'g') return 'G';
      if (v === 'RY') return 'R';
      return v;
    },
    update(dt) {
      blink += dt;
      const on = Math.floor(blink * 2) % 2 === 0;
      for (const s of junctions.values()) {
        s.t += dt;
        const p = phaseOf(s);
        for (const h of s.heads) {
          const v = h.arm === 'W' || h.arm === 'E' ? p.ew : p.ns;
          const r = v === 'R' || v === 'RY';
          const y = v === 'Y' || v === 'RY';
          const gr = v === 'G' || (v === 'g' && on);
          setLamp(h.lamps.R, r ? LAMP_ON.R : LAMP_OFF.R);
          setLamp(h.lamps.Y, y ? LAMP_ON.Y : LAMP_OFF.Y);
          setLamp(h.lamps.G, gr ? LAMP_ON.G : LAMP_OFF.G);
          // the pedestrian head faces people crossing this same arm, so
          // they may walk exactly when this arm's traffic has plain red
          if (!h.ped) continue;
          const walk = v === 'R';
          setLamp(h.ped.R, walk ? LAMP_OFF.R : LAMP_ON.R);
          setLamp(h.ped.G, walk ? LAMP_ON.G : LAMP_OFF.G);
        }
      }
    },
  };
}
