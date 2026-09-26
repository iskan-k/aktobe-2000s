# Aktobe 2000s

A walk-around town in the browser: a few blocks of Aktobe, Kazakhstan, on a
warm June evening in 2007. Poplar fluff drifts over the avenue. Trolleybus
route 1 runs under its wires, and marshrutkas stop wherever you wave. Diesel
trains cross the level crossing by the station. The look is cartoony but
realistic: real sizes, simple shapes, flat colour, thin ink lines.

It is built with Three.js. Every texture is drawn with Canvas2D, and every
sound is synthesised in WebAudio. The repo has no image or sound files.

Inspired by [Sakura Crossing](https://github.com/Kenton-GMI/sakura-crossing)
(MIT). The shadow-tint patch and the depth ink pass are adapted from it. See
`LICENSE`.

## Run it

Node 18 or newer.

```bash
npm install
npm run dev        # then open http://127.0.0.1:5188
```

`npm run play` builds the project and serves the build on port 5189.

## Controls

| Key | What it does |
|---|---|
| WASD or arrows | walk, or drive |
| Shift | run |
| Space | jump (about half a metre: onto a bench, over a low wall) |
| Mouse | look (click the page to capture the mouse) |
| E | use, buy, board, get in or out, request a stop, drop an empty in a bin |
| Click or F | take a bite or a sip of what you are holding |
| V | call your car (a VAZ-2107): it appears a few metres in front of you |
| F | in the car: switch the camera, chase or driver's seat |
| Space | in the car: horn |
| T | map |
| M | sound on or off |
| R | back to the start |
| Esc | pause |

## What is in the town

- **Streets.** Six streets, among them пр. Абулхаир хана (the avenue),
  ул. Айтеке би and пр. Санкибай батыра. They have signal junctions with
  Soviet-style lights, zebra crossings and worn road paint. Traffic drives on
  the right.
- **Traffic.** 36 vehicle models from the period: Ladas from the 2104 to the
  2110, Volgas, a Moskvich, Audi 80s, Passat B3s, a Mercedes W124, a Camry,
  a Nexia, UAZs, Gazelles, KamAZ and ZIL trucks. Cars follow each other,
  change lanes, obey the lights and yield to the right at unsigned junctions.
- **Public transport.** You can ride all of it. Pay the fare, sit down, and
  press E to ask for the next stop.
  - Trolleybus 1, along the avenue.
  - Bus 4 and bus 17.
  - Marshrutkas 31 and 44. Wave one down anywhere along the kerb.
- **Your car.** A семёрка (VAZ-2107) with a modelled interior. Press V to
  call it.
- **The railway.** Aktobe-1 station with its platform, footbridge, clocks,
  timetable and depot. Passenger and freight trains run on two tracks. The
  level crossing has lights, a bell and barriers, and road traffic waits
  at it.
- **Districts.**
  - The central square with the akimat and a fountain.
  - A microdistrict of five-storey panel blocks, and a belt of nine-storey
    blocks.
  - School No. 9.
  - The central bazaar.
  - A private-sector street of houses behind fences.
  - The station quarter.
- **Street life.** Kiosks and a bazaar where you can buy things with your
  1,500 tenge. Food and drink go into your hand: пломбир, эскимо, a brick
  loaf, lepyoshka, Тархун, Буратино and Дюшес lemonade, kvass in a гранёный
  стакан, Pepsi, семечки, kurt and strawberries. Click to eat or drink, and
  drop the empty in any bin. There are also payphones, a post box, pigeons, dogs, a cat,
  swings and a carousel, carpets to beat, a water pump, and 32 podyezd doors.

## Development

- `?dev` skips the title card. `?stats` shows frame rate, draw calls and
  triangles.
- `window.__city` is a small test API in the browser. `view()` moves the
  camera, `advance(s)` runs the simulation for s seconds, and `stats()`
  returns render counts.
- `tools/shot.mjs` takes headless screenshots. `tools/play.mjs` runs a
  scripted play-through and reports console errors. `tools/fps.mjs` measures
  frame rate at a few fixed views.
- `CLAUDE.md` has the conventions: coordinates, the master plan in
  `src/world/plan.js`, how to add geometry, and the performance budget.
- `docs/research.md` is the research brief on Aktobe in the 2000s that the
  town is based on.

## Known limits

- The town has no pedestrians. People appear only as drivers and
  passengers.
- When the barriers close, queues on пр. Санкибай батыра can wait about a
  minute.
- Headless Chrome on an Apple M5 Mac renders 1080p at about 200 to 300 fps.
  A slower laptop with integrated graphics is untested. The game lowers its
  render scale on its own if the frame rate drops.
