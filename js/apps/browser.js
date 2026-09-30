// Web Browser: surf the web of the nineties.
//
// The web it reaches is ANACHRON's own (see web-pages.js): a few
// sites that never existed, always there, no connection needed.
// Real addresses get the classic "page cannot be displayed".
//
// - Type an address and press Enter, or a few words to search Seekr.
// - Back, Forward, Stop, Refresh and Home, like the real thing.
//   Alt+Left and Alt+Right go back and forward, F5 refreshes.
// - Favorites lists every site.
// - Pointing at a link shows where it goes, down in the status bar.

import { setUpMenuBar } from '../shell/menus.js';
import { HOME_PAGE, FAVORITES, findPage, notFoundPage, normalizeAddress } from './web-pages.js';

// Pages the dial-up modem has already fetched this session show up
// in purple, like visited links always did
const visited = new Set();

const TOOLBAR = [
  { action: 'back', label: 'Back', icon: '<path d="M10 3L5 8l5 5" fill="none" stroke="#000" stroke-width="2"/>' },
  { action: 'forward', label: 'Forward', icon: '<path d="M6 3l5 5-5 5" fill="none" stroke="#000" stroke-width="2"/>' },
  { action: 'stop', label: 'Stop', icon: '<path d="M4 4l8 8M12 4l-8 8" stroke="#c00000" stroke-width="2"/>' },
  { action: 'refresh', label: 'Refresh', icon: '<path d="M12 5.5A4.5 4.5 0 1 0 12.5 9" fill="none" stroke="#000" stroke-width="1.5"/><path d="M9.5 2.5h4v4z" fill="#000"/>' },
  { action: 'home', label: 'Home', icon: '<path d="M2 8l6-5 6 5" fill="none" stroke="#000" stroke-width="1.5"/><path d="M4 7.5v6h3v-3h2v3h3v-6" fill="#c0a060" stroke="#000"/>' },
];

// context comes from the desktop:
//   setTitle - changes the window's title
//   onClose  - runs something when the window closes
export function createApp(context) {
  const root = document.createElement('div');
  root.className = 'browser';
  // Lets the window receive key presses (F5, Alt+arrows)
  root.tabIndex = -1;

  root.innerHTML = `
    <div class="menu-bar">
      <div class="menu">
        <button class="menu-title"><u>G</u>o</button>
        <div class="menu-items">
          <button data-command="back"><u>B</u>ack</button>
          <button data-command="forward"><u>F</u>orward</button>
          <div class="menu-separator"></div>
          <button data-command="home"><u>H</u>ome Page</button>
          <button data-command="refresh"><u>R</u>efresh</button>
        </div>
      </div>
      <div class="menu">
        <button class="menu-title">F<u>a</u>vorites</button>
        <div class="menu-items">
          ${FAVORITES.map((fav) => `<button data-command="go:${fav.url}">${fav.title}</button>`).join('')}
        </div>
      </div>
    </div>

    <div class="browser-toolbar">
      ${TOOLBAR.map((tool) => `
        <button class="browser-button" data-action="${tool.action}" title="${tool.label}">
          <svg viewBox="0 0 16 16" shape-rendering="crispEdges">${tool.icon}</svg>
          <span>${tool.label}</span>
        </button>`).join('')}
      <div class="browser-logo" title="Web Browser"><span></span></div>
    </div>

    <form class="browser-address-row">
      <span class="browser-address-label">Address</span>
      <input class="browser-address sunken-panel" spellcheck="false" autocomplete="off" aria-label="Address">
      <button class="push-button browser-go" type="submit">Go</button>
    </form>

    <div class="browser-page sunken-panel"></div>

    <div class="status-bar browser-status">
      <span class="status-field" data-status="text"></span>
      <span class="status-field browser-zone">Internet zone</span>
    </div>
  `;

  const browser = {
    root,
    page: root.querySelector('.browser-page'),
    address: root.querySelector('.browser-address'),
    setTitle: context.setTitle,
    // Every address visited in this window, and where we are in it
    history: [],
    index: -1,
    // The page being fetched (a timer), or null when nothing is loading
    loading: null,
    current: null,
    go: (url) => navigate(browser, url),
  };

  const button = (action) => root.querySelector(`[data-action="${action}"]`);
  button('back').addEventListener('click', () => goBack(browser));
  button('forward').addEventListener('click', () => goForward(browser));
  button('stop').addEventListener('click', () => stop(browser));
  button('refresh').addEventListener('click', () => refresh(browser));
  button('home').addEventListener('click', () => navigate(browser, HOME_PAGE));

  setUpMenuBar(root.querySelector('.menu-bar'), (command) => {
    if (command === 'back') goBack(browser);
    if (command === 'forward') goForward(browser);
    if (command === 'home') navigate(browser, HOME_PAGE);
    if (command === 'refresh') refresh(browser);
    if (command.startsWith('go:')) navigate(browser, command.slice('go:'.length));
  });

  // Typing an address (or words to search for) and pressing Enter
  root.querySelector('.browser-address-row').addEventListener('submit', (event) => {
    event.preventDefault();
    navigate(browser, normalizeAddress(browser.address.value));
    // Like a real browser, the keyboard moves on to the page, so the
    // next click in the address box selects it all again
    root.focus({ preventScroll: true });
  });
  // Clicking in the address box selects it all, ready to type over
  browser.address.addEventListener('focus', () => browser.address.select());

  setUpLinks(browser);

  root.addEventListener('keydown', (event) => {
    // F5 would reload all of ANACHRON (and lose unsaved work):
    // here it only refreshes the page in this window
    if (event.key === 'F5') {
      event.preventDefault();
      refresh(browser);
    }
    if (event.altKey && event.key === 'ArrowLeft') {
      event.preventDefault();
      goBack(browser);
    }
    if (event.altKey && event.key === 'ArrowRight') {
      event.preventDefault();
      goForward(browser);
    }
    if (event.key === 'Escape' && browser.loading) stop(browser);
  });

  context.onClose(() => clearTimeout(browser.loading));

  navigate(browser, HOME_PAGE);
  return root;
}

// ---------- Going places ----------

// Opens an address, after a moment, like a modem fetching it.
// record: false when moving through the history (Back, Forward,
// Refresh), which mustn't add to it.
function navigate(browser, url, { record = true } = {}) {
  stopLoading(browser);

  if (record) {
    browser.history = browser.history.slice(0, browser.index + 1);
    browser.history.push(url);
    browser.index = browser.history.length - 1;
  }

  browser.address.value = url;
  setStatus(browser, `Opening page ${url}...`);
  browser.root.classList.add('is-loading');

  // Pages take a moment to arrive over the phone line
  browser.loading = setTimeout(() => show(browser, url), 250 + Math.random() * 450);
  updateButtons(browser);
}

function show(browser, url) {
  browser.loading = null;
  browser.root.classList.remove('is-loading');

  const page = findPage(url) ?? notFoundPage(url);
  browser.page.innerHTML = page.render(url);
  browser.page.scrollTop = 0;
  page.setUp?.(browser.page, browser);

  browser.current = url;
  visited.add(url);
  markVisitedLinks(browser);

  browser.setTitle(`${page.title} - Web Browser`);
  setStatus(browser, 'Done');
  updateButtons(browser);
}

function goBack(browser) {
  if (browser.index <= 0) return;
  browser.index--;
  navigate(browser, browser.history[browser.index], { record: false });
}

function goForward(browser) {
  if (browser.index >= browser.history.length - 1) return;
  browser.index++;
  navigate(browser, browser.history[browser.index], { record: false });
}

function refresh(browser) {
  const url = browser.history[browser.index];
  if (url) navigate(browser, url, { record: false });
}

// Stop: the page that was showing stays, and its address comes back
function stop(browser) {
  if (!browser.loading) return;
  stopLoading(browser);
  if (browser.current) browser.address.value = browser.current;
  setStatus(browser, 'Stopped');
  updateButtons(browser);
}

function stopLoading(browser) {
  clearTimeout(browser.loading);
  browser.loading = null;
  browser.root.classList.remove('is-loading');
}

// ---------- Links ----------

function setUpLinks(browser) {
  const { page } = browser;

  page.addEventListener('click', (event) => {
    const anchor = event.target.closest('a');
    if (!anchor) return;
    event.preventDefault();
    if (anchor.dataset.go) navigate(browser, anchor.dataset.go);
  });

  // Pointing at a link shows where it goes
  page.addEventListener('mouseover', (event) => {
    const anchor = event.target.closest('a[data-go]');
    if (anchor) setStatus(browser, anchor.dataset.go);
  });
  page.addEventListener('mouseout', (event) => {
    if (event.target.closest('a[data-go]') && !browser.loading) setStatus(browser, 'Done');
  });
}

function markVisitedLinks(browser) {
  for (const anchor of browser.page.querySelectorAll('a[data-go]')) {
    anchor.classList.toggle('is-visited', visited.has(anchor.dataset.go));
  }
}

// ---------- The toolbar and status bar ----------

// Back and Forward only work when there's somewhere to go;
// Stop only while a page is loading
function updateButtons(browser) {
  const { root } = browser;
  const canBack = browser.index > 0;
  const canForward = browser.index < browser.history.length - 1;
  const enable = (action, on) => {
    const button = root.querySelector(`[data-action="${action}"]`);
    // A button that greys out while it has the keyboard would drop it
    // (then Alt+arrows and F5 stop working), so hand it to the window
    if (!on && document.activeElement === button) root.focus({ preventScroll: true });
    button.disabled = !on;
  };
  enable('back', canBack);
  enable('forward', canForward);
  enable('stop', Boolean(browser.loading));
  root.querySelector('[data-command="back"]').disabled = !canBack;
  root.querySelector('[data-command="forward"]').disabled = !canForward;
}

function setStatus(browser, text) {
  browser.root.querySelector('[data-status="text"]').textContent = text;
}
