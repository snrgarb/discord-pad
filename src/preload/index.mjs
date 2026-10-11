import { ipcRenderer } from 'electron';
import { GamepadReader, mergePads, BUTTON } from './gamepad.mjs';
import { createOverlay } from './overlay.mjs';
import {
  FocusManager, activate, scrollFrom,
} from './focus.mjs';
import { OnScreenKeyboard } from './osk.mjs';
import {
  watchCalls, findIncomingCall, findDisconnect, isMuted, isDeafened,
} from './calls.mjs';
import { TEXT_INPUT, VOICE_CHANNEL_LABEL } from './selectors.mjs';

const BUTTON_NAMES = {
  0: 'A', 1: 'B', 2: 'X', 3: 'Y', 4: 'LB', 5: 'RB', 6: 'LT', 7: 'RT',
  8: 'View', 9: 'Menu', 10: 'Left stick click', 11: 'Right stick click',
};
const ACTION_NAMES = {
  activate: 'Select (opens keyboard on text boxes)',
  back: 'Back / close',
  toggleMute: 'Mute / unmute',
  toggleDeafen: 'Deafen / undeafen',
  prevServer: 'Previous server',
  nextServer: 'Next server',
  prevChannel: 'Previous channel',
  nextChannel: 'Next channel',
  answerCall: 'Answer call / join focused voice channel',
  hangUp: 'Hang up / leave voice',
  quickSwitcher: 'Jump to server, channel or DM',
  toggleHelp: 'Show this help',
};

const chord = (name) => ipcRenderer.send('pad:chord', name);
const typeText = (text) => ipcRenderer.send('pad:text', text);

async function main() {
  const settings = await ipcRenderer.invoke('pad:get-settings');
  if (!settings) return;

  const overlay = createOverlay();
  const focus = new FocusManager(overlay);
  const osk = new OnScreenKeyboard(overlay.osk, {
    typeText,
    sendChord: chord,
    onClose: () => focus.ensure(),
  });
  const reader = new GamepadReader({ deadzone: settings.stickDeadzone });

  overlay.setHelp([
    ['D-pad / left stick', 'Move'],
    ['Right stick', 'Scroll'],
    ...Object.entries(settings.mapping)
      .filter(([, action]) => action !== 'none')
      .map(([btn, action]) => [BUTTON_NAMES[btn] || `Button ${btn}`, ACTION_NAMES[action] || action]),
  ]);

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
      if (el.matches(TEXT_INPUT)) {
        el.focus();
        osk.open(el);
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
        }
      } else if (ev.type === 'move') {
        if (osk.visible) osk.move(ev.dir);
        else if (!overlay.helpVisible()) focus.move(ev.dir);
      } else if (ev.type === 'press') {
        if (osk.visible) {
          oskButtons[ev.button]?.();
        } else if (overlay.helpVisible() && ev.button !== BUTTON.VIEW && ev.button !== BUTTON.B) {
          overlay.toggleHelp(false);
        } else {
          actions[settings.mapping[ev.button]]?.();
        }
      }
    }
    if (scroll && !osk.visible) scrollFrom(focus.current, scroll.y * 28, scroll.x * 28);
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
