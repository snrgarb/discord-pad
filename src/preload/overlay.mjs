// All UI we draw lives in one shadow root so Discord's CSS can't reach it
// and ours can't break Discord.

const CSS = `
:host { all: initial; }
.ring {
  position: fixed; pointer-events: none; z-index: 2147483646;
  border: 3px solid #00e5ff; border-radius: 8px;
  box-shadow: 0 0 0 3px rgba(0,0,0,.6), 0 0 18px rgba(0,229,255,.7);
  transition: left .08s ease-out, top .08s ease-out, width .08s ease-out, height .08s ease-out;
  display: none;
}
.toast {
  position: fixed; left: 50%; bottom: 48px; transform: translateX(-50%);
  background: rgba(17,18,20,.95); color: #fff; padding: 14px 24px; border-radius: 12px;
  font: 600 22px/1.3 "gg sans", "Segoe UI", sans-serif; pointer-events: none;
  z-index: 2147483647; box-shadow: 0 8px 24px rgba(0,0,0,.5); opacity: 0;
  transition: opacity .15s;
}
.toast.show { opacity: 1; }
.toast.urgent { background: #248046; }
.panel {
  position: fixed; inset: 0; display: none; align-items: center; justify-content: center;
  background: rgba(0,0,0,.6); z-index: 2147483647; pointer-events: none;
  font: 500 20px/1.4 "gg sans", "Segoe UI", sans-serif; color: #f2f3f5;
}
.panel.show { display: flex; }
.help { background: #2b2d31; border-radius: 16px; padding: 28px 36px; min-width: 520px; }
.help h2 { margin: 0 0 16px; font-size: 26px; }
.help table { border-collapse: collapse; width: 100%; }
.help td { padding: 6px 12px; border-bottom: 1px solid #3f4147; }
.help td:first-child { color: #00e5ff; font-weight: 700; white-space: nowrap; }
.help p { margin: 16px 0 0; color: #b5bac1; font-size: 16px; }
.settings {
  position: fixed; inset: 0; display: none; align-items: center; justify-content: center;
  background: rgba(0,0,0,.65); z-index: 2147483647; pointer-events: auto;
  font: 500 20px/1.4 "gg sans", "Segoe UI", sans-serif; color: #f2f3f5;
}
.settings.show { display: flex; }
.settings .sheet { background: #2b2d31; border-radius: 16px; padding: 24px 32px; width: min(900px, 92vw); max-height: 86vh; display: flex; flex-direction: column; }
.settings h2 { margin: 0 0 12px; font-size: 28px; }
.settings h3 { margin: 18px 0 6px; font-size: 15px; text-transform: uppercase; letter-spacing: .06em; color: #b5bac1; }
.settings hr { border: 0; border-top: 1px solid #3f4147; margin: 14px 0; }
.settings .rows { overflow-y: auto; padding-right: 8px; }
.settings .row { display: flex; justify-content: space-between; gap: 24px; padding: 10px 14px; border-radius: 10px; }
.settings .row.sel { background: #00e5ff; color: #111; }
.settings .val { font-weight: 700; white-space: nowrap; }
.settings .hint { color: #949ba4; font-size: 15px; margin-top: 12px; text-align: center; }
.osk {
  position: fixed; left: 50%; bottom: 24px; transform: translateX(-50%);
  width: min(1100px, 96vw); background: #1e1f22; border-radius: 16px; padding: 14px;
  box-shadow: 0 12px 40px rgba(0,0,0,.6); z-index: 2147483647; display: none;
  font: 600 22px/1 "gg sans", "Segoe UI", sans-serif; pointer-events: auto;
  user-select: none;
}
.osk.show { display: block; }
.osk .row { display: flex; gap: 8px; margin-bottom: 8px; }
.osk .row:last-child { margin-bottom: 0; }
.osk .key {
  flex: 1 1 0; height: 56px; display: flex; align-items: center; justify-content: center;
  background: #383a40; color: #f2f3f5; border-radius: 10px; cursor: pointer;
}
.osk .key.sel { background: #00e5ff; color: #111; transform: scale(1.06); }
.osk .key.on { box-shadow: inset 0 -4px 0 #00e5ff; }
.osk .hint { color: #949ba4; font-size: 15px; margin-top: 10px; text-align: center; font-weight: 500; }
`;

export function createOverlay() {
  const host = document.createElement('discord-pad-overlay');
  host.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:2147483647;';
  const root = host.attachShadow({ mode: 'closed' });
  root.innerHTML = `<style>${CSS}</style>
    <div class="ring"></div>
    <div class="toast"></div>
    <div class="panel"><div class="help"></div></div>
    <div class="osk"></div>
    <div class="settings"></div>`;
  const mount = () => {
    if (!host.isConnected) document.documentElement.appendChild(host);
  };
  mount();
  // Re-attach if something replaces the document element's children.
  new MutationObserver(mount).observe(document.documentElement, { childList: true });

  const ring = root.querySelector('.ring');
  const toast = root.querySelector('.toast');
  const panel = root.querySelector('.panel');
  const help = root.querySelector('.help');
  const osk = root.querySelector('.osk');
  const settings = root.querySelector('.settings');
  let toastTimer = null;

  return {
    osk,
    settings,
    showRing(rect) {
      if (!rect) {
        ring.style.display = 'none';
        return;
      }
      const pad = 4;
      Object.assign(ring.style, {
        display: 'block',
        left: `${rect.left - pad}px`,
        top: `${rect.top - pad}px`,
        width: `${rect.width + pad * 2}px`,
        height: `${rect.height + pad * 2}px`,
      });
    },
    toast(text, { urgent = false, ms = 2200 } = {}) {
      toast.textContent = text;
      toast.classList.toggle('urgent', urgent);
      toast.classList.add('show');
      clearTimeout(toastTimer);
      toastTimer = setTimeout(() => toast.classList.remove('show'), ms);
    },
    setHelp(rows) {
      help.innerHTML = '<h2>Controller</h2><table></table><p>Press View again to close. View + Y opens settings. F11 or View + Menu toggles full screen.</p>';
      const table = help.querySelector('table');
      for (const [button, action] of rows) {
        const tr = document.createElement('tr');
        const a = document.createElement('td');
        const b = document.createElement('td');
        a.textContent = button;
        b.textContent = action;
        tr.append(a, b);
        table.append(tr);
      }
    },
    toggleHelp(force) {
      return panel.classList.toggle('show', force);
    },
    helpVisible() {
      return panel.classList.contains('show');
    },
  };
}
