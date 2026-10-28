// Tests the book through what a reader does: printed controls, 3D targets, the text version, keys, watch.
// The first block runs on every lesson as written; the last block holds one test per lesson's challenge, written
// with the lesson. Hooks used: window.__ready, window.__book (see src/main.js).
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

async function open(page, query = 'k=2&nowatch&still') {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await page.goto(`/?${query}`);
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 90_000 });
  return errors;
}

// click a control printed on a page (its id is the region id: 'flap', 'predict:0', 'switch:<id>:<i>', 'button:<id>', 'goto:<k>')
const clickPrinted = async (page, side, id) => {
  const at = await page.evaluate(([side, id]) => {
    const k = window.__book.S.k;
    const r = window.__book.surface(k, side).regions.find((g) => g.id === id);
    if (!r) throw new Error(`no printed control '${id}' on page ${side}`);
    return window.__book.screenOf(side, r.x + r.w / 2, r.y + r.h / 2);
  }, [side, id]);
  await page.mouse.click(at.x, at.y);
};

// click a tappable thing in the 3D figure, by the targetId its mesh carries
const clickTarget = async (page, id) => {
  const at = await page.evaluate((id) => {
    const m = window.__book.current().scene.targets().find((t) => t.userData.targetId === id);
    if (!m) throw new Error(`no target '${id}'`);
    return window.__book.project(m.getWorldPosition(m.position.clone()));
  }, id);
  await page.mouse.click(at.x, at.y);
};

const lessonSpreads = (page) => page.evaluate(() => window.__book.spreads.map((s, i) => (s.kind === 'lesson' ? i + 1 : 0)).filter(Boolean));
const stamped = (page) => page.evaluate(() => window.__book.current().state.stamped);

test('every spread opens with no console errors and nothing runs off a page', async ({ page }) => {
  const errors = await open(page, 'k=1&nowatch&still');
  const last = await page.evaluate(() => window.__book.LAST_SPREAD);
  for (let k = 2; k <= last; k++) {
    await page.evaluate((k) => window.__book.goTo(k), k);
    await page.waitForFunction((k) => window.__book.S.k === k, k, { timeout: 30_000 });
  }
  expect(errors).toEqual([]); // the page renderer reports overflowing text as a console error
});

test('sweep: every lesson survives its flap, every switch, every button and every target', async ({ page }) => {
  test.setTimeout(300_000);
  const errors = await open(page, 'k=1&nowatch&still');
  for (const k of await lessonSpreads(page)) {
    await page.evaluate(async (k) => {
      const b = window.__book;
      await b.goTo(k);
      const rt = b.current();
      const c = rt.content;
      b.actions.predict(0);
      b.actions.flap();
      const items = rt.scene.a11yItems().map((it) => it.id);
      for (const sw of c.switches ?? [{ id: null, options: [null] }]) for (let i = 0; i < sw.options.length; i++) {
        if (sw.id) await b.actions.setSwitch(sw.id, i);
        for (const btn of c.buttons ?? []) for (let n = 0; n < 12; n++) await b.actions.press(btn.id);
        for (const id of rt.scene.a11yItems().map((it) => it.id).concat(items)) b.actions.tap(id);
      }
    }, k);
  }
  expect(errors).toEqual([]);
});

test('content lint: every lesson is complete and self-consistent', async ({ page }) => {
  await open(page);
  const problems = await page.evaluate(async () => {
    const b = window.__book, out = [];
    const lessons = b.spreads.filter((s) => s.kind === 'lesson').map((s) => s.n);
    for (const n of lessons) {
      const l = b.lesson(n);
      for (const f of ['n', 'title', 'runningHead', 'why', 'idea', 'principle', 'keywords', 'predict', 'explain', 'watch', 'watchShots', 'figure', 'tryHint', 'challenge', 'margin', 'idealised', 'readNext', 'sources'])
        if (l[f] == null) out.push(`lesson ${n}: no ${f}`);
      if (l.n !== n) out.push(`lesson ${n}: its file says n = ${l.n}`);
      const p = l.predict;
      if (!(Number.isInteger(p.answer) && p.answer >= 0 && p.answer < p.options.length)) out.push(`lesson ${n}: answer out of range`);
      // options give no clue through their length
      const words = p.options.map((o) => o.split(/\s+/).length);
      if (new Set(words).size > 1) out.push(`lesson ${n}: options have ${words.join('/')} words`);
      for (const id of l.keywords) if (!b.glossary[id]) out.push(`lesson ${n}: keyword '${id}' not in glossary`);
      for (const id of [l.readNext, ...l.sources]) if (!b.sources[id]) out.push(`lesson ${n}: source '${id}' missing`);
      const rt = await b.ensureRuntime(n);
      const shots = rt.scene.shots();
      if (l.watch.length !== shots.length || l.watchShots.length !== shots.length) out.push(`lesson ${n}: ${l.watch.length} captions, ${l.watchShots.length} shot notes, ${shots.length} shots`);
      // every {placeholder} is documented, and every documented field is something the model reports
      const keys = Object.keys(rt.scene.sim.margin());
      for (const line of l.margin.lines) for (const [, key] of line.matchAll(/\{(\w+)\}/g))
        if (!(key in l.margin.fields)) out.push(`lesson ${n}: margin {${key}} not documented`);
      for (const key of Object.keys(l.margin.fields)) if (!keys.includes(key)) out.push(`lesson ${n}: margin field '${key}' not reported by the model`);
      for (const sw of l.switches ?? []) if (rt.scene.switchValue(sw.id) == null) out.push(`lesson ${n}: switch '${sw.id}' has no value`);
    }
    if (lessons.length >= 3 && new Set(lessons.map((n) => b.lesson(n).predict.answer)).size === 1) out.push('every lesson puts the right answer in the same place');
    return out;
  });
  expect(problems).toEqual([]);
});

test('printed controls: no peeking under the flap before predicting', async ({ page }) => {
  await open(page);
  await clickPrinted(page, 'L', 'flap');
  expect(await page.evaluate(() => window.__book.current().state.flapOpen)).toBe(false);
  await clickPrinted(page, 'L', 'predict:0');
  expect(await page.evaluate(() => window.__book.current().state.predict)).toBe(0);
  await clickPrinted(page, 'L', 'flap');
  expect(await page.evaluate(() => window.__book.current().state.flapOpen)).toBe(true);
});

test('arrow keys and the printed contents turn pages', async ({ page }) => {
  await open(page, 'k=1&nowatch&still');
  await clickPrinted(page, 'R', 'goto:2');
  await page.waitForFunction(() => window.__book.S.k === 2, null, { timeout: 30_000 });
  await page.locator('canvas#c').focus();
  await page.keyboard.press('ArrowRight');
  await page.waitForFunction(() => window.__book.S.k === 3, null, { timeout: 30_000 });
  await page.keyboard.press('ArrowLeft');
  await page.waitForFunction(() => window.__book.S.k === 2, null, { timeout: 30_000 });
});

test('watch: every lesson plays all its captions and hands back a fresh figure', async ({ page }) => {
  test.setTimeout(600_000);
  const errors = await open(page, 'k=1&nowatch&still');
  const seen = [];
  await page.exposeFunction('__seen', (t) => seen.push(t));
  await page.evaluate(() => {
    const cap = document.querySelector('.caption');
    new MutationObserver(() => !cap.hidden && window.__seen(cap.textContent)).observe(cap, { childList: true, subtree: true, attributes: true });
  });
  for (const k of await lessonSpreads(page)) {
    await page.evaluate((k) => window.__book.goTo(k), k);
    await page.waitForFunction((k) => window.__book.S.k === k, k, { timeout: 30_000 });
    const before = await page.evaluate(() => JSON.stringify(window.__book.current().scene.sim.margin()));
    await page.evaluate(() => window.__book.actions.watch());
    await page.waitForFunction(() => window.__book.watch.playing, null, { timeout: 5_000 });
    await page.waitForFunction(() => !window.__book.watch.playing, null, { timeout: 90_000 });
    const captions = await page.evaluate(() => window.__book.current().content.watch);
    for (const c of captions) expect(seen.some((s) => s.includes(c)), `spread ${k}: caption "${c}"`).toBe(true);
    expect(await page.evaluate(() => JSON.stringify(window.__book.current().scene.sim.margin())), `spread ${k}: the last shot resets the figure`).toBe(before);
  }
  expect(errors).toEqual([]);
});

test('fuzz: random pointer and key events on every spread raise no errors', async ({ page }) => {
  test.setTimeout(600_000);
  const errors = await open(page, 'k=1&nowatch&still');
  const seed = Number(process.env.FUZZ_SEED ?? Date.now() % 1e6);
  test.info().annotations.push({ type: 'seed', description: String(seed) });
  let s = seed;
  const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32);
  const box = await page.locator('canvas#c').boundingBox();
  const keys = ['ArrowLeft', 'ArrowRight', 'Escape', 'Tab', 'Enter'];
  const last = await page.evaluate(() => window.__book.LAST_SPREAD);
  for (let k = 1; k <= last; k++) {
    await page.evaluate((k) => window.__book.goTo(k), k);
    for (let i = 0; i < 60; i++) {
      const x = box.x + rnd() * box.width, y = box.y + rnd() * box.height * 0.88, a = rnd();
      if (a < 0.5) await page.mouse.click(x, y);
      else if (a < 0.85) await page.mouse.move(x, y);
      else await page.keyboard.press(keys[Math.floor(rnd() * keys.length)]);
    }
  }
  expect(errors, `seed ${seed}`).toEqual([]);
});

test('accessibility: the text version of every spread passes axe', async ({ page }) => {
  test.setTimeout(300_000);
  await open(page, 'k=1&nowatch&still');
  const last = await page.evaluate(() => window.__book.LAST_SPREAD);
  for (let k = 1; k <= last; k++) {
    await page.evaluate((k) => window.__book.goTo(k), k);
    await page.waitForFunction((k) => window.__book.S.k === k, k, { timeout: 30_000 });
    const r = await new AxeBuilder({ page }).include('#a11y').analyze();
    expect(r.violations.map((v) => `spread ${k} ${v.id}: ${v.help}`)).toEqual([]);
  }
});

// ---------- one test per lesson: its challenge met through real clicks, the way a reader does it ----------

test('lesson 1: tap a weight, then level the seesaw with the printed switch', async ({ page }) => {
  await open(page, 'k=2&nowatch&still');
  await clickTarget(page, 'counter');
  expect(await page.evaluate(() => window.__book.current().scene.sim.margin().sel)).toBe('the counterweight: 3 kg, 4 m right');
  await clickPrinted(page, 'R', 'switch:at:2'); // 3 m: still tips
  expect(await stamped(page)).toBe(false);
  await clickPrinted(page, 'R', 'switch:at:1'); // 2 m: level
  await expect.poll(() => stamped(page)).toBe(true);
});

test('lesson 1: the challenge through the text version only (screen reader path)', async ({ page }) => {
  await open(page, 'k=2&nowatch&still');
  const a11y = page.locator('#a11y');
  // the text version is visually hidden until focused, so drive it the way a keyboard user does
  await a11y.getByLabel('2 m').focus();
  await page.keyboard.press('Space');
  await expect(a11y.getByText(/Done: Seesaw balanced/)).toBeAttached();
  await expect(page.locator('#live')).toHaveText(/Challenge done/);
});
