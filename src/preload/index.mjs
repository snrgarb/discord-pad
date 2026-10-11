import { ipcRenderer } from 'electron';
import { GamepadReader, mergePads, BUTTON } from './gamepad.mjs';
import { createOverlay } from './overlay.mjs';
import {
  FocusManager, activate, scrollFrom, textFieldOf,
} from './focus.mjs';
import { OnScreenKeyboard } from './osk.mjs';
import {
  watchCalls, findIncomingCall, findDisconnect, isMuted, isDeafened,
} from './calls.mjs';
import { TEXT_INPUT, VOICE_CHANNEL_LABEL } from './selectors.mjs';

import { BUTTON_NAMES, ACTION_NAMES } from './labels.mjs';
import { SettingsMenu } from './settings-menu.mjs';
import { CouchAdapter } from './adapter.mjs';

const chord = (name) => ipcRenderer.send('pad:chord', name);
const typeText = (text) => ipcRenderer.send('pad:text', text);

async function main() {
  let settings = await ipcRenderer.invoke('pad:get-settings');
  if (!settings) return;
  const schema = await ipcRenderer.invoke('pad:settings-schema');

  const overlay = createOverlay();
  // Landing on a text field shows how to type into it.
  const adapter = new CouchAdapter();
  const applyTheme = () => {
    adapter.setEnabled(settings.couchUi);
    overlay.setTheme(settings.couchUi ? 'couch' : null);
  };
  applyTheme();

  const focus = new FocusManager(overlay, {
    onLand: (el) => {
      adapter.setFocus(el);
      if (textFieldOf(el)) overlay.toast('Press A to open the keyboard', { ms: 1600 });
    },
  });
  const osk = new OnScreenKeyboard(overlay.osk, {
    typeText,
    sendChord: chord,
    onClose: () => focus.ensure(),
  });
  const reader = new GamepadReader({ deadzone: settings.stickDeadzone });

  const renderHelp = () => overlay.setHelp([
    ['D-pad / left stick', 'Move (left/right jump between columns)'],
    ['Right stick', 'Scroll'],
    ...Object.entries(settings.mapping)
      .filter(([, action]) => action !== 'none')
      .map(([btn, action]) => [BUTTON_NAMES[btn] || `Button ${btn}`, ACTION_NAMES[action] || action]),
    ['View + Y', 'Settings'],
  ]);
  renderHelp();

  const applyLocal = (next) => {
    if (!next) return;
    settings = next;
    renderHelp();
    applyTheme();
  };
  const menu = new SettingsMenu(overlay.settings, {
    schema,
    getSettings: () => settings,
    update: async (patch) => applyLocal(await ipcRenderer.invoke('pad:update-settings', patch)),
    reset: async () => applyLocal(await ipcRenderer.invoke('pad:reset-settings')),
    onClose: () => focus.ensure(),
    toast: (text) => overlay.toast(text),
  });

  // Cursor hides while the controller is in use and returns with the mouse.
  const cursorStyle = document.createElement('style');
  cursorStyle.textContent = '* { cursor: none !important; }';
  const setControllerMode = (on) => {
    if (on) {
      if (settings.hideCursor && !cursorStyle.isConnected) document.documentElement.appendChild(cursorStyle);
    } else {
      cursorStyle.remove();
      focus.hide();
    }
  };
  addEventListener('mousemove', () => setControllerMode(false), { passive: true });

  // When Discord moves focus into a text field itself (quick switcher,
  // search, a dialog opening), follow it so A opens the keyboard there.
  addEventListener('focusin', (e) => {
    const el = e.target;
    if (!focus.active || osk.visible || !(el instanceof Element) || !el.matches(TEXT_INPUT)) return;
    focus.adopt(el);
  }, true);

  let lastPads = [];
  const rumble = () => {
    for (const pad of lastPads) {
      pad?.vibrationActuator?.playEffect?.('dual-rumble', {
        duration: 600, strongMagnitude: 0.8, weakMagnitude: 0.6,
      }).catch(() => {});
    }
  };

  const reportToggle = (label, read) => {
    setTimeout(() => {
      const state = read();
      overlay.toast(state === null ? `${label} toggled` : `${label} ${state ? 'on' : 'off'}`);
    }, 250);
  };

  const actions = {
    activate() {
      const el = focus.ensure();
      if (!el) return;
      const field = textFieldOf(el);
      if (field) {
        field.focus();
        osk.open(field);
      } else {
        activate(el);
      }
    },
    back() {
      const incoming = findIncomingCall();
      if (overlay.helpVisible()) overlay.toggleHelp(false);
      else if (incoming?.decline) activate(incoming.decline);
      else chord('escape');
    },
    toggleMute() {
      chord('toggleMute');
      reportToggle('Mute', isMuted);
    },
    toggleDeafen() {
      chord('toggleDeafen');
      reportToggle('Deafen', isDeafened);
    },
    prevServer: () => chord('prevServer'),
    nextServer: () => chord('nextServer'),
    prevChannel: () => chord('prevChannel'),
    nextChannel: () => chord('nextChannel'),
    quickSwitcher: () => chord('quickSwitcher'),
    toggleHelp: () => overlay.toggleHelp(),
    answerCall() {
      const incoming = findIncomingCall();
      if (incoming) {
        activate(incoming.accept);
        overlay.toast('Answering…');
        return;
      }
      const el = focus.current;
      if (el && VOICE_CHANNEL_LABEL.test(el.getAttribute('aria-label') || '')) {
        activate(el);
        overlay.toast('Joining voice…');
        return;
      }
      chord('answerCall');
    },
    hangUp() {
      const btn = findDisconnect();
      if (btn) {
        activate(btn);
        overlay.toast('Disconnected');
      } else {
        overlay.toast('Not in a call');
      }
    },
    none() {},
  };

  // While the keyboard is open, buttons drive it instead of Discord.
  const oskButtons = {
    [BUTTON.A]: () => osk.press(),
    [BUTTON.B]: () => osk.close(),
    [BUTTON.X]: () => osk.backspace(),
    [BUTTON.Y]: () => osk.space(),
    [BUTTON.LT]: () => osk.toggleShift(),
    [BUTTON.MENU]: () => osk.enter(),
  };

  const handle = ({ events, scroll }) => {
    if (events.length || scroll) setControllerMode(true);
    for (const ev of events) {
      if (ev.type === 'combo') {
        if (ev.buttons.includes(BUTTON.VIEW) && ev.buttons.includes(BUTTON.MENU)) {
          ipcRenderer.send('pad:toggle-fullscreen');
        } else if (ev.buttons.includes(BUTTON.VIEW) && ev.buttons.includes(BUTTON.Y)) {
          osk.close();
          overlay.toggleHelp(false);
          if (menu.visible) menu.close();
          else menu.open();
        }
      } else if (ev.type === 'move') {
        if (menu.visible) menu.move(ev.dir);
        else if (osk.visible) osk.move(ev.dir);
        else if (!overlay.helpVisible()) focus.move(ev.dir);
      } else if (ev.type === 'press') {
        if (menu.visible) {
          if (ev.button === BUTTON.A) menu.press();
          else if (ev.button === BUTTON.B) menu.close();
        } else if (osk.visible) {
          oskButtons[ev.button]?.();
        } else if (overlay.helpVisible() && ev.button !== BUTTON.VIEW && ev.button !== BUTTON.B) {
          overlay.toggleHelp(false);
        } else {
          actions[settings.mapping[ev.button]]?.();
        }
      }
    }
    if (scroll && !osk.visible && !menu.visible) scrollFrom(focus.current, scroll.y * 28, scroll.x * 28);
  };

  const loop = (now) => {
    lastPads = navigator.getGamepads ? [...navigator.getGamepads()] : [];
    if (lastPads.some(Boolean)) handle(reader.update(mergePads(lastPads), now));
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);

  addEventListener('gamepadconnected', (e) => {
    overlay.toast('Controller connected. Press View for help.');
    lastPads[e.gamepad.index] = e.gamepad;
  });

  watchCalls({
    onIncoming(incoming) {
      ipcRenderer.send('pad:incoming-call');
      overlay.toast('Incoming call: press A or left stick to answer, B to decline', { urgent: true, ms: 8000 });
      focus.active = true;
      focus.set(incoming.accept);
      if (settings.rumbleOnCall) rumble();
    },
    onCallStateChange(inCall) {
      ipcRenderer.send('pad:in-call', inCall);
      overlay.toast(inCall ? 'Connected. X mute · Y deafen · right stick click hang up' : 'Call ended');
    },
  });
}

if (document.readyState === 'loading') {
  addEventListener('DOMContentLoaded', main, { once: true });
} else {
  main();
}
