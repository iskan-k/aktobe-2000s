import * as THREE from 'three';
import { cel, flat } from '../../core/toon.js';
import { SURF, TILE, hQuad, splitRect } from '../../core/surfaces.js';
import { canvasTex, cached, flagTex, centerText, FONT, weather } from '../../core/textures.js';
import { clamp, rngKit } from '../../core/util.js';
import { defineLoop } from '../../core/audio.js';
import { Batch } from '../../core/batch.js';
import { BLOCKS } from '../plan.js';
import { addTree } from '../props/trees.js';
import { addBench, addBin } from '../props/street.js';
import { buildAkimat, buildMonument, texPlane } from '../buildings/landmarks.js';

/* ------------------------------------------------------------------ *
 * District: the central square.
 *
 * North half, facing the avenue: the square itself in grey slabs, a row
 * of flags on white poles along the pavement, light blue lamp masts with
 * their decorative crossbars, two big beds of white and red flowers, the
 * little granite pyramid with a ball, and Abulkhair Khan on his horse in
 * front of the regional akimat (1971), whose green-glass centre looks
 * straight down the axis.
 *
 * South half, behind the akimat: the park. Slab alleys, lawns fenced in
 * black wrought iron, blue spruces and clipped elms, globe lamps, benches,
 * a Soviet fountain where the alleys cross, and the Board of Honour.
 *
 * Interactables: the fountain (a coin for a wish), the monument plaque,
 * the akimat door, the Board of Honour, and park benches you can sit on.
 * ------------------------------------------------------------------ */

const B = BLOCKS.square;
const AXIS = -85;
const Y = -0.02;               // paving sits just over the bare earth
const LIGHT_BLUE = 0x7fb8e6;

/* ---------------- textures ---------------- */

function flowerTex(pattern) {
  return cached(`flowers|${pattern}`, () => canvasTex(512, 512, (c, W, H) => {
    const r = rngKit(pattern === 'stripes' ? 31 : 32);
    c.fillStyle = '#4f7a36';
    c.fillRect(0, 0, W, H);
    // bands of white and red, the way the city planted them (c22)
    const band = (y0, y1, col, n) => {
      for (let i = 0; i < n; i++) {
        c.fillStyle = r.pick(col);
        const x = r.range(0, W), y = r.range(y0, y1), s = r.range(3, 7);
        c.beginPath(); c.arc(x, y, s, 0, Math.PI * 2); c.fill();
      }
    };
    if (pattern === 'stripes') {
      for (let k = 0; k < 4; k++) {
        band(k * 128, k * 128 + 64, ['#f5f2ea', '#ffffff', '#e8e4da'], 900);
        band(k * 128 + 64, k * 128 + 128, ['#c42f2a', '#d8453a', '#a8251f'], 900);
      }
    } else {
      band(0, H, ['#f5f2ea', '#ffffff'], 1400);
      band(0, H, ['#c42f2a', '#d8453a', '#e0a02a'], 900);
    }
    for (let i = 0; i < 1600; i++) {
      c.fillStyle = r.pick(['#3f6a2a', '#5f8a3e', '#6f9a48']);
      c.fillRect(r.range(0, W), r.range(0, H), 2, 3);
    }
  }, { repeat: [1, 1] }));
}

/** Black wrought iron with hearts and scrolls, alpha-tested. 2 m by 0.9 m per tile. */
function ironFenceTex() {
  return cached('iron-fence', () => canvasTex(512, 232, (c, W, H) => {
    c.clearRect(0, 0, W, H);
    c.strokeStyle = '#1c1c1c';
    c.fillStyle = '#1c1c1c';
    c.lineWidth = 7;
    c.strokeRect(4, 10, W - 8, H - 20);
    c.lineWidth = 5;
    const n = 8;
    for (let i = 0; i <= n; i++) {
      const x = 4 + (i * (W - 8)) / n;
      c.beginPath(); c.moveTo(x, 10); c.lineTo(x, H - 10); c.stroke();
      // spear tips on every other bar
      if (i % 2 === 0) { c.beginPath(); c.moveTo(x - 7, 12); c.lineTo(x, 0); c.lineTo(x + 7, 12); c.fill(); }
    }
    // a heart between each pair of bars, scrolls under it
    for (let i = 0; i < n; i++) {
      const cx = 4 + ((i + 0.5) * (W - 8)) / n, cy = H * 0.42, s = 13;
      c.lineWidth = 4;
      c.beginPath();
      c.moveTo(cx, cy + s);
      c.bezierCurveTo(cx - s * 1.6, cy - s * 0.2, cx - s * 0.5, cy - s * 1.3, cx, cy - s * 0.3);
      c.bezierCurveTo(cx + s * 0.5, cy - s * 1.3, cx + s * 1.6, cy - s * 0.2, cx, cy + s);
      c.stroke();
      c.beginPath(); c.arc(cx - 12, cy + 34, 10, Math.PI * 0.2, Math.PI * 1.7); c.stroke();
      c.beginPath(); c.arc(cx + 12, cy + 34, 10, Math.PI * 1.3, Math.PI * 0.8, true); c.stroke();
    }
  }, { repeat: [1, 1] }));
}

function honourBoardTex() {
  return cached('honour-board', () => canvasTex(1024, 512, (c, W, H) => {
    const r = rngKit(51);
    c.fillStyle = '#8a1f24';
    c.fillRect(0, 0, W, H);
    c.fillStyle = '#e8c35a';
    c.fillRect(18, 18, W - 36, 6);
    c.fillRect(18, H - 24, W - 36, 6);
    centerText(c, 'ҚҰРМЕТ ТАҚТАСЫ · ДОСКА ПОЧЁТА', W / 2, 58, W * 0.9, 42, '#f3dc8a', { family: FONT.serif, stretch: 0.9 });
    const names = ['Жумагалиев Е.К.', 'Петренко В.И.', 'Сарсенова А.Б.', 'Исмагулов Т.Н.', 'Кравцова Л.П.', 'Нурмухамбетов Б.Ж.',
      'Абдрахманова Г.С.', 'Шевченко О.Н.', 'Досмагамбетов А.А.', 'Ким Р.Ю.'];
    for (let i = 0; i < 10; i++) {
      const col = i % 5, row = Math.floor(i / 5);
      const x = 70 + col * 185, y = 110 + row * 190;
      c.fillStyle = '#efe8d8';
      c.fillRect(x, y, 120, 140);
      const g = c.createLinearGradient(0, y, 0, y + 140);
      g.addColorStop(0, '#c9c2b2');
      g.addColorStop(1, '#8d8677');
      c.fillStyle = g;
      c.fillRect(x + 8, y + 8, 104, 124);
      // a sepia head and shoulders
      c.fillStyle = r.pick(['#5a4a3a', '#4a3c30', '#6a5a48']);
      c.beginPath(); c.arc(x + 60, y + 58, 22, 0, Math.PI * 2); c.fill();
      c.beginPath(); c.ellipse(x + 60, y + 128, 44, 36, 0, Math.PI, 0); c.fill();
      centerText(c, names[i], x + 60, y + 158, 170, 18, '#f3dc8a', { family: FONT.sans, weight: '600' });
    }
    weather(c, W, H, 9, 0.6);
  }));
}

function rippleTex() {
  return cached('ripple', () => canvasTex(256, 256, (c, W, H) => {
    const r = rngKit(61);
    c.fillStyle = '#6f9fb4';
    c.fillRect(0, 0, W, H);
    for (let i = 0; i < 140; i++) {
      c.strokeStyle = r.pick(['rgba(230,245,250,0.35)', 'rgba(60,100,120,0.35)']);
      c.lineWidth = r.range(1, 3);
      const x = r.range(0, W), y = r.range(0, H), w = r.range(10, 40);
      c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x + w / 2, y - 4, x + w, y); c.stroke();
    }
  }, { repeat: [1, 1] }));
}

/* ---------------- sounds ---------------- */

defineLoop('fountain', (ac, out) => {
  const buf = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  const n = ac.createBufferSource();
  n.buffer = buf;
  n.loop = true;
  const hp = ac.createBiquadFilter();
  hp.type = 'bandpass';
  hp.frequency.value = 2200;
  hp.Q.value = 0.4;
  const g = ac.createGain();
  g.gain.value = 0.0001;
  n.connect(hp).connect(g).connect(out);
  n.start();
  return {
    set({ volume = 1 }) { g.gain.setTargetAtTime(Math.max(0.0001, volume * 0.14), ac.currentTime, 0.2); },
    stop() { g.gain.setTargetAtTime(0.0001, ac.currentTime, 0.2); setTimeout(() => n.stop(), 600); },
  };
});

/* ---------------- flags ---------------- */

/** A flag that waves: a subdivided plane whose vertices ripple each frame. */
function makeFlag(root, x, y, z, facingX = true, w = 2.4, h = 1.2) {
  const geo = new THREE.PlaneGeometry(w, h, 14, 6);
  geo.translate(w / 2, -h / 2, 0);
  const mat = cel({ map: flagTex(), side: THREE.DoubleSide, grime: 0, dirt: 0, cache: false, bands: 3 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(x, y, z);
  // the wind is from the west: flags stream east
  mesh.rotation.y = facingX ? 0 : Math.PI / 2;
  mesh.castShadow = true;
  root.add(mesh);
  const base = Float32Array.from(geo.attributes.position.array);
  return { mesh, base, phase: x * 0.37 + z * 0.11 };
}

function waveFlags(flags, t, cam) {
  for (const f of flags) {
    if (Math.abs(f.mesh.position.x - cam.x) > 160 || Math.abs(f.mesh.position.z - cam.z) > 160) continue;
    const p = f.mesh.geometry.attributes.position;
    const a = p.array, b = f.base;
    for (let i = 0; i < p.count; i++) {
      const u = b[i * 3];
      const k = u / 2.4;
      a[i * 3 + 2] = Math.sin(u * 2.6 - t * 5.2 + f.phase) * 0.16 * k + Math.sin(u * 5.1 - t * 8.3) * 0.04 * k;
      a[i * 3 + 1] = b[i * 3 + 1] - k * k * 0.08;
    }
    p.needsUpdate = true;
    f.mesh.geometry.computeVertexNormals();
  }
}

/* ---------------- sitting ---------------- */

/** Sit on a bench: the camera drops to a seated eye, the mouse looks round, E stands. */
export function sitController(game, x, z, facing, y = 0) {
  let yaw = facing, pitch = -0.05;
  return {
    name: 'sit',
    crosshair: true,
    pos: { x, y, z },
    get yaw() { return yaw; },
    enter() { game.hud.flash('Sitting · E to get up', 1400); },
    exit() {},
    update() {
      const { dx, dy } = game.input.takeLook();
      yaw -= dx;
      pitch = clamp(pitch - dy, -1.0, 0.9);
      game.camera.position.set(x, y + 1.18, z);
      game.camera.rotation.set(pitch, yaw, 0, 'YXZ');
    },
    onInteract() {
      const fx = -Math.sin(facing), fz = -Math.cos(facing);
      game.player.placeAt(x + fx * 0.8, z + fz * 0.8, yaw, 0);
      game.setController(null);
      return true;
    },
    prompt: () => 'E · get up',
  };
}

/* ---------------- the district ---------------- */

export const square = {
  name: 'square',
  build(shared) {
    // its own batch with coarse cells: two or three draw calls per material
    const ctx = Object.create(shared);
    ctx.batch = new Batch({ cell: 128, name: 'square' });
    const { batch, colliders, root, ground } = ctx;
    const rng = rngKit(1971);
    const flags = [];

    const akimatFront = 58;
    const squareZ1 = akimatFront - 2;        // the square runs up to the akimat's centre

    /* ---- surfaces ---- */
    for (const q of splitRect(B.x0, B.z0, B.x1, squareZ1, 40)) {
      batch.add(hQuad(q[0], q[1], q[2], q[3], Y, TILE.slabs), { mat: SURF.slabs, color: null, cast: false });
    }
    // around the akimat and a service drive behind it
    for (const q of splitRect(B.x0, squareZ1, B.x1, 80, 40)) {
      batch.add(hQuad(q[0], q[1], q[2], q[3], Y - 0.005, TILE.asphalt), { mat: SURF.asphalt, color: null, cast: false });
    }
    // the park: grass everywhere, alleys laid over it
    for (const q of splitRect(B.x0, 80, B.x1, B.z1, 40)) {
      batch.add(hQuad(q[0], q[1], q[2], q[3], Y, TILE.grass), { mat: SURF.grass, color: null, cast: false });
    }
    const alley = (x0, z0, x1, z1) => {
      for (const q of splitRect(x0, z0, x1, z1, 40)) batch.add(hQuad(q[0], q[1], q[2], q[3], Y + 0.006, TILE.slabs), { mat: SURF.slabs, color: null, cast: false });
    };
    alley(AXIS - 3, 80, AXIS + 3, B.z1);             // central alley to ул. Маресьева
    alley(B.x0, 91, B.x1, 96);                       // cross alley
    alley(B.x0 + 4, 80, B.x0 + 8, B.z1);             // west side alley
    alley(B.x1 - 8, 80, B.x1 - 4, B.z1);             // east side alley

    /* ---- the flag row along the avenue ---- */
    for (let i = 0; i < 10; i++) {
      const x = B.x0 + 9 + i * ((B.x1 - B.x0 - 18) / 9);
      if (Math.abs(x - AXIS) < 4) continue;
      const z = B.z0 + 3.2;
      batch.cyl(0.07, 10, 0xf1efe8, x, Y, z, { rTop: 0.05, seg: 8 });
      batch.cyl(0.12, 0.3, 0xd9d6cc, x, Y, z, { seg: 8 });
      batch.cyl(0.09, 0.1, 0xd4b24a, x, 10, z, { seg: 8 });
      colliders.circle(x, z, 0.14);
      flags.push(makeFlag(root, x + 0.06, 9.85, z));
    }

    /* ---- flowerbeds ---- */
    const bed = (x0, z0, x1, z1, pattern) => {
      batch.span(x0 - 0.25, Y, z0 - 0.25, x1 + 0.25, 0.32, z1 + 0.25, 0xa9a397, { cast: false });
      batch.add(hQuad(x0, z0, x1, z1, 0.33, 6), { mat: cel({ map: flowerTex(pattern), bands: 3, grime: 0.06, dirt: 0, cache: false }), color: null, cast: false });
      colliders.box(x0 - 0.25, z0 - 0.25, x1 + 0.25, z1 + 0.25, { top: 0.45, tag: 'bed' });
    };
    bed(AXIS - 44, 22, AXIS - 10, 31, 'stripes');
    bed(AXIS + 10, 22, AXIS + 44, 31, 'stripes');
    bed(AXIS - 42, 44, AXIS - 14, 51, 'mixed');
    bed(AXIS + 14, 44, AXIS + 42, 51, 'mixed');
    // round beds either side of the monument
    for (const s of [-1, 1]) {
      const g = new THREE.CylinderGeometry(3.2, 3.2, 0.34, 24);
      g.translate(AXIS + s * 14, 0.15, 38);
      batch.add(g, { color: 0xa9a397, cast: false });
      const top = new THREE.CircleGeometry(3.0, 24);
      top.rotateX(-Math.PI / 2);
      top.translate(AXIS + s * 14, 0.33, 38);
      const uv = top.attributes.uv;
      for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 1.2, uv.getY(i) * 1.2);
      batch.add(top, { mat: cel({ map: flowerTex('mixed'), bands: 3, grime: 0.05, dirt: 0, cache: false }), color: null, cast: false });
      colliders.circle(AXIS + s * 14, 38, 3.25, { top: 0.45 });
    }

    /* ---- the little granite pyramid with a ball (c22) ---- */
    {
      // small and pale in c22: pinkish granite with a dark ball on top
      const g = new THREE.ConeGeometry(0.85, 1.25, 4);
      g.rotateY(Math.PI / 4);
      g.translate(AXIS, 0.62 + 0.28, 20);
      batch.box(2.3, 0.28, 2.3, 0x9c8074, AXIS, Y, 20);
      batch.add(g, { color: 0xb49486 });
      const ballG = new THREE.SphereGeometry(0.3, 16, 12);
      ballG.translate(AXIS, 1.72, 20);
      batch.add(ballG, { color: 0x3b3a36 });
      colliders.box(AXIS - 1.15, 18.85, AXIS + 1.15, 21.15, { tag: 'marker' });
    }

    /* ---- light blue lamp masts with the decorative crossbar ---- */
    for (const dx of [-40, -22, 22, 40]) {
      for (const z of [25, 47]) {
        const x = AXIS + dx;
        batch.cyl(0.16, 11.5, LIGHT_BLUE, x, Y, z, { rTop: 0.11, seg: 10 });
        batch.cyl(0.26, 0.9, 0x6a9fcf, x, Y, z, { seg: 10 });
        // crossbar with an open square frame, two lanterns hanging from it
        batch.box(3.4, 0.14, 0.14, LIGHT_BLUE, x, 9.6, z);
        batch.box(1.4, 1.4, 0.08, LIGHT_BLUE, x, 9.0, z);
        batch.box(1.1, 1.1, 0.1, 0xe9eef2, x, 9.15, z, { mat: 'glow' });
        for (const s of [-1, 1]) {
          batch.box(0.1, 0.5, 0.1, LIGHT_BLUE, x + s * 1.6, 9.1, z);
          batch.cyl(0.24, 0.42, 0xf3f1e6, x + s * 1.6, 8.7, z, { seg: 10, mat: 'glow' });
        }
        colliders.circle(x, z, 0.3);
      }
    }

    /* ---- Abulkhair Khan ---- */
    const mon = buildMonument(ctx, { x: AXIS, z: 38, facing: 0 });

    /* ---- the akimat ---- */
    const ak = buildAkimat(ctx, { x: AXIS, zFront: akimatFront });
    batch.cyl(0.09, 7, 0xf1efe8, ak.flagTop[0], ak.flagTop[1], ak.flagTop[2], { rTop: 0.06, seg: 8 });
    flags.push(makeFlag(root, ak.flagTop[0] + 0.08, ak.flagTop[1] + 6.8, ak.flagTop[2], true, 3.6, 1.8));
    // blue spruces flanking the entrance (c21)
    for (const s of [-1, 1]) {
      for (const dz of [0, 7]) {
        const x = AXIS + s * (15 + dz * 0.3), z = akimatFront - 5 + dz * 0.2;
        const { r } = addTree(batch, 'spruce', x - s * dz, z, 900 + dz + s, { y: Y, scale: 1.05 });
        colliders.circle(x - s * dz, z, r + 0.2);
      }
    }
    // officials' cars behind the building, black and white
    for (let i = 0; i < 7; i++) {
      ctx.parking.push({ x: AXIS - 30 + i * 9.5, z: ak.back + 4.2, ry: 0, color: i % 3 === 2 ? 0xe8e4d8 : 0x1c1d20, chance: 0.8 });
    }

    /* ---- the park ---- */
    // perimeter fence of wrought iron along the three street sides
    const ironMat = cel({ map: ironFenceTex(), alphaTest: 0.5, side: THREE.DoubleSide, grime: 0, dirt: 0, cache: false });
    const fenceRun = (x0, z0, x1, z1, gaps) => {
      const along = Math.abs(x1 - x0) > Math.abs(z1 - z0) ? 'x' : 'z';
      const a0 = along === 'x' ? Math.min(x0, x1) : Math.min(z0, z1);
      const a1 = along === 'x' ? Math.max(x0, x1) : Math.max(z0, z1);
      let spans = [[a0, a1]];
      for (const [g0, g1] of gaps) {
        spans = spans.flatMap(([s0, s1]) => (g1 <= s0 || g0 >= s1 ? [[s0, s1]] : [[s0, g0], [g1, s1]].filter(([p, q]) => q - p > 0.5)));
      }
      for (const [s0, s1] of spans) {
        const len = s1 - s0;
        const mid = (s0 + s1) / 2;
        if (along === 'x') {
          texPlane(batch, ironMat, len, 1.6, mid, Y, z0, 0, { tileU: 2, tileV: 1.6 });
          colliders.box(s0, z0 - 0.08, s1, z0 + 0.08, { tag: 'fence' });
          for (let a = s0; a <= s1 + 0.01; a += 4) batch.box(0.14, 1.9, 0.14, 0x1c1c1c, a, Y, z0);
        } else {
          texPlane(batch, ironMat, len, 1.6, x0, Y, mid, Math.PI / 2, { tileU: 2, tileV: 1.6 });
          colliders.box(x0 - 0.08, s0, x0 + 0.08, s1, { tag: 'fence' });
          for (let a = s0; a <= s1 + 0.01; a += 4) batch.box(0.14, 1.9, 0.14, 0x1c1c1c, x0, Y, a);
        }
      }
    };
    fenceRun(B.x0 + 0.5, B.z1 - 0.5, B.x1 - 0.5, B.z1 - 0.5, [[AXIS - 3.5, AXIS + 3.5], [B.x0 + 3.5, B.x0 + 8.5], [B.x1 - 8.5, B.x1 - 3.5]]);
    fenceRun(B.x0 + 0.5, 80, B.x0 + 0.5, B.z1 - 0.5, [[90.5, 96.5]]);
    fenceRun(B.x1 - 0.5, 80, B.x1 - 0.5, B.z1 - 0.5, [[90.5, 96.5]]);

    // lawns between the alleys, each ringed by a low loop fence and planted
    const lawns = [
      [B.x0 + 9, 81, AXIS - 4, 90], [AXIS + 4, 81, B.x1 - 9, 90],
      [B.x0 + 9, 97, AXIS - 4, B.z1 - 1.5], [AXIS + 4, 97, B.x1 - 9, B.z1 - 1.5],
    ];
    let tseed = 3000;
    for (const [x0, z0, x1, z1] of lawns) {
      // low black hoop fence (c46)
      for (const [ax, az, bx, bz] of [[x0, z0, x1, z0], [x0, z1, x1, z1], [x0, z0, x0, z1], [x1, z0, x1, z1]]) {
        // overlapping hoops 0.3 m high, one every 0.45 m
        const len = Math.hypot(bx - ax, bz - az);
        const n = Math.max(1, Math.round(len / 0.45));
        const ry = Math.atan2(bx - ax, bz - az) + Math.PI / 2;
        for (let i = 0; i < n; i++) {
          const t = (i + 0.5) / n;
          const px = ax + (bx - ax) * t, pz = az + (bz - az) * t;
          const hoop = new THREE.TorusGeometry(0.3, 0.018, 3, 7, Math.PI);
          hoop.applyMatrix4(new THREE.Matrix4().makeRotationY(ry));
          hoop.translate(px, Y, pz);
          batch.add(hoop, { color: 0x1e1e1e, cast: false });
        }
      }
      // trees: spruces and clipped elms in rows, the odd poplar
      const cols = Math.max(2, Math.floor((x1 - x0) / 9));
      const rows = Math.max(1, Math.floor((z1 - z0) / 7));
      for (let i = 0; i < cols; i++) {
        for (let j = 0; j < rows; j++) {
          const x = x0 + ((i + 0.5) * (x1 - x0)) / cols + rng.range(-1.2, 1.2);
          const z = z0 + ((j + 0.5) * (z1 - z0)) / rows + rng.range(-1, 1);
          const kind = rng.weighted([['spruce', 3], ['ball', 3], ['elm', 2], ['poplar', 1], ['maple', 1]]);
          const { r } = addTree(batch, kind, x, z, tseed++, { y: Y });
          colliders.circle(x, z, r + 0.1);
        }
      }
    }

    // benches along the alleys, facing in, with bins beside some
    const benches = [];
    const benchAt = (x, z, facing) => {
      addBench(batch, x, z, facing, { y: Y, style: 'park', color: 0x3e6a4a });
      colliders.obb(x, z, 1.0, 0.3, facing, { top: 0.5 });
      benches.push({ x, z, facing });
    };
    for (let z = 84; z < 90; z += 8) {
      benchAt(AXIS - 4.6, z + 1, -Math.PI / 2);
      benchAt(AXIS + 4.6, z + 1, Math.PI / 2);
    }
    for (const x of [AXIS - 36, AXIS - 20, AXIS + 20, AXIS + 36]) {
      benchAt(x, 89.4, Math.PI);
      benchAt(x, 97.6, 0);
      addBin(batch, x + 1.6, 89.6, 0, Y);
    }
    for (let z = 100; z < B.z1 - 4; z += 6) {
      benchAt(AXIS - 4.6, z, -Math.PI / 2);
      benchAt(AXIS + 4.6, z, Math.PI / 2);
    }

    // globe lamps on black posts
    for (const [x, z] of [[AXIS - 4, 82], [AXIS + 4, 82], [AXIS - 4, 104], [AXIS + 4, 104],
      [AXIS - 28, 90.6], [AXIS + 28, 90.6], [AXIS - 28, 96.4], [AXIS + 28, 96.4], [B.x0 + 9, 93.5], [B.x1 - 9, 93.5]]) {
      batch.cyl(0.07, 3.3, 0x1c1c1c, x, Y, z, { seg: 8 });
      batch.cyl(0.16, 0.25, 0x1c1c1c, x, Y, z, { seg: 8 });
      const gl = new THREE.SphereGeometry(0.3, 14, 10);
      gl.translate(x, 3.55, z);
      batch.add(gl, { mat: 'glow', color: 0xf4f2e8 });
      colliders.circle(x, z, 0.12);
    }

    /* ---- the fountain ---- */
    const fx = AXIS, fz = 93.5;
    const fountain = buildFountain(ctx, fx, fz);

    /* ---- Board of Honour ---- */
    const hbX = B.x0 + 20, hbZ = 84.5;
    batch.box(6.4, 3.2, 0.3, 0x6b1a1e, hbX, 0.5, hbZ);
    batch.box(0.25, 0.5, 0.25, 0x8a8478, hbX - 2.9, Y, hbZ);
    batch.box(0.25, 0.5, 0.25, 0x8a8478, hbX + 2.9, Y, hbZ);
    batch.box(6.8, 0.3, 0.6, 0x8a8478, hbX, 3.7, hbZ);
    texPlane(batch, cel({ map: honourBoardTex(), grime: 0.02, dirt: 0, cache: false }), 6.0, 2.9, hbX, 0.65, hbZ + 0.17, Math.PI);
    colliders.box(hbX - 3.3, hbZ - 0.3, hbX + 3.3, hbZ + 0.3);

    /* ---- interactables ---- */
    ctx.interact({
      x: fx, y: 1.0, z: fz, w: 12, h: 2, d: 12,
      label: 'Toss a coin in the fountain · 10 ₸',
      action: (game) => {
        if (!game.pay(10, 'a coin')) return;
        game.audio.play('click', { pos: { x: fx, y: 1, z: fz } });
        game.hud.flash(rng.pick([
          'A wish: that the bus comes on time.',
          'A wish: a new Nexia by next summer.',
          'A wish: that it rains a little. The steppe is dry.',
          'A wish: to pass the university exams.',
        ]), 2600);
      },
    });
    ctx.interact({
      x: mon.plaque[0], y: mon.plaque[1], z: mon.plaque[2], w: 2.2, h: 1.4, d: 0.8,
      label: 'Read the plaque',
      action: (game) => game.hud.sms('Ескерткіш · Памятник', 'Әбілқайыр хан (1693-1748). Хан Младшего жуза. Памятник открыт в 2000 году.', 6500),
    });
    ctx.interact({
      x: ak.door[0], y: ak.door[1], z: ak.door[2], w: 8, h: 2.8, d: 1,
      label: 'Akimat · reception',
      action: (game) => game.hud.sms('Облыс әкімдігі · Акимат области', 'Приём граждан: вторник, четверг, 10:00-13:00. Сегодня приёма нет.', 6000),
    });
    ctx.interact({
      x: hbX, y: 2.1, z: hbZ + 0.6, w: 6.4, h: 3, d: 0.6,
      label: 'Board of Honour',
      action: (game) => game.hud.sms('Доска почёта', 'Лучшие люди города, 2006 год. Железнодорожники, учителя, врачи, строители.', 5500),
    });
    for (const b of benches) {
      ctx.interact({
        x: b.x, y: 0.6, z: b.z, w: 2, h: 0.9, d: 0.8, ry: b.facing,
        label: 'Sit on the bench',
        action: (game) => game.setController(sitController(game, b.x, b.z, b.facing, 0.02)),
      });
    }

    /* ---- per frame ---- */
    let t = 0;
    let splash = null;
    ctx.update((dt, game) => {
      t += dt;
      const cam = game.camera.position;
      waveFlags(flags, t, cam);
      fountain.update(dt, t, cam);
      if (!splash && game.audio.ready) splash = game.audio.loop('fountain', { pos: { x: fx, y: 1, z: fz }, volume: 1 });
    });
    batch.flush(root);
  },
};

/**
 * Soviet round fountain: a granite rim, water that ripples, a central
 * column with a bowl and jets. The spray is one small Points cloud.
 */
function buildFountain(ctx, x, z) {
  const { batch, colliders, root } = ctx;
  const R = 7;
  const rim = new THREE.CylinderGeometry(R + 0.4, R + 0.5, 0.55, 40, 1, true);
  rim.translate(x, 0.27, z);
  batch.add(rim, { color: 0x9a8f80 });
  const rimTop = new THREE.RingGeometry(R, R + 0.45, 40);
  rimTop.rotateX(-Math.PI / 2);
  rimTop.translate(x, 0.55, z);
  batch.add(rimTop, { color: 0xb3a998 });
  const inner = new THREE.CylinderGeometry(R, R, 0.5, 40, 1, true);
  inner.translate(x, 0.25, z);
  batch.add(inner, { color: 0x8a8070 });
  colliders.circle(x, z, R + 0.5, { top: 0.55, tag: 'fountain' });

  const tex = rippleTex().clone();
  tex.needsUpdate = true;
  tex.repeat.set(3, 3);
  const water = new THREE.Mesh(new THREE.CircleGeometry(R, 40), flat({ map: tex, cache: false }));
  water.rotation.x = -Math.PI / 2;
  water.position.set(x, 0.38, z);
  root.add(water);

  // column and bowl
  batch.cyl(0.55, 1.6, 0x9a8f80, x, 0.3, z, { seg: 16 });
  const bowl = new THREE.CylinderGeometry(2.1, 0.7, 0.55, 24);
  bowl.translate(x, 2.1, z);
  batch.add(bowl, { color: 0xa89e8e });
  const bowlWater = new THREE.CircleGeometry(1.95, 24);
  bowlWater.rotateX(-Math.PI / 2);
  bowlWater.translate(x, 2.33, z);
  batch.add(bowlWater, { mat: 'glass', color: 0x86b3c6 });
  batch.cyl(0.18, 0.9, 0x9a8f80, x, 2.3, z, { seg: 10 });

  // spray: 360 droplets on parabolas, re-launched when they fall back
  const N = 360;
  const pos = new Float32Array(N * 3);
  const vel = new Float32Array(N * 3);
  const rng = rngKit(88);
  const launch = (i) => {
    const centre = i % 3 === 0;
    const a = rng.range(0, Math.PI * 2);
    if (centre) {
      pos[i * 3] = x; pos[i * 3 + 1] = 3.2; pos[i * 3 + 2] = z;
      const sp = rng.range(0.2, 0.8);
      vel[i * 3] = Math.cos(a) * sp; vel[i * 3 + 1] = rng.range(5.5, 6.6); vel[i * 3 + 2] = Math.sin(a) * sp;
    } else {
      // a ring of arcing jets from the rim toward the bowl
      const k = Math.floor(rng.range(0, 12)) / 12 * Math.PI * 2;
      pos[i * 3] = x + Math.cos(k) * (R - 0.3); pos[i * 3 + 1] = 0.5; pos[i * 3 + 2] = z + Math.sin(k) * (R - 0.3);
      const sp = rng.range(2.3, 2.7);
      vel[i * 3] = -Math.cos(k) * sp; vel[i * 3 + 1] = rng.range(4.0, 4.5); vel[i * 3 + 2] = -Math.sin(k) * sp;
    }
  };
  for (let i = 0; i < N; i++) {
    launch(i);
    // spread them along their paths so it starts mid-flow
    const tt = rng.range(0, 1.2);
    pos[i * 3] += vel[i * 3] * tt; pos[i * 3 + 1] += vel[i * 3 + 1] * tt - 4.9 * tt * tt; pos[i * 3 + 2] += vel[i * 3 + 2] * tt;
    vel[i * 3 + 1] -= 9.8 * tt;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const dropTex = cached('droplet', () => canvasTex(64, 64, (c) => {
    const gr = c.createRadialGradient(32, 32, 2, 32, 32, 30);
    gr.addColorStop(0, 'rgba(255,255,255,1)');
    gr.addColorStop(0.5, 'rgba(225,240,248,0.7)');
    gr.addColorStop(1, 'rgba(225,240,248,0)');
    c.fillStyle = gr;
    c.fillRect(0, 0, 64, 64);
  }, { mips: false }));
  const pts = new THREE.Points(g, new THREE.PointsMaterial({
    map: dropTex, size: 0.28, transparent: true, depthWrite: false, color: 0xe8f4fa, sizeAttenuation: true,
  }));
  pts.frustumCulled = false;
  root.add(pts);

  return {
    update(dt, t, cam) {
      tex.offset.set(Math.sin(t * 0.3) * 0.05, t * 0.02);
      const near = Math.abs(cam.x - x) < 90 && Math.abs(cam.z - z) < 90;
      pts.visible = near;
      if (!near) return;
      const h = Math.min(dt, 1 / 20);
      for (let i = 0; i < N; i++) {
        vel[i * 3 + 1] -= 9.8 * h;
        pos[i * 3] += vel[i * 3] * h;
        pos[i * 3 + 1] += vel[i * 3 + 1] * h;
        pos[i * 3 + 2] += vel[i * 3 + 2] * h;
        if (pos[i * 3 + 1] < 0.4) launch(i);
      }
      g.attributes.position.needsUpdate = true;
    },
  };
}

