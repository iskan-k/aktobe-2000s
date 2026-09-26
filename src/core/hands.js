import * as THREE from 'three';
import { ITEMS } from './items.js';
import './eatSounds.js';

/* ------------------------------------------------------------------ *
 * What is in your hand.
 *
 * One item at a time, held low in the right corner of the view. The
 * hand itself is not drawn: only the item shows, as if held just out of
 * sight. Click (or F) takes a bite or a sip: the item comes up to the
 * mouth (a drink tips over sideways, neck first), the sound plays at the
 * top of the motion and the item shrinks a step. Finished food is gone;
 * a stick, can, bottle or paper cone stays in the hand until you drop it
 * in a bin with E. Buying something else swaps it for the new thing.
 *
 * The item hangs off the camera, so it follows the walker, the bench
 * and the bus seat, and hides while you drive.
 *
 *   const hands = createHands(game, { bins });
 *   hands.give('plombir'); hands.use(); hands.update(dt);
 * ------------------------------------------------------------------ */

const VISIBLE_IN = new Set(['sit', 'ride']);

// camera-space poses: at rest in the lower right, and at the mouth
const REST = { x: 0.26, y: -0.24, z: -0.52, rx: 0.1, ry: -0.35, rz: 0.1 };
const MOUTH = { bite: { x: 0.035, y: -0.13, z: -0.27, rx: 0.55, ry: -0.2, rz: 0.05 },
  pinch: { x: 0.05, y: -0.15, z: -0.3, rx: 0.35, ry: -0.2, rz: 0.1 },
  // a drink tips over to the left past level, neck down at the mouth and
  // base up, seen from its side
  drink: { x: 0.13, y: -0.07, z: -0.34, rx: 0.15, ry: 0, rz: 1.85 } };
const TIMING = { bite: [0.26, 0.2, 0.3], pinch: [0.24, 0.16, 0.28], drink: [0.34, 0.6, 0.36] };
const EQUIP_TIME = 0.35;
const BIN_MARGIN = 0.8;

const ease = (t) => t * t * (3 - 2 * t);

export function createHands(game, { bins = [] } = {}) {
  const root = new THREE.Group();
  root.visible = false;
  game.camera.add(root);
  if (!game.camera.parent) game.scene.add(game.camera);

  const s = {
    kind: null, def: null, model: null, bites: 0,
    anim: null, equip: 1, hinted: false,
  };

  function clear() {
    if (s.model) root.remove(s.model.group);
    s.kind = s.def = s.model = null;
    s.anim = null;
    s.bites = 0;
  }

  function hasEmpty() { return !!(s.def && s.bites >= s.def.bites && s.def.empty); }

  const api = {
    root,
    get holding() { return s.kind; },
    get hasEmpty() { return hasEmpty(); },
    get emptyName() { return s.def?.empty || ''; },

    /** Put a freshly bought item in the hand, replacing what was there. */
    give(kind) {
      const def = ITEMS[kind];
      if (!def) return;
      const had = s.def;
      const hadEmpty = hasEmpty();
      clear();
      s.kind = kind;
      s.def = def;
      s.model = def.make();
      s.model.stage(0);
      s.model.group.traverse((o) => { o.castShadow = false; o.receiveShadow = false; });
      root.add(s.model.group);
      s.equip = 0;
      if (had) game.hud.flash(hadEmpty ? `The ${had.empty} goes in your pocket for later.` : `You swap the ${had.name} for the ${def.name}.`, 2200);
      if (!s.hinted) {
        s.hinted = true;
        const verb = def.mode === 'drink' ? 'sip' : 'bite';
        game.hud.setHint(`<b>Click</b> or <b>F</b> take a ${verb} · empties go in a bin with <b>E</b>`, 8);
      }
    },

    /** Take a bite or a sip, if there is anything left. */
    use() {
      if (!s.def || s.anim || s.equip < 1 || !root.visible) return false;
      if (s.bites >= s.def.bites) {
        if (s.def.empty) game.hud.flash(`Only the ${s.def.empty} left. There is a bin on every corner.`, 2000);
        return false;
      }
      s.anim = { t: 0, fired: false };
      return true;
    },

    /** Drop the empty into a bin. */
    throwAway(pos) {
      if (!hasEmpty()) return false;
      const what = s.def.empty;
      game.audio.play('binDrop', { pos, glass: what === 'bottle' });
      clear();
      game.hud.flash(`In the bin with the ${what}. The dvornik will be pleased.`, 1800);
      return true;
    },

    update(dt) {
      const c = game.controller;
      root.visible = !!s.def && (!c || VISIBLE_IN.has(c.name));
      if (!s.def) return;
      s.equip = Math.min(1, s.equip + dt / EQUIP_TIME);
      let k = 0;
      const [up, hold, down] = TIMING[s.def.mode];
      if (s.anim) {
        const a = s.anim;
        a.t += dt;
        if (a.t < up) k = ease(a.t / up);
        else if (a.t < up + hold) {
          k = 1;
          if (!a.fired) {
            a.fired = true;
            s.bites++;
            const last = s.bites >= s.def.bites;
            game.audio.play(last && s.def.last ? s.def.last : s.def.sound, { ...(s.def.soundOpts || {}), volume: 0.8 });
            s.model.stage(s.bites);
          }
        } else if (a.t < up + hold + down) k = 1 - ease((a.t - up - hold) / down);
        else {
          s.anim = null;
          if (s.bites >= s.def.bites) {
            game.hud.flash(s.def.done, 2600);
            if (!s.def.empty) { clear(); return; }
          }
        }
      }
      const to = MOUTH[s.def.mode];
      const lift = s.def.lift * k;
      const p = game.player;
      const walking = !c && p.moving > 0.3 ? Math.min(1, p.moving / 3) : 0;
      const sx = Math.sin(p.bob) * 0.008 * walking, sy = Math.abs(Math.cos(p.bob)) * 0.007 * walking;
      const drop = (1 - ease(s.equip)) * 0.26;
      const lerp = (a, b) => a + (b - a) * k;
      root.position.set(lerp(REST.x, to.x) + sx, lerp(REST.y, to.y) - lift * 0.3 + sy - drop, lerp(REST.z, to.z));
      const tilt = (s.def.tilt || 0) * (1 - k);
      root.rotation.set(lerp(REST.rx, to.rx), lerp(REST.ry, to.ry), lerp(REST.rz, to.rz) + tilt, 'YXZ');
    },
  };

  // every litter bin in town takes empties
  for (const b of bins) {
    game.world.ctx.interact({
      x: b.x, y: b.y + 0.5, z: b.z, w: BIN_MARGIN, h: 0.9, d: BIN_MARGIN,
      label: () => `Throw away the ${api.emptyName}`,
      enabled: () => api.hasEmpty,
      action: () => api.throwAway({ x: b.x, y: b.y + 0.5, z: b.z }),
    });
  }
  return api;
}
