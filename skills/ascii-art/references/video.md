# Video

## Contents
- Two ways to record
- Sizes for X and other feeds
- Rendering with render.mjs
- Sound
- Editing a cut
- Hooks, loops and posting

## Two ways to record

| | In-page `R` (MediaRecorder) | `scripts/render.mjs` (virtual clock) |
|---|---|---|
| Smoothness | Depends on the machine, and frames drop under load | Every frame is exact |
| Sound | Yes: route WebAudio into the recorded stream | No. Mux a separate take. |
| Speed | Real time | About 10–20 frames/s for 1080p |
| Output | MP4 (H.264) in Chrome 126+, else WebM | PNG frames, then MP4 with ffmpeg |
| Works in sandboxed embeds | No, downloads are blocked | Not needed: it runs locally |

For a post, use `render.mjs` for the picture and a real-time take for the sound.

In-page recording (in the starter):
- Restart at t = 0 and record exactly one `LOOP` with `canvas.captureStream(60)` at about 20 Mbps.
- Cap the backing store to the platform's limit (below).
- Set `recording = true` so the HUD hides and input is ignored.
- To include sound, use `new MediaStream([...canvas.captureStream(60).getVideoTracks(), ...audioDest.stream.getAudioTracks()])` with `video/mp4;codecs=avc1.640028,mp4a.40.2`.

## Sizes for X and other feeds

X accepts up to 1920×1200 landscape and 1200×1900 portrait. It serves 60 fps.

| Shape | CSS size × scale | File | Notes |
|---|---|---|---|
| 16:9 | 1600×900 × 1.2 | 1920×1080 | Desktop and timeline embeds |
| 4:5 | 960×1200 × 1.25 | 1200×1500 | Fills far more of the phone feed |
| 1:1 | 1000×1000 × 1.2 | 1200×1200 | Safe everywhere |
| 9:16 | 1080×1920 × 1 | 1080×1920 | Reels, Shorts, TikTok |

- Render at the piece's design size, and reach the file size with `--scale`. Rendering at a small CSS size makes the glyphs coarse and the subject small. A 4:5 cut at 720×900 CSS looked worse than 1600×900 cropped.
- Fine, high-contrast glyphs are what compression smears first. Check a re-encode at about 2.2 Mbps 720p, which is roughly what a feed serves. If the glyphs mush, use a coarser grid or bolder font for the video.

## Rendering with render.mjs

```sh
node <skill>/scripts/render.mjs "http://127.0.0.1:8000/piece/?clean&style=2" out/frames \
  --seconds 12 --fps 60 --size 1600x900 --scale 1.2 --mp4 out/piece-16x9.mp4
```

- It replaces `requestAnimationFrame` and `performance.now` before the page loads. Each frame advances exactly `1000/fps` ms plus 1e-6, so a fixed 1/60 s step never skips. Then it screenshots.
- Pages that animate from `Date.now()`, `setTimeout` or CSS animations won't follow the virtual clock. Drive everything from rAF timestamps.
- Frame n shows timeline time `(n + 1) / fps`.
- **Start later:** add `&t=4.4&play` to the URL to start the take at 4.4 s, so the hook comes sooner. A take that is exactly one `LOOP` long still loops seamlessly.
- **Seam check:** with `--mp4` it prints how the last frame compares with the first, against two neighbouring frames, as PSNR in dB. A seam within about 1–2 dB of its neighbours is invisible.
- **Frames:** about 50 s for 720 frames at 1200×1500. The PNG frames are deleted after the MP4 is made, unless you pass `--keep-frames`; you need them to cut a highlight edit.
- Encoding: `libx264 -preset slow -crf 16 -tune animation`, `yuv420p` and BT.709 tags, `+faststart`. A lower CRF only grows the file; X re-encodes it anyway.

## Sound

- **Synthesise it with WebAudio.** A two-second noise buffer is the base for loops and bursts through filters: rain is a bandpass at about 3.8 kHz, fire is a lowpass at about 380 Hz, crackle is a bandpass at about 5 kHz. Add oscillators with exponential envelopes for booms (a sine dropping from 110 Hz to 32 Hz), "shing" (high sines) and chirps. Put a compressor on the master bus.
- **Sound is off by default.** Turn it on with a key (`M`), and create or resume the AudioContext inside a user gesture.
- **Two kinds of sound:**
  - Beds are continuous levels set every frame with `setTargetAtTime`.
  - Cues are one-shots fired by beats and actions.
- **A sound take for a rendered picture:** run the page in real time with sound on, and press `R`. Playwright, or CDP with `--autoplay-policy=no-user-gesture-required`, can automate it. Keep only its audio. The recorder starts about 40 ms late, so shift the audio earlier by that much and check that the hits line up:

```sh
ffmpeg -i picture.mp4 -ss 0.04 -i take.mp4 -map 0:v -map 1:a -c:v copy -c:a aac -b:a 192k -shortest out.mp4
```

## Editing a cut

- Cut highlight segments from the frame sequence by timeline time, using frame index `round(t·fps) − 1`. Take the audio from the same times, with 10 ms fades at each cut so it doesn't click.
- A strong 16–20 s post:
  1. the build and the reveal;
  2. the hero action and its impact;
  3. the same hero moment in a 2×2 style grid;
  4. the fade back to the first frame, so it loops.

## Hooks, loops and posting

- **Feeds autoplay muted,** so the picture has to carry it without sound. Impact frames and big value changes do.
- **Hook in the first second.** If the loop opens quietly, start the cut later, or add a 0.5–0.7 s cold open that flashes forward to the hero moment.
- **Loop seamlessly:** end on a frame close to the first, for example both near black. A seamless loop gets watched twice.
- **Thumbnail:** the hero moment as a `?t=` still at `--scale 2`.
- **Reply or follow-up:** a 2×2 grid of the styles, or a "try it yourself" link to the live page.
- **Fan art:** use no official logos or character art, and say "fan art, not affiliated with …" in the post.
