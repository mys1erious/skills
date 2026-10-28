// Pure-maths checks for the lesson models: run with `node --test tests/sims.test.mjs`.
// One block per lesson model: the numbers the pages print, the challenge, and reset.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createBalance, SLOTS } from '../src/sims/balance.js';

test('balance: moments are weight times distance, and only 2 m levels the plank', () => {
  const b = createBalance();
  assert.equal(b.left(), 6);
  const level = SLOTS.map((_, i) => { b.set('at', i); return b.tilt(); });
  assert.deepEqual(level, [-1, 0, 1, 1]);
});

test('balance: the challenge is met by levelling the plank, and reset clears it', () => {
  const b = createBalance();
  assert.equal(b.challenge().met, false); // it starts tipped
  b.press('slide'); // 4 m wraps round to 1 m
  b.press('slide'); // 2 m
  assert.equal(b.state.slot, 1);
  assert.equal(b.challenge().met, true);
  b.reset();
  assert.equal(b.challenge().met, false);
});

test('balance: margin fields match what the page prints', () => {
  const b = createBalance();
  assert.deepEqual(b.margin(), { left: 'left: 2 kg × 3 m = 6', right: 'right: 3 kg × 4 m = 12', verdict: 'the right side drops', sel: null });
  b.tap('counter');
  assert.equal(b.margin().sel, 'the counterweight: 3 kg, 4 m right');
  assert.throws(() => b.tap('nothing'));
});
