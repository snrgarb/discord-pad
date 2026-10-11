import { pickNext, nearestTo, sameBox } from './spatial.mjs';
import { FOCUSABLE, LAYERS } from './selectors.mjs';

const MIN_SIZE = 4;

function isVisible(el, rect) {
  if (rect.width < MIN_SIZE || rect.height < MIN_SIZE) return false;
  if (rect.bottom <= 0 || rect.right <= 0 || rect.top >= innerHeight || rect.left >= innerWidth) return false;
  if (el.closest('[aria-hidden="true"], [inert]')) return false;
  const style = getComputedStyle(el);
  if (style.visibility === 'hidden' || style.pointerEvents === 'none') return false;
  // Something else (an overlay, a menu) covers it.
  const x = Math.min(Math.max((rect.left + rect.right) / 2, 0), innerWidth - 1);
  const y = Math.min(Math.max((rect.top + rect.bottom) / 2, 0), innerHeight - 1);
  const hit = document.elementFromPoint(x, y);
  return Boolean(hit) && (hit === el || el.contains(hit) || hit.contains(el));
}

// The topmost open layer (dialog, menu, popout), or the whole document.
export function currentScope() {
  const layers = [...document.querySelectorAll(LAYERS)].filter((el) => {
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && !el.closest('[aria-hidden="true"]');
  });
  return layers.length ? layers[layers.length - 1] : document.body;
}

// Visible, interactive elements in the current scope, with nested wrappers
// that cover the same box collapsed to the outermost one.
export function collectCandidates(scope = currentScope()) {
  const items = [];
  for (const el of scope.querySelectorAll(FOCUSABLE)) {
    if (el.matches('[disabled], [aria-disabled="true"]')) continue;
    const rect = el.getBoundingClientRect();
    if (!isVisible(el, rect)) continue;
    items.push({ el, rect });
  }
  return items.filter((item) => !items.some((other) => (
    other !== item && other.el.contains(item.el) && sameBox(other.rect, item.rect)
  )));
}

export class FocusManager {
  constructor(overlay) {
    this.overlay = overlay;
    this.current = null;
    this.active = false;
    const tick = () => {
      this.drawRing();
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  // Start of controller use, or the tracked element disappeared/was left behind.
  ensure() {
    const scope = currentScope();
    if (this.current?.isConnected && scope.contains(this.current)) return this.current;
    const candidates = collectCandidates(scope);
    if (!candidates.length) return null;
    const active = document.activeElement;
    let pick = candidates.find((c) => c.el === active || c.el.contains(active));
    if (!pick) {
      pick = scope === document.body
        ? candidates[nearestTo({ x: innerWidth / 2, y: innerHeight / 2 }, candidates.map((c) => c.rect))]
        : candidates[0];
    }
    this.set(pick.el);
    return this.current;
  }

  move(dir) {
    this.active = true;
    const before = this.current;
    const from = this.ensure();
    if (!from || from !== before) return; // first press just shows where focus is
    const candidates = collectCandidates().filter((c) => c.el !== from && !c.el.contains(from));
    const idx = pickNext(from.getBoundingClientRect(), candidates.map((c) => c.rect), dir);
    if (idx >= 0) {
      this.set(candidates[idx].el);
    } else {
      // Nothing visible that way: let a scroll container reveal more.
      scrollFrom(from, dir === 'up' || dir === 'down' ? (dir === 'up' ? -1 : 1) * 200 : 0);
    }
  }

  set(el) {
    this.current = el;
    if (!el) return;
    el.focus({ preventScroll: true });
    el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }

  drawRing() {
    if (!this.active || !this.current?.isConnected) {
      this.overlay.showRing(null);
      return;
    }
    this.overlay.showRing(this.current.getBoundingClientRect());
  }

  hide() {
    this.active = false;
  }
}

function scrollableAncestor(el) {
  for (let node = el; node && node !== document.documentElement; node = node.parentElement) {
    const style = getComputedStyle(node);
    if (/(auto|scroll)/.test(style.overflowY) && node.scrollHeight > node.clientHeight + 1) return node;
  }
  return null;
}

export function scrollFrom(el, dy, dx = 0) {
  const target = (el && scrollableAncestor(el))
    || scrollableAncestor(document.elementFromPoint(innerWidth * 0.6, innerHeight / 2));
  if (target) target.scrollBy({ top: dy, left: dx });
}

// Fire a full pointer/mouse sequence; some Discord controls act on
// mousedown, others on click.
export function activate(el) {
  const r = el.getBoundingClientRect();
  const opts = {
    bubbles: true, cancelable: true, composed: true, view: window,
    clientX: r.left + r.width / 2, clientY: r.top + r.height / 2, button: 0,
  };
  el.focus({ preventScroll: true });
  el.dispatchEvent(new PointerEvent('pointerdown', { ...opts, pointerType: 'mouse', isPrimary: true, buttons: 1 }));
  el.dispatchEvent(new MouseEvent('mousedown', { ...opts, buttons: 1 }));
  el.dispatchEvent(new PointerEvent('pointerup', { ...opts, pointerType: 'mouse', isPrimary: true }));
  el.dispatchEvent(new MouseEvent('mouseup', opts));
  el.dispatchEvent(new MouseEvent('click', opts));
}
