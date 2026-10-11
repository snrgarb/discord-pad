// Pure rules for the Couch UI adapter: given facts about a Discord element,
// which data-dp-role it gets. Kept free of the DOM so it can be unit-tested.

const DM_HREF = /^\/channels\/@me\/\d+/;
const CHANNEL_HREF = /^\/channels\/\d+\/\d+/;
const CHANNEL_LABEL = /\((text|voice|announcement|forum|stage|media) channel\)|(text|voice|announcement|forum|stage) channel,/i;

// role for a link/row in the channel column, from its href and aria-label.
export function classifyListItem({ href = '', label = '' }) {
  if (DM_HREF.test(href)) return 'dm';
  if (CHANNEL_HREF.test(href) || CHANNEL_LABEL.test(label)) return 'channel';
  return null;
}

// Whether a candidate is the sidebar container: it sits right of the server
// rail, is narrow enough to be a sidebar, and spans most of the height.
export function looksLikeSidebar(rect, { serversRight, viewportHeight }) {
  const width = rect.right - rect.left;
  return rect.left >= serversRight - 2
    && width >= 180 && width <= 480
    && (rect.bottom - rect.top) >= viewportHeight * 0.6;
}

// Climb from `rects[0]` (innermost) outward while the box keeps the same left
// edge and width; returns the index of the outermost such box, i.e. the
// element that is the sidebar's flex item rather than an inner wrapper.
export function outermostSameColumn(rects, tolerance = 4) {
  const base = rects[0];
  let best = 0;
  for (let i = 1; i < rects.length; i += 1) {
    const r = rects[i];
    const sameLeft = Math.abs(r.left - base.left) <= tolerance;
    const sameWidth = Math.abs((r.right - r.left) - (base.right - base.left)) <= tolerance;
    if (!sameLeft || !sameWidth) break;
    best = i;
  }
  return best;
}

// How far (px) to move the server icons right so their centre lines up with
// the rail's centre. Negative means they're already right of centre.
export function railShift(railRect, iconRect) {
  const railCentre = (railRect.left + railRect.right) / 2;
  const iconCentre = (iconRect.left + iconRect.right) / 2;
  return railCentre - iconCentre;
}
