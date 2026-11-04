---
name: take-apart
description: Build a real object at real scale in three.js from sourced numbers, then take it apart piece by piece on a self-playing timeline. Each chapter explodes one subsystem, with labels on leader lines, technical-drawing dimension lines and a scale bar. Tap any part for a card on what it does, with source links. A list chapter can light up what still works, or trace a signal through the parts, before it all goes back together. One self-contained HTML page that works on a phone and records to video. Use when asked for a teardown, an exploded view, "take X apart", "what's inside X", "how X works inside", a labelled 3D breakdown of a spacecraft, vehicle, machine, instrument, device or historical artefact, or a remix of the "Voyager 1, taken apart" build.
license: MIT
compatibility: Runs in any modern browser with WebGL. Loads three.js from jsDelivr. The check and render scripts need Node 22+ and Chrome, Chromium or Edge. MP4 export needs ffmpeg.
metadata:
  author: mys1erious
  version: "1.0.0"
---

# Take apart

One object, one page, 30-45 s of timeline that plays on its own. The visitor can pause, scrub, step with ‹ ›,
drag to turn, scroll to zoom and tap any part. Every number on the page comes from a source listed in `SRC`.
Anything drawn rather than measured is labelled on the part's card and in the README.

`SKILL_DIR` below is the folder this file lives in.

- Live example: https://mys1erious.github.io/3d-voyager-teardown/ (Voyager 1, 3.7 m dish, 13 m boom).
  The same engine has also built a 34 cm Enigma I that traces one key press through its rotors.
- `assets/template/`: `index.html` (Voyager 1, about 940 lines, three.js 0.170.0 from jsdelivr via an importmap,
  procedural textures, no image files, no build step) and `README.md` (follow its "Every number, with its source"
  table and its "Approximations" list).
- `scripts/`: `shoot.mjs` (screenshots at `?t=` moments, optional contact sheet), `render.mjs` (frame-exact video) and
  `cdp.mjs`, which drives headless Chrome with no npm packages. They need Node 22+, Chrome or Chromium (set
  `CHROME=` to pick one), and ffmpeg for the video.
- Different from a running-machine simulator with live gauges. This is a sourced exploded view: what each part is,
  what it does, and (if it applies) what it does now.

## Start

1. **Research first.** Collect every dimension, mass and date with a URL, primary sources first (the maker, the
   agency, the museum record, the patent).
   - When sources disagree, pick one and say which on the card (`n`) and in the README.
   - When no primary source gives a number (museum records rarely list weight), use the best secondary source and
     say so on the card.
2. **Copy `$SKILL_DIR/assets/template/`** and serve it with `python3 -m http.server`. Open `?t=23` to see a frozen moment.
3. **Replace the data blocks** (table below), then the model section. Keep the engine: the explode, camera, labels,
   dimensions, card, scale bar and frame loop.

| Block | What it holds | Change |
|---|---|---|
| `SRC` | `key: [title, url]` | Your sources. Every card cites keys from here. |
| `CARDS` | per part: `k` kicker, `h` name, `s` one-line size, `d` what it does, `t` what it does today, `st` `'on'` or `'off'`, `off` a status note, `src` keys, `n` what is illustrative, `power: true` to show the gauge on this card | Only sourced statements. Leave out `t`, `st` and `off` when the object has no "today". |
| `STATUS` | rows for the list chapter: `[code, name, value, highlighted?]` | Any ordered list: what still works, the steps of a signal path, a sequence. |
| `CH` | chapters: `id`, `t` start (s), `k`, `h` (HTML, `<b>` for gold), `s`, `labels` (CARDS ids), `dims` (DIMS keys), `gauge`, `list` | One chapter per subsystem, 3.5-4.5 s each. Keep `hero` first and `home` last. |
| `END` | timeline length, s | Also set `max` on `#scrub` in the HTML. |
| `FIT_PORTRAIT` | fit radius factor in portrait, `[phone, other]` | Below 1 zooms in, which suits tall objects like Voyager. Use about `[1.02, 1.0]` for wide ones, or the hero gets clipped on phones. |
| `CAM0` | camera keys `[t, target x, y, z, fit radius m, azimuth°, elevation°]` | Two keys per chapter (arrive, then a slow drift). The fit radius sets the distance from the field of view, so framing holds at any aspect ratio. |
| the model section (`// the model, in metres`) | geometry | Build in metres (described below). |
| `DIMS` | dimension lines between two 3D points, with text | The headline numbers, one or two per chapter. |
| `window.__dims` | drawn lengths, printed for a self-check | Compare them against the sources. For a mechanism, also check its logic, for example a cipher's known test vector. |

**The model section:**
- `part(id)` registers a part.
- `piece(p, obj, chapterId, offset, endQuat)` adds a mesh that moves by `offset` (m) during that chapter.
- For a later second move, add `obj.userData.more = [[CHI.<chapter>, V(dx, dy, dz)]]`.
- A rotation tied to the timeline is set directly in `frame()`.
- Each part needs an `anchor` (a function returning the label point).
- Thin parts get a `proxy()` so they are easy to tap.

**Voyager-only things in the engine to change or delete:**
- **Chapter `today`:** the `'mag' / 'pws'` glow (`frame()`, two places), `CHI.today` (the dimming), and the label's
  "ON" text. To use it for something else (a signal path, say), keep the dim-and-glow and change which part ids glow.
- **The gauge:** `gaugeHTML` (≈470 W → 225 W, widths `47.9` / `52.1`, the 1977/2023 labels; widen the label column
  for longer labels), and the `RTGs` row appended to `#today`.
- **The card:** its "Today" heading and the WORKING / OFF pills, if the object has no today.
- **The scene:** the starfield (`sky`, its line in `frame()`), the environment colours, `scene.background`.
- **Text:** the "Dimensions: NASA / JPL" footer, the `hint` text, `<title>` and the meta description.

## Chapter recipe

| Chapter | Length | Job |
|---|---|---|
| `hero` | 0-3.5 s | The whole object, lit, filling the frame, title on screen in the first second: "<Object>, **taken apart**". This frame opens the video. |
| one per subsystem | 3.5-4.5 s each | Its pieces explode outward (start at +0.35 s, 1.6 s ease). Show 1-4 labels; with more, phones switch to numbered chips plus a legend. Add one dimension line for the headline number. |
| `gauge` (optional) | inside a chapter | A then-vs-now or a size-of-number bar. |
| list chapter (optional) | about 5 s | The object dims, the parts in question glow, and a list builds row by row beside it. Uses: what still works (Voyager); one real input traced through the machine, such as a key press through rotors and reflector to a lamp (Enigma). This is the chapter people remember. |
| `home` | about 4 s | Everything flies back together. One closing line. |

URL flags: `?t=<s>` freezes a moment, `?play` self-plays from 0 (for the recorder), and `?clean` hides the controls.

## Check before you show it

- **Screenshots:** take one per chapter, at desktop, phone and the video size. Read the contact sheets:
  ```
  node $SKILL_DIR/scripts/shoot.mjs "http://127.0.0.1:8000/" shots/desk --size 1280x800 --times 2,6,10,14,18,23,27,31,35,40 --sheet
  node $SKILL_DIR/scripts/shoot.mjs "http://127.0.0.1:8000/" shots/phone --size 390x844 --scale 2 --times 2,14,35 --sheet
  node $SKILL_DIR/scripts/shoot.mjs "http://127.0.0.1:8000/?clean" shots/video --size 1080x1350 --times 2,14,35 --sheet
  ```
  `shoot.mjs` prints page errors and exits 1 if there are any.
- **What earlier reviews found:**
  - The object must fill the frame. Small subjects in wide chapters read as empty, so raise the fit radius or move
    the target.
  - White or very bright parts blow out under bloom. Lower the material's colour or emissive, or the bloom strength.
  - Labels go left or right of their anchor only. When one flips onto the object or clips at the top bar or bottom
    panel, shorten its text or move its anchor.
  - When the camera looks down from the front, parts at the back sit behind the title; darken the top gradient or
    raise the elevation.
- **Tap test:** click one part at desktop size and one at phone size; the card must open with its source links.
- **Console:** no errors. `window.__dims` must match the sources.
- **Dates near midnight:** give the timezone (UTC) when a date is close to midnight, so the page matches any related post.

## Working with the user

- **View first, no video yet.** Serve or deploy the view and give the user a table of `?t=` links, one per chapter,
  with what to judge at each.
- **If nobody can answer while you work,** finish the view in one go, note your decisions, and end with that table.
- **Record only after the user says the view is final:**
  ```
  node $SKILL_DIR/scripts/render.mjs "http://127.0.0.1:8000/?clean&play" frames --seconds <END> --fps 30 --size 1080x1350 --mp4 video/<slug>.mp4
  ```
- **The README covers:**
  - what it is and how to open it;
  - the flags;
  - "Every number, with its source" as a table;
  - "Approximations (drawn, not measured)".

## Honesty

- Cards hold only sourced statements; a placement you guessed is said in `n`.
- No invented telemetry or live data. "Today" facts carry a date and a source.
- A traced signal or worked example uses real, sourced settings (for example a recovered historical key), and the
  code checks itself against a published test vector.
- If someone else's post inspired the format, credit them as "inspired by @handle". Don't copy their code.
