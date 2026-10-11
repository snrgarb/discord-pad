'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {
  PRESETS, CUSTOM_CSS_TEMPLATE, defaultHide, buildCss, readCustomCss, customCssPath,
} = require('../src/main/css-overrides');
const settings = require('../src/main/settings');

test('buildCss includes only enabled presets', () => {
  const css = buildCss({ giftButton: true, memberList: false });
  assert.match(css, /Send a gift/);
  assert.doesNotMatch(css, /membersWrap/);
});

test('buildCss appends custom CSS last', () => {
  const css = buildCss({ giftButton: true }, '.x { display: none; }');
  assert.ok(css.indexOf('.x {') > css.indexOf('Send a gift'));
});

test('buildCss is empty when nothing is enabled', () => {
  assert.equal(buildCss({}, '  \n'), '');
});

test('every preset is valid-looking CSS with a label and boolean default', () => {
  for (const [id, preset] of Object.entries(PRESETS)) {
    assert.equal(typeof preset.label, 'string', id);
    assert.equal(typeof preset.default, 'boolean', id);
    assert.match(preset.css, /\{\s*display:\s*none !important;\s*\}/, id);
    assert.equal((preset.css.match(/\{/g) || []).length, (preset.css.match(/\}/g) || []).length, id);
  }
});

test('defaultHide mirrors preset defaults', () => {
  const hide = defaultHide();
  assert.equal(hide.nitroUpsells, true);
  assert.equal(hide.memberList, false);
});

test('readCustomCss creates the template once and then returns user edits', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pad-css-'));
  assert.equal(readCustomCss(dir), '');
  assert.equal(fs.readFileSync(customCssPath(dir), 'utf8'), CUSTOM_CSS_TEMPLATE);
  fs.writeFileSync(customCssPath(dir), '.a { color: red; }');
  assert.equal(readCustomCss(dir), '.a { color: red; }');
  fs.rmSync(dir, { recursive: true });
});

test('settings keep valid hide toggles and drop unknown ones', () => {
  const s = settings.normalize({ hide: { memberList: true, giftButton: 'no', bogus: true } });
  assert.equal(s.hide.memberList, true);
  assert.equal(s.hide.giftButton, PRESETS.giftButton.default);
  assert.equal(Object.hasOwn(s.hide, 'bogus'), false);
});

test('loading old settings writes new options back to the file', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pad-set-'));
  fs.writeFileSync(path.join(dir, 'settings.json'), JSON.stringify({ zoomFactor: 1.5 }));
  settings.load(dir);
  const saved = JSON.parse(fs.readFileSync(path.join(dir, 'settings.json'), 'utf8'));
  assert.equal(saved.zoomFactor, 1.5);
  assert.equal(saved.hide.nitroUpsells, true);
  fs.rmSync(dir, { recursive: true });
});
