'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {
  COUCH_CSS, PRESETS, CUSTOM_CSS_TEMPLATE, defaultHide, buildCss, readCustomCss, customCssPath,
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

test('Couch UI CSS goes first so presets and custom.css can override it', () => {
  const css = buildCss({ giftButton: true }, '.mine {}', { couchUi: true });
  assert.ok(css.indexOf('couch-ui') < css.indexOf('Send a gift'));
  assert.ok(css.indexOf('Send a gift') < css.indexOf('.mine {}'));
  assert.doesNotMatch(buildCss({}, '', { couchUi: false }), /data-dp-region/);
});

test('Couch UI CSS only targets adapter markers and theme variables', () => {
  // Guard against broad rules that could break Discord's layout.
  const selectors = COUCH_CSS.replace(/\/\*[\s\S]*?\*\//g, '')
    .split('}').map((block) => block.split('{')[0].trim()).filter(Boolean);
  for (const sel of selectors) {
    if (sel.startsWith('@media')) continue;
    assert.match(sel, /data-dp-/, sel);
  }
});

test('Couch UI keeps Discord\'s stock colours', () => {
  // Only Discord's own variables (with a fallback) may set colours.
  const code = COUCH_CSS.replace(/\/\*[\s\S]*?\*\//g, '').replace(/var\([^)]*\)/g, '');
  assert.doesNotMatch(code, /#[0-9a-f]{3,8}\b|rgba?\(/i);
  assert.doesNotMatch(COUCH_CSS, /--background-primary\s*:/);
});
