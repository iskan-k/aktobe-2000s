import * as THREE from 'three';
import { cel } from './toon.js';
import { canvasTex, cached, FONT } from './textures.js';
import { mulberry32 } from './util.js';
import { m, glass, mesh, faceted, paperCone, pile } from './itemKit.js';
import { FOOD_ITEMS } from './itemsFood.js';

/* ------------------------------------------------------------------ *
 * Things you can hold and eat or drink, as small first-person models.
 *
 * Every model is built round its grip point: the origin is where the
 * fist closes, +y runs up the item. `stage(n)` shows it after n bites or
 * sips (0 = fresh, `bites` = finished) by shrinking the edible part,
 * cutting it back to a pale crumb, or lowering the drink. What is left
 * over (a stick, a can, a bottle, a paper cone) is `empty`, thrown into a
 * bin with E. Sizes are real: a 0.5 l bottle is 25 cm tall.
 *
 * `mode` picks the hand's motion: 'bite' brings the top to the mouth,
 * 'drink' tips the item up, 'pinch' takes one piece out of a cone.
 * ------------------------------------------------------------------ */

const C = {
  cream: 0xf7f0de, waffle: 0xd9a257, choc: 0x4a2a1c, stick: 0xdcc49a,
  crust: 0xb86d2c, crustDark: 0x8f4d1f, crumb: 0xf1e2bf, sesame: 0xf3e6c4,
  paper: 0xe9e4d6, kurt: 0xf4efe2, berry: 0xd2303a, leaf: 0x3f8a3a, seed: 0x2a2826,
};

/* ---------------- textures ---------------- */

function waffleTex() {
  return cached('item|waffle', () => canvasTex(128, 128, (c, w, h) => {
    c.fillStyle = '#d9a257';
    c.fillRect(0, 0, w, h);
    c.strokeStyle = '#a8702e';
    c.lineWidth = 5;
    for (let i = -h; i < w + h; i += 22) {
      c.beginPath(); c.moveTo(i, 0); c.lineTo(i + h, h); c.stroke();
      c.beginPath(); c.moveTo(i + h, 0); c.lineTo(i, h); c.stroke();
    }
    c.fillStyle = 'rgba(255,236,190,.35)';
    const rnd = mulberry32(41);
    for (let i = 0; i < 40; i++) c.fillRect(rnd() * w, rnd() * h, 3, 2);
  }, { repeat: [3, 1] }));
}

/** Newsprint for the seed cone: columns of grey "text" and a headline. */
function newsTex() {
  return cached('item|news', () => canvasTex(256, 256, (c, w, h) => {
    c.fillStyle = '#e7e2d3';
    c.fillRect(0, 0, w, h);
    c.fillStyle = '#3b3a38';
    c.font = `bold 30px ${FONT.serif}`;
    c.fillText('ДИАПАЗОН', 14, 38);
    c.fillStyle = '#8a8780';
    const rnd = mulberry32(7);
    for (let col = 0; col < 4; col++) {
      for (let y = 58; y < h - 8; y += 7) {
        const len = 44 + rnd() * 10 - (rnd() < 0.12 ? 22 : 0);
        c.fillRect(10 + col * 61, y, len, 3);
      }
    }
    c.fillStyle = '#6d6a64';
    c.fillRect(132, 70, 56, 44);
  }));
}

/** A paper label wrapped round a bottle: name, a drawing, the plant. */
function labelTex(kind) {
  return cached('item|label|' + kind, () => canvasTex(512, 128, (c, w, h) => {
    const L = {
      tarkhun: { bg: '#2f8a3c', band: '#f2e6b0', fg: '#12401a', name: 'ТАРХУН', sub: 'лимонад · 0,5 л' },
      buratino: { bg: '#e8a22a', band: '#fff2cf', fg: '#6a2b12', name: 'БУРАТИНО', sub: 'лимонад · 0,5 л' },
      duchess: { bg: '#e9d86a', band: '#fbf6e0', fg: '#5a4a12', name: 'ДЮШЕС', sub: 'грушевый · 0,5 л' },
    }[kind];
    c.fillStyle = L.bg;
    c.fillRect(0, 0, w, h);
    c.fillStyle = L.band;
    c.fillRect(0, 14, w, h - 28);
    c.fillStyle = L.bg;
    c.fillRect(0, 20, w, 3);
    c.fillRect(0, h - 23, w, 3);
    // the name repeated so it faces you whichever way the bottle turns
    for (const x0 of [0, w / 2]) {
      c.fillStyle = L.fg;
      c.font = `bold 38px ${FONT.display}`;
      c.textAlign = 'center';
      c.fillText(L.name, x0 + w / 4, 70);
      c.font = `18px ${FONT.narrow}`;
      c.fillText(L.sub, x0 + w / 4, 96);
      c.fillStyle = L.bg;
      if (kind === 'tarkhun') {
        for (let i = 0; i < 5; i++) {
          c.beginPath();
          c.ellipse(x0 + 30 + i * 9, 64 - i * 6, 4, 13, 0.5, 0, Math.PI * 2);
          c.fill();
        }
      } else if (kind === 'buratino') {
        // the golden key
        c.fillStyle = '#c98a1a';
        c.beginPath(); c.arc(x0 + 36, 62, 11, 0, Math.PI * 2); c.fill();
        c.fillRect(x0 + 44, 59, 30, 6);
        c.fillRect(x0 + 64, 65, 5, 9);
      } else {
        c.fillStyle = '#c6b23a';
        c.beginPath(); c.ellipse(x0 + 38, 70, 13, 17, 0, 0, Math.PI * 2); c.fill();
        c.beginPath(); c.arc(x0 + 38, 52, 8, 0, Math.PI * 2); c.fill();
      }
    }
  }));
}

/** The domed top crust of a brick loaf, with its diagonal scored cuts. */
function crustTex() {
  return cached('item|crust', () => canvasTex(128, 64, (c, w, h) => {
    c.fillStyle = '#b86d2c';
    c.fillRect(0, 0, w, h);
    const g = c.createLinearGradient(0, 0, w, 0);
    g.addColorStop(0, 'rgba(90,45,15,.35)'); g.addColorStop(0.5, 'rgba(255,210,140,.18)'); g.addColorStop(1, 'rgba(90,45,15,.35)');
    c.fillStyle = g;
    c.fillRect(0, 0, w, h);
    // the cut opens into a paler bake with dark edges
    c.save();
    c.translate(w / 2, h / 2);
    c.rotate(-0.35);
    c.fillStyle = '#7a3f14';
    c.fillRect(-w * 0.34, -7, w * 0.68, 14);
    c.fillStyle = '#e4b574';
    c.fillRect(-w * 0.32, -4, w * 0.64, 8);
    c.restore();
  }, { repeat: [1, 1] }));
}

/** A 2007 Pepsi can: deep blue, the red-white-blue globe, «Пепси». */
function pepsiTex() {
  return cached('item|pepsi', () => canvasTex(512, 256, (c, w, h) => {
    const g = c.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#1b3f95'); g.addColorStop(0.5, '#0f2d78'); g.addColorStop(1, '#0a1f55');
    c.fillStyle = g;
    c.fillRect(0, 0, w, h);
    for (const x0 of [0, w / 2]) {
      const cx = x0 + 80, cy = 128;
      c.fillStyle = '#ffffff';
      c.beginPath(); c.arc(cx, cy, 48, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#d8232a';
      c.beginPath(); c.arc(cx, cy, 46, Math.PI, 0); c.bezierCurveTo(cx + 30, cy - 10, cx - 20, cy + 10, cx - 46, cy); c.fill();
      c.fillStyle = '#1b56b8';
      c.beginPath(); c.arc(cx, cy, 46, 0, Math.PI); c.bezierCurveTo(cx - 30, cy + 22, cx + 20, cy - 2, cx + 46, cy); c.fill();
      c.fillStyle = '#ffffff';
      c.font = `bold 44px ${FONT.display}`;
      c.textAlign = 'left';
      c.fillText('ПЕПСИ', x0 + 138, 142);
      c.font = `16px ${FONT.narrow}`;
      c.fillText('0,33 л', x0 + 140, 170);
    }
    c.fillStyle = 'rgba(255,255,255,.18)';
    c.fillRect(0, 22, w, 4);
    c.fillRect(0, h - 26, w, 4);
  }));
}

/** Turbo gum: the orange and blue wrapper every kid kept the insert of. */
function turboTex() {
  return cached('item|turbo', () => canvasTex(256, 128, (c, w, h) => {
    c.fillStyle = '#f07a1a';
    c.fillRect(0, 0, w, h);
    c.fillStyle = '#1f4fa8';
    c.fillRect(0, h * 0.62, w, h * 0.38);
    c.fillStyle = '#ffffff';
    c.font = `italic bold 60px ${FONT.display}`;
    c.textAlign = 'center';
    c.fillText('turbo', w / 2, 70);
    c.font = `bold 20px ${FONT.narrow}`;
    c.fillText('BUBBLE GUM', w / 2, 112);
  }));
}

/* ---------------- the items ---------------- */

function plombir() {
  const g = new THREE.Group();
  const cup = mesh(new THREE.CylinderGeometry(0.034, 0.025, 0.058, 18, 1, false), cel({ map: waffleTex(), grime: 0, dirt: 0, bands: 3, cache: false }), 0, 0.029, 0);
  const rim = mesh(new THREE.TorusGeometry(0.035, 0.005, 5, 18), m(0xc98f45), 0, 0.058, 0).rotateX(Math.PI / 2);
  const scoop = new THREE.Group();
  scoop.position.y = 0.058;
  const ball = mesh(new THREE.SphereGeometry(0.036, 20, 12), m(C.cream, { bands: 'soft' }), 0, 0.012, 0);
  ball.scale.y = 0.9;
  // the frilled edge where the scoop meets the cup
  const frill = mesh(new THREE.TorusGeometry(0.031, 0.008, 6, 16), m(0xf1e8d2, { bands: 'soft' }), 0, 0.002, 0).rotateX(Math.PI / 2);
  scoop.add(ball, frill);
  g.add(cup, rim, scoop);
  return {
    group: g,
    stage(n) {
      // three bites of the ice cream, then two of the cup
      const k = [1, 0.78, 0.55, 0.3, 0, 0][n] ?? 0;
      scoop.visible = k > 0;
      scoop.scale.set(0.6 + 0.4 * k, k, 0.6 + 0.4 * k);
      const cupK = n <= 3 ? 1 : n === 4 ? 0.5 : 0;
      cup.visible = rim.visible = cupK > 0;
      cup.scale.y = cupK || 1;
      cup.position.y = 0.029 * (cupK || 1);
      rim.position.y = 0.058 * (cupK || 1);
    },
  };
}

function eskimo() {
  const g = new THREE.Group();
  const stick = mesh(new THREE.BoxGeometry(0.011, 0.07, 0.004), m(C.stick), 0, 0.02, 0);
  const bar = new THREE.Group();
  bar.position.y = 0.05;
  const body = mesh(new THREE.CylinderGeometry(0.019, 0.02, 1, 16), m(C.choc, { bands: 4 }));
  const top = mesh(new THREE.SphereGeometry(0.019, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), m(C.choc, { bands: 4 }));
  const bite = mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.004, 14), m(C.cream, { bands: 'soft' }));
  bar.add(body, top, bite);
  g.add(stick, bar);
  const H = 0.075;
  return {
    group: g,
    stage(n) {
      const len = H * [1, 0.75, 0.52, 0.28, 0][n];
      bar.visible = len > 0.001;
      body.scale.y = len;
      body.position.y = len / 2;
      top.visible = n === 0;
      top.position.y = len;
      // a bitten top shows the vanilla inside a chocolate rim
      bite.visible = n > 0 && len > 0.001;
      bite.position.y = len;
    },
  };
}

/** The Soviet brick loaf, «кирпичик»: tin-baked sides, a domed scored top. */
function loaf() {
  const g = new THREE.Group();
  const bread = new THREE.Group();
  // held by one end, the loaf reaches up and away
  bread.rotation.set(0, 0, 0);
  g.add(bread);
  const L = 0.2, W = 0.095, H = 0.075;
  const CUT_EVERY = 0.042;
  const sideMat = m(0xcf8f45), topMat = cel({ map: crustTex(), grime: 0, dirt: 0, bands: 4, cache: false }), crumbMat = m(C.crumb, { bands: 'soft' });
  const parts = [];
  function build(len) {
    for (const p of parts) bread.remove(p);
    parts.length = 0;
    if (len <= 0.001) return;
    const base = mesh(new THREE.BoxGeometry(W, len, H), sideMat, 0, len / 2 - 0.03, 0);
    const domeGeo = new THREE.CylinderGeometry(H * 0.62, H * 0.62, len, 14, 1, false, -Math.PI / 2, Math.PI);
    // one scored cut every 4 cm, however much of the loaf is left
    const uv = domeGeo.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setY(i, uv.getY(i) * (len / CUT_EVERY));
    const dome = mesh(domeGeo, topMat, W / 2 - 0.004, len / 2 - 0.03, 0);
    dome.scale.set(0.55, 1, 1);
    parts.push(base, dome);
    if (len < L - 0.001) {
      // the bitten end: pale crumb inside a rim of crust
      const face = mesh(new THREE.BoxGeometry(W * 0.94, 0.004, H * 0.94), crumbMat, 0, len - 0.03, 0);
      const cap = mesh(new THREE.CylinderGeometry(H * 0.58, H * 0.58, 0.004, 12, 1, false, -Math.PI / 2, Math.PI), crumbMat, W / 2 - 0.004, len - 0.03, 0);
      cap.scale.set(0.55, 1, 1);
      parts.push(face, cap);
    }
    for (const p of parts) bread.add(p);
  }
  build(L);
  return {
    group: g,
    stage(n) { build(L * [1, 0.82, 0.64, 0.46, 0.26, 0][n]); },
  };
}

/** Lepyoshka (нан): a round tandyr bread, thick rim, stamped centre, sesame. */
function lepyoshka() {
  const g = new THREE.Group();
  const bread = new THREE.Group();
  // held by the rim, tilted toward you
  bread.rotation.set(1.15, 0, 0.2);
  bread.position.set(0, 0.02, -0.08);
  g.add(bread);
  const R = 0.095, SEG = 8;
  const crust = m(C.crust, { side: THREE.DoubleSide }), centre = m(0xd7a15a, { side: THREE.DoubleSide });
  const seeds = m(C.sesame, { bands: 'soft' });
  const wedges = [];
  for (let i = 0; i < SEG; i++) {
    const w = new THREE.Group();
    const a0 = (i / SEG) * Math.PI * 2, da = (Math.PI * 2) / SEG;
    const rim = mesh(new THREE.CylinderGeometry(R, R, 0.028, 4, 1, false, a0, da), crust);
    const mid = mesh(new THREE.CylinderGeometry(R * 0.62, R * 0.62, 0.031, 4, 1, false, a0, da), centre, 0, 0.001, 0);
    w.add(rim, mid);
    for (let k = 0; k < 4; k++) {
      const a = a0 + da * (0.2 + 0.2 * k), d = R * (0.25 + 0.1 * ((k * 7 + i) % 5));
      w.add(mesh(new THREE.SphereGeometry(0.003, 5, 3), seeds, Math.sin(a) * d, 0.017, Math.cos(a) * d));
    }
    wedges.push(w);
    bread.add(w);
  }
  return {
    group: g,
    // eaten from the far side, two wedges a bite, the held piece last
    stage(n) { wedges.forEach((w, i) => { w.visible = i < SEG - n * 2; }); },
  };
}

function bottle(kind) {
  const liquid = { tarkhun: 0x46c24f, buratino: 0xd98a22, duchess: 0xe4d57a }[kind];
  const g = new THREE.Group();
  // lathe profile of the standard Soviet 0.5 l lemonade bottle
  const pts = [[0, 0], [0.033, 0], [0.035, 0.006], [0.035, 0.14], [0.03, 0.17], [0.015, 0.2], [0.0125, 0.235], [0.015, 0.24], [0.013, 0.248]]
    .map(([r, y]) => new THREE.Vector2(r, y));
  const body = mesh(new THREE.LatheGeometry(pts, 20), glass(0xcfe6d8, 0.4), 0, -0.07, 0);
  body.renderOrder = 2;
  const label = mesh(new THREE.CylinderGeometry(0.0355, 0.0355, 0.07, 20, 1, true), cel({ map: labelTex(kind), grime: 0, dirt: 0, bands: 3, cache: false }), 0, -0.07 + 0.075, 0);
  const drinkMat = cel({ color: liquid, grime: 0, dirt: 0, bands: 'soft', transparent: true, opacity: 0.85, depthWrite: false });
  const drink = mesh(new THREE.CylinderGeometry(0.031, 0.031, 1, 18), drinkMat);
  drink.renderOrder = 1;
  const neck = mesh(new THREE.CylinderGeometry(0.011, 0.024, 0.07, 14), drinkMat, 0, -0.07 + 0.19, 0);
  neck.renderOrder = 1;
  g.add(drink, neck, body, label);
  return {
    group: g,
    stage(n) {
      const level = [1, 0.72, 0.46, 0.22, 0][n];
      neck.visible = n === 0;
      drink.visible = level > 0;
      const h = 0.155 * level;
      drink.scale.y = h || 1;
      drink.position.y = -0.07 + 0.004 + h / 2;
    },
  };
}

function pepsi() {
  const g = new THREE.Group();
  const can = mesh(new THREE.CylinderGeometry(0.033, 0.033, 0.106, 22, 1, true), cel({ map: pepsiTex(), grime: 0, dirt: 0, bands: 3, cache: false }), 0, 0.02, 0);
  const alu = m(0xc9ccce, { bands: 4 });
  const top = mesh(new THREE.CylinderGeometry(0.028, 0.033, 0.008, 22), alu, 0, 0.077, 0);
  const bottom = mesh(new THREE.CylinderGeometry(0.033, 0.027, 0.008, 22), alu, 0, -0.037, 0);
  const hole = mesh(new THREE.BoxGeometry(0.012, 0.002, 0.016), m(0x1b1b1b), 0, 0.0815, -0.012);
  const tab = mesh(new THREE.BoxGeometry(0.01, 0.002, 0.02), alu, 0, 0.083, 0.004);
  tab.rotation.x = -0.5;
  g.add(can, top, bottom, hole, tab);
  return { group: g, stage() {} };
}

function kvass() {
  const g = new THREE.Group();
  // the гранёный стакан: sixteen facets and a smooth band at the rim
  const glassBody = mesh(faceted(0.036, 0.03, 0.105, 16, true), glass(0xd8e4e0, 0.22), 0, 0.03, 0);
  glassBody.renderOrder = 2;
  const band = mesh(new THREE.CylinderGeometry(0.0365, 0.036, 0.016, 16, 1, true), glass(0xe4ece8, 0.45), 0, 0.075, 0);
  band.renderOrder = 2;
  const foot = mesh(faceted(0.03, 0.03, 0.008, 16), glass(0xd8e4e0, 0.55), 0, -0.02, 0);
  const drink = mesh(faceted(0.033, 0.028, 1, 16), cel({ color: 0x3e1f0a, grime: 0, dirt: 0, bands: 3, transparent: true, opacity: 0.95, depthWrite: false }));
  drink.renderOrder = 1;
  const foam = mesh(new THREE.CylinderGeometry(0.0335, 0.033, 0.008, 16), m(0xe8d7b0, { bands: 'soft' }));
  g.add(drink, foam, foot, glassBody, band);
  return {
    group: g,
    stage(n) {
      const level = [1, 0.62, 0.3, 0][n];
      const h = 0.092 * level;
      drink.visible = foam.visible = level > 0;
      drink.scale.y = h || 1;
      drink.position.y = -0.016 + h / 2;
      foam.position.y = -0.016 + h;
      foam.scale.set(0.84 + 0.16 * level, 1, 0.84 + 0.16 * level);
    },
  };
}

/** A cone of something eaten a piece at a time: seeds, kurt, strawberries. */
function coneOf(kind) {
  const g = new THREE.Group();
  const isNews = kind === 'seeds' || kind === 'kurt';
  paperCone(g, isNews ? newsTex() : null, isNews ? 0xffffff : 0xeae3d0);
  const heap = new THREE.Group();
  heap.position.y = 0.128;
  g.add(heap);
  let pieces;
  if (kind === 'seeds') {
    const geo = new THREE.SphereGeometry(0.006, 6, 4);
    geo.scale(1, 0.4, 0.58);
    const mat = m(C.seed, { bands: 4 });
    pieces = pile(46, 0.04, () => new THREE.Mesh(geo, mat), 7);
  } else if (kind === 'kurt') {
    const geo = new THREE.IcosahedronGeometry(0.014, 1);
    const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) p.setXYZ(i, p.getX(i) * (0.9 + ((i * 37) % 7) * 0.03), p.getY(i) * 0.85, p.getZ(i));
    geo.computeVertexNormals();
    const mat = m(C.kurt, { bands: 'soft' });
    pieces = pile(5, 0.022, () => new THREE.Mesh(geo, mat), 3);
  } else {
    const geo = new THREE.ConeGeometry(0.013, 0.026, 9);
    geo.rotateX(Math.PI);
    const cap = new THREE.ConeGeometry(0.012, 0.006, 6);
    const mat = m(C.berry, { bands: 4 }), leaf = m(C.leaf);
    pieces = pile(10, 0.03, () => {
      const b = new THREE.Group();
      b.add(new THREE.Mesh(geo, mat), mesh(cap, leaf, 0, 0.014, 0));
      return b;
    }, 11);
  }
  for (const p of pieces) heap.add(p);
  const bites = { seeds: 5, kurt: 5, strawberries: 5 }[kind];
  return {
    group: g,
    stage(n) {
      const left = 1 - n / bites;
      const keep = Math.round(pieces.length * left);
      pieces.forEach((p, i) => { p.visible = i < keep; });
      // what is left settles down into the narrowing cone
      heap.position.y = 0.128 - (1 - left) * 0.05;
      heap.scale.setScalar(0.6 + 0.4 * left);
    },
  };
}

function turbo() {
  const g = new THREE.Group();
  const pack = mesh(new THREE.BoxGeometry(0.05, 0.022, 0.007), cel({ map: turboTex(), grime: 0, dirt: 0, bands: 3, cache: false }), 0, 0.02, 0);
  const wrapper = mesh(new THREE.BoxGeometry(0.05, 0.022, 0.002), m(0xf1ece0), 0, 0.02, 0);
  g.add(pack, wrapper);
  wrapper.visible = false;
  return {
    group: g,
    stage(n) { pack.visible = n === 0; wrapper.visible = n > 0; wrapper.rotation.z = 0.3; },
  };
}

/* ---------------- the catalogue ---------------- */

/**
 * Everything you can hold. `grip` is the fist's half-width at the grip
 * (how far the palm sits from the item's axis), `lift` how far the item
 * rises to reach the mouth, `done` the line shown when it is finished.
 */
export const ITEMS = {
  plombir: { name: 'пломбир', make: plombir, bites: 5, mode: 'bite', sound: 'lick', last: 'crunch', grip: 0.03, lift: 0.06, done: 'The last of the waffle cup. Sticky fingers.' },
  eskimo: { name: 'эскимо', make: eskimo, bites: 4, mode: 'bite', sound: 'crunch', soundOpts: { soft: true }, grip: 0.008, lift: 0.07, empty: 'stick', done: 'Only the wooden stick is left.' },
  loaf: { name: 'white bread', make: loaf, bites: 5, mode: 'bite', sound: 'crunch', grip: 0.05, lift: 0.08, tilt: 0.85, done: 'The whole loaf. Nobody at home will believe the bread truck came.' },
  lepyoshka: { name: 'нан', make: lepyoshka, bites: 4, mode: 'bite', sound: 'crunch', grip: 0.018, lift: 0.1, done: 'The last piece of the lepyoshka, sesame and all.' },
  tarkhun: { name: 'Тархун', make: () => bottle('tarkhun'), bites: 4, mode: 'drink', sound: 'gulp', grip: 0.036, lift: 0.02, empty: 'bottle', done: 'Empty. The bottle is worth a deposit, if anyone still takes them.' },
  buratino: { name: 'Буратино', make: () => bottle('buratino'), bites: 4, mode: 'drink', sound: 'gulp', grip: 0.036, lift: 0.02, empty: 'bottle', done: 'Empty. Sweet, fizzy, and orange as the label.' },
  duchess: { name: 'Дюшес', make: () => bottle('duchess'), bites: 4, mode: 'drink', sound: 'gulp', grip: 0.036, lift: 0.02, empty: 'bottle', done: 'Empty. Pear, sugar and bubbles.' },
  pepsi: { name: 'Pepsi', make: pepsi, bites: 4, mode: 'drink', sound: 'gulp', grip: 0.034, lift: 0.02, empty: 'can', done: 'The can is empty. Crush it or bin it.' },
  kvass: { name: 'kvass', make: kvass, bites: 3, mode: 'drink', sound: 'gulp', soundOpts: { fizz: false }, grip: 0.035, lift: 0.02, done: 'You hand the glass back to the kvass lady. «Ещё?»' },
  seeds: { name: 'семечки', make: () => coneOf('seeds'), bites: 5, mode: 'pinch', sound: 'seedCrack', grip: 0.03, lift: 0.08, empty: 'paper cone', done: 'Nothing left but husks on the pavement and the paper.' },
  kurt: { name: 'құрт', make: () => coneOf('kurt'), bites: 5, mode: 'pinch', sound: 'crunch', grip: 0.03, lift: 0.08, empty: 'paper cone', done: 'The last kurt ball. Your mouth is the Aral Sea.' },
  strawberries: { name: 'strawberries', make: () => coneOf('strawberries'), bites: 5, mode: 'pinch', sound: 'lick', grip: 0.03, lift: 0.08, empty: 'paper cone', done: 'The last strawberry. The paper is pink with juice.' },
  turbo: { name: 'Turbo', make: turbo, bites: 1, mode: 'bite', sound: 'unwrap', grip: 0.012, lift: 0.05, empty: 'wrapper', done: 'Chewing. The insert is a Lamborghini Countach.' },
  // street food and drink from the stalls: samsa, shashlik, tea, kumys
  ...FOOD_ITEMS,
};
