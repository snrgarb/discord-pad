// On-screen keyboard layouts and grid movement. Pure.
// A key is {label, value?, action?, w?}; w is relative width (default 1).

const k = (chars) => [...chars].map((c) => ({ label: c, value: c }));

const SPECIAL_ROW = [
  { label: 'Shift', action: 'shift', w: 1.5 },
  { label: '?123', action: 'symbols', w: 1.5 },
  { label: 'Space', value: ' ', w: 4 },
  { label: 'Delete', action: 'backspace', w: 1.5 },
  { label: 'Send', action: 'enter', w: 1.5 },
  { label: 'Close', action: 'close', w: 1 },
];

export const LAYOUTS = {
  letters: [
    k('1234567890'),
    k('qwertyuiop'),
    [...k('asdfghjkl'), { label: "'", value: "'" }],
    [...k('zxcvbnm'), ...k(',.?')],
    SPECIAL_ROW,
  ],
  symbols: [
    k('!@#$%^&*()'),
    k('-_=+[]{}\\|'),
    k(';:"<>/~`€£'),
    ['😀', '😂', '👍', '❤️', '🎉', '🙏', '😭', '🔥', '✅', '👀'].map((c) => ({ label: c, value: c })),
    SPECIAL_ROW.map((key) => (key.action === 'symbols' ? { ...key, label: 'ABC' } : key)),
  ],
};

const width = (key) => key.w || 1;

function centers(row) {
  const total = row.reduce((s, key) => s + width(key), 0);
  let x = 0;
  return row.map((key) => {
    const c = (x + width(key) / 2) / total;
    x += width(key);
    return c;
  });
}

// Move a {row, col} cursor in a layout. Left/right wrap within the row;
// up/down wrap between top and bottom and land on the key nearest horizontally.
export function moveInGrid(layout, pos, dir) {
  const { row, col } = pos;
  const len = layout[row].length;
  if (dir === 'left') return { row, col: (col - 1 + len) % len };
  if (dir === 'right') return { row, col: (col + 1) % len };
  if (dir !== 'up' && dir !== 'down') return pos;

  const target = (row + (dir === 'down' ? 1 : -1) + layout.length) % layout.length;
  const x = centers(layout[row])[col];
  const targetCenters = centers(layout[target]);
  let best = 0;
  targetCenters.forEach((c, i) => {
    if (Math.abs(c - x) < Math.abs(targetCenters[best] - x)) best = i;
  });
  return { row: target, col: best };
}

export function keyAt(layout, pos) {
  return layout[pos.row]?.[pos.col] || null;
}

export function applyShift(value, shifted) {
  return shifted ? value.toUpperCase() : value;
}
