import test from 'node:test';
import assert from 'node:assert/strict';
import {
  LAYOUTS, moveInGrid, keyAt, applyShift,
} from '../src/preload/keyboard-layout.mjs';

const L = LAYOUTS.letters;

test('left/right wrap within a row', () => {
  assert.deepEqual(moveInGrid(L, { row: 1, col: 0 }, 'left'), { row: 1, col: 9 });
  assert.deepEqual(moveInGrid(L, { row: 1, col: 9 }, 'right'), { row: 1, col: 0 });
});

test('down from letters lands on the horizontally nearest key', () => {
  // "g" is near the middle; the middle of the bottom row is Space.
  const g = { row: 2, col: 4 };
  assert.equal(keyAt(L, g).value, 'g');
  const below = moveInGrid(L, moveInGrid(L, g, 'down'), 'down');
  assert.equal(keyAt(L, below).label, 'Space');
});

test('up from the top row wraps to the bottom row', () => {
  assert.equal(moveInGrid(L, { row: 0, col: 0 }, 'up').row, L.length - 1);
});

test('every layout has rows with keys that have a value or an action', () => {
  for (const layout of Object.values(LAYOUTS)) {
    for (const row of layout) {
      assert.ok(row.length > 0);
      for (const key of row) assert.ok(key.value || key.action, JSON.stringify(key));
    }
  }
});

test('emoji keys keep multi-codepoint emoji whole', () => {
  assert.ok(LAYOUTS.symbols[3].some((key) => key.value === '❤️'));
});

test('applyShift uppercases only when shifted', () => {
  assert.equal(applyShift('a', true), 'A');
  assert.equal(applyShift('a', false), 'a');
});
