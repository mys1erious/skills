// The open book: cover, page stacks, two static pages and one leaf that bends as it turns.
import * as THREE from 'three';
import { PAGE_W, PAGE_H, PAGE_TOP } from './stage.js';
import { CW, CH } from './page.js';

const SEG = 40;
const CURL = 0.6;

function leafGeometry() {
  const n = (SEG + 1) * 2;
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
  const uv = new Float32Array(n * 2);
  const idx = [];
  for (let i = 0; i <= SEG; i++) {
    for (let j = 0; j < 2; j++) {
      uv[(i * 2 + j) * 2] = i / SEG;
      uv[(i * 2 + j) * 2 + 1] = 1 - j;
    }
    if (i < SEG) {
      const a = i * 2, b = a + 1, c = a + 2, d = a + 3;
      idx.push(a, b, c, b, d, c);
    }
  }
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  geo.setIndex(idx);
  return geo;
}

// angle 0 = lying on the right, PI = lying on the left; dir says which way it moves so the free edge lags
function bendLeaf(geo, angle, dir) {
  const p = geo.attributes.position;
  const ds = PAGE_W / SEG;
  let x = 0, y = 0;
  for (let i = 0; i <= SEG; i++) {
    if (i > 0) {
      const phi = angle - dir * CURL * Math.sin(angle) * ((i - 0.5) / SEG);
      x += ds * Math.cos(phi);
      y += ds * Math.sin(phi);
    }
    p.setXYZ(i * 2, x, PAGE_TOP + 0.03 + y, -PAGE_H / 2);
    p.setXYZ(i * 2 + 1, x, PAGE_TOP + 0.03 + y, PAGE_H / 2);
  }
  p.needsUpdate = true;
  geo.computeVertexNormals();
  geo.computeBoundingSphere();
}

// woven book cloth: fine warp and weft over the cover colour
function clothTexture(color) {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = color;
  g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 256; i += 2) {
    g.fillStyle = `rgba(120,70,0,${0.06 + ((i * 7) % 5) * 0.012})`;
    g.fillRect(0, i, 256, 1);
    g.fillStyle = `rgba(255,230,160,${0.05 + ((i * 11) % 3) * 0.015})`;
    g.fillRect(i, 0, 1, 256);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(10, 7);
  return t;
}

// the fore-edge of a page block: hundreds of thin page lines
function edgeTexture() {
  const c = document.createElement('canvas');
  c.width = 8;
  c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#f4efe3';
  g.fillRect(0, 0, 8, 256);
  for (let y = 0; y < 256; y += 3) {
    g.fillStyle = `rgba(150,130,100,${0.18 + ((y * 13) % 7) * 0.03})`;
    g.fillRect(0, y, 8, 1);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function createBook(stage, { surface, cover: coverColor = '#cf9a22', ribbon: ribbonColor = '#23345e' }) {
  const { scene, renderer, tweens } = stage;
  const group = new THREE.Group();
  scene.add(group);

  const cover = new THREE.Mesh(new THREE.BoxGeometry(2 * PAGE_W + 1.6, 0.26, PAGE_H + 1.6), new THREE.MeshStandardMaterial({ map: clothTexture(coverColor), roughness: 0.88 }));
  cover.position.y = 0.13;
  cover.castShadow = cover.receiveShadow = true;
  group.add(cover);
  const stackH = PAGE_TOP - 0.26;
  const edge = new THREE.MeshStandardMaterial({ map: edgeTexture(), roughness: 0.95 });
  const top = new THREE.MeshStandardMaterial({ color: '#f6f2e8', roughness: 0.95 });
  for (const sx of [-1, 1]) {
    // box faces: +x, -x, +y (under the page), -y, +z, -z; the sides show the page edges
    const stack = new THREE.Mesh(new THREE.BoxGeometry(PAGE_W - 0.1, stackH, PAGE_H), [edge, edge, top, top, edge, edge]);
    stack.position.set((sx * PAGE_W) / 2, 0.26 + stackH / 2 - 0.005, 0);
    stack.castShadow = stack.receiveShadow = true;
    group.add(stack);
  }

  // a ribbon bookmark lying down the gutter and over the bottom edge onto the desk
  const ribbonPath = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.05, PAGE_TOP + 0.02, -PAGE_H / 2 + 1),
    new THREE.Vector3(0.05, PAGE_TOP + 0.02, PAGE_H / 2 - 0.4),
    new THREE.Vector3(0.25, PAGE_TOP - 0.2, PAGE_H / 2 + 0.5),
    new THREE.Vector3(0.5, 0.05, PAGE_H / 2 + 1.6),
    new THREE.Vector3(0.9, -0.1, PAGE_H / 2 + 3.6),
  ]);
  const ribbonGeo = new THREE.TubeGeometry(ribbonPath, 60, 0.3, 2, false);
  ribbonGeo.scale(1, 0.12, 1); // a flat tape, not a tube
  const ribbon = new THREE.Mesh(ribbonGeo, new THREE.MeshStandardMaterial({ color: ribbonColor, roughness: 0.6 }));
  ribbon.castShadow = ribbon.receiveShadow = true;
  group.add(ribbon);

  const aniso = renderer.capabilities.getMaxAnisotropy();
  const textures = new Map();
  function tex(k, side, back = false) {
    const key = `${k}:${side}`;
    if (!textures.has(key)) {
      const s = surface(k, side);
      const front = new THREE.CanvasTexture(s.canvas);
      front.colorSpace = THREE.SRGBColorSpace;
      front.anisotropy = aniso;
      const mirrored = front.clone();
      mirrored.wrapS = THREE.RepeatWrapping;
      mirrored.repeat.x = -1;
      mirrored.offset.x = 1;
      textures.set(key, { front, mirrored });
    }
    return back ? textures.get(key).mirrored : textures.get(key).front;
  }

  const pageMat = () => new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.92 });
  const pages = {};
  for (const [side, sx] of [['L', -1], ['R', 1]]) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(PAGE_W, PAGE_H), pageMat());
    m.rotation.x = -Math.PI / 2;
    m.position.set((sx * PAGE_W) / 2, PAGE_TOP, 0);
    m.receiveShadow = true;
    m.userData.side = side;
    group.add(m);
    pages[side] = m;
  }

  const leafGeo = leafGeometry();
  const leafFront = new THREE.Mesh(leafGeo, new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.92, side: THREE.FrontSide }));
  const leafBack = new THREE.Mesh(leafGeo, new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.92, side: THREE.BackSide }));
  for (const m of [leafFront, leafBack]) { m.visible = false; m.castShadow = true; m.receiveShadow = true; group.add(m); }

  let k = 1;
  let turning = false;

  function show(side, kk) {
    pages[side].material.map = tex(kk, side);
    pages[side].material.needsUpdate = true;
  }

  function setSpread(kk) {
    k = kk;
    show('L', kk);
    show('R', kk);
  }

  async function turn(to, seconds = 1.1) {
    if (to === k || turning) return;
    turning = true;
    const forward = to > k;
    leafFront.material.map = tex(forward ? k : to, 'R');
    leafBack.material.map = tex(forward ? to : k, 'L', true);
    leafFront.material.needsUpdate = leafBack.material.needsUpdate = true;
    // reveal what lies under the leaf before it moves
    if (forward) show('R', to); else show('L', to);
    const dir = forward ? 1 : -1;
    bendLeaf(leafGeo, forward ? 0 : Math.PI, dir);
    leafFront.visible = leafBack.visible = true;
    await tweens.run((t) => bendLeaf(leafGeo, forward ? t * Math.PI : (1 - t) * Math.PI, dir), seconds);
    if (forward) show('L', to); else show('R', to);
    leafFront.visible = leafBack.visible = false;
    k = to;
    turning = false;
  }

  const hitList = [pages.L, pages.R];
  function hitTest(raycaster) {
    if (turning) return null;
    const hit = raycaster.intersectObjects(hitList, false)[0];
    if (!hit) return null;
    return { side: hit.object.userData.side, x: hit.uv.x * CW, y: (1 - hit.uv.y) * CH, point: hit.point };
  }

  // page pixel -> world point, for tests and camera shots
  function worldOf(side, x, y) {
    const u = x / CW;
    const v = y / CH;
    return new THREE.Vector3(side === 'L' ? -PAGE_W + u * PAGE_W : u * PAGE_W, PAGE_TOP, -PAGE_H / 2 + v * PAGE_H);
  }

  function refresh(kk, side) {
    const t = textures.get(`${kk}:${side}`);
    if (t) { t.front.needsUpdate = true; t.mirrored.needsUpdate = true; }
  }

  return { group, setSpread, turn, hitTest, worldOf, refresh, get turning() { return turning; }, get k() { return k; } };
}
