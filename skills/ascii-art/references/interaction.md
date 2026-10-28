# Interaction

## Contents
- Rules
- The pointer model
- Follow and gaze
- Hold, charge and release
- Click, swipe and drawn shapes
- Scroll, dwell and shake
- Idle autopilot and hold-beat mode
- Discoverability and callouts

## Rules

- **Plain mouse movement must change something visible within a second.** Users move the mouse before they click.
- **Clicks act locally.** A plain click must never switch the whole scene. Put navigation (next beat, restart, styles) on keys.
- **Every action needs visible feedback while it builds:** a charge ring, tightening, jitter, a progress arc.
- **Recording ignores input,** so takes are always the scripted cut.
- **Use pointer events, so touch works.** Give the canvas `touch-action: none`. Effects that need hover also need a tap or drag alternative.

## The pointer model

```js
const pointer = { x: 0, y: 0, inside: false, moved: -1e9, down: false, downAt: 0 };
const local = e => { const r = canvas.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
canvas.addEventListener('pointermove', e => { [pointer.x, pointer.y] = local(e); pointer.inside = true; pointer.moved = performance.now(); });
canvas.addEventListener('pointerdown', e => { /* ... */ canvas.setPointerCapture(e.pointerId); });
canvas.addEventListener('pointerleave', () => { pointer.inside = false; });
```

- Use `performance.now()` for input timing. `render.mjs` replaces it with its virtual clock, so rendered takes stay consistent.
- Behind UI, listen on the container or `window`, and keep `pointer-events: none` on the canvas (`rendering.md`).
- In a 2×2 style grid, map the pointer into the quadrant's frame: subtract the quadrant's origin, then divide by the view scale.

## Follow and gaze

- **Mapping:** `tanh((px − cx) / (k·size))` rather than a linear clamp. Small moves near the subject already turn it, and the screen edges saturate.
- **Saccades** make eyes and heads feel alive. Keep a fixation point. Retarget it when the cursor moves past a threshold, or after a short hold. Then snap to it fast:

```js
const far = Math.hypot(tx - fix.x, ty - fix.y);
if (far > 0.15 || (far > 0.03 && ft - fix.at > 0.22)) { fix.x = tx; fix.y = ty; fix.at = ft; }
const k = Math.min(1, dt * 32); gaze.x += (fix.x - gaze.x) * k; gaze.y += (fix.y - gaze.y) * k;
```

- **Make the whole subject respond, not one part:**
  - the lids follow the gaze, dropping when it looks down;
  - the iris foreshortens along the gaze;
  - inner detail shifts toward the gaze more than outer detail (parallax);
  - highlights stay fixed to the light.

  If only one element slides, it reads as a sticker.
- **Other follows:** the cursor as the light direction, a camera tilt (parallax layers at different strengths), a flock that steers away from the cursor, a cursor wake in an image field (a per-cell excitation that decays over about 1.5 s), or hover readouts such as coordinates near the cursor.

## Hold, charge and release

```js
charge = pointer.down ? Math.min(1, (performance.now() - pointer.downAt) / 1000) : 0;
// release: scale the burst by charge, and kick a damped spring for overshoot
springV += 2.5 + 3 * c;
springV += (-196 * spring - 2 * 0.28 * 14 * springV) * dt; spring += springV * dt; // ω = 14, ζ = 0.28
```

- Show the charge building: a ring contracting around the pointer, rings tightening, glyph jitter that grows with the charge, a brightening.
- Release: a ripple or shockwave, a spring that overshoots, and an impact frame when the charge was full.
- A hold that doesn't move about 1 s can be its own technique, for example charge-then-strike lightning. Cancel it if the pointer moves more than about 12 px.

## Click, swipe and drawn shapes

- **Click** (down and up within about 250 ms and 6 px): a small local event, such as a ripple, an object that sticks, or a spark.
- **Swipe:** collect points while the speed is above about `3000·s` px/s. When the speed drops, evaluate the stroke. Accept it only if it has 10 or more points, a chord over `220·s` px, and is roughly straight. Cancel collecting on `pointerdown`, since a press is a click, hold or drawing. Ignore swipes during modal states. Without these thresholds, quick flicks and shakes fire false slashes.
- **Drawing a circle while held:** take the centroid of the stroke. Accept it if the radius's standard deviation is under about 25% of its mean, the angles cover more than about 300°, and the ends close up. Then fire the effect inside the circle.

## Scroll, dwell and shake

- **Scroll:** accumulate a signed strength (`k.s += deltaY · 0.002`, decaying toward 0). Use it for a warp or a zoom. Call `preventDefault()` (with `{ passive: false }`) only when the canvas is the whole page.
- **Dwell:** resting on a target (a distance below a threshold and little movement) for about 1.5 s triggers a mode. Show progress while it builds.
- **Shake to break free:** count direction flips of the horizontal velocity within about a 0.6 s window. Six or more flips releases the mode.

## Idle autopilot and hold-beat mode

- When the pointer is outside the canvas, or hasn't moved for 4–6 s, go back to scripted motion. Examples: gaze glances, a light that orbits, a predator flying passes over the flock. Ease into it; don't snap.
- **Hold mode** (`H`, or `?hold`, which the starter has): freeze the timeline `t` while input and effects keep running on `ft`. `?t=3&hold` opens on one moment ready to play with.
  - Use it for interaction tests, so scripted beats don't fire in the middle of your shots.
  - For a story cut, add `→` to jump to the best moment of the next beat and `←` to restart.

## Discoverability and callouts

- One help line at the bottom-left in small mono type at about 55% opacity, for example `move: … · hold + release: … · space pause`. Hide it with `?clean` and while recording.
- **Callouts:** when an action fires, punch its name in. Draw large bold mono text with a dark stroke, scale it from 1.5× to 1× over 0.12 s, hold it, then fade it out by 1.2 s. Keep at most 4 on screen.
- Name the actions in the canvas's `aria-label`.
