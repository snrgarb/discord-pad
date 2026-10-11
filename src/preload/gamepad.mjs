// Turns raw gamepad snapshots into discrete events. Pure: feed it snapshots
// and timestamps; it returns what happened since the last update.

export const BUTTON = Object.freeze({
  A: 0, B: 1, X: 2, Y: 3, LB: 4, RB: 5, LT: 6, RT: 7,
  VIEW: 8, MENU: 9, LS: 10, RS: 11,
  UP: 12, DOWN: 13, LEFT: 14, RIGHT: 15, GUIDE: 16,
});

const DPAD = { [BUTTON.UP]: 'up', [BUTTON.DOWN]: 'down', [BUTTON.LEFT]: 'left', [BUTTON.RIGHT]: 'right' };

export const REPEAT_DELAY = 380;
export const REPEAT_RATE = 90;

// Merge every connected pad into one {buttons: bool[], axes: number[]} view,
// so it doesn't matter which controller slot the pad landed in.
export function mergePads(pads) {
  const buttons = [];
  let axes = [0, 0, 0, 0];
  let bestMag = 0;
  for (const pad of pads) {
    if (!pad || !pad.connected) continue;
    pad.buttons.forEach((b, i) => {
      buttons[i] = buttons[i] || Boolean(b && (b.pressed || b.value > 0.5));
    });
    const mag = pad.axes.reduce((m, v) => Math.max(m, Math.abs(v)), 0);
    if (mag > bestMag) {
      bestMag = mag;
      axes = [...pad.axes];
    }
  }
  return { buttons, axes };
}

export function stickDirection(x, y, deadzone) {
  if (Math.hypot(x, y) < deadzone) return null;
  if (Math.abs(x) > Math.abs(y)) return x > 0 ? 'right' : 'left';
  return y > 0 ? 'down' : 'up';
}

export class GamepadReader {
  constructor({ deadzone = 0.5, scrollDeadzone = 0.2, holdButtons = [BUTTON.VIEW] } = {}) {
    this.deadzone = deadzone;
    this.scrollDeadzone = scrollDeadzone;
    // Buttons that fire on release, so they can be held as a modifier for a combo.
    this.holdButtons = new Set(holdButtons);
    this.prev = [];
    this.dir = null;
    this.nextRepeat = 0;
    this.comboUsed = new Set();
  }

  // Adopt the current state without emitting anything, e.g. when the window
  // regains focus: buttons already held (like the one that switched back to
  // the app) must not fire, and neither must their release.
  resync({ buttons, axes }) {
    this.prev = buttons.slice();
    this.comboUsed = new Set([...this.holdButtons].filter((b) => buttons[b]));
    const dpadDir = Object.entries(DPAD).find(([i]) => buttons[i]);
    this.dir = dpadDir ? dpadDir[1] : stickDirection(axes[0] || 0, axes[1] || 0, this.deadzone);
    this.nextRepeat = Infinity;
  }

  // Returns {events, scroll}. events: {type:'press', button} | {type:'move', dir} | {type:'combo', buttons:[a,b]}
  update({ buttons, axes }, now) {
    const events = [];

    buttons.forEach((down, i) => {
      if (DPAD[i] !== undefined) return;
      const was = Boolean(this.prev[i]);
      if (down && !was) {
        const held = [...this.holdButtons].find((h) => h !== i && buttons[h]);
        if (held !== undefined) {
          this.comboUsed.add(held);
          events.push({ type: 'combo', buttons: [held, i] });
        } else if (!this.holdButtons.has(i)) {
          events.push({ type: 'press', button: i });
        }
      } else if (!down && was && this.holdButtons.has(i)) {
        if (!this.comboUsed.delete(i)) events.push({ type: 'press', button: i });
      }
    });
    this.prev = buttons.slice();

    const dpadDir = Object.entries(DPAD).find(([i]) => buttons[i]);
    const dir = dpadDir ? dpadDir[1] : stickDirection(axes[0] || 0, axes[1] || 0, this.deadzone);
    if (dir !== this.dir) {
      this.dir = dir;
      if (dir) {
        events.push({ type: 'move', dir });
        this.nextRepeat = now + REPEAT_DELAY;
      }
    } else if (dir && now >= this.nextRepeat) {
      events.push({ type: 'move', dir, repeat: true });
      this.nextRepeat = now + REPEAT_RATE;
    }

    const sx = axes[2] || 0;
    const sy = axes[3] || 0;
    const scroll = Math.hypot(sx, sy) >= this.scrollDeadzone ? { x: sx, y: sy } : null;

    return { events, scroll };
  }
}
