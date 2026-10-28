# Several styles of one video

When the user is still finding the look, build the same video in 3–4 styles and let them compare. Every style uses the same script, voice, data, timing and sound cues; only the drawing changes. Viewers judge the look side by side in a few seconds, so this is the quickest way to pick one.

## Layout

```
<project>/
  narration.json, out/voice.wav, out/timeline.json     made once by voice.py
  engine.js, fonts/, data/                             shared
  shared/story.js                                      the story's times, data loader and sfx/beats, used by every style
  shared/BRIEF.md                                      the build brief every style follows
  targets/spec.json, targets/<style>_<scene>.png       generated target frames
  styles/<style>/index.html                            one page per style
  styles/<style>/out/voice.wav                         a copy of the shared voice, for that style's mix
```

Each style page loads `../../engine.js` and `../../shared/story.js` and calls `start({timeline: '../../out/timeline.json', …})`. Render with the project as the server root:

```sh
uv run <skill>/scripts/render.py <project>/styles/riso sheet --root <project>
uv run <skill>/scripts/render.py <project>/styles/riso video --root <project>
cp <project>/out/voice.wav <project>/styles/riso/out/ && uv run <skill>/scripts/audio.py <project>/styles/riso
```

`shared/story.js` keeps the mix identical across styles. It holds the cue times, the `sfx`, `beats`, `title`, `duration` and `music`, and a loader for the data. Each style's `init` returns those unchanged and draws only its own look.

## Directions that are actually different

Pick directions that differ in medium, not just in colour. Name each one after a real-world reference, and describe it as palette, type, how the main subject is drawn, how data marks are drawn, the HUD and labels, and motion. For example, for a globe of earthquakes:
- an instrument printout (seismograph paper, ink lines, one red accent, typewriter type);
- a painted museum atlas (painted relief, serif small caps, an engraved cartouche);
- a risograph data poster (two spot inks, halftone, a huge grotesk, a Swiss grid);
- a cinematic glass globe (dark, see-through, glowing points at true depth, a restrained HUD).

Avoid directions that collapse into the same generic look: neon-on-black HUDs, glassmorphism cards, rainbow gradients.

## Target frames first

Before writing any drawing code, generate one realistic frame per key scene per style, then build each style to match its frames. A picture fixes layout, proportion, palette and type far better than a paragraph does.

`targets/spec.json`:

```json
{
  "frame": "A single vertical 9:16 frame (1080x1920) from a short-form science explainer video, flat straight-on composition, full bleed, no device mockup, no watermark, no logos. Keep all text and key content out of the bottom fifth and the right edge. All text short and spelled exactly as given.",
  "scenes": {
    "globe": "Content: a globe centred on the Pacific fills the middle... Top: a date ticker 'DEC 31 2025' and a counter '8,558 EARTHQUAKES'...",
    "section": "Content: a vertical cross-section under Tonga... a depth axis 0 to 700 km..."
  },
  "styles": {
    "riso": "Style: a risograph-printed data-journalism poster. Off-white paper, two spot inks...",
    "atlas": "Style: a hand-painted museum atlas relief..."
  }
}
```

```sh
uv run <skill>/scripts/targets.py <project>/targets/spec.json             # every style x scene
uv run <skill>/scripts/targets.py <project>/targets/spec.json riso_globe  # just one, to redo it
```

Style names must not contain `_`. Put the real labels and numbers in the scene text, because the model will invent its own otherwise, and it still often does. Take only the look from a target, never its text. Look at every target before building, and regenerate any that misses the brief.

## Build in parallel

If you can run sub-agents, give each style to its own agent with the same `shared/BRIEF.md` and its own target frames. Write the brief once, with:
- the story and the storyboard: each time range, the words spoken, and what must be on screen;
- the page contract: which shared files to load, that `init` returns the shared cues unchanged, the globals not to redeclare;
- the truth rules for this data, with the real labels to use;
- the safe area;
- the workflow: look at the targets, build, render the sheet and frames, compare them side by side with the targets, fix (an initial pass plus at most two rounds), render the video and the mix, and report;
- what not to touch: shared files and the other styles.

Otherwise, build the styles one after another.

Compare each build with its targets side by side at the same size (a PIL script that pastes them together). Fix layout and proportion first, then type, then colour and detail.

## Compare

A labelled 2×2 grid at full height:

```sh
cd <project>/styles && ffmpeg -y -i a/out/a.mp4 -i b/out/b.mp4 -i c/out/c.mp4 -i d/out/d.mp4 -filter_complex \
"[0:v]scale=540:960,drawtext=text='A':x=20:y=20:fontsize=36:fontcolor=white:box=1:boxcolor=black@0.5[v0];\
[1:v]scale=540:960,drawtext=text='B':x=20:y=20:fontsize=36:fontcolor=white:box=1:boxcolor=black@0.5[v1];\
[2:v]scale=540:960,drawtext=text='C':x=20:y=20:fontsize=36:fontcolor=white:box=1:boxcolor=black@0.5[v2];\
[3:v]scale=540:960,drawtext=text='D':x=20:y=20:fontsize=36:fontcolor=white:box=1:boxcolor=black@0.5[v3];\
[v0][v1][v2][v3]xstack=inputs=4:layout=0_0|540_0|0_960|540_960[v]" -map "[v]" -map 0:a -c:v libx264 -crf 20 -c:a copy ../out/compare.mp4
```

The audio is identical in every style, so any one style's track serves. If your ffmpeg has no `drawtext` (it needs libfreetype), drop the labels and name the order in your message.

When you hand over, give a one-line verdict per style: where it is strongest, and its weakest point on a phone. Recommend which two to test first.
