// A shallow paper tray: an inked rim (a frame with a rectangular hole) on a thin floor.
// Used for the confusion-matrix cells, the in-trays of new messages and the unknown tray.
import * as THREE from 'three';
import { inked } from '../engine/ink.js';

export function trayGeometry(w, d, { rim = 0.32, wall = 0.1 } = {}) {
  const shape = new THREE.Shape();
  shape.moveTo(-w / 2, -d / 2); shape.lineTo(w / 2, -d / 2); shape.lineTo(w / 2, d / 2); shape.lineTo(-w / 2, d / 2);
  const hole = new THREE.Path();
  hole.moveTo(-w / 2 + wall, -d / 2 + wall); hole.lineTo(w / 2 - wall, -d / 2 + wall); hole.lineTo(w / 2 - wall, d / 2 - wall); hole.lineTo(-w / 2 + wall, d / 2 - wall);
  shape.holes.push(hole);
  const geo = new THREE.ExtrudeGeometry(shape, { depth: rim, bevelEnabled: false });
  geo.rotateX(-Math.PI / 2);
  return geo;
}

// floor top sits at FLOOR, so cards resting in the tray go at y = FLOOR + a little
export const FLOOR = 0.06;

export function createTray(w, d, { rim = 0.5, wall = 0.14, fill = '#f1e9d6', hatch = 0.7, ink, width = 1.4 } = {}) {
  const group = new THREE.Group();
  const floor = inked(new THREE.BoxGeometry(w, FLOOR, d), { fill, hatch: 0, width: 1 });
  floor.position.y = FLOOR / 2;
  floor.castShadow = false;
  const frame = inked(trayGeometry(w, d, { rim, wall }), { fill, hatch, ink, width, threshold: 40 });
  group.add(floor, frame);
  group.traverse((o) => (o.raycast = () => {}));
  return group;
}
