/* Combine screenshots into one grid image: node tools/montage.mjs out.jpg a.jpg b.jpg ... [--cols 2] [--w 800] */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf('--' + k); if (i < 0) return d; const v = args[i + 1]; args.splice(i, 2); return v; };
const cols = Number(opt('cols', 2));
const w = Number(opt('w', 800));
const [out, ...files] = args;
const imgs = files.map((f) => `data:image/jpeg;base64,${fs.readFileSync(f).toString('base64')}`);
const h = Math.round(w * 9 / 16);
const rows = Math.ceil(imgs.length / cols);
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: cols * w, height: rows * h } });
await page.setContent(`<body style="margin:0;display:grid;grid-template-columns:repeat(${cols},${w}px);background:#000">${imgs.map((s, i) => `<div style="position:relative;width:${w}px;height:${h}px"><img src="${s}" style="width:100%;height:100%;object-fit:cover"><span style="position:absolute;left:6px;top:4px;color:#fff;font:bold 14px sans-serif;text-shadow:0 0 3px #000">${path.basename(files[i])}</span></div>`).join('')}</body>`);
await page.screenshot({ path: out, type: 'jpeg', quality: 85 });
await browser.close();
console.log(out);
