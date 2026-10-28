// The "ink drawing" look: paper-coloured solids with drawn outlines, soft colour halos, handwriting on the page.
import * as THREE from 'three';
import { LineSegments2 } from 'three/addons/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/addons/lines/LineSegmentsGeometry.js';
import { Line2 } from 'three/addons/lines/Line2.js';
import { LineGeometry } from 'three/addons/lines/LineGeometry.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import { HAND, SERIF } from './page.js';

export const INK = '#1c2433';
const inkMats = new Set();
const res = new THREE.Vector2(1280, 800);

// one shared material per colour and width, so redrawing lines never piles up materials
const matCache = new Map();
export function inkMaterial(color = INK, width = 1.6) {
  const key = `${color}|${width}`;
  if (!matCache.has(key)) {
    const m = new LineMaterial({ color, linewidth: width });
    m.resolution.copy(res);
    inkMats.add(m);
    matCache.set(key, m);
  }
  return matCache.get(key);
}

// empties a group of drawn lines and labels, freeing their GPU memory (shared ink materials are kept)
export function clearGroup(group) {
  group.traverse((o) => {
    if (o === group) return;
    o.geometry?.dispose();
    if (o.material && !inkMats.has(o.material)) { o.material.map?.dispose(); o.material.dispose(); }
  });
  group.clear();
}

export function setInkResolution(w, h) {
  res.set(w, h);
  for (const m of inkMats) m.resolution.set(w, h);
}

// pencil hatching where the key light does not reach, drawn in world space so the strokes stay on the object;
// a face turned from the window gets fine single strokes; only the deepest shade gets a light second set
const HATCH_FRAG = `
  {
    float albedo = max(dot(diffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722)), 0.05);
    // an upward face in full window light reads 1 (sun irradiance 2.6 x 0.62 elevation, over pi)
    float lit = clamp(dot(reflectedLight.directDiffuse, vec3(0.2126, 0.7152, 0.0722)) / (albedo * 0.51), 0.0, 1.0);
    float shade = 1.0 - lit;
    float a = dot(vHatchPos, vec3(0.55, 0.64, 0.53)) * uHatchDensity;
    float b = dot(vHatchPos, vec3(-0.66, 0.38, 0.65)) * uHatchDensity;
    float strokes = hatchLine(a, 0.13 * smoothstep(0.35, 0.9, shade)) + 0.6 * hatchLine(b, 0.1 * smoothstep(0.93, 1.0, shade));
    outgoingLight = mix(outgoingLight, uHatchInk * 0.5, clamp(strokes, 0.0, 1.0) * 0.42 * uHatch);
  }
  #include <opaque_fragment>`;

// hatch: stroke strength, 1 for broad solids, lower for thin parts where strokes turn to noise
export function hatchMaterial({ color = '#fbf7ee', map = null, density = 3.4, ink = INK, roughness = 0.9, hatch = 1 } = {}) {
  const m = new THREE.MeshStandardMaterial({ color, map, roughness });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uHatchDensity = { value: density };
    sh.uniforms.uHatch = { value: hatch };
    sh.uniforms.uHatchInk = { value: new THREE.Color(ink) };
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vHatchPos;')
      .replace('#include <project_vertex>', '#include <project_vertex>\nvHatchPos = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
        varying vec3 vHatchPos;
        uniform float uHatchDensity;
        uniform float uHatch;
        uniform vec3 uHatchInk;
        float hatchLine(float t, float hw) { float d = abs(fract(t + 0.5) - 0.5); float w = fwidth(t); return 1.0 - smoothstep(hw - w, hw + w, d); }`)
      .replace('#include <opaque_fragment>', HATCH_FRAG);
  };
  m.customProgramCacheKey = () => 'hatch';
  return m;
}

export function inked(geometry, { fill = '#fbf7ee', ink = INK, width = 1.6, threshold = 25, material = null, hatch = 1 } = {}) {
  const mesh = new THREE.Mesh(geometry, material ?? (hatch ? hatchMaterial({ color: fill, hatch }) : new THREE.MeshStandardMaterial({ color: fill, roughness: 0.9 })));
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  const edges = new LineSegmentsGeometry().fromEdgesGeometry(new THREE.EdgesGeometry(geometry, threshold));
  const lines = new LineSegments2(edges, inkMaterial(ink, width));
  lines.raycast = () => {}; // taps should hit the solid, not its outline
  mesh.add(lines);
  return mesh;
}

// closed ink loop through points [[x, z], ...] lying on the page
export function inkLoop(points, { color = INK, width = 2.2, y = 0.04 } = {}) {
  const flat = [];
  for (const [x, z] of [...points, points[0]]) flat.push(x, y, z);
  const geo = new LineGeometry();
  geo.setPositions(flat);
  const line = new Line2(geo, inkMaterial(color, width));
  line.raycast = () => {};
  return line;
}

let haloTex = null;
export function halo(color, size = 3) {
  if (!haloTex) {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const g = c.getContext('2d');
    const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.35, 'rgba(255,255,255,0.55)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 128, 128);
    haloTex = new THREE.CanvasTexture(c);
  }
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: haloTex, color, transparent: true, depthWrite: false, opacity: 0.6 }));
  s.scale.set(size, size, 1);
  s.raycast = () => {};
  return s;
}

// handwriting or print lying flat on the page; width in world units
export function pageText(text, { width = 6, size = 72, hand = true, color = INK, weight = 400, align = 'left' } = {}) {
  const c = document.createElement('canvas');
  const g = c.getContext('2d');
  const f = `${weight} ${size}px ${hand ? HAND : SERIF}`;
  g.font = f;
  const lines = String(text).split('\n');
  c.width = Math.ceil(Math.max(...lines.map((l) => g.measureText(l).width)) + 16);
  c.height = Math.ceil(lines.length * size * 1.15 + 12);
  g.font = f;
  g.fillStyle = color;
  g.textBaseline = 'top';
  g.textAlign = align;
  lines.forEach((l, i) => g.fillText(l, align === 'center' ? c.width / 2 : 8, 6 + i * size * 1.15));
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const h = (width * c.height) / c.width;
  // lit like the paper it is written on, so window shadows fall across it too
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, h), new THREE.MeshStandardMaterial({ map: tex, transparent: true, depthWrite: false, roughness: 0.95 }));
  mesh.rotation.x = -Math.PI / 2;
  mesh.raycast = () => {};
  return mesh;
}

// an ink line through 3D points [[x, y, z], ...]
export function inkPath(points, { color = INK, width = 1.8 } = {}) {
  const geo = new LineGeometry();
  geo.setPositions(points.flat());
  const line = new Line2(geo, inkMaterial(color, width));
  line.raycast = () => {};
  return line;
}

// ink outline of a box, like a drawn glass case
export function inkBox(w, h, d, { color = INK, width = 1.6 } = {}) {
  const edges = new LineSegmentsGeometry().fromEdgesGeometry(new THREE.EdgesGeometry(new THREE.BoxGeometry(w, h, d)));
  const lines = new LineSegments2(edges, inkMaterial(color, width));
  lines.raycast = () => {};
  return lines;
}
