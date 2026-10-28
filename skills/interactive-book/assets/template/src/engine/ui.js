// HTML around the 3D book: the control capsule, watch captions, the hover tip and the text version.
function h(tag, attrs = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (v === true) el.setAttribute(k, '');
    else if (v !== false && v != null) el.setAttribute(k, v);
  }
  for (const kid of kids.flat()) if (kid != null) el.append(kid);
  return el;
}

export function createUI({ actions }) {
  const root = document.getElementById('ui');
  const a11y = document.getElementById('a11y');
  const live = document.getElementById('live');

  const btn = (label, icon, on) => h('button', { class: 'ic', type: 'button', 'aria-label': label, title: label, onclick: on }, icon);
  const prev = btn('Previous spread', '‹', () => actions.prev());
  const next = btn('Next spread', '›', () => actions.next());
  const watch = btn('Watch this lesson', '▸', () => actions.watch());
  const still = btn('Still mode (stop all motion)', '◐', () => actions.toggleStill());
  const title = h('span', { class: 'title' });
  const capsule = h('nav', { class: 'glass capsule', 'aria-label': 'Book controls' },
    btn('Contents', '☰', () => actions.goTo(1)), prev, title, next, h('span', { class: 'sep' }), watch, still);
  const caption = h('div', { class: 'glass caption', role: 'status', hidden: true });
  const tip = h('div', { class: 'tip', 'aria-hidden': 'true', hidden: true });
  root.append(capsule, caption, tip);

  let dyn = null; // live parts of the text version for the current lesson

  // the list of tappable things in the figure; some lessons deal different ones over time, so it is rebuilt when the set changes
  function fillList(list, cards, items) {
    cards.clear();
    list.replaceChildren(...items.map((it) => {
      const status = h('span', {}, ` · ${it.status}`);
      const b = h('button', { type: 'button', 'aria-pressed': 'false', onclick: () => actions.tap(it.id) }, it.label);
      cards.set(it.id, { b, status });
      return h('li', {}, b, status);
    }));
  }

  function renderLesson(m) {
    const { content: c, glossary, sources } = m;
    const predict = c.predict.options.map((o, i) => h('label', {}, h('input', { type: 'radio', name: 'predict', value: i, onchange: () => actions.predict(i) }), ` ${o}`));
    const explain = h('p', { hidden: true }, c.explain);
    const flap = h('button', { type: 'button', 'aria-expanded': 'false', onclick: () => actions.flap() }, 'Lift the flap: why?');
    const switches = (c.switches ?? []).map((sw) => h('fieldset', {}, h('legend', {}, sw.label),
      sw.options.map((o, i) => h('label', {}, h('input', { type: 'radio', name: `sw-${sw.id}`, value: i, onchange: () => actions.setSwitch(sw.id, i) }), ` ${o}`))));
    const cards = new Map();
    const list = h('ul', {});
    fillList(list, cards, m.items);
    const margin = h('p', { 'aria-live': 'polite' });
    const challenge = h('p', {});
    const rs = sources[c.readNext];
    a11y.replaceChildren(
      h('h2', {}, `Lesson ${c.n}: ${c.title}`),
      h('p', {}, h('em', {}, c.why)),
      ...c.idea.map((p) => h('p', {}, p)),
      h('p', {}, h('strong', {}, 'In one line: '), c.principle),
      h('h3', {}, 'Key words'),
      h('dl', {}, c.keywords.flatMap((id) => [h('dt', {}, glossary[id].term), h('dd', {}, glossary[id].definition)])),
      h('p', {}, 'Read next: ', h('a', { href: rs.url, target: '_blank', rel: 'noopener' }, rs.title), ` (${rs.publisher})`),
      h('fieldset', {}, h('legend', {}, `Predict: ${c.predict.question}`), predict),
      flap, explain,
      h('h3', {}, `Figure: ${c.figure}`),
      h('p', {}, c.tryHint),
      ...switches,
      ...(c.buttons ?? []).map((b) => h('p', {}, h('button', { type: 'button', onclick: () => actions.press(b.id) }, b.text ?? b.label))),
      h('p', {}, h('button', { type: 'button', onclick: () => actions.watch() }, 'Watch the lesson (five camera shots)')),
      h('h3', {}, c.itemsHeading ?? 'In the figure'), list,
      h('h3', {}, 'Margin'), margin,
      h('h3', {}, 'Challenge'), challenge,
      h('p', {}, h('em', {}, `What this figure leaves out: ${c.idealised}`)),
    );
    dyn = { c, predict, explain, flap, cards, list, margin, challenge };
  }

  function renderFront(m) {
    a11y.replaceChildren(
      h('h2', {}, m.book.title), h('p', {}, m.book.subtitle),
      h('h3', {}, 'Contents'),
      h('ol', {}, m.book.lessons.map((t, i) => h('li', {}, m.available.includes(i + 1)
        ? h('button', { type: 'button', onclick: () => actions.goTo(m.spreadOfLesson(i + 1)) }, t)
        : `${t} (in preparation)`))),
      h('p', {}, h('button', { type: 'button', onclick: () => actions.goTo(m.last) }, 'Sources and index')),
    );
    dyn = null;
  }

  function renderBack(m) {
    a11y.replaceChildren(
      h('h2', {}, 'Sources'),
      h('ol', {}, m.sources.map((s) => h('li', {}, h('a', { href: s.url, target: '_blank', rel: 'noopener' }, s.title), ` · ${s.publisher}, read ${s.accessed}`))),
      h('h2', {}, 'Index of key words'),
      h('dl', {}, m.index.flatMap((e) => [h('dt', {}, `${e.term} (lesson ${e.lessons.join(', ')})`), h('dd', {}, e.definition)])),
    );
    dyn = null;
  }

  return {
    setNav({ k, last, label, isLesson }) {
      title.textContent = label;
      prev.disabled = k <= 1;
      next.disabled = k >= last;
      watch.disabled = !isLesson;
    },
    caption(text, i, n) {
      caption.hidden = !text;
      if (text) caption.replaceChildren(h('span', { class: 'dots' }, Array.from({ length: n }, (_, j) => (j === i ? '●' : '○')).join(' ')), h('span', {}, text), h('span', { class: 'skip' }, 'Esc to skip'));
    },
    tip(text, x, y) {
      tip.hidden = !text;
      if (text) { tip.textContent = text; tip.style.left = `${x + 14}px`; tip.style.top = `${y + 14}px`; }
    },
    announce(text) { live.textContent = ''; requestAnimationFrame(() => (live.textContent = text)); },
    setStill(on) { still.setAttribute('aria-pressed', String(on)); },
    render(m) {
      if (m.kind === 'lesson') renderLesson(m);
      else if (m.kind === 'front') renderFront(m);
      else renderBack(m);
      this.update(m);
    },
    update(m) {
      if (!dyn || m.kind !== 'lesson') return;
      const { state, switches, items, margin, challenge } = m;
      dyn.predict.forEach((l, i) => (l.firstChild.checked = state.predict === i));
      dyn.flap.setAttribute('aria-expanded', String(state.flapOpen));
      dyn.explain.hidden = !state.flapOpen;
      for (const [id, v] of Object.entries(switches))
        a11y.querySelectorAll(`input[name="sw-${id}"]`).forEach((inp, i) => (inp.checked = v === i));
      if (items.length !== dyn.cards.size || items.some((it) => !dyn.cards.has(it.id))) fillList(dyn.list, dyn.cards, items);
      for (const it of items) {
        const row = dyn.cards.get(it.id);
        row.status.textContent = ` · ${it.status}`;
        row.b.setAttribute('aria-pressed', String(it.selected));
      }
      dyn.margin.textContent = margin.map((l) => l.text).join(' · ') || '(nothing yet)';
      dyn.challenge.textContent = `${dyn.c.challenge.text} ${challenge.met ? `Done: ${dyn.c.challenge.done}.` : 'Not done yet.'}`;
    },
  };
}
