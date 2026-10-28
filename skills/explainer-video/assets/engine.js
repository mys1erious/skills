"use strict";
// explainer-video engine. Every frame is a pure function of time: seek(t) draws frame t, so scripts/render.py can step
// through the video frame by frame and the result never drops or stutters, however slow a frame is to draw.
// A page: <canvas id="out" width="1080" height="1920">, <script src="engine.js">, then start({init, draw, ...}).
const out = document.getElementById('out'), octx = out.getContext('2d');
const W = out.width, H = out.height, FPS = 30, TAU = Math.PI * 2;
const mk = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
const scene = mk(W, H);
let ctx = scene.getContext('2d'); // draw everything with ctx; swap it temporarily to draw a layer offscreen
const glc = mk(W, H); // WebGL canvas for pages that need shaders: draw with gl, then ctx.drawImage(glc, 0, 0)
const gl = glc.getContext('webgl', { premultipliedAlpha: true, preserveDrawingBuffer: true, antialias: false });
const THEME = { pill: 'rgba(6,20,40,.62)', now: '#ffd98a', past: '#ffffff', next: 'rgba(143,216,230,.55)' }; // caption and subtitle colours
let TL, SCENE, FONT = 'sans-serif'; // FONT: the first family in start({fonts}); used by setFont, caption, drawSubs

// ---------- math ----------
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const lerp = (a, b, p) => a + (b - a) * p;
const easeInOutCubic = p => p < .5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
const easeOutQuint = p => 1 - Math.pow(1 - p, 5);
const easeOutCubic = p => 1 - Math.pow(1 - p, 3);
const easeInCubic = p => p * p * p;
const smooth = (a, b, x) => { const u = clamp((x - a) / (b - a)); return u * u * (3 - 2 * u); };
// damped spring step 0 -> 1 since dt seconds ago (damping .42-.5, frequency 12-16): things pop in and settle
function spring(dt, zeta = .45, w = 14) {
  if (dt <= 0) return 0;
  const wd = w * Math.sqrt(1 - zeta * zeta);
  return 1 - Math.exp(-zeta * w * dt) * (Math.cos(wd * dt) + zeta * w / wd * Math.sin(wd * dt));
}
// damped spring impulse 0 -> ±1 -> 0, for squash and stretch or a hit
function kick(dt, zeta = .42, w = 14) {
  if (dt <= 0) return 0;
  return Math.exp(-zeta * w * dt) * Math.sin(w * Math.sqrt(1 - zeta * zeta) * dt);
}
// seeded random numbers in [0, 1): never use Math.random in drawing, or frames stop being reproducible
function rng(seed) {
  return () => { seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
// time of a cue word from narration.json: at('2:twenty') = when sentence 2 says the word starting with "twenty"
const at = k => { const v = TL.triggers[k]; if (v == null) throw new Error(`no cue "${k}" in out/timeline.json: add it to that line's cues in narration.json and run voice.py`); return v; };

// ---------- camera: eased moves, zoom interpolated in log space, a slow drift so nothing ever holds still ----------
// moves: [[startTime, duration, target {x?, y?, z?}], ...] applied in order; set CAM = camPath(...) in draw, then use w2s
function camPath(t, init, moves) {
  let c = { ...init };
  for (const [t0, dur, g] of moves) {
    if (t < t0) break;
    const p = easeInOutCubic(clamp((t - t0) / dur));
    c = { x: lerp(c.x, g.x ?? c.x, p), y: lerp(c.y, g.y ?? c.y, p), z: Math.exp(lerp(Math.log(c.z), Math.log(g.z ?? c.z), p)) };
  }
  const z = c.z * (1 + .012 * Math.sin(t * .23));
  return { x: c.x + 10 * Math.sin(t * .37) / z, y: c.y + 7 * Math.sin(t * .29 + 1) / z, z };
}
let CAM = { x: W / 2, y: H / 2, z: 1 };
const w2s = p => ({ x: W / 2 + (p.x - CAM.x) * CAM.z, y: H / 2 + (p.y - CAM.y) * CAM.z }); // world point -> screen

// ---------- film grain and vignette, built once ----------
let GRAIN = [], VIG;
function buildStatic() {
  const r = rng(7);
  for (let i = 0; i < 8; i++) {
    const c = mk(256, 256), g = c.getContext('2d'), im = g.createImageData(256, 256);
    for (let q = 0; q < im.data.length; q += 4) { const v = (r() + r() + r()) / 3 * 255; im.data[q] = im.data[q + 1] = im.data[q + 2] = v; im.data[q + 3] = 255; }
    g.putImageData(im, 0, 0); GRAIN.push(octx.createPattern(c, 'repeat'));
  }
  VIG = mk(W, H); const v = VIG.getContext('2d');
  const g = v.createRadialGradient(W / 2, H / 2, Math.min(W, H) * .38, W / 2, H / 2, Math.hypot(W, H) * .53);
  g.addColorStop(0, 'rgba(4,4,20,0)'); g.addColorStop(1, 'rgba(4,4,20,.45)'); v.fillStyle = g; v.fillRect(0, 0, W, H);
}

// ---------- shapes and text ----------
const rr = (x, y, w, h, r, col) => { ctx.fillStyle = col; ctx.beginPath(); ctx.roundRect(x, y, w, h, r); ctx.fill(); };
function setFont(weight, size, sp = 0, family = FONT) { ctx.font = `${weight} ${size}px "${family}"`; ctx.letterSpacing = sp + 'px'; }
// caption: lines [{text, size, color, weight?, sp?}] in a pill at (x, y); springs in at tIn, each line rises
// through a clip, and it leaves at tOut. o: {align: 'center' | 'left' | 'right' (x is that edge), fill, padX, padY, gap, minW, scale}
function caption(t, lines, x, y, tIn, tOut = 1e9, o = {}) {
  if (t < tIn || t > tOut + .35) return;
  const padX = o.padX ?? 30, padY = o.padY ?? 14, gap = o.gap ?? 4;
  let w = o.minW ?? 0, h = 0;
  const ms = lines.map(l => { setFont(l.weight || 600, l.size, l.sp ?? 4); const lw = ctx.measureText(l.text).width - (l.sp ?? 4), lh = l.size * 1.1; w = Math.max(w, lw); h += lh; return { lw, lh }; });
  h += gap * (lines.length - 1);
  const pw = w + padX * 2, ph = h + padY * 2, al = o.align ?? 'center', x0 = al === 'left' ? 0 : al === 'right' ? -pw : -pw / 2;
  const sc = spring(t - tIn, .5, 14) * (t > tOut ? 1 - easeInCubic(clamp((t - tOut) / .3)) : 1) * (o.scale ?? 1);
  if (sc <= .001) return;
  ctx.save(); ctx.translate(x, y); ctx.scale(sc, sc);
  ctx.fillStyle = o.fill ?? THEME.pill; ctx.beginPath(); ctx.roundRect(x0, -ph / 2, pw, ph, Math.min(ph / 2, 30)); ctx.fill();
  let cy = -ph / 2 + padY;
  lines.forEach((l, i) => {
    const { lw, lh } = ms[i]; setFont(l.weight || 600, l.size, l.sp ?? 4);
    const p = easeOutQuint(clamp((t - tIn - .06 - i * .09) / .55));
    const po = t > tOut ? easeInCubic(clamp((t - tOut) / .25)) : 0;
    const off = (1 - p) * lh * 1.3 + po * lh * 1.3;
    ctx.save(); ctx.beginPath(); ctx.rect(x0, cy - 2, pw, lh + 4); ctx.clip();
    ctx.fillStyle = l.color; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    ctx.fillText(l.text, al === 'left' ? x0 + padX : al === 'right' ? -padX - lw : -lw / 2, cy + lh * .8 + off); ctx.restore();
    cy += lh + gap;
  });
  ctx.restore(); ctx.letterSpacing = '0px';
}

// text with every digit in a cell as wide as "0", so a changing counter doesn't jitter (canvas has no tabular-nums)
function tabular(text, x, y, align = 'left') {
  const cw = ctx.measureText('0').width, ch = [...text], ws = ch.map(c => /\d/.test(c) ? cw : ctx.measureText(c).width);
  let cx = x - ws.reduce((a, b) => a + b, 0) * (align === 'right' ? 1 : align === 'center' ? .5 : 0);
  const ta = ctx.textAlign; ctx.textAlign = 'center';
  ch.forEach((c, i) => { ctx.fillText(c, cx + ws[i] / 2, y); cx += ws[i]; });
  ctx.textAlign = ta;
}

// ---------- kinetic type and impact ----------
const slam = (t, t0, amt = .4) => 1 + amt * (1 - spring(t - t0, .45, 15)); // a scale that lands from 1 + amt to 1, with overshoot
// a word that slams in at t0, centred on (x, y), and shrinks away at o.out. o: {out, weight, color, box (fill), pad, r, rot, amt, sp, family}
function stamp(t, t0, str, x, y, size, o = {}) {
  const po = o.out != null && t > o.out ? easeInCubic(clamp((t - o.out) / .2)) : 0;
  if (t < t0 || po >= 1) return;
  setFont(o.weight ?? 900, size, o.sp ?? 0, o.family);
  const w = ctx.measureText(str).width, s = slam(t, t0, o.amt ?? .5) * (1 - .3 * po), pad = o.pad ?? size * .25;
  ctx.save(); ctx.globalAlpha *= 1 - po; ctx.translate(x, y); ctx.rotate(o.rot ?? 0); ctx.scale(s, s);
  if (o.box) rr(-w / 2 - pad, -size * .56, w + pad * 2, size * 1.04, o.r ?? size * .2, o.box);
  ctx.fillStyle = o.color ?? '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic'; ctx.fillText(str, 0, size * .36);
  ctx.restore(); ctx.letterSpacing = '0px';
}
// a line of type rising into place through a clip at t0 (baseline y), dropping out at o.out. Returns its width.
// o: {weight, color, align: 'left' | 'center' | 'right', dur, out, sp, family}
function rise(t, t0, str, x, y, size, o = {}) {
  if (t < t0) return 0;
  setFont(o.weight ?? 900, size, o.sp ?? 0, o.family);
  const w = ctx.measureText(str).width, ax = o.align === 'center' ? x - w / 2 : o.align === 'right' ? x - w : x;
  const p = easeOutQuint(clamp((t - t0) / (o.dur ?? .45))), po = o.out != null && t > o.out ? easeInCubic(clamp((t - o.out) / .22)) : 0;
  if (po < 1) {
    ctx.save(); ctx.beginPath(); ctx.rect(ax - 14, y - size * .95, w + 28, size * 1.25); ctx.clip();
    ctx.fillStyle = o.color ?? '#fff'; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    ctx.fillText(str, ax, y + ((1 - p) + po) * size * 1.3); ctx.restore();
  }
  ctx.letterSpacing = '0px';
  return w;
}
// a label that points at something: a dot on the target (tx, ty), a leader line drawn out from it at t0, then the text
// in a pill at (x, y). o: {size (30), color, fill, line, align: 'left' | 'right' (which side of x the text sits), out}
function label(t, t0, text, x, y, tx, ty, o = {}) {
  const po = o.out != null && t > o.out ? clamp((t - o.out) / .2) : 0;
  if (t < t0 || po >= 1) return;
  const p = easeOutCubic(clamp((t - t0) / .25)), size = o.size ?? 30, col = o.line ?? o.color ?? '#fff';
  ctx.save(); ctx.globalAlpha *= 1 - po;
  ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(lerp(tx, x, p), lerp(ty, y, p)); ctx.stroke();
  ctx.beginPath(); ctx.arc(tx, ty, 7 * spring(t - t0, .5, 16), 0, TAU); ctx.fill();
  if (t > t0 + .18) {
    setFont(700, size, 1); const w = ctx.measureText(text).width, k = spring(t - t0 - .18, .5, 15), left = (o.align ?? 'left') === 'left';
    const bx = left ? x : x - w - size * .9, by = y - size * .8;
    ctx.translate(x, y); ctx.scale(k, k); ctx.translate(-x, -y);
    rr(bx, by, w + size * .9, size * 1.6, size * .8, o.fill ?? THEME.pill);
    ctx.fillStyle = o.color ?? '#fff'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillText(text, bx + size * .45, y + size * .02);
  }
  ctx.restore(); ctx.letterSpacing = '0px';
}
// a soft additive glow of radius r: a cached gradient sprite, much cheaper than shadowBlur
const GLOWS = {};
function glow(x, y, r, color = '#fff', a = 1) {
  let g = GLOWS[color];
  if (!g) {
    g = GLOWS[color] = mk(128, 128); const c = g.getContext('2d'), gr = c.createRadialGradient(64, 64, 0, 64, 64, 64);
    gr.addColorStop(0, color); gr.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = gr; c.fillRect(0, 0, 128, 128);
    c.globalCompositeOperation = 'destination-in'; c.drawImage(g, 0, 0); // square the falloff: a bright core, a long soft tail
  }
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha *= a; ctx.drawImage(g, x - r, y - r, r * 2, r * 2); ctx.restore();
}
// camera shake after a hit at t0: translate by the result; it decays in about 0.4 s
const shake = (t, t0, amp = 16) => ({ x: amp * kick(t - t0, .3, 38), y: amp * .6 * kick(t - t0 - .02, .3, 45) });
// an impact frame: the whole frame flashes `color` at t0 and fades over dur
function flash(t, t0, dur = .25, color = '#fff') {
  const a = t < t0 ? 0 : 1 - clamp((t - t0) / dur); if (a <= 0) return;
  ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = a * a; ctx.fillStyle = color; ctx.fillRect(0, 0, W, H); ctx.restore();
}

// ---------- shots and transitions ----------
// draw into an offscreen canvas: ctx points at it while fn runs
function layer(cv, fn) { const main = ctx; ctx = cv.getContext('2d'); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, W, H); ctx.globalAlpha = 1; try { fn(); } finally { ctx = main; } }
const LA = mk(W, H), LB = mk(W, H);
// shots: [{t0, draw(t), tr?, focus?(t), focusIn?(t)}] in time order. Each shot draws the whole frame, background included.
// tr is how a shot hands over to the next one, centred on its start time:
//   'in'   zoom into the shot's focus point; the next shot opens through a growing circle there
//   'out'  the shot shrinks back into a closing circle at its focus, revealing the next (which can set focusIn)
//   'whip' the shot slides up and out, the next slides up in
//   'cut'  (default) switches on the frame
// o: {dur: half the transition in seconds (.28), ring: the circle's edge colour, or null for none}
function scenes(t, shots, o = {}) {
  const TW = o.dur ?? .28, C = { x: W / 2, y: H / 2 }, D = Math.hypot(W, H);
  let i = 0; while (i + 1 < shots.length && t >= shots[i + 1].t0) i++;
  let A = null, B = null;
  if (i + 1 < shots.length && t > shots[i + 1].t0 - TW) { A = shots[i]; B = shots[i + 1]; }
  else if (i > 0 && t < shots[i].t0 + TW) { A = shots[i - 1]; B = shots[i]; }
  if (!A || !A.tr || A.tr === 'cut') { ctx.save(); shots[i].draw(t); ctx.restore(); return; }
  const p = (t - (B.t0 - TW)) / (2 * TW);
  const paint = (cv, sc, f, s, ty = 0) => layer(cv, () => { ctx.translate(f.x, f.y + ty); ctx.scale(s, s); ctx.translate(-f.x, -f.y); sc.draw(t); });
  const iris = (cv, f, R) => {
    if (R < 1) return;
    ctx.save(); ctx.beginPath(); ctx.arc(f.x, f.y, R, 0, TAU); ctx.clip(); ctx.drawImage(cv, 0, 0); ctx.restore();
    if (o.ring !== null && R < D) { ctx.strokeStyle = o.ring ?? '#fff'; ctx.lineWidth = 8; ctx.beginPath(); ctx.arc(f.x, f.y, R, 0, TAU); ctx.stroke(); }
  };
  if (A.tr === 'in') {
    const f = A.focus ? A.focus(t) : C;
    paint(LA, A, f, Math.exp(Math.log(5) * easeInCubic(p))); paint(LB, B, f, Math.exp(Math.log(.45) * (1 - easeOutCubic(p))));
    ctx.drawImage(LA, 0, 0); iris(LB, f, D * easeInCubic(p));
  } else if (A.tr === 'out') {
    const fa = A.focus ? A.focus(t) : C, fb = B.focusIn ? B.focusIn(t) : C;
    paint(LB, B, fb, Math.exp(Math.log(2.2) * (1 - easeOutCubic(p)))); paint(LA, A, fa, Math.exp(Math.log(.35) * easeInCubic(p)));
    ctx.drawImage(LB, 0, 0); iris(LA, fa, D * (1 - easeOutCubic(p)));
  } else {
    paint(LA, A, C, 1, -H * easeInCubic(p)); paint(LB, B, C, 1, H * (1 - easeOutCubic(p)));
    ctx.drawImage(LA, 0, 0); ctx.drawImage(LB, 0, 0);
  }
}

// ---------- word-by-word subtitles from the voice timeline, centred at y ----------
// o: {size, maxW, maxLines, upper, fill, now, past, next}: the spoken word is `now`, earlier words `past`, later ones `next`.
// A sentence longer than maxLines (2) lines shows a page at a time; the next page rises in as its first word is spoken.
function drawSubs(t, y, o = {}) {
  const S = TL.sentences.find(s => t >= s.start - .05 && t <= s.end + .3);
  if (!S) return;
  const size = o.size ?? 46, text = (o.upper ?? true) ? S.text.toUpperCase() : S.text;
  const words = text.replace(/\.$/, '').split(/\s+/), times = S.words.map(w => w[1]);
  setFont(700, size, 3);
  const sp = ctx.measureText(' ').width, maxW = o.maxW ?? W * .78, lines = [[]];
  let lw = 0;
  words.forEach((w, i) => { const ww = ctx.measureText(w).width; if (lw && lw + sp + ww > maxW) { lines.push([]); lw = 0; } lines[lines.length - 1].push({ w, ww, i }); lw += (lw ? sp : 0) + ww; });
  let cur = -1; times.forEach((tt, i) => { if (t >= tt - .03) cur = i; });
  const pages = [], maxL = o.maxLines ?? 2;
  for (let i = 0; i < lines.length; i += maxL) pages.push(lines.slice(i, i + maxL));
  const pi = Math.max(0, pages.findIndex(pg => pg.at(-1).at(-1).i >= cur)), page = pages[pi], t0 = pi ? times[page[0][0].i] - .05 : S.start;
  const lh = size * 1.2, pw = Math.max(...page.map(l => l.reduce((s, q) => s + q.ww, 0) + sp * (l.length - 1))) + 56, ph = lh * page.length + 26;
  const sc = spring(t - S.start + .05, .5, 14) * (1 - easeInCubic(clamp((t - S.end - .1) / .2)));
  if (sc <= .001) return;
  ctx.save(); ctx.translate(W / 2, y); ctx.scale(sc, sc);
  if (o.fill !== null) rr(-pw / 2, -ph / 2, pw, ph, Math.min(ph / 2, 30), o.fill ?? THEME.pill);
  page.forEach((l, li) => {
    const p = easeOutQuint(clamp((t - t0 - li * .08) / .5)), cy = -ph / 2 + 13 + li * lh;
    let x = -(l.reduce((s, q) => s + q.ww, 0) + sp * (l.length - 1)) / 2;
    ctx.save(); ctx.beginPath(); ctx.rect(-pw / 2, cy - 2, pw, lh + 4); ctx.clip();
    for (const q of l) {
      ctx.fillStyle = q.i === cur ? o.now ?? THEME.now : q.i < cur ? o.past ?? THEME.past : o.next ?? THEME.next;
      ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'; ctx.fillText(q.w, x, cy + lh * .8 + (1 - p) * lh * 1.3); x += q.ww + sp;
    }
    ctx.restore();
  });
  ctx.restore(); ctx.letterSpacing = '0px';
}

// ---------- frame harness ----------
window.seek = function (t) {
  if (SCENE.blur === false) { SCENE.draw(t); octx.globalCompositeOperation = 'copy'; octx.drawImage(scene, 0, 0); octx.globalCompositeOperation = 'source-over'; }
  else { // motion blur: 2 subframes across a 0.6 shutter
    SCENE.draw(t - .15 / FPS); octx.globalCompositeOperation = 'copy'; octx.globalAlpha = 1; octx.drawImage(scene, 0, 0);
    SCENE.draw(t + .15 / FPS); octx.globalCompositeOperation = 'source-over'; octx.globalAlpha = .5; octx.drawImage(scene, 0, 0); octx.globalAlpha = 1;
  }
  if (SCENE.post) SCENE.post(t); // draws on octx, once per frame, after the blur
  if (SCENE.vignette !== false) octx.drawImage(VIG, 0, 0);
  const f = Math.floor(t * 24), r = rng(f * 7919 + 13); // grain re-randomized 24x per second
  octx.save(); octx.globalCompositeOperation = 'overlay'; octx.globalAlpha = SCENE.grain ?? .06; octx.fillStyle = GRAIN[f % GRAIN.length];
  octx.translate(-r() * 256, -r() * 256); octx.fillRect(0, 0, W + 256, H + 256); octx.restore();
};
// scn: {init(tl) -> {duration, title, beats, sfx, music?, marks?}, draw(t), load?, post?, fonts?: [[family, url, weight]],
//       timeline?: url, vignette?: false, grain?: 0..1, blur?: false}
function start(scn) {
  SCENE = scn;
  window.ready = (async () => {
    for (const [fam, url, weight] of SCENE.fonts || []) document.fonts.add(await new FontFace(fam, `url(${url})`, { weight: weight || 'normal' }).load());
    if (SCENE.fonts?.length) FONT = SCENE.fonts[0][0];
    const res = await fetch(SCENE.timeline || 'out/timeline.json');
    if (!res.ok) throw new Error(`${res.url} not found: run scripts/voice.py on this folder first`);
    TL = await res.json();
    if (SCENE.load) await SCENE.load(); // async data the page needs before init
    buildStatic();
    const r = SCENE.init(TL);
    window.DURATION = r.duration; window.TITLE = r.title ?? r.duration - 2.5; window.BEATS = r.beats || [];
    window.MUSIC = r.music || 'pad'; window.MARKS = r.marks || {};
    window.SFX = (r.sfx || []).map(([k, t]) => ({ k, t: Math.round(t * FPS) / FPS })).sort((a, b) => a.t - b.t);
    const dbg = gl && gl.getExtension('WEBGL_debug_renderer_info');
    window.GPU = dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : 'unknown';
    return true;
  })();
}
