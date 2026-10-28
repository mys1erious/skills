# Rendering

## Contents
- The grid
- The cell buffer
- Batching
- Glyph sets
- Colour roles and styles
- Post effects on the buffer
- Performance budget
- Mounting: frameworks, backgrounds behind UI, embeds
- Accessibility

## The grid

- The canvas covers its box. Its backing store is `W × dpr` by `H × dpr`, with `dpr = min(devicePixelRatio, 2)`, and the context uses `ctx.setTransform(dpr, 0, 0, dpr, 0, 0)`.
- Create the context with `{ alpha: false }` when the piece paints every pixel. Use the default (alpha on) when it is a transparent layer over a page.
- Columns and rows: `cols = ceil(W / CW)`, `rows = ceil(H / CH)`. Cell `(c, r)` has its centre at `(c·CW + CW/2, r·CH + CH/2)`.
- Font: `${FONT}px ui-monospace, "SF Mono", SFMono-Regular, Menlo, Consolas, monospace`, with `textAlign = 'center'` and `textBaseline = 'middle'`, drawn at the cell centre plus 1 px of y.
  - A web font needs `await document.fonts.ready` before you bake anything that uses it.
  - Bold (`700`) reads better at small sizes and for text rendered as ASCII.

| Cell (CW×CH, font) | Use |
|---|---|
| 5×7, 6.5 / 6×9, 7.5 | phones, or very fine detail |
| 7×10, 9 | detail pieces: eyes, faces, portraits |
| 8×12, 10.5 | default |
| 9×13, 10.5 bold | chunky, poster, tile-heavy looks |

- Recompute everything in `resize()`: the grid, buffers, baked layers and seeded layouts.
- Use a scale factor `s = min(W, H) / 900` for speeds and distances, so a piece looks the same at every size.

## The cell buffer

The scene writes into four typed arrays, and the renderer reads them:

```js
G    = new Uint16Array(n)   // glyph char code (32 = empty)
ROLE = new Uint8Array(n)    // colour role, 0 = nothing
A    = new Float32Array(n)  // glyph alpha
TL   = new Float32Array(n)  // tile alpha: a filled cell drawn behind the glyph
```

- Clear the arrays every frame and write layers back to front. `cell()` replaces what's there.
- See-through layers and glows use `over()`, which writes only where it is brighter. Otherwise a faint mark erases the bright thing under it and leaves a dark stripe.
- A buffer, rather than drawing straight to the canvas, buys you:
  - **post effects:** warps, impact frames and shake are applied to the whole frame;
  - **text export:** see `frameText()` in the starter;
  - **several views of one simulation:** for example a 2×2 grid comparing four styles at half scale.
- Small pieces with no post effects can draw directly with a `put(x, y, glyph, colour, alpha)` that batches. It's the same idea without the arrays.

## Batching

- `fillStyle` changes are the cost, not `fillText`. Never set a colour per cell.
- Bucket cells by role and alpha level. The starter uses 20 levels per role and precomputes every `rgba()` string once per style.
- Draw in two passes:
  1. tiles, with `fillRect` over the whole cell;
  2. glyphs, with `fillText`.
- Banding: a smooth gradient quantised to levels shows seams. Add one level of hashed dither before quantising:

```js
const L = Math.round(clamp(v + ((hash2(k, 7) & 255) / 255 - 0.5) / LV, 0, 1) * LV);
```

- Glow: never use `shadowBlur` per glyph, which is slow and smears.
  - Around small bright marks such as sparks, heads or a core, draw slightly enlarged tiles at about 0.1 alpha.
  - For a static layer, bake a blurred copy once.
  - Never draw a broad wash as tiles below about 0.1 alpha: their cell edges show as a lighter rectangle where the area ends. Use sparse `.` and `:` glyphs, chosen by hashed chance, instead.
- Bake static layers into an offscreen canvas at resize and `drawImage` them each frame: backdrop gradients, vignette, scanlines, paper grain, a starfield.

## Glyph sets

| Set | Glyphs | Use |
|---|---|---|
| Short ramp | ` .:-=+*#%@` | Default tone. It reads well at every size. |
| Soft ramp | ` .:;-=+*#%@` | More steps in the darks |
| Long ramp | `` .'`^",:;Il!i><~+_-?][}{1)(|\/tfjrxnuvczXYUJCLQ0OZmwqpdbkhao*#MW&8%B@$`` | Photos and portraits at fine grids |
| Direction | `- \ | /` | Edges, contours, rings, motion streaks. Pick the glyph with `dirGlyph(dx, dy)` (4 directions by angle). |
| Marks | `. · * + x o` | Stars, sparks, particles, rain heads |
| Blocks (Unicode) | ` ░▒▓█` | Chunky fills. Check that the font has them. |
| Braille (Unicode) | `⠀`–`⣿` | 2×4 dots per cell for high-resolution line art. It needs font support and reads as dots, not type. |

- A circle's edge uses the glyph tangent to it: `dirGlyph(-dy, dx)`, where `(dx, dy)` runs from the centre to the cell.
  - Below about 8 cells of radius, four directions make a hexagon. Use `(` `)` on the sides, `_` at the bottom, `-` or `'` at the top, and `/` `\` on the diagonals, or draw the ring as tiles.
- A moving particle uses its velocity: `dirGlyph(vx, vy)`.
- Pure ASCII travels everywhere: plain text, terminals, any font. Use Unicode sets only when the output stays on your own canvas.

## Colour roles and styles

- A style is a background plus 3–4 role colours: 1 dim, 2 ink, 3 accent, 4 hot. Optional flags change the treatment:
  - `tiles` gives chunky filled cells;
  - `glow` adds a glow pass;
  - `crt` adds scanlines and a vignette;
  - `tone` gives a manga screentone, where mid-tones become a dot pattern;
  - `grain` adds paper noise.
- The scene picks a role per cell for what the thing is, not for a colour. The style decides the colour. That is what makes style switching free.
- Where a material changes role with brightness, switch by hashed chance across a band: `hash2(c, r) % 100 < 100 * smooth(a, b, v)`. A hard threshold draws a visible contour.
- Font weight: bold (700) reads clearly on dark grounds at 9–11 px. Regular (400) suits fine detail and light grounds. The starter's `WEIGHT` sets it.
- **Impact frames:** for 1–3 frames, draw every role in one colour on a second colour, such as white on black or red on black, then switch back.
- **Comparing styles:** render the same buffer into four quadrants at half scale with four styles, and draw a 2 px divider.
- **Light grounds:** density reads as dark. Map shadow, not light, to dense glyphs, or the subject looks like a negative.

## Post effects on the buffer

- **Warp** (spiral, lens, ripple): build the next frame by sampling the buffer at displaced coordinates. For each cell, find the source cell `(c', r')` from a displacement field and copy its glyph, role and alphas. A spiral rotates by an angle that falls off with distance; a lens scales the radius.
- **Shake:** translate the whole render by `(rand − 0.5) · 2 · shake` px. Then decay it with `shake *= exp(−6·dt)`.
- **Slow motion:** scale `dt` for the simulation while input stays live.

## Performance budget

- On a desktop, 15–30k glyphs per frame at 60 fps is comfortable. 1440×900 at 8×12 cells is about 13.5k cells.
- Skip empty cells. Loop only over a layer's bounding box.
- Hoist per-frame constants out of per-cell loops: light vectors, rotation sines, geometry.
- Particles: use a spatial hash and cap neighbours at K (for example 7) for flocking. Above about 2k particles, draw density per cell rather than each particle.
- Simulate at a fixed step, independent of the render rate. Clamp `dt` to 0.05 s after a stall so the simulation never explodes.

## Mounting: frameworks, backgrounds behind UI, embeds

React (the same shape works anywhere a component can own a canvas):

```jsx
useEffect(() => {
  const stop = startAscii(canvasRef.current); // the starter's IIFE body, returning a cleanup
  return stop;                                // cancel rAF, disconnect ResizeObserver, remove listeners
}, []);
```

When the piece sits behind real UI, such as a hero or a login page:
- Use a transparent context and `clearRect`, or paint the page's own background colour.
- Listen for the pointer on the container or `window`, not the canvas. That way UI on top keeps its clicks, and the art still reacts.
- Give the canvas `pointer-events: none`. Never cover form fields.
- Keep the real text and logo in the DOM for screen readers and SEO. If you redraw them as ASCII, hide the DOM copy visually (not with `display: none`) and read its layout with `getBoundingClientRect`.
- Read theme colours from CSS with the canvas probe in `recipes.md`, and rebuild the art when the theme changes.

Embeds and sandboxes:
- Size from the canvas's own box (`getBoundingClientRect`), not `innerWidth`, because hosts pad pages.
- Expect downloads, `alert` and the clipboard to be blocked. Feature-detect, and fail quietly.

## Accessibility

- The canvas gets `role="img"` and an `aria-label` that says what the piece shows and what the mouse does.
- `prefers-reduced-motion`: start paused on a good frame (the starter freezes at t = 3). Space still plays it.
- Never flash the whole screen more than 3 times a second. Impact frames are 1–3 frames, spaced well apart.
