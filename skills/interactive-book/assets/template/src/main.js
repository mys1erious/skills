import '@fontsource-variable/source-serif-4/wght.css';
import '@fontsource-variable/source-serif-4/wght-italic.css';
import '@fontsource/caveat/400.css';
import '@fontsource/caveat/600.css';
import './styles.css';
import * as THREE from 'three';
import { createStage, PAGE_TOP } from './engine/stage.js';
import { createBook } from './engine/book.js';
import { newSurface, drawLessonLeft, drawLessonRight, drawTitlePage, drawContents, drawSources, drawIndex, drawBlank } from './engine/page.js';
import { inkLoop, inkPath, inkBox, inkMaterial, pageText, halo, clearGroup, setInkResolution, inked, hatchMaterial } from './engine/ink.js';
import { createUI } from './engine/ui.js';
import { createWatch } from './engine/watch.js';
import { createCard } from './kit/card.js';
import { createTray, FLOOR as TRAY_FLOOR } from './kit/tray.js';
import { floatLabel } from './kit/label.js';
import bookData from './content/book.json';
import glossary from './content/glossary.json';
import sourceList from './content/sources.json';
import { lessons } from './lessons/registry.js';

const q = new URLSearchParams(location.search);
const SHOT = q.has('shot');
// bump the version when a lesson changes enough that saved answers and stamps should not carry over
const STORE = `${bookData.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-book:v1`;
const progress = (() => {
  try { return { lessons: {}, watched: {}, ...JSON.parse(localStorage.getItem(STORE) ?? '{}') }; } catch { return { lessons: {}, watched: {} }; }
})();
const save = () => { try { localStorage.setItem(STORE, JSON.stringify(progress)); } catch { /* private mode: progress lives for this visit only */ } };

const sources = Object.fromEntries(sourceList.map((s) => [s.id, s]));
const available = Object.keys(lessons).map(Number).sort((a, b) => a - b);

for (const n of available) {
  const c = lessons[n].content;
  for (const id of c.keywords) if (!glossary[id]) throw new Error(`lesson ${n}: no glossary entry '${id}'`);
  for (const id of [c.readNext, ...c.sources]) if (!sources[id]) throw new Error(`lesson ${n}: no source '${id}'`);
}

if (!(() => { try { return !!document.createElement('canvas').getContext('webgl2'); } catch { return false; } })()) {
  document.body.classList.add('nogl');
  throw new Error('WebGL2 unavailable');
}

await Promise.race([
  Promise.all(['400 28px "Source Serif 4 Variable"', 'italic 400 28px "Source Serif 4 Variable"', '600 28px "Source Serif 4 Variable"', '400 40px Caveat', '600 40px Caveat'].map((f) => document.fonts.load(f))),
  new Promise((r) => setTimeout(r, 4000)),
]);


const canvas = document.getElementById('c');
const stage = createStage(canvas, { tier: q.get('tier') ?? 'high' });
const S = { k: 1, still: false };
const runtimes = new Map();
const surfaces = new Map();
const cur = () => { const sp = spreads[S.k - 1]; return sp.kind === 'lesson' ? runtimes.get(sp.n) ?? null : null; };
const lessonState = (n) => (progress.lessons[n] ??= { predict: null, flapOpen: false, stamped: false });

const usedSources = () => [...new Set(available.flatMap((n) => [lessons[n].content.readNext, ...lessons[n].content.sources]))].map((id) => sources[id]);
const indexEntries = () => {
  const m = new Map();
  for (const n of available) for (const id of lessons[n].content.keywords) {
    if (!m.has(id)) m.set(id, { ...glossary[id], lessons: [] });
    m.get(id).lessons.push(n);
  }
  return [...m.values()].sort((a, b) => a.term.localeCompare(b.term));
};

// spread 1 = title and contents, one spread per written lesson, then as many back-matter spreads as the sources and index need
function backPages() {
  const scratch = newSurface();
  const pages = [];
  for (let rest = usedSources(), first = 1; rest.length;) {
    const n = drawSources(scratch, { list: rest, first });
    if (!n) throw new Error(`source '${rest[0].id}' is too long for a page`);
    pages.push({ kind: 'sources', list: rest.slice(0, n), first });
    rest = rest.slice(n);
    first += n;
  }
  for (let rest = indexEntries(), cont = false; rest.length; cont = true) {
    const n = drawIndex(scratch, { entries: rest, cont });
    if (!n) throw new Error(`index entry '${rest[0].term}' is too long for a page`);
    pages.push({ kind: 'index', entries: rest.slice(0, n), cont });
    rest = rest.slice(n);
  }
  if (pages.length % 2) pages.push({ kind: 'blank' });
  return pages;
}
const back = backPages();
const spreads = [{ kind: 'front' }, ...available.map((n) => ({ kind: 'lesson', n })), ...back.filter((_, i) => i % 2 === 0).map((L, i) => ({ kind: 'back', L, R: back[2 * i + 1] }))];
const LAST = spreads.length;
const FIRST_BACK = spreads.findIndex((s) => s.kind === 'back') + 1;
const spreadOfLesson = (n) => spreads.findIndex((s) => s.n === n) + 1;

function marginLines(rt) {
  if (!rt?.scene) return [];
  const vals = rt.scene.sim.margin();
  const out = [];
  for (const tpl of rt.content.margin.lines) {
    let missing = false;
    const text = tpl.replace(/\{(\w+)\}/g, (_, key) => { if (vals[key] == null) missing = true; return vals[key] ?? ''; });
    if (!missing) out.push({ text });
  }
  return out;
}

const switchState = (rt) => Object.fromEntries((rt?.content.switches ?? []).map((sw) => [sw.id, rt.scene?.switchValue(sw.id) ?? null]));

function surface(k, side) {
  const key = `${k}:${side}`;
  if (!surfaces.has(key)) surfaces.set(key, newSurface());
  const s = surfaces.get(key);
  s.regions = [];
  s.overflow = false;
  const sp = spreads[k - 1];
  const folioN = 2 * k + (side === 'L' ? -2 : -1);
  if (sp.kind === 'front') {
    if (side === 'L') drawTitlePage(s, { book: bookData });
    else drawContents(s, { book: bookData, available, onLessonSpread: spreadOfLesson, backSpread: FIRST_BACK, legend: bookData.legend, folioN });
  } else if (sp.kind === 'back') {
    const pg = sp[side];
    if (pg.kind === 'sources') drawSources(s, { list: pg.list, first: pg.first, side, folioN });
    else if (pg.kind === 'index') drawIndex(s, { entries: pg.entries, cont: pg.cont, side, folioN });
    else drawBlank(s, { side, folioN });
  } else {
    const rt = runtimes.get(sp.n);
    const content = lessons[sp.n].content;
    if (side === 'L') drawLessonLeft(s, { lesson: content, glossary, sources, state: lessonState(sp.n), folioN });
    else drawLessonRight(s, { lesson: content, state: { switches: switchState(rt) }, margin: marginLines(rt), folioN });
  }
  if (s.overflow) console.error(`spread ${k}${side}: text runs past the bottom margin`);
  return s;
}

const book = createBook(stage, { surface, cover: bookData.cover, ribbon: bookData.ribbon });

function redraw(k, side) {
  surface(k, side);
  book.refresh(k, side);
}

function model() {
  const sp = spreads[S.k - 1];
  if (sp.kind === 'front') return { kind: 'front', book: bookData, available, spreadOfLesson, last: FIRST_BACK };
  if (sp.kind === 'back') return { kind: 'back', sources: usedSources(), index: indexEntries() };
  const rt = runtimes.get(sp.n);
  const items = rt.scene.a11yItems().map((it) => ({ ...it, selected: rt.scene.sim.state.selected === it.id }));
  return { kind: 'lesson', content: rt.content, glossary, sources, state: rt.state, switches: switchState(rt), items, margin: marginLines(rt), challenge: rt.scene.sim.challenge() };
}

function sceneChanged(n) {
  const rt = runtimes.get(n);
  if (!rt?.scene) return;
  const k = spreadOfLesson(n);
  redraw(k, 'R');
  if (rt.scene.sim.challenge().met && !rt.state.stamped) {
    rt.state.stamped = true;
    save();
    redraw(k, 'L');
    ui.announce(`Challenge done: ${rt.content.challenge.done}.`);
  }
  if (S.k === k) ui.update(model());
}

// a camera pose for a Watch shot: look at a point given in the figure's own coordinates (y = 0 is the paper)
// from `distance` away, `elevation` degrees above the page, `azimuth` degrees round from the front (+ = from the right)
function pose([x, y, z], { distance = 26, elevation = 30, azimuth = 0 } = {}) {
  const target = new THREE.Vector3(x, y + PAGE_TOP, z);
  const e = THREE.MathUtils.degToRad(elevation), a = THREE.MathUtils.degToRad(azimuth);
  const pos = target.clone().add(new THREE.Vector3(Math.sin(a) * Math.cos(e), Math.sin(e), Math.cos(a) * Math.cos(e)).multiplyScalar(distance));
  return { pos, target };
}

// everything a lesson scene gets: see references/scenes.md in the skill
const kit = (n) => ({ THREE, tweens: stage.tweens, PAGE_TOP, pose, createCard, createTray, TRAY_FLOOR, floatLabel, inkLoop, inkPath, inkBox, inkMaterial, inked, hatchMaterial, pageText, halo, clearGroup, onChange: () => sceneChanged(n) });

async function ensureRuntime(n) {
  if (runtimes.has(n)) return runtimes.get(n);
  const mod = (await lessons[n].scene()).default;
  const rt = { n, content: lessons[n].content, state: lessonState(n), scene: null };
  runtimes.set(n, rt);
  rt.scene = mod.build(kit(n));
  rt.scene.group.position.y = PAGE_TOP;
  rt.scene.group.visible = false;
  stage.scene.add(rt.scene.group);
  return rt;
}

// the figure folds into the page when you leave and lifts off it when you arrive
function lift(group, up, instant) {
  group.visible = true;
  const from = group.scale.y;
  const to = up ? 1 : 0.001;
  return stage.tweens.run((t) => group.scale.setY(from + (to - from) * t), instant ? 0 : up ? 0.7 : 0.3).then(() => { group.visible = up; });
}

function afterArrive(instant) {
  const sp = spreads[S.k - 1];
  ui.setNav({ k: S.k, last: LAST, label: sp.kind === 'front' ? 'Contents' : sp.kind === 'back' ? 'Sources and index' : `${sp.n}  ${lessons[sp.n].content.title}`, isLesson: sp.kind === 'lesson' });
  ui.render(model());
  try { history.replaceState(null, '', `${location.pathname}${location.search}#spread-${S.k}`); } catch { /* sandboxed frames */ }
  const rt = cur();
  if (rt && !instant && !progress.watched[rt.n] && !q.has('nowatch') && !SHOT) {
    progress.watched[rt.n] = true;
    save();
    watch.play(rt.scene, rt.content);
  }
}

async function goTo(k, { instant = false } = {}) {
  k = Math.max(1, Math.min(LAST, Math.round(Number(k) || 1)));
  if (k === S.k || book.turning) return;
  watch.cancel();
  S.turnTo = k;
  const leaving = cur();
  const sp = spreads[k - 1];
  if (sp.kind === 'lesson') await ensureRuntime(sp.n);
  redraw(k, 'L');
  redraw(k, 'R');
  if (leaving) await lift(leaving.scene.group, false, instant);
  if (instant) book.setSpread(k); else await book.turn(k, 1.1);
  S.k = k;
  S.turnTo = null;
  const arriving = cur();
  if (arriving) await lift(arriving.scene.group, true, instant);
  afterArrive(instant);
}

function setStill(on) {
  S.still = on;
  stage.tweens.still = on;
  document.body.classList.toggle('still', on);
  progress.still = on;
  save();
  ui.setStill(on);
}

const actions = {
  goTo,
  prev: () => goTo(S.k - 1),
  next: () => goTo(S.k + 1),
  predict(i) {
    const rt = cur();
    if (!rt) return;
    rt.state.predict = i;
    rt.state.flapNudge = false;
    save();
    redraw(S.k, 'L');
    ui.update(model());
  },
  flap() {
    const rt = cur();
    if (!rt) return;
    if (rt.state.predict == null) {
      rt.state.flapNudge = true;
      redraw(S.k, 'L');
      ui.announce('Make a prediction first.');
      return;
    }
    rt.state.flapOpen = true;
    save();
    redraw(S.k, 'L');
    ui.update(model());
    ui.announce(rt.content.explain);
  },
  setSwitch: (id, i) => cur()?.scene.setSwitch(id, i),
  press: (id) => cur()?.scene.press(id),
  tap: (id) => cur()?.scene.tap(id),
  watch() { const rt = cur(); if (rt) watch.play(rt.scene, rt.content); },
  toggleStill: () => setStill(!S.still),
};
const ui = createUI({ actions });
const watch = createWatch({ stage, ui });

// pointer: tappable things in the figure first, then printed controls on the pages
const ray = new THREE.Raycaster();
const ndc = new THREE.Vector2();
function pick(ev) {
  const r = canvas.getBoundingClientRect();
  ndc.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
  ray.setFromCamera(ndc, stage.camera);
  const rt = cur();
  if (rt && !book.turning) {
    // a tap can arrive before the next frame has moved the matrices to where the model just put things
    rt.scene.group.updateMatrixWorld(true);
    // three.js raycasting does not skip hidden objects, so only count what the reader can see
    const shown = (o) => { for (; o; o = o.parent) if (!o.visible) return false; return true; };
    const hit = ray.intersectObjects(rt.scene.targets(), false).find((h) => shown(h.object));
    if (hit) return { target: hit.object.userData.targetId };
  }
  const p = book.hitTest(ray);
  if (!p) return null;
  const reg = surfaces.get(`${S.k}:${p.side}`)?.regions.find((g) => p.x >= g.x && p.x <= g.x + g.w && p.y >= g.y && p.y <= g.y + g.h);
  return reg ? { region: reg.id } : null;
}

canvas.addEventListener('pointermove', (ev) => {
  const hit = pick(ev);
  canvas.style.cursor = hit ? 'pointer' : 'default';
  ui.tip(hit?.target ? cur().scene.hover(hit.target) : null, ev.clientX, ev.clientY);
});
canvas.addEventListener('pointerleave', () => ui.tip(null));
let down = null;
canvas.addEventListener('pointerdown', (ev) => (down = { x: ev.clientX, y: ev.clientY }));
canvas.addEventListener('pointerup', (ev) => {
  if (!down || Math.hypot(ev.clientX - down.x, ev.clientY - down.y) > 6) return;
  down = null;
  if (watch.playing) { watch.cancel(); return; }
  const hit = pick(ev);
  if (!hit) return;
  if (hit.target) return actions.tap(hit.target);
  const [what, a, b] = hit.region.split(':');
  if (what === 'predict') actions.predict(Number(a));
  else if (what === 'flap') actions.flap();
  else if (what === 'switch') actions.setSwitch(a, Number(b));
  else if (what === 'button') actions.press(a);
  else if (what === 'watch') actions.watch();
  else if (what === 'goto') goTo(Number(a));
});

addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && watch.playing) { e.preventDefault(); watch.cancel(); return; }
  if (e.target.closest?.('#a11y')) return;
  if (e.key === 'ArrowRight' || e.key === 'PageDown') { e.preventDefault(); actions.next(); }
  if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); actions.prev(); }
});

function onResize() {
  stage.resize();
  setInkResolution(canvas.clientWidth, canvas.clientHeight);
  if (!watch.playing) stage.setPose(stage.readingPose());
}
addEventListener('resize', onResize);
onResize();

if (SHOT) document.body.classList.add('shot');
setStill(q.has('still') || (progress.still ?? matchMedia('(prefers-reduced-motion: reduce)').matches));

const hashK = Number(/^#spread-(\d+)$/.exec(location.hash)?.[1]);
const startK = Math.max(1, Math.min(LAST, Number(q.get('k')) || hashK || 1));
{
  const sp = spreads[startK - 1];
  if (sp.kind === 'lesson') await ensureRuntime(sp.n);
  S.k = startK;
  book.setSpread(startK);
  const rt = cur();
  if (rt) { rt.scene.group.visible = true; rt.scene.group.scale.setY(1); }
  afterArrive(true);
}

let last = performance.now();
let frames = 0;
let slow = 0;
stage.renderer.setAnimationLoop((now) => {
  const raw = (now - last) / 1000;
  const dt = Math.min(0.05, raw);
  last = now;
  stage.tweens.step(dt);
  stage.render();
  if (++frames === 3) { document.body.classList.add('ready'); window.__ready = true; }
  // a slow machine: if most of the first two seconds of frames take over 40 ms, render fewer pixels
  if (frames > 10 && frames <= 130 && raw > 0.04 && ++slow === 60) stage.lowerResolution();
});

// test and debugging hooks
window.__book = {
  S, LAST_SPREAD: LAST, spreads, goTo, actions, watch, setStill, ensureRuntime,
  current: cur,
  lesson: (n) => lessons[n]?.content,
  glossary, sources,
  surface: (k, side) => surfaces.get(`${k}:${side}`),
  // where a point printed on a page appears on screen, so tests can click real printed controls
  screenOf(side, x, y) { return this.project(book.worldOf(side, x, y)); },
  project(world) {
    const v = world.clone().project(stage.camera);
    const r = canvas.getBoundingClientRect();
    return { x: r.left + ((v.x + 1) / 2) * r.width, y: r.top + ((1 - v.y) / 2) * r.height };
  },
};
