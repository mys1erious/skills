// Lesson 1 scene: a seesaw on the right page. The plank tips toward the side with the larger moment.
// The figure fills the right page above the printed caption: x from 1 to 20, z from -12 to 7 (references/scenes.md).
import * as THREE from 'three';
import { createBalance, LOAD, COUNTER_KG, SLOTS } from '../sims/balance.js';

const X = 10.5, Z = 1.5; // the pivot: forward of the page's middle, because the reading view's low angle lifts tall things up the page
const M = 2; // world units per metre along the plank
const H = 3.2; // the pivot's height: where the plank rests
const PLANK = { w: 19, h: 0.32, d: 2.6 };
const COLORS = { load: '#e07a2f', counter: '#2a9d8f' };
const SIZE = { load: 1.7, counter: 2.0 }; // a heavier weight is a bigger block
const TIP = 0.11; // radians the plank tips when one side wins

export default {
  n: 1,
  build(kit) {
    const { inked, pageText, halo, floatLabel, tweens, onChange } = kit;
    const sim = createBalance();
    const group = new THREE.Group();

    // the pivot: a triangular prism, hatched where the window light doesn't reach
    const tri = new THREE.Shape([new THREE.Vector2(-1.5, 0), new THREE.Vector2(1.5, 0), new THREE.Vector2(0, H)]);
    const prism = new THREE.ExtrudeGeometry(tri, { depth: PLANK.d - 0.4, bevelEnabled: false });
    prism.translate(0, 0, -(PLANK.d - 0.4) / 2);
    const pivot = inked(prism, { fill: '#f6efe0' });
    pivot.position.set(X, 0, Z);
    group.add(pivot);

    // the plank turns about the pivot's tip; the weights ride on it
    const arm = new THREE.Group();
    arm.position.set(X, H + PLANK.h / 2, Z);
    group.add(arm);
    arm.add(inked(new THREE.BoxGeometry(PLANK.w, PLANK.h, PLANK.d), { fill: '#fbf7ee', hatch: 0.5 }));
    for (const m of [1, 2, 3, 4]) for (const side of [-1, 1]) {
      const tick = pageText(`${m} m`, { width: 1.2, size: 64 });
      tick.position.set(side * m * M, PLANK.h / 2 + 0.01, PLANK.d / 2 - 0.45);
      arm.add(tick);
    }

    const weights = {};
    for (const id of ['load', 'counter']) {
      const s = SIZE[id];
      const mesh = inked(new THREE.BoxGeometry(s, s, s), { fill: COLORS[id] });
      mesh.position.y = PLANK.h / 2 + s / 2;
      mesh.userData.targetId = id; // what a tap on it reports
      const glow = halo('#ffffff', s * 2.2);
      glow.visible = false;
      mesh.add(glow);
      const label = floatLabel('#1c2433', 0.95);
      label.position.y = s / 2 + 1.2;
      mesh.add(label);
      arm.add(mesh);
      weights[id] = { mesh, glow, label };
    }
    weights.load.mesh.position.x = -LOAD.at * M;

    function paint() {
      weights.load.label.set(`${LOAD.kg} kg × ${LOAD.at} m = ${sim.left()}`, COLORS.load);
      weights.counter.label.set(`${COUNTER_KG} kg × ${SLOTS[sim.state.slot]} m = ${sim.right()}`, COLORS.counter);
      for (const id of ['load', 'counter']) weights[id].glow.visible = sim.state.selected === id;
    }

    // the counterweight slides to its slot while the plank swings to its new angle; in still mode both jump
    function swing(animate = true) {
      paint();
      const x0 = weights.counter.mesh.position.x, x1 = SLOTS[sim.state.slot] * M;
      const from = arm.rotation.z, to = -sim.tilt() * TIP;
      const step = (t) => {
        weights.counter.mesh.position.x = x0 + (x1 - x0) * t;
        arm.rotation.z = from + (to - from) * t;
      };
      if (!animate) { step(1); return Promise.resolve(); }
      return tweens.run(step, 0.9);
    }
    const after = (animate = true) => { const done = swing(animate); onChange(); return done; };
    swing(false);

    return {
      group,
      sim,
      targets: () => [weights.load.mesh, weights.counter.mesh],
      switchValue: (id) => (id === 'at' ? sim.state.slot : null),
      setSwitch(id, i) {
        sim.set(id, i);
        return after();
      },
      press(id) {
        sim.press(id);
        return after();
      },
      tap(id) {
        sim.tap(id);
        paint();
        onChange();
      },
      hover: (id) => (id === 'load' ? `the load: ${LOAD.kg} kg` : `the counterweight: ${COUNTER_KG} kg`),
      a11yItems: () => [
        { id: 'load', label: `${LOAD.kg} kg load`, status: `${LOAD.at} m left of the pivot` },
        { id: 'counter', label: `${COUNTER_KG} kg counterweight`, status: `${SLOTS[sim.state.slot]} m right of the pivot` },
      ],
      // the five intro shots, one per watch caption; pose: null means the reading view
      shots() {
        const at = (slot) => () => { sim.set('at', slot); return after(); };
        return [
          { kind: 'wide', enter: () => this.reset(), pose: () => kit.pose([X, 2, Z], { distance: 31, elevation: 35 }) },
          { kind: 'close', enter: null, pose: () => kit.pose([X, 4, Z], { distance: 27, elevation: 19 }) },
          { kind: 'cutaway', enter: at(0), pose: () => kit.pose([9, 2.5, Z], { distance: 20, elevation: 25, azimuth: -23 }) },
          { kind: 'angle', enter: at(2), pose: () => kit.pose([X, 3, Z], { distance: 19.5, elevation: 9, azimuth: 53 }) },
          { kind: 'handover', enter: () => this.reset(), pose: null },
        ];
      },
      reset() {
        sim.reset();
        swing(false);
        onChange();
      },
    };
  },
};
