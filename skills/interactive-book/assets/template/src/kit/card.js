// An index card with a short handwritten text (up to three lines): ruled paper, an optional coloured header,
// an optional "?" mark and a glow. Tappable: its mesh carries userData.targetId.
import * as THREE from 'three';
import { inked, halo, pageText, hatchMaterial } from '../engine/ink.js';
import { HAND, wrap } from '../engine/page.js';

export const CARD_W = 3.0;
export const CARD_D = 1.9;
const T = 0.05;

function drawFace(g, text, color) {
  const W = g.canvas.width, H = g.canvas.height;
  g.fillStyle = '#fdfaf1';
  g.fillRect(0, 0, W, H);
  g.fillStyle = color ?? 'rgba(0,0,0,0)';
  if (color) { g.globalAlpha = 0.85; g.fillRect(0, 0, W, 54); g.globalAlpha = 1; }
  g.strokeStyle = color ? 'rgba(0,0,0,0.25)' : 'rgba(200,60,60,0.7)';
  g.lineWidth = 3;
  g.beginPath(); g.moveTo(0, 56); g.lineTo(W, 56); g.stroke();
  g.strokeStyle = 'rgba(70,110,190,0.28)';
  g.lineWidth = 2;
  for (let y = 128; y < H; y += 66) { g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); }
  g.fillStyle = '#1c2433';
  g.font = `600 62px ${HAND}`;
  g.textBaseline = 'alphabetic';
  const lines = wrap(g, text, W - 40);
  if (lines.length > 3) console.error(`card text runs off the card: ${text}`); // the tests fail on console errors
  lines.slice(0, 3).forEach((l, i) => g.fillText(l, 20, 118 + i * 66));
}

export function createCard({ id, text: initial }) {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 324;
  const g = c.getContext('2d');
  drawFace(g, initial, null);
  const map = new THREE.CanvasTexture(c);
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = 8;
  const edge = hatchMaterial({ color: '#f1ead9' });
  // box faces: +x, -x, +y (the written face), -y, +z, -z
  const mats = [edge, edge, new THREE.MeshStandardMaterial({ map }), edge, edge, edge];
  const mesh = inked(new THREE.BoxGeometry(CARD_W, T, CARD_D), { material: mats, width: 1.2 });
  mesh.userData.targetId = id;

  const glow = halo('#ffffff', 3.6);
  glow.position.y = 0.4;
  glow.visible = false;
  mesh.add(glow);

  const mark = pageText('?', { width: 0.9, size: 120, color: '#b02626', weight: 700 });
  mark.position.set(CARD_W / 2 - 0.25, T / 2 + 0.02, -CARD_D / 2 + 0.2);
  mark.visible = false;
  mesh.add(mark);

  let color = null;
  let text = initial;
  return {
    id,
    mesh,
    setText(next) {
      if (next === text) return;
      text = next;
      drawFace(g, text, color);
      map.needsUpdate = true;
    },
    setColor(next) {
      if (next === color) return;
      color = next;
      drawFace(g, text, color);
      map.needsUpdate = true;
    },
    setMark(on) { mark.visible = on; },
    setGlow(next) {
      glow.visible = !!next;
      if (next) glow.material.color.set(next);
    },
  };
}
