'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { resolveChord, sanitizeText, chordEvents } = require('../src/main/keys');
const { isDiscordUrl, chromeUserAgent } = require('../src/main/origins');
const settings = require('../src/main/settings');

test('only allowlisted chords resolve', () => {
  assert.deepEqual(resolveChord('toggleMute'), { keyCode: 'M', modifiers: ['control', 'shift'] });
  assert.equal(resolveChord('toString'), null);
  assert.equal(resolveChord('__proto__'), null);
  assert.equal(resolveChord({}), null);
});

test('chordEvents produces a key down and up', () => {
  assert.deepEqual(chordEvents(resolveChord('escape')).map((e) => e.type), ['keyDown', 'keyUp']);
});

test('sanitizeText rejects control characters and oversize input', () => {
  assert.equal(sanitizeText('hi 👍'), 'hi 👍');
  assert.equal(sanitizeText('\n'), null);
  assert.equal(sanitizeText(''), null);
  assert.equal(sanitizeText('x'.repeat(65)), null);
  assert.equal(sanitizeText(42), null);
});

test('isDiscordUrl accepts Discord hosts over https only', () => {
  assert.ok(isDiscordUrl('https://discord.com/app'));
  assert.ok(isDiscordUrl('https://ptb.discord.com/channels/@me'));
  assert.ok(isDiscordUrl('https://discord.gg/abc'));
  assert.ok(!isDiscordUrl('http://discord.com/app'));
  assert.ok(!isDiscordUrl('https://discord.com.evil.example/'));
  assert.ok(!isDiscordUrl('https://notdiscord.com/'));
  assert.ok(!isDiscordUrl('not a url'));
});

test('chromeUserAgent strips the Electron token', () => {
  const ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) discord-pad/0.1.0 Chrome/140.0.0.0 Electron/44.7.0 Safari/537.36';
  assert.equal(chromeUserAgent(ua), 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36');
});

test('settings normalize drops bad values and clamps numbers', () => {
  const s = settings.normalize({
    zoomFactor: 10, fullscreen: 'yes', mapping: { 0: 'back', 1: 'rm -rf', 99: 'activate' },
  });
  assert.equal(s.zoomFactor, 3);
  assert.equal(s.fullscreen, true);
  assert.equal(s.mapping[0], 'back');
  assert.equal(s.mapping[1], 'back');
  assert.equal(s.mapping[99], undefined);
});

test('every default mapping is a known action', () => {
  for (const action of Object.values(settings.DEFAULTS.mapping)) {
    assert.ok(settings.ACTIONS.includes(action), action);
  }
});

test('load writes defaults when no file exists and reads them back', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pad-'));
  const first = settings.load(dir);
  assert.equal(first.zoomFactor, settings.DEFAULTS.zoomFactor);
  fs.writeFileSync(path.join(dir, 'settings.json'), JSON.stringify({ zoomFactor: 1.5 }));
  assert.equal(settings.load(dir).zoomFactor, 1.5);
  fs.rmSync(dir, { recursive: true });
});
