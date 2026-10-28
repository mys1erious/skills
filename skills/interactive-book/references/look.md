# The look

## Contents
- What makes it read as a finished book
- The renderer, setting by setting
- Changing the mood
- The review method

## What makes it read as a finished book

Found on the first book built with this template. Its first version used flat colour on a plain desk; side by side with Every Joule it read as a prototype. These closed the gap, in order of effect:

1. **Window light with soft shadows,** instead of even light. One warm key light comes from the back left, plus a dim hemisphere fill and a room environment map for the reflections. A window frame far up the light's path throws its shadow across the desk.
2. **Tone mapping and white paper.** The paper is `#fcfaf5` under Neutral tone mapping at exposure 1.08. Paper that is too yellow looks old, and paper that is too white glares.
3. **The hatched ink material:**
   - paper-white solids with outlines;
   - fine pencil strokes where the key light doesn't reach;
   - a second, crossing set only in the deepest shade.
4. **Figures that fill the page.** One big subject beats several small ones.
5. **A real book object:** a cloth cover, page edges on the stacks, a ribbon bookmark, and a felt mat under the book.
6. **The front matter:** a title page with a small ink drawing, a "how to use this book" list, a contents page with page numbers and dotted leaders, and the colour key.

## The renderer, setting by setting

All in `src/engine/stage.js`, `book.js` and `ink.js`. Change one thing at a time and screenshot before and after.

| Setting | Value | Why |
|---|---|---|
| Tone mapping | `NeutralToneMapping`, exposure 1.08 | Keeps the paper white and the colours true. ACES shifts hues. |
| Key light | Directional `#fff3e2`, 2.6, from (−0.62, 0.62, −0.48) | Late daylight from a window behind and to the left |
| Shadows | VSM, map 4096 (2048 on the medium tier), radius 5, 16 blur samples | Soft edges like daylight; PCF looks like a lamp |
| Fill | Hemisphere 0.55, plus `RoomEnvironment` through PMREM at 0.55 | Shade that isn't black, and glass with something to reflect |
| Bloom | `UnrealBloomPass` strength 0.6, radius 0.5, **threshold 2.6** | Lit paper reaches about 2 before tone mapping, so only emissive glows bloom |
| Vignette | offset 0.95, darkness 0.9 | Frames the desk and pulls the eye to the book |
| Antialiasing | MSAA ×4 on the HalfFloat render target | Ink lines stay clean through post-processing |
| Pixel ratio | min(devicePixelRatio, 1.5) | Sharp enough. If the first 60 frames run slow, it drops to 1. |
| Hatching | strokes `0.13 × smoothstep(0.35, 0.9, shade)`, cross strokes above 0.93, mix 0.42 | Shade reads as drawn without turning grey |

**Tried and dropped:**
- Screen-space AO (GTAO) drew dark squares around transparent labels and halos.
- A bloom threshold of 0–1 washed out the whole page.
- Cross-hatching on all shade, and hatching on floors, looked like a lattice.

**Hatching on fronts:** with the light from the back left, every face toward the reader is in shade. On one big solid that reads as drawn. On a row of many small solids it reads as a row of grey fronts, so use `hatch: 0.5` or less there, and light fills (washes such as `#f0a066`, not full-strength colour).

**Quality tiers:**
- `high`, the default, has everything above.
- `?tier=medium` uses a smaller shadow map.
- `?tier=low` has no post-processing and no shadows, for weak machines and fallback screenshots.

## Changing the mood

Safe to change:
- **Cover and ribbon colours** in `book.json`: a deep cloth colour with a contrasting ribbon.
- **The desk:** `deskTexture()` (pale oak planks) and `matMesh()` (the felt mat colour `#a8bcb3`).
- **The background and fog colour,** `#d8d0c2`.
- **The accent colour** on the pages: `ACCENT` in `page.js`, the red used for labels and the handwritten challenge.

Change with care:
- **Light direction:** the window frame's shadow, the shadow camera bounds and the hatching all assume it.
- **Exposure, and the hatch normalisation `albedo × 0.51`:** the hatch shader measures shade relative to a face in full window light.

## The review method

When a page looks weak and you can't say why:

1. **Screenshot the reference and your book under the same conditions:** the same viewport (1280×720 at scale 1.5), the reading view, and the GPU. `npm run shoot` does it for yours. A reference has its own controls and tour, so screenshot it by hand in a browser window of the same size.
2. **Compare in this order:**
   - light and shadow;
   - the paper's tone;
   - how much of the page the figure fills;
   - line quality;
   - colour discipline;
   - the front matter.
3. **Capture every intro shot** (`npm run shoot -- --tour`). Overlaps and cropping show up there, not in the reading view.
4. **Fix in order of reach:** engine first, then the book object, then shared kit parts, then each lesson, then the front matter. Run `npm test` after each stage.
5. **Shoot again and compare** with the same frames.
