#!/usr/bin/env node
// Screenshots the book so you can look at it: each spread in its reading view once the figure has lifted; with
// --tour one frame per intro shot of each lesson (1.5 s after its caption appears); with --act "<js>" six frames
// while that action animates (the tests run with motion off, so collisions on the way only show here).
// Runs on a paused clock, so the frames are the same on every run. Writes a contact sheet per kind.
// Prints each page error once; exits 1 if any.
//
// usage: node scripts/shoot.mjs [url] [outDir] [--spreads 1-4] [--tour] [--act "window.__book.actions.press('step')"]
//                               [--size 1280x720] [--scale 1.5] [--query "&tier=low"]
//   url defaults to the dev server (npm run dev), outDir to shots/
import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

// positional args, then --flag value pairs (a flag followed by another flag or nothing is true)
const opts = { _: [] };
for (let i = 2, v = process.argv; i < v.length; i++) {
  if (!v[i].startsWith('--')) opts._.push(v[i]);
  else opts[v[i].slice(2)] = v[i + 1] === undefined || v[i + 1].startsWith('--') ? true : v[++i];
}
const flag = (name, fallback) => opts[name] ?? fallback;
const url = opts._[0] ?? 'http://127.0.0.1:5199/';
const out = resolve(opts._[1] ?? 'shots');
const [W, H] = String(flag('size', '1280x720')).split('x').map(Number);
const scale = Number(flag('scale', 1.5));
const query = flag('query', '');
mkdirSync(out, { recursive: true });

// headless Chromium on macOS can use the Metal GPU (fast); elsewhere SwiftShader gives software WebGL (slow but the same everywhere)
const browser = await chromium.launch({ args: process.platform === 'darwin' ? ['--use-angle=metal', '--enable-gpu'] : ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const errors = new Set(); // the same problem is reported on every redraw: keep one of each

async function openAt(k, extra) {
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: scale });
  page.on('pageerror', (e) => errors.add(`(opened at spread ${k}) ${e.message}`));
  page.on('console', (m) => m.type() === 'error' && errors.add(`(opened at spread ${k}) ${m.text()}`));
  await page.clock.install();
  await page.goto(`${url}?k=${k}${extra}${query}`);
  for (let i = 0; i < 600 && !(await page.evaluate(() => window.__ready)); i++) await page.clock.runFor(50);
  if (!(await page.evaluate(() => window.__ready))) throw new Error(`spread ${k}: the book never became ready`);
  await page.waitForTimeout(900); // the loader's CSS fade runs on real time
  await page.clock.pauseAt((await page.evaluate(() => Date.now())) + 100); // an installed clock follows real time until paused
  return page;
}
const frames = async (page, n) => { for (let i = 0; i < n; i++) await page.clock.runFor(1000 / 30); };

const probe = await openAt(1, '&nowatch');
const book = await probe.evaluate(() => ({ last: window.__book.LAST_SPREAD, lessons: window.__book.spreads.map((s, i) => (s.kind === 'lesson' ? i + 1 : 0)).filter(Boolean) }));
await probe.close();
const [a, b] = String(flag('spreads', `1-${book.last}`)).split('-').map(Number);
const spreads = Array.from({ length: (b || a) - a + 1 }, (_, i) => a + i);

const reading = [];
for (const k of spreads) {
  const page = await openAt(k, '&nowatch');
  await frames(page, 45); // figure lift, page fade-ins, settling animations
  const p = join(out, `spread-${String(k).padStart(2, '0')}.png`);
  await page.screenshot({ path: p });
  reading.push(p);
  await page.close();
}

const tours = [];
if (flag('tour', false)) for (const k of spreads.filter((k) => book.lessons.includes(k))) {
  // arrive by turning from the spread before, so the intro tour plays as a first-time reader sees it
  // (no &nowatch: the tour plays on a turn, never on the spread the page loads at)
  const page = await openAt(k - 1, '');
  await page.evaluate((k) => { window.__book.goTo(k); }, k);
  let last = '', since = 0, n = 0;
  for (let f = 0; f < 30 * 40 && n < 5; f++) {
    await frames(page, 1);
    const cap = await page.evaluate(() => { const c = document.querySelector('.caption'); return c.hidden ? '' : c.textContent; });
    if (cap !== last) { last = cap; since = 0; }
    if (cap && ++since === 45) {
      const p = join(out, `tour-${String(k).padStart(2, '0')}-${++n}.png`);
      await page.screenshot({ path: p });
      tours.push(p);
    }
  }
  if (n < 5) errors.add(`spread ${k}: the intro tour showed ${n} captioned shots, not 5`);
  await page.close();
}

const motion = [];
if (typeof flag('act') === 'string') for (const k of spreads.filter((k) => book.lessons.includes(k))) {
  const page = await openAt(k, '&nowatch');
  await frames(page, 45);
  // run it without waiting: its promise resolves only as the paused clock advances, and the frames below advance it
  await page.evaluate((code) => { (0, eval)(code); }, flag('act'));
  for (const [i, f] of [0, 4, 4, 5, 5, 9].entries()) { // 0, 0.13, 0.27, 0.43, 0.6, 0.9 s
    await frames(page, f);
    const p = join(out, `motion-${String(k).padStart(2, '0')}-${i + 1}.png`);
    await page.screenshot({ path: p });
    motion.push(p);
  }
  await page.close();
}

// contact sheets, laid out by the browser itself
async function sheet(list, name, cols) {
  if (!list.length) return;
  const tw = 640, th = Math.round((tw * H) / W);
  const html = `<body style="margin:0;background:#202020;font:13px ui-monospace,Menlo,monospace;color:#ccc;display:grid;grid-template-columns:repeat(${cols},${tw}px);gap:10px;padding:10px">`
    + list.map((p) => `<figure style="margin:0"><img src="${pathToFileURL(p).href}" width="${tw}" height="${th}" style="display:block"><figcaption>${p.split(/[\\/]/).pop()}</figcaption></figure>`).join('') + '</body>';
  const file = join(out, `${name}.html`);
  writeFileSync(file, html);
  const page = await browser.newPage({ viewport: { width: cols * tw + (cols + 1) * 10, height: Math.ceil(list.length / cols) * (th + 30) + 10 } });
  await page.goto(pathToFileURL(file).href);
  await page.waitForLoadState('load');
  await page.screenshot({ path: join(out, `${name}.png`), fullPage: true });
  await page.close();
}
await sheet(reading, 'sheet-spreads', 2);
await sheet(tours, 'sheet-tours', 5);
await sheet(motion, 'sheet-motion', 6);
await browser.close();

const sheets = [['sheet-spreads.png', reading], ['sheet-tours.png', tours], ['sheet-motion.png', motion]].filter(([, l]) => l.length).map(([n]) => n);
console.log(JSON.stringify({ out, spreads: reading.length, tourFrames: tours.length, motionFrames: motion.length, sheets, errors: [...errors] }, null, 1));
process.exitCode = errors.size ? 1 : 0;
