// Draws the printed pages onto canvases (50 px per world unit) and records tappable regions.
import { frontispiece } from '../content/frontispiece.js';

export const CW = 1050;
export const CH = 1400;
const M = 90; // outer margin
const INK = '#1c2433';
const INK2 = 'rgba(28,36,51,0.64)';
const ACCENT = '#9a3b2a';
const PAPER = '#fcfaf5';
export const SERIF = '"Source Serif 4 Variable", Georgia, serif';
export const HAND = 'Caveat, "Segoe Print", cursive';

export function newSurface() {
  const canvas = document.createElement('canvas');
  canvas.width = CW;
  canvas.height = CH;
  return { canvas, g: canvas.getContext('2d'), regions: [], overflow: false };
}

function font(g, { size = 28, weight = 400, italic = false, hand = false } = {}) {
  g.font = `${italic ? 'italic ' : ''}${weight} ${size}px ${hand ? HAND : SERIF}`;
}

export function wrap(g, str, maxW) {
  const lines = [];
  for (const para of String(str).split('\n')) {
    let line = '';
    for (const word of para.split(' ')) {
      const next = line ? `${line} ${word}` : word;
      if (line && g.measureText(next).width > maxW) { lines.push(line); line = word; } else line = next;
    }
    lines.push(line);
  }
  return lines;
}

// writes wrapped text, returns the y below it
function para(g, str, x, y, maxW, opt = {}) {
  font(g, opt);
  g.fillStyle = opt.color ?? INK;
  g.textAlign = opt.align ?? 'left';
  g.textBaseline = 'alphabetic';
  const lh = opt.lh ?? Math.round((opt.size ?? 28) * 1.42);
  for (const line of wrap(g, str, maxW)) { g.fillText(line, x, y); y += lh; }
  return y;
}

function label(g, str, x, y, color = ACCENT) {
  font(g, { size: 19, weight: 700 });
  g.fillStyle = color;
  g.textAlign = 'left';
  if ('letterSpacing' in g) g.letterSpacing = '3px';
  g.fillText(str.toUpperCase(), x, y);
  if ('letterSpacing' in g) g.letterSpacing = '0px';
}

function roundRect(g, x, y, w, h, r) {
  g.beginPath();
  g.roundRect(x, y, w, h, r);
}

function paper(s, side) {
  const { g } = s;
  g.fillStyle = PAPER;
  g.fillRect(0, 0, CW, CH);
  // shade toward the spine so the spread reads as one curved book
  const spineX = side === 'L' ? CW : 0;
  const grad = g.createLinearGradient(spineX, 0, side === 'L' ? CW - 140 : 140, 0);
  grad.addColorStop(0, 'rgba(90,70,40,0.22)');
  grad.addColorStop(1, 'rgba(90,70,40,0)');
  g.fillStyle = grad;
  g.fillRect(side === 'L' ? CW - 140 : 0, 0, 140, CH);
  let seed = side === 'L' ? 11 : 23;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 2600; i++) {
    g.fillStyle = `rgba(120,100,70,${0.03 + rnd() * 0.05})`;
    g.fillRect(rnd() * CW, rnd() * CH, 1 + rnd() * 2, 1);
  }
}

function folio(s, n, side) {
  font(s.g, { size: 22 });
  s.g.fillStyle = INK2;
  s.g.textAlign = side === 'L' ? 'left' : 'right';
  s.g.fillText(String(n), side === 'L' ? M : CW - M, CH - 50);
}

function check(s, y) {
  if (y > CH - 70) s.overflow = true;
  return y;
}

function pill(s, id, text, x, y, on) {
  const { g } = s;
  font(g, { size: 23, weight: 600 });
  const w = g.measureText(text).width + 36;
  roundRect(g, x, y - 30, w, 42, 21);
  g.fillStyle = on ? INK : 'rgba(255,255,255,0.5)';
  g.fill();
  g.lineWidth = 2;
  g.strokeStyle = INK;
  g.stroke();
  g.fillStyle = on ? PAPER : INK;
  g.textAlign = 'left';
  g.fillText(text, x + 18, y - 1);
  s.regions.push({ id, x, y: y - 30, w, h: 42 });
  return x + w + 12;
}

function stamp(g, x, y, text) {
  g.save();
  g.translate(x, y);
  g.rotate(-0.18);
  g.strokeStyle = 'rgba(176,38,38,0.85)';
  g.fillStyle = 'rgba(176,38,38,0.85)';
  g.lineWidth = 4;
  g.beginPath();
  g.arc(0, 0, 62, 0, Math.PI * 2);
  g.stroke();
  g.lineWidth = 1.5;
  g.beginPath();
  g.arc(0, 0, 53, 0, Math.PI * 2);
  g.stroke();
  font(g, { size: 26, weight: 800 });
  g.textAlign = 'center';
  g.fillText('DONE', 0, 9);
  font(g, { size: 14, weight: 600 });
  g.fillText(text.slice(0, 22).toUpperCase(), 0, 34);
  g.restore();
}

// ---------- lesson spread ----------

export function drawLessonLeft(s, { lesson, glossary, sources, state, folioN }) {
  const { g } = s;
  paper(s, 'L');
  const W = CW - 2 * M;
  label(g, `Lesson ${lesson.n}`, M, 86);
  font(g, { size: 19, weight: 700 });
  const lw = g.measureText(`LESSON ${lesson.n}`).width + 30;
  label(g, `· ${lesson.runningHead}`, M + lw, 86, INK2);
  let y = para(g, lesson.title, M, 160, W, { size: 56, weight: 600, lh: 62 });
  y += 4;
  for (const p of lesson.idea) y = para(g, p, M, y, W, { size: 27, lh: 35 }) + 6;

  // the principle, boxed like the key equation in a physics book
  font(g, { size: 26, italic: true });
  const pl = wrap(g, lesson.principle, W - 56);
  const ph = pl.length * 36 + 34;
  roundRect(g, M, y, W, ph, 10);
  g.fillStyle = 'rgba(255,255,255,0.45)';
  g.fill();
  g.strokeStyle = 'rgba(28,36,51,0.5)';
  g.lineWidth = 1.5;
  g.stroke();
  para(g, lesson.principle, M + 28, y + 44, W - 56, { size: 26, italic: true, lh: 36 });
  y += ph + 40;

  label(g, 'Key words', M, y);
  y += 32;
  for (const id of lesson.keywords) {
    const k = glossary[id];
    font(g, { size: 23, weight: 700 });
    const tw = g.measureText(k.term).width;
    g.fillStyle = INK;
    g.textAlign = 'left';
    g.fillText(k.term, M, y);
    y = para(g, k.definition, M + tw + 14, y, W - tw - 14, { size: 22, italic: true, color: INK2, lh: 28 }) + 2;
  }
  y += 8;
  const rs = sources[lesson.readNext];
  y = para(g, `Read next: ${lesson.readNextLabel ?? rs.title}`, M, y, W, { size: 21, italic: true, color: INK2, lh: 29 }) + 18;

  label(g, 'Predict', M, y);
  y = para(g, lesson.predict.question, M, y + 36, W, { size: 26, weight: 600, lh: 35 }) + 2;
  const answered = state.flapOpen;
  lesson.predict.options.forEach((opt, i) => {
    const top = y - 26;
    g.lineWidth = 2;
    g.strokeStyle = INK;
    g.strokeRect(M + 4, top + 2, 24, 24);
    if (state.predict === i) {
      g.lineWidth = 3.5;
      g.beginPath();
      g.moveTo(M + 8, top + 14);
      g.lineTo(M + 15, top + 22);
      g.lineTo(M + 30, top - 2);
      g.stroke();
    }
    para(g, opt, M + 44, y, W - 44, { size: 25 });
    if (answered && i === lesson.predict.answer) para(g, '← yes', M + 520, y, 300, { size: 32, hand: true, color: ACCENT });
    else if (answered && i === state.predict) para(g, '← not this one', M + 520, y, 300, { size: 32, hand: true, color: INK2 });
    s.regions.push({ id: `predict:${i}`, x: M, y: top - 6, w: W, h: 42 });
    y += 40;
  });

  // the flap: closed until a prediction is made, then it holds the explanation
  y += 10;
  const fh = 166;
  roundRect(g, M, y, W, fh, 6);
  g.fillStyle = state.flapOpen ? 'rgba(255,255,255,0.75)' : '#efe3c4';
  g.fill();
  g.lineWidth = 1.5;
  g.strokeStyle = 'rgba(28,36,51,0.45)';
  g.stroke();
  label(g, 'Why?', M + 24, y + 38);
  if (state.flapOpen) {
    font(g, { size: 21 });
    if (70 + (wrap(g, lesson.explain, W - 48).length - 1) * 27 + 8 > fh) s.overflow = true; // last baseline plus descenders must fit under the flap
    para(g, lesson.explain, M + 24, y + 70, W - 48, { size: 21, lh: 27 });
  } else {
    para(g, 'Lift the flap to see the answer', M + 24, y + 86, W - 48, { size: 31, weight: 600 });
    para(g, '…after you have made your prediction.', M + 24, y + 124, W - 48, { size: 22, italic: true, color: INK2 });
    para(g, state.flapNudge ? 'predict first ↑' : 'lift here ↘', M + W - 200, y + 40, 200, { size: 30, hand: true, color: ACCENT });
  }
  s.regions.push({ id: 'flap', x: M, y, w: W, h: fh });
  y += fh + 38;

  label(g, 'Challenge', M, y);
  const end = para(g, lesson.challenge.text, M, y + 34, W - 170, { size: 29, hand: true, color: ACCENT, lh: 30 });
  if (state.stamped) stamp(g, CW - M - 75, y + 10, lesson.challenge.done);
  check(s, end - 30 + 8); // bottom of the last line, descenders included
  folioN && folio(s, folioN, 'L');
}

export function drawLessonRight(s, { lesson, state, margin, folioN }) {
  const { g } = s;
  paper(s, 'R');
  label(g, `Lesson ${lesson.n} · ${lesson.title}`, M, 70, INK2);

  const top = 1150;
  const colW = 470;
  let y = para(g, `Fig. ${lesson.n}  ${lesson.figure}`, M, top, colW, { size: 22, italic: true, color: INK2, lh: 30 });
  y = para(g, lesson.tryHint, M, y + 4, colW, { size: 24, lh: 32 }) + 22;
  for (const sw of lesson.switches ?? []) {
    font(g, { size: 21, weight: 700 });
    g.fillStyle = INK2;
    g.textAlign = 'left';
    g.fillText(sw.label, M, y);
    let x = M + g.measureText(sw.label).width + 14;
    sw.options.forEach((o, i) => { x = pill(s, `switch:${sw.id}:${i}`, o, x, y + 1, state.switches[sw.id] === i); });
    if (x > 590) s.overflow = true; // controls must stay clear of the margin column
    y += 56;
  }
  let bx = M;
  for (const b of lesson.buttons ?? []) bx = pill(s, `button:${b.id}`, b.label, bx, y + 1, false);
  if (pill(s, 'watch', '▸ Watch', bx, y + 1, false) > 590) s.overflow = true;

  // live working, handwritten in the margin
  let my = top - 6;
  for (const line of margin) {
    my = para(g, line.text, 600, my, CW - M - 600, { size: line.size ?? 29, hand: true, color: line.color ?? INK, lh: 29 }) + (line.gap ?? 2);
  }
  check(s, Math.max(y, my));
  folioN && folio(s, folioN, 'R');
}

// ---------- front and back matter ----------

// the title page's framed ink drawing: the frame here, the drawing from content/frontispiece.js
function framedDrawing(g, x, y, w, h) {
  g.save();
  g.fillStyle = 'rgba(255,255,255,0.55)';
  g.fillRect(x, y, w, h);
  g.strokeStyle = 'rgba(28,36,51,0.7)';
  g.lineWidth = 2;
  g.strokeRect(x, y, w, h);
  g.lineWidth = 1;
  g.strokeRect(x + 8, y + 8, w - 16, h - 16);
  g.restore();
  g.save();
  g.beginPath();
  g.rect(x + 9, y + 9, w - 18, h - 18);
  g.clip();
  g.lineJoin = 'round';
  frontispiece(g, x + 9, y + 9, w - 18, h - 18, { ink: INK, accent: ACCENT, paper: PAPER });
  g.restore();
}

const HOW_TO = [
  'Make a prediction before you read on.',
  'Watch the drawing lift off the page.',
  'Try it: flip the switches, tap the drawing.',
  'Lift the flap to see why.',
  'Meet the challenge to earn the stamp.',
];

export function drawTitlePage(s, { book }) {
  const { g } = s;
  paper(s, 'L');
  const cx = CW / 2;
  g.save();
  g.textAlign = 'center';
  font(g, { size: 19, weight: 700 });
  g.fillStyle = ACCENT;
  if ('letterSpacing' in g) g.letterSpacing = '3px';
  g.fillText(book.overline.toUpperCase(), cx, 300);
  if ('letterSpacing' in g) g.letterSpacing = '0px';
  g.restore();
  para(g, book.title, cx, 410, CW - 2 * M, { size: 112, italic: true, weight: 500, align: 'center', lh: 120 });
  g.strokeStyle = ACCENT;
  g.lineWidth = 2.5;
  g.beginPath();
  g.moveTo(cx - 170, 450);
  g.bezierCurveTo(cx - 60, 430, cx + 40, 470, cx + 170, 442);
  g.stroke();
  para(g, book.subtitle, cx, 520, CW - 2 * M, { size: 34, align: 'center' });
  para(g, book.tagline, cx, 568, CW - 2 * M, { size: 25, italic: true, color: INK2, align: 'center' });
  framedDrawing(g, cx - 170, 620, 340, 300);
  label(g, 'How to use this book', M + 60, 1000);
  let y = 1044;
  for (const line of HOW_TO) y = para(g, line, M + 60, y, CW - 2 * M - 120, { size: 27, italic: true, lh: 38 });
  para(g, book.imprint, cx, CH - 70, CW - 2 * M, { size: 20, color: INK2, align: 'center' });
}

// a contents line: title, a dotted leader, and the page it starts on
function contentsLine(g, n, title, page, y) {
  font(g, { size: 30, weight: 600 });
  g.fillStyle = INK;
  g.textAlign = 'left';
  if (n) {
    font(g, { size: 24, weight: 700 });
    g.fillStyle = ACCENT;
    g.fillText(String(n), M, y);
    font(g, { size: 30, weight: 600 });
    g.fillStyle = INK;
  }
  g.fillText(title, M + 52, y);
  const tw = g.measureText(title).width;
  font(g, { size: 28 });
  g.textAlign = 'right';
  g.fillText(String(page), CW - M, y);
  const pw = g.measureText(String(page)).width;
  g.fillStyle = INK2;
  g.textAlign = 'left';
  for (let x = M + 52 + tw + 18; x < CW - M - pw - 14; x += 12) g.fillRect(x, y - 4, 2.5, 2.5);
}

export function drawContents(s, { book, available, onLessonSpread, backSpread, legend, folioN }) {
  const { g } = s;
  paper(s, 'R');
  let y = para(g, 'Contents', M, 170, CW - 2 * M, { size: 58, weight: 600 }) + 22;
  const pageOf = (k) => 2 * k - 2; // the left page of spread k
  book.lessons.forEach((t, i) => {
    const n = i + 1;
    if (!available.includes(n)) return;
    contentsLine(g, n, t, pageOf(onLessonSpread(n)), y);
    s.regions.push({ id: `goto:${onLessonSpread(n)}`, x: M, y: y - 34, w: CW - 2 * M, h: 48 });
    y += 58;
  });
  y += 18;
  contentsLine(g, null, 'Sources and index', pageOf(backSpread), y);
  s.regions.push({ id: `goto:${backSpread}`, x: M, y: y - 34, w: CW - 2 * M, h: 48 });
  y += 74;
  // the colour key: each group of swatches with a one-line note (book.json "legend"; leave it out for none)
  if (legend?.length) {
    label(g, 'Colours in this book', M, y);
    y += 40;
    for (const { items, note } of legend) {
      let x = M;
      for (const it of items) {
        g.fillStyle = it.color;
        roundRect(g, x, y - 22, 30, 26, 5);
        g.fill();
        if (it.name) {
          font(g, { size: 22 });
          g.fillStyle = INK;
          g.textAlign = 'left';
          g.fillText(it.name, x + 40, y);
          x += 40 + g.measureText(it.name).width + 26;
        } else x += 44;
      }
      if (x > CW - M) s.overflow = true;
      para(g, note, M, y + 38, CW - 2 * M, { size: 21, italic: true, color: INK2 });
      y += 100;
    }
    y -= 100; // back to the last row, so the check below measures its note
  }
  check(s, y + 38);
  folioN && folio(s, folioN, 'R');
}

const BOTTOM = CH - 90; // back-matter entries stop here and continue on the next page
const linesOf = (g, str, w, opt) => { font(g, opt); return wrap(g, str, w).length; };

// draws as many sources as fit, numbered from `first`; returns how many it drew
export function drawSources(s, { list, first = 1, side = 'L', folioN }) {
  const { g } = s;
  paper(s, side);
  const W = CW - 2 * M - 40;
  let y = para(g, first === 1 ? 'Sources' : 'Sources, continued', M, 170, CW - 2 * M, { size: first === 1 ? 56 : 44, weight: 600 }) + 20;
  let drawn = 0;
  for (const src of list) {
    const url = src.url.replace(/^https?:\/\//, '');
    const h = linesOf(g, src.title, W, { size: 22, weight: 600 }) * 29 + linesOf(g, `${src.publisher} · read ${src.accessed}`, W, { size: 19 }) * 26 + linesOf(g, url, W, { size: 17 }) * 24 + 16;
    if (y + h - 29 > BOTTOM) break;
    font(g, { size: 22, weight: 700 });
    g.fillStyle = ACCENT;
    g.textAlign = 'left';
    g.fillText(`${first + drawn}`, M, y);
    y = para(g, src.title, M + 40, y, W, { size: 22, weight: 600, lh: 29 });
    y = para(g, `${src.publisher} · read ${src.accessed}`, M + 40, y, W, { size: 19, color: INK2, lh: 26 });
    y = para(g, url, M + 40, y, W, { size: 17, color: INK2, lh: 24 }) + 16;
    drawn++;
  }
  folioN && folio(s, folioN, side);
  return drawn;
}

export function drawBlank(s, { side, folioN }) {
  paper(s, side);
  folioN && folio(s, folioN, side);
}

// draws as many index entries as fit; returns how many it drew
export function drawIndex(s, { entries, cont = false, side = 'R', folioN }) {
  const { g } = s;
  paper(s, side);
  let y = para(g, cont ? 'Index, continued' : 'Index of key words', M, 170, CW - 2 * M, { size: cont ? 44 : 50, weight: 600 }) + 20;
  let drawn = 0;
  for (const e of entries) {
    if (y + 32 + linesOf(g, e.definition, CW - 2 * M - 160, { size: 21, italic: true }) * 28 - 28 > BOTTOM) break;
    drawn++;
    font(g, { size: 24, weight: 700 });
    g.fillStyle = INK;
    g.textAlign = 'left';
    g.fillText(e.term, M, y);
    para(g, `lesson ${e.lessons.join(', ')}`, CW - M, y, 300, { size: 22, color: INK2, align: 'right' });
    y = para(g, e.definition, M, y + 32, CW - 2 * M - 160, { size: 21, italic: true, color: INK2, lh: 28 }) + 14;
  }
  folioN && folio(s, folioN, side);
  return drawn;
}
