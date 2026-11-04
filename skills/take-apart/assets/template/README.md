# Voyager 1, taken apart

Voyager 1 drawn in three.js at real scale, in metres, and taken apart piece by piece into a labelled exploded view: the high-gain antenna, the ten-sided bus and its bays, the hydrazine tank and thrusters, the three RTGs, the science boom and its instruments, the 13 m magnetometer boom, the two 10 m antennas and the Golden Record. It ends on what still works in November 2026. Tap or click any part to see what it does and what it does today, with links to the sources. It is a companion to [One light-day](https://mys1erious.github.io/viz-one-light-day/) and shares its look.

Reference post: https://x.com/0x_fokki/status/2116289885870981296 (an interactive robot-octopus teardown). Only the format is borrowed; the subject and code are ours.

**Open:** serve this folder (`python3 -m http.server`) and load `index.html`. It plays on its own; drag to turn, scroll to zoom, ‹ › to step between parts, Space to pause. `?t=23` opens frozen at 23 s, `?clean` hides the controls and `?play` runs the 44 s self-play for the recorder.

**Re-record:** `node <take-apart skill>/scripts/render.mjs "http://127.0.0.1:8000/?clean&play" frames --seconds 44 --fps 30 --size 1080x1350 --mp4 video/voyager-teardown.mp4`

## Every number, with its source

| Part | Number on the page | Source |
|---|---|---|
| Launch | 5 Sep 1977 | [NASA: Voyager 1][v1] |
| High-gain antenna | 3.66 m dish (NASA rounds it to 3.7 m); aluminium honeycomb, graphite-epoxy skins; X-band feed; subreflector on a three-legged truss; S-band horn doubles as the low-gain antenna | [NASA Backgrounder 1980][bg80], [NASA: spacecraft][sc] |
| Radio | Uplink S-band at 16 bit/s; downlink X-band near 8.4 GHz, normally 160 bit/s | [NASA: spacecraft][sc] |
| Bus | 10 sides, 47 cm high, 178 cm across the flats; 24.5 kg frame (29.5 kg in the 1977 kit); bays numbered 1 to 10 clockwise seen from Earth | [Backgrounder][bg80], [1977 kit][kit77], [NASA: spacecraft][sc] |
| Bays | Bay 1 holds the radio transmitters; four louvered bays hold power conditioning and radio power amplifiers (the 1977 kit adds HYPACE and the tape recorder); magnetometer electronics sit in a bay | [NASA: spacecraft][sc], [Backgrounder][bg80], [1977 kit][kit77] |
| Computers | Six (CCS, FDS, AACS, two of each), about 32K words in all | [NASA FAQ][faq] |
| Star trackers | Two Canopus trackers side by side atop the bus | [Backgrounder][bg80] |
| Hydrazine tank | 71 cm titanium sphere in the bus's central cavity; 104 kg of hydrazine at launch (the pre-launch kit says 105 kg) | [Backgrounder][bg80], [1977 kit][kit77] |
| Thrusters | 16 of 0.889 N on the mission module: 4 for trajectory corrections, 12 in two six-thruster branches | [Backgrounder][bg80] |
| Shunt radiator | 0.37 m² | [1977 kit][kit77] |
| RTGs | Three MHW-RTGs, 40.6 cm × 51 cm, 39 kg each, beryllium case; about 158 W each at launch | [Backgrounder][bg80], [NASA: Voyager 1][v1] |
| RTG power | About 470 W at launch; 225 W as of 2023; about 4 W less each year | [NSSDCA][nssdc], [NASA: spacecraft][sc], [NASA FAQ][faq], [NASA blog Apr 2026][apr26] |
| RTG boom | 3.7 m, steel and titanium | [NASA FAQ][faq], [Backgrounder][bg80] |
| Science boom | 2.3 m of graphite epoxy, 180° from the RTGs; CRS and LECP at mid-point, PLS farther out, scan platform (UVS, IRIS, PPS, two cameras) at the end, 103 kg gimballed. NASA's FAQ says 3 m and NSSDCA about 2.5 m; the page uses 2.3 m. | [Backgrounder][bg80], [NASA FAQ][faq], [NSSDCA][nssdc] |
| Magnetometer boom | 13 m epoxy-glass mast, 2.26 kg; low-field sensors at the tip and 6 m closer; canister 22.8 cm × 66 cm on the RTG outrigger | [Backgrounder][bg80] |
| Plasma-wave / radio-astronomy antennas | Two 10 m beryllium-copper whips at a right angle; PWS covers 10 Hz to 56 kHz | [Backgrounder][bg80], [NASA FAQ][faq], [NASA: spacecraft][sc] |
| Golden Record | 30 cm gold-plated copper; 115 images, greetings in 55 languages, 35 sounds, 90 minutes of music; on one side of the bus; cover says play from the outside in, carries about 0.00026 µCi of uranium-238 | [NASA: Voyager 1][v1], [NSSDCA][nssdc], [NASA: record cover][cover] |
| Mass | 815 kg at launch with hydrazine; about 733 kg now | [NASA FAQ][faq] |
| What still works | MAG and PWS on. Off: LECP 17 Apr 2026 (its 0.5 W motor stays on), CRS 25 Feb 2025, UVS 19 Apr 2016, PRA 15 Jan 2008, PLS 1 Feb 2007 (degraded), IRIS 3 Jun 1998, ISS cameras 14 Feb 1990, PPS 29 Jan 1980 (degraded) | [NASA: spacecraft][sc], [NASA blog Apr 2026][apr26] |
| Recent events | Sept 2026: three devices swapped for lower-power ones. 18–19 Oct 2026: contact pause, one thruster group went offline and backups turned on; contact back on 20 Oct | [NASA blog Oct 2026][oct26] |
| Distance | 25.89 billion km on 18 Nov 2026, one light-day | [NASA blog Oct 2026][oct26] |
| Instrument descriptions | One line each (CRS, LECP, PLS, ISS, IRIS, UVS, PPS, MAG) | [NASA: spacecraft][sc] |

## Approximations (drawn, not measured)

- Boom and antenna directions: the RTG boom dips 6°, the magnetometer boom points 35° off the RTG boom and 10° up, the two antennas are 87.8° apart. All are read from NASA diagrams and descriptions, not measured. The lengths are exact.
- Which bay holds what. NASA says bay 1 holds the radio and four bays have louvers, but not where they sit relative to the booms. Which face carries the Golden Record is also illustrative.
- Thruster positions, the shape and size of every instrument except the 0.2 m PPS telescope, RTG fins, the subreflector's size and the dish's depth, the truss layouts, the star-tracker shades and the adapter below the bus.
- Surface finishes. NASA describes a white dish, mostly black blankets and a few gold-foil and polished-aluminium areas; the rest is our choice.
- The exploded offsets and the camera are staging. The jettisoned propulsion module is not drawn.
- The console self-check `window.__dims` prints the drawn lengths: dish 3.66, bus 1.78 × 0.47, booms 3.7 / 2.3 / 13, antennas 10 and 10.

[bg80]: https://ntrs.nasa.gov/citations/19810001583
[kit77]: https://planetary.s3.amazonaws.com/assets/presskit/voyager-launch.pdf
[sc]: https://science.nasa.gov/mission/voyager/spacecraft/
[faq]: https://science.nasa.gov/mission/voyager/frequently-asked-questions/
[v1]: https://science.nasa.gov/mission/voyager/voyager-1/
[nssdc]: https://nssdc.gsfc.nasa.gov/nmc/spacecraft/display.action?id=1977-084A
[apr26]: https://science.nasa.gov/blogs/voyager/2026/04/17/nasa-shuts-off-instrument-on-voyager-1-to-keep-spacecraft-operating/
[oct26]: https://science.nasa.gov/blogs/voyager/2026/10/29/nasas-voyager-1-conserves-power-resolves-brief-communications-pause/
[cover]: https://science.nasa.gov/mission/voyager/golden-record-cover/

Sources: NASA Voyager Backgrounder (Oct 1980, NTRS) and NASA's 1977 launch press kit (a copy hosted by The Planetary Society), NASA Science's Voyager pages and blog, NSSDCA. Stars are procedural. three.js 0.170.0 from jsdelivr.
