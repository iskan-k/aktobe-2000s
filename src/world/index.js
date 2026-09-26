import * as THREE from 'three';
import { Batch } from '../core/batch.js';
import { Colliders, Ground } from '../core/physics.js';
import { PAL } from '../core/palette.js';
import { rngKit } from '../core/util.js';
import { BOUNDS } from './plan.js';
import { buildRoads } from './roads.js';
import { buildStreetscape } from './streetscape.js';
import { DISTRICTS } from './districts/index.js';

/* ------------------------------------------------------------------ *
 * World assembly.
 *
 * Every district builder receives the same `ctx` and writes into it:
 *
 *   ctx.batch        shared static Batch (flushed once at the end)
 *   ctx.root         THREE.Group for anything that is not batched
 *                    (animated objects, textured signs, rigs)
 *   ctx.colliders    static footprints (see core/physics.js)
 *   ctx.ground       walkable raised surfaces and ramps
 *   ctx.interact()   register something that answers E
 *   ctx.update()     register a per-frame function (dt, game) => void
 *   ctx.busStops     transit stops, read by the traffic system
 *   ctx.parking      spots where parked cars may stand
 *   ctx.game         the game object (player, hud, audio, ...), for
 *                    interaction callbacks; do not use it while building
 *
 * The world object returned here is what the player, the traffic and
 * main.js talk to.
 * ------------------------------------------------------------------ */

const HITBOX_MAT = new THREE.MeshBasicMaterial({ visible: false });
const SMALL_R = 2.5;        // m: textured meshes smaller than this are signs, posters, labels
const SMALL_REACH = 140;    // m: beyond this they are unreadable, so they are not drawn
const SMALL_EVERY = 0.25;   // s between visibility checks

/**
 * Small textured one-off meshes (shop signs, posters, plaques, price
 * boards) cost a draw call each but are unreadable from far off. Collect
 * them once the town is built so they can be skipped beyond SMALL_REACH.
 */
function smallDetails(root) {
  const out = [];
  root.traverse((o) => {
    if (!o.isMesh || o.isInstancedMesh || !o.visible || o.material === HITBOX_MAT) return;
    const mat = Array.isArray(o.material) ? o.material[0] : o.material;
    if (!mat?.map) return;
    const g = o.geometry;
    if (!g.boundingSphere) g.computeBoundingSphere();
    const sc = o.getWorldScale(new THREE.Vector3());
    if (g.boundingSphere.radius * Math.max(sc.x, sc.y, sc.z) > SMALL_R) return;
    out.push({ mesh: o, pos: g.boundingSphere.center.clone().applyMatrix4(o.matrixWorld) });
  });
  return out;
}

export function buildWorld(scene, game) {
  const root = new THREE.Group();
  root.name = 'world';
  scene.add(root);

  const colliders = new Colliders(8);
  const ground = new Ground(8);
  const batch = new Batch({ name: 'static' });
  const interactables = [];
  const updaters = [];
  const dynamic = [];

  const ctx = {
    scene, root, batch, colliders, ground, game, PAL,
    interactables, updaters, dynamic,
    busStops: [],
    parking: [],
    spots: {},
    rng: (seed) => rngKit(seed),
    /**
     * Register an interactable.
     * @param {object} o
     * @param {number} o.x, o.y, o.z  hitbox centre (world, or local to `parent`)
     * @param {number} [o.w=0.8], [o.h=1], [o.d=0.8]  hitbox size
     * @param {number} [o.ry=0]
     * @param {string|function} o.label  prompt text, or a function returning it
     * @param {function} o.action  called on E
     * @param {function} [o.enabled]  return false to hide the prompt
     * @param {THREE.Object3D} [o.parent]  attach to a moving object
     */
    interact(o) {
      const { x = 0, y = 1, z = 0, w = 0.8, h = 1, d = 0.8, ry = 0, parent = root } = o;
      const hb = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), HITBOX_MAT);
      hb.position.set(x, y, z);
      hb.rotation.y = ry;
      hb.visible = false;
      parent.add(hb);
      const item = {
        hitbox: hb,
        get label() { return typeof o.label === 'function' ? o.label() : o.label; },
        action: o.action,
        enabled: o.enabled,
      };
      interactables.push(item);
      return item;
    },
    update(fn) { updaters.push(fn); },
  };

  const streets = buildRoads(ctx);
  ctx.streets = streets;
  buildStreetscape(ctx, streets);

  for (const d of DISTRICTS) {
    try {
      d.build(ctx);
    } catch (err) {
      // one broken district must not take the town down with it
      console.error(`[world] district "${d.name}" failed to build`, err);
    }
  }

  const meshes = batch.flush(root);
  root.updateMatrixWorld(true);
  const details = smallDetails(root);
  let detailT = 0;
  const updateDetails = (dt) => {
    detailT -= dt;
    if (detailT > 0) return;
    detailT = SMALL_EVERY;
    const cam = game.camera.position;
    const r2 = SMALL_REACH * SMALL_REACH;
    // through layers, not .visible, so code that shows and hides a sign keeps working
    for (const d of details) {
      if (d.pos.distanceToSquared(cam) < r2) d.mesh.layers.enable(0);
      else d.mesh.layers.disable(0);
    }
  };

  const world = {
    root, colliders, ground, interactables, updaters, dynamic, ctx,
    busStops: ctx.busStops,
    parking: ctx.parking,
    spots: ctx.spots,
    bounds: BOUNDS,
    stats: { meshes: meshes.length },
    heightAt: (x, z, fromY) => ground.heightAt(x, z, fromY),
    update(dt) {
      updateDetails(dt);
      for (const fn of updaters) fn(dt, game);
    },
  };
  return world;
}
