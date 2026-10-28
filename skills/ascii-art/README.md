# ascii-art

Builds ASCII art that looks designed: animated and interactive canvas pieces, image, logo and text to ASCII, plain-text art, and loopable videos for X. Tests what it builds in headless Chrome.

![An ASCII jellyfish drifting through the deep sea, built by an agent from a one-line prompt with the ascii-art skill](../../docs/ascii-art.gif)

The GIF above came from one prompt to a fresh agent that had only this skill:

> make me an interactive ASCII animation of a jellyfish drifting through the deep sea — something I can post on X and that people can also play with in the browser

It built:
- a page where the jellyfish swims toward your cursor, and holding and releasing makes it gather light and strike;
- a seamless 12-second 4:5 video for X.

It also checked its own work in headless Chrome. Six rounds of screenshots caught five visual faults, and it fixed them before reporting. What it found hard went back into the skill.

## Ask it for things like

- "Turn our logo into an ASCII hero background that reacts to the mouse."
- "Render this photo as ASCII and give me the plain text for the README."
- "Make a 12-second loop of an ASCII eye opening, with 3 styles to compare."
- "Make the login page background an ASCII field in our brand colours."
- "Export that piece as a 4:5 MP4 for X."

## What's inside

- **A workflow** in [`SKILL.md`](SKILL.md): brief, source, composition rules, interaction, the conventions every piece keeps, how to check it, export.
- **A starter piece** ([`assets/starter.html`](assets/starter.html)): one HTML file with no dependencies. It has a cell-buffer renderer, style presets, a fixed-step timeline that loops seamlessly, `?t=` stills, `?hold` to play with one moment, `?clean` capture mode, `R` to record and `T` for plain text.
- **[`scripts/shoot.mjs`](scripts/shoot.mjs):**
  - headless screenshots at timeline moments;
  - scripted mouse and keyboard actions to test interaction;
  - contact sheets;
  - page-error checks.
- **[`scripts/render.mjs`](scripts/render.mjs):** renders frame by frame on a virtual clock, so the video is perfectly smooth. It then makes an MP4 with ffmpeg and reports whether the loop's seam shows.
- **References** the agent reads when it needs them:
  - [`rendering.md`](references/rendering.md): the engine;
  - [`recipes.md`](references/recipes.md): fire, lightning, rain, flocks, warps, image and text to ASCII;
  - [`interaction.md`](references/interaction.md): follow, gaze, hold-and-release, gestures;
  - [`video.md`](references/video.md): sizes for X, sound, editing.

## Requirements

A modern browser. The scripts need Node 22+ and Chrome, Chromium or Edge; MP4 export also needs ffmpeg. No npm packages.

## What it sends where

Nothing leaves your machine. The pieces it builds load no external resources. The scripts start a local headless browser with a temporary profile, then delete the profile.

## Install

```bash
npx skills add mys1erious/skills --skill ascii-art
```

Or in Claude Code: `/plugin marketplace add mys1erious/skills`, then `/plugin install ascii-art@mys1erious`. Other agents and manual copy: see [Install](../../README.md#install).
