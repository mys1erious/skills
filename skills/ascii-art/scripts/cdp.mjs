// A small Chrome DevTools Protocol driver for shoot.mjs and render.mjs: headless Chrome, Chromium or Edge,
// no npm packages (Node 22+ has fetch and WebSocket built in). Set CHROME=/path/to/browser to pick one.
import { spawn, execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export const sleep = ms => new Promise(r => setTimeout(r, ms));

export function parseArgs(argv) { // positional args, then --flag value pairs (a flag with no value is true)
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    if (!argv[i].startsWith('--')) { out._.push(argv[i]); continue; }
    const key = argv[i].slice(2), next = argv[i + 1];
    out[key] = next === undefined || next.startsWith('--') ? true : (i++, next);
  }
  return out;
}

export const parseSize = (v, fallback) => { const [w, h] = String(v || fallback).split('x').map(Number); return { width: w, height: h }; };

export function findChrome() {
  if (process.env.CHROME) return process.env.CHROME;
  const paths = [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
    `${process.env.PROGRAMFILES}\\Google\\Chrome\\Application\\chrome.exe`,
    `${process.env['PROGRAMFILES(X86)']}\\Google\\Chrome\\Application\\chrome.exe`,
    `${process.env.LOCALAPPDATA}\\Google\\Chrome\\Application\\chrome.exe`,
  ];
  for (const p of paths) if (existsSync(p)) return p;
  for (const name of ['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser', 'microsoft-edge']) {
    try { return execFileSync(process.platform === 'win32' ? 'where' : 'which', [name], { encoding: 'utf8' }).split('\n')[0].trim(); } catch { /* try the next name */ }
  }
  throw new Error('Chrome or Chromium not found. Set CHROME=/path/to/chrome');
}

export async function launch({ width = 1440, height = 900, scale = 1 } = {}) {
  const profile = mkdtempSync(join(tmpdir(), 'ascii-cdp-'));
  const chrome = spawn(findChrome(), [
    '--headless=new', '--remote-debugging-port=0', `--user-data-dir=${profile}`, `--window-size=${width},${height}`,
    '--hide-scrollbars', '--no-first-run', '--no-default-browser-check', '--mute-audio', 'about:blank',
  ], { stdio: 'ignore' });
  let port;
  for (let i = 0; i < 150 && !port; i++) { // port 0: Chrome picks a free port and writes it here
    try { port = readFileSync(join(profile, 'DevToolsActivePort'), 'utf8').split('\n')[0]; } catch { await sleep(100); }
  }
  if (!port) { chrome.kill(); throw new Error('Chrome did not start'); }
  const target = (await (await fetch(`http://127.0.0.1:${port}/json`)).json()).find(t => t.type === 'page');
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });

  let id = 0;
  const pending = new Map(), waiters = [], errors = [];
  ws.onmessage = ev => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) {
      const p = pending.get(m.id); pending.delete(m.id);
      m.error ? p.rej(new Error(`${p.method}: ${m.error.message}`)) : p.res(m.result);
      return;
    }
    if (m.method === 'Runtime.exceptionThrown') { const d = m.params.exceptionDetails; errors.push(d.exception?.description || d.text); }
    if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') errors.push(m.params.args.map(a => a.value ?? a.description).join(' '));
    if (m.method === 'Log.entryAdded' && m.params.entry.level === 'error' && !/\/favicon\.ico$/.test(m.params.entry.url || '')) errors.push(`${m.params.entry.text} ${m.params.entry.url || ''}`.trim()); // a missing favicon is not the piece's fault
    for (let i = waiters.length - 1; i >= 0; i--) if (waiters[i].method === m.method) { waiters[i].res(m.params); waiters.splice(i, 1); }
  };
  const send = (method, params = {}) => new Promise((res, rej) => { const i = ++id; pending.set(i, { res, rej, method }); ws.send(JSON.stringify({ id: i, method, params })); });
  const once = (method, ms = 20000) => new Promise((res, rej) => {
    const w = { method, res }; waiters.push(w);
    setTimeout(() => { const i = waiters.indexOf(w); if (i >= 0) { waiters.splice(i, 1); rej(new Error(`timed out waiting for ${method}`)); } }, ms);
  });

  await send('Page.enable'); await send('Runtime.enable'); await send('Log.enable');
  const resize = (w, h, s = scale) => send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: s, mobile: false });
  await resize(width, height);

  return {
    send, errors, resize,
    async goto(url) { const loaded = once('Page.loadEventFired'); await send('Page.navigate', { url }); await loaded; },
    async shot(path) { const r = await send('Page.captureScreenshot', { format: 'png' }); writeFileSync(path, Buffer.from(r.data, 'base64')); },
    async evaluate(expression) {
      const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
      if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
      return r.result.value;
    },
    async close() {
      ws.close();
      const exited = new Promise(r => chrome.once('exit', r));
      chrome.kill();
      await Promise.race([exited, sleep(3000)]);
      try { rmSync(profile, { recursive: true, force: true }); } catch { /* Chrome may still hold a file; it's in the temp dir */ }
    },
  };
}
