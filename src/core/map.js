import { ROADS, BLOCKS, BOUNDS, STOPS, RAIL, stopPlacement, halfWidth, outerEdge } from '../world/plan.js';

/* ------------------------------------------------------------------ *
 * T: the city map, drawn like the fold-out "схема города" sold in
 * kiosks: cream paper, streets in white with grey casing, blocks in
 * pale colours by use, the railway as a black-and-white hatched line,
 * bus stops as little yellow squares. You are the red arrow; your car
 * is the cherry dot; route vehicles show their numbers.
 * ------------------------------------------------------------------ */

const BLOCK_STYLE = {
  privateSector: ['#e9dcc0', 'Частный сектор'],
  bazaar: ['#f0d7b0', 'Центральный рынок'],
  school: ['#dfe6c8', 'Школа №9'],
  square: ['#d8e5c4', 'Площадь, акимат'],
  mikro: ['#e8e0d2', '12 микрорайон'],
  nineStorey: ['#e3dbcd', '12 мкр, 9-этажки'],
  westEdge: ['#ece3cd', ''],
  station: ['#e6ddd0', 'Вокзал Актобе-1'],
  southEdge: ['#efe6cf', 'Гаражи'],
  northOfRail: ['#e5dccb', 'Промзона'],
};

export function createMap(game) {
  const wrap = document.createElement('div');
  wrap.className = 'citymap';
  wrap.innerHTML = '<canvas></canvas><div class="citymap-title">Схема города · Ақтөбе · 2007</div><div class="citymap-key">T close · <b>▲</b> you · <b class="c">●</b> your car · <b class="s">■</b> stop</div>';
  document.body.appendChild(wrap);
  const canvas = wrap.querySelector('canvas');
  const ctx = canvas.getContext('2d');
  let open = false;
  let acc = 1;

  const style = document.createElement('style');
  style.textContent = `
    .citymap { position: fixed; inset: 0; display: none; place-items: center; background: rgba(40,36,30,.45); z-index: 5; pointer-events: none; }
    .citymap.on { display: grid; }
    .citymap canvas { max-width: 92vw; max-height: 80vh; width: auto; height: auto; background: #f3ead6; border: 2px solid #2b2724;
      box-shadow: 10px 12px 0 rgba(43,39,36,.3); }
    .citymap-title { position: absolute; top: 3vh; font: 700 18px "PT Sans", Arial, sans-serif; color: #f7f1e4; letter-spacing: .08em; text-shadow: 0 1px 2px #000; }
    .citymap-key { position: absolute; bottom: 3vh; font: 13px "PT Sans", Arial, sans-serif; color: #f7f1e4; text-shadow: 0 1px 2px #000; }
    .citymap-key b { color: #d33; } .citymap-key b.c { color: #7d1d27; } .citymap-key b.s { color: #e8b320; }
  `;
  document.head.appendChild(style);

  const W = BOUNDS.x1 - BOUNDS.x0, H = BOUNDS.z1 - BOUNDS.z0;
  function draw() {
    const px = 2.4;
    canvas.width = Math.round(W * px);
    canvas.height = Math.round(H * px);
    const X = (x) => (x - BOUNDS.x0) * px, Z = (z) => (z - BOUNDS.z0) * px;
    ctx.fillStyle = '#f3ead6';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    for (const [k, b] of Object.entries(BLOCKS)) {
      const st = BLOCK_STYLE[k] || ['#ece3cd', ''];
      ctx.fillStyle = st[0];
      ctx.fillRect(X(b.x0), Z(b.z0), (b.x1 - b.x0) * px, (b.z1 - b.z0) * px);
    }
    // railway
    ctx.fillStyle = '#2b2724';
    ctx.fillRect(0, Z(RAIL.z) - 4, canvas.width, 8);
    ctx.fillStyle = '#f3ead6';
    for (let x = 0; x < canvas.width; x += 24) ctx.fillRect(x, Z(RAIL.z) - 2, 12, 4);
    // streets
    for (const pass of ['case', 'fill']) {
      for (const r of ROADS) {
        const hw = pass === 'case' ? outerEdge(r, 0) : halfWidth(r);
        const hw2 = pass === 'case' ? outerEdge(r, 1) : halfWidth(r);
        ctx.fillStyle = pass === 'case' ? '#b8ad98' : r.major ? '#ffe9a8' : '#ffffff';
        if (r.axis === 'x') ctx.fillRect(X(r.a), Z(r.c - hw), (r.b - r.a) * px, (hw + hw2) * px);
        else ctx.fillRect(X(r.c - hw), Z(r.a), (hw + hw2) * px, (r.b - r.a) * px);
      }
    }
    // names
    ctx.fillStyle = '#5a5046';
    ctx.font = `italic ${Math.round(px * 4.2)}px "PT Serif", Georgia, serif`;
    for (const r of ROADS) {
      ctx.save();
      if (r.axis === 'x') {
        ctx.translate(X(-60 + (r.c % 50)), Z(r.c) + px * 1.4);
      } else {
        ctx.translate(X(r.c) + px * 1.4, Z(60));
        ctx.rotate(-Math.PI / 2);
      }
      ctx.textAlign = 'center';
      ctx.fillText(r.name, 0, 0);
      ctx.restore();
    }
    ctx.font = `700 ${Math.round(px * 5)}px "PT Sans", Arial, sans-serif`;
    ctx.textAlign = 'center';
    for (const [k, b] of Object.entries(BLOCKS)) {
      const label = (BLOCK_STYLE[k] || [])[1];
      if (!label) continue;
      ctx.fillStyle = 'rgba(80,70,60,.75)';
      ctx.fillText(label, X((b.x0 + b.x1) / 2), Z((b.z0 + b.z1) / 2));
    }
    // stops
    for (const s of STOPS) {
      const p = stopPlacement(s).shelter;
      ctx.fillStyle = '#e8b320';
      ctx.strokeStyle = '#2b2724';
      ctx.lineWidth = 1.5;
      ctx.fillRect(X(p.x) - 5, Z(p.z) - 5, 10, 10);
      ctx.strokeRect(X(p.x) - 5, Z(p.z) - 5, 10, 10);
    }
    // vehicles on routes
    for (const v of game.traffic?.vehicles || []) {
      if (v.hidden || !v.route) continue;
      ctx.fillStyle = v.kind === 'marshrutka' ? '#f7f1e4' : '#d9a63a';
      ctx.strokeStyle = '#2b2724';
      ctx.beginPath();
      ctx.arc(X(v.x), Z(v.z), 9, 0, Math.PI * 2);
      ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#2b2724';
      ctx.font = `700 ${Math.round(px * 3.6)}px "PT Sans", Arial, sans-serif`;
      ctx.textBaseline = 'middle';
      ctx.fillText(v.route.label, X(v.x), Z(v.z) + 0.5);
      ctx.textBaseline = 'alphabetic';
    }
    // your car
    const car = game.car;
    if (car?.placed) {
      ctx.fillStyle = '#7d1d27';
      ctx.beginPath();
      ctx.arc(X(car.pos.x), Z(car.pos.z), 7, 0, Math.PI * 2);
      ctx.fill();
    }
    // you
    const pos = game.controller?.pos || game.player.pos;
    const yaw = game.controller?.yaw ?? game.player.yaw;
    ctx.save();
    ctx.translate(X(pos.x), Z(pos.z));
    ctx.rotate(-yaw);
    ctx.fillStyle = '#d33';
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, -14); ctx.lineTo(9, 10); ctx.lineTo(0, 5); ctx.lineTo(-9, 10); ctx.closePath();
    ctx.fill(); ctx.stroke();
    ctx.restore();
  }

  game.input.on('KeyT', () => {
    open = !open;
    wrap.classList.toggle('on', open);
    acc = 1;
  });

  return {
    get open() { return open; },
    update(dt) {
      if (!open) return;
      acc += dt;
      if (acc > 0.15) { acc = 0; draw(); }
    },
  };
}
