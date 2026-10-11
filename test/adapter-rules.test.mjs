import test from 'node:test';
import assert from 'node:assert/strict';
import {
  classifyListItem, looksLikeSidebar, outermostSameColumn, railShift,
} from '../src/preload/adapter-rules.mjs';

test('classifyListItem tells DMs from channels', () => {
  assert.equal(classifyListItem({ href: '/channels/@me/123456' }), 'dm');
  assert.equal(classifyListItem({ href: '/channels/111/222' }), 'channel');
  assert.equal(classifyListItem({ label: 'Lounge (voice channel)' }), 'channel');
  assert.equal(classifyListItem({ label: 'general (text channel)' }), 'channel');
  assert.equal(classifyListItem({ href: '/channels/@me' }), null); // Friends link
  assert.equal(classifyListItem({ href: '/store' }), null);
});

const r = (left, top, w, h) => ({ left, top, right: left + w, bottom: top + h });

test('looksLikeSidebar wants a tall, sidebar-width box right of the rail', () => {
  const ctx = { serversRight: 72, viewportHeight: 1000 };
  assert.ok(looksLikeSidebar(r(72, 0, 240, 1000), ctx));
  assert.ok(!looksLikeSidebar(r(72, 0, 900, 1000), ctx)); // whole app
  assert.ok(!looksLikeSidebar(r(72, 0, 240, 200), ctx)); // a short panel
  assert.ok(!looksLikeSidebar(r(0, 0, 240, 1000), ctx)); // overlaps the rail
});

test('outermostSameColumn climbs wrappers until the box changes', () => {
  const chain = [r(72, 50, 240, 800), r(72, 0, 240, 1000), r(72, 0, 241, 1000), r(0, 0, 1600, 1000)];
  assert.equal(outermostSameColumn(chain), 2);
  assert.equal(outermostSameColumn([r(0, 0, 10, 10)]), 0);
});

test('railShift is how far the icons sit left of the rail centre', () => {
  assert.equal(railShift(r(0, 0, 88, 1000), r(12, 0, 48, 48)), 8);
  assert.equal(railShift(r(0, 0, 88, 1000), r(20, 0, 48, 48)), 0);
  assert.equal(railShift(r(0, 0, 88, 1000), r(30, 0, 48, 48)), -10);
});
