// The small framed ink drawing on the title page. Draw the book's subject in a few strokes on a 2D canvas:
// fills in pale paper tones, one or two accent colours, ink outlines, hatching on the shaded side.
// (x, y, w, h) is the inner frame in page pixels; the page draws the frame around it.
export function frontispiece(g, x, y, w, h, { ink, accent }) {
  const cx = x + w / 2;
  const base = y + h - 40;
  // the pivot: a triangle, hatched on its shaded right face
  g.beginPath();
  g.moveTo(cx, base - 70); g.lineTo(cx - 40, base); g.lineTo(cx + 40, base); g.closePath();
  g.fillStyle = '#f1e6cc';
  g.fill();
  g.save();
  g.clip();
  g.strokeStyle = 'rgba(28,36,51,0.25)';
  g.lineWidth = 1;
  for (let i = 0; i < 90; i += 8) { g.beginPath(); g.moveTo(cx + i - 20, base); g.lineTo(cx + i + 20, base - 70); g.stroke(); }
  g.restore();
  // the hatch strokes replaced the current path: trace the triangle again for its outline
  g.beginPath();
  g.moveTo(cx, base - 70); g.lineTo(cx - 40, base); g.lineTo(cx + 40, base); g.closePath();
  g.strokeStyle = ink;
  g.lineWidth = 2;
  g.stroke();
  // the plank, tipped a little toward the heavier side
  g.save();
  g.translate(cx, base - 74);
  g.rotate(0.08);
  g.fillStyle = '#fdfaf1';
  g.fillRect(-130, -8, 260, 12);
  g.strokeRect(-130, -8, 260, 12);
  // a load and a counterweight
  for (const [dx, s, color] of [[-96, 34, '#e07a2f'], [70, 48, '#2a9d8f']]) {
    g.fillStyle = color;
    g.globalAlpha = 0.85;
    g.fillRect(dx - s / 2, -8 - s, s, s);
    g.globalAlpha = 1;
    g.strokeRect(dx - s / 2, -8 - s, s, s);
  }
  g.restore();
  g.fillStyle = accent;
  g.font = '700 46px Caveat, cursive';
  g.textAlign = 'center';
  g.fillText('?', cx, y + 64);
}
