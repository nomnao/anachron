// The web that Web Browser can reach: sites from the nineties that
// never were. Every address ends in .web, so none of them can be
// mistaken for a real site. The first few are here; the bigger ones
// (a shop, an encyclopedia, a chat room, games, homepages and web
// mail) each have their own file in the web folder.
//
// Each page is { title, keywords, render(url), setUp?(root, browser) }.
// render gives back the page's HTML. Links are <a data-go="address">;
// Web Browser follows them. setUp adds anything the page does by
// itself, like signing the guestbook. If the page keeps doing things
// (like the chat room's chatter), setUp gives back a function that
// stops it, which Web Browser calls when the page is left.

import {
  HOME_PAGE, SEEKR, escapeHtml, link, UNDER_CONSTRUCTION, BEST_VIEWED, longDate, splitAddress,
} from './web/common.js';
import { SITE as SHOP } from './web/shop.js';
import { SITE as ENCYCLOPEDIA } from './web/encyclopedia.js';
import { SITE as CHAT } from './web/chat.js';
import { SITE as ARCADE } from './web/arcade.js';
import { SITE as VILLAGE } from './web/geovillage.js';
import { SITE as MAIL } from './web/mail.js';

export { HOME_PAGE };

// The pages in the Favorites menu, in order
export const FAVORITES = [
  { title: 'ANACHRON Home', url: HOME_PAGE },
  { title: 'Seekr Search', url: SEEKR },
  { title: "Coo's Fan Club", url: 'http://www.coo-fan-club.web/' },
  { title: 'Dial-Up Daily', url: 'http://www.dialup-daily.web/' },
  { title: 'Pixel Weather', url: 'http://www.pixel-weather.web/' },
  { title: 'Webopedia', url: 'http://www.webopedia.web/' },
  { title: 'Mega Mall Online', url: 'http://www.megamall.web/' },
  { title: 'HotPost Mail', url: 'http://www.hotpost.web/' },
  { title: 'Cyber Cafe Chat', url: 'http://www.cybercafe.web/' },
  { title: 'Arcade Online', url: 'http://www.arcade-online.web/' },
  { title: 'GeoVillage', url: 'http://www.geovillage.web/' },
  { title: 'The Retro Webring', url: 'http://www.retro-ring.web/' },
];

const GUESTBOOK_KEY = 'anachron.guestbook';
const COUNTER_KEY = 'anachron.fan-club-visits';

// ---------- Finding a page ----------

// The page at a web address, or null if there is none.
// url is already tidied up by normalizeAddress.
export function findPage(url) {
  const { host, path, query } = splitAddress(url);
  const site = SITES[host];
  if (!site) return null;
  const page = site[path] ?? null;
  return page && { ...page, query };
}

// Turns what was typed in the address bar into a web address:
//   "seekr.web"         -> "http://www.seekr.web/"
//   "coo-fan-club.web"  -> "http://www.coo-fan-club.web/"
//   "pigeons"           -> a Seekr search for "pigeons"
//   "google.com"        -> "http://google.com/" (which can't be reached)
export function normalizeAddress(typed) {
  let text = typed.trim();
  if (!text) return HOME_PAGE;

  // Words (no dots, or spaces in it) are a search
  if (/\s/.test(text) || !text.includes('.')) {
    return `${SEEKR}search?q=${encodeURIComponent(text)}`;
  }

  if (!/^[a-z]+:\/\//i.test(text)) text = `http://${text}`;
  let url;
  try {
    url = new URL(text);
  } catch {
    return `${SEEKR}search?q=${encodeURIComponent(typed.trim())}`;
  }

  // "seekr.web" means "www.seekr.web", as long as that's a site here
  let host = url.hostname.toLowerCase();
  if (!SITES[host] && SITES[`www.${host}`]) host = `www.${host}`;
  return `http://${host}${url.pathname}${url.search}`;
}


// ---------- The sites ----------

const home = {
  title: 'ANACHRON Home',
  keywords: 'anachron home welcome start internet information superhighway surf web',
  render: () => `
    <div class="web-page web-home">
      <h1 class="web-banner">Welcome to the Information Superhighway!</h1>
      <p class="web-center"><b>${longDate()}</b></p>
      <p>You are connected to the World Wide Web, through ANACHRON's built-in modem.
         Pick a place to visit, or type an address in the box at the top.</p>
      <table class="web-table">
        <tr><th colspan="2">Cool Sites</th></tr>
        <tr><td>${link(SEEKR, 'Seekr Search')}</td><td>Find anything on the web. Well, almost.</td></tr>
        <tr><td>${link('http://www.dialup-daily.web/', 'Dial-Up Daily')}</td><td>The news, updated every morning (by hand).</td></tr>
        <tr><td>${link('http://www.pixel-weather.web/', 'Pixel Weather')}</td><td>Will it rain? Find out, one pixel at a time.</td></tr>
        <tr><td>${link('http://www.webopedia.web/', 'Webopedia')}</td><td>The encyclopedia of the web. Look things up!</td></tr>
        <tr><td>${link('http://www.hotpost.web/', 'HotPost Mail')}</td><td>Free email. You've got mail!</td></tr>
        <tr><td>${link('http://www.megamall.web/', 'Mega Mall Online')}</td><td>Shopping from the comfort of your chair.</td></tr>
        <tr><td>${link('http://www.cybercafe.web/', 'Cyber Cafe Chat')}</td><td>Chat with people from all over the world.</td></tr>
        <tr><td>${link('http://www.arcade-online.web/', 'Arcade Online')}</td><td>Games you can play right in the page.</td></tr>
        <tr><td>${link('http://www.geovillage.web/', 'GeoVillage')}</td><td>Free homepages, made by real people.</td></tr>
        <tr><td>${link('http://www.coo-fan-club.web/', "Coo's Fan Club")}</td><td>The home page of everyone's favourite pigeon.</td></tr>
        <tr><td>${link('http://www.retro-ring.web/', 'The Retro Webring')}</td><td>Hop from site to site.</td></tr>
      </table>
      <p class="web-tip"><b>Tip:</b> type a few words in the address box to search with Seekr.</p>
      <hr>
      <p class="web-small web-center">ANACHRON Home is the start page of Web Browser.
         Press the house button to come back here.</p>
    </div>`,
};

const seekr = {
  title: 'Seekr Search',
  keywords: 'seekr search engine find look',
  render: () => `
    <div class="web-page web-seekr">
      <h1 class="web-seekr-logo">Seekr<span>!</span></h1>
      <p class="web-center">Searching ${PAGE_COUNT} pages of the World Wide Web.</p>
      ${searchForm('')}
      <p class="web-center web-small">Try: ${link(`${SEEKR}search?q=pigeon`, 'pigeon')},
        ${link(`${SEEKR}search?q=weather`, 'weather')},
        ${link(`${SEEKR}search?q=news`, 'news')},
        ${link(`${SEEKR}search?q=games`, 'games')},
        ${link(`${SEEKR}search?q=dinosaur`, 'dinosaur')}</p>
    </div>`,
  setUp: setUpSearchForm,
};

const seekrResults = {
  title: 'Seekr Search Results',
  keywords: '',
  render: (url) => {
    const q = splitAddress(url).query.get('q') ?? '';
    const results = search(q);
    return `
      <div class="web-page web-seekr">
        <h1 class="web-seekr-logo web-seekr-small">Seekr<span>!</span></h1>
        ${searchForm(q)}
        <p><b>${results.length}</b> ${results.length === 1 ? 'page matches' : 'pages match'}
           <b>"${escapeHtml(q)}"</b>.</p>
        ${results.length ? `<ol class="web-results">${results.map((r) => `
          <li>${link(r.url, r.title)}<br><span class="web-small web-url">${r.url}</span></li>`).join('')}
        </ol>` : `
          <p>Sorry, Seekr couldn't find anything. The web is still very small!
             Try a shorter word, or visit ${link(HOME_PAGE, 'ANACHRON Home')}.</p>`}
      </div>`;
  },
  setUp: setUpSearchForm,
};

function searchForm(value) {
  return `
    <form class="web-search">
      <input class="web-input" name="q" value="${escapeHtml(value)}" spellcheck="false" aria-label="Search for">
      <button class="push-button" type="submit">Seek!</button>
    </form>`;
}

function setUpSearchForm(root, browser) {
  const form = root.querySelector('.web-search');
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const q = form.elements.q.value.trim();
    if (q) browser.go(`${SEEKR}search?q=${encodeURIComponent(q)}`);
  });
}

// Every page whose title or keywords contain every word searched for
function search(q) {
  const words = q.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];

  const found = [];
  for (const [host, pages] of Object.entries(SITES)) {
    for (const [path, page] of Object.entries(pages)) {
      if (!page.keywords) continue;
      const text = `${page.title} ${page.keywords}`.toLowerCase();
      if (words.every((word) => text.includes(word))) {
        found.push({ url: `http://${host}${path}`, title: page.title });
      }
    }
  }
  return found;
}

const fanClub = {
  title: "Coo's Fan Club",
  keywords: 'coo pigeon fan club homepage bird tips',
  render: () => `
    <div class="web-page web-fanclub">
      <h1 class="web-rainbow">~*~ Coo's Fan Club ~*~</h1>
      <p class="web-center"><span class="web-blink">NEW!!</span> Now with a guestbook!</p>
      <p>Hi! Welcome to the <b>official</b> fan club of Coo, the helpful pigeon who lives
         in the corner of your ANACHRON desktop.</p>
      <h2>Top 5 things about Coo</h2>
      <ol>
        <li>Always knows a tip</li>
        <li>Never says the same tip twice in a row</li>
        <li>Can be dragged anywhere (please be gentle)</li>
        <li>Helps you write letters, whether you want help or not</li>
        <li>Bobs head. A lot.</li>
      </ol>
      ${UNDER_CONSTRUCTION}
      <p class="web-center">Please ${link('http://www.coo-fan-club.web/guestbook.html', 'sign my guestbook')}!</p>
      <p class="web-center web-counter">You are visitor number <span data-counter></span></p>
      <p class="web-center web-small">${link('http://www.retro-ring.web/', 'Member of the Retro Webring')}</p>
      ${BEST_VIEWED}
    </div>`,
  setUp: (root) => {
    // A hit counter, like every home page had: one more each visit
    let visits = 1337;
    try {
      visits = Number(localStorage.getItem(COUNTER_KEY)) || 1337;
      localStorage.setItem(COUNTER_KEY, String(visits + 1));
    } catch {
      // Not kept; the counter still shows a number
    }
    root.querySelector('[data-counter]').textContent = String(visits).padStart(6, '0');
  },
};

// Entries people wrote before you, so the guestbook isn't empty
const SEED_ENTRIES = [
  { name: 'Webmaster', message: 'First! Welcome to the guestbook, everybody.', date: 'March 3, 1996' },
  { name: 'SurferDude', message: 'Cool page!!! Coo rules. Check out my site sometime (coming soon).', date: 'April 19, 1996' },
];

const guestbook = {
  title: "Coo's Guestbook",
  keywords: 'coo guestbook sign message visitors',
  render: () => `
    <div class="web-page web-fanclub">
      <h1 class="web-rainbow">Sign My Guestbook!</h1>
      <p class="web-center">${link('http://www.coo-fan-club.web/', "Back to Coo's Fan Club")}</p>
      <form class="web-guestbook-form">
        <table class="web-table">
          <tr><td>Your name:</td><td><input class="web-input" name="name" maxlength="30" spellcheck="false"></td></tr>
          <tr><td>Message:</td><td><textarea class="web-input" name="message" rows="3" maxlength="300"></textarea></td></tr>
          <tr><td></td><td><button class="push-button" type="submit">Sign!</button> <span class="web-form-note"></span></td></tr>
        </table>
      </form>
      <hr>
      <div class="web-entries"></div>
    </div>`,
  setUp: (root) => {
    const list = root.querySelector('.web-entries');

    function show() {
      const entries = [...loadGuestbook()].reverse();
      list.replaceChildren(...entries.map((entry) => {
        const item = document.createElement('div');
        item.className = 'web-entry';
        item.innerHTML = '<p><b></b> <span class="web-small"></span></p><p></p>';
        // Guestbook entries are typed by people: plain text only
        item.querySelector('b').textContent = entry.name;
        item.querySelector('.web-small').textContent = `wrote on ${entry.date}:`;
        item.querySelectorAll('p')[1].textContent = entry.message;
        return item;
      }));
    }

    const form = root.querySelector('.web-guestbook-form');
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const name = form.elements.name.value.trim();
      const message = form.elements.message.value.trim();
      const note = form.querySelector('.web-form-note');
      if (!name || !message) {
        note.textContent = 'Please fill in your name and a message.';
        return;
      }
      saveGuestbook([...loadGuestbook(), { name, message, date: longDate().replace(/^\w+, /, '') }]);
      form.reset();
      note.textContent = 'Thanks for signing!';
      show();
    });

    show();
  },
};

function loadGuestbook() {
  try {
    return JSON.parse(localStorage.getItem(GUESTBOOK_KEY)) ?? SEED_ENTRIES;
  } catch {
    return SEED_ENTRIES;
  }
}

function saveGuestbook(entries) {
  try {
    localStorage.setItem(GUESTBOOK_KEY, JSON.stringify(entries));
  } catch {
    // Not kept, but it shows until the page is closed
  }
}

const HEADLINES = [
  ['Scientists confirm: the nineties never left', 'After years of study, researchers say the decade simply moved into people\'s browsers. "It was very quiet about it," said one.'],
  ['Pigeon named assistant of the year', 'Coo, the helper pigeon, beat a paperclip, a dog and a wizard to the top prize. Coo was not available for comment, but did bob its head.'],
  ['Local man finishes Minesweeper on Expert', 'Witnesses describe his final click as "brave". He plans to celebrate by playing again.'],
  ['Modem speeds reach dizzying 56k', 'Experts warn that pages may now load before you finish making a cup of tea.'],
  ['Solitaire cards seen bouncing across town', 'Residents report a winning game "went everywhere". No injuries were reported.'],
];

const news = {
  title: 'Dial-Up Daily',
  keywords: 'dial-up daily news headlines today paper',
  render: () => `
    <div class="web-page web-news">
      <h1 class="web-news-title">Dial-Up Daily</h1>
      <p class="web-news-date">${longDate()} &middot; Price: free (plus your phone bill)</p>
      ${HEADLINES.map(([headline, story]) => `
        <h2>${headline}</h2>
        <p>${story}</p>`).join('')}
      <hr>
      <p class="web-small">More news tomorrow, if the line isn't busy.
        See also: ${link('http://www.pixel-weather.web/', "today's weather")}.</p>
    </div>`,
};

// The forecast is made up, but the same all day: it's worked out from
// the date, so it doesn't change every time the page is opened
const FORECASTS = [
  ['Sunny', '☀', 'Perfect weather for staying inside on the computer.'],
  ['Cloudy', '☁', 'Grey skies. The screen will look extra bright.'],
  ['Rain', '☂', 'Wet outside. Good day for a long game of Solitaire.'],
  ['Windy', '≈', 'Hold on to your floppy disks.'],
  ['Snow', '❄', 'Snow on the ground, and static on the screen.'],
];

const weather = {
  title: 'Pixel Weather',
  keywords: 'pixel weather forecast rain sun snow temperature',
  render: () => {
    const today = new Date();
    const days = Array.from({ length: 5 }, (_, i) => {
      const date = new Date(today.getFullYear(), today.getMonth(), today.getDate() + i);
      const seed = date.getFullYear() * 400 + date.getMonth() * 31 + date.getDate();
      const [label, symbol, note] = FORECASTS[seed % FORECASTS.length];
      const high = 12 + (seed % 17);
      return { date, label, symbol, note, high, low: high - 6 - (seed % 4) };
    });
    return `
      <div class="web-page web-weather">
        <h1>Pixel Weather</h1>
        <p class="web-big">Today: <b>${days[0].label}</b> ${days[0].symbol}, ${days[0].high}°</p>
        <p>${days[0].note}</p>
        <table class="web-table web-forecast">
          <tr>${days.map((d) => `<th>${d.date.toLocaleDateString('en-US', { weekday: 'short' })}</th>`).join('')}</tr>
          <tr>${days.map((d) => `<td class="web-symbol">${d.symbol}</td>`).join('')}</tr>
          <tr>${days.map((d) => `<td>${d.label}<br>${d.high}° / ${d.low}°</td>`).join('')}</tr>
        </table>
        <p class="web-small">Forecasts are made up by the Pixel Weather team and may not
          match the sky outside your window.</p>
      </div>`;
  },
};

// The sites in the Retro Webring, in ring order
const RING = [
  HOME_PAGE, SEEKR, 'http://www.coo-fan-club.web/', 'http://www.dialup-daily.web/', 'http://www.pixel-weather.web/',
  'http://www.webopedia.web/', 'http://www.arcade-online.web/', 'http://www.geovillage.web/',
  'http://www.geovillage.web/petstreet/whiskers/', 'http://www.geovillage.web/musicrow/floppydisks/',
  'http://www.geovillage.web/kidsville/tommy/',
];

const webring = {
  title: 'The Retro Webring',
  keywords: 'retro webring ring sites links list random',
  render: () => `
    <div class="web-page web-ring">
      <h1>The Retro Webring</h1>
      <p>A ring of home pages that link to each other. Start anywhere, and keep going!</p>
      <ol>${RING.map((url) => `<li>${link(url, titleOf(url))}</li>`).join('')}</ol>
      <p class="web-center">
        ${link(RING[Math.floor(Math.random() * RING.length)], '[ Random Site ]')}
      </p>
      <p class="web-small">Want to join? Your site must have at least one animated picture.</p>
    </div>`,
};

function titleOf(url) {
  const { host, path } = splitAddress(url);
  return SITES[host]?.[path]?.title ?? url;
}

// Every site: host -> { path -> page }
const SITES = {
  'home.anachron.web': { '/': home },
  'www.seekr.web': { '/': seekr, '/search': seekrResults },
  'www.coo-fan-club.web': { '/': fanClub, '/guestbook.html': guestbook },
  'www.dialup-daily.web': { '/': news },
  'www.pixel-weather.web': { '/': weather },
  'www.retro-ring.web': { '/': webring },
  ...SHOP,
  ...ENCYCLOPEDIA,
  ...CHAT,
  ...ARCADE,
  ...VILLAGE,
  ...MAIL,
};

const PAGE_COUNT = Object.values(SITES).reduce((n, pages) => n + Object.values(pages).filter((p) => p.keywords).length, 0);

// The page shown for an address that isn't on this web
export function notFoundPage(url) {
  const { host } = splitAddress(url);
  const words = host.replace(/^www\./, '').split('.')[0] || url;
  return {
    title: 'The page cannot be displayed',
    render: () => `
      <div class="web-page web-error">
        <h1>The page cannot be displayed</h1>
        <p>The page you are looking for, <b>${escapeHtml(url)}</b>, could not be found.</p>
        <p>ANACHRON's modem can only reach the web of the nineties. Sites from the future,
           and sites that never existed, can't be opened here.</p>
        <hr>
        <p>Please try the following:</p>
        <ul>
          <li>Check the address for mistakes.</li>
          <li>Go back to ${link(HOME_PAGE, 'ANACHRON Home')} and follow a link.</li>
          <li>${link(`${SEEKR}search?q=${encodeURIComponent(words)}`, `Search Seekr for "${escapeHtml(words)}"`)}.</li>
        </ul>
        <p class="web-small">Cannot find server or DNS error<br>Web Browser</p>
      </div>`,
  };
}
