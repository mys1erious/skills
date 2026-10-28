# Engine reference

`engine.js` is plain JavaScript loaded before the page's script. It defines globals; a page that redeclares one with `const` or `let` fails to start.

## Globals (never redeclare)

`out octx W H FPS TAU mk scene ctx glc gl THEME TL SCENE FONT clamp lerp easeInOutCubic easeOutQuint easeOutCubic easeInCubic smooth spring kick rng at camPath CAM w2s GRAIN VIG buildStatic rr setFont caption tabular slam stamp rise label glow shake flash layer LA LB scenes drawSubs start`, plus `seek`, `ready`, `DURATION`, `TITLE`, `BEATS`, `SFX`, `MUSIC`, `MARKS`, `GPU` on `window`.

You may assign to `CAM`, `ctx` (swap it to draw offscreen, then restore it) and `FONT`, and you may change `THEME`'s fields.

## start(options)

| Option | Meaning |
|---|---|
| `init(tl)` | Required. Runs once after fonts, timeline and `load`. Returns the result below. |
| `draw(t)` | Required. Paints the whole frame onto `ctx` for time `t` (seconds). Called twice per frame for motion blur, at t ± 0.005 s. |
| `load()` | Async. Fetch data the page needs before `init` (JSON, images). |
| `post(t)` | Draws onto `octx` once per frame after the blur, e.g. a HUD that must stay sharp. |
| `fonts` | `[[family, url, weight]]`, e.g. `[['Inter Tight', 'fonts/InterTight.ttf', '100 900']]`. The first becomes `FONT`. |
| `timeline` | URL of the timeline, default `out/timeline.json`. |
| `vignette` | `false` to turn off the dark vignette. |
| `grain` | Film-grain strength, default `0.06`; `0` turns it off. |
| `blur` | `false` to turn off motion blur (pixel art, crisp UI). |

`init` returns:

| Field | Meaning |
|---|---|
| `duration` | Video length in seconds. Usually the end card's time + 2.5. |
| `title` | When the end card lands. The `pad` music resolves there and swells. |
| `beats` | `[[name, time]]`: the moments the contact sheet shows. Put one just after each cue lands. |
| `sfx` | `[[kind, time]]`: sound cues, snapped to frames. Kinds are below. |
| `music` | `'pad'` (default), `'trailer'` or `'beat'`. |
| `marks` | For `beat`: `{start, drop, back, end}` times. The beat comes in at `start`, only a heartbeat kick plays from `drop` to `back`, and it stops at `end`. |

## The timeline (`TL`, the `tl` argument)

```js
{ duration, triggers: {'0:thousand': 2.55, ...},
  sentences: [{ i, text, start, end, words: [['picture', 0.31], ['all', 0.62], ...] }] }
```

- `at('1:twenty')` gives a cue's time, and throws a clear error if the cue doesn't exist.
- `tl.sentences.at(-1).end` is when the voice stops; the end card usually lands 0.35 s later.
- For a moment between cues, use a word's time from `sentences[i].words`, or a sentence's `start` and `end`.

## Helpers

| Helper | Use |
|---|---|
| `clamp(x, a=0, b=1)`, `lerp(a, b, p)`, `smooth(a, b, x)` | Basics. `smooth` is smoothstep from a to b. |
| `easeInOutCubic`, `easeOutQuint`, `easeOutCubic`, `easeInCubic` | Easing for p in 0–1. |
| `spring(dt, zeta=.45, w=14)` | 0 → 1 with overshoot, `dt` seconds after a cue. Things pop in and settle. 0 before the cue. |
| `kick(dt, zeta=.42, w=14)` | An impulse 0 → ±1 → 0, for squash and stretch, shakes and hits. |
| `rng(seed)` | A function returning seeded random numbers in [0, 1). Make one per use in `init`, or reseed per frame from `t`. |
| `camPath(t, init, moves)` | Camera: `moves = [[t0, dur, {x, y, z}], …]` eased in order; zoom eases in log space; adds a slow drift. Set `CAM = camPath(…)` in `draw`, then map world points with `w2s(p)`. |
| `mk(w, h)` | An offscreen canvas, for layers built once and drawn with `ctx.drawImage`. |
| `rr(x, y, w, h, r, fill)` | A filled rounded rectangle. |
| `setFont(weight, size, letterSpacing=0, family=FONT)` | Sets `ctx.font` and `ctx.letterSpacing`. |
| `caption(t, lines, x, y, tIn, tOut, o)` | A pill of lines `{text, size, color, weight, sp}` centred at (x, y). It springs in at `tIn`, each line rises through a clip, and it leaves at `tOut`. `o.align`: `'center'` (default), `'left'` or `'right'`, with x as that edge. `o.fill` sets the pill colour (`'rgba(0,0,0,0)'` for none); also `padX`, `padY`, `gap`, `minW`, `scale`. |
| `tabular(text, x, y, align='left')` | Draws text with every digit in an equal-width cell, so a changing counter doesn't jitter. Set the font first. |
| `stamp(t, t0, str, x, y, size, o)` | Kinetic type: a word slams in at `t0`, centred on (x, y), overshooting from 1.5× and settling, and shrinks away at `o.out`. `o`: `out`, `weight`, `color`, `box` (fill behind it), `pad`, `r`, `rot`, `amt`, `sp`, `family`. `slam(t, t0, amt)` is its scale, for anything else. |
| `rise(t, t0, str, x, y, size, o)` | A line rising into place through a clip at `t0` (y is the baseline), dropping out at `o.out`. `o`: `align`, `weight`, `color`, `dur`, `out`, `sp`, `family`. Returns the width. |
| `label(t, t0, text, x, y, tx, ty, o)` | A callout: a dot pops on the target (tx, ty), a leader line draws out to (x, y), then the text springs in on a pill. `o`: `size` (30), `color`, `fill`, `line`, `align` (`'left'`: text to the right of x; `'right'`: to its left), `out`. |
| `glow(x, y, r, color, a=1)` | A soft additive glow from a cached sprite. Use it instead of `shadowBlur`, which is slow. |
| `shake(t, t0, amp=16)` | `{x, y}` to translate by after a hit at `t0`; it decays in about 0.4 s. |
| `flash(t, t0, dur=.25, color)` | An impact frame: the whole frame flashes at `t0` and fades. |
| `scenes(t, shots, o)` | Shots and transitions. `shots = [{t0, draw(t), tr, focus(t), focusIn(t)}]`; `tr` is `'in'` (zoom into `focus`, the next shot opens through a circle), `'out'` (shrink into a closing circle, revealing the next), `'whip'` or `'cut'`. `o.dur` is half the transition (0.28 s), `o.ring` the circle's edge colour (`null` for none). Each shot paints the whole frame. See `motion.md`. |
| (camera in shots) | `focus` and `focusIn` are called outside the shot's `draw`. If a shot moves the camera, put the camera in a function of `t` (`const cam2 = t => camPath(t, …)`), set `CAM = cam2(t)` in both the shot's `draw` and its `focus` before calling `w2s`. |
| `layer(cv, fn)` | Runs `fn` with `ctx` pointing at the offscreen canvas `cv` (cleared first), for your own compositing. `LA` and `LB` are the two used by `scenes`. |
| `drawSubs(t, y, o)` | Word-by-word subtitles of the sentence being spoken, centred at `y`. `o`: `size` (46), `maxW`, `maxLines` (2: a longer sentence shows a page at a time), `upper` (true), `fill` (`null` for no pill), `now`, `past`, `next` colours. Defaults come from `THEME`. |

Write your own versions when the look needs it (a typewriter caption, subtitles on a paper strip); these are starting points, not a style.

## Sound kinds (`sfx`)

Each sound is placed so its peak lands on the cue time; `riser` and `collapse` end on it. Levels are set relative to the voice.

| Kind | Sound | Typical use |
|---|---|---|
| `thump`, `swish`, `snip` | Tiny thud, swish, snip | Many small events: dots landing, items appearing. One per 1/12 s at most. |
| `click`, `tick` | UI click, short high tick | A counter step, a toggle, a highlight. |
| `pin` | Bright two-tone ping | A number or label landing. |
| `photon` | Sparkling chime | Something lights up or appears. |
| `whoosh`, `dive` | Air whoosh; a higher, later dive | Camera moves, transitions, zooming in. |
| `impact` | Deep boom | A big event. |
| `riser` + `hit` | A build-up, then a rising noise into a sub hit | The climax: put both on the same time. |
| `collapse` | Falling pitch | Something drops or shrinks. |
| `braam` | Cinematic brass | A dramatic reveal (fits `trailer` music). |
| `frost` | Crackling shimmer | Ice, glitter, a texture spreading. |
| `rewind` | Tape-rewind warble | Going back in time. |
| `reveal` | Major-chord swell | The end card. |

## WebGL

`gl` is a WebGL 1 context on the offscreen canvas `glc` (W×H, premultiplied alpha). Compile your program in `init`, draw with it in `draw`, then `ctx.drawImage(glc, 0, 0)`. Clear it each frame (`gl.clearColor(0,0,0,0); gl.clear(gl.COLOR_BUFFER_BIT)`). Use it for globes and spheres from an equirectangular texture, large shaded fields and many particles; plain canvas 2D is enough for most charts and maps.

Data textures (values, not colours) need these settings, or the values shift and edges blur:
- Before `texImage2D`, call `gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.NONE)` and `gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false)`.
- A one-channel field uploads as `gl.LUMINANCE`; set `gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1)` when its width isn't a multiple of 4.
- WebGL 1 textures whose sides aren't powers of two need `CLAMP_TO_EDGE` on both axes and no mipmaps (`LINEAR` or `NEAREST` filtering).
- For crisp, anti-aliased edges where a field crosses a threshold (an ice edge, a contour), enable `OES_standard_derivatives` and use `smoothstep(th - fwidth(v), th + fwidth(v), v)` in the shader.

An orthographic globe needs only this projection for its overlay points:

```js
// lon/lat (degrees) -> unit sphere seen from (lon0, lat0): x right, y up, z toward the viewer (z < 0: far side)
function ortho(lon, lat, lon0, lat0) {
  const d = Math.PI / 180, cl = Math.cos(lat * d), sl = Math.sin(lat * d), dl = (lon - lon0) * d, c0 = Math.cos(lat0 * d), s0 = Math.sin(lat0 * d);
  return { x: cl * Math.sin(dl), y: c0 * sl - s0 * cl * Math.cos(dl), z: s0 * sl + c0 * cl * Math.cos(dl) };
}
```

## Performance

A 35 s video is 1,050 frames, and `draw` runs twice per frame. Aim for under 300 ms per frame in total, including the screenshot.
- Build static layers once in `init`: backgrounds, textures, hatching, labels that never change, shaded relief.
- Gradients over the whole frame, `shadowBlur`, `filter` and `getImageData` are the slow calls. Cache them.
- Thousands of points draw fast as small `fillRect`s or a single path; arcs and per-point gradients are slower.
- Skip what is off screen or fully transparent.
