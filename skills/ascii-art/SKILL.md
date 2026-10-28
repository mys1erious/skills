---
name: ascii-art
description: Build ASCII art that looks designed rather than generated. Covers animated and interactive ASCII scenes on a canvas, images, logos and text turned into ASCII, ASCII hero sections, backgrounds and login pages, plain-text ASCII art, and loopable ASCII videos for X and other feeds. Use when the user asks for ASCII art or animation, a text-mode, glyph, terminal or CRT look, an ASCII effect, shader, background, logo, banner or portrait, image-to-ASCII, or an ASCII piece to post, in any web stack.
license: MIT
compatibility: Runs in any modern browser. The test and render scripts need Node 22+ and Chrome, Chromium or Edge. MP4 export needs ffmpeg.
metadata:
  author: mys1erious
  version: "1.0.0"
---

# ASCII art

An ASCII piece is a grid of monospace cells. Each cell holds one glyph, and can also hold a filled tile behind the glyph. Each cell has a colour and an alpha. From a distance the grid reads as an image; up close it reads as type. Good pieces work at both distances.

This skill builds a piece as one self-contained HTML file drawn on a canvas. It then checks the piece in headless Chrome and exports stills, video or plain text. `<skill>` below means the folder this file is in.

| File | What it is |
|---|---|
| `assets/starter.html` | A working piece to copy. It includes the engine, styles, timeline, interaction, recording and text export. |
| `scripts/shoot.mjs` | Takes headless screenshots at timeline moments, runs scripted mouse and key actions, and builds a contact sheet. Reports page errors. |
| `scripts/render.mjs` | Renders frame by frame on a virtual clock, then encodes MP4 with ffmpeg. |
| `references/rendering.md` | The engine: grid, batching, tiles and glyphs, ramps, colour roles, performance, mounting in frameworks and behind UI. |
| `references/recipes.md` | Effects and sources: shading, noise, fire, lightning, rain, flocks, ripples, warps, impact frames, image, logo and text to ASCII. |
| `references/interaction.md` | Follow and gaze, hold and release, gestures, scroll, dwell, idle autopilot, touch. |
| `references/video.md` | Recording, deterministic rendering, sound, sizes for X, hooks and loops. |

Read a reference when the piece needs what it covers, not up front.

## 1. Pin down the brief

Ask only for what the request leaves open and what would change the build:

- **Subject:** one subject. A scene with five things in it reads as noise at ASCII resolution.
- **Where it lives:**
  - a standalone page;
  - a background behind real UI, such as a hero or a login page;
  - a sandboxed embed (downloads are blocked there);
  - a video for a feed;
  - plain text for a README, terminal or comment.

  "A page people can play with, plus a video to post" is the most common ask. One file serves both: build the page, then choose the video's shape separately (4:5 for X).
- **Interaction:** pages almost always should react to the mouse. Videos are scripted.
- **Time:** a scripted loop of 6–20 s, or endless.
- **Looks:** one style by default. When the user is exploring, build 3–4 style presets on one simulation so they can compare.

For anything bigger than a small effect, state the plan in a few lines and get a yes before building.

## 2. Choose where the picture comes from

- **Procedural:** compute every cell from geometry, noise, particles or a simulation. Most pieces are this. See `recipes.md`.
- **Image or logo:** sample the image's luminance (or a logo's alpha) into the grid, normalised by percentiles. See `recipes.md`, "Image or logo to ASCII".
- **Text:** rasterise the text and sample its coverage per cell. See `recipes.md`, "Text to ASCII".
- **Hybrid:** use an image field as the ground and draw procedural effects on top.

For plain-text output, still build on the grid. Then export the frame with `window.ascii.text()`, or the action `text <name>` in `shoot.mjs`.

## 3. Start from the starter

Copy `assets/starter.html` into the project, for example as `<piece>/index.html`. Open it and read it whole once; it is about 300 lines.

**Keep:**
- the cell buffer and the renderer;
- the fixed-step loop;
- the resize guards;
- the URL parameters and keys (section 6).

**Replace:**
- the config block: `TITLE`, `LOOP`, `STYLES`, `RAMP`, `WEIGHT`;
- `BEATS`, `update()` and `scene()`;
- the help line, `aria-label` and `<title>`.

Keep it one file with no dependencies, unless the project has a build. In a framework, mount the same code on a canvas inside a component; `rendering.md` shows how.

## 4. Compose for ASCII

This step decides whether the result looks designed or generated.

1. **One subject, big.** A desktop frame is about 180×75 cells. A subject needs 30–40 cells across to read, so give it 40–60% of the short side.
2. **Values before glyphs.** Decide where the frame is bright and where it is dark, and leave large calm areas. Noise spread evenly over the whole frame is the most common failure.
3. **Three kinds of mark:**
   - tiles (filled cells at low alpha) for mass and colour;
   - glyphs from a ramp (` .:-=+*#%@`) for tone and texture;
   - direction glyphs (`- \ | /`) laid along edges, rings and motion.

   Contours made of direction glyphs are what make ASCII look drawn rather than filtered.
4. **Colour by role, not per cell.** Use one background and 3–4 roles: dim, ink, accent, hot. Keep hot rare, because it is where the eye goes.
5. **Give the subject full range.** Somewhere it must reach the hot role at full alpha, and the ground stays dark. A piece that stays dim reads as mud on a phone and after a feed's compression.
6. **Work in pixel space.** Cells are about 1.5× taller than wide. Compute geometry in px from cell centres and circles stay round.
7. **Grid size:**
   - About 8×12 px cells with a 10 px font is the default.
   - Go finer (7×10) for detail such as eyes, faces or portraits.
   - Go coarser and bolder for posters.
   - On phones go finer again, or let the subject run off the edges.
8. **Motion:**
   - Ease everything and hold key poses.
   - Build anticipation, then release.
   - Give each loop one hero moment.
   - Sell a hit with an impact frame (1–3 frames in two colours) and a few px of shake that decays.
   - Make the loop's ends meet (section 6).
9. **Fewer effects.** A single subject with one or two effects beats a pile of effects. When unsure, remove one.
10. **On a light ground, invert the mapping.** Glyph density reads as darkness on paper, so ink means shadow there.

## 5. Interaction (pages)

- **Moving the mouse must visibly change something within a second.** It can make the subject follow or look at the cursor, light it, tilt it, part it or reveal it. People test by moving the mouse first; a piece that only reacts to clicks feels dead.
- **Add one deliberate action.** Hold and release (charge, then a burst) feels best. Use a click for a small local impact, and scroll for zoom or warp.
- **Never let a plain click change the whole scene.** It makes everything else impossible to try. Put navigation on keys.
- **Run an autopilot when idle.** A few seconds after the last move, go back to scripted motion.
- **Make actions discoverable** with one quiet help line, hidden by `?clean`.
- **Use pointer events** so touch works too. Give gestures real thresholds (`interaction.md`).

## 6. Conventions every piece keeps

The scripts and anyone filming the piece rely on these. The starter has all of them.

| Param or key | Effect |
|---|---|
| `?t=4.5` | Freeze at that timeline moment, for stills. Add `&play` to keep running. |
| `?clean` | No labels or help text, for video and stills |
| `?style=N`, keys `1`–`N` | Style preset |
| `?seed=N` | Random seed |
| `Space` | Pause |
| `H`, `?hold` | Freeze the timeline while input and effects keep running. Use `?t=3&hold` to play with or test one moment. |
| `R` | Record one loop to MP4, from t = 0 |
| `T`, `window.ascii.text()` | The current frame as plain text |

Keep it deterministic:
- use the seeded RNG;
- use a fixed 1/60 s step;
- derive every scripted motion from the timeline clock `t`;
- use `ft` (a clock that never wraps) only for the lifetimes of effects started by input.

`Math.random` is fine for sparkle in reactions to input. It is not fine in anything a still or a video has to reproduce.

**Make the loop seamless.** Everything visible must come back to where it started at `t = LOOP`. That means a whole number of cycles per loop: `sin(t / LOOP * TAU * k)` with an integer `k`. Noise drifts on a circle (`cos` and `sin` of `t / LOOP * TAU`), and rotations make whole turns. A fade to black hides a broken loop but makes the piece blink, so fix the loop instead. Simulated motion (ropes, tentacles, hair, flocks) can't be a pure function of `t`. Drive its anchors from `t`, run the simulation through two loops before the first frame so it settles into a repeating swing, then check the seam (step 7).

## 7. Verify by looking

```sh
node <skill>/scripts/shoot.mjs "<url>?clean" out/stills --times 1,3,5,8 --sheet
node <skill>/scripts/shoot.mjs "<url>?t=3&hold" out/act --sheet \
  --actions "glide 30%,40% 400; wait 400; shot moved; down; wait 900; up; wait 300; shot released"
node <skill>/scripts/shoot.mjs "<url>?clean" out/phone --size 390x844 --times 3
```

A single-file page works as a `file://` URL. Serve the folder over http when the page loads other files.

Then open `sheet.png` and look at it. Don't stop at "no errors". Check that:
- the subject reads;
- the frame is neither empty nor full;
- gradients don't band;
- the mouse visibly changes the picture;
- each scripted beat lands at its moment;
- the subject reaches full brightness somewhere;
- the phone frame works.

For a loop, render one whole loop with `render.mjs --mp4`. It prints how the last frame compares with the first; a seam well below the neighbouring frames shows as a jump.

The script exits 1 and lists page errors if any occurred. Fix what you see, shoot again, and stop when the piece holds up. A browser showing an old version after an edit has a cached copy, because simple static servers send no cache headers: hard-refresh it.

## 8. Export

- **Stills:** `shoot.mjs --times … --scale 2`.
- **Video:** `render.mjs` renders perfect frames to MP4 with no sound. In-page `R` records in real time and can include sound. `video.md` has the sizes for X.
- **Plain text:** the `text <name>` action in `shoot.mjs`, or `T` in the page.
- **Sandboxed embeds** such as claude.ai artifacts and many CMS iframes block downloads a page starts, so remove `record()` and the `R` key there.

## Pitfalls and their fixes

- **The canvas is 0×0 in a hidden tab or iframe, and the loop dies.** Call `requestAnimationFrame` first in the frame callback, return early while there's no size, and resize from a `ResizeObserver`. The starter does all three.
- **The word "undefined" appears in the art.** A ramp index went out of range, often after a NaN from a Float32 vs Float64 comparison. Clamp the index.
- **Image fields look flat.** Normalise luminance by percentiles (p5–p98), not min and max.
- **CSS colours such as `oklch()` render wrong when parsed by hand.** Let a 1×1 canvas convert them: set `fillStyle`, `fillRect`, then `getImageData`.
- **Thin letterforms vanish in text-to-ASCII.** Rasterise bold, at 60 px or more.
- **Headless screenshots come out black.** They were taken in parallel. Take them one after another, as `shoot.mjs` does.
- **Quick flicks fire swipe gestures.** Require a minimum number of points, distance and speed, and cancel the swipe on `pointerdown`.
- **Smooth gradients show seams.** Use 20 or more alpha levels per colour, plus one level of dither.
- **Fire, smoke or crowds bury the subject.** Leave gaps or bands in them, and draw the subject last.
- **Sound starts unexpectedly.** Keep sound off by default and start the AudioContext from a user gesture.
- **A faint glow shows as a lighter rectangle.** Tiles below about 0.1 alpha show their cell edges where the area ends. Use sparse glyphs (`.` `:` by hashed chance) for faint washes, and keep tiles for mass.
- **A hard edge appears where the colour role switches at a threshold.** Pick the role by hashed chance across a band, e.g. `hash2(c, r) % 100 < 100 * smooth(a, b, v)`.
- **A faint layer erases what's under it.** `cell()` replaces. Draw see-through layers and glows with `over()`, which only writes where it is brighter.
- **Small rings look hexagonal.** Four direction glyphs can't draw a small circle. Below about 8 cells of radius, use `( ) _ - '` by angle, or draw the ring as tiles.
- **A loop jumps at the seam.** Something runs on `ft` or a non-whole number of cycles. See "Make the loop seamless".
