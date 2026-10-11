// Rows of the controller settings menu and how each one changes settings.
// Pure: rows read a settings object and return a patch for the main process.

import { BUTTON_NAMES, ACTION_NAMES } from './labels.mjs';

export const ZOOM_STEPS = [0.8, 0.9, 1, 1.1, 1.25, 1.5, 1.75, 2, 2.5];

const onOff = (v) => (v ? 'On' : 'Off');

function cycle(list, current, delta) {
  const i = list.indexOf(current);
  const start = i === -1 ? 0 : i;
  return list[(start + delta + list.length) % list.length];
}

function nearestStep(value) {
  return ZOOM_STEPS.reduce((best, s) => (Math.abs(s - value) < Math.abs(best - value) ? s : best));
}

// schema: { presets: [{id, label}], actions: [...] } from the main process.
export function buildRows(schema) {
  const rows = [
    { section: 'Display' },
    {
      id: 'fullscreen',
      label: 'Full screen',
      value: (s) => onOff(s.fullscreen),
      change: (s) => ({ fullscreen: !s.fullscreen }),
    },
    {
      id: 'couchUi',
      label: 'Couch UI (TV theme and larger rows)',
      value: (s) => onOff(s.couchUi),
      change: (s) => ({ couchUi: !s.couchUi }),
    },
    {
      id: 'zoom',
      label: 'Zoom',
      value: (s) => `${Math.round(s.zoomFactor * 100)}%`,
      change: (s, delta) => {
        const steps = ZOOM_STEPS;
        const i = steps.indexOf(nearestStep(s.zoomFactor));
        return { zoomFactor: steps[Math.min(steps.length - 1, Math.max(0, i + delta))] };
      },
    },
    {
      id: 'hideCursor',
      label: 'Hide mouse cursor while using the controller',
      value: (s) => onOff(s.hideCursor),
      change: (s) => ({ hideCursor: !s.hideCursor }),
    },
    {
      id: 'rumbleOnCall',
      label: 'Rumble on incoming call',
      value: (s) => onOff(s.rumbleOnCall),
      change: (s) => ({ rumbleOnCall: !s.rumbleOnCall }),
    },
    { section: 'Hide Discord elements' },
    ...schema.presets.map(({ id, label }) => ({
      id: `hide.${id}`,
      label,
      value: (s) => (s.hide[id] ? 'Hidden' : 'Shown'),
      change: (s) => ({ hide: { ...s.hide, [id]: !s.hide[id] } }),
    })),
    { section: 'Buttons' },
    ...Object.keys(BUTTON_NAMES).map((btn) => ({
      id: `mapping.${btn}`,
      label: BUTTON_NAMES[btn],
      value: (s) => ACTION_NAMES[s.mapping[btn]] || s.mapping[btn],
      change: (s, delta) => ({
        mapping: { ...s.mapping, [btn]: cycle(schema.actions, s.mapping[btn], delta) },
      }),
    })),
    { section: '' },
    { id: 'reset', label: 'Reset everything to defaults', value: () => '', action: 'reset' },
    { id: 'close', label: 'Close settings', value: () => '', action: 'close' },
  ];
  return rows;
}

export const selectable = (rows) => rows
  .map((row, i) => (row.section === undefined ? i : -1))
  .filter((i) => i >= 0);

// Next selectable row index moving by `delta` (wraps).
export function moveSelection(rows, index, delta) {
  const ids = selectable(rows);
  const pos = ids.indexOf(index);
  const next = pos === -1 ? 0 : (pos + delta + ids.length) % ids.length;
  return ids[next];
}

// The menu must leave a way to select things and to open it again; refuse
// a mapping that removes the last "activate" button.
export function isSafeMapping(mapping) {
  return Object.values(mapping).includes('activate');
}
