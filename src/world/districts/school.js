import { BLOCKS } from '../plan.js';
import { PAL } from '../../core/palette.js';
import { rotXZ } from '../../core/util.js';
import { signTex, FONT } from '../../core/textures.js';
import { buildBlock } from '../buildings/panel.js';
import { WIN } from '../buildings/facades.js';
import { hall, porch, fascia, flagpole, runningTrack, goal, gymBars, veranda, playHouse } from '../buildings/civic.js';
import { SignSheet, placeSign } from '../buildings/signs.js';
import {
  cover, addPath, plantTrees, scatterTrees, addBarFence, addTyreBed, addTyreSwan, addLaundryPoles,
  addDominoTable, addCarpetFrame, districtCtx, groundQuad,
} from '../props/yard.js';
import { addBench } from '../props/street.js';

/* ------------------------------------------------------------------ *
 * District: school. North of the avenue, east of пр. Санкибай батыра.
 *
 * School №9, a three-storey red-brick school with a classroom wing and
 * a gym, its forecourt and flagpole, a running track round a football
 * field, all behind a green bar fence locked for the summer holidays
 * (there is a hole in it, as there always is). Next door the
 * «Ақбота» kindergarten with verandas and play houses. Along the avenue
 * a 5-storey panel block and a corner food shop.
 * ------------------------------------------------------------------ */

const FENCE = 0x2f5a42;
const DRIVE_W = 5.5;

const SCHOOL_SIGN = () => signTex({
  w: 512, h: 96, bg: '#f4f2ec', fg: '#1f4e8c', lines: ['№9 мектеп-гимназия', 'Школа-гимназия №9'],
  sizes: [1, 0.85], family: FONT.serif, border: '#1f4e8c', seed: 9,
});

function bench(ctx, x, z, facing, style = 'park', color = PAL.greenPaint) {
  addBench(ctx.batch, x, z, facing, { style, color });
  ctx.colliders.circle(x, z, 0.7, { top: 0.5, tag: 'bench' });
}

/**
 * A locked double gate in a bar fence running along `dir` (yaw of the
 * fence line), centred at (x, z). The sign faces `out` (a yaw).
 */
function lockedGate(ctx, x, z, dir, w, out, { label = 'Try the school gate', message, sheet = null }) {
  const { batch, colliders } = ctx;
  const along = [Math.sin(dir), Math.cos(dir)];
  const h = 1.8;
  for (const s of [-1, 1]) {
    const px = x + along[0] * s * w / 2, pz = z + along[1] * s * w / 2;
    batch.box(0.12, h + 0.3, 0.12, FENCE, px, 0, pz, { ry: dir });
  }
  for (let t = -w / 2 + 0.1; t < w / 2 - 0.05; t += 0.14) {
    batch.tube(x + along[0] * t, 0.08, z + along[1] * t, x + along[0] * t, h, z + along[1] * t, 0.012, FENCE, { seg: 3, cast: false });
  }
  for (const y of [0.1, h / 2, h]) batch.tube(x - along[0] * w / 2, y, z - along[1] * w / 2, x + along[0] * w / 2, y, z + along[1] * w / 2, 0.025, FENCE, { seg: 4 });
  batch.box(0.05, h, 0.05, FENCE, x, 0.05, z, { ry: dir });
  // chain and padlock
  const [ox, oz] = rotXZ(0, -0.06, out);
  batch.box(0.35, 0.05, 0.03, 0x8a8a86, x + ox, 1.02, z + oz, { ry: out });
  batch.box(0.09, 0.12, 0.04, 0xc8a040, x + ox, 0.9, z + oz, { ry: out });
  colliders.obb(x, z, 0.08, w / 2, dir, { tag: 'gate' });
  // the holiday notice, wired to the bars
  const tex = signTex({ w: 256, h: 128, bg: '#f4f2ec', fg: '#b8201e', lines: ['Жазғы демалыс', 'Летние каникулы'], sizes: [1, 0.9], family: FONT.sans, seed: 17 });
  const [sx, sz] = rotXZ(0.55, -0.05, out);
  placeSign(ctx, sheet, tex, 0.7, 0.35, x + sx, 1.3, z + sz, out + Math.PI);
  ctx.interact({
    x, y: 1.0, z, w: w + 0.2, h: 2.0, d: 0.8, ry: dir + Math.PI / 2,
    label,
    action: (game) => {
      game.audio.play('deny', { pos: { x, y: 1, z } });
      game.hud.flash(message, 3600);
    },
  });
}

export const school = {
  name: 'school',
  build(shared) {
    const ctx = districtCtx(shared, 'school');
    const B = BLOCKS.school;
    const X = (u) => B.x0 + u;
    const sheet = new SignSheet('school-signs');

    /* ---- along the avenue: a 5-storey and the corner shop ---- */
    const Y = buildBlock(ctx, {
      sheet, x: X(43.5), z: B.z1 - 10.5, facing: 0, storeys: 5, sections: 5, sectionW: 15, depth: 12,
      wall: 'panelBeige', back: 'balconies', parapet: 'sheet', plinth: 'grey', gasPipe: true, seed: 81,
    });
    const shopX = Y.x1 + 15;
    const shop = hall(ctx, {
      x: shopX, z: B.z1 - 10.5, facing: Math.PI, L: 18, D: 10, storeys: 1, storeyH: 3.6, wall: 'tileWhite',
      cells: WIN.shop, winW: 2.6, winH: 2.3, sill: 0.4, bay: 3.6, belts: false, plinthH: 0.3,
      skip: (side, lx) => side < 0 && Math.abs(lx) < 2, seed: 83,
    });
    shop.box(1.6, 2.3, 0.06, 0x6b4a34, 0, 0.3, -5.04);
    shop.box(2.4, 0.3, 1.2, PAL.concrete, 0, 0, -5.6);
    fascia(ctx, shop, 0, shop.H + 0.35, -5.2, 14, 1.0, signTex({
      w: 768, h: 96, bg: '#c8201e', fg: '#f4f2ec', lines: ['«Айгерім» азық-түлік дүкені', 'Магазин «Айгерим» · 24 часа'],
      sizes: [1, 0.8], family: FONT.sans, seed: 21,
    }), sheet);
    shop.box(14.2, 1.1, 0.08, 0x2a2826, 0, shop.H - 0.2, -5.1);
    ctx.ground.flat(...shop.rect(-1.2, -6.2, 1.2, -5.05), 0.3);

    /* ---- ground ---- */
    cover(ctx, B.x0, B.z0, B.x1, B.z1, 'yard');
    const lawn = (x0, z0, x1, z1) => cover(ctx, x0, z0, x1, z1, 'grass', -0.024);
    lawn(Y.x0, Y.z1 + 1.2, Y.x1, B.z1 - 0.3);
    const dZ1 = Y.z0 - 3.8, dZ0 = dZ1 - DRIVE_W;
    const driveX1 = Y.x1 + 6;
    groundQuad(ctx, B.x0, dZ0, driveX1, dZ1, -0.005, 'asphalt');
    for (const z of [dZ0 - 0.15, dZ1]) ctx.batch.span(B.x0 + 0.4, -0.04, z, driveX1, 0.1, z + 0.15, 0xb8b2a6, { cast: false });

    /* ---- the school ---- */
    const sf = { x0: B.x0 + 3, z0: B.z0 + 2.25, x1: B.x0 + 87, z1: dZ0 - 1.5 };
    const M = hall(ctx, {
      x: sf.x0 + 33, z: sf.z0 + 8.5, facing: Math.PI, L: 60, D: 13, storeys: 3, storeyH: 3.4, wall: 'redBrick',
      cells: WIN.school, winW: 2.7, winH: 2.0, sill: 0.9, bay: 3.6, seed: 91,
      skip: (side, lx, k) => side < 0 && ((Math.abs(lx - 9) < 4.5 && k === 0) || lx > 17.5),
    });
    const entX = M.toW(9, 0)[0];
    porch(ctx, M, 9, { w: 8, d: 3.2, height: 3.4, sign: SCHOOL_SIGN(), signW: 7.5, sheet });
    const W = hall(ctx, {
      x: sf.x0 + 9, z: sf.z0 + 15 + 12.5, facing: -Math.PI / 2, L: 25, D: 12, storeys: 3, storeyH: 3.4, wall: 'redBrick',
      cells: WIN.school, winW: 2.7, winH: 2.0, sill: 0.9, bay: 3.6, seed: 92,
    });
    const G = hall(ctx, {
      x: sf.x0 + 73, z: sf.z0 + 9.5, facing: Math.PI, L: 20, D: 15, storeys: 1, storeyH: 7.0, wall: 'silicate',
      cells: WIN.glassBlock, winW: 3.2, winH: 2.6, sill: 3.4, bay: 4, belts: false, seed: 93,
    });
    fascia(ctx, G, 0, 1.9, -7.52, 13, 0.9, signTex({
      w: 768, h: 64, bg: '#f4f2ec', fg: '#1f4e8c', lines: ['Білім - болашақ кілті!'], family: FONT.display, seed: 31, wear: 0.9,
    }), sheet);

    // forecourt: asphalt for the first-of-September line-up, flagpole, beds
    const fc = { x0: W.rect(-12.5, -6, 12.5, 6)[2] + 0.2, z0: M.rect(-30, -6.5, 30, 6.5)[3] + 6.6, x1: entX + 9, z1: sf.z1 - 0.4 };
    groundQuad(ctx, fc.x0, fc.z0, fc.x1, fc.z1, -0.004, 'asphalt');
    flagpole(ctx, fc.x0 + 3, fc.z0 + 3.5, 9);
    addTyreBed(ctx, fc.x1 - 3, fc.z0 + 4, 41, { r: 1.2 });
    addTyreBed(ctx, fc.x0 + 3, fc.z0 + 11, 42, { r: 1.2 });
    bench(ctx, fc.x0 + 1.2, fc.z0 + 16, -Math.PI / 2);
    bench(ctx, fc.x0 + 1.2, fc.z0 + 20, -Math.PI / 2);
    plantTrees(ctx, [
      ['spruce', entX - 7.2, fc.z0 - 3.2], ['spruce', entX + 7.2, fc.z0 - 3.2],
      ['maple', fc.x0 + 2, fc.z1 - 3], ['elm', W.rect(-12.5, -6, 12.5, 6)[0] + 2, sf.z1 - 4],
    ], 301);

    // the sports ground
    const tr = { x: fc.x1 + 3 + 23, z: (G.rect(-10, -7.5, 10, 7.5)[3] + sf.z1) / 2 + 0.5 };
    const track = runningTrack(ctx, tr.x, tr.z, { R: 16, lanes: 4, laneW: 1, straight: 14 });
    const gx = track.halfLen - 1.4;
    goal(ctx, tr.x - gx, tr.z, 1);
    goal(ctx, tr.x + gx, tr.z, -1);
    ctx.batch.box(0.12, 0.01, 2 * track.ri - 1.5, 0xe8e4da, tr.x, -0.004, tr.z, { cast: false });
    for (const sx of [-1, 1]) {
      ctx.batch.box(0.1, 0.01, 12, 0xe8e4da, tr.x + sx * (gx - 5), -0.004, tr.z, { cast: false });
      for (const sz of [-1, 1]) ctx.batch.box(5, 0.01, 0.1, 0xe8e4da, tr.x + sx * (gx - 2.5), -0.004, tr.z + sz * 6, { cast: false });
    }
    gymBars(ctx, tr.x - 14, G.rect(-10, -7.5, 10, 7.5)[3] + 2.4, 0);

    // the fence, locked for the holidays, with its hole
    const msg = 'Locked with a chain. The notice says «Жазғы демалыс / Летние каникулы»: no school until 1 September.';
    const westGateZ = W.rect(-12.5, -6, 12.5, 6)[3] + 7;
    const southGateX = entX;
    const holeX = sf.x1 - 7;
    addBarFence(ctx, sf.x0, sf.z1, sf.x1, sf.z1, { color: FENCE, gaps: [[southGateX - sf.x0 - 1.1, southGateX - sf.x0 + 1.1], [holeX - sf.x0 - 0.6, holeX - sf.x0 + 0.6]] });
    addBarFence(ctx, sf.x0, sf.z0, sf.x0, sf.z1, { color: FENCE, gaps: [[westGateZ - sf.z0 - 2.1, westGateZ - sf.z0 + 2.1]] });
    addBarFence(ctx, sf.x0, sf.z0, sf.x1, sf.z0, { color: FENCE });
    addBarFence(ctx, sf.x1, sf.z0, sf.x1, sf.z1, { color: FENCE });
    lockedGate(ctx, sf.x0, westGateZ, 0, 4.2, Math.PI / 2, { message: msg, sheet });
    lockedGate(ctx, southGateX, sf.z1, Math.PI / 2, 2.2, Math.PI, { label: 'Try the school wicket gate', message: msg, sheet });
    // two bent bars either side of the hole
    for (const s of [-1, 1]) ctx.batch.tube(holeX + s * 0.6, 0, sf.z1, holeX + s * 0.9, 1.5, sf.z1 - 0.3, 0.012, FENCE, { seg: 3 });
    addPath(ctx, [[holeX, dZ0 + 0.2], [holeX, sf.z1 - 3], [tr.x + 10, tr.z + track.R - 1]], 1.1);
    addPath(ctx, [[B.x0 + 0.4, westGateZ], [sf.x0 + 2, westGateZ], [fc.x0 + 0.5, westGateZ]], 1.8);

    /* ---- the kindergarten ---- */
    const kf = { x0: sf.x1 + 3, z0: sf.z0, x1: B.x1 - 1, z1: sf.z1 };
    const K = hall(ctx, {
      x: kf.x1 - 7.5, z: (kf.z0 + kf.z1) / 2 - 2, facing: Math.PI / 2, L: 34, D: 13, storeys: 2, storeyH: 3.3,
      wall: 'stuccoYellow', cells: WIN.flat, winW: 1.8, winH: 1.6, sill: 0.9, bay: 3.2, seed: 95,
      skip: (side, lx, k) => side < 0 && k === 0 && Math.abs(lx) < 3,
    });
    porch(ctx, K, 0, {
      w: 5, d: 2.2, height: 3.0, signW: 6, stepsY: 0.3, sheet, sign: signTex({
        w: 512, h: 96, bg: '#3e8ad6', fg: '#fff6d8', lines: ['«Ақбота» балабақшасы', 'Детский сад «Акбота»'], sizes: [1, 0.85], family: FONT.sans, seed: 33,
      }),
    });
    addBarFence(ctx, kf.x0, kf.z0, kf.x1, kf.z0, { color: 0x3e6aa6, h: 1.4 });
    addBarFence(ctx, kf.x0, kf.z0, kf.x0, kf.z1, { color: 0x3e6aa6, h: 1.4 });
    addBarFence(ctx, kf.x0, kf.z1, kf.x1, kf.z1, { color: 0x3e6aa6, h: 1.4 });
    addBarFence(ctx, kf.x1, kf.z0, kf.x1, kf.z1, { color: 0x3e6aa6, h: 1.4 });
    const kx = kf.x0 + 4;
    veranda(ctx, kx, kf.z0 + 8, Math.PI / 2, 0x3e8a5a);
    veranda(ctx, kx, kf.z1 - 8, Math.PI / 2, 0xd9853a);
    playHouse(ctx, kx - 0.5, (kf.z0 + kf.z1) / 2 - 10, Math.PI / 2, 1);
    playHouse(ctx, kx - 0.5, (kf.z0 + kf.z1) / 2 + 8, Math.PI / 2, 2);
    addTyreSwan(ctx, kx + 0.5, (kf.z0 + kf.z1) / 2 + 3.5, Math.PI / 2);
    plantTrees(ctx, [['elm', kx + 1, kf.z0 + 16], ['maple', kx, kf.z1 - 16], ['young', kx - 1.5, (kf.z0 + kf.z1) / 2 - 4.5]], 311);

    /* ---- the corner yard behind the shop ---- */
    const cy = { x0: driveX1 + 1, z0: kf.z1 + 1.5, x1: B.x1 - 1, z1: shop.rect(-9, -5, 9, 5)[1] - 1.5 };
    addDominoTable(ctx, cy.x0 + 6, (cy.z0 + cy.z1) / 2, 0, 44);
    addCarpetFrame(ctx, cy.x1 - 5, (cy.z0 + cy.z1) / 2, 0, { seed: 45 });
    addTyreBed(ctx, cy.x0 + 12, cy.z0 + 2, 46, { r: 0.9 });
    addLaundryPoles(ctx, cy.x0 + 9, cy.z1 - 1.6, cy.x0 + 17, cy.z1 - 1.6, 47);
    // empty bottle crates at the shop's back door
    for (let i = 0; i < 6; i++) {
      ctx.batch.box(0.6, 0.3, 0.4, i % 2 ? 0x3f7a4a : 0xc8453a, shopX - 5 + (i % 3) * 0.62, Math.floor(i / 3) * 0.3, cy.z1 + 0.9, {});
    }
    ctx.colliders.box(shopX - 5.4, cy.z1 + 0.6, shopX - 3.2, cy.z1 + 1.2, { top: 0.6, tag: 'crates' });

    /* ---- parking along the drive ---- */
    for (const x of [Y.x0 + 6, Y.x0 + 13, Y.x0 + 36, Y.x0 + 48, Y.x0 + 60, Y.x1 + 2.5]) {
      if (Math.abs(x - southGateX) < 4 || Math.abs(x - holeX) < 3) continue;
      ctx.parking.push({ x, z: dZ0 + 1.3, ry: Math.PI / 2, chance: 0.7 });
    }

    /* ---- trees ---- */
    const rows = [];
    for (let x = Y.x0 + 2; x < Y.x1; x += 7.5) rows.push(['poplar', x, B.z1 - 1.2]);
    for (let z = sf.z0 + 3; z < sf.z1 - 1; z += 7.5) if (Math.abs(z - westGateZ) > 3) rows.push(['poplar', B.x0 + 1.4, z]);
    rows.push(['elm', B.x0 + 2, dZ1 + 3], ['maple', Y.x1 + 4, B.z1 - 3], ['ball', shopX - 11, B.z1 - 3.5], ['ball', shopX + 11, B.z1 - 3.5]);
    plantTrees(ctx, rows, 321);
    scatterTrees(ctx, [sf.x0 + 2, M.rect(-30, -6.5, 30, 6.5)[3] + 3, fc.x0 - 1, sf.z1 - 2], 5, ['elm', 'maple'], [
      W.rect(-12.5, -6, 12.5, 6), [sf.x0, westGateZ - 2, fc.x0, westGateZ + 2],
    ], { seed: 331, spacing: 5 });
    scatterTrees(ctx, [cy.x0, cy.z0, cy.x1, cy.z1], 4, ['elm', 'maple', 'young'], [
      [cy.x0 + 4, (cy.z0 + cy.z1) / 2 - 2, cy.x0 + 8, (cy.z0 + cy.z1) / 2 + 2], [cy.x1 - 7, (cy.z0 + cy.z1) / 2 - 1, cy.x1 - 3, (cy.z0 + cy.z1) / 2 + 1],
      [cy.x0 + 10, cy.z0, cy.x0 + 14, cy.z0 + 4],
    ], { seed: 341, spacing: 5 });

    ctx.flush();
    sheet.flush(ctx.root);
  },
};
