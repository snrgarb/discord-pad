// Everything that depends on Discord's markup lives here. Discord's class
// names are hashed and change often, so prefer roles and aria-labels.
// If a feature stops working after a Discord update, start here.

export const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([type="hidden"]):not([disabled])',
  'textarea:not([disabled])',
  'select:not([disabled])',
  '[contenteditable="true"]',
  '[role="button"]',
  '[role="link"]',
  '[role="tab"]',
  '[role="treeitem"]',
  '[role="option"]',
  '[role="menuitem"]',
  '[role="menuitemcheckbox"]',
  '[role="menuitemradio"]',
  '[role="checkbox"]',
  '[role="switch"]',
  '[role="radio"]',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

// Matched by FOCUSABLE but never worth landing on: sidebar resize handles
// and dividers (Discord gives the sidebar resizer a tabindex).
export const NOT_NAVIGABLE = [
  '[role="separator"]',
  '[aria-label*="resize" i]',
  '[class*="resizeHandle"]',
  '[class*="sash"]',
].join(',');

// Topmost layer that should capture navigation (modals, menus, popouts).
export const LAYERS = '[role="dialog"], [aria-modal="true"], [role="menu"], [role="listbox"]';

export const TEXT_INPUT = 'input:not([type="checkbox"]):not([type="radio"]):not([type="range"]):not([type="button"]):not([type="submit"]), textarea, [contenteditable="true"]';

// Voice panel (bottom-left, visible while connected to voice or a call).
export const DISCONNECT_BUTTON = 'button[aria-label="Disconnect"], [role="button"][aria-label="Disconnect"]';
export const MUTE_SWITCH = '[role="switch"][aria-label="Mute"], button[aria-label="Mute"], button[aria-label="Unmute"]';
export const DEAFEN_SWITCH = '[role="switch"][aria-label="Deafen"], button[aria-label="Deafen"], button[aria-label="Undeafen"]';

// Incoming-call prompt. Matched by the accept button's label; the container
// is whatever dialog/region holds it.
export const ACCEPT_CALL_LABELS = /^(accept|answer|join call|join video call)\b/i;
export const DECLINE_CALL_LABELS = /^(decline|ignore|reject)\b/i;
export const INCOMING_CALL_TEXT = /incoming (video )?call/i;

// Voice channels in the channel list carry this in their aria-label.
export const VOICE_CHANNEL_LABEL = /\(voice channel\)|voice channel,/i;
