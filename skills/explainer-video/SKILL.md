---
name: explainer-video
description: Make short narrated explainer videos drawn in code, where the picture shows what the voice teaches, usually with real data on screen. Covers the script, an AI voice with word timings, a canvas or WebGL page where every frame is a function of time, frame-exact rendering to MP4 in headless Chrome, a synthesized music and sound-effect mix, and building the same video in several visual styles from generated target frames. Use when the user asks for an explainer, science, data or "what if" video, a TikTok, Reels, Shorts or YouTube video that teaches something, an animated infographic or data story with narration, or one script rendered in several styles to compare.
license: MIT
compatibility: Needs Python 3.10+ with uv (or pip), ffmpeg, and Google Chrome or Playwright's Chromium. The voice uses an ElevenLabs API key and style targets a Gemini API key; without them it can still make silent drafts.
metadata:
  author: mys1erious
  version: "1.0.0"
---

# Explainer video

A short video that teaches one thing and shows it: the voice says "nine in ten quakes hit near an edge" and on screen nine in ten of the real quakes light up along the edges. Everything is drawn in code on a canvas, so every number and label can come straight from the data, and the video renders frame-exact.

```
narration.json ──voice.py──▶ out/voice.wav + out/timeline.json (word times)
                                   │
index.html + engine.js ◀───────────┘  draw(t) is a pure function of time; visuals land on cue words
        │
        ├─render.py sheet / frames ──▶ stills to check by looking
        └─render.py video ──▶ out/video_master.mp4 ──audio.py──▶ out/<name>.mp4 (voice + music + SFX, -14 LUFS)
```

`<skill>` below means the folder this file is in.

| File | What it is |
|---|---|
| `assets/engine.js` | The frame harness: `start`, `seek(t)` with motion blur, grain and vignette, easing and springs, seeded random, camera, captions, word-by-word subtitles. |
| `assets/starter/` | A working 12-second video to copy: `index.html` and `narration.json`, real data (1,000 drops of water, 25 fresh). It is deliberately small. It shows how the pieces connect, not the quality bar (step 6). |
| `scripts/voice.py` | Narration to voice and word timeline with ElevenLabs. Also designs voices, and makes silent drafts without a key. |
| `scripts/render.py` | Contact sheet, single frames or the video, in headless Chrome. Exits 1 on page errors. |
| `scripts/audio.py` | Synthesized music bed and sound effects on the cue times, mixed under the voice, loudness-normalized, muxed into the MP4. |
| `scripts/targets.py` | Generates target frames per scene (and per style) with Gemini: the look is fixed as pictures before any drawing code. |
| `references/engine.md` | Page contract, every engine global and helper, sound kinds, music modes, WebGL, performance. |
| `references/data.md` | Real data: finding sources, preparing them once, computing the facts you say, truth rules for the screen. |
| `references/styles.md` | Several styles of one video: shared brief, target frames, parallel builds, side-by-side comparison. |

Run the scripts with `uv run <skill>/scripts/<script>.py …`; their dependencies are declared inline, so uv installs them on first use. Without uv: `pip install playwright pillow numpy soundfile pyloudnorm`, then `python <script>`. If Google Chrome is not installed, run `playwright install chromium` once.

## 1. Pin down the brief

Ask only for what the request leaves open and what would change the build:

- **What it teaches:** one idea a viewer could repeat after one watch. "How plate tectonics works" is a topic; "earthquakes draw the plate edges by themselves" is an idea.
- **Platform and shape:** 1080×1920 (9:16) for TikTok, Reels and Shorts is the default. 1920×1080 for YouTube, 1080×1350 (4:5) for the X or Instagram feed.
- **Length:** 25–45 s for short-form.
- **Real data or illustration:** if the video states facts, it shows the real data behind them (step 3).
- **Look:** one style by default. When the user is exploring, build 3–4 styles of the same video to compare (`references/styles.md`).
- **Voice:** ElevenLabs needs a key (`ELEVENLABS_API_KEY` in the environment or a `.env` in the project or a parent folder). The default voice is a premade one; `voice.py --design` makes a custom one. Without a key, make a silent draft with `--silent` and captions that carry the words.

State the plan in a few lines (idea, beats, data, look) and get a yes before spending credits. If the user can't be reached, make each of these choices yourself, write them down, and report them with the video.

## 2. Set up

```sh
mkdir -p <project>/fonts && cp <skill>/assets/engine.js <skill>/assets/starter/* <project>/
curl -sL -o <project>/fonts/InterTight.ttf "https://github.com/google/fonts/raw/main/ofl/intertight/InterTight%5Bwght%5D.ttf"
```

Any Google Font works the same way (raw TTF from `github.com/google/fonts`, loaded through `start({fonts})`); choose one that fits the look. Keep the fonts in `fonts/` and the data in `data/`.

## 3. Get the data

When the video states facts, the data comes from primary sources (agencies, papers, datasets), not from memory. Download it once into `<project>/data/raw/`, prepare it with a script into small files the page loads (`data/*.json`, PNG rasters), and compute every number the voice says from the data. Record each source on the end card. `references/data.md` has the workflow and the truth rules.

## 4. Write the script

Replace the starter's `narration.json`:

```json
{ "voice": "JBFqnCBsd6RMkjVDRZzb", "lead": 0.3, "gap": 0.24,
  "lines": [ {"text": "Only twenty-five are fresh.", "cues": ["twenty"], "pause": 0.15} ] }
```

- `cues` are the words where something must land on screen. Each matches the start of a spoken word in order ("twenty" matches "twenty-five"), and the page reads it as `at('<line>:<cue>')`, e.g. `at('1:twenty')`.
- `pause` adds silence before a line, and `start` starts a line at an absolute time. Optional: `voice`, `model` (default `eleven_v4`), `lead`, `gap`.

Write it for the ear and the eye:
1. **The first line is the hook, and the first frame already shows it.** The striking visual is moving at t = 0. Don't open on a title.
2. **One idea, one step per line.** 6–10 lines, 60–100 words for about 30 s (the voice reads 150–165 wpm).
3. **Every line has a visual that proves it.** If you can't say what the screen shows during a line, cut the line or find the picture.
4. **Speakable:** short sentences, numbers as words ("eight and a half thousand"), no parentheses, symbols or abbreviations the voice could misread.
5. **The voice and the screen agree with the data.** Round honestly: "over eight and a half thousand" on the voice, 8,558 on screen.
6. **End on the takeaway**, on an end card that also names the sources. Hold it about 2.5 s.

Show the script, and the facts with their sources, to the user before running the voice.

## 5. Make the voice

```sh
uv run <skill>/scripts/voice.py <project>                 # -> out/voice.wav, out/timeline.json
uv run <skill>/scripts/voice.py <project> --silent        # draft without a key: silent, words timed at ~150 wpm
uv run <skill>/scripts/voice.py <project> --design "calm, curious British narrator in her 30s"   # 3 previews in out/voices/
uv run <skill>/scripts/voice.py <project> --save 2        # keep preview 2; prints the id for narration.json
```

It prints each line's end time, the words per minute, the character count (what ElevenLabs bills) and every cue's time. Check that the pace is 140–175 wpm and every cue was found. Re-running regenerates every line, so fix the text first and run it once. A video built on a `--silent` draft keeps working when the real voice replaces it, because the page reads all its times from the timeline.

## 6. Storyboard and art direction

This step decides whether the video looks made or generated. A 30-second video that holds attention is 4–6 scenes in one world, not one chart that changes colour.

**Storyboard.** Write `storyboard.md` before any code. Give it one row per line of the script, with:
- the line's time from the timeline and its words;
- the scene;
- what changes on screen at each cue;
- the data it shows.

Check the storyboard against four rules:
- **One visual thread from the first frame to the last.** The camera travels through one world (a globe, a map, a timeline, an object) rather than flipping slides. Scenes change by moving through it: fly to a place, zoom through, slice it open, turn it, or rearrange the same marks into a new chart.
- **Dense, real data.** Draw the actual measurements as marks: every year's value, every station, every event, hundreds or thousands of them. Then pull out the one that matters. A few big shapes say nothing the voice doesn't.
- **A change every 1.5–2.5 s,** each landing on a cue.
- **A climax about two-thirds of the way in.** The most surprising number gets the biggest visual move and the `riser` + `hit`.

**Direction.** Name the look after a real-world medium, for example:
- a NASA mission briefing;
- a risograph data poster;
- a painted museum atlas;
- a seismograph printout;
- a glass planetarium globe.

Write it down as:
- a palette of 3–5 colours;
- type: one display face and one text face from Google Fonts;
- how the subject and the data marks are drawn;
- the texture (paper, grain, halftone, glass, relief shading);
- the HUD and labels.

**Target frames.** Make a realistic still of the hook scene and of the climax scene in that direction with `targets.py` (spec format in `references/styles.md`; a Gemini image costs roughly $0.15). Put the real labels and numbers in the scene text. Look at both images, regenerate any that miss, and build the page to match them, taking the look but never their text. Without a Gemini key, write the direction in more detail and go on without the images.

**Quality bar.** Check every frame against it, on the contact sheet and against the targets:
- **Depth:** a background with texture or relief, the data in the middle, labels and HUD in front. Never flat shapes on a flat gradient.
- **Hierarchy:** one huge number or word per scene, small precise labels with leader lines to what they name, and a quiet legend or source line.
- **Craft:** textures prebuilt in `init` (relief shading, paper grain, hatching, halftone), consistent line weights, tabular numerals in counters (`tabular()`), no system font.
- **Motion:** staggered entrances, springs and eases, and camera moves between scenes. Nothing is linear, and nothing appears without an animation.

## 7. Build the page

The page is `index.html` with `<canvas id="out" width="1080" height="1920">`, then `engine.js`, then your script calling `start({init, draw, fonts})`:

- `init(tl)` runs once. It reads cue times with `at(…)`, builds everything heavy (textures, layouts, data structures), and returns `{duration, title, beats, sfx, music}`. `beats` are `[name, time]` pairs for the contact sheet; `sfx` are `[kind, time]` pairs for the mix.
- `draw(t)` paints the whole frame onto `ctx` from nothing, as a function of `t` alone. Use `rng(seed)`, never `Math.random`, `Date.now` or state carried between frames: frames are drawn out of order.

`references/engine.md` lists every helper and global; don't redeclare those names.

Compose for a phone:
1. **Safe area.** On 9:16, platform buttons and captions cover the bottom ~360 px and the right ~120 px: keep text and key data inside x 60–950, y 130–1560.
2. **One focal thing at a time,** and big type: numbers 60 px and up, labels 28 px and up at 1080 wide. If a label can't be read on the 270 px-wide contact-sheet thumbnail, it's too small.
3. **Land each visual on its cue,** on the word's frame or up to 0.1 s before, with its sound cue on the same time. Something should change every 1.5–2.5 s, and the camera never quite holds still (`camPath` drifts).
4. **Show it with the data.** Dots are the real records and sizes and positions are true; a label names the real thing (`references/data.md`).
5. **Subtitles,** word by word with `drawSubs`, inside the safe area. Many people watch muted. It shows at most `maxLines` (2) lines of a sentence at a time and pages through long sentences, but sentences of 12 words or fewer read best.
6. **The direction from step 6,** carried through every scene. Avoid the defaults: glowing neon on black, rainbow gradients and system fonts all read as generic.

Sound: pick cues from the kinds in `references/engine.md` (`pin` for a number landing, `whoosh` for a camera move, `hit` with `riser` for the climax, `reveal` for the end card). For many small events, use one `thump` per 1/12 s, not one per event. Music is `pad` (default), `trailer` or `beat`.

## 8. Check by looking

```sh
uv run <skill>/scripts/render.py <project> sheet                 # frames/sheet.png, one thumbnail per beat
uv run <skill>/scripts/render.py <project> frames 0.0 4.6 11.2   # full-size frames/t_<t>.png
```

Open `sheet.png` and the frames with your image viewer or Read tool, and look. Don't stop at "no errors". Check that:
- the first frame already hooks;
- every beat lands at its cue, and the numbers on screen match the voice and the data;
- text is inside the safe area, readable on the thumbnail, and never overlaps other text;
- the frame is neither empty nor cluttered, and the end card names the sources;
- each frame meets the quality bar (step 6) and matches its target frame. Paste the frame and its target side by side at the same height (a few lines of PIL) and compare them. Fix layout and proportion first, then type, then colour and detail.

Stills miss what happens between beats. Also render frames 0.2 s before and after each transition. Fast motion looks doubled in stills because of the motion blur, which is expected. Fix what you see, render again, and stop after an initial pass plus at most two correction rounds; report what is left.

## 9. Render and deliver

```sh
uv run <skill>/scripts/render.py <project> video   # out/video_master.mp4, prints ms per frame
uv run <skill>/scripts/audio.py <project>          # out/<name>.mp4 to post, out/<name>_master.mp4 to edit
ffprobe -v error -show_entries stream=codec_type,width,height,duration -of compact <project>/out/<name>.mp4
```

`<name>` is the project folder's name. Rendering takes 100–400 ms per frame; prebuild what's slow (`references/engine.md`). Confirm the size, the duration and that there is an audio stream. In the hand-off, give the path, what you checked and how, what it cost (voice characters, generated images), and say plainly what you could not check: you can't hear the mix or watch it at speed, so ask the user to watch it with sound.

## Pitfalls and their fixes

- **"page failed to start" or "DURATION is not defined".** A script error, often a redeclared engine global (`const W`, `ctx`, `at`…), stopped the page. The message names it; rename your variable.
- **"out/timeline.json not found".** Run `voice.py` (or `--silent`) on the folder first.
- **`cue "…" not found`.** The voice spelled the word differently from your cue. Write numbers as words in the text and use a prefix of the spoken word.
- **A line ends with a stray sound.** The model sometimes starts the next line at the end of a clip; `voice.py` cuts it. If it's still there, rephrase the end of the line.
- **A target image puts invented labels or numbers on screen.** Generated images make up text. Take only the look from them, never a label or a number.
- **Values decoded from a PNG are slightly off.** Browsers colour-manage images. Load data rasters with `createImageBitmap(blob, {colorSpaceConversion: 'none', premultiplyAlpha: 'none'})`.
- **A map polygon smears across the whole world.** It crosses the antimeridian; unwrap its longitudes before filling, and close polar polygons along the pole.
- **Straight chords cut across a projected map.** A polygon clipped to a box in lon/lat has long straight edges that bend when projected (polar, orthographic). Densify edges before projecting (e.g. shapely `segmentize(1)`, in degrees).
- **The render is slow.** Large gradients, `shadowBlur` on many shapes and `getImageData` cost the most. Draw static layers once in `init` to an offscreen canvas (`mk(w, h)`) and `drawImage` them per frame.
- **WebGL is missing or black on a Linux server.** `render.py` asks Chrome for SwiftShader there. It works but slowly; on a laptop use the GPU.
- **The video is cropped to 1833 px tall.** Chrome caps a viewport resized after launch. `render.py` reads the size from the literal `<canvas id="out" width height>` tag, so keep those attributes in `index.html`.
