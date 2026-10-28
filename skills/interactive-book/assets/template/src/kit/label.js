// A handwritten label that always faces the reader, drawn over everything; set(text) rewrites it.
// The canvas keeps one size (a GPU texture cannot change size once uploaded); only the used width is shown.
import * as THREE from 'three';
import { HAND } from '../engine/page.js';

const LABEL_W = 1024;

export function floatLabel(color = '#1c2433', height = 0.62) {
  const c = document.createElement('canvas');
  c.width = LABEL_W;
  c.height = 90;
  const g = c.getContext('2d');
  const map = new THREE.CanvasTexture(c);
  map.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map, transparent: true, depthWrite: false, depthTest: false }));
  s.renderOrder = 10;
  s.raycast = () => {};
  s.set = (text, ink = color) => {
    g.clearRect(0, 0, LABEL_W, c.height);
    g.font = `600 62px ${HAND}`;
    const w = Math.min(LABEL_W, Math.ceil(g.measureText(text).width) + 24);
    g.fillStyle = 'rgba(251,247,238,0.85)';
    g.fillRect(0, 8, w, 76);
    g.fillStyle = ink;
    g.textBaseline = 'middle';
    g.fillText(text, 12, 48);
    map.repeat.x = w / LABEL_W;
    map.needsUpdate = true;
    s.scale.set((height * w) / c.height, height, 1);
    return s;
  };
  return s;
}
