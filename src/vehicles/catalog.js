import * as THREE from 'three';
import { Batch } from '../core/batch.js';
import { MAT } from '../core/toon.js';
import { PAL } from '../core/palette.js';
import { rngKit } from '../core/util.js';

/* ------------------------------------------------------------------ *
 * Vehicle catalogue.
 *
 * `buildVehicle(type, opts)` returns a VehicleModel. Every model obeys
 * the same contract, which is all the traffic, transit and driving code
 * ever looks at:
 *
 *   group        THREE.Group; origin on the ground at the centre of the
 *                footprint; the FRONT faces local -z; the driver's right
 *                (the kerb side, where bus doors are) is local +x
 *   type, kind   catalogue key, and 'car' | 'bus' | 'marshrutka' | 'truck'
 *   length, width, height, wheelbase, wheelRadius   metres
 *   wheels       Object3D[]: spin about local x (rotation.x = -angle)
 *   steer        Object3D[]: front wheel pivots, rotation.y = steer angle
 *   brake        Object3D | null: brake lights, toggle .visible
 *   blink        { left, right } | null: indicator lamps, toggle .visible
 *   doors        [{ set(t) }] t = 0 closed .. 1 open (buses, marshrutkas)
 *   doorPos      [{ x, z }] local points outside each passenger door
 *   driverEye    { x, y, z } local, for first-person driving
 *   seats        [{ x, y, z, yaw }] local passenger eye points
 *   engine       'petrol' | 'diesel' | 'bus'
 *   routeBoard   function(text) | null: paint the route number sign
 *
 * This file currently holds placeholder boxes with the right sizes. The
 * real models live in their own files and are registered in TYPES.
 * ------------------------------------------------------------------ */

const PLACEHOLDER = {
  car: { length: 4.1, width: 1.62, height: 1.44, wheelbase: 2.42, r: 0.3, kind: 'car', engine: 'petrol' },
  bus: { length: 11.4, width: 2.5, height: 3.05, wheelbase: 5.4, r: 0.5, kind: 'bus', engine: 'bus' },
  marshrutka: { length: 5.5, width: 2.07, height: 2.2, wheelbase: 2.9, r: 0.35, kind: 'marshrutka', engine: 'petrol' },
  paz: { length: 7.0, width: 2.44, height: 2.95, wheelbase: 3.6, r: 0.45, kind: 'bus', engine: 'petrol' },
};

function placeholder(spec, { color = 0xb03a2e, seed = 1 } = {}) {
  const g = new THREE.Group();
  const b = new Batch({ cell: 1e6 });
  const { length: L, width: W, height: H } = spec;
  b.box(W, H * 0.5, L, color, 0, spec.r * 0.9, 0);
  b.box(W * 0.94, H * 0.42, L * (spec.kind === 'car' ? 0.5 : 0.92), color, 0, spec.r * 0.9 + H * 0.5, spec.kind === 'car' ? 0.2 : 0.1);
  b.box(W * 0.95, H * 0.3, L * (spec.kind === 'car' ? 0.46 : 0.9), PAL.glassTint, 0, spec.r * 0.9 + H * 0.55, spec.kind === 'car' ? 0.2 : 0.1, { mat: 'glass' });
  b.flush(g);
  const wheels = [];
  const steer = [];
  const wgeo = new THREE.CylinderGeometry(spec.r, spec.r, 0.22, 12);
  wgeo.rotateZ(Math.PI / 2);
  const wmat = MAT.solid;
  const tyre = new THREE.Color(0x222222);
  const cols = new Float32Array(wgeo.attributes.position.count * 3).map((_, i) => [tyre.r, tyre.g, tyre.b][i % 3]);
  wgeo.setAttribute('color', new THREE.BufferAttribute(cols, 3));
  for (const [x, z, front] of [[-W / 2 + 0.12, -spec.wheelbase / 2, true], [W / 2 - 0.12, -spec.wheelbase / 2, true], [-W / 2 + 0.12, spec.wheelbase / 2, false], [W / 2 - 0.12, spec.wheelbase / 2, false]]) {
    const pivot = new THREE.Group();
    pivot.position.set(x, spec.r, z);
    const w = new THREE.Mesh(wgeo, wmat);
    w.castShadow = true;
    pivot.add(w);
    g.add(pivot);
    wheels.push(w);
    if (front) steer.push(pivot);
  }
  const brake = new THREE.Mesh(new THREE.BoxGeometry(W * 0.9, 0.12, 0.05), new THREE.MeshBasicMaterial({ color: 0xff3020 }));
  brake.position.set(0, spec.r * 0.9 + H * 0.35, L / 2 + 0.03);
  brake.visible = false;
  g.add(brake);
  const blinkL = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.1, 0.05), new THREE.MeshBasicMaterial({ color: 0xffa020 }));
  blinkL.position.set(-W / 2 + 0.1, spec.r * 0.9 + H * 0.3, -L / 2 - 0.03);
  const blinkR = blinkL.clone();
  blinkR.position.x = W / 2 - 0.1;
  blinkL.visible = blinkR.visible = false;
  g.add(blinkL, blinkR);
  g.traverse((o) => { if (o.isMesh && o !== brake) o.castShadow = true; });
  const doors = spec.kind === 'car' ? [] : [{ set() {} }];
  const doorPos = spec.kind === 'car' ? [] : [{ x: W / 2 + 0.6, z: -L / 2 + 1.2 }];
  return {
    group: g, type: spec.kind, kind: spec.kind,
    length: L, width: W, height: H, wheelbase: spec.wheelbase, wheelRadius: spec.r,
    wheels, steer, brake, blink: { left: blinkL, right: blinkR },
    doors, doorPos,
    driverEye: { x: -0.35, y: 1.12, z: 0.1 },
    seats: spec.kind === 'car' ? [] : [{ x: 0.5, y: 1.9, z: 0, yaw: 0 }],
    engine: spec.engine,
    routeBoard: null,
    seed,
  };
}

/**
 * Types available to traffic. `weight` is the share of ordinary traffic
 * (0 = never spawned as random traffic; route vehicles use `kind`).
 */
export const TYPES = {
  car: { weight: 10, build: (o) => placeholder(PLACEHOLDER.car, o) },
  bus: { weight: 0, build: (o) => placeholder(PLACEHOLDER.bus, o) },
  paz: { weight: 0, build: (o) => placeholder(PLACEHOLDER.paz, o) },
  marshrutka: { weight: 0, build: (o) => placeholder(PLACEHOLDER.marshrutka, o) },
};

/** Which catalogue type serves a route of a given kind. */
export const ROUTE_TYPES = { bus: ['bus'], paz: ['paz'], marshrutka: ['marshrutka'] };

/** Types that may stand parked in yards and on kerbs. */
export const PARKED_TYPES = ['car'];

/** Pick a random traffic type by weight. */
export function randomType(rng) {
  return rng.weighted(Object.entries(TYPES).filter(([, t]) => t.weight > 0).map(([k, t]) => [k, t.weight]));
}

/** Paint colour for a private car of that era, by weight. */
export function randomCarColor(rng) {
  return rng.weighted([
    [0xe8e4d8, 8], [0xb8b6ae, 5], [0x8a1f24, 4], [0x2d4a6e, 3], [0x1f5a3a, 2],
    [0xc9b27a, 2], [0x6e2a4a, 2], [0x2a2a2c, 3], [0x7fa0b8, 2], [0xd8c65a, 1],
  ]);
}

export function buildVehicle(type, opts = {}) {
  const t = TYPES[type] || TYPES.car;
  const rng = rngKit(opts.seed ?? 1);
  const m = t.build({ color: opts.color ?? randomCarColor(rng), ...opts });
  m.type = type;
  return m;
}
