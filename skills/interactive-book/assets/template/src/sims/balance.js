// Lesson 1 model: a seesaw. A load sits 3 m left of the pivot; the reader moves a counterweight along the right arm.
// Pure: no three.js, no DOM, so tests/sims.test.mjs checks it in node.
export const LOAD = { kg: 2, at: 3 };
export const COUNTER_KG = 3;
export const SLOTS = [1, 2, 3, 4]; // metres right of the pivot
const START = 3; // the counterweight starts at 4 m, where the right side drops

export function createBalance() {
  const state = { slot: START, selected: null, found: false };
  const left = () => LOAD.kg * LOAD.at;
  const right = () => COUNTER_KG * SLOTS[state.slot];
  const tilt = () => Math.sign(right() - left()); // 1: the right side drops, 0: level, -1: the left side drops
  const check = () => { if (tilt() === 0) state.found = true; };

  return {
    state,
    left,
    right,
    tilt,
    set(key, i) {
      if (key !== 'at' || SLOTS[i] == null) throw new Error(`balance: bad ${key}=${i}`);
      state.slot = i;
      check();
    },
    press(id) {
      if (id !== 'slide') throw new Error(`balance: no button '${id}'`);
      state.slot = (state.slot + 1) % SLOTS.length;
      check();
    },
    tap(id) {
      if (id !== 'load' && id !== 'counter') throw new Error(`balance: nothing called '${id}'`);
      state.selected = state.selected === id ? null : id;
    },
    reset() {
      state.slot = START;
      state.selected = null;
      state.found = false;
    },
    // the handwritten working in the right page's margin; a null field hides its line
    margin() {
      const sel = { load: `the load: ${LOAD.kg} kg, ${LOAD.at} m left`, counter: `the counterweight: ${COUNTER_KG} kg, ${SLOTS[state.slot]} m right` };
      return {
        left: `left: ${LOAD.kg} kg × ${LOAD.at} m = ${left()}`,
        right: `right: ${COUNTER_KG} kg × ${SLOTS[state.slot]} m = ${right()}`,
        verdict: tilt() === 0 ? 'level: balanced' : tilt() > 0 ? 'the right side drops' : 'the left side drops',
        sel: state.selected ? sel[state.selected] : null,
      };
    },
    challenge() {
      return { met: state.found, value: state.found ? 1 : 0, target: 1, text: 'Find where the counterweight balances the load.' };
    },
  };
}
