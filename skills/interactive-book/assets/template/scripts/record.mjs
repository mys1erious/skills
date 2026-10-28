#!/usr/bin/env node
// Records one page turn and the lesson's intro tour, frame by frame on a paused clock, so the clip is a smooth 30 fps
// however slow the render is. The toolbar is hidden and the captions enlarged so they read on a phone.
// Writes JPEG frames, a list of the frame where each caption starts (for cutting), and with --mp4 an H.264 file.
//
// usage: node scripts/record.mjs <url> <outDir> --from 1 --to 2 --seconds 25 [--fps 30] [--size 1280x720] [--scale 1.5] [--mp4 clip.mp4]
//   --from and --to are spreads (1 is the title and contents); --from = --to records the spread without turning
import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const opts = { _: [] };
for (let i = 2, v = process.argv; i < v.length; i++) {
  if (!v[i].startsWith('--')) opts._.push(v[i]);
  else opts[v[i].slice(2)] = v[i + 1] === undefined || v[i + 1].startsWith('--') ? true : v[++i];
}
const [url, outArg] = opts._;
if (!url || !outArg || !opts.from || !opts.seconds) {
  console.error('usage: node scripts/record.mjs <url> <outDir> --from K --to K --seconds N [--fps 30] [--size WxH] [--scale n] [--mp4 out.mp4]');
  process.exit(2);
}
const out = resolve(outArg);
const fps = Number(opts.fps ?? 30), from = Number(opts.from), to = Number(opts.to ?? opts.from);
const [W, H] = String(opts.size ?? '1280x720').split('x').map(Number);
mkdirSync(out, { recursive: true });

const browser = await chromium.launch({ args: process.platform === 'darwin' ? ['--use-angle=metal', '--enable-gpu'] : ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: Number(opts.scale ?? 1.5) });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.clock.install();
// no ?nowatch: a fresh browser profile is a first-time reader, so the intro tour plays on arrival
await page.goto(`${url}${url.includes('?') ? '&' : '?'}k=${from}`);
await page.addStyleTag({ content: '.capsule, .tip, .caption .skip, .caption .dots { display: none !important; } .caption { font-size: 27px !important; padding: 14px 26px !important; }' });
for (let i = 0; i < 600 && !(await page.evaluate(() => window.__ready)); i++) await page.clock.runFor(50);
if (!(await page.evaluate(() => window.__ready))) throw new Error('the book never became ready');
await page.waitForTimeout(900); // the loader's CSS fade runs on real time
await page.clock.pauseAt((await page.evaluate(() => Date.now())) + 100); // an installed clock follows real time until paused

const captions = [];
let n = 0;
const t0 = Date.now();
const frame = async () => {
  await page.clock.runFor(1000 / fps);
  await page.screenshot({ path: join(out, `${String(n++).padStart(5, '0')}.jpg`), type: 'jpeg', quality: 92 });
  captions.push(await page.evaluate(() => { const c = document.querySelector('.caption'); return c.hidden ? '' : c.textContent; }));
};
for (let i = 0; i < fps * 0.8; i++) await frame(); // a beat on the open book before the turn
if (to !== from) await page.evaluate((k) => { window.__book.goTo(k); }, to);
while (n < fps * Number(opts.seconds)) await frame();
await browser.close();

const starts = captions.map((c, i) => (c !== captions[i - 1] ? `${i}\t${c || '(no caption)'}` : null)).filter(Boolean);
writeFileSync(join(out, 'captions.txt'), `${starts.join('\n')}\n`);
console.log(`${n} frames in ${((Date.now() - t0) / 1000).toFixed(0)} s; caption starts (frame, text):\n${starts.join('\n')}`);

if (opts.mp4) {
  const r = spawnSync('ffmpeg', ['-loglevel', 'error', '-y', '-framerate', String(fps), '-i', join(out, '%05d.jpg'),
    '-vf', 'pad=ceil(iw/2)*2:ceil(ih/2)*2', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '18', '-movflags', '+faststart', resolve(opts.mp4)], { stdio: 'inherit' });
  if (r.error) console.error(`ffmpeg not found: the frames are in ${out}; encode them at ${fps} fps with any tool`);
  else if (r.status === 0) console.log(`-> ${resolve(opts.mp4)}`);
  else process.exitCode = 1;
}
if (errors.length) { console.error('page errors:', errors); process.exitCode = 1; }
