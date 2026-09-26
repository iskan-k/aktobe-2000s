import * as THREE from 'three';
import { cel } from '../../../core/toon.js';
import { damp } from '../../../core/util.js';

/* ------------------------------------------------------------------ *
 * The herd: every animal of a species in one BatchedMesh, so the whole
 * species is a single multi-draw (and one more for its shadows). Each
 * body part (torso, head, ear, tail, the leg segments) is a geometry in
 * the batch; each animal adds one instance per part, two for ears and
 * legs. An animal is a little rig: joints damp toward the targets its
 * behaviour sets, and the pose function turns joints into matrices.
 *
 * Coats live in a small float texture, four texels per instance: main,
 * light and dark colours and a mask that switches the markings painted
 * into the vertices (see geo.js) on or off. So a white-chested black dog
 * and a plain ginger one share every geometry.
 *
 * Animals beyond the species' view distance are hidden and not posed;
 * the batch culls the rest against the frustum part by part. Near the
 * camera they are posed every frame, further out a few times a second.
 * `?nofauna` in the URL hides them all, to measure what they cost.
 * ------------------------------------------------------------------ */

const NEAR = 28;
const MID = 70;
const RECHECK = 0.5;     // seconds between view-distance checks

/** Cel material with the per-instance coat lookup patched in. */
function furMaterial(coatTex) {
  const mat = cel({ vertexColors: true, cache: false, grime: 0.025, dirt: 0.12, dirtH: 0.4, bands: 4 });
  const base = mat.onBeforeCompile;
  mat.onBeforeCompile = (shader, renderer) => {
    base(shader, renderer);
    shader.uniforms.coatTex = { value: coatTex };
    shader.vertexShader = shader.vertexShader
      .replace('#include <color_pars_vertex>', `#include <color_pars_vertex>
        attribute vec4 fur;
        attribute float fixedTone;
        uniform highp sampler2D coatTex;`)
      .replace('#include <color_vertex>', `#include <color_vertex>
        #ifdef USE_BATCHING
        {
          int row = int( getIndirectIndex( gl_DrawID ) );
          vec3 iMain = texelFetch( coatTex, ivec2( 0, row ), 0 ).rgb;
          vec3 iLight = texelFetch( coatTex, ivec2( 1, row ), 0 ).rgb;
          vec3 iDark = texelFetch( coatTex, ivec2( 2, row ), 0 ).rgb;
          vec4 iMask = texelFetch( coatTex, ivec2( 3, row ), 0 );
          // white markings win over dark points: a bay keeps its socks
          float lightK = clamp( dot( fur.xyz, iMask.xyz ), 0.0, 1.0 );
          vec3 coatC = mix( iMain, iLight, lightK );
          coatC = mix( coatC, iDark, clamp( fur.w * iMask.w, 0.0, 1.0 ) * ( 1.0 - lightK ) );
          vColor.rgb = mix( coatC * color.rgb, color.rgb, fixedTone );
        }
        #endif`);
  };
  mat.customProgramCacheKey = () => 'fur2';
  return mat;
}

// keyed by the world root: some districts hand their builders a spread copy of ctx
const HERDS = new WeakMap();

/**
 * The herd for `species` in this world build. A species is
 *   { name, view, parts: { name: { geo: () => BufferGeometry, mult = 1 } },
 *     step(animal, dt, game, dist), pose(animal, write) }
 * `view` is the distance (m) beyond which it is not drawn; an animal may
 * carry its own `view`.
 */
export function herdFor(ctx, species) {
  let all = HERDS.get(ctx.root);
  if (!all) {
    all = new Map();
    HERDS.set(ctx.root, all);
    ctx.update((dt, game) => { for (const h of all.values()) h.update(dt, game); });
  }
  if (!all.has(species.name)) all.set(species.name, new Herd(ctx, species));
  return all.get(species.name);
}

const _c = new THREE.Color();
const _m = new THREE.Matrix4();

class Herd {
  constructor(ctx, species) {
    this.root = ctx.root;
    this.species = species;
    this.view = species.view || 120;
    this.parts = {};
    for (const [name, p] of Object.entries(species.parts)) {
      this.parts[name] = { name, mult: p.mult || 1, geoFn: p.geo, geo: null, id: -1 };
    }
    this.animals = [];
    this.mesh = null;
    this.dirty = true;
    this.checkT = 0;
    this.visible = [];
  }

  /**
   * Register an animal. `a.uses` lists its part names; `a.coat` is
   * { main, light, dark, mask: [x, y, z, w] }. Returns the animal.
   */
  add(a) {
    a.slots = {};
    a.acc = 0;
    a.posed = false;
    a.shown = false;
    this.animals.push(a);
    this.dirty = true;
    return a;
  }

  /** The batch: every part geometry once, an instance per part per animal. */
  build() {
    if (this.mesh) { this.root.remove(this.mesh); this.mesh.dispose(); }
    const used = Object.values(this.parts).filter((p) => this.animals.some((a) => a.uses.includes(p.name)));
    for (const p of used) p.geo = p.geo || p.geoFn();
    let instances = 0;
    for (const a of this.animals) for (const n of a.uses) instances += this.parts[n].mult;
    const verts = used.reduce((s, p) => s + p.geo.attributes.position.count, 0);
    const coat = new Float32Array(4 * 4 * instances);
    this.coatTex = new THREE.DataTexture(coat, 4, instances, THREE.RGBAFormat, THREE.FloatType);
    this.coatTex.needsUpdate = true;
    const mesh = new THREE.BatchedMesh(instances, verts, 0, furMaterial(this.coatTex));
    mesh.name = this.species.name;
    mesh.userData.herd = this;     // for the dev console: where is every cat?
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    // parts move every frame: cull each against the frustum, never the whole batch
    mesh.frustumCulled = false;
    for (const p of used) p.id = mesh.addGeometry(p.geo);
    for (const a of this.animals) {
      a.slots = {};
      for (const n of a.uses) {
        const p = this.parts[n];
        for (let k = 0; k < p.mult; k++) {
          const i = mesh.addInstance(p.id);
          if (k === 0) a.slots[n] = i;
          _c.set(a.coat.main).toArray(coat, i * 16);
          _c.set(a.coat.light).toArray(coat, i * 16 + 4);
          _c.set(a.coat.dark).toArray(coat, i * 16 + 8);
          coat.set(a.coat.mask, i * 16 + 12);
          mesh.setVisibleAt(i, false);
        }
      }
      a.shown = false;
      a.posed = false;
    }
    this.root.add(mesh);
    this.mesh = mesh;
    this.dirty = false;
    this.checkT = 0;
  }

  show(a, on) {
    if (a.shown === on) return;
    a.shown = on;
    for (const n of a.uses) {
      for (let k = 0; k < this.parts[n].mult; k++) this.mesh.setVisibleAt(a.slots[n] + k, on);
    }
    if (on) a.posed = false;
  }

  update(dt, game) {
    if (this.dirty) this.build();
    const cam = game.camera.position;
    this.checkT -= dt;
    if (this.checkT <= 0) {
      this.checkT = RECHECK;
      const hideAll = typeof location !== 'undefined' && location.search.includes('nofauna');
      this.visible = [];
      for (const a of this.animals) {
        const on = !hideAll && Math.hypot(cam.x - a.x, cam.z - a.z) < (a.view || this.view);
        this.show(a, on);
        if (on) this.visible.push(a);
      }
    }
    for (const a of this.visible) {
      const d = Math.hypot(cam.x - a.x, cam.z - a.z);
      a.acc += dt;
      const every = d < NEAR ? 0 : d < MID ? 0.12 : 0.5;
      if (a.posed && a.acc < every) continue;
      // an animal that has been out of sight catches up in one bounded step
      this.species.step(a, Math.min(a.acc, 1), game, d);
      this.species.pose(a, (name, k, m) => this.write(a, name, k, m));
      a.acc = 0;
      a.posed = true;
    }
  }

  write(a, name, k, m) {
    const base = a.slots[name];
    if (base === undefined) return;
    this.mesh.setMatrixAt(base + k, m);
  }
}

/* ------------------------------------------------------------------ rig helpers */

const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3();

/** out = parent x T(x, y, z) x R(rx, ry, rz in YXZ order) x S(s). */
export function joint(out, parent, x, y, z, rx = 0, ry = 0, rz = 0, s = 1) {
  _e.set(rx, ry, rz, 'YXZ');
  _q.setFromEuler(_e);
  _p.set(x, y, z);
  _s.set(s, s, s);
  out.compose(_p, _q, _s);
  if (parent) out.premultiply(parent);
  return out;
}

/** out = m x S(sx, sy, sz): for breathing, without passing it to children. */
export function scaled(out, m, sx, sy, sz) {
  _m.makeScale(sx, sy, sz);
  return out.multiplyMatrices(m, _m);
}

/** Damp every joint in `j` toward `t` at `rate`. */
export function settle(j, t, rate, dt) {
  for (const k in t) j[k] = damp(j[k] ?? t[k], t[k], rate, dt);
}

/** Shortest signed angle from a to b. */
export function angleTo(a, b) {
  return Math.atan2(Math.sin(b - a), Math.cos(b - a));
}

/** Where the walker is (or the camera, when driving or riding). */
export function watcher(game) {
  return game.controller ? game.camera.position : game.player.pos;
}

/** The direction (yaw, radians) an animal at (x, z) must face to look at p. */
export function yawToward(x, z, p) {
  return Math.atan2(-(p.x - x), -(p.z - z));
}
