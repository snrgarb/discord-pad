import {
  pickNext, nearestTo, sameBox, isSliver, columnForX, planMove,
} from './spatial.mjs';
import {
  FOCUSABLE, LAYERS, NOT_NAVIGABLE, TEXT_INPUT,
  SERVER_COLUMN, CHANNEL_COLUMN, DEFAULT_SIDEBAR_WIDTH, SELECTED,
} from './selectors.mjs';

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
    if (el.matches('[disabled], [aria-disabled="true"]') || el.matches(NOT_NAVIGABLE)) continue;
    const rect = el.getBoundingClientRect();
    if (isSliver(rect)) continue;
    if (!isVisible(el, rect)) continue;
    items.push({ el, rect });
  }
  // Collapse wrappers: a nested element covering the same box, or the only
  // control inside another (e.g. a search box wrapping its <input>), would
  // otherwise need two presses to get past.
  const inside = (outer) => items.filter((i) => i !== outer && outer.el.contains(i.el));
  return items.filter((item) => !items.some((other) => {
    if (other === item || !other.el.contains(item.el)) return false;
    return sameBox(other.rect, item.rect) || inside(other).length === 1;
  }));
}

// The text field an element is, or wraps (Discord often wraps inputs).
export function textFieldOf(el) {
  if (!el) return null;
  if (el.matches(TEXT_INPUT)) return el;
  return [...el.querySelectorAll(TEXT_INPUT)].find((f) => f.getBoundingClientRect().width > 0) || null;
}

// Column edges for the main Discord layout, or null when it isn't showing
// (settings pages, full-screen views), in which case plain spatial
// navigation is used.
export function measureColumns() {
  const servers = [...document.querySelectorAll(SERVER_COLUMN)]
    .find((el) => isVisible(el, el.getBoundingClientRect()));
  if (!servers) return null;
  const serversRight = servers.getBoundingClientRect().right;
  const sidebarRights = [...document.querySelectorAll(CHANNEL_COLUMN)]
    .map((el) => el.getBoundingClientRect())
    .filter((r) => r.width > 0 && r.left >= serversRight - 1)
    .map((r) => r.right);
  const sidebarRight = sidebarRights.length
    ? Math.max(...sidebarRights)
    : serversRight + DEFAULT_SIDEBAR_WIDTH;
  return { serversRight, sidebarRight };
}

const centerX = (rect) => (rect.left + rect.right) / 2;

export class FocusManager {
  constructor(overlay, { onLand } = {}) {
    this.overlay = overlay;
    this.onLand = onLand;
    this.current = null;
    this.active = false;
    // Last element visited in each column, to return to on a column jump.
    this.lastInColumn = new Map();
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
    const scope = currentScope();
    const candidates = collectCandidates(scope).filter((c) => c.el !== from && !c.el.contains(from));
    const fromRect = from.getBoundingClientRect();
    const columns = scope === document.body ? measureColumns() : null;

    if (!columns) {
      const idx = pickNext(fromRect, candidates.map((c) => c.rect), dir);
      if (idx >= 0) this.set(candidates[idx].el);
      else scrollFrom(from, verticalScroll(dir));
      return;
    }

    const column = columnForX(centerX(fromRect), columns);
    this.lastInColumn.set(column, from);
    const plan = planMove(column, dir);
    if (plan.within) {
      const horizontal = dir === 'left' || dir === 'right';
      // Sideways moves in the main area stay on the same row; past the
      // row's end, left jumps back to the sidebar.
      const same = candidates.filter((c) => columnForX(centerX(c.rect), columns) === column
        && (!horizontal || (c.rect.top < fromRect.bottom && c.rect.bottom > fromRect.top)));
      const idx = pickNext(fromRect, same.map((c) => c.rect), dir);
      if (idx >= 0) {
        this.set(same[idx].el);
        return;
      }
    }
    if (plan.jumpTo !== null) {
      const target = this.columnTarget(plan.jumpTo, candidates, columns, fromRect);
      if (target) {
        this.set(target);
        return;
      }
    }
    if (plan.within) scrollFrom(from, verticalScroll(dir));
  }

  // Where to land when jumping into a column: where you last were in it,
  // else the item Discord marks as selected, else the row level with you.
  columnTarget(column, candidates, columns, fromRect) {
    const inColumn = candidates.filter((c) => columnForX(centerX(c.rect), columns) === column);
    if (!inColumn.length) return null;
    const last = this.lastInColumn.get(column);
    if (last && inColumn.some((c) => c.el === last)) return last;
    const selected = inColumn.find((c) => c.el.matches(SELECTED) || c.el.closest(SELECTED));
    if (selected) return selected.el;
    const y = (fromRect.top + fromRect.bottom) / 2;
    const idx = nearestTo({ x: centerX(inColumn[0].rect), y }, inColumn.map((c) => c.rect));
    return inColumn[idx].el;
  }

  // Adopt an element Discord focused itself (e.g. the search box of a
  // dialog that just opened) so the ring follows it.
  adopt(el) {
    if (el === this.current) return;
    this.current = el;
    this.onLand?.(el);
  }

  set(el) {
    this.current = el;
    if (!el) return;
    el.focus({ preventScroll: true });
    el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    this.onLand?.(el);
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

function verticalScroll(dir) {
  if (dir === 'up') return -200;
  if (dir === 'down') return 200;
  return 0;
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
