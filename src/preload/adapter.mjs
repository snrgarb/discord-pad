// Couch UI adapter: finds Discord's real regions and rows and marks them
// with data-dp-* attributes that couch.css styles. Discord's class names are
// hashed, so this works from roles, aria-labels, hrefs and geometry. It only
// adds/removes its own attributes; it never moves or creates Discord nodes.

import { classifyListItem, looksLikeSidebar, outermostSameColumn } from './adapter-rules.mjs';
import { SERVER_COLUMN, CHANNEL_COLUMN, SELECTED } from './selectors.mjs';

const ATTRS = ['data-dp-region', 'data-dp-role', 'data-dp-selected', 'data-dp-focus'];
const MESSAGE = 'li[id^="chat-messages-"]';
const COMPOSER = '[role="textbox"][data-slate-editor="true"], form [role="textbox"]';

function visible(el) {
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0;
}

function mark(el, attr, value) {
  if (el && el.getAttribute(attr) !== value) el.setAttribute(attr, value);
}

function clearAll() {
  for (const attr of ATTRS) {
    for (const el of document.querySelectorAll(`[${attr}]`)) el.removeAttribute(attr);
  }
  document.documentElement.removeAttribute('data-dp-root');
  document.documentElement.removeAttribute('data-dp-mode');
}

function findRegions() {
  const servers = [...document.querySelectorAll(SERVER_COLUMN)].find(visible);
  if (!servers) return null;
  const serversRight = servers.getBoundingClientRect().right;

  const inner = [...document.querySelectorAll(CHANNEL_COLUMN)]
    .filter((el) => visible(el) && el.matches('nav, [data-list-id]'))[0];
  let sidebar = null;
  if (inner) {
    const chain = [];
    for (let el = inner; el && el !== document.body; el = el.parentElement) chain.push(el);
    const top = chain[outermostSameColumn(chain.map((el) => el.getBoundingClientRect()))];
    if (looksLikeSidebar(top.getBoundingClientRect(), { serversRight, viewportHeight: innerHeight })) {
      sidebar = top;
    }
  }

  // Main is the widest sibling to the right of the sidebar.
  let main = null;
  if (sidebar?.parentElement) {
    const right = sidebar.getBoundingClientRect().right;
    main = [...sidebar.parentElement.children]
      .filter((el) => el !== sidebar && el.getBoundingClientRect().left >= right - 2 && visible(el))
      .sort((a, b) => b.getBoundingClientRect().width - a.getBoundingClientRect().width)[0] || null;
  }
  return { servers, sidebar, main };
}

function markRows(regions) {
  const { servers, sidebar, main } = regions;
  for (const el of servers.querySelectorAll('[role="treeitem"]')) mark(el, 'data-dp-role', 'server');

  if (sidebar) {
    for (const el of sidebar.querySelectorAll('a[href], [role="link"], [role="treeitem"] > div[aria-label]')) {
      const role = classifyListItem({
        href: el.getAttribute('href') || '',
        label: el.getAttribute('aria-label') || '',
      });
      if (!role) continue;
      mark(el, 'data-dp-role', role);
      const selected = el.matches(SELECTED) || Boolean(el.closest(SELECTED))
        || el.getAttribute('href') === location.pathname;
      if (selected) mark(el, 'data-dp-selected', 'true');
      else el.removeAttribute('data-dp-selected');
    }
  }

  const scope = main || document;
  for (const el of scope.querySelectorAll(MESSAGE)) mark(el, 'data-dp-role', 'message');
  const composer = [...scope.querySelectorAll(COMPOSER)].find(visible);
  if (composer) mark(composer.closest('form') || composer, 'data-dp-role', 'composer');
}

export class CouchAdapter {
  constructor() {
    this.enabled = false;
    this.focused = null;
    this.pending = false;
    this.observer = new MutationObserver(() => this.schedule());
  }

  setEnabled(on) {
    if (on === this.enabled) return;
    this.enabled = on;
    if (on) {
      this.observer.observe(document.body, { childList: true, subtree: true });
      addEventListener('popstate', this.onNav);
      this.run();
    } else {
      this.observer.disconnect();
      clearAll();
    }
  }

  onNav = () => this.schedule();

  // Discord re-renders constantly; batch work to at most once per frame-ish.
  schedule() {
    if (this.pending || !this.enabled) return;
    this.pending = true;
    setTimeout(() => {
      this.pending = false;
      this.run();
    }, 150);
  }

  run() {
    if (!this.enabled) return;
    const root = document.documentElement;
    mark(root, 'data-dp-root', 'true');
    mark(root, 'data-dp-mode', 'couch');
    const regions = findRegions();
    if (!regions) return;
    mark(regions.servers, 'data-dp-region', 'servers');
    if (regions.sidebar) mark(regions.sidebar, 'data-dp-region', 'channels');
    if (regions.main) mark(regions.main, 'data-dp-region', 'main');
    markRows(regions);
  }

  setFocus(el) {
    if (this.focused && this.focused !== el) this.focused.removeAttribute('data-dp-focus');
    this.focused = el;
    if (this.enabled && el) mark(el, 'data-dp-focus', 'true');
  }
}
