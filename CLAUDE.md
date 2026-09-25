# Aktobe 2000s

A walkable, drivable early-2000s (set in June 2007) Aktobe neighbourhood in
Three.js. Cartoony but realistic: real proportions and real dimensions,
simplified shapes, flat colour with soft cel bands, cool blue-grey shadow
sides, thin brownish ink lines. Not anime: no pastel candy colours, no violet
shadows, no exaggerated proportions except a little on hero props.

Inspired by Sakura Crossing (github.com/Kenton-GMI/sakura-crossing, MIT). The
shadow-tint patch and the depth second-difference ink pass are adapted from
it; nothing else is copied.

This is a personal project, not Berlin Acoustics work. No progress/ logging.

## Run

```bash
npm install
npm run dev          # http://127.0.0.1:5188
npm run play         # build + preview
node tools/shot.mjs '[{"name":"a","x":12,"z":-11,"yaw":1.3,"pitch":0}]' --port 5190 --out .shots/me
```

`?dev` skips the title card; `?stats` shows fps, draw calls and triangles.
In the console, `__city.view({x, z, yaw, pitch})` moves the walker and
`__city.view({x, y, z, yaw, pitch})` sets a free camera. `__city.advance(s)`
runs the simulation. The shot tool uses these.

## Coordinates and units

Metres. +x east, +z SOUTH, +y up. North is -z. Yaw 0 looks north; yaw grows
toward the west (three.js convention: forward = (-sin yaw, 0, -cos yaw)).
Traffic drives on the right. Pavements are 0.15 m above the carriageway.
Bare earth is at -0.04.

## Architecture

- `src/core/` engine: materials (`toon.js`), batching (`batch.js`), collision
  and walkable ground (`physics.js`), canvas textures (`textures.js`),
  ground surfaces (`surfaces.js`), post pipeline, sky, player, input, HUD,
  audio (all synthesised).
- `src/world/plan.js` is the master plan: every street, junction, block and
  the railway. Read positions from it. Never hard-code a number that another
  file owns.
- `src/world/roads.js` builds streets from the plan; `streetscape.js` puts
  street trees and lamps on the spots roads.js reserves.
- `src/world/districts/` one module per block, registered in
  `districts/index.js`. Each exports `{ name, build(ctx) }`.
- `src/systems.js` registers moving systems (traffic, transit, train, the
  player's car), each `{ name, create(game) }` returning `{ update(dt) }`.

## Building things

- Static geometry goes through `ctx.batch` (a `Batch`): `box`, `span`, `cyl`,
  `tube`, `add(geometry, { color, matrix, mat })`. Colour is baked per vertex,
  so parts of any colour merge into one draw call. Material keys: `solid`
  (default), `solidClean`, `ground`, `foliage`, `glass` (unlit), `glow`
  (unlit, for lamps and lit signs), `decal`. A textured material instance is
  fine too; its uv is kept.
- `batch.box(w, h, d, color, x, y, z, { ry })` is anchored at the centre of its
  bottom face.
- Anything animated or unique-textured (signs, posters) is a normal Mesh
  added to `ctx.root` (or a child group). Use `cel({ map })` or `flat({ map })`
  from `toon.js`.
- Colliders: `ctx.colliders.box(x0, z0, x1, z1, { top })`, `.obb(...)`,
  `.circle(...)`. Anything the walker should not pass through needs one.
- Walkable raised surfaces: `ctx.ground.flat(...)` and `.ramp(...)`.
- Interactables: `ctx.interact({ x, y, z, w, h, d, label, action, enabled })`.
  `action(game)` gets the game object (hud, audio, player, wallet via
  `game.pay(amount, what)`).
- Per-frame logic: `ctx.update((dt, game) => ...)`.
- Parked cars: push `{ x, z, ry, kind? }` onto `ctx.parking`; the vehicle
  system fills them.
- Deterministic randomness only: `ctx.rng(seed)` / `rngKit(seed)`.
- Textures: draw with Canvas2D (`canvasTex`, `signTex`, `centerText`,
  `weather` in `textures.js`). No image or sound files in the repo.

## Style rules

- Real sizes: a storey in a panel block is 2.8 m, a door 2.1 m, a kerb 0.15 m,
  a Lada is 4.1 x 1.6 m, a bus is 11-12 m.
- Signs are in Russian and Kazakh, as they were: Cyrillic, with Kazakh
  letters (Ә Ғ Қ Ң Ө Ұ Ү І). Nothing from after 2008 (no Latin-script
  Kazakh, no smartphones, no LED screens, no Kaspi).
- Colours come from `PAL` in `palette.js` unless they belong to one object.
- No console.log in committed code. `console.warn` / `console.error` for
  real problems only.

## Performance budget

Target 60 fps on a 2020 laptop at 1080p. Watch `?stats`: keep scene draw
calls under ~900 in any view and triangles under ~2.5 M. Batch everything
static. Prefer canvas-textured facades plus a little real geometry
(balconies, canopies, cornices) over modelling every window frame.
