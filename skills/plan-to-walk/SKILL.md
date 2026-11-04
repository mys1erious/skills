---
name: plan-to-walk
description: Turn a floor plan into a scroll-driven 3D web page where the plan is the 3D model itself. An ink plan sheet, a section cut that rises into walls, late sun sweeping the drawing into real stone, then a first-person walk through the rooms, plus a "your own plan" mode that builds any typed room list. Use when asked for a floor plan to 3D, a house, flat, villa, church or other building walkthrough, an architecture explainer, a real-estate or interior plan reveal, a "blueprint becomes real" scroll page, or a remix of the Villa La Rotonda "Plan to walk" build.
license: MIT
compatibility: Runs in any modern browser with WebGL. Loads three.js, GSAP and Lenis from jsDelivr. The check and render scripts need Node 22+ and Chrome, Chromium or Edge. MP4 export needs ffmpeg.
metadata:
  author: mys1erious
  version: "1.0.0"
---

# Plan to walk

One self-contained page (three.js 0.170.0, GSAP 3.13.0 + ScrollTrigger, Lenis 1.3.4, no build step). The opening
plan is not a picture: it is the model cut 1.2 m above the floor, seen from straight above through a 1.6° lens.
Scrolling raises the cut, so the walls grow out of the drawing; then the materials sweep in and the camera walks
through.

`SKILL_DIR` below is the folder this file lives in.

- Live example: https://mys1erious.github.io/3d-plan-to-walk/ (Palladio's Villa La Rotonda).
- `assets/template/`: `index.html`, CC0 textures in `tex/` (512 px copies in `tex/512/` for phones), and `README.md`.
  Use the README's Sources and Approximated sections as the model for yours.
- `scripts/`: `shoot.mjs` (screenshots at `?t=` moments), `render.mjs` (frame-exact video) and `cdp.mjs`, which
  drives headless Chrome with no npm packages. They need Node 22+, Chrome or Chromium (set `CHROME=` to pick one),
  and ffmpeg for the video.
- Idea credit: the format comes from @SammmAing's Casa Serra post (https://x.com/SammmAing/status/2109708195031900310).
  Their repo has no licence, so never read or copy its code. When posting, credit "inspired by @SammmAing".

## Start

1. Copy `$SKILL_DIR/assets/template/` into the new folder and run `python3 -m http.server`.
   - Open `?t=8.6` to see the money shot, and `?plan=flat` for a typed plan.
2. Pick a route:
   - **A typed plan** (any flat, house or office). Write a preset in the format below and add it to `PRESETS`.
     `planSpec()` builds the walls, doors, floors, sheet, walk and captions. This takes about 30 minutes.
   - **A hero building** (a real landmark, or anything with vaults, piers, a dome or spans over about 20 m).
     Write its own spec function, like `villaSpec()`. It needs its own geometry, a `draw*Sheet()`, hand-placed camera
     `keys`, reveal `zones` and `caps`.
     - A cathedral-sized one took about 45 minutes, and the inside came out stronger than the outside.
     - Read "Scale" below before you start.
3. Get real dimensions first, with a URL for each one. Write down everything you approximate.

## The typed plan format

```
title Two-bedroom flat
height 2.7          # ceiling, in units
wall 0.3
unit 1              # metres per unit; 0.357 for Vicentine feet
floor 0             # floor height above the ground
Hall 1.4 x 9.8 @ 4.2, 0          # name W x D @ x, y   (top-left corner, y runs down the sheet)
Rotunda Ø 30 @ 0, 0              # a round room: name Ø D @ x, y   (its centre)
```

- Rooms that touch share a wall. Doors follow a tree grown from the first room, which is the entrance.
- The room name decides what gets built:
  - portico, loggia or porch: columns
  - balcony, terrace or deck: a railing
  - a round room: a dome with an oculus and a lantern
- The room name also picks the floor:
  - bath: tiles
  - kitchen: a checker
  - round rooms: a radial marble floor
  - bedrooms and living rooms: oak
  - anything else: terrazzo
- Limits: 1 to 30 rooms, each 0.8 to 80 m, all within 80 m of 0, 0.
- What it can't express:
  - a room inside a room;
  - vaults, piers or several ceiling heights;
  - big spans. Over about 20 m the generic ceilings and roofs come out as solid black ink, so use the hero route.

## How `assets/template/index.html` works

| Piece | Where | Notes |
|---|---|---|
| Section cut | `cutPlane` and `renderer.clippingPlanes`, animated in `frame()` | Stencil caps (`sBack`, `sFront`, `cap`) fill the cut with ink. **They only work on closed solids**: an open mesh (a single plane, an open cylinder) leaks ink across the sheet. Typed plans hold the cut under the ceiling for a cutaway money shot (`cutHold`). |
| Ink drawing | 3 passes in `frame()`, then the `post` shader | 1. colour. 2. normals, depth and reveal (`NMAT`). 3. composite. Edges come from the normal difference plus the second difference of 1/z, so planes never read as creases. Paper shows where reveal = 0. |
| Drawing to real | `REVEAL` GLSL, put into every material by `inject()` through `onBeforeCompile` | `uZC[0]` is the exterior sweep: a huge sphere centred far to the right of the money shot. `uZC[1..]` are room zones (up to 19). The interior mask (`tIn`) decides inside from outside. A warm seam glows on the sweep edge. |
| Interior mask | `spec.mask` | `{ data, n` or `nx, nz, x0, z0, size` or `sx, sz, H }`: an RGBA `Uint8Array` over the plan. `r` > 127 means inside, `g` is the ceiling height as a fraction of `H`, and `b` / 40 is the floor type that `floorCol()` in `SURF` reads (0 terrazzo, 1 radial marble, 2 oak, 3 tiles, 4 checker). A new floor type is a new branch in `floorCol()` plus a new `b` code. |
| Landscape | `plantTrees()`, ground and hills, with `defines: { NOCLIP, FAR }` | The same grass, hills and cypresses for every plan. They ignore the cut, and far scenery reveals with the sky behind it. A city building needs its own ground (paving, blocks); keep `NOCLIP, FAR` on it. |
| Procedural surfaces | `SURF`, `paintFresco()`, `paintDome()` | Floors, wall paintings and coffers, painted at startup. No images are needed. |
| Camera | `riseCam()`, then `track()` | `riseCam()` runs from top-down at 1.6° to 40° and 31° elevation. `track()` is a Hermite curve through `spec.keys` (`{ t, pos, tgt, fov, e }`, `e` = exposure), stored as yaw and pitch so turns never flip. |
| Timeline | seconds; `#track` height is `total × 60 vh` | GSAP ScrollTrigger + Lenis drive scrolling. `?play` runs the clock on its own, `?t=` freezes one moment, `?p=` freezes a fraction of the whole. The beat times are constants at the top of the script (`B0`, `B1` rise, `TA`, `TB` money shot, `SW0`, `SW1` sweep). `bounce` switches on at 17-18.4 s in `frame()`. |
| Captions | `spec.caps`: `[t0, t1, kicker, line]` | A line shows for about 3 s. |
| Sheet | `spec.sheet = { draw, SW, SH, cz }`, in metres on the floor plane | The opening view fits the sheet's height, so a tall plan runs under the headline: add paper above it (a bigger `SH`, shift `cz`). The text sizes in `draw` are in sheet pixels and were tuned for a 52 × 66 m sheet; scale them for other sizes. |
| Phones | `?phone`, or a coarse pointer on a screen under 820 px | 512 px textures, a smaller shadow map, smaller painted textures. |

**Spec fields:**
- `G`: geometry lists per material key in `MAT`.
- `glass`, `lines` (ink line segments), `wins` (windows, for sun shafts).
- `R`: plan radius, m.
- `floorY`, `cutTop`, `cutHold`.
- `total`: timeline length, s.
- `money`: `{ a: { pos, tgt } }`.
- `rise`: `{ half, tgt }`, the framing at the end of the rise.
- `zones`: `{ c, r, t0, t1, m: [x0, z0, x1, z1] }` per room.
- `rot`: the round room. `[Vector4(x, z, radius, floorY), Vector4(springY, domeCentreY, domeRadius, 0)]`, or zeros for none.
- `oculus`: `{ x, z, r, yTop, yLow, floor }` or `null`.
- `bounce`: a fill light's position, or `null`.
- `avenue`: plant the cypress avenue.
- `hook`: the subline.
- `moneyDir` and `sweep` are computed by `useSpec()`; don't set them.

**Scale.** The defaults suit a 25-60 m villa. For bigger buildings, set these on the spec:

| Field | Default | What it does |
|---|---|---|
| `hazeD` | 650 m | Haze distance |
| `edgeFar` | `[70, 110]` m | Where ink edges fade out |
| `shadow` | `{ l, r, t, b, d: 80 }` | Shadow box and sun distance |
| `shaftL` | 9 m | Light shaft length |
| `shaftK` | 0.16 | Light shaft strength |
| `inDim` | `[0.6, 0.45, 1]` | Indoor sky light, reflections and direct sun. Lower the third value when big windows flood the floor: glass casts no shadow. |
| `inTint` | `[1, 1, 1]` | Indoor colour tint |

URL flags: `?play`, `?clean` (hides the UI), `?t=8.6`, `?p=0.5`, `?plan=flat` or `?plan=<url-encoded text>`, `?phone`.

## Beats that worked (about 40 s of scroll)

| s | Beat |
|---|---|
| 0 to 0.5 | The sheet holds, already pushing in. Headline: "This floor plan is a 3D model". |
| 0.5 to 4.5 | The cut rises while the lens opens. The walls are line drawings. |
| 6.6 to 10.6 | **Money shot:** a three-quarter view in low sun (15°) as the materials sweep from ink to stone. The first striking frame of the video comes from here. |
| 12 to 40 | The walk: the entrance, the main space (each room fills in as you arrive), the centrepiece with a look up, the far end, the view out. |

## Check before you show it

- **Screenshots:** take about 10 `?t=` moments at desktop and phone size, then Read the images:
  ```
  node $SKILL_DIR/scripts/shoot.mjs "http://127.0.0.1:8000/" shots/desk --size 1280x800 --times 0.3,3,8.6,11,15,20,24,27,31,39
  node $SKILL_DIR/scripts/shoot.mjs "http://127.0.0.1:8000/" shots/phone --size 390x844 --scale 2 --times 0.3,8.6,20
  ```
  `shoot.mjs` prints page errors and exits 1 if there are any.
- **What earlier reviews flagged:**
  - Doorways in shadow read as dark wedges at the frame edge.
  - Long passages show big flat dark walls.
  - Trees still in ink read as grey ovals.
  - A typed balcony looks out at nothing.
  - A façade in one flat colour (vary the stone, add relief).
  - Repeated stained-glass panels.
  - The typed version of a hero building comes out much simpler.

## Working with the user

- **Work in checkpoints, and show each one live before going on:**
  1. the sheet, the rise and the walk to the first room;
  2. the view: money shot, detailed rooms, the full walk, your own plan.
- **Each time, give the user a table of `?t=` links, one per moment, with what to judge at each.**
- **If nobody can answer while you work,** do both checkpoints in one go, note your decisions, and end with that table.
- **No video until the user says the view is final.** Then record it:
  ```
  node $SKILL_DIR/scripts/render.mjs "http://127.0.0.1:8000/?clean&play" frames --seconds 40 --fps 30 --size 1080x1350 --mp4 video/<slug>.mp4
  ```
  Use 1080x1350 for phones and X, or 1920x1080. The page animates from rAF time only, so the video is frame-exact.

## Honesty

- **Sizes:** every size gets a source with a URL in the README.
- **Disagreements:** when sources disagree, pick one and list it under "Where sources disagree" in the README, with both numbers and their sources.
- **Approximations:** the README has an "Approximated (not from the sources)" section, with inventions in bold (for example, "The dome coffers are our addition").
- **Materials:** only from CC0 sources (Poly Haven), named in the README.
