import * as THREE from 'three';
import { PAL } from './core/palette.js';
import { Pipeline } from './core/post.js';
import { buildSky, SUN_DIR } from './core/sky.js';
import { Input } from './core/input.js';
import { Player } from './core/player.js';
import { createHud } from './core/hud.js';
import { createAudio } from './core/audio.js';
import { buildWorld } from './world/index.js';
import { SPAWN, onCarriageway } from './world/plan.js';
import { SYSTEMS } from './systems.js';

/* ------------------------------------------------------------------ *
 * Aktobe 2000s: entry point.
 *
 * Lighting: one warm key for the evening sun low in the west, a cool
 * fill from the opposite quarter (the clear sky), a weak bounce from the
 * dusty ground, and a hemisphere light. The shadow camera follows the
 * player on a snapped grid so shadows stay crisp without shimmering.
 *
 * Control: the walker owns the camera unless a controller (the car, a
 * bus seat, a swing) has taken it. `game.setController(c)` hands over;
 * `game.setController(null)` hands back.
 * ------------------------------------------------------------------ */

const params = new URLSearchParams(location.search);
const DEV = params.has('dev');
const canvas = document.getElementById('view');

let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', stencil: false });
} catch (err) {
  document.body.insertAdjacentHTML('beforeend',
    '<div class="fatal">This page needs WebGL, and the browser would not give it one.<br>Try a current Chrome, Firefox or Safari with hardware acceleration on.</div>');
  throw err;
}
renderer.setPixelRatio(1);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.NoToneMapping;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.setClearColor(new THREE.Color(PAL.fog), 1);

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(PAL.fog, 90, 760);

const camera = new THREE.PerspectiveCamera(56, 1, 0.15, 1600);
camera.rotation.order = 'YXZ';

/* --------------------------------- light --------------------------------- */
const SHADOW_HALF = 62;
const sun = new THREE.DirectionalLight(PAL.sun, 2.35);
sun.castShadow = true;
sun.shadow.mapSize.set(4096, 4096);
Object.assign(sun.shadow.camera, { left: -SHADOW_HALF, right: SHADOW_HALF, top: SHADOW_HALF, bottom: -SHADOW_HALF, near: 1, far: 400 });
sun.shadow.bias = -0.0003;
sun.shadow.normalBias = 0.04;
sun.shadow.radius = 2;
scene.add(sun, sun.target);

const fill = new THREE.DirectionalLight(PAL.fill, 0.95);
scene.add(fill, fill.target);
const bounce = new THREE.DirectionalLight(0xd9c9a8, 0.28);
scene.add(bounce, bounce.target);
const hemi = new THREE.HemisphereLight(PAL.hemiSky, PAL.hemiGround, 1.05);
scene.add(hemi);

const FILL_DIR = new THREE.Vector3(0.7, 0.45, -0.3).normalize();
const BOUNCE_DIR = new THREE.Vector3(0.2, -0.6, -0.4).normalize();

/* --------------------------------- game --------------------------------- */
const input = new Input(canvas);
const hud = createHud({ volume: 0.5 });
const audio = createAudio({ volume: 0.5 });

const game = {
  scene, camera, renderer, input, hud, audio, sun,
  player: null, world: null, controller: null,
  time: 0,
  wallet: 1500,
  /** Hand the camera to a controller, or back to the walker with null. */
  setController(c) {
    if (this.controller && this.controller !== c) this.controller.exit?.();
    this.controller = c;
    this.player.active = !c;
    if (c) c.enter?.();
    hud.setCrosshair(!c || c.crosshair !== false);
  },
  /** Spend tenge; returns false (and says so) if there is not enough. */
  pay(amount, what) {
    if (this.wallet < amount) {
      hud.flash(`Not enough money for ${what}`);
      audio.play('deny');
      return false;
    }
    this.wallet -= amount;
    hud.setWallet(this.wallet);
    hud.pulseWallet(-amount);
    audio.play('coins');
    return true;
  },
};

const sky = buildSky(scene, 800);
const world = buildWorld(scene, game);
game.world = world;

const player = new Player(camera, world, input);
game.player = player;
player.setSpawn(SPAWN.x, SPAWN.z, SPAWN.yaw, SPAWN.pitch);
player.onStep = (speed) => {
  const p = player.pos;
  const hard = p.y > 0.05 || onCarriageway(p.x, p.z);
  audio.play('step', { volume: Math.min(1, speed / 5) * 0.5, soft: !hard });
};

/* Systems: traffic, transit, the train, the player's car. Each is
 * { name, create(game) -> { update(dt) } } and may be absent while the
 * town is still being built. */
const systems = [];
for (const S of SYSTEMS) {
  try {
    const sys = S.create(game);
    if (sys) systems.push(sys);
    game[S.name] = sys;
  } catch (err) {
    console.error(`[main] system "${S.name}" failed`, err);
  }
}

hud.setWallet(game.wallet);
hud.setHint('<b>WASD</b> walk · <b>Shift</b> run · <b>E</b> use · <b>V</b> call your car · <b>T</b> map · <b>M</b> sound · <b>Esc</b> pause');

hud.onStart = () => {
  audio.start();
  input.lock();
};
hud.onVolume = (v) => audio.setVolume(v);
let welcomed = false;
input.onLockChange = (locked) => {
  hud.setLocked(locked);
  if (locked && !welcomed) {
    welcomed = true;
    // the first thing every phone did when you arrived in a new town
    setTimeout(() => {
      hud.sms("K'Cell", 'Ақтөбеге қош келдіңіз! Добро пожаловать в Актобе. Баланс: 1500 тг');
      audio.play('sms');
    }, 2500);
  }
};
canvas.addEventListener('click', () => {
  audio.start();
  if (!input.locked) input.lock();
});

input.on('KeyE', () => {
  if (game.controller?.onInteract) {
    if (game.controller.onInteract() !== false) return;
  }
  if (!game.controller && player.hovered) player.hovered.action?.(game);
});
input.on('KeyR', () => {
  if (game.controller) game.setController(null);
  player.reset();
  hud.flash('back at the bus stop');
});
input.on('KeyM', () => {
  const muted = audio.toggleMute();
  hud.flash(muted ? 'sound off' : 'sound on');
});
input.on('KeyC', (e) => {
  if (e.shiftKey) hud.copyCoords();
  else hud.flash(hud.toggleCoords() ? 'coordinates on' : 'coordinates off', 900);
});
input.on('KeyO', () => { pipeline.enabled.ink = !pipeline.enabled.ink; });
input.on('KeyG', () => { pipeline.enabled.grade = !pipeline.enabled.grade; });
input.allowUnlocked = (code) => DEV && ['KeyO', 'KeyG'].includes(code);

/* ------------------------------- pipeline ------------------------------- */
const pipeline = new Pipeline(renderer, scene, camera);
function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  pipeline.setSize(w, h);
}
window.addEventListener('resize', resize);
resize();

/* ------------------------------- lighting follow ------------------------------- */
const _fwd = new THREE.Vector3();
const _center = new THREE.Vector3();
function placeLights() {
  camera.getWorldDirection(_fwd);
  _fwd.y = 0;
  if (_fwd.lengthSq() < 1e-6) _fwd.set(0, 0, -1);
  _fwd.normalize();
  // centre the shadow map a little ahead of where you are looking
  _center.copy(camera.position).addScaledVector(_fwd, SHADOW_HALF * 0.45);
  const texel = (SHADOW_HALF * 2) / sun.shadow.mapSize.x;
  _center.x = Math.round(_center.x / texel) * texel;
  _center.z = Math.round(_center.z / texel) * texel;
  _center.y = 0;
  sun.target.position.copy(_center);
  sun.position.copy(_center).addScaledVector(SUN_DIR, 200);
  fill.target.position.copy(_center);
  fill.position.copy(_center).addScaledVector(FILL_DIR, 100);
  bounce.target.position.copy(_center);
  bounce.position.copy(_center).addScaledVector(BOUNCE_DIR, -100);
}

/* --------------------------------- loop --------------------------------- */
const timer = new THREE.Timer();
let freeCam = null;   // dev: a fixed camera for screenshots
let frames = 0, fpsAcc = 0, fps = 0;
const showStats = params.has('stats');

/* Resolution follows the frame rate: if the machine cannot hold ~50 fps
 * the internal render scale steps down (never below 0.6), and it steps
 * back up when there is headroom. Off in dev mode, so screenshots are
 * always at full quality. */
const AUTO_Q = !DEV && !params.has('fixed');
const q = { acc: 0, frames: 0, calm: 0 };
function autoQuality(rawDt) {
  if (!AUTO_Q) return;
  q.acc += rawDt;
  q.frames++;
  if (q.acc < 2) return;
  const avg = q.frames / q.acc;
  q.acc = 0; q.frames = 0;
  if (avg < 48 && pipeline.quality > 0.6) {
    pipeline.quality = Math.max(0.6, pipeline.quality - 0.1);
    resize();
    q.calm = 0;
  } else if (avg > 58) {
    q.calm++;
    if (q.calm >= 3 && pipeline.quality < 1) {
      pipeline.quality = Math.min(1, pipeline.quality + 0.1);
      resize();
      q.calm = 0;
    }
  } else q.calm = 0;
}

function step(dt) {
  game.time += dt;
  if (!freeCam) {
    if (game.controller) game.controller.update(dt);
    else player.update(dt);
  }
  world.update(dt);
  for (const s of systems) s.update?.(dt);
  audio.update(dt, camera);
}

function frame() {
  timer.update();
  const rawDt = timer.getDelta();
  const dt = Math.min(rawDt, 1 / 20);
  if (!document.hidden) autoQuality(rawDt);
  step(dt);
  if (freeCam) {
    camera.position.set(freeCam.x, freeCam.y, freeCam.z);
    camera.rotation.set(freeCam.pitch, freeCam.yaw, 0, 'YXZ');
  }
  sky.follow(camera);
  placeLights();

  const hovered = !game.controller && (input.locked || input.force) ? player.pick(world.interactables) : null;
  if (!hovered) player.hovered = null;
  const ctrlPrompt = game.controller?.prompt?.();
  hud.setPrompt(ctrlPrompt || (hovered ? `E · ${hovered.label}` : ''));
  hud.update(dt);
  hud.setCoords(game.controller?.pos || player.pos, game.controller?.yaw ?? player.yaw, player.pitch, dt);

  pipeline.render(game.time);

  if (showStats) {
    frames++;
    fpsAcc += dt;
    if (fpsAcc > 0.5) {
      fps = Math.round(frames / fpsAcc);
      frames = 0; fpsAcc = 0;
      const info = pipeline.sceneInfo;
      hud.setStats(`${fps} fps · ${info.calls} calls · ${(info.triangles / 1000).toFixed(0)}k tris`);
    }
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

/* --------------------------------- dev --------------------------------- */
window.__city = {
  game, pipeline, THREE, ready: true,
  /** Walker view at (x, z) looking yaw / pitch; or a free camera with y. */
  view({ x, z, y, yaw = 0, pitch = 0 } = {}) {
    if (y !== undefined) {
      freeCam = { x, y, z, yaw, pitch };
    } else {
      freeCam = null;
      if (game.controller) game.setController(null);
      player.placeAt(x, z, yaw, pitch);
    }
  },
  /** Advance the simulation by `secs` without rendering. */
  advance(secs, dt = 1 / 30) {
    for (let t = 0; t < secs; t += dt) step(dt);
  },
  renderNow() {
    if (freeCam) {
      camera.position.set(freeCam.x, freeCam.y, freeCam.z);
      camera.rotation.set(freeCam.pitch, freeCam.yaw, 0, 'YXZ');
    }
    sky.follow(camera);
    placeLights();
    pipeline.render(game.time);
  },
  stats() {
    return { ...world.stats, ...pipeline.sceneInfo, colliders: world.colliders.all.length };
  },
};
if (DEV) hud.hideOverlay();
