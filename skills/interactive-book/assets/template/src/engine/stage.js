// Renderer, desk, window light, camera rig, post-processing and a tiny tween runner shared by the book and the lesson scenes.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { VignetteShader } from 'three/addons/shaders/VignetteShader.js';

export const PAGE_W = 21;
export const PAGE_H = 28;
export const PAGE_TOP = 1.0; // height of the open pages above the desk

const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

export function createTweens() {
  const list = new Set();
  return {
    still: false,
    // run(update(k), seconds) -> promise; in still mode it jumps straight to the end
    run(update, seconds = 0.8, { linear = false } = {}) {
      if (this.still || seconds <= 0) { update(1); return Promise.resolve(); }
      return new Promise((done) => list.add({ t: 0, seconds, update, done, linear }));
    },
    step(dt) {
      for (const tw of list) {
        tw.t = Math.min(1, tw.t + dt / tw.seconds);
        tw.update(tw.linear ? tw.t : ease(tw.t));
        if (tw.t >= 1) { list.delete(tw); tw.done(); }
      }
    },
    get busy() { return list.size > 0; },
  };
}

// seeded random, so textures are the same on every load
function rng(seed) {
  let s = seed;
  return () => ((s = (s * 16807) % 2147483647) / 2147483647);
}

// pale oak planks running across the desk
function deskTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 1024;
  const g = c.getContext('2d');
  const rnd = rng(7);
  const plank = 128;
  for (let y = 0; y < 1024; y += plank) {
    const tone = 226 + Math.round(rnd() * 12);
    g.fillStyle = `rgb(${tone},${tone - 7},${tone - 18})`;
    g.fillRect(0, y, 1024, plank);
    for (let i = 0; i < 60; i++) {
      const yy = y + rnd() * plank;
      g.strokeStyle = `rgba(140,112,80,${0.03 + rnd() * 0.07})`;
      g.lineWidth = 0.6 + rnd() * 1.6;
      g.beginPath();
      g.moveTo(0, yy);
      for (let x = 0; x <= 1024; x += 64) g.lineTo(x, yy + Math.sin((x + i * 37) * 0.012) * 2.5);
      g.stroke();
    }
    g.fillStyle = 'rgba(110,88,60,0.35)';
    g.fillRect(0, y, 1024, 2); // the seam between planks
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(4, 4);
  t.anisotropy = 8;
  return t;
}

// felt mat: a rounded slab with a faint fibre noise
function matMesh() {
  const w = 66, d = 46, r = 2.2;
  const shape = new THREE.Shape();
  shape.moveTo(-w / 2 + r, -d / 2);
  shape.lineTo(w / 2 - r, -d / 2);
  shape.quadraticCurveTo(w / 2, -d / 2, w / 2, -d / 2 + r);
  shape.lineTo(w / 2, d / 2 - r);
  shape.quadraticCurveTo(w / 2, d / 2, w / 2 - r, d / 2);
  shape.lineTo(-w / 2 + r, d / 2);
  shape.quadraticCurveTo(-w / 2, d / 2, -w / 2, d / 2 - r);
  shape.lineTo(-w / 2, -d / 2 + r);
  shape.quadraticCurveTo(-w / 2, -d / 2, -w / 2 + r, -d / 2);
  const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.16, bevelEnabled: true, bevelThickness: 0.04, bevelSize: 0.06, bevelSegments: 2 });
  geo.rotateX(-Math.PI / 2);
  const c = document.createElement('canvas');
  c.width = c.height = 512;
  const g = c.getContext('2d');
  g.fillStyle = '#a8bcb3';
  g.fillRect(0, 0, 512, 512);
  const rnd = rng(31);
  for (let i = 0; i < 9000; i++) {
    g.fillStyle = rnd() < 0.5 ? 'rgba(255,255,255,0.05)' : 'rgba(40,60,55,0.05)';
    g.fillRect(rnd() * 512, rnd() * 512, 1 + rnd() * 3, 1);
  }
  const map = new THREE.CanvasTexture(c);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  map.repeat.set(0.08, 0.08);
  const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map, roughness: 0.95 }));
  mesh.receiveShadow = true;
  return mesh;
}

// a window frame far up the light's path: only its shadow is seen, falling across the desk like late daylight
function windowFrame(dir) {
  const W = 200, H = 160;
  const shape = new THREE.Shape();
  shape.moveTo(-W / 2, -H / 2); shape.lineTo(W / 2, -H / 2); shape.lineTo(W / 2, H / 2); shape.lineTo(-W / 2, H / 2);
  // two big panes split by one mullion: the book sits in the light, the frame's shadow crosses the desk's corners
  const panes = [[-46, -34, 62, 66], [19, -34, 30, 66]];
  for (const [x, y, w, h] of panes) {
    const hole = new THREE.Path();
    hole.moveTo(x, y); hole.lineTo(x + w, y); hole.lineTo(x + w, y + h); hole.lineTo(x, y + h);
    shape.holes.push(hole);
  }
  const mesh = new THREE.Mesh(new THREE.ShapeGeometry(shape), new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false, side: THREE.DoubleSide }));
  mesh.castShadow = true;
  mesh.position.copy(dir).multiplyScalar(52);
  mesh.lookAt(0, 0, 0);
  mesh.rotateZ(0.32);
  mesh.raycast = () => {};
  return mesh;
}

export function createStage(canvas, { tier = 'high' } = {}) {
  const post = tier !== 'low';
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: !post, powerPreference: 'high-performance', stencil: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, tier === 'high' ? 1.5 : 1));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 1.08;
  renderer.shadowMap.enabled = tier !== 'low';
  renderer.shadowMap.type = THREE.VSMShadowMap;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#d8d0c2');
  scene.fog = new THREE.Fog('#d8d0c2', 140, 300);
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.55;
  pmrem.dispose();

  const camera = new THREE.PerspectiveCamera(30, 1, 1, 600);

  scene.add(new THREE.HemisphereLight('#fff8ec', '#b7a993', 0.55));
  // late daylight from a window behind and to the left: long, soft shadows toward the reader's right
  const sunDir = new THREE.Vector3(-0.62, 0.62, -0.48).normalize();
  const sun = new THREE.DirectionalLight('#fff3e2', 2.6);
  sun.position.copy(sunDir).multiplyScalar(90);
  sun.castShadow = renderer.shadowMap.enabled;
  const map = tier === 'high' ? 4096 : 2048;
  sun.shadow.mapSize.set(map, map);
  Object.assign(sun.shadow.camera, { left: -48, right: 48, top: 48, bottom: -48, near: 20, far: 170 });
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.02;
  sun.shadow.radius = 5;
  sun.shadow.blurSamples = 16;
  scene.add(sun);
  if (sun.castShadow) scene.add(windowFrame(sunDir));

  const desk = new THREE.Mesh(new THREE.PlaneGeometry(320, 320), new THREE.MeshStandardMaterial({ map: deskTexture(), roughness: 0.82 }));
  desk.rotation.x = -Math.PI / 2;
  desk.position.y = -0.22;
  desk.receiveShadow = true;
  scene.add(desk);
  const mat = matMesh();
  mat.position.set(0, -0.22, 2.5);
  scene.add(mat);

  const tweens = createTweens();

  // post: MSAA, bloom lets coloured glows bleed, a vignette frames the desk
  // (screen-space AO was tried and dropped: it darkens the transparent labels and halos as if they were solid)
  let composer = null;
  if (post) {
    const target = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 });
    composer = new EffectComposer(renderer, target);
    composer.addPass(new RenderPass(scene, camera));
    // lit paper reaches about 2 before tone mapping; the threshold sits above it, so only strong emissive glows bloom
    composer.addPass(new UnrealBloomPass(new THREE.Vector2(1, 1), 0.6, 0.5, 2.6));
    composer.addPass(new OutputPass());
    const vignette = new ShaderPass(VignetteShader);
    vignette.uniforms.offset.value = 0.95;
    vignette.uniforms.darkness.value = 0.9;
    composer.addPass(vignette);
  }

  // the reading view frames the whole open book for the current aspect ratio, from a low reading angle
  const dir = new THREE.Vector3(0, 0.78, 0.63).normalize();
  function readingPose() {
    const vfov = THREE.MathUtils.degToRad(camera.fov);
    const hfov = 2 * Math.atan(Math.tan(vfov / 2) * camera.aspect);
    const d = Math.max(22.6 / Math.tan(hfov / 2), 17.2 / Math.tan(vfov / 2));
    const target = new THREE.Vector3(0, 0, -0.4);
    return { pos: target.clone().addScaledVector(dir, d), target };
  }

  const look = new THREE.Vector3();
  function setPose(p) {
    camera.position.copy(p.pos);
    look.copy(p.target);
    camera.lookAt(look);
  }
  function flyTo(p, seconds = 1.2) {
    const p0 = camera.position.clone();
    const t0 = look.clone();
    return tweens.run((k) => {
      camera.position.lerpVectors(p0, p.pos, k);
      look.lerpVectors(t0, p.target, k);
      camera.lookAt(look);
    }, seconds);
  }

  function resize() {
    const w = canvas.clientWidth || window.innerWidth;
    const h = canvas.clientHeight || window.innerHeight;
    renderer.setSize(w, h, false);
    if (composer) {
      composer.setPixelRatio(renderer.getPixelRatio());
      composer.setSize(w, h);
    }
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  resize();
  setPose(readingPose());

  const render = () => (composer ? composer.render() : renderer.render(scene, camera));
  const lowerResolution = () => { renderer.setPixelRatio(1); resize(); };

  return { THREE, renderer, scene, camera, sun, tweens, readingPose, setPose, flyTo, resize, look, render, lowerResolution };
}
