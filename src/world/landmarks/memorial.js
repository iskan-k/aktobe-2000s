import * as THREE from 'three';
import { cel } from '../../core/toon.js';
import { SURF, TILE, hQuad, splitRect } from '../../core/surfaces.js';
import { canvasTex, cached, centerText, FONT, weather } from '../../core/textures.js';
import { rngKit } from '../../core/util.js';
import { defineLoop } from '../../core/audio.js';
import { addTree } from '../props/trees.js';
import { addBench, addLamp } from '../props/street.js';
import { Sculpt, STONE, METAL, plaqueTex, panel, plaque, axes, graniteBlock, statueMat, castLettersTex } from './kit.js';
import { starGeo } from './figure.js';
import { aliyaFigure, redArmyman } from './statues.js';
import { MAIN } from './heating.js';

/* ------------------------------------------------------------------ *
 * The Memorial of Glory, at the south end of ул. Пушкина, so the
 * obelisk closes the view down the street.
 *
 *   the Obelisk of Glory     19 m of red granite (1970), on three steps,
 *                            a gilt star near the top
 *   the Eternal Flame        a bronze burner in a five-pointed granite
 *                            star, in front of the obelisk; its light
 *                            flickers on the stone at dusk
 *   the name walls           two angled walls of red granite with black
 *                            stone panels of names, Kazakh on the left,
 *                            Russian on the right
 *   Aliya Moldagulova        the sniper from Aktobe region, Hero of the
 *                            Soviet Union, in her greatcoat with her rifle
 *                            (the statue dates from 1960; standing it here
 *                            is flavour, as is the ensemble itself)
 *   a T-34-85 on a plinth    as Soviet memorials of this kind had; which
 *                            piece stood in Aktobe is not checked
 *
 * Interactables: lay carnations at the flame (they stay there), and the
 * plaques of the obelisk, the statue and the tank.
 * ------------------------------------------------------------------ */

const X = -150;                // on the axis of ул. Пушкина
const Y = -0.015;              // paving, a hair above the grass strip
const FLAME = { x: X, z: 134.2 };
const OBELISK = { x: X, z: 141.6, h: 19 };
const TANK = { x: -178.5, z: 133, facing: -0.35 };
const ALIYA = { x: -121.5, z: 133, facing: 1.1 };   // turned toward the flame
const BACK = MAIN.z[0] - 1.1;   // the back edge, clear of the heating main

/* ---------------- textures ---------------- */

const SURNAMES = [
  'Абдрахманов', 'Абилов', 'Айтбаев', 'Алимбетов', 'Алтынсарин', 'Амангельдиев', 'Андреев', 'Ахметов', 'Байжанов', 'Бакиров',
  'Балгабаев', 'Беляев', 'Бисенов', 'Бондаренко', 'Васильев', 'Галиев', 'Гончаренко', 'Григорьев', 'Джаксыбеков', 'Дюсенов',
  'Ермеков', 'Есенгулов', 'Жакупов', 'Жанбосынов', 'Жумабаев', 'Жунусов', 'Зайцев', 'Иванов', 'Исмагулов', 'Калиев',
  'Карабаев', 'Касымов', 'Ковальчук', 'Козлов', 'Кожахметов', 'Кузнецов', 'Кульжанов', 'Кунаев', 'Лысенко', 'Мамбетов',
  'Мартыненко', 'Мухамеджанов', 'Нургалиев', 'Нуржанов', 'Оразов', 'Павленко', 'Петров', 'Рахимов', 'Сагындыков', 'Сарсенбаев',
  'Сатпаев', 'Сейткалиев', 'Смагулов', 'Соколов', 'Султанов', 'Тажибаев', 'Токтаров', 'Тулегенов', 'Утебаев', 'Федоренко',
  'Хабибуллин', 'Шевченко', 'Шарипов', 'Юсупов', 'Ябыров', 'Яковлев',
];
const INITIALS = 'АБГДЕЖКМНОПРСТУШ';

function namesTex(key, headKz, headRu, seed) {
  return cached(`memorial-names|${key}`, () => canvasTex(2048, 640, (c, W, H) => {
    const r = rngKit(seed);
    c.fillStyle = '#26282b';
    c.fillRect(0, 0, W, H);
    // polished stone: faint diagonal sheen
    const g = c.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, 'rgba(255,255,255,0.05)');
    g.addColorStop(0.5, 'rgba(255,255,255,0)');
    g.addColorStop(1, 'rgba(255,255,255,0.04)');
    c.fillStyle = g;
    c.fillRect(0, 0, W, H);
    const gold = '#d6bd7e';
    centerText(c, headKz, W / 2, 46, W * 0.9, 44, gold, { family: FONT.serif, weight: '700' });
    centerText(c, headRu, W / 2, 96, W * 0.9, 34, gold, { family: FONT.serif, weight: '600' });
    c.fillStyle = gold;
    c.fillRect(W * 0.2, 124, W * 0.6, 2);
    // five panels of names in two columns each, sorted as a wall would be
    const panels = 5, cols = 2, rows = 14;
    const pw = W / panels;
    const names = [];
    for (let i = 0; i < panels * cols * rows; i++) {
      names.push(`${r.pick(SURNAMES)} ${INITIALS[r.int(0, INITIALS.length - 1)]}.${INITIALS[r.int(0, INITIALS.length - 1)]}.`);
    }
    names.sort((a, b) => a.localeCompare(b, 'ru'));
    c.font = `600 24px ${FONT.serif}`;
    c.textBaseline = 'middle';
    const colW = pw / 2 - 30;
    const write = (t, x, y) => {
      const w = c.measureText(t).width;
      c.save();
      c.translate(x, y);
      if (w > colW) c.scale(colW / w, 1);
      c.fillText(t, 0, 0);
      c.restore();
    };
    let k = 0;
    for (let p = 0; p < panels; p++) {
      c.strokeStyle = 'rgba(214,189,126,0.35)';
      c.lineWidth = 2;
      c.strokeRect(p * pw + 10, 140, pw - 20, H - 156);
      for (let col = 0; col < cols; col++) {
        for (let row = 0; row < rows; row++) {
          c.fillStyle = gold;
          write(names[k++], p * pw + 24 + col * (pw / 2 - 6), 164 + row * 32);
        }
      }
    }
    weather(c, W, H, seed, 0.25);
  }));
}

function flameTex() {
  return cached('eternal-flame', () => canvasTex(128, 256, (c, W, H) => {
    c.clearRect(0, 0, W, H);
    // a tongue of flame, built up from soft layers so no edge reads hard:
    // a wide red-orange body, a yellow heart, a white-hot base
    const layer = (w, top, stops, blur) => {
      c.save();
      c.filter = `blur(${blur}px)`;
      const g = c.createLinearGradient(0, top, 0, H);
      stops.forEach(([o, col]) => g.addColorStop(o, col));
      c.fillStyle = g;
      c.beginPath();
      c.moveTo(W / 2, top);
      c.bezierCurveTo(W / 2 + w * 0.25, H * 0.3, W / 2 + w, H * 0.6, W / 2 + w * 0.6, H * 0.94);
      c.quadraticCurveTo(W / 2, H * 1.02, W / 2 - w * 0.6, H * 0.94);
      c.bezierCurveTo(W / 2 - w, H * 0.6, W / 2 - w * 0.25, H * 0.3, W / 2, top);
      c.fill();
      c.restore();
    };
    layer(W * 0.44, H * 0.04, [[0, 'rgba(160,30,0,0)'], [0.3, 'rgba(230,80,10,0.55)'], [1, 'rgba(255,140,30,0.9)']], 6);
    layer(W * 0.28, H * 0.3, [[0, 'rgba(255,170,40,0)'], [0.4, 'rgba(255,200,70,0.8)'], [1, 'rgba(255,230,140,1)']], 5);
    layer(W * 0.14, H * 0.62, [[0, 'rgba(255,250,220,0)'], [0.5, 'rgba(255,252,235,0.9)'], [1, 'rgba(255,255,245,1)']], 4);
  }, { mips: true }));
}

function glowTex() {
  return cached('flame-glow', () => canvasTex(128, 128, (c, W, H) => {
    const g = c.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, W / 2);
    g.addColorStop(0, 'rgba(255,170,70,0.9)');
    g.addColorStop(0.35, 'rgba(255,120,40,0.35)');
    g.addColorStop(1, 'rgba(255,90,20,0)');
    c.fillStyle = g;
    c.fillRect(0, 0, W, H);
  }));
}

/* ---------------- sound ---------------- */

// the burner: a low gas roar with a soft flutter in it
defineLoop('eternalFlame', (ac, out) => {
  const buf = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate);
  const d = buf.getChannelData(0);
  let b = 0;
  for (let i = 0; i < d.length; i++) { b = b * 0.97 + (Math.random() * 2 - 1) * 0.03; d[i] = b * 6; }
  const n = ac.createBufferSource();
  n.buffer = buf;
  n.loop = true;
  const lp = ac.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 420;
  const g = ac.createGain();
  g.gain.value = 0.0001;
  const lfo = ac.createOscillator();
  const lg = ac.createGain();
  lfo.frequency.value = 5.3;
  lg.gain.value = 90;
  lfo.connect(lg).connect(lp.frequency);
  n.connect(lp).connect(g).connect(out);
  n.start();
  lfo.start();
  return {
    set({ volume = 1 }) { g.gain.setTargetAtTime(Math.max(0.0001, volume * 0.5), ac.currentTime, 0.2); },
    stop() { g.gain.setTargetAtTime(0.0001, ac.currentTime, 0.2); setTimeout(() => { n.stop(); lfo.stop(); }, 600); },
  };
});

/* ---------------- ground ---------------- */

function lay(ctx, x0, z0, x1, z1, surf, tile, y = Y) {
  for (const [a, b, c, d] of splitRect(x0, z0, x1, z1, 40)) {
    ctx.batch.add(hQuad(a, b, c, d, y, tile), { mat: surf, color: null, cast: false });
  }
}

function grounds(ctx, z0) {
  lay(ctx, -192, z0, -108, BACK, SURF.grass, TILE.grass, Y - 0.002);
  lay(ctx, X - 4, z0, X + 4, 131, SURF.slabs, TILE.slabs);                  // central alley
  lay(ctx, -170, 130.5, -130, BACK - 0.2, SURF.slabs, TILE.slabs);                 // the forecourt round the flame and obelisk
  lay(ctx, -190, z0, -166, 137.5, SURF.slabs, TILE.slabs, Y + 0.001);       // tank corner
  lay(ctx, -134, z0, -110, 137.5, SURF.slabs, TILE.slabs, Y + 0.001);       // statue corner
  // a kerb of granite round the paving
  const b = ctx.batch;
  b.box(84, 0.14, 0.2, STONE.greyGranite, X, Y, BACK + 0.1, { cast: false });
  for (const x of [-192, -108]) b.box(0.2, 0.14, BACK + 0.1 - z0, STONE.greyGranite, x, Y, (BACK + 0.1 + z0) / 2, { cast: false });
}

/* ---------------- obelisk ---------------- */

function obelisk(ctx) {
  const { batch: b, colliders, ground, root } = ctx;
  const { x, z, h } = OBELISK;
  // three walkable steps of red granite
  const steps = [[9, 0.3], [7.6, 0.3], [6.2, 0.3]];
  steps.forEach(([s, t], i) => {
    graniteBlock(b, s, t, s, i % 2 ? STONE.graniteDark : STONE.granite, x, i * t, z, { c: 0.035 });
    ground.flat(x - s / 2, z - s / 2, x + s / 2, z + s / 2, (i + 1) * t, 'monument');
  });
  // the plinth: base course, a die of two courses, a moulded cornice
  const py = 0.9;
  graniteBlock(b, 3.6, 0.35, 3.6, STONE.graniteDark, x, py, z, { c: 0.05 });
  graniteBlock(b, 3.2, 1.1, 3.2, STONE.granite, x, py + 0.35, z, { c: 0.03 });
  graniteBlock(b, 3.2, 1.1, 3.2, STONE.granite, x, py + 1.45, z, { c: 0.03 });
  graniteBlock(b, 3.34, 0.12, 3.34, STONE.graniteDark, x, py + 2.55, z, { c: 0.03 });
  graniteBlock(b, 3.52, 0.18, 3.52, STONE.graniteDark, x, py + 2.67, z, { c: 0.06, top: [3.4, 3.4] });
  colliders.box(x - 1.8, z - 1.8, x + 1.8, z + 1.8, { tag: 'obelisk' });

  // the shaft: courses of granite tapering from 2.2 m to 1.3 m, each block
  // chamfered so the joints show, a slight change of tone course to course
  const y0 = py + 2.85, y1 = h - 1.6;
  const width = (y) => 2.2 - 0.9 * ((y - y0) / (y1 - y0));
  const rng = rngKit(1970);
  const courses = 11;
  for (let i = 0; i < courses; i++) {
    const a = y0 + ((y1 - y0) * i) / courses, c = y0 + ((y1 - y0) * (i + 1)) / courses;
    const tone = new THREE.Color(STONE.granite).multiplyScalar(rng.range(0.94, 1.05)).getHex();
    graniteBlock(b, width(a), c - a, width(a), tone, x, a, z, { c: 0.025, top: [width(c), width(c)] });
  }
  // the pyramidion
  graniteBlock(b, 1.3, h - y1, 1.3, STONE.graniteDark, x, y1, z, { c: 0.02, top: [0.05, 0.05] });

  // on the face toward the street: the gilt star in a laurel wreath near
  // the top, and the years in bronze figures down the shaft
  const lean = Math.atan2(0.45, y1 - y0);
  const faceZ = (y) => z - width(y) / 2 - 0.005;
  const sy = y1 - 2.4;
  const st = starGeo(0.6, 0.1);
  st.rotateX(lean);
  st.translate(x, sy, faceZ(sy));
  b.add(st, { color: METAL.gilt, mat: statueMat() });
  const w = new Sculpt(b, x, sy, faceZ(sy), 0, 1, { statue: true });
  laurel(w, 0.95, lean);
  const years = panel(root, castLettersTex('obelisk-years', [['1941', 1], ['', 0.4], ['1945', 1]], { w: 256, h: 512 }),
    1.0, 2.0, x, y0 + 3.1, faceZ(y0 + 4.1) - 0.01, 0, { alphaTest: 0.5, grime: 0 });
  years.rotation.x = lean;

  // the Red Army man on his block in front of the plinth, looking down
  // at the flame, the dedication cut into the block
  const bz = z - 2.45;
  graniteBlock(b, 2.2, 0.62, 1.4, STONE.graniteDark, x, py, bz, { c: 0.04 });
  colliders.box(x - 1.1, bz - 0.7, x + 1.1, bz + 0.7, { tag: 'obelisk' });
  redArmyman(new Sculpt(b, x, py + 0.62, bz + 0.05, 0, 2.4, { statue: true }));
  panel(root, castLettersTex('obelisk-block', [['МӘҢГІ ДАҢҚ', 1], ['ВЕЧНАЯ СЛАВА', 1]], { w: 1024, h: 256 }),
    1.9, 0.48, x, py + 0.07, bz - 0.712, 0, { alphaTest: 0.5, grime: 0 });
  // the dedication on the sides of the plinth
  for (const s of [-1, 1]) {
    panel(root, plaqueTex('obelisk', ['1918 – 1920 · 1941 – 1945', 'ОТАН ҮШІН ҚАЗА ТАПҚАН', 'АҚТӨБЕЛІКТЕРГЕ', 'АКТЮБИНЦАМ, ПАВШИМ ЗА РОДИНУ'], { bg: '#4a3b27', fg: '#e3cc8e' }),
      2.1, 1.3, x + s * 1.612, py + 0.85, z, s > 0 ? -Math.PI / 2 : Math.PI / 2);
  }
  plaque(ctx, {
    x, z: z - 3.6, y: 1.5, label: 'Read the obelisk',
    title: 'Даңқ обелискі · Обелиск Славы',
    body: 'Воздвигнут в 1970 году (архитектор Т. Джанысбеков, скульптор Н. Соболев) в честь актюбинцев, павших за Родину в годы Гражданской и Великой Отечественной войн. Гранит, 19 метров. Красноармеец в будёновке поднял шашку и смотрит на Вечный огонь.',
  });
}

/**
 * A laurel wreath in relief round the origin: two branches of paired
 * leaves meeting at the top, tied with a ribbon at the bottom. Laid on a
 * face leaning back by `lean`.
 */
function laurel(s, r, lean) {
  const G = METAL.gilt;
  const n = 16;
  for (const side of [-1, 1]) {
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1);
      const a = -Math.PI / 2 + side * (0.25 + t * 2.45);
      const px = Math.cos(a) * r, py = Math.sin(a) * r;
      const out = 0.06 * (1 - t * 0.5);
      const size = 0.13 * (1 - t * 0.45);
      for (const k of [-1, 1]) {
        const ox = Math.cos(a) * out * k, oy = Math.sin(a) * out * k;
        const lx = px + ox, ly = py + oy;
        const zr = ly * Math.tan(lean);
        s.ball([lx, ly, zr - 0.02], [size * 0.38, size, 0.03], G, 7, [0, 0, a + k * 0.55]);
      }
    }
    // the stem
    const pts = [];
    for (let i = 0; i <= 6; i++) {
      const a = -Math.PI / 2 + side * (0.25 + (i / 6) * 2.45);
      pts.push([Math.cos(a) * r, Math.sin(a) * r, Math.sin(a) * r * Math.tan(lean) - 0.015]);
    }
    s.sweep(pts, 0.018, G, { seg: 5 });
  }
  // the ribbon knot and its tails
  s.ball([0, -r, -r * Math.tan(lean) - 0.03], [0.09, 0.07, 0.04], G, 8);
  for (const side of [-1, 1]) {
    s.box(0.07, 0.34, 0.02, [side * 0.12, -r - 0.2, -(r + 0.2) * Math.tan(lean) - 0.02], G, [lean, 0, side * 0.35]);
  }
}

/** Five-pointed star, flat, facing -z (toward the street), centred at (x, y, z). */
function star(b, x, y, z, r, color, depth = 0.05) {
  const s = new THREE.Shape();
  for (let i = 0; i < 10; i++) {
    const a = Math.PI / 2 + (i * Math.PI) / 5, rr = i % 2 ? r * 0.4 : r;
    if (i) s.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); else s.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
  }
  const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: false });
  g.rotateY(Math.PI);
  g.translate(x, y, z);
  b.add(g, { color });
}

/* ---------------- the Eternal Flame ---------------- */

function eternalFlame(ctx) {
  const { batch: b, colliders, ground, root } = ctx;
  const { x, z } = FLAME;
  // a low round platform, then the star, then the bronze burner
  b.cyl(4.2, 0.16, STONE.greyGranite, x, Y, z, { seg: 32 });
  ground.flat(x - 3, z - 3, x + 3, z + 3, 0.15, 'flame');
  const s = new THREE.Shape();
  for (let i = 0; i < 10; i++) {
    const a = Math.PI / 2 + (i * Math.PI) / 5, rr = i % 2 ? 0.72 : 1.75;
    if (i) s.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); else s.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
  }
  const hole = new THREE.Path();
  hole.absarc(0, 0, 0.45, 0, Math.PI * 2, true);
  s.holes.push(hole);
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.42, bevelEnabled: true, bevelThickness: 0.04, bevelSize: 0.04, bevelSegments: 1 });
  g.rotateX(-Math.PI / 2);
  g.translate(x, 0.16, z);
  b.add(g, { color: STONE.granite });
  b.cyl(0.46, 0.5, METAL.bronzeDark, x, 0.16, z, { seg: 18 });
  b.cyl(0.36, 0.05, 0x1a1512, x, 0.64, z, { seg: 18 });
  colliders.circle(x, z, 1.6, { top: 0.6, tag: 'flame' });

  // the flame: three crossed tongues that stretch and sway, and a glow
  const mat = new THREE.MeshBasicMaterial({
    map: flameTex(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide, toneMapped: false, fog: false,
  });
  const flame = new THREE.Group();
  flame.position.set(x, 0.62, z);
  const tongues = [];
  for (let i = 0; i < 4; i++) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(0.75, 1.35), mat);
    m.geometry.translate(0, 0.6, 0);
    m.rotation.y = (i * Math.PI) / 4;
    m.renderOrder = 3;
    flame.add(m);
    tongues.push(m);
  }
  root.add(flame);
  const glowMat = new THREE.MeshBasicMaterial({
    map: glowTex(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, fog: false,
    polygonOffset: true, polygonOffsetFactor: -2,
  });
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(5.2, 5.2), glowMat);
  glow.rotation.x = -Math.PI / 2;
  glow.position.set(x, 0.6, z);
  glow.renderOrder = 2;
  root.add(glow);
  // a small warm light of its own, short range so it only touches the star
  const light = new THREE.PointLight(0xff9a3a, 6, 7, 2);
  light.position.set(x, 1.3, z);
  root.add(light);

  // carnations laid on the arms of the star, heads toward the flame,
  // hidden until someone lays them
  const bouquets = [];
  const stemMat = cel({ color: 0x3f6b2e, cache: false });
  const headMat = cel({ color: 0xc8202a, cache: false });
  const stem = new THREE.CylinderGeometry(0.018, 0.04, 0.5, 5);
  stem.rotateZ(Math.PI / 2);
  const head = new THREE.SphereGeometry(0.06, 7, 5);
  for (let i = 0; i < 10; i++) {
    // arm tips of the star lie at 90 degrees plus fifths of a turn
    const th = Math.PI / 2 + Math.floor(i / 2) * (Math.PI * 2 / 5) + (i % 2 ? 0.1 : -0.1);
    const dx = Math.cos(th), dz = -Math.sin(th);
    const gq = new THREE.Group();
    gq.add(new THREE.Mesh(stem, stemMat));
    for (let k = 0; k < 5; k++) {
      const h = new THREE.Mesh(head, headMat);
      h.position.set(-0.28 - (k % 2) * 0.04, 0.03, (k - 2) * 0.045);
      gq.add(h);
    }
    const rr = i % 2 ? 1.2 : 1.05;
    gq.position.set(x + dx * rr, 0.66, z + dz * rr);
    gq.rotation.y = Math.atan2(-dz, dx);
    gq.visible = false;
    root.add(gq);
    bouquets.push(gq);
  }
  let laid = 0;
  ctx.interact({
    x, y: 0.9, z: z - 1.2, w: 3.4, h: 1.4, d: 1.2,
    label: 'Lay red carnations at the Eternal Flame · 150 ₸',
    action: (game) => {
      if (!game.pay(150, 'carnations')) return;
      bouquets[laid % bouquets.length].visible = true;
      laid++;
      game.audio.play('paper', { pos: { x, y: 0.5, z }, volume: 0.7 });
      game.hud.flash('Вы возложили цветы · you laid five carnations at the flame', 3200);
    },
  });

  // three wreaths on stands behind the flame
  wreath(ctx, x - 2.6, z + 2.8, 0.25);
  wreath(ctx, x, z + 3.1, 0);
  wreath(ctx, x + 2.6, z + 2.8, -0.25);

  let t = 0;
  let roar = null;
  ctx.update((dt, game) => {
    t += dt;
    const cam = game.camera.position;
    const near = (cam.x - x) ** 2 + (cam.z - z) ** 2 < 140 * 140;
    flame.visible = glow.visible = near;
    // dim rather than hide: switching a light off changes the light count
    // and every material in town would recompile
    const lit = (cam.x - x) ** 2 + (cam.z - z) ** 2 < 60 * 60;
    if (!lit) light.intensity = 0;
    if (!near) return;
    for (let i = 0; i < 4; i++) {
      const n = Math.sin(t * 9.1 + i * 2.1) * 0.5 + Math.sin(t * 15.7 + i * 4.3) * 0.3 + Math.sin(t * 23.3 + i) * 0.2;
      tongues[i].scale.set(1 + n * 0.08, 1 + n * 0.22, 1);
      tongues[i].rotation.z = Math.sin(t * 3.1 + i) * 0.06;
    }
    const f = 0.85 + Math.sin(t * 11.3) * 0.08 + Math.sin(t * 17.9) * 0.07;
    light.intensity = lit ? 6 * f : 0;
    glow.material.opacity = f;
    if (!roar && game.audio.ready) roar = game.audio.loop('eternalFlame', { pos: { x, y: 1, z }, volume: 1 });
  });
}

function wreath(ctx, x, z, ry) {
  const b = ctx.batch;
  const rng = rngKit(Math.round(x * 10 + z));
  // two thin legs and a ring of fir leaning back on them
  const s = new Sculpt(b, x, 0.16, z, ry);
  s.limb([-0.35, 0, 0.15], [-0.25, 1.2, 0.35], 0.015, 0.015, 0x3a2f24, 4);
  s.limb([0.35, 0, 0.15], [0.25, 1.2, 0.35], 0.015, 0.015, 0x3a2f24, 4);
  const ring = new THREE.TorusGeometry(0.52, 0.13, 6, 16);
  ring.rotateX(-0.28);
  ring.translate(0, 0.95, 0.18);
  s.geo(ring, 0x2f5530);
  // flower heads dotted round the ring
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2;
    s.ball([Math.cos(a) * 0.52, 0.95 + Math.sin(a) * 0.5, 0.18 - Math.sin(a) * 0.14 - 0.1], 0.06, rng.pick([0xc8202a, 0xe8e2d6, 0xd84a2a]), 5);
  }
  // the ribbon across the lower half, red with white letters
  s.box(0.34, 0.5, 0.02, [0.12, 0.62, 0.05], 0xb8242a, [-0.28, 0, 0.35]);
  s.box(0.34, 0.5, 0.02, [-0.14, 0.6, 0.05], 0xb8242a, [-0.28, 0, -0.3]);
}

/* ---------------- the name walls ---------------- */

function nameWalls(ctx) {
  const { batch: b, colliders, root } = ctx;
  const walls = [
    { x: -164.5, z: 143.4, ry: -0.42, key: 'kz', kz: 'ОТАН ҮШІН ҚАЗА ТАПҚАНДАР', ru: 'Ақтөбеліктер · 1941–1945', seed: 51 },
    { x: -135.5, z: 143.4, ry: 0.42, key: 'ru', kz: 'ПАВШИЕ ЗА РОДИНУ', ru: 'Актюбинцы · 1941–1945', seed: 52 },
  ];
  const L = 17, H = 3.3, T = 0.7;
  for (const w of walls) {
    graniteBlock(b, L + 0.6, 0.4, T + 0.5, STONE.graniteDark, w.x, Y, w.z, { ry: w.ry, c: 0.04 });
    for (let k = 0; k < 4; k++) graniteBlock(b, L / 4, H, T, STONE.granite, w.x + Math.cos(w.ry) * (k - 1.5) * (L / 4), 0.4, w.z - Math.sin(w.ry) * (k - 1.5) * (L / 4), { ry: w.ry, c: 0.025 });
    graniteBlock(b, L + 0.4, 0.22, T + 0.2, STONE.graniteDark, w.x, 0.4 + H, w.z, { ry: w.ry, c: 0.05 });
    colliders.obb(w.x, w.z, L / 2 + 0.3, T / 2 + 0.25, w.ry, { top: H + 0.6, tag: 'wall' });
    // the black name panel on the face toward the obelisk forecourt
    const fx = -Math.sin(w.ry), fz = -Math.cos(w.ry);
    const m = panel(root, namesTex(w.key, w.kz, w.ru, w.seed), L - 1, 2.6, w.x + fx * (T / 2 + 0.012), 0.75, w.z + fz * (T / 2 + 0.012), w.ry,
      { bands: 3 });
    m.receiveShadow = true;
    // a bed of red and white flowers along the foot of the wall: soil,
    // clumps of leaves, and the heads scattered over them
    const rng = rngKit(w.seed);
    const along = (a, off) => [w.x + Math.cos(w.ry) * a + fx * off, w.z - Math.sin(w.ry) * a + fz * off];
    const [bx, bz] = along(0, T / 2 + 0.55);
    b.box(L - 0.4, 0.2, 0.9, 0x4f3a2a, bx, Y, bz, { ry: w.ry, cast: false });
    for (let i = 0; i < 70; i++) {
      const [lx, lz] = along(rng.range(-L / 2 + 0.4, L / 2 - 0.4), T / 2 + 0.55 + rng.range(-0.3, 0.3));
      b.box(0.3, 0.12, 0.3, rng.pick([0x3f6b2e, 0x4a7a36]), lx, 0.18, lz, { ry: rng.range(0, 3), cast: false });
    }
    for (let i = 0; i < 160; i++) {
      const [hx, hz] = along(rng.range(-L / 2 + 0.4, L / 2 - 0.4), T / 2 + 0.55 + rng.range(-0.34, 0.34));
      b.box(0.09, 0.07, 0.09, rng.chance(0.75) ? 0xc42f2a : 0xeee8dc, hx, 0.27 + rng.range(0, 0.06), hz, { ry: rng.range(0, 3), cast: false });
    }
  }
}

/* ---------------- Aliya Moldagulova ---------------- */

function moldagulova(ctx) {
  const { batch: b, colliders, root } = ctx;
  const { x, z, facing } = ALIYA;
  const { fx, fz, rx, rz } = axes(facing);
  // grey granite stylobate, then the red granite pedestal of the 2005
  // monument: 2.43 m of plinth, shaft and cornice
  graniteBlock(b, 4.4, 0.16, 4.4, STONE.greyDark, x, Y, z, { ry: facing, c: 0.03 });
  graniteBlock(b, 3.9, 0.14, 3.9, STONE.greyGranite, x, Y + 0.16, z, { ry: facing, c: 0.03 });
  const y0 = Y + 0.3;
  graniteBlock(b, 2.2, 0.36, 2.2, STONE.graniteDark, x, y0, z, { ry: facing, c: 0.05 });
  graniteBlock(b, 1.9, 1.72, 1.9, STONE.granite, x, y0 + 0.36, z, { ry: facing, c: 0.03, top: [1.82, 1.82] });
  graniteBlock(b, 2.06, 0.12, 2.06, STONE.graniteDark, x, y0 + 2.08, z, { ry: facing, c: 0.03 });
  graniteBlock(b, 2.24, 0.23, 2.24, STONE.graniteDark, x, y0 + 2.2, z, { ry: facing, c: 0.06 });
  const top = y0 + 2.43;
  colliders.obb(x, z, 1.15, 1.15, facing, { tag: 'statue' });
  colliders.obb(x, z, 2.2, 2.2, facing, { top: 0.3, tag: 'stylobate' });

  // the figure, 3.5 m of bronze
  aliyaFigure(new Sculpt(b, x, top, z, facing, 2.0, { statue: true }));

  // her name in bronze letters on the front, the gold star above it
  const face = 0.955 + 0.012;
  panel(root, castLettersTex('aliya', [['ӘЛИЯ', 1], ['МОЛДАҒҰЛОВА', 1], ['1925 – 1944', 0.7]]),
    1.6, 0.95, x + fx * face, y0 + 0.62, z + fz * face, facing, { alphaTest: 0.5, grime: 0 });
  const st = starGeo(0.17, 0.05);
  st.rotateY(facing);
  st.translate(x + fx * (face - 0.02), y0 + 1.83, z + fz * (face - 0.02));
  b.add(st, { color: METAL.gilt, mat: statueMat() });
  // the soldier's helmet and kitbag cast in bronze on the stylobate
  const k = new Sculpt(b, x + fx * 1.55 + rx * 0.7, Y + 0.3, z + fz * 1.55 + rz * 0.7, facing + 0.5, 1, { statue: true });
  k.ball([0, 0.02, 0], [0.2, 0.17, 0.22], METAL.bronzeDark, 14);
  k.loft([{ y: 0.0, rx: 0.235, rf: 0.255 }, { y: 0.03, rx: 0.22, rf: 0.24 }], METAL.bronzeDark, { seg: 20, capTop: true, capBottom: true });
  k.ball([0.5, 0.17, 0.25], [0.2, 0.19, 0.16], METAL.bronze, 12, [0, 0.4, 0.1]);
  k.loft([{ y: 0.3, x: 0.5, z: 0.25, rx: 0.08, rf: 0.06 }, { y: 0.38, x: 0.5, z: 0.25, rx: 0.04, rf: 0.03 }], METAL.bronze, { seg: 10, capTop: true });
  k.sweep([[0.36, 0.3, 0.2], [0.3, 0.16, 0.02], [0.44, 0.02, -0.1]], 0.012, METAL.bronzeDark, { seg: 5 });

  plaque(ctx, {
    x: x + fx * 1.9, z: z + fz * 1.9, y: 1.4, label: 'Read the pedestal · Алия Молдагулова',
    title: 'Әлия Молдағұлова · Алия Молдагулова',
    body: 'Снайпер, уроженка Актюбинской области, на её счету 78 солдат и офицеров противника. Погибла 14 января 1944 года под Новосокольниками. Герой Советского Союза (посмертно). Бронзовая фигура высотой 3,5 м открыта в 2005 году; её бюст 1960 года стоит в старом городе, на улице Шернияза.',
  });
}

/* ---------------- T-34-85 ---------------- */

function t34(ctx) {
  const { batch: b, colliders } = ctx;
  const { x, z, facing } = TANK;
  // a sloped concrete plinth faced in granite, the tank rolled up onto it
  b.box(8.6, 0.25, 4.6, STONE.greyGranite, x, Y, z, { ry: facing });
  b.box(8.0, 1.25, 4.0, STONE.greyDark, x, 0.25, z, { ry: facing });
  colliders.obb(x, z, 4.3, 2.3, facing, { top: 3.9, tag: 'tank' });
  const s = new Sculpt(b, x, 1.5, z, facing);
  const K = METAL.khaki, KD = METAL.khakiDark, TR = 0x2a2a28;
  // tracks: a long box with rounded ends, five big road wheels showing
  for (const side of [-1, 1]) {
    const tx = side * 1.26;
    s.box(0.5, 0.72, 5.1, [tx, 0.42, 0], TR);
    s.limb([tx - 0.25, 0.42, -2.55], [tx + 0.25, 0.42, -2.55], 0.36, 0.36, TR, 10);
    s.limb([tx - 0.25, 0.45, 2.55], [tx + 0.25, 0.45, 2.55], 0.33, 0.33, TR, 10);
    for (let i = 0; i < 5; i++) {
      const wz = -2.1 + i * 1.05;
      s.limb([tx + side * 0.26, 0.42, wz], [tx + side * 0.27, 0.42, wz], 0.4, 0.4, 0x3a3a36, 14);
      s.limb([tx + side * 0.27, 0.42, wz], [tx + side * 0.3, 0.42, wz], 0.18, 0.12, K, 10);
    }
  }
  // hull: side profiles extruded across, the lower body between the
  // tracks and the upper hull over them with its long sloped glacis
  s.geo(hullSlab([[-3.0, 0.78], [-2.55, 0.3], [2.85, 0.3], [3.05, 0.78]], 1.95), K);
  s.geo(hullSlab([[-3.05, 0.78], [-1.75, 1.4], [2.35, 1.4], [3.1, 1.0], [3.1, 0.78]], 3.0), K);
  s.box(3.04, 0.05, 6.1, [0, 0.76, 0.02], KD);                 // the fender line
  s.box(0.5, 0.06, 0.36, [0.55, 1.08, -2.45], KD, [-0.44, 0, 0]);  // driver's hatch
  s.limb([0.7, 1.05, 3.05], [0.7, 0.95, 3.35], 0.1, 0.1, KD, 8);  // exhausts
  s.limb([-0.7, 1.05, 3.05], [-0.7, 0.95, 3.35], 0.1, 0.1, KD, 8);
  for (const side of [-1, 1]) s.box(0.22, 0.22, 0.9, [side * 1.3, 0.9, 1.9], KD);   // fuel drums on the fenders
  // turret: a squat cast shape, the mantlet, the long 85 mm gun
  s.ball([0, 1.82, -0.35], [1.12, 0.42, 1.45], K, 14);
  s.box(1.9, 0.5, 2.3, [0, 1.55, -0.3], K);
  s.box(0.9, 0.55, 0.45, [0, 1.8, -1.72], KD);
  s.limb([0, 1.82, -1.9], [0, 1.9, -6.4], 0.1, 0.075, KD, 10);
  s.limb([0, 1.9, -6.0], [0, 1.9, -6.45], 0.1, 0.1, KD, 10);
  s.limb([-0.35, 2.15, 0.2], [-0.35, 2.4, 0.2], 0.33, 0.3, KD, 12);   // cupola
  // red stars on the turret sides
  for (const side of [-1, 1]) {
    const st = new THREE.Shape();
    for (let i = 0; i < 10; i++) {
      const a = Math.PI / 2 + (i * Math.PI) / 5, rr = i % 2 ? 0.1 : 0.25;
      if (i) st.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); else st.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
    }
    const g = new THREE.ShapeGeometry(st);
    g.rotateY(side * Math.PI / 2);
    g.translate(side * 1.14, 1.82, -0.3);
    s.geo(g, 0xb8242a);
  }
  const fx = -Math.sin(facing), fz = -Math.cos(facing);
  const rx = -fz, rz = fx;
  panel(ctx.root, plaqueTex('t34', ['Т-34-85', 'Жеңіс танкі · Танк Победы', '1941 – 1945'], { bg: '#4a3b27', fg: '#e3cc8e', h: 256 }),
    1.4, 0.7, x + rx * 0 + fx * 2.03, 0.55, z + rz * 0 + fz * 2.03, facing);
  plaque(ctx, {
    x: x + fx * 2.6, z: z + fz * 2.6, y: 1.2, label: 'Read the plaque · Т-34',
    title: 'Танк Т-34-85',
    body: 'Средний танк, главный танк Победы. Установлен на вечную стоянку в память о воинах-танкистах — актюбинцах.',
  });
}

/**
 * A slab of hull: a side profile of [z, y] points extruded `width` across
 * x and centred on it, in the tank's local space.
 */
function hullSlab(profile, width) {
  const sh = new THREE.Shape();
  profile.forEach(([z, y], i) => (i ? sh.lineTo(z, y) : sh.moveTo(z, y)));
  const g = new THREE.ExtrudeGeometry(sh, { depth: width, bevelEnabled: false });
  // shape x is the tank's z; the extrusion runs along x
  g.rotateY(-Math.PI / 2);
  g.translate(width / 2, 0, 0);
  return g;
}

/* ---------------- entrance, trees, benches ---------------- */

function entrance(ctx, z0) {
  const { batch: b, colliders, root } = ctx;
  for (const s of [-1, 1]) {
    // low granite blocks either side of the alley, so the flame shows
    // from the street over them
    const x = X + s * 8;
    graniteBlock(b, 2.4, 0.2, 1.1, STONE.graniteDark, x, Y, z0 + 1.2, { c: 0.03 });
    graniteBlock(b, 2.1, 1.25, 0.8, STONE.granite, x, 0.2, z0 + 1.2, { c: 0.04 });
    colliders.box(x - 1.2, z0 + 0.65, x + 1.2, z0 + 1.75, { tag: 'pylon' });
    star(b, x - s * 0.7, 0.88, z0 + 0.79, 0.24, METAL.gilt, 0.04);
  }
  panel(root, plaqueTex('memorial-sign', ['ДАҢҚ МЕМОРИАЛЫ', 'МЕМОРИАЛ СЛАВЫ'], { bg: '#5e2824', fg: '#e3cc8e', h: 200 }),
    1.1, 0.42, X - 7.8, 0.65, z0 + 0.78, 0);
  panel(root, plaqueTex('memorial-years', ['1941', '1945'], { bg: '#5e2824', fg: '#e3cc8e', h: 200 }),
    1.1, 0.42, X + 7.8, 0.65, z0 + 0.78, 0);
}

function planting(ctx, z0) {
  const { batch: b, colliders } = ctx;
  // blue spruces along the back and the sides, the formal tree of memorials
  const spots = [];
  for (let x = -186; x <= -114; x += 8) if (Math.abs(x - X) > 12) spots.push([x, BACK - 1.3]);
  for (const x of [-189, -111]) for (let z = z0 + 4; z < BACK - 2; z += 7) spots.push([x, z]);
  spots.forEach(([x, z], i) => {
    addTree(b, 'spruce', x, z, 2300 + i, { scale: 0.85 + (i % 3) * 0.08 });
    colliders.circle(x, z, 0.5, { top: 3 });
  });
  // benches facing the flame across the forecourt, and lamps
  for (const s of [-1, 1]) {
    for (const dz of [0, 3.4]) {
      addBench(b, X + s * 16, 133 + dz, s > 0 ? Math.PI / 2 : -Math.PI / 2, { style: 'park', color: 0x4f5f3a });
      colliders.box(X + s * 16 - 0.4, 133 + dz - 1, X + s * 16 + 0.4, 133 + dz + 1, { top: 0.5 });
    }
    addLamp(b, X + s * 13, z0 + 2.5, s > 0 ? -Math.PI / 2 : Math.PI / 2, { height: 6 });
    colliders.circle(X + s * 13, z0 + 2.5, 0.2, { top: 6 });
  }
}

/** Builds the memorial. The strip runs from the pavement edge z0 back to the heating main. */
export function buildMemorial(ctx, z0) {
  grounds(ctx, z0);
  obelisk(ctx);
  eternalFlame(ctx);
  nameWalls(ctx);
  moldagulova(ctx);
  t34(ctx);
  entrance(ctx, z0);
  planting(ctx, z0);
}

export const MEMORIAL = { x0: -192, x1: -108, x: X };
