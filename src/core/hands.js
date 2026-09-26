import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { cel } from './toon.js';
import { ITEMS } from './items.js';
import './eatSounds.js';

/* ------------------------------------------------------------------ *
 * What is in your hand.
 *
 * One item at a time, held in the right hand low in the corner of the
 * view. Click (or F) takes a bite or a sip: the hand brings the item up
 * to the mouth, the sound plays at the top of the motion and the item
 * shrinks a step. Finished food is gone; a stick, can, bottle or paper
 * cone stays in the hand until you drop it in a bin with E. Buying
 * something else swaps it for the new thing.
 *
 * The hand hangs off the camera, so it follows the walker, the bench
 * and the bus seat, and hides while you drive.
 *
 *   const hands = createHands(game, { bins });
 *   hands.give('plombir'); hands.use(); hands.update(dt);
 * ------------------------------------------------------------------ */

const SKIN = 0xe0ab88;
const SKIN_SHADE = 0xcf9876;
const SLEEVE = 0x7fa6c9;    // a light blue summer shirt
const SLEEVE_CUFF = 0x6f95b8;
const ARM_REST = { x: -0.35, z: 0.85 };
const ARM_DIR = new THREE.Vector3(0.62, -0.72, 0.3).normalize();   // camera space
const DOWN = new THREE.Vector3(0, -1, 0);
const _q = new THREE.Quaternion();
const _v = new THREE.Vector3();
const VISIBLE_IN = new Set(['sit', 'ride']);

// camera-space poses: at rest in the lower right, and at the mouth
const REST = { x: 0.26, y: -0.24, z: -0.52, rx: 0.1, ry: -0.35, rz: 0.1 };
const MOUTH = { bite: { x: 0.035, y: -0.13, z: -0.27, rx: 0.55, ry: -0.2, rz: 0.05 },
  pinch: { x: 0.05, y: -0.15, z: -0.3, rx: 0.35, ry: -0.2, rz: 0.1 },
  drink: { x: 0.06, y: -0.13, z: -0.33, rx: 1.15, ry: -0.2, rz: 0.3 } };
const TIMING = { bite: [0.26, 0.2, 0.3], pinch: [0.24, 0.16, 0.28], drink: [0.34, 0.6, 0.36] };
const EQUIP_TIME = 0.35;
const BIN_MARGIN = 0.8;

const mat = (color) => cel({ color, grime: 0, dirt: 0, bands: 3 });
const ease = (t) => t * t * (3 - 2 * t);

/**
 * A right fist closed round an item of half-width `r`: the back of the
 * hand on the item's right, four fingertips peeking round its left edge,
 * the thumb along the near side, and a forearm and rolled sleeve that
 * trail off to the lower right. The arm is returned so the pose can keep
 * it hanging down while the wrist tips the item.
 */
function buildHand(r) {
  const g = new THREE.Group();
  const skin = mat(SKIN), shade = mat(SKIN_SHADE), nail = mat(0xe8c2a8);
  const palm = new THREE.Mesh(new RoundedBoxGeometry(0.036, 0.09, 0.082, 3, 0.014), skin);
  palm.position.set(r + 0.017, -0.004, -0.004);
  g.add(palm);
  // knuckle ridge along the top of the fist
  const ridge = new THREE.Mesh(new RoundedBoxGeometry(0.03, 0.02, 0.078, 2, 0.009), shade);
  ridge.position.set(r + 0.006, 0.036, -0.006);
  g.add(ridge);
  // fingers wrap behind the item; their tips show on its left side
  for (let i = 0; i < 4; i++) {
    const y = 0.03 - i * 0.021;
    const f = new THREE.Mesh(new THREE.CapsuleGeometry(0.0098, r * 2 + 0.004, 3, 8), i % 2 ? skin : shade);
    f.rotation.z = Math.PI / 2;
    f.position.set(0, y, -r - 0.007);
    const tip = new THREE.Mesh(new THREE.SphereGeometry(0.0105, 10, 8), skin);
    tip.position.set(-r - 0.004, y, -r * 0.35);
    tip.scale.set(0.85, 0.95, 1.25);
    g.add(f, tip);
  }
  // the thumb lies up the near side of the item, nail toward you
  const thumb = new THREE.Group();
  thumb.position.set(r * 0.55 + 0.004, 0.0, r + 0.006);
  thumb.rotation.set(-0.1, 0, 0.42);
  const t1 = new THREE.Mesh(new THREE.CapsuleGeometry(0.0115, 0.028, 3, 8), skin);
  t1.position.y = 0.012;
  const tn = new THREE.Mesh(new THREE.SphereGeometry(0.0075, 8, 6), nail);
  tn.position.set(0, 0.032, 0.006);
  tn.scale.set(1, 1.2, 0.45);
  thumb.add(t1, tn);
  g.add(thumb);
  // wrist, forearm and a rolled shirt sleeve going out of view
  const arm = new THREE.Group();
  arm.position.set(r + 0.02, -0.035, 0.008);
  arm.rotation.set(ARM_REST.x, 0, ARM_REST.z);
  const wrist = new THREE.Mesh(new THREE.SphereGeometry(0.031, 12, 10), skin);
  wrist.scale.set(1, 0.8, 1);
  const fore = new THREE.Mesh(new THREE.CylinderGeometry(0.029, 0.037, 0.3, 14), skin);
  fore.position.y = -0.15;
  const sleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.054, 0.2, 14), mat(SLEEVE));
  sleeve.position.y = -0.39;
  const cuff = new THREE.Mesh(new THREE.TorusGeometry(0.051, 0.01, 6, 16), mat(SLEEVE_CUFF));
  cuff.rotation.x = Math.PI / 2;
  cuff.position.y = -0.29;
  arm.add(wrist, fore, sleeve, cuff);
  g.add(arm);
  g.traverse((o) => { o.castShadow = false; o.receiveShadow = false; });
  g.userData.arm = arm;
  return g;
}

export function createHands(game, { bins = [] } = {}) {
  const root = new THREE.Group();
  root.visible = false;
  game.camera.add(root);
  if (!game.camera.parent) game.scene.add(game.camera);

  const s = {
    kind: null, def: null, model: null, hand: null, bites: 0,
    anim: null, equip: 1, hinted: false,
  };

  function clear() {
    if (s.model) root.remove(s.model.group);
    if (s.hand) root.remove(s.hand);
    s.kind = s.def = s.model = s.hand = null;
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
      s.hand = buildHand(def.grip);
      s.model.group.traverse((o) => { o.castShadow = false; o.receiveShadow = false; });
      root.add(s.hand, s.model.group);
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
      // the wrist bends; the forearm keeps pointing to the lower right
      // corner of the view, whatever angle the item is at
      _q.copy(root.quaternion).invert();
      _v.copy(ARM_DIR).applyQuaternion(_q);
      s.hand.userData.arm.quaternion.setFromUnitVectors(DOWN, _v);
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
