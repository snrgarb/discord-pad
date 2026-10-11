'use strict';

// Key chords the preload may ask the main process to send as trusted input.
// Anything not listed here is rejected, so a compromised page can't use the
// bridge to type arbitrary shortcuts.
const CHORDS = Object.freeze({
  escape: { keyCode: 'Escape', modifiers: [] },
  enter: { keyCode: 'Enter', modifiers: [] },
  backspace: { keyCode: 'Backspace', modifiers: [] },
  tab: { keyCode: 'Tab', modifiers: [] },
  shiftTab: { keyCode: 'Tab', modifiers: ['shift'] },
  left: { keyCode: 'Left', modifiers: [] },
  right: { keyCode: 'Right', modifiers: [] },
  up: { keyCode: 'Up', modifiers: [] },
  down: { keyCode: 'Down', modifiers: [] },
  // Discord default hotkeys.
  toggleMute: { keyCode: 'M', modifiers: ['control', 'shift'] },
  toggleDeafen: { keyCode: 'D', modifiers: ['control', 'shift'] },
  prevServer: { keyCode: 'Up', modifiers: ['control', 'alt'] },
  nextServer: { keyCode: 'Down', modifiers: ['control', 'alt'] },
  prevChannel: { keyCode: 'Up', modifiers: ['alt'] },
  nextChannel: { keyCode: 'Down', modifiers: ['alt'] },
  quickSwitcher: { keyCode: 'K', modifiers: ['control'] },
  answerCall: { keyCode: 'Enter', modifiers: ['control'] },
  declineCall: { keyCode: 'Escape', modifiers: [] },
});

function resolveChord(name) {
  return typeof name === 'string' && Object.hasOwn(CHORDS, name) ? CHORDS[name] : null;
}

// Max characters accepted per insert-text request from the on-screen keyboard.
const MAX_TEXT = 64;

function sanitizeText(text) {
  if (typeof text !== 'string' || text.length === 0 || text.length > MAX_TEXT) return null;
  // No control characters; Enter/Backspace go through chords.
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f\u007f]/.test(text)) return null;
  return text;
}

// Electron's sendInputEvent sequence for a chord.
function chordEvents(chord) {
  const { keyCode, modifiers } = chord;
  return [
    { type: 'keyDown', keyCode, modifiers },
    { type: 'keyUp', keyCode, modifiers },
  ];
}

module.exports = { CHORDS, resolveChord, sanitizeText, chordEvents, MAX_TEXT };
