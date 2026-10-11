'use strict';

const fs = require('node:fs');
const path = require('node:path');

// Built-in "hide" presets. Discord's class names are hashed, so these match
// on aria-labels, hrefs and stable class-name fragments. If one stops
// matching after a Discord update, fix the selector here or override it in
// custom.css.
const PRESETS = Object.freeze({
  nitroUpsells: {
    label: 'Nitro and Shop upsells',
    default: true,
    css: `
      a[href="/store"], a[href="/shop"], a[href^="/shop/"],
      [class*="premiumPromo"], [class*="nitroUpsell"], [class*="upsellBanner"],
      [class*="premiumTrialOffer"], [class*="shopEntry"] { display: none !important; }`,
  },
  quests: {
    label: 'Quests link in the direct messages list',
    default: true,
    css: `
      a[href="/quest-home"], a[href^="/quest-home/"], a[href^="/discovery/quests"],
      [data-list-item-id$="___quests"] { display: none !important; }`,
  },
  downloadApps: {
    label: '"Download Apps" button in the server list',
    default: true,
    css: `
      [aria-label="Download Apps"],
      [data-list-item-id="guildsnav___app-download-button"] { display: none !important; }`,
  },
  giftButton: {
    label: 'Gift button in the message box',
    default: true,
    css: 'button[aria-label="Send a gift"] { display: none !important; }',
  },
  helpButton: {
    label: 'Help (?) button in the header',
    default: true,
    css: 'a[href*="support.discord.com"] { display: none !important; }',
  },
  stickerGifButtons: {
    label: 'Sticker, GIF and Apps buttons in the message box',
    default: false,
    css: `
      button[aria-label="Open sticker picker"], button[aria-label="Open GIF picker"],
      button[aria-label="Apps"] { display: none !important; }`,
  },
  memberList: {
    label: 'Member list on the right of servers',
    default: false,
    css: '[aria-label^="Members"][role="list"], [class*="membersWrap"] { display: none !important; }',
  },
  activityFeed: {
    label: '"Active Now" panel on the Friends page',
    default: false,
    css: '[class*="nowPlayingColumn"] { display: none !important; }',
  },
});

const CUSTOM_CSS_FILE = 'custom.css';

const CUSTOM_CSS_TEMPLATE = `/*
 * Discord Pad custom CSS. Loaded after the built-in presets and re-applied
 * as soon as you save this file. Discord's class names are hashed, so match
 * on fragments: [class*="name"], or on aria-labels: [aria-label="..."].
 *
 * Example: hide the server banner image
 * [class*="bannerImage"] { display: none !important; }
 */
`;

function defaultHide() {
  return Object.fromEntries(Object.entries(PRESETS).map(([id, p]) => [id, p.default]));
}

// The CSS for the enabled presets followed by the user's custom CSS.
function buildCss(hide, customCss = '') {
  const parts = Object.entries(PRESETS)
    .filter(([id]) => hide[id])
    .map(([id, p]) => `/* ${id} */${p.css}`);
  if (customCss.trim()) parts.push(`/* custom.css */\n${customCss}`);
  return parts.join('\n');
}

function customCssPath(userDataDir) {
  return path.join(userDataDir, CUSTOM_CSS_FILE);
}

// Read custom.css, creating it with instructions the first time.
function readCustomCss(userDataDir) {
  const file = customCssPath(userDataDir);
  try {
    return fs.readFileSync(file, 'utf8');
  } catch (err) {
    if (err.code === 'ENOENT') {
      try {
        fs.mkdirSync(userDataDir, { recursive: true });
        fs.writeFileSync(file, CUSTOM_CSS_TEMPLATE);
      } catch {
        // read-only profile; run without custom CSS
      }
    }
    return '';
  }
}

// Keeps the override stylesheet applied to a webContents: re-inserted on
// every page load and whenever custom.css changes.
class CssOverrides {
  constructor(webContents, { userDataDir, getHide }) {
    this.wc = webContents;
    this.userDataDir = userDataDir;
    this.getHide = getHide;
    this.key = null;
    this.watcher = null;
    this.debounce = null;
  }

  start() {
    this.wc.on('did-finish-load', () => {
      // A full load drops inserted CSS.
      this.key = null;
      this.apply();
    });
    this.watch();
  }

  async apply() {
    const css = buildCss(this.getHide(), readCustomCss(this.userDataDir));
    const previous = this.key;
    this.key = null;
    try {
      if (previous) await this.wc.removeInsertedCSS(previous);
      if (css) this.key = await this.wc.insertCSS(css, { cssOrigin: 'user' });
    } catch (err) {
      console.warn(`Could not apply CSS overrides: ${err.message}`);
    }
  }

  watch() {
    readCustomCss(this.userDataDir); // make sure the file exists to watch
    try {
      this.watcher = fs.watch(customCssPath(this.userDataDir), () => {
        clearTimeout(this.debounce);
        this.debounce = setTimeout(() => this.apply(), 200);
      });
    } catch {
      // no file to watch; changes apply on next launch
    }
  }

  stop() {
    this.watcher?.close();
    clearTimeout(this.debounce);
  }
}

module.exports = {
  PRESETS, CUSTOM_CSS_TEMPLATE, defaultHide, buildCss, readCustomCss, customCssPath, CssOverrides,
};
