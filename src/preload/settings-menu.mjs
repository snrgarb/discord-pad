import {
  buildRows, moveSelection, selectable, isSafeMapping,
} from './settings-model.mjs';

// Controller-driven settings screen. Up/down pick a row, left/right or A
// change it, B closes. Every change is sent to the main process, which
// validates, saves and applies it, and returns the new settings.
export class SettingsMenu {
  constructor(container, { schema, getSettings, update, reset, onClose, toast }) {
    this.el = container;
    this.rows = buildRows(schema);
    this.getSettings = getSettings;
    this.update = update;
    this.reset = reset;
    this.onClose = onClose;
    this.toast = toast;
    this.index = selectable(this.rows)[0];

    // Mouse users can click rows too.
    this.el.addEventListener('click', (e) => {
      const row = e.target.closest('[data-i]');
      if (!row) return;
      this.index = Number(row.dataset.i);
      this.press();
    });
  }

  get visible() {
    return this.el.classList.contains('show');
  }

  open() {
    this.index = selectable(this.rows)[0];
    this.render();
    this.el.classList.add('show');
  }

  close() {
    if (!this.visible) return;
    this.el.classList.remove('show');
    this.onClose?.();
  }

  move(dir) {
    if (dir === 'up' || dir === 'down') {
      this.index = moveSelection(this.rows, this.index, dir === 'down' ? 1 : -1);
      this.render();
    } else {
      this.change(dir === 'right' ? 1 : -1);
    }
  }

  async press() {
    const row = this.rows[this.index];
    if (row.action === 'close') return this.close();
    if (row.action === 'reset') {
      await this.reset();
      this.toast('Settings reset to defaults');
      return this.render();
    }
    return this.change(1);
  }

  async change(delta) {
    const row = this.rows[this.index];
    if (!row.change) return;
    const patch = row.change(this.getSettings(), delta);
    if (patch.mapping && !isSafeMapping(patch.mapping)) {
      this.toast('At least one button has to stay on Select');
      return;
    }
    await this.update(patch);
    this.render();
  }

  render() {
    const s = this.getSettings();
    const html = this.rows.map((row, i) => {
      if (row.section !== undefined) return row.section ? `<h3>${escapeHtml(row.section)}</h3>` : '<hr>';
      const sel = i === this.index ? ' sel' : '';
      const value = row.value(s);
      const arrows = row.change ? `<span class="val">‹ ${escapeHtml(value)} ›</span>` : '';
      return `<div class="row${sel}" data-i="${i}"><span>${escapeHtml(row.label)}</span>${arrows}</div>`;
    }).join('');
    this.el.innerHTML = `<div class="sheet"><h2>Discord Pad settings</h2><div class="rows">${html}</div>
      <div class="hint">Up/Down choose · Left/Right or A change · B close</div></div>`;
    this.el.querySelector('.row.sel')?.scrollIntoView({ block: 'nearest' });
  }
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}
