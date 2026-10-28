# The 3D figure

## Contents
- The scene contract
- Where things go
- The kit
- Camera shots
- The model behind the scene
- Hooks for tests and scripts

## The scene contract

`src/lessons/000N.scene.js` default-exports `{ n, build(kit) }`. `build` runs once, the first time the reader reaches the lesson, and returns:

| Member | Called when | Must |
|---|---|---|
| `group` | at build | A `THREE.Group` holding the whole figure. The book places it on the page and lifts or folds it on arrival and departure. |
| `sim` | always | The lesson's model (below). Tests read `sim.margin()`, `sim.challenge()` and `sim.state.selected`. |
| `targets()` | on every pointer move | The meshes a tap can hit. Each carries `userData.targetId`. |
| `tap(id)` | a 3D tap, or the text version's button | Update the model and the drawing, then call `kit.onChange()` |
| `hover(id)` | on pointer move over a target | Return the tooltip text |
| `setSwitch(id, i)` | a printed switch pill, or the text version's radio | Update and redraw; may return the animation's promise |
| `switchValue(id)` | on every redraw of the page | The selected option's index, so the page draws the pill as on |
| `press(id)` | a printed button | Optional when the lesson has no buttons |
| `a11yItems()` | on every redraw | `[{ id, label, status }]`: the tappable things for the text version. The ids must match `targets()`. |
| `shots()` | Watch | 5 shots `{ kind, enter, pose }` (below) |
| `reset()` | the last shot, and when you need it | Back to the starting state, then `kit.onChange()` |

`kit.onChange()` tells the book that the model changed. The book redraws the right page (margin, pills), updates the text version, and stamps the left page when `sim.challenge().met` first turns true.

## Where things go

- **Units are world units.**
  - A page is 21 wide (x) and 28 deep (z). The right page spans x 0 to 21 and z −14 (top edge) to +14 (bottom edge).
  - Your `group` sits on the page surface, so y = 0 is the paper.
  - The left page is x −21 to 0. Don't build there, because the words live there.
- **The figure's area is x 1–20, z −12 to 7.** Below z ≈ 8 the page prints the figure caption, the try hint, the switch and button pills, and the margin column. That is page pixels y ≥ 1150 of 1400, with 50 px per world unit.
- **The reading view looks from the front at about 50° down.** Height lifts things up the page on screen: the top of something h tall at depth z shows where a flat mark at z − 0.8h would. Keep z − 0.8h ≥ −11, or it covers the running head. Put tall things forward (z 0 to 5) and keep the back of the page for flat or low things. Check with `npm run shoot`.
- **Scale:** a card from `createCard` is 3.0 × 1.9. A figure that reads well is usually 15–19 across and 4–8 tall.
- **The light** comes from the back left (direction −0.62, 0.62, −0.48), so shadows fall forward and to the right. Faces turned toward the reader, or toward the right, are in shade and get hatched. A row of boxes therefore shows a row of hatched fronts: use `hatch: 0.5` or less for many small solids, and light fills.

## The kit

`build(kit)` receives:

| Name | Signature | Use |
|---|---|---|
| `THREE` | | three.js 0.186 (or `import * as THREE from 'three'`) |
| `inked` | `inked(geometry, { fill, ink, width = 1.6, threshold = 25, hatch = 1, material })` | A solid with ink outlines on edges sharper than `threshold` degrees, and hatching in shade. `hatch` 0–1. `material` replaces the fill, for example an array of six materials for a box. |
| `hatchMaterial` | `hatchMaterial({ color, map, density = 3.4, hatch = 1 })` | The hatched paper material on its own |
| `inkPath` | `inkPath([[x, y, z], …], { color, width })` | A drawn line through 3D points. Move it later with `line.geometry.setPositions(flatArray)`. |
| `inkLoop` | `inkLoop([[x, z], …], { color, width, y })` | A closed line lying on the page |
| `inkBox` | `inkBox(w, h, d, { color, width })` | The outline of a box: a glass case or a bounding region |
| `inkMaterial` | `inkMaterial(color, width)` | The shared line material, for recolouring a line |
| `pageText` | `pageText(text, { width, size = 72, hand = true, color, weight, align })` | Words lying flat, lit like paper. To write on a face that looks at the reader, set `rotation.x = 0` and place it 0.01 in front of that face. |
| `floatLabel` | `floatLabel(color, height = 0.62)` then `.set(text, ink)` | A handwritten label that faces the reader and is drawn on top. Rewrite it with `set`, and keep it under about 30 characters. |
| `halo` | `halo(color, size = 3)` | A soft glow sprite: the "look here" mark |
| `createCard` | `createCard({ id, text })` | An index card with up to three handwritten lines. It has `.mesh` (tappable as `id`), `setText`, `setColor` (a coloured header), `setGlow(color or null)` and `setMark(bool)` (a red "?"). |
| `createTray` | `createTray(w, d, { rim, wall, fill, hatch })` | A shallow inked tray, to sort things into. Things resting in it go at y = `TRAY_FLOOR` + a little. |
| `pose` | `pose([x, y, z], { distance = 26, elevation = 30, azimuth = 0 })` | A camera pose for a Watch shot. It looks at a point in the figure's own coordinates from `distance` away, `elevation` degrees above the page and `azimuth` degrees round from the front (positive is from the right). |
| `tweens` | `tweens.run(update(t), seconds)` returns a promise | Animate: `update` gets an eased 0..1. In still mode it jumps to 1. |
| `clearGroup` | `clearGroup(group)` | Empty a group and free its GPU memory |
| `onChange` | `onChange()` | Tell the book the model changed |
| `PAGE_TOP` | | The page's height above the desk; your group is already there |

**Conventions:**
- **Decoration must not catch taps.** Set `mesh.raycast = () => {}` on everything that isn't a target. Outlines, labels, halos and `pageText` already have it.
- **Ink and paper:** use `#1c2433` for ink and `#fbf7ee` for paper-white solids, with pale fills such as `#f6efe0` and `#f1e6cc`. Colour goes on few things.
- **Emissive glow:** use `emissive` with `emissiveIntensity` of about 0.6 only for the one thing to look at. Bloom picks it up; nothing else glows.
- **Transparent things** (glass, bubbles) take `MeshStandardMaterial({ transparent: true, opacity: 0.13, roughness: 0.06, envMapIntensity: 1.6, depthWrite: false })` plus an ink outline, so they read as drawn glass.
- **Many things:** a few hundred inked meshes are fine. For thousands of points, use one `InstancedMesh` and draw ink only on the few that matter.

## Camera shots

`shots()` returns five entries, in caption order:

```js
{ kind: 'wide', enter: () => this.reset(), pose: () => kit.pose([10.5, 2, 1.5], { distance: 31, elevation: 35 }) }
```

- **`kind`** is a note for editors. Use the usual set: `wide`, `close`, `cutaway`, `angle`, `handover`.
- **`enter()`** runs as the camera starts to move. It puts the figure in the state the caption describes. It may return a promise, for example a tween, and the shot holds until both the move and that promise finish. `enter: null` keeps the state.
- **`pose()`** returns `{ pos, target }` in world coordinates. Build it with `kit.pose`, which takes the target in the figure's own coordinates (your group sits at y = `PAGE_TOP` in the world; x and z are the same). `pose: null` means the reading view; the last shot uses it.
- **Holds:** each shot holds 2.6 s (the last 1.4 s), then the camera flies back to the reading view.
- **Escape** skips the tour, and the last shot's `enter()` still runs. So `reset()` there leaves the figure clean.
- **Framing:** the camera's vertical field of view is 30°. To fit something W wide, stand back about W × 1.1 at 16:9 (`distance` in `kit.pose`). The caption covers the top ~15% of the screen and the toolbar the bottom ~10%. Aim at the subject's centre and check the frame with `npm run shoot -- --tour`.

## The model behind the scene

`src/sims/<name>.js` exports a factory, for example `createBalance()`, returning:

- `state`, with `selected` (the id of the tapped thing, or null);
- `margin()`: an object of strings, or `null` for a line that shouldn't show, with one key per `{field}` in the lesson's `margin.lines`;
- `challenge()`: `{ met, value, target, text }`. Once met, it stays met until `reset()`;
- `set(key, i)`, `press(id)`, `tap(id)` and `reset()`. These throw on an unknown key or id, so a typo fails a test instead of doing nothing.

**Keep it deterministic:** no `Math.random` and no time. When the lesson needs data (points, messages, measurements), put it in a JSON file next to the lesson and cite where it came from. The screenshots, the tour and the tests all assume every reader sees the same story.

## Hooks for tests and scripts

`window.__ready` turns true after the third rendered frame. `window.__book` exposes:

- `S.k`: the current spread;
- `LAST_SPREAD` and `spreads`;
- `goTo(k)`, which returns a promise;
- `actions`: `predict(i)`, `flap()`, `setSwitch(id, i)`, `press(id)`, `tap(id)`, `watch()` and `toggleStill()`;
- `current()`: the lesson runtime, `{ n, content, state, scene }`;
- `lesson(n)`, `glossary` and `sources`;
- `surface(k, side).regions`: the printed controls' rectangles in page pixels, with ids `predict:i`, `flap`, `switch:id:i`, `button:id`, `watch` and `goto:k`;
- `screenOf(side, x, y)`: a page pixel to a screen point;
- `project(worldVector)`: a world point to a screen point.

The test helpers `clickPrinted(page, side, id)` and `clickTarget(page, id)` in `tests/book.spec.mjs` use these hooks to click what a reader would click.
