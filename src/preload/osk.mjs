import {
  LAYOUTS, moveInGrid, keyAt, applyShift,
} from './keyboard-layout.mjs';

// Controller-driven on-screen keyboard. It never takes focus: Discord's text
// box stays focused and characters are inserted into it by the main process.
export class OnScreenKeyboard {
  constructor(container, { typeText, sendChord, onClose }) {
    this.el = container;
    this.typeText = typeText;
    this.sendChord = sendChord;
    this.onClose = onClose;
    this.layoutName = 'letters';
    this.pos = { row: 1, col: 0 };
    this.shift = false;
    this.target = null;

    // Mouse/touch users can tap keys too; keep focus in Discord's input.
    this.el.addEventListener('mousedown', (e) => e.preventDefault());
    this.el.addEventListener('click', (e) => {
      const keyEl = e.target.closest('[data-row]');
      if (!keyEl) return;
      this.pos = { row: Number(keyEl.dataset.row), col: Number(keyEl.dataset.col) };
      this.press();
    });
  }

  get layout() {
    return LAYOUTS[this.layoutName];
  }

  get visible() {
    return this.el.classList.contains('show');
  }

  open(target) {
    this.target = target;
    this.layoutName = 'letters';
    this.shift = false;
    this.pos = { row: 1, col: 0 };
    this.render();
    this.el.classList.add('show');
  }

  close() {
    if (!this.visible) return;
    this.el.classList.remove('show');
    this.target = null;
    this.onClose?.();
  }

  move(dir) {
    this.pos = moveInGrid(this.layout, this.pos, dir);
    this.render();
  }

  refocusTarget() {
    if (this.target?.isConnected && document.activeElement !== this.target) this.target.focus();
  }

  press() {
    const key = keyAt(this.layout, this.pos);
    if (!key) return;
    this.refocusTarget();
    switch (key.action) {
      case 'shift': this.shift = !this.shift; break;
      case 'symbols':
        this.layoutName = this.layoutName === 'letters' ? 'symbols' : 'letters';
        this.pos = { row: this.layout.length - 1, col: 1 };
        break;
      case 'backspace': this.backspace(); break;
      case 'enter': this.enter(); break;
      case 'close': this.close(); return;
      default:
        this.typeText(applyShift(key.value, this.shift));
        if (this.shift) this.shift = false;
    }
    this.render();
  }

  backspace() {
    this.refocusTarget();
    this.sendChord('backspace');
  }

  space() {
    this.refocusTarget();
    this.typeText(' ');
  }

  enter() {
    this.refocusTarget();
    this.sendChord('enter');
  }

  toggleShift() {
    this.shift = !this.shift;
    this.render();
  }

  render() {
    const rows = this.layout.map((row, r) => {
      const keys = row.map((key, c) => {
        const sel = r === this.pos.row && c === this.pos.col ? ' sel' : '';
        const on = key.action === 'shift' && this.shift ? ' on' : '';
        const label = key.value ? applyShift(key.label, this.shift) : key.label;
        return `<div class="key${sel}${on}" data-row="${r}" data-col="${c}" style="flex-grow:${key.w || 1}">${escapeHtml(label)}</div>`;
      });
      return `<div class="row">${keys.join('')}</div>`;
    });
    this.el.innerHTML = `${rows.join('')}<div class="hint">A type · X delete · Y space · LT shift · Menu send · B close</div>`;
  }
}

function escapeHtml(s) {
  return s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}
