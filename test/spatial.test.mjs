import test from 'node:test';
import assert from 'node:assert/strict';
import {
  pickNext, nearestTo, sameBox, score, isSliver, columnForX, planMove,
} from '../src/preload/spatial.mjs';

const r = (left, top, w = 100, h = 40) => ({ left, top, right: left + w, bottom: top + h });

test('moves down a vertical list to the next item, not a far column', () => {
  const from = r(0, 0);
  const items = [r(0, 50), r(0, 100), r(300, 45)];
  assert.equal(pickNext(from, items, 'down'), 0);
});

test('prefers an overlapping column over a closer diagonal item', () => {
  const from = r(0, 0, 60, 40);
  const items = [r(150, 45, 60, 40), r(0, 120, 60, 40)];
  assert.equal(pickNext(from, items, 'down'), 1);
});

test('moves right across a row', () => {
  const from = r(0, 0, 50, 50);
  const items = [r(60, 0, 50, 50), r(120, 0, 50, 50), r(-60, 0, 50, 50)];
  assert.equal(pickNext(from, items, 'right'), 0);
  assert.equal(pickNext(from, items, 'left'), 2);
});

test('returns -1 when nothing lies in that direction', () => {
  assert.equal(pickNext(r(0, 0), [r(0, 50)], 'up'), -1);
  assert.equal(score(r(0, 0), r(0, 0), 'down'), Infinity);
});

test('from a server icon on the left, right goes to the channel list', () => {
  const server = r(10, 200, 48, 48);
  const channels = [r(80, 100, 220, 32), r(80, 210, 220, 32), r(80, 400, 220, 32)];
  assert.equal(pickNext(server, channels, 'right'), 1);
});

test('nearestTo finds the closest center', () => {
  assert.equal(nearestTo({ x: 500, y: 500 }, [r(0, 0), r(460, 480), r(900, 900)]), 1);
  assert.equal(nearestTo({ x: 0, y: 0 }, []), -1);
});

test('sameBox detects wrapper elements', () => {
  assert.ok(sameBox(r(0, 0), r(2, 1, 97, 38)));
  assert.ok(!sameBox(r(0, 0), r(0, 0, 50, 40)));
});

test('isSliver flags thin dividers but not buttons or list rows', () => {
  assert.ok(isSliver(r(600, 50, 8, 900)));   // vertical sidebar resizer
  assert.ok(isSliver(r(0, 300, 800, 2)));    // horizontal rule
  assert.ok(!isSliver(r(0, 0, 40, 40)));     // icon button
  assert.ok(!isSliver(r(0, 0, 400, 40)));    // channel row
  assert.ok(!isSliver(r(0, 0, 10, 10)));     // small square badge
});

test('columnForX splits servers, sidebar and main', () => {
  const bounds = { serversRight: 72, sidebarRight: 312 };
  assert.equal(columnForX(36, bounds), 0);
  assert.equal(columnForX(200, bounds), 1);
  assert.equal(columnForX(900, bounds), 2);
});

test('planMove: left/right jump whole columns from the sidebars', () => {
  assert.deepEqual(planMove(0, 'right'), { within: false, jumpTo: 1 });
  assert.deepEqual(planMove(1, 'right'), { within: false, jumpTo: 2 });
  assert.deepEqual(planMove(1, 'left'), { within: false, jumpTo: 0 });
  assert.deepEqual(planMove(0, 'left'), { within: false, jumpTo: null });
});

test('planMove: up/down stay in the column', () => {
  for (const col of [0, 1, 2]) {
    assert.deepEqual(planMove(col, 'down'), { within: true, jumpTo: null });
  }
});

test('planMove: main area moves between controls, jumps back at the left edge', () => {
  assert.deepEqual(planMove(2, 'left'), { within: true, jumpTo: 1 });
  assert.deepEqual(planMove(2, 'right'), { within: true, jumpTo: null });
});
