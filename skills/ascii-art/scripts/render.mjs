#!/usr/bin/env node
// Renders an ASCII page frame by frame on a virtual clock: requestAnimationFrame and performance.now are replaced,
// so every frame is exactly 1/fps later however slow the capture is. The result is smoother than any screen
// recording. Then it encodes an MP4 with ffmpeg, if ffmpeg is installed. Picture only: see references/video.md for sound.
//
// usage: node render.mjs <url> <outDir> --seconds 10 [--fps 60] [--size 1600x900] [--scale 1.2] [--mp4 out.mp4] [--crf 16] [--keep-frames]
//
// The page must animate from rAF timestamps or performance.now only (not Date.now or setTimeout), and should be
// loaded with ?clean so no labels show; add &t=4.4&play to start the take later. Frame n shows timeline time (n + 1) / fps.
// With --mp4 it also prints how the last frame compares with the first (the loop seam) and deletes the frames
// unless --keep-frames.
import { mkdirSync, rmSync, rmdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { launch, parseArgs, parseSize, sleep } from './cdp.mjs';

const a = parseArgs(process.argv.slice(2));
const [url, outArg] = a._;
if (!url || !outArg || !a.seconds) { console.error('usage: node render.mjs <url> <outDir> --seconds N [--fps 60] [--size WxH] [--scale n] [--mp4 out.mp4] [--crf 16] [--keep-frames]'); process.exit(2); }
const out = resolve(outArg), fps = +(a.fps || 60), frames = Math.round(+a.seconds * fps);
mkdirSync(out, { recursive: true });
const { width, height } = parseSize(a.size, '1600x900');
const page = await launch({ width, height, scale: +(a.scale || 1) });

try {
  await page.send('Page.addScriptToEvaluateOnNewDocument', { source: `(() => {
    let vt = 0; const q = [];
    performance.now = () => vt;
    window.requestAnimationFrame = cb => q.push(cb);
    // +1e-6 ms keeps each frame's dt a hair above a 1/fps fixed step, so float error never skips a step
    window.__tick = ms => { vt += ms + 1e-6; for (const cb of q.splice(0)) cb(vt); };
  })();` });
  await page.goto(url); await sleep(500); // fonts and the first resize
  const t0 = Date.now();
  for (let n = 0; n < frames; n++) {
    await page.evaluate(`window.__tick(${1000 / fps})`);
    await page.shot(join(out, `${String(n).padStart(5, '0')}.png`));
    if (n % fps === fps - 1) console.log(`${n + 1}/${frames} frames, ${((Date.now() - t0) / 1000).toFixed(0)} s`);
  }
} finally {
  await page.close();
}
if (page.errors.length) console.error('page errors:', page.errors);

if (a.mp4) {
  const mp4 = resolve(a.mp4);
  const r = spawnSync('ffmpeg', ['-loglevel', 'error', '-y', '-framerate', String(fps), '-i', join(out, '%05d.png'),
    '-vf', 'pad=ceil(iw/2)*2:ceil(ih/2)*2,scale=out_color_matrix=bt709:out_range=tv,format=yuv420p',
    '-c:v', 'libx264', '-preset', 'slow', '-crf', String(a.crf || 16), '-tune', 'animation', '-profile:v', 'high',
    '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-movflags', '+faststart', mp4], { stdio: 'inherit' });
  if (r.error) console.error(`ffmpeg not found: the frames are in ${out}; encode them with any tool at ${fps} fps`);
  else if (r.status === 0) {
    console.log(`${frames} frames -> ${mp4}`);
    // the loop seam: if this take is one whole loop, last -> first should look like any two neighbouring frames
    const frame = n => join(out, `${String(n).padStart(5, '0')}.png`);
    const psnr = (x, y) => (spawnSync('ffmpeg', ['-i', frame(x), '-i', frame(y), '-lavfi', 'psnr', '-f', 'null', '-'], { encoding: 'utf8' }).stderr.match(/average:(\S+)/) || [])[1];
    const mid = Math.floor(frames / 2);
    if (frames > 2) console.log(`loop seam (last -> first): ${psnr(frames - 1, 0)} dB; neighbouring frames: ${psnr(mid, mid + 1)} dB. Higher is closer; a seam well below its neighbours shows as a jump.`);
    if (!a['keep-frames']) { // only the frames this run wrote, then the folder if that left it empty
      for (let n = 0; n < frames; n++) rmSync(frame(n), { force: true });
      try { rmdirSync(out); } catch { /* other files live there: keep it */ }
    }
  }
  else process.exitCode = 1;
}
process.exitCode ||= page.errors.length ? 1 : 0;
