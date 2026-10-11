// Pure spatial-navigation math. Rects are {left, top, right, bottom}.

export const DIRECTIONS = ['up', 'down', 'left', 'right'];

const center = (r) => ({ x: (r.left + r.right) / 2, y: (r.top + r.bottom) / 2 });

// Gap between two 1-D ranges; 0 when they overlap.
function rangeGap(aStart, aEnd, bStart, bEnd) {
  if (aEnd < bStart) return bStart - aEnd;
  if (bEnd < aStart) return aStart - bEnd;
  return 0;
}

// Score for moving from `from` to `to` in `dir`; Infinity if `to` isn't in that direction.
// Lower is better. Candidates whose cross-axis range overlaps the source win
// strongly, so moving down a list stays in the list instead of jumping columns.
export function score(from, to, dir) {
  const a = center(from);
  const b = center(to);
  let primary;
  let cross;
  let crossCenter;
  switch (dir) {
    case 'right':
      if (b.x <= a.x + 1) return Infinity;
      primary = Math.max(0, to.left - from.right);
      cross = rangeGap(from.top, from.bottom, to.top, to.bottom);
      crossCenter = Math.abs(b.y - a.y);
      break;
    case 'left':
      if (b.x >= a.x - 1) return Infinity;
      primary = Math.max(0, from.left - to.right);
      cross = rangeGap(from.top, from.bottom, to.top, to.bottom);
      crossCenter = Math.abs(b.y - a.y);
      break;
    case 'down':
      if (b.y <= a.y + 1) return Infinity;
      primary = Math.max(0, to.top - from.bottom);
      cross = rangeGap(from.left, from.right, to.left, to.right);
      crossCenter = Math.abs(b.x - a.x);
      break;
    case 'up':
      if (b.y >= a.y - 1) return Infinity;
      primary = Math.max(0, from.top - to.bottom);
      cross = rangeGap(from.left, from.right, to.left, to.right);
      crossCenter = Math.abs(b.x - a.x);
      break;
    default:
      return Infinity;
  }
  return primary + cross * 3 + crossCenter * 0.1;
}

// Index of the best candidate rect from `from` in `dir`, or -1.
export function pickNext(from, rects, dir) {
  let best = -1;
  let bestScore = Infinity;
  rects.forEach((r, i) => {
    const s = score(from, r, dir);
    if (s < bestScore) {
      bestScore = s;
      best = i;
    }
  });
  return best;
}

// Index of the rect whose center is closest to a point, or -1.
export function nearestTo(point, rects) {
  let best = -1;
  let bestDist = Infinity;
  rects.forEach((r, i) => {
    const c = center(r);
    const d = Math.hypot(c.x - point.x, c.y - point.y);
    if (d < bestDist) {
      bestDist = d;
      best = i;
    }
  });
  return best;
}

// True when `outer` and `inner` cover nearly the same box (nested wrappers).
export function sameBox(outer, inner, tolerance = 4) {
  return Math.abs(outer.left - inner.left) <= tolerance
    && Math.abs(outer.top - inner.top) <= tolerance
    && Math.abs(outer.right - inner.right) <= tolerance
    && Math.abs(outer.bottom - inner.bottom) <= tolerance;
}

// Thin strips (dividers, scrollbar-like handles) that a focus ring would
// render as a line rather than a control.
export function isSliver(rect, thickness = 12, ratio = 4) {
  const w = rect.right - rect.left;
  const h = rect.bottom - rect.top;
  return (w < thickness && h > w * ratio) || (h < thickness && w > h * ratio);
}

// Column navigation. Columns: 0 = servers, 1 = channels/DMs, 2 = main.
export const COLUMNS = 3;

export function columnForX(x, { serversRight, sidebarRight }) {
  if (x <= serversRight) return 0;
  if (x <= sidebarRight) return 1;
  return 2;
}

// How a D-pad press should move from a given column:
//   within: try to move to another element in the same column first
//   jumpTo: column to jump to (if `within` found nothing, or straight away)
// Up/down stay in the column. In the server and channel columns left/right
// always jump a whole column; in the main area they move between controls
// and only jump back to the sidebar at the left edge.
export function planMove(column, dir) {
  if (dir === 'up' || dir === 'down') return { within: true, jumpTo: null };
  if (column === 2) return { within: true, jumpTo: dir === 'left' ? 1 : null };
  const target = column + (dir === 'right' ? 1 : -1);
  return { within: false, jumpTo: target >= 0 && target < COLUMNS ? target : null };
}
