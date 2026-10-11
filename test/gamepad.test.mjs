import test from 'node:test';
import assert from 'node:assert/strict';
import {
  GamepadReader, mergePads, stickDirection, BUTTON, REPEAT_DELAY, REPEAT_RATE,
} from '../src/preload/gamepad.mjs';

const snap = (pressed = [], axes = [0, 0, 0, 0]) => {
  const buttons = Array(17).fill(false);
  for (const b of pressed) buttons[b] = true;
  return { buttons, axes };
};

test('a button fires once on press, not while held', () => {
  const g = new GamepadReader();
  assert.deepEqual(g.update(snap([BUTTON.A]), 0).events, [{ type: 'press', button: BUTTON.A }]);
  assert.deepEqual(g.update(snap([BUTTON.A]), 16).events, []);
  assert.deepEqual(g.update(snap(), 32).events, []);
  assert.equal(g.update(snap([BUTTON.A]), 48).events.length, 1);
});

test('d-pad moves and auto-repeats after a delay', () => {
  const g = new GamepadReader();
  assert.deepEqual(g.update(snap([BUTTON.DOWN]), 0).events, [{ type: 'move', dir: 'down' }]);
  assert.deepEqual(g.update(snap([BUTTON.DOWN]), REPEAT_DELAY - 1).events, []);
  assert.deepEqual(g.update(snap([BUTTON.DOWN]), REPEAT_DELAY).events, [{ type: 'move', dir: 'down', repeat: true }]);
  assert.deepEqual(g.update(snap([BUTTON.DOWN]), REPEAT_DELAY + REPEAT_RATE - 1).events, []);
  assert.equal(g.update(snap([BUTTON.DOWN]), REPEAT_DELAY + REPEAT_RATE).events.length, 1);
});

test('left stick past the deadzone moves; small drift does not', () => {
  const g = new GamepadReader({ deadzone: 0.5 });
  assert.deepEqual(g.update(snap([], [0.2, 0.1, 0, 0]), 0).events, []);
  assert.deepEqual(g.update(snap([], [0.9, 0.2, 0, 0]), 16).events, [{ type: 'move', dir: 'right' }]);
});

test('View fires on release so it can be a combo modifier', () => {
  const g = new GamepadReader();
  assert.deepEqual(g.update(snap([BUTTON.VIEW]), 0).events, []);
  assert.deepEqual(g.update(snap(), 16).events, [{ type: 'press', button: BUTTON.VIEW }]);

  g.update(snap([BUTTON.VIEW]), 32);
  assert.deepEqual(g.update(snap([BUTTON.VIEW, BUTTON.MENU]), 48).events, [
    { type: 'combo', buttons: [BUTTON.VIEW, BUTTON.MENU] },
  ]);
  // Releasing View after a combo doesn't also open help.
  assert.deepEqual(g.update(snap(), 64).events, []);
});

test('right stick reports scroll outside its deadzone', () => {
  const g = new GamepadReader();
  assert.equal(g.update(snap([], [0, 0, 0, 0.1]), 0).scroll, null);
  assert.deepEqual(g.update(snap([], [0, 0, 0, 0.8]), 16).scroll, { x: 0, y: 0.8 });
});

test('mergePads ORs buttons and takes the most deflected stick', () => {
  const pad = (pressed, axes) => ({
    connected: true,
    axes,
    buttons: Array.from({ length: 17 }, (_, i) => ({ pressed: pressed.includes(i), value: 0 })),
  });
  const merged = mergePads([null, pad([0], [0, 0, 0, 0]), pad([3], [0.9, 0, 0, 0]), { connected: false }]);
  assert.equal(merged.buttons[0], true);
  assert.equal(merged.buttons[3], true);
  assert.equal(merged.buttons[1], false);
  assert.deepEqual(merged.axes, [0.9, 0, 0, 0]);
});

test('analog trigger counts as pressed past half travel', () => {
  const merged = mergePads([{ connected: true, axes: [], buttons: [{ pressed: false, value: 0.7 }] }]);
  assert.equal(merged.buttons[0], true);
});

test('stickDirection picks the dominant axis', () => {
  assert.equal(stickDirection(0.1, -0.9, 0.5), 'up');
  assert.equal(stickDirection(-0.8, 0.3, 0.5), 'left');
  assert.equal(stickDirection(0.2, 0.2, 0.5), null);
});
