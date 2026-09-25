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

  const world = {
    root, colliders, ground, interactables, updaters, dynamic, ctx,
    busStops: ctx.busStops,
    parking: ctx.parking,
    spots: ctx.spots,
    bounds: BOUNDS,
    stats: { meshes: meshes.length },
    heightAt: (x, z, fromY) => ground.heightAt(x, z, fromY),
    update(dt) {
      for (const fn of updaters) fn(dt, game);
    },
  };
  return world;
}
