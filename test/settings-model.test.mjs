import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildRows, moveSelection, selectable, isSafeMapping, ZOOM_STEPS,
} from '../src/preload/settings-model.mjs';

const schema = {
  presets: [{ id: 'giftButton', label: 'Gift button' }],
  actions: ['activate', 'back', 'toggleMute', 'none'],
};
const settings = {
  fullscreen: true,
  zoomFactor: 1.25,
  hideCursor: true,
  rumbleOnCall: true,
  hide: { giftButton: true },
  mapping: { 0: 'activate', 1: 'back', 2: 'toggleMute' },
};
const rows = buildRows(schema);
const row = (id) => rows.find((r) => r.id === id);

test('toggles flip and show On/Off', () => {
  assert.equal(row('fullscreen').value(settings), 'On');
  assert.deepEqual(row('fullscreen').change(settings), { fullscreen: false });
});

test('zoom steps up and down and clamps at the ends', () => {
  assert.deepEqual(row('zoom').change(settings, 1), { zoomFactor: 1.5 });
  assert.deepEqual(row('zoom').change(settings, -1), { zoomFactor: 1.1 });
  const max = ZOOM_STEPS[ZOOM_STEPS.length - 1];
  assert.deepEqual(row('zoom').change({ ...settings, zoomFactor: max }, 1), { zoomFactor: max });
  assert.deepEqual(row('zoom').change({ ...settings, zoomFactor: 1.33 }, 1), { zoomFactor: 1.5 });
});

test('hide presets toggle without touching others', () => {
  const patch = row('hide.giftButton').change({ ...settings, hide: { giftButton: true, other: true } });
  assert.deepEqual(patch, { hide: { giftButton: false, other: true } });
  assert.equal(row('hide.giftButton').value(settings), 'Hidden');
});

test('button rows cycle through actions both ways', () => {
  assert.equal(row('mapping.2').change(settings, 1).mapping[2], 'none');
  assert.equal(row('mapping.2').change(settings, -1).mapping[2], 'back');
  assert.equal(row('mapping.1').change(settings, 1).mapping[0], 'activate');
});

test('selection skips section headers and wraps', () => {
  const ids = selectable(rows);
  assert.ok(ids.every((i) => rows[i].section === undefined));
  assert.equal(moveSelection(rows, ids[0], -1), ids[ids.length - 1]);
  assert.equal(moveSelection(rows, ids[ids.length - 1], 1), ids[0]);
});

test('a mapping without Select is refused', () => {
  assert.ok(isSafeMapping(settings.mapping));
  assert.ok(!isSafeMapping({ 0: 'back', 1: 'back' }));
});
