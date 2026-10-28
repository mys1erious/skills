#!/usr/bin/env node
// Screenshots an ASCII page in headless Chrome so you can look at it: stills at timeline moments (the page must
// support ?t=), and scripted mouse and keyboard actions to test interaction. Prints page errors; exits 1 if any.
//
// usage: node shoot.mjs <url> <outDir> [--size 1440x900] [--scale 1] [--times 0.5,3,5.2]
//                       [--actions "glide 20%,40%; shot left; down; wait 900; up; wait 250; shot wave"] [--sheet]
//
// actions, separated by ";" (x,y in CSS px or % of the viewport):
//   move x,y · glide x,y [ms] · down · up · click x,y · wheel dy · key K (a character, Space, Enter, Escape, ArrowLeft…)
//   wait ms · shot name (name.png) · text name (window.ascii.text() saved as name.txt, if the page provides it)
import { mkdirSync, writeFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { launch, parseArgs, parseSize, sleep } from './cdp.mjs';

const a = parseArgs(process.argv.slice(2));
const [url, outArg] = a._;
if (!url || !outArg) { console.error('usage: node shoot.mjs <url> <outDir> [--size WxH] [--scale n] [--times t1,t2] [--actions "..."] [--sheet]'); process.exit(2); }
const out = resolve(outArg);
mkdirSync(out, { recursive: true });
const { width, height } = parseSize(a.size, '1440x900');
const page = await launch({ width, height, scale: +(a.scale || 1) });
const shots = [];
const shoot = async name => { const p = join(out, `${name}.png`); await page.shot(p); shots.push(p); };

try {
  if (a.times) for (const t of String(a.times).split(',')) { // one load per moment: sequential, never parallel (parallel headless captures can come out black)
    const u = new URL(url); u.searchParams.set('t', t.trim());
    await page.goto(u.href); await sleep(500);
    await shoot(`t-${t.trim()}`);
  }

  if (a.actions) {
    await page.goto(url); await sleep(800);
    const cur = { x: width / 2, y: height / 2 }; let down = false;
    const xy = s => s.split(',').map((v, i) => v.trim().endsWith('%') ? parseFloat(v) / 100 * (i ? height : width) : +v);
    const mouse = (type, x, y, extra = {}) => page.send('Input.dispatchMouseEvent', { type, x, y, button: down || type !== 'mouseMoved' ? 'left' : 'none', buttons: down ? 1 : 0, clickCount: 1, ...extra });
    const KEYS = { Space: [' ', 'Space', 32], Enter: ['Enter', 'Enter', 13], Escape: ['Escape', 'Escape', 27], Tab: ['Tab', 'Tab', 9],
      ArrowLeft: ['ArrowLeft', 'ArrowLeft', 37], ArrowUp: ['ArrowUp', 'ArrowUp', 38], ArrowRight: ['ArrowRight', 'ArrowRight', 39], ArrowDown: ['ArrowDown', 'ArrowDown', 40] };
    for (const raw of String(a.actions).split(';').map(s => s.trim()).filter(Boolean)) {
      const [cmd, ...rest] = raw.split(/\s+/), arg = rest.join(' ');
      if (cmd === 'wait') await sleep(+arg);
      else if (cmd === 'move') { [cur.x, cur.y] = xy(arg); await mouse('mouseMoved', cur.x, cur.y); }
      else if (cmd === 'glide') {
        const [to, ms = 300] = [xy(rest[0]), +rest[1] || 300], [fx, fy] = [cur.x, cur.y], n = Math.max(2, Math.round(ms / 16));
        for (let i = 1; i <= n; i++) { cur.x = fx + (to[0] - fx) * i / n; cur.y = fy + (to[1] - fy) * i / n; await mouse('mouseMoved', cur.x, cur.y); await sleep(16); }
      }
      else if (cmd === 'down') { down = true; await mouse('mousePressed', cur.x, cur.y); }
      else if (cmd === 'up') { await mouse('mouseReleased', cur.x, cur.y); down = false; }
      else if (cmd === 'click') { [cur.x, cur.y] = xy(arg); await mouse('mouseMoved', cur.x, cur.y); down = true; await mouse('mousePressed', cur.x, cur.y); await sleep(60); await mouse('mouseReleased', cur.x, cur.y); down = false; }
      else if (cmd === 'wheel') await mouse('mouseWheel', cur.x, cur.y, { deltaX: 0, deltaY: +arg });
      else if (cmd === 'key') {
        const [key, code, vk] = KEYS[arg] || [arg, arg.length === 1 ? (/[a-z]/i.test(arg) ? `Key${arg.toUpperCase()}` : /\d/.test(arg) ? `Digit${arg}` : '') : arg, arg.length === 1 ? arg.toUpperCase().charCodeAt(0) : 0];
        const text = key.length === 1 ? key : key === 'Enter' ? '\r' : undefined;
        await page.send('Input.dispatchKeyEvent', { type: 'keyDown', key, code, windowsVirtualKeyCode: vk, text });
        await page.send('Input.dispatchKeyEvent', { type: 'keyUp', key, code, windowsVirtualKeyCode: vk });
      }
      else if (cmd === 'shot') await shoot(arg);
      else if (cmd === 'text') {
        const txt = await page.evaluate('window.ascii && typeof window.ascii.text === "function" ? window.ascii.text() : null');
        if (txt == null) page.errors.push('text: the page has no window.ascii.text()');
        else writeFileSync(join(out, `${arg}.txt`), txt);
      }
      else throw new Error(`unknown action: ${raw}`);
    }
  }

  if (a.sheet && shots.length) { // a contact sheet of this run's shots, laid out by Chrome itself
    const cols = Math.min(3, shots.length), tw = 600, th = Math.round(tw * height / width), sw = cols * tw + (cols + 1) * 12;
    const sh = Math.ceil(shots.length / cols) * (th + 34) + 12;
    const html = `<body style="margin:0;background:#202020;font:13px ui-monospace,Menlo,monospace;color:#ccc;display:grid;grid-template-columns:repeat(${cols},${tw}px);gap:12px;padding:12px">`
      + shots.map(p => `<figure style="margin:0"><img src="${pathToFileURL(p).href}" width="${tw}" height="${th}" style="display:block"><figcaption style="padding-top:4px">${p.split(/[\\/]/).pop()}</figcaption></figure>`).join('') + '</body>';
    writeFileSync(join(out, 'sheet.html'), html);
    await page.resize(sw, sh, 1);
    await page.goto(pathToFileURL(join(out, 'sheet.html')).href); await sleep(300);
    await page.shot(join(out, 'sheet.png'));
  }
} finally {
  await page.close();
}

console.log(JSON.stringify({ out, shots: shots.map(p => p.split(/[\\/]/).pop()), files: readdirSync(out).length, errors: page.errors }, null, 1));
process.exitCode = page.errors.length ? 1 : 0;
