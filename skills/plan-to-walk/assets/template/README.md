# Plan to walk · Villa La Rotonda

A scroll-driven page. Palladio's Villa La Rotonda opens as an ink floor plan, and the plan is not a picture: it is the 3D model cut by a clipping plane 1.2 m above the piano nobile floor, seen from straight above through a 1.6° lens (black wall cuts are stencil caps, ink lines are edges found in the depth/normal buffers). Scroll and the cut rises, so the walls grow.

The rest of the page:
- **The money shot.** The camera holds outside on a three-quarter view in low late sun while the materials sweep across the villa, from ink on the left to stone, white columns and terracotta on the right.
- **The walk.** Up the portico stair, through the hall (with a glance into a sunlit side room), into the rotunda as the materials sweep over it, a look up at the oculus, then out along the far axis to the opposite portico and the landscape.
- **Rooms worth walking into.** Patterned floors (terrazzo, a radial marble floor in the rotunda), door and window frames, baseboards, cornices, beamed ceilings, sun shafts from the windows, a rotunda with painted walls, a coffered dome and light from the lantern.
- **Your own plan.** The "your own plan" button opens a panel: type rooms and sizes, press "Build and walk", and the same sheet, rise, sweep and walk play for that layout. Two presets: La Rotonda and a two-bedroom flat.

- Live: https://mys1erious.github.io/3d-plan-to-walk/
- URL flags: `?play` plays the walk on its own (no scrolling), `?clean` hides the UI, `?t=8.6` freezes one moment in seconds, `?p=0.5` freezes one point as a fraction, `?plan=flat` loads the flat preset (`?plan=<text>` loads any typed plan, which is what the panel writes to the address bar), `?phone` forces the light phone version.
- Idea from @SammmAing's post https://x.com/SammmAing/status/2109708195031900310. Their repo has no licence, so none of its code was read or used.
- Run locally: `python3 -m http.server 8000` in this folder, then open http://localhost:8000/.
- Stack: three.js 0.170.0, GSAP 3.13.0 + ScrollTrigger, Lenis 1.3.4 and Cormorant Garamond (Fontsource), all pinned on jsdelivr/unpkg. No build step. Phones load 512 px textures (`tex/512/`), a 1024 shadow map and smaller painted textures.
- Re-record: `node <plan-to-walk skill>/scripts/render.mjs "http://127.0.0.1:8000/?clean&play" frames --seconds 40 --fps 30 --size 1080x1350 --mp4 video/plan-to-walk.mp4`

## Your own plan
One room per line: `name W x D @ x, y`, where x, y is the top-left corner on the sheet. A round room is `name Ø D @ x, y` (its centre). Optional lines: `title`, `unit` (metres per unit, e.g. 0.357 for Vicentine feet), `height`, `wall`, `floor` (floor height above the ground). Sizes are between wall centres.

- Rooms that touch share a wall. Doors follow a tree grown from the first room (the entrance), with halls and living rooms branching first.
- Rooms named portico, loggia or porch get columns. Balconies and terraces get a railing. Round rooms get a dome with an oculus and a lantern. Leftover enclosed space becomes solid masonry.
- The walk visits every room in small plans (9 rooms or fewer) and peeks into dead-end rooms from the door. In bigger plans it goes entrance → round room → the farthest room.
- Floors are chosen by the room name: tiles in bathrooms, a checker in kitchens, a radial marble floor in round rooms, oak in bedrooms, living rooms and halls of metric plans, terrazzo elsewhere.
- Left unedited, the La Rotonda preset loads the detailed model. Edit one character and it goes through the same generic generator as any typed plan, so it is simpler (no pediments, vaults or stepped dome).
- Bad input shows an error and keeps the panel open. Limits: 1–30 rooms, each 0.8–80 m, within 80 m of 0, 0.

## Sources
- Andrea Palladio, *I Quattro Libri dell'Architettura* (Venice 1570), Book II, ch. III, plate of Villa Almerico (public domain). Scan: The Met, CC0, [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Villa_Almerico_(Villa_Rotunda),_from_I_quattro_libri_dell%27architettura_di_Andrea_Palladio_(Book_2,_page_19)_MET_DP109542.jpg).
- The plate's numbers as tabulated in H.-J. Park, "Parametric Variations of Palladio's Villa Rotonda", *Int. J. of Architectural Computing* 6(2), 2008, Table 1, after March 1998, Mitrović 1990/2004 and Semenzato 1968: rotunda Ø 30; rooms 26 × 15 and 15 × 11; halls 6 wide; porticoes 30 × 12; stairs 22 long; columns Ø 2 and 18 high; entablature 3.75; piano nobile 10 above the ground; central hall 55 high. Units are Vicentine feet (1 ft = 0.357 m).
- The room layout was checked against Ottavio Bertotti Scamozzi's 1778 survey plan (public domain, [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Palladio_Rotonda_planta_Scamozzi_1778.jpg)).
- Materials and light from Poly Haven (CC0): white_plaster_02, marble_01, clay_roof_tiles_02 and leafy_grass (1k JPG, recompressed; 512 px copies for phones), plus the HDRI qwantani_late_afternoon_puresky.

## Approximated (not from the sources)
- Wall thicknesses are not on the plate (1–2.5 ft here). The plate's numbers leave no room for the wall between the 15 and 11 rooms, so the 26 × 15 rooms come out 26 × 14. The outer block (66 ft, 23.6 m) and the 134 ft overall size are derived from these assumptions, not surveyed.
- The front and rear hall width is not given on the plate; it is drawn 6 ft, like the side halls.
- Door and window sizes and positions, the 22 treads, the simplified Ionic columns and the portico's outer width (33 ft against the plate's 30) are approximate.
- The roof pitch, drum, stepped dome, lantern and hall vaults are approximate, and the inner dome top sits at 55.5 ft.
- The room ceilings (flat at 19 ft, with a cornice and painted beams) are approximate. The real rooms have their own vaults and painted ceilings.
- **The dome coffers are our addition.** The real rotunda dome is painted, not coffered.
- **The rotunda wall paintings are procedural stand-ins** (painted landscape panels, garlands and dado), not copies of the villa's real frescoes.
- The floor patterns are invented: terrazzo in the halls and rooms, a radial marble floor in the rotunda whose rings follow the drawn rings at 4, 7.5 and 11.5 ft.
- The light shaft and pool of light under the oculus are an artistic effect. The sun shafts are a cheap additive effect, not real volumetric light.
- The sun is set 30° from the front-right and 15° high to rake the entrance portico. That is an artistic choice, not the villa's real orientation.
- The landscape is invented: the trees, the cypress avenue on the rear axis and the hills. The real villa stands on a small hill outside Vicenza.
- The spiral stairs are plan symbols only. The materials are generic CC0 stand-ins, not the villa's real finishes.
