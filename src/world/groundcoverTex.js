import { canvasTex, cached } from '../core/textures.js';
import { rngKit } from '../core/util.js';

/* ------------------------------------------------------------------ *
 * Canvas textures for groundcover.js.
 *
 *   tuftTex   a strip of four tuft cards: short lawn grass, tall weedy
 *             grass going to seed, grass with dandelions, grass with blue
 *             chicory and white yarrow (the June verge flowers)
 *   decalTex  an atlas of ground decals; DECAL gives each one's uv rect
 *             as [u0, v0, width, height]
 * ------------------------------------------------------------------ */

const W = 1024, H = 512;
/** Canvas pixel rect -> uv rect (the canvas is flipped onto the texture). */
const rect = (x, y, w, h) => [x / W, 1 - (y + h) / H, w / W, h / H];

export const DECAL = {
  manhole: rect(0, 0, 256, 256),
  grate: rect(256, 0, 256, 128),
  oil: rect(256, 128, 128, 128),
  damp: rect(384, 128, 128, 128),
  patch: rect(512, 0, 256, 256),
  crack: rect(768, 0, 128, 256),
  dust: rect(0, 256, 256, 256),
  path: rect(256, 256, 256, 256),
};

function blade(ctx, x, base, h, lean, w, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x - w / 2, base);
  ctx.quadraticCurveTo(x + lean * 0.3, base - h * 0.55, x + lean, base - h);
  ctx.quadraticCurveTo(x + lean * 0.3 + w * 0.2, base - h * 0.5, x + w / 2, base);
  ctx.fill();
}

const GREENS = ['#5d7a34', '#6f8c3e', '#809b48', '#96a853', '#4e6b2c', '#a9ad62'];
const STRAW = ['#b7ad6e', '#c4b77c', '#a39a5c'];

export function tuftTex() {
  return cached('tuft-atlas', () => canvasTex(512, 128, (ctx) => {
    const r = rngKit(71);
    ctx.clearRect(0, 0, 512, 128);
    for (let cell = 0; cell < 4; cell++) {
      const x0 = cell * 128;
      ctx.save();
      ctx.beginPath(); ctx.rect(x0 + 1, 0, 126, 128); ctx.clip();
      const tall = cell === 1;
      const n = tall ? 34 : 46;
      for (let i = 0; i < n; i++) {
        const depth = i / n;
        const x = x0 + 64 + r.range(-46, 46) * (0.6 + 0.4 * (1 - depth));
        const h = (tall ? r.range(56, 104) : r.range(34, 78)) * (0.8 + 0.2 * depth);
        const col = tall && r.chance(0.45) ? r.pick(STRAW) : r.pick(GREENS);
        blade(ctx, x, 128, h, r.range(-22, 22), r.range(3, 6), col);
      }
      if (tall) {
        // a few stems gone to seed: thin spikelets, not plumes
        for (let i = 0; i < 5; i++) {
          const x = x0 + 64 + r.range(-36, 36), top = r.range(14, 40);
          const tx = x + r.range(-10, 10);
          ctx.strokeStyle = '#a79c64'; ctx.lineWidth = 1.6;
          ctx.beginPath(); ctx.moveTo(x, 128); ctx.quadraticCurveTo(x + 3, 80, tx, top); ctx.stroke();
          ctx.fillStyle = '#bfb07a';
          for (let k = 0; k < 4; k++) {
            ctx.beginPath(); ctx.ellipse(tx + (k % 2 ? 2.5 : -2.5), top + 3 + k * 5, 1.8, 4, k % 2 ? 0.5 : -0.5, 0, Math.PI * 2); ctx.fill();
          }
        }
      }
      if (cell === 2) {
        // dandelions: ragged yellow heads, and a couple gone to clocks
        for (let i = 0; i < 6; i++) {
          const x = x0 + 64 + r.range(-40, 40), top = r.range(34, 72);
          ctx.strokeStyle = '#6f8a3a'; ctx.lineWidth = 2.5;
          ctx.beginPath(); ctx.moveTo(x, 128); ctx.lineTo(x + r.range(-6, 6), top); ctx.stroke();
          if (i < 2) {
            const g = ctx.createRadialGradient(x, top, 1, x, top, 8);
            g.addColorStop(0, 'rgba(236,234,222,0.95)');
            g.addColorStop(0.75, 'rgba(242,240,230,0.85)');
            g.addColorStop(1, 'rgba(242,240,230,0)');
            ctx.fillStyle = g;
            ctx.beginPath(); ctx.arc(x, top, 8, 0, Math.PI * 2); ctx.fill();
            continue;
          }
          ctx.fillStyle = '#f0bd1a';
          for (let k = 0; k < 12; k++) {
            const a = (k / 12) * Math.PI * 2;
            ctx.beginPath(); ctx.ellipse(x + Math.cos(a) * 4, top + Math.sin(a) * 2.6, 3.2, 1.6, a, 0, Math.PI * 2); ctx.fill();
          }
          ctx.fillStyle = '#f7d23a';
          ctx.beginPath(); ctx.ellipse(x, top - 1, 4, 3, 0, 0, Math.PI * 2); ctx.fill();
        }
      }
      if (cell === 3) {
        for (let i = 0; i < 9; i++) {
          const x = x0 + 64 + r.range(-44, 44), top = r.range(12, 60);
          ctx.strokeStyle = '#627f36'; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.moveTo(x, 128); ctx.lineTo(x + r.range(-10, 10), top); ctx.stroke();
          if (i % 3 === 0) {
            // yarrow: a flat white umbel
            ctx.fillStyle = '#f1eee2';
            ctx.beginPath(); ctx.ellipse(x, top, 10, 5, 0, 0, Math.PI * 2); ctx.fill();
          } else {
            // chicory: sky-blue stars along the stem
            ctx.fillStyle = '#7fa6e0';
            for (let k = 0; k < 2; k++) {
              ctx.beginPath(); ctx.arc(x + r.range(-4, 4), top + k * 14, 5.5, 0, Math.PI * 2); ctx.fill();
            }
          }
        }
      }
      ctx.restore();
    }
  }, { mips: true }));
}

function speck(ctx, r, x0, y0, w, h, n, colors, s0 = 1, s1 = 3, a = [0.2, 0.6]) {
  for (let i = 0; i < n; i++) {
    ctx.globalAlpha = r.range(a[0], a[1]);
    ctx.fillStyle = r.pick(colors);
    const s = r.range(s0, s1);
    ctx.fillRect(x0 + r.range(0, w), y0 + r.range(0, h), s, s);
  }
  ctx.globalAlpha = 1;
}

function blotch(ctx, r, cx, cy, rad, rgb, alpha) {
  for (let i = 0; i < 9; i++) {
    const x = cx + r.range(-rad, rad) * 0.45, y = cy + r.range(-rad, rad) * 0.45;
    const rr = rad * r.range(0.35, 0.6);
    const g = ctx.createRadialGradient(x, y, 1, x, y, rr);
    g.addColorStop(0, `rgba(${rgb},${alpha})`);
    g.addColorStop(0.7, `rgba(${rgb},${alpha * 0.6})`);
    g.addColorStop(1, `rgba(${rgb},0)`);
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(x, y, rr, 0, Math.PI * 2); ctx.fill();
  }
}

export function decalTex() {
  return cached('ground-decals', () => canvasTex(W, H, (ctx) => {
    const r = rngKit(88);
    ctx.clearRect(0, 0, W, H);

    // manhole: a patched ring of asphalt, a steel frame, the ribbed lid
    {
      const cx = 128, cy = 128;
      ctx.fillStyle = 'rgba(78,78,80,0.9)';
      ctx.beginPath(); ctx.arc(cx, cy, 118, 0, Math.PI * 2); ctx.fill();
      speck(ctx, r, 20, 20, 216, 216, 900, ['#5b5b5e', '#86857f', '#48484b'], 1, 3);
      ctx.globalCompositeOperation = 'destination-in';
      ctx.beginPath(); ctx.arc(cx, cy, 120, 0, Math.PI * 2); ctx.fill();
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = '#3b3a38';
      ctx.beginPath(); ctx.arc(cx, cy, 72, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#56534d';
      ctx.beginPath(); ctx.arc(cx, cy, 64, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#3f3d39'; ctx.lineWidth = 3;
      for (let k = 1; k <= 3; k++) { ctx.beginPath(); ctx.arc(cx, cy, k * 17, 0, Math.PI * 2); ctx.stroke(); }
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * Math.PI * 2;
        ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * 12, cy + Math.sin(a) * 12);
        ctx.lineTo(cx + Math.cos(a) * 62, cy + Math.sin(a) * 62); ctx.stroke();
      }
      ctx.fillStyle = 'rgba(180,120,70,0.25)';   // rust
      ctx.beginPath(); ctx.arc(cx + 20, cy - 14, 22, 0, Math.PI * 2); ctx.fill();
    }

    // gutter grate: steel bars in a concrete surround
    {
      const x0 = 266, y0 = 18, w = 236, h = 92;
      ctx.fillStyle = '#8c8a84'; ctx.fillRect(x0, y0, w, h);
      ctx.fillStyle = '#2a2927'; ctx.fillRect(x0 + 14, y0 + 12, w - 28, h - 24);
      ctx.fillStyle = '#5e5b55';
      for (let x = x0 + 18; x < x0 + w - 16; x += 13) ctx.fillRect(x, y0 + 12, 6, h - 24);
      speck(ctx, r, x0, y0, w, h, 300, ['#a6a39c', '#6e6c66'], 1, 3);
    }

    // oil stain and damp patch
    blotch(ctx, r, 320, 192, 58, '28,26,24', 0.5);
    blotch(ctx, r, 448, 192, 60, '44,44,46', 0.35);

    // repair patch: fresher, darker asphalt with a sealed seam round it
    {
      const x0 = 512, y0 = 0;
      ctx.fillStyle = '#4a4b4f'; ctx.fillRect(x0 + 10, y0 + 10, 236, 236);
      speck(ctx, r, x0 + 10, y0 + 10, 236, 236, 2400, ['#3d3e42', '#5c5d60', '#626262'], 1, 3);
      ctx.strokeStyle = 'rgba(26,26,28,0.9)'; ctx.lineWidth = 7;
      ctx.beginPath();
      ctx.moveTo(x0 + 10, y0 + 10 + r.range(-2, 2));
      for (const [px, py] of [[246, 10], [246, 246], [10, 246], [10, 10]]) ctx.lineTo(x0 + px + r.range(-3, 3), y0 + py + r.range(-3, 3));
      ctx.stroke();
    }

    // a crack sealed with a wandering bead of tar
    {
      const x0 = 768;
      ctx.strokeStyle = 'rgba(26,25,24,0.8)'; ctx.lineWidth = 6; ctx.lineCap = 'round';
      ctx.beginPath();
      let x = x0 + 64;
      ctx.moveTo(x, 6);
      for (let y = 6; y <= 250; y += 16) { x = Math.max(x0 + 30, Math.min(x0 + 98, x + r.range(-14, 14))); ctx.lineTo(x, y); }
      ctx.stroke();
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(x0 + 64, 120); ctx.lineTo(x0 + 64 + r.range(-40, 40), 170); ctx.stroke();
    }

    // gutter dust: sand and grit, thick against the kerb (u = 1), none at
    // u = 0; tiles along v
    {
      const x0 = 0, y0 = 256, w = 256, h = 256;
      const g = ctx.createLinearGradient(x0, 0, x0 + w, 0);
      g.addColorStop(0, 'rgba(150,138,114,0)');
      g.addColorStop(0.5, 'rgba(150,138,114,0.22)');
      g.addColorStop(0.88, 'rgba(160,146,118,0.62)');
      g.addColorStop(1, 'rgba(166,152,122,0.78)');
      ctx.fillStyle = g; ctx.fillRect(x0, y0, w, h);
      for (let i = 0; i < 1600; i++) {
        const u = Math.pow(r.next(), 0.45);
        ctx.globalAlpha = r.range(0.15, 0.5) * u;
        ctx.fillStyle = r.pick(['#7d705a', '#a8977a', '#958670', '#6f6656']);
        const s = r.range(1, 3.5);
        ctx.fillRect(x0 + u * w - s, y0 + r.range(0, h - s), s, s);
      }
      ctx.globalAlpha = 1;
      // poplar fluff rolled into the gutter, caught against the kerb
      for (let i = 0; i < 9; i++) {
        const x = x0 + w * r.range(0.72, 0.97), y = y0 + r.range(10, h - 10), rad = r.range(2, 5);
        for (let k = 0; k < 3; k++) {
          const g = ctx.createRadialGradient(x + r.range(-4, 4), y + r.range(-6, 6), 0.5, x, y, rad);
          g.addColorStop(0, 'rgba(246,244,236,0.55)');
          g.addColorStop(1, 'rgba(246,244,236,0)');
          ctx.fillStyle = g;
          ctx.beginPath(); ctx.arc(x, y, rad * 1.4, 0, Math.PI * 2); ctx.fill();
        }
      }
    }

    // trodden path: packed earth with soft grassy edges; tiles along v
    {
      const x0 = 256, y0 = 256, w = 256, h = 256;
      const g = ctx.createLinearGradient(x0, 0, x0 + w, 0);
      g.addColorStop(0, 'rgba(150,128,96,0)');
      g.addColorStop(0.22, 'rgba(150,128,96,0.8)');
      g.addColorStop(0.5, 'rgba(158,136,102,0.95)');
      g.addColorStop(0.78, 'rgba(150,128,96,0.8)');
      g.addColorStop(1, 'rgba(150,128,96,0)');
      ctx.fillStyle = g; ctx.fillRect(x0, y0, w, h);
      speck(ctx, r, x0 + 40, y0, w - 80, h - 3, 900, ['#7d6a4f', '#b8a27e', '#6f5f46', '#d0c0a0'], 1, 4);
    }
  }, { mips: true }));
}
