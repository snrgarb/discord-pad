'use strict';

// End-to-end smoke test: drives the real preload with a fake gamepad against
// a local page shaped like Discord. Run with `npm run smoke`.

const ISOLATED_WORLD = 999; // Electron's context-isolation world (where the preload runs)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const FAKE_PAD = `
  (() => {
    const state = { buttons: Array(17).fill(false), axes: [0, 0, 0, 0] };
    window.__pad = state;
    navigator.getGamepads = () => [{
      id: 'fake', index: 0, connected: true, mapping: 'standard', timestamp: performance.now(),
      axes: state.axes.slice(),
      buttons: state.buttons.map((p) => ({ pressed: p, touched: p, value: p ? 1 : 0 })),
    }];
  })();
`;

async function run(win, app) {
  const wc = win.webContents;
  const failures = [];
  const check = (name, ok, detail = '') => {
    console.log(`${ok ? 'ok' : 'FAIL'} - ${name}${ok ? '' : ` ${detail}`}`);
    if (!ok) failures.push(name);
  };
  const page = (code) => wc.executeJavaScript(code);
  const iso = (code) => wc.executeJavaScriptInIsolatedWorld(ISOLATED_WORLD, [{ code }]);
  const press = async (button) => {
    await iso(`window.__pad.buttons[${button}] = true`);
    await sleep(80);
    await iso(`window.__pad.buttons[${button}] = false`);
    await sleep(120);
  };
  const focused = () => page('document.activeElement && (document.activeElement.getAttribute("aria-label") || document.activeElement.textContent)');
  const events = () => page('window.events.slice()');

  try {
    await new Promise((resolve) => wc.once('did-finish-load', resolve));
    await sleep(800);
    await iso(FAKE_PAD);

    // First D-pad press shows the ring on the element nearest the center.
    await press(15); // right
    const start = await focused();
    check('first move picks an element', Boolean(start), String(start));

    // Walk to the servers column, then to the channel list.
    for (let i = 0; i < 4; i += 1) await press(14); // left
    check('left reaches the server list', /Server/.test(await focused()), await focused());
    await press(15); // right
    const channel = await focused();
    check('right from servers lands in channels', /channel/.test(channel), channel);

    // Select a voice channel with A, then hang up with the right stick click.
    while (!/voice channel/.test(await focused())) await press(13); // down
    await press(0);
    await sleep(900); // call watcher polls
    check('A joins the voice channel', (await events()).includes('join:lounge'));
    await press(11);
    check('right stick click hangs up', (await events()).includes('disconnect'));

    // X toggles mute through a trusted Ctrl+Shift+M.
    await press(2);
    check('X toggles mute via trusted key chord',
      await page('document.querySelector("[aria-label=Mute]").getAttribute("aria-checked")') === 'true',
      JSON.stringify(await events()));

    // A on the message box opens the on-screen keyboard; A types the selected key.
    await page('document.getElementById("input").focus()');
    await iso('void 0');
    await press(15); // ensure() adopts the focused input
    await page('document.getElementById("input").focus()');
    // Move focus manager onto the input via the D-pad from wherever it is.
    for (let i = 0; i < 6 && !/Message/.test(await focused()); i += 1) await press(13);
    check('can reach the message box', /Message/.test(await focused()), await focused());
    await press(0); // open keyboard (cursor starts on "q")
    await press(0); // type q
    await press(3); // Y = space
    await press(15); // move to "w"
    await press(0);
    const text = await page('document.getElementById("input").textContent');
    check('on-screen keyboard types into Discord input', text === 'q w', JSON.stringify(text));
    await press(2); // X = backspace
    check('X deletes in keyboard mode', await page('document.getElementById("input").textContent') === 'q ');
    await press(1); // B closes keyboard

    // Menu opens the quick switcher; navigation stays inside the dialog.
    await press(9);
    await sleep(100);
    check('Menu opens quick switcher', await page('Boolean(document.getElementById("switcher"))'));
    await press(13);
    await press(13);
    check('focus is scoped to the open dialog',
      await page('document.getElementById("switcher").contains(document.activeElement)'), await focused());
    await press(1);
    check('B closes the dialog', await page('!document.getElementById("switcher")'));

    // Incoming call: focus jumps to Accept; left stick click answers.
    await page('ring()');
    await sleep(1000);
    check('incoming call focuses Accept', /Join Call/.test(await focused()), await focused());
    await press(10);
    check('left stick click answers the call', (await events()).includes('accept'));
  } catch (err) {
    console.error(err);
    failures.push('exception');
  }

  console.log(failures.length ? `\n${failures.length} smoke check(s) failed` : '\nall smoke checks passed');
  app.exit(failures.length ? 1 : 0);
}

module.exports = { run };
