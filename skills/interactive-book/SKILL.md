---
name: interactive-book
description: Build an interactive 3D book that teaches a topic, one lesson per spread. The left page explains, asks for a prediction and hides the answer under a flap. The right page holds an ink-drawn 3D figure the reader plays with, plus a challenge. Then test it in headless Chrome, publish it to GitHub Pages, and record a captioned video for X. Use when the user wants an interactive book, a 3D or explorable textbook, a teaching book or course on any topic, lessons as book pages, an Every Joule-style book, a /teach workspace turned into a book, or a video of such a book to post.
license: MIT
compatibility: Needs Node 22+, npm and network access for the first install (three.js, Vite, Playwright and its Chromium). Video export needs ffmpeg. Publishing to GitHub Pages needs the gh CLI, logged in.
metadata:
  author: mys1erious
  version: "1.0.0"
---

# Interactive book

An interactive book teaches a topic as an open book on a desk, rendered in 3D. Each lesson is one spread:

- **The left page** carries the words:
  - why the lesson matters, then the idea in two short paragraphs and a one-line principle;
  - key words, and the best free next read;
  - a prediction with three options, and a flap that shows the answer only after the reader predicts;
  - a challenge.
- **The right page** carries a figure that lifts off the paper as an ink drawing:
  - switches and buttons printed on the page, and things to tap in 3D;
  - live working, handwritten in the margin.

  Meeting the challenge stamps the page.
- **Watch** flies the camera through five captioned shots of the figure, then hands it to the reader.

The look follows [Every Joule](https://github.com/iamtechartist/every-joule-lesson1):

- window light with soft shadows;
- paper-white solids with ink outlines;
- pencil hatching in the shade;
- the figure big enough to fill its page.

Every Joule's code has no licence, so the template is our own code; none of its code is reused. `<skill>` below means the folder this file is in.

| File | What it is |
|---|---|
| `assets/template/` | A working book with one example lesson (a seesaw). It has the engine, page layout, controls, the text version for screen readers, the tests, and scripts for screenshots, video and deployment. |
| `references/lessons.md` | The lesson file: every field, the rules the tests enforce, and how to write each part. |
| `references/scenes.md` | The 3D figure: the scene contract, the kit, the page's coordinates, camera shots, and the test hooks. |
| `references/look.md` | The renderer and why each setting is what it is. Also covers what to change for a different mood, and the review method. |
| `references/video.md` | Recording clips, cutting them, and writing the post for X. |

Read a reference when you reach its step, not up front.

## 1. Pin down the brief

Ask only for what the request leaves open:

- **Topic and reader:** who it is for and what they already know. "Complete beginner" changes every lesson.
- **Why:** what the reader wants to be able to do afterwards. This decides what goes in and what stays out.
- **Size:** 6–12 lessons, one idea each. A first version can be 3.
- **Language:** the book's language, if it isn't English.

Then **propose the outline before building anything**. Use a table with one row per lesson:
- the title;
- the one idea;
- the figure that lifts off the page;
- the prediction;
- what the reader does to meet the challenge.

Get a yes. Then build **one lesson at a time**: build it, check it (step 6), show screenshots and the local URL, and take feedback before the next. The user can say "build the rest" to go faster.

If the user can't answer (they're away, or said to go ahead), make each choice yourself, write it in `DECISIONS.md` in the book folder (the brief, the outline table, anything the skill says to ask about), and keep going.

## 2. Research before writing

- **Never write a lesson from memory.** Find how the topic is normally taught, from textbooks, university courses and well-known interactive explainers, and follow that order of ideas.
- **Every claim and every number on a page needs a source** in `src/content/sources.json`, or must come from the lesson's model, which the tests check.
- **If you measured something yourself,** such as a model you ran or a dataset you counted, pin the numbers in a model test and say how you got them in the lesson's `idealised` text. Cite it as a source only once it has a public URL, such as the script in the book's published repo.
- **When a site blocks automated reading,** don't cite it from memory. Use an equivalent you can open: an open textbook, university course notes, Wikipedia, or the reference implementation.
- **`readNext`** is the best free thing to read after the lesson.
- **If the user keeps a `/teach` workspace** (Matt Pocock's `teach` skill), its lessons map one to one onto spreads. Its mission, resources and learning records stay in that workspace, and the book is the lesson output.

## 3. Start from the template

```sh
cp -R <skill>/assets/template <book-folder>
cd <book-folder> && mv gitignore .gitignore
npm install && npx playwright install chromium
npm run dev            # http://127.0.0.1:5199/
```

Read `src/main.js` and the example lesson (`src/lessons/0001.json`, `0001.scene.js`, `src/sims/balance.js`) once, whole.

**Keep:**
- `src/engine/`
- `src/main.js`
- `src/kit/`
- the scripts
- the first block of `tests/book.spec.mjs`

**Replace:**
- `src/content/book.json`: title, subtitle, cover and ribbon colours, lesson titles, and the colour key;
- `src/content/frontispiece.js`: a small ink drawing of the subject for the title page;
- the glossary, the sources and the lessons;
- the models in `src/sims/`;
- the per-lesson tests.

Delete the seesaw lesson once your first lesson exists. Don't leave the example's sources, glossary or tests behind.

| URL parameter | Effect |
|---|---|
| `?k=N` | Open at spread N (1 is the title and contents; lesson n is usually spread n + 1) |
| `?nowatch` | Don't play a lesson's tour when you turn to it |
| `?still` | No motion: tweens jump to their end (also the reader's ◐ button and `prefers-reduced-motion`) |
| `?shot` | Hide the toolbar, for clean screenshots |
| `?tier=low` | No post-processing or shadows, for weak machines |

The reader's answers, stamps and watched tours are kept in `localStorage`. Bump the version in `STORE` (`src/main.js`) when lessons change enough that old progress would mislead.

## 4. Write a lesson

A lesson is four pieces. Add them in this order:

1. **The model,** `src/sims/<name>.js`: plain JavaScript with no three.js and no DOM.
   - It holds the state, and the numbers the page prints (`margin()`).
   - It knows when the challenge is met (`challenge()`).
   - It handles every switch, button and tap.

   Test it in `tests/sims.test.mjs` before drawing anything.
2. **The content,** `src/lessons/000N.json`: see `references/lessons.md`.
3. **The scene,** `src/lessons/000N.scene.js`: see `references/scenes.md`.
4. **Registration:**
   - add the lesson to `src/lessons/registry.js` and its title to `book.json` `lessons`;
   - its key words go in `glossary.json`;
   - its sources go in `sources.json`.

The page order is fixed, and each part has one job. Keep each part short:

| Part | Its job |
|---|---|
| Why, idea, principle | Say the one idea plainly, in the reader's words |
| Predict | Make the reader commit before reading the answer |
| The flap | Explain why the answer is right |
| The figure | Let the reader see it happen |
| The challenge | Make them use it |
| What the figure leaves out | Keep the simplification honest |

## 5. Compose the figure

This step decides whether the book looks finished or generated. The engine already gives the light, the shadows and the ink; the figure has to do the rest.

1. **Fill the right page.** The figure lives in x 1–20 and z −12 to 7 (world units; the page is 21 × 28). The reading camera looks down at about 50°, so anything tall rises up the page: the top of something h tall standing at depth z shows where a flat mark at z − 0.8h would. Keep z − 0.8h ≥ −11, or it covers the running head. Put tall things forward (z 0 to 5) and flat things back.
   - **The bottom of the right page** holds the printed caption, hint and controls, and its space is fixed. It fits one caption line (about 40 characters) with a hint of up to two lines, or two caption lines with a one-line hint. Below that go one row of switch pills, then one row with the buttons and Watch. A second switch row doesn't fit: merge it into one switch, or make it buttons. The test fails on overflow.
2. **One subject, big.** A figure that fills half the page reads as unfinished. Scale it up, and cut parts rather than shrink everything.
3. **Paper-white solids with ink outlines,** made with `kit.inked(geometry, { fill, hatch })`.
   - Hatching appears where the window light doesn't reach.
   - Use `hatch: 1` for big solids, 0.35–0.5 for thin posts and rails, and 0 for floors and slabs. Hatching everywhere looks like a lattice.
4. **Colour by role,** with 3–5 hues, and never one hue for two meanings. Name each role in `book.json` `legend`; the contents page prints it as a key.
5. **Labels:**
   - `kit.floatLabel()` for live numbers: it faces the reader and is drawn on top;
   - `kit.pageText()` for marks lying on a surface.

   Never put a label over another object or over the printed caption. Check this in every camera shot, not just the reading view.
6. **Motion:** animate every change with `kit.tweens.run(update, 0.6–1.1 s)`; still mode makes it jump. Things that move should land where the model says, and must not pass through each other on the way: when two things swap, lift one over the other, or move them one after the other. The tests run with motion off, so check moves with `--act` (step 6).
7. **Glow** (an emissive material plus `kit.halo`) is for the one thing to look at, never for the whole figure.
8. **Five camera shots** per lesson, one per Watch caption: wide, close, cutaway, angle, handover.
   - Each shot's `enter()` puts the figure in the state its caption describes.
   - The last shot resets the figure and returns to the reading view.
   - The tour shows the idea but never solves the challenge.
   - Frame each shot with `kit.pose([x, y, z], { distance, elevation, azimuth })`. It aims at a point in the figure's own coordinates, so you never convert to world positions.
   - The caption covers the top 15% of the screen and the toolbar the bottom 10%. Aim at the subject's centre and step back until it sits in the band between them. Check every frame with `--tour`.

## 6. Check by looking

```sh
npm test                     # models in node, then the book in headless Chromium
npm run shoot -- --tour      # shots/sheet-spreads.png and shots/sheet-tours.png (the dev server must be running)
npm run shoot -- --spreads 3-3 --act "window.__book.actions.press('step')"   # shots/sheet-motion.png: six frames mid-move
```

**The tests check:**
- every spread opens with no console error, and no text runs off a page or a card;
- a sweep of every switch, button and tap in every lesson;
- content rules, such as equal-length prediction options and five shots for five captions;
- the Watch tour;
- random clicking and keys on every spread;
- the text version for screen readers, with axe.

Add one test per lesson that meets its challenge through real clicks on the printed controls and the 3D figure (`clickPrinted`, `clickTarget`), the way the seesaw's test does.

Then **open the two contact sheets and look at them.** "Tests pass" is not the bar. Check that:
- the figure fills the right page and stays clear of the caption and controls;
- nothing overlaps: labels over objects, objects through the page or each other;
- every tour frame shows what its caption says, with nothing important cropped;
- the colours are distinct, and match the key;
- the page text is readable at 1280×720;
- in the motion sheet, nothing passes through anything else, and nothing leaves the page mid-move.

To judge the finish, screenshot a reference book (Every Joule, or whatever the user points to) by hand at the same window size, put it beside your spread, and fix what reads weaker. `references/look.md` has the method. Shoot again after every fix.

## 7. Publish

Publishing is outward-facing: confirm the repo name and that the book should be public before creating anything.

- **GitHub Pages:**
  1. Create the repo: `gh repo create <owner>/<name> --public`.
  2. Push the book: `PAGES_REPO=https://github.com/<owner>/<name>.git npm run deploy:pages`. The script force-pushes the built book as the only commit on `gh-pages`, and writes no other branch. If `README.pages.md` exists it becomes the repo's front page, and `shots/spread-02.png` becomes its `screenshot.png`.
  3. Turn Pages on once: `gh api -X POST repos/<owner>/<name>/pages -f 'source[branch]=gh-pages' -f 'source[path]=/'`.
  4. The site is at `https://<owner>.github.io/<name>/` about a minute later.
- **Any static host:** `npm run build`, then upload `dist/`. Paths are relative, so any folder works. To look at the build locally, run `npx vite preview --port 5199`. Opening `dist/index.html` straight from disk fails, because browsers block ES modules over `file://`.
- **A claude.ai Artifact:** `npm run artifact` writes `dist/artifact.html`, the page fragment an Artifact takes. Publish it with the files in `dist/assets/`.

## 8. Video for X

```sh
npm run record -- http://127.0.0.1:5199/ clips/l1 --from 1 --to 2 --seconds 25 --mp4 clips/l1.mp4
```

This records one page turn and that lesson's tour at a steady 30 fps on a paused clock, with the toolbar hidden and the captions enlarged. `references/video.md` covers which lessons to pick, cutting on caption changes, joining clips, and writing the post.

## Pitfalls and their fixes

- **The whole page glows.** Lit paper reaches about 2 before tone mapping, so a bloom threshold below that blooms the paper. Keep `UnrealBloomPass` at threshold 2.6, so only emissive things glow.
- **Dark squares appear around labels and halos.** That is screen-space ambient occlusion (SSAO, GTAO) treating transparent sprites as solid. Don't add it.
- **The hatching looks like a lattice.** Use `hatch: 0` on floors and slabs and 0.35–0.5 on thin parts.
- **A test fails with "text runs past the bottom margin".** Shorten the words. Don't shrink the font.
- **A switch row overflows.** Printed controls must end before x = 590 px on the right page, where the margin column starts. Use a shorter label or shorter options.
- **"card text runs off the card".** A card fits three handwritten lines. Shorten the text.
- **Taps hit decoration.** Give everything that isn't a target `raycast = () => {}`. `inked` outlines, labels and halos already have it.
- **The tests run against the wrong book.** Playwright reuses whatever server is on port 5199. Stop other books' dev servers, or change the port in `package.json`, `playwright.config.mjs` and `scripts/shoot.mjs`.
- **Recorded frames run at double speed, or skip.** Playwright's installed clock keeps following real time until `pauseAt`. The scripts pause it; any new script must do the same.
- **Headless runs are very slow on Linux.** That is software WebGL (SwiftShader); 60 frames can take minutes. macOS uses the Metal GPU. Run the visual steps on a Mac, or be patient.
- **A floating label's text is cut off.** A GPU texture can't change size after upload. `floatLabel` keeps one 1024 px canvas and shows only the used width, so keep labels under about 30 characters.
- **Two meanings share a colour.** For example, "a group the model found" and "a label a person gave" both in blue. Give each role its own hue and say so in the key.
