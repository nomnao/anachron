// Bits shared by the pages of Web Browser's web (web-pages.js and
// the sites in this folder).

export const HOME_PAGE = 'http://home.anachron.web/';

// Where the Seekr search engine lives
export const SEEKR = 'http://www.seekr.web/';

// Text people typed goes in as text, never as HTML
export function escapeHtml(text) {
  return String(text).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[c]);
}

// A link Web Browser follows: <a data-go="address">
export const link = (url, text) => `<a href="#" data-go="${url}">${text}</a>`;

// The striped "Under Construction" sign every homepage had
export const UNDER_CONSTRUCTION = `
  <div class="web-construction"><span>UNDER CONSTRUCTION</span></div>`;

export const BEST_VIEWED = `
  <p class="web-small">Best viewed with Web Browser at 640 x 480 in 256 colors.</p>`;

// Today's date, the way the pages of the time wrote it
export function longDate(date = new Date()) {
  return date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
}

// The parts of a web address
export function splitAddress(url) {
  try {
    const parsed = new URL(url);
    return {
      host: parsed.hostname.toLowerCase(),
      path: parsed.pathname === '' ? '/' : parsed.pathname,
      query: parsed.searchParams,
    };
  } catch {
    return { host: '', path: '/', query: new URLSearchParams() };
  }
}

// Reads and writes something a site remembers. localStorage can be
// missing or blocked (e.g. private browsing); then the site still
// works, it just forgets when the page closes.
export function loadStored(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key)) ?? fallback;
  } catch {
    return fallback;
  }
}

export function saveStored(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Not kept, but it works until the page closes
  }
}
