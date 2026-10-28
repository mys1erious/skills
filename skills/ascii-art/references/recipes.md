# Recipes

These snippets assume the starter's helpers: `cell`, `put`, `dirGlyph`, `vnoise`, `smooth`, `clamp`, `hash2`, the seeded `rng`, the scale `s`, and the grid `CW`, `CH`, `cols`, `rows`.

## Contents
- Timeline and beats
- Shapes, lines and shading
- Noise fields
- Fire
- Lightning
- Rain and snow
- Particles and flocks
- Ropes, tentacles and hair
- Ripples and shockwaves
- Warps
- Impact frames and shake
- An eye
- Image or logo to ASCII
- Text to ASCII
- Reading CSS colours

## Timeline and beats

- `t` is the timeline. It runs from 0 to `LOOP` and wraps. Scripted motion is a pure function of `t`, so `?t=` stills and recorded takes are exact.
- `ft` never wraps. Use it for the age of effects started by input.
- Build curves from `smooth(a, b, t)` and easing:

```js
const open = t => t < 0.2 ? 0 : t < 1.2 ? easeOut((t - 0.2) / 1) : t < 10.5 ? 1 : 1 - smooth(10.5, 11.4, t);
const BEATS = [{ at: 4.0, fire: () => hit('red', 0.08, 5) }, { at: 9.3, fire: () => burst() }]; // fire once per loop
```

- Everything visible repeats a whole number of times per loop:
  - oscillations are `sin(t / LOOP * TAU * k)` with an integer `k`;
  - noise drifts on a circle, e.g. `vnoise(x + R·cos(t / LOOP · TAU), y + R·sin(t / LOOP · TAU))`;
  - rotations make whole turns;
  - textures on a spinning sphere sample noise on `cos` and `sin` of the longitude, so the texture wraps around.
- `?t=` warm-up runs `update()` from 0, so beats fire there too. Keep beat effects in the same seeded RNG stream.
- A story cut: 3–5 beats, with the hero moment around 40–60% of the loop and a quiet bridge back to the first frame.
- Add a "hold beat" mode: `H` freezes `t` while effects keep running on `ft`. It lets people play with each moment.

## Shapes, lines and shading

- **Discs and spheres:** loop over the bounding box. Work in pixel space, normalised by the radius: `nx = (x − cx) / R`, `ny = (y − cy) / R`, `nz = √(1 − nx² − ny²)`. Diffuse light is `max(0, n · L)`. Use it for the tile alpha and the ramp glyph, and add surface texture from noise in sphere coordinates: `atan2(nx, nz)`, `asin(ny)`. The full version is in the starter.
- **Rims:** the cells where `|dist − R| < CH · 0.6` get `dirGlyph(-dy, dx)`. This makes an outline that reads as drawn.
- **Lines:** step along the segment in increments of `min(CW, CH) / 2` and `put` a direction glyph:

```js
function line(x0, y0, x1, y1, role, a) {
  const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0) / (Math.min(CW, CH) / 2)), g = dirGlyph(x1 - x0, y1 - y0);
  for (let i = 0; i <= n; i++) put(x0 + (x1 - x0) * i / n, y0 + (y1 - y0) * i / n, g, role, a);
}
```

- **Signed distance fields** (boxes, capsules, unions) make shapes in one pass. The value is negative inside and positive outside. Inside, `−d` gives a falloff for shading; `|d| < CH/2` gives an outline.

## Noise fields

- Value noise is in the starter. For fBm, sum 3–4 octaves, doubling the frequency and halving the amplitude each time.
- Make it flow by moving the sample point over time: `vnoise(c·0.05 + t·0.12, r·0.08 − t·0.05)`.
- Domain warp (marbled, smoky): `n = noise(p + 2·(noise(p + a), noise(p + b)))`.
- Threshold it to keep calm areas. Only draw where `n > 0.6`, and scale the alpha by `(n − 0.6) · k`.

## Fire

This is the doom-fire heat field, at cell resolution or coarser:

```js
// sources on the bottom row; each step every cell takes heat from below with a sideways drift and loses some
for (let x = 0; x < fw; x++) heat[(fh - 1) * fw + x] = source(x, t); // modulate with noise: licks, not a wall
for (let y = 0; y < fh - 1; y++) for (let x = 0; x < fw; x++) {
  const sx = clamp(x + ((rng() * 3) | 0) - 1, 0, fw - 1);
  heat[y * fw + x] = Math.max(0, heat[(y + 1) * fw + sx] - rng() * decay); // decay sets the height: 0.03 tall, 0.1 short
}
```

- Map heat to the ramp: above 0.8 is hot, above 0.45 is accent, else ink. "Black flames" swap the roles: a dark core with coloured edges.
- Keep gaps. A fire covering the whole frame buries the subject. Cut the sources with noise bands, and stop at a maximum height.

## Lightning

```js
function bolt(x0, y0, x1, y1, rough, depth, out) { // midpoint displacement with occasional branches
  if (!depth) { out.push([x0, y0, x1, y1]); return; }
  const mx = (x0 + x1) / 2 + (rng() - 0.5) * rough, my = (y0 + y1) / 2 + (rng() - 0.5) * rough;
  bolt(x0, y0, mx, my, rough / 2, depth - 1, out); bolt(mx, my, x1, y1, rough / 2, depth - 1, out);
  if (depth > 2 && rng() < 0.25) bolt(mx, my, mx + (rng() - 0.5) * rough * 2, my + rng() * rough, rough / 2, depth - 2, out);
}
```

- Draw each segment with `line()` in the hot role, and add a dim halo of `.` in the cells next to it.
- Make a new bolt every 50–80 ms, not every frame. The flicker is what reads as electricity.
- Charging: grow the bolts' length and count with the charge. Strike: one long bolt, then an impact frame.

## Rain and snow

- Particles are `{x, y, v, len, z}`. Draw `len` cells of `|` (or `/` and `\` in wind), fading upward. Depth `z` sets the speed, alpha and role, which gives parallax.
- Rain stays thin glyphs, never tiles, or it turns into stripes.
- Obstacles: skip drops inside a radius (a cursor umbrella) and spawn short-lived `.` and `,` splashes on its edge.
- "Time stops": ease the speed to 0 and hold. It is a strong beat for little code.

## Particles and flocks

- Draw particles as velocity glyphs (`dirGlyph(vx, vy)`). Draw the brightest as `*` or `@` heads with a dimmer tail.
- Flocks (boids):
  - Separation, alignment and cohesion over the K nearest neighbours, found through a spatial hash (cell size = neighbour radius).
  - Group steering toward a slowly moving point.
  - Soft containment in an ellipsoid.
  - A panic wave: one bird is scared and the scare spreads to its neighbours over a few frames. The ripples through the flock are what make a murmuration.
- 3D: project with `x' = cx + x·f / (z + d)`. Depth picks the role (far is dim) and the glyph (far is `.`, near is direction glyphs).
- Above about 2k particles, accumulate density per cell and draw that through the ramp.

## Ropes, tentacles and hair

```js
// a chain hanging from an anchor: verlet integration, then a few passes that restore each link's length
function stepChain(p, anchor, seg, dt, gravity = 300 * s, drag = 0.985) {
  p[0].x = anchor.x; p[0].y = anchor.y;
  for (let i = 1; i < p.length; i++) {
    const q = p[i], vx = (q.x - q.px) * drag, vy = (q.y - q.py) * drag;
    q.px = q.x; q.py = q.y; q.x += vx; q.y += vy + gravity * dt * dt;
  }
  for (let it = 0; it < 4; it++) for (let i = 1; i < p.length; i++) {
    const a = p[i - 1], b = p[i], dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1, k = (d - seg) / d;
    if (i === 1) { b.x -= dx * k; b.y -= dy * k; }                     // the anchor doesn't move
    else { a.x += dx * k / 2; a.y += dy * k / 2; b.x -= dx * k / 2; b.y -= dy * k / 2; }
  }
}
```

- Draw each link with `line()`, fading the alpha toward the tip. Use a brighter role for the first links.
- Forces: a current is a sideways push that varies with `t` (whole cycles per loop). The cursor is a push that falls off with distance.
- **Looping:** the chain's state is history, not a function of `t`. Drive the anchor and the forces from `t`, and run `update()` for two whole loops before the first frame, so the swing settles into a repeat. Then check the seam with `render.mjs`, which prints it. If the seam is still visible, raise the drag or the number of warm-up loops.

## Ripples and shockwaves

```js
const age = ft - w.t, R = age * w.speed, a = w.s * (1 - age / w.life), band = CH * 1.5;
// over the ring's bounding box:
const d = Math.abs(Math.hypot(dx, dy) - R);
if (d < band) cell(c, r, dirGlyph(-dy, dx), 4, a * (1 - d / band), 0.3 * a * (1 - d / band));
```

- Give the band a little tile alpha so it reads as light over other layers, not as a gap.
- A ripple can push other geometry: add `k · exp(−((rn − age·v) / w)²)` to a radius, for example the radii of an iris's rings.
- On release after a hold, scale the strength, speed and life by the charge, and add a damped spring overshoot to whatever was tightened.

## Warps

Warps are post effects on the cell buffer: copy it, then resample.

```js
// spiral around (kx, ky): the angle falls off with distance; pull > 0 sucks in, < 0 pushes out
for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
  const dx = c * CW + CW / 2 - kx, dy = r * CH + CH / 2 - ky, f = Math.exp(-((dx * dx + dy * dy) / (rad * rad)));
  const a = twist * f, sc = 1 + pull * f, sx = kx + (dx * Math.cos(a) - dy * Math.sin(a)) * sc, sy = ky + (dx * Math.sin(a) + dy * Math.cos(a)) * sc;
  copyCell(Math.floor(sx / CW), Math.floor(sy / CH), c, r); // from the copy into the live buffer
}
```

## Impact frames and shake

- Keep a list on the timeline: `{ t, kind: 'white' | 'red' | 'black', dur: 0.05–0.15, shake: px }`.
- During an impact, render every role in one colour on a second colour, and draw tiles as solid. One or two frames is enough.
- Shake: `shake = max(shake, px·s)`. Each frame, offset the render by a random `±shake` and decay it with `exp(−6·dt)`.
- Pair every impact with a sound cue if the piece has sound.

## An eye

Eyes are a strong ASCII subject.
- **Lids:** two curves over `ux = x / EW`. Use `f = 1 − ux²`, an upper lid at `−EH·open·f^0.8` and a lower lid at `EH·open·0.78·f^1.1`. Give the lid line `#`, lashes in direction glyphs that sweep outward, and a faint crease above.
- **Opening and blinking:** use an `open` curve on the timeline. A blink is about 0.18 s.
- **Iris:** a disc with a limbal ring in direction glyphs, fibres from hashed angle buckets, and a pupil.
- **The white:** shaded rounder toward the middle, and darker under the upper lid.
- **Catch-light:** one bright tile that stays fixed to the light while the iris moves.
- **Gaze:** see `interaction.md`. The lids should follow the gaze. When the eye turns, foreshorten the iris along the gaze, and shift its centre toward the gaze more than its rim (a corneal dome). This sells 3D on a flat grid.

## Image or logo to ASCII

```js
function imageField(img, cols, rows, W, H, { gamma = 1.4, invert = false } = {}) {
  const small = document.createElement('canvas'); small.width = cols; small.height = rows;
  const g = small.getContext('2d', { willReadFrequently: true });
  const k = Math.max(W / img.naturalWidth, H / img.naturalHeight), dw = img.naturalWidth * k, dh = img.naturalHeight * k;
  g.drawImage(img, (W - dw) / 2 / CW, (H - dh) / 2 / CH, dw / CW, dh / CH); // cover, centred
  const d = g.getImageData(0, 0, cols, rows).data, n = cols * rows, lum = new Float32Array(n);
  for (let i = 0; i < n; i++) lum[i] = (0.2126 * d[i * 4] + 0.7152 * d[i * 4 + 1] + 0.0722 * d[i * 4 + 2]) / 255;
  const sorted = lum.slice().sort(), lo = sorted[Math.floor(n * 0.05)], hi = sorted[Math.floor(n * 0.98)];
  for (let i = 0; i < n; i++) { let v = clamp((lum[i] - lo) / ((hi - lo) || 1), 0, 1); if (invert) v = 1 - v; lum[i] = v ** gamma; }
  return lum; // 0..1 per cell; map through the ramp
}
```

- **Percentiles, not min and max:** a few blown-out pixels would otherwise flatten everything else.
- **Logos:** use the alpha channel as coverage, `d[i*4+3] / 255`, not luminance. Draw the logo larger than one cell per pixel when its strokes are thin.
- **Edges make it look drawn:** run a Sobel pass over `lum`. Where the gradient magnitude passes a threshold, draw `dirGlyph(-gy, gx)`; the edge runs perpendicular to the gradient.
- **Reading pixels needs a clean canvas.** Use a same-origin image, or `img.crossOrigin = 'anonymous'` plus CORS headers. A `file://` page can't read its own images, so serve it over http.
- Rebuild the field in `resize()` and after `img.decode()`. Animate it with a travelling light (multiply by a moving sine band) or a cursor wake (a decaying per-cell excitation array).

## Text to ASCII

```js
// rasterise once, then average coverage per cell
const off = document.createElement('canvas'); off.width = cols * CW; off.height = rows * CH;
const g = off.getContext('2d', { willReadFrequently: true });
g.font = `700 ${size}px ${family}`; g.fillStyle = '#fff'; g.textBaseline = 'alphabetic';
g.fillText(text, x, y);
const d = g.getImageData(0, 0, off.width, off.height).data;
for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
  let a = 0;
  for (let y = 0; y < CH; y++) for (let x = 0; x < CW; x++) a += d[((r * CH + y) * off.width + c * CW + x) * 4 + 3];
  a /= CW * CH * 255;
  if (a > 0.08) cell(c, r, RAMP[Math.min(9, Math.round(a * 8 + 1.5))], 2, 0.62 + 0.38 * a);
}
```

- Use a bold weight at 60 px or more. Thin strokes fall between cells and vanish.
- For text already on the page, walk its text nodes word by word, measure each word with a `Range`'s `getBoundingClientRect()`, and draw it at that position. Wrapped lines then land exactly where the DOM put them. Copy the font, weight, size and letter-spacing from `getComputedStyle`.
- Banners for plain text can use a finer grid. Export them with `window.ascii.text()`.

## Reading CSS colours

`getComputedStyle` may return `oklch()`, `color-mix()` or other modern syntax. Don't parse it; let the canvas convert it:

```js
function cssRGB(value) {
  const c = document.createElement('canvas'); c.width = c.height = 1;
  const g = c.getContext('2d', { willReadFrequently: true });
  g.fillStyle = '#000'; g.fillStyle = value; g.fillRect(0, 0, 1, 1); // an invalid value keeps the previous colour
  return [...g.getImageData(0, 0, 1, 1).data.slice(0, 3)];
}
```
