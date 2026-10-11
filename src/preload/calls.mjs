import {
  DISCONNECT_BUTTON, MUTE_SWITCH, DEAFEN_SWITCH,
  ACCEPT_CALL_LABELS, DECLINE_CALL_LABELS, INCOMING_CALL_TEXT,
} from './selectors.mjs';

const label = (el) => (el.getAttribute('aria-label') || el.textContent || '').trim();

function visible(el) {
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0;
}

function findButton(pattern, root = document) {
  return [...root.querySelectorAll('button, [role="button"]')]
    .find((el) => visible(el) && pattern.test(label(el))) || null;
}

// The incoming-call prompt, if one is showing: {accept, decline}.
export function findIncomingCall() {
  const regions = [...document.querySelectorAll('[role="dialog"], [aria-live], section, div[class*="ncoming"]')]
    .filter((el) => visible(el) && INCOMING_CALL_TEXT.test(el.textContent || ''));
  for (const region of regions) {
    const accept = findButton(ACCEPT_CALL_LABELS, region);
    if (accept) return { accept, decline: findButton(DECLINE_CALL_LABELS, region) };
  }
  return null;
}

export function findDisconnect() {
  return [...document.querySelectorAll(DISCONNECT_BUTTON)].find(visible) || null;
}

// true/false when the switch exposes its state, null when unknown.
function switchState(selector, onLabel) {
  const el = [...document.querySelectorAll(selector)].find(visible);
  if (!el) return null;
  const checked = el.getAttribute('aria-checked') ?? el.getAttribute('aria-pressed');
  if (checked !== null) return checked === 'true';
  return el.getAttribute('aria-label') === onLabel;
}

export const isMuted = () => switchState(MUTE_SWITCH, 'Unmute');
export const isDeafened = () => switchState(DEAFEN_SWITCH, 'Undeafen');

// Polls for call state changes and reports them.
export function watchCalls({ onIncoming, onCallStateChange }) {
  let ringing = false;
  let inCall = false;
  setInterval(() => {
    const incoming = findIncomingCall();
    if (incoming && !ringing) onIncoming(incoming);
    ringing = Boolean(incoming);

    const nowInCall = Boolean(findDisconnect());
    if (nowInCall !== inCall) {
      inCall = nowInCall;
      onCallStateChange(inCall);
    }
  }, 750);
}
