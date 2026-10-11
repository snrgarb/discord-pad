'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { PRESETS, defaultHide } = require('./css-overrides');

// Actions the preload understands. Mapping values must come from this list.
const ACTIONS = [
  'activate', 'back', 'toggleMute', 'toggleDeafen',
  'prevServer', 'nextServer', 'prevChannel', 'nextChannel',
  'answerCall', 'hangUp', 'quickSwitcher', 'toggleHelp', 'none',
];

// Standard Gamepad API button indices (Xbox layout).
const DEFAULTS = Object.freeze({
  fullscreen: true,
  zoomFactor: 1.25,
  // Rumble briefly on an incoming call (if the controller supports it).
  rumbleOnCall: true,
  // Hide the mouse cursor while the controller is being used.
  hideCursor: true,
  stickDeadzone: 0.5,
  // Built-in CSS presets that hide Discord elements (see css-overrides.js).
  hide: Object.freeze(defaultHide()),
  mapping: Object.freeze({
    0: 'activate',      // A
    1: 'back',          // B
    2: 'toggleMute',    // X
    3: 'toggleDeafen',  // Y
    4: 'prevServer',    // LB
    5: 'nextServer',    // RB
    6: 'prevChannel',   // LT
    7: 'nextChannel',   // RT
    8: 'toggleHelp',    // View
    9: 'quickSwitcher', // Menu
    10: 'answerCall',   // Left stick click
    11: 'hangUp',       // Right stick click
  }),
});

function clamp(n, lo, hi) {
  return Math.min(hi, Math.max(lo, n));
}

// Merge user settings over defaults, dropping anything malformed.
function normalize(raw) {
  const out = { ...DEFAULTS, hide: { ...DEFAULTS.hide }, mapping: { ...DEFAULTS.mapping } };
  if (!raw || typeof raw !== 'object') return out;

  if (typeof raw.fullscreen === 'boolean') out.fullscreen = raw.fullscreen;
  if (typeof raw.rumbleOnCall === 'boolean') out.rumbleOnCall = raw.rumbleOnCall;
  if (typeof raw.hideCursor === 'boolean') out.hideCursor = raw.hideCursor;
  if (Number.isFinite(raw.zoomFactor)) out.zoomFactor = clamp(raw.zoomFactor, 0.5, 3);
  if (Number.isFinite(raw.stickDeadzone)) out.stickDeadzone = clamp(raw.stickDeadzone, 0.1, 0.9);

  if (raw.hide && typeof raw.hide === 'object') {
    for (const [id, on] of Object.entries(raw.hide)) {
      if (Object.hasOwn(PRESETS, id) && typeof on === 'boolean') out.hide[id] = on;
    }
  }

  if (raw.mapping && typeof raw.mapping === 'object') {
    for (const [key, action] of Object.entries(raw.mapping)) {
      const idx = Number(key);
      if (Number.isInteger(idx) && idx >= 0 && idx <= 16 && ACTIONS.includes(action)) {
        out.mapping[idx] = action;
      }
    }
  }
  return out;
}

function settingsPath(userDataDir) {
  return path.join(userDataDir, 'settings.json');
}

function load(userDataDir) {
  const file = settingsPath(userDataDir);
  try {
    const settings = normalize(JSON.parse(fs.readFileSync(file, 'utf8')));
    // Write back so options added in newer versions show up in the file.
    save(userDataDir, settings);
    return settings;
  } catch (err) {
    if (err.code !== 'ENOENT') console.warn(`Ignoring unreadable settings at ${file}: ${err.message}`);
    const defaults = normalize(null);
    save(userDataDir, defaults);
    return defaults;
  }
}

function save(userDataDir, settings) {
  try {
    fs.mkdirSync(userDataDir, { recursive: true });
    fs.writeFileSync(settingsPath(userDataDir), JSON.stringify(settings, null, 2));
  } catch (err) {
    console.warn(`Could not save settings: ${err.message}`);
  }
}

module.exports = { ACTIONS, DEFAULTS, normalize, load, save };
