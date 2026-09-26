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
  - Bus 12 to the airport.
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
  - The station quarter, with the Эр 791-57 steam engine on its plinth.
  - The Nurdaulet mosque and shopping centre, where you start.
- **Sights on the south edge.**
  - The Memorial of Glory: the 19 m obelisk with its Civil War soldier,
    the Eternal Flame (lay carnations for 150 ₸), name walls, a T-34 and
    the 2005 bronze of Aliya Moldagulova.
  - The Lenin statue in its square, as it stood until 2018.
  - The statues have modelled faces, and the Abulkhair Khan monument on the
    square is a horse and rider.
  - The АҚТӨБЕ stele with its mosaic.
  - A kumys yurt with a mare and foal, and the shashlyk café «Жайлау».
  - A silver heating main that climbs over ул. Айтеке би.
- **South of the town fence.**
  - The Central Stadium, home of FC Aktobe, the 2005 champions: four stands
    in red and white, floodlights, a bulb scoreboard and the КАССА. Buy a
    ticket, climb the stands, sit down, and kick a ball on the pitch. A goal
    shows on the scoreboard.
  - Aktobe airport on ул. Бокенбай батыра: the terminal, the tower, and an
    apron behind a see-through fence. Every few minutes an Air Astana,
    SCAT, Starline.kz or Euro-Asia Air flight lands from the east or takes
    off to the west.
- **Animals.** About 20 dogs, 35 cats and 16 horses, with idle movement:
  stray packs, dogs on chains that bark at you, cats on benches and car
  bonnets, a cart horse and a herd on the steppe. Press E to pet one.
- **Street life.** Kiosks and a bazaar where you can buy things with your
  1,500 tenge. Food and drink go into your hand: пломбир, эскимо, a brick
  loaf, lepyoshka, Тархун, Буратино and Дюшес lemonade, kvass in a гранёный
  стакан, Pepsi, семечки, kurt and strawberries. Street stalls sell samsa
  from the tandyr, shashlik, chebureki and belyashi, tea with baursaks, and
  kumys and shubat. Click to eat or drink, and drop the empty in any bin. There are also payphones, a post box, pigeons,
  swings and a carousel, carpets to beat, a water pump, podyezd
  doors, and ground-floor flats turned into shops.

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
- The blue spruces still use the older faceted style.
- The airport runway runs east to west. The real one is 12/30.
- Some period details are best guesses and marked so in the code: the
  Moldagulova pose, the stadium poster's match date and the 2007 prices.
- Headless Chrome on an Apple M5 Mac renders 1080p at about 200 to 300 fps.
  A slower laptop with integrated graphics is untested. The game lowers its
  render scale on its own if the frame rate drops.
