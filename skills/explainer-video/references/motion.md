# Motion: dynamic, TikTok-paced videos

This is the default for TikTok, Reels and Shorts. The feed rewards videos that never sit still: a data piece with five slow scenes reads as bland there, however well it is drawn. The explainers that worked had about 30 shots in 30 seconds, every spoken key word was an event on screen, and the camera never stopped moving.

## Pace

- **A new shot every 0.8–1.5 s,** 20–35 shots in 30 s. A shot is a new framing or a new thing on screen; it can stay in the same world.
- **Every cue word is an event.** On that frame something slams in, flies, breaks, flips, fills or zooms, with a sound on the same frame.
- **No hold longer than 1.5 s** before the end card. Between events the camera keeps moving: a push in, a drift, a turn.
- **The first 3 seconds have 3 or more events.** The first frame is already moving.

## One continuous ride

Chain the shots so each one comes out of the last. Zoom into an object and find the next scene inside it: phone → word → tokens → globe → undersea cable → data centre → chip. This is how you get speed without confusing the viewer. `scenes(t, shots)` in the engine does the transitions:

| `tr` | Use it for |
|---|---|
| `'in'` | Going deeper: zoom into the shot's `focus` point (the object the next shot is about); the next shot opens through a circle there. |
| `'out'` | Pulling back to a bigger context: the shot shrinks into a closing circle and the next one is revealed around it. |
| `'whip'` | A change of topic, a twist or a punchline. |
| `'cut'` | A hard beat, right on a slam or a flash. |

Match shapes across the transition: the circle you zoom into should be the planet, cell or button that fills the next shot. Give each shot its own `draw` function that paints the whole frame, and draw subtitles after `scenes()` so they never zoom or slide.

```js
SHOTS = [
  { t0: 0,       draw: shotPhone,  focus: () => ({ x: 540, y: 300 }), tr: 'in' },   // into the chat bubble
  { t0: at('1:tokens') - .2, draw: shotTokens, tr: 'out' },
  { t0: at('2:cross') - .2,  draw: shotGlobe,  focus: t => cablePoint(t), tr: 'in' }, // into the cable
  { t0: at('3:work'),        draw: shotDataCentre },
];
function draw(t) { scenes(t, SHOTS, { ring: ACCENT }); drawSubs(t, 1490); }
```

Inside a shot, keep things moving with `camPath`, `spring` and `kick`. Several beats can share one shot as long as each beat changes something big.

## Kinetic type

- **Key words as huge type,** 120–260 px and one to three words at a time, slammed in on the word they're spoken with `stamp()`. Supporting lines rise through a clip with `rise()`.
- **Contrast in scale.** One word fills the width, and the label beside it is 30 px.
- **Type can be the scene.** "YOU JUST HIT" fills the phone screen, then the phone's button gets stomped on "send".
- **Numbers count.** Roll a counter with `tabular()` while the thing happens, and freeze it on the cue (an odometer, "01 MS … 30 MS").

## Impact

- **The climax and 2–4 other hits** get `flash()` (an impact frame of 1–3 frames), `shake()` on the camera, a `kick()` squash on the object, and an `impact` or `hit` sound.
- **Speed lines** during fast moves: short strokes along the motion direction, with alpha by speed.
- **Glow** on what is hot or charged: `glow()` sprites, additive, never `shadowBlur` on many shapes.
- **Slow motion as a device:** a counter in milliseconds while the camera follows something too fast to see.
- **Anticipation:** before a big move, pull back a little (a 0.15 s wind-up), then release.

## A character

An original, simple character gives the viewer someone to watch: a cursor with googly eyes, a small astronaut, a drop of water. Build it from a few rounded shapes and two eyes.
- It reacts: it hops, stomps the button, flinches at the hit, and puts on sunglasses at the punchline.
- Its eyes look at what matters: offset the pupils toward the focus point, blink every ~3 s, and squash on landing (`kick`).
- Keep it original; never use a known character or mascot.

## Metaphors that move

Turn the abstract into an object that does something, and keep the numbers real:
- probabilities become a wheel that spins and lands, with slices that are the real fractions;
- computation becomes a grid that lights up row by row;
- time becomes a countdown clock;
- scale becomes a zoom out through powers of ten.

## Looks that suit the pace

Flat and bold reads fastest on a phone. Two looks that work:
- a paper background, black ink and one accent colour;
- a deep-space gradient with flat shapes and soft glows.

Detailed textures still work, but with fewer, larger elements and less text.

## Shot list (the storyboard for this pace)

| t | words | shot | transition in | event on the cue | sound |
|---|---|---|---|---|---|
| 0.0 | "You just hit send." | phone, typing | — | the character stomps SEND; `stamp` "SEND" | `click`, `impact` |
| 0.9 | "Your words become tokens," | zoom into the bubble: the words split | in | words break into pills | `swish` ×6 |

Check it before building:
- 20 or more shots for 30 s;
- an event on every cue, and no more than 1.5 s between events;
- one continuous ride or a character carrying it;
- 2–4 impact moments;
- the climax between halfway and two-thirds of the way in.
