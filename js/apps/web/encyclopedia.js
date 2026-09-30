// Webopedia: an encyclopedia on the web, before there were wikis.
// A handful of short articles about the things ANACHRON is made of.

import { link } from './common.js';

const WEBOPEDIA = 'http://www.webopedia.web/';
const articleUrl = (id) => `${WEBOPEDIA}articles/${id}.html`;

// Each article: its title, a few paragraphs, and the articles it
// links to at the end
const ARTICLES = {
  modem: {
    title: 'Modem',
    keywords: 'modem dial-up phone line internet connect 56k bps baud',
    text: [
      'A <b>modem</b> lets a computer talk to another computer over a telephone line. The name comes from what it does: it <i>mo</i>dulates the computer\'s data into sounds, and <i>dem</i>odulates the sounds that come back.',
      'Connecting was called <b>dialing up</b>. The modem dialed a phone number, and the two modems greeted each other with a burst of squeals and hisses, agreeing how fast they could talk. While you were online, nobody else in the house could use the phone.',
      'Speeds were measured in bits per second (bps). In the mid-nineties, 14,400 and 28,800 bps were common; 56k modems arrived in 1997. A small picture could take several seconds to load.',
    ],
    see: ['web', 'floppy'],
  },
  floppy: {
    title: 'Floppy Disk',
    keywords: 'floppy disk diskette storage 1.44 save icon',
    text: [
      'A <b>floppy disk</b> stores files on a thin, bendy magnetic disc inside a plastic case. The 3.5-inch kind, with its hard case and sliding metal shutter, held 1.44 megabytes: about one photo from a modern phone.',
      'Programs often came on a stack of floppies that had to be inserted one after another. To keep a disk safe from being written over, you slid the little tab in its corner.',
      'The floppy disk is gone from computers, but its picture lives on as the "Save" button in many programs.',
    ],
    see: ['crt', 'modem'],
  },
  crt: {
    title: 'CRT Monitor',
    keywords: 'crt monitor screen cathode ray tube display beige',
    text: [
      'A <b>CRT</b> (cathode ray tube) monitor makes a picture by firing a beam of electrons at the inside of its glass screen, which is coated with materials that glow where the beam hits.',
      'The beam sweeps across the screen line by line, many times a second. CRTs were deep and heavy, because the tube had to be long enough for the beam to reach every corner. Their glass was curved, and the picture rarely reached the very edge.',
      'A common size was 14 or 15 inches, showing 640 x 480 or 800 x 600 pixels. Most were beige, to match the computer.',
    ],
    see: ['screensaver', 'floppy'],
  },
  screensaver: {
    title: 'Screensaver',
    keywords: 'screensaver screen saver burn-in flying toasters stars pipes',
    text: [
      'A <b>screensaver</b> is a moving picture that appears when a computer has been left alone for a while.',
      'They were invented because a CRT screen could be damaged by showing the same picture for too long: the image would be "burned in" and stay faintly visible forever. A screensaver kept the picture moving, so no part of the screen wore out.',
      'Screensavers soon became a way to show off: starfields, 3D pipes, maze walks and flying objects were all popular.',
    ],
    see: ['crt'],
  },
  web: {
    title: 'World Wide Web',
    keywords: 'world wide web www internet html browser homepage link',
    text: [
      'The <b>World Wide Web</b> is a collection of pages that link to each other, reached over the internet with a program called a web browser. It was invented by Tim Berners-Lee in 1989 and opened to everyone in 1991.',
      'Pages are written in HTML, which describes headings, paragraphs, pictures and <b>links</b>: words that take you to another page when clicked. In the nineties, many people made their own <b>home page</b>, often with a visitor counter, a guestbook and an "Under Construction" sign.',
      'To find things, people used directories, search engines and <b>webrings</b>: circles of sites on the same subject, each linking to the next.',
    ],
    see: ['modem', 'pigeon'],
  },
  pigeon: {
    title: 'Pigeon',
    keywords: 'pigeon bird dove homing coo feathers',
    text: [
      '<b>Pigeons</b> are birds of the dove family, found in towns and cities all over the world. Their soft cooing call is where the word "coo" comes from.',
      'Homing pigeons can find their way home from hundreds of kilometers away, and were used to carry messages long before telephones and email. Some carried news, others carried medicine or photographs.',
      'Pigeons are clever: they can recognize themselves in a mirror, and learn to tell different pictures apart. They also bob their heads when they walk, which keeps their view steady.',
    ],
    see: ['web'],
  },
  minesweeper: {
    title: 'Minesweeper',
    keywords: 'minesweeper game mines puzzle numbers flag',
    text: [
      '<b>Minesweeper</b> is a puzzle game played on a grid of covered squares, some hiding mines. Uncovering a square shows how many of its neighbors hide a mine; using those numbers, the player works out where every mine is.',
      'Right-clicking plants a flag on a square thought to hide a mine. The game is won when every safe square has been uncovered.',
      'Versions of the game came with many computers in the nineties, which made it one of the most played games in the world.',
    ],
    see: ['solitaire'],
  },
  solitaire: {
    title: 'Solitaire',
    keywords: 'solitaire klondike patience card game cards',
    text: [
      '<b>Solitaire</b>, also called patience, is any card game for one player. The best known is <b>Klondike</b>: seven piles are dealt, and the aim is to build four piles, one per suit, from Ace to King.',
      'In the seven piles, cards are stacked downwards in alternating colors, such as a red 9 on a black 10. Only a King can fill an empty pile.',
      'Computer Solitaire became famous in the nineties. It was also a clever way to teach people to use a mouse: dragging cards is good practice for dragging anything else.',
    ],
    see: ['minesweeper'],
  },
};

function page(id) {
  const article = ARTICLES[id];
  return {
    title: `${article.title} - Webopedia`,
    keywords: `webopedia encyclopedia ${article.keywords}`,
    render: () => `
      <div class="web-page web-pedia">
        <p class="web-pedia-bar">${link(WEBOPEDIA, 'Webopedia')} &gt; ${article.title}</p>
        <h1>${article.title}</h1>
        ${article.text.map((paragraph) => `<p>${paragraph}</p>`).join('')}
        <p><b>See also:</b> ${article.see.map((other) => link(articleUrl(other), ARTICLES[other].title)).join(', ')}</p>
        <hr>
        <p class="web-small">Webopedia is written by volunteers. Found a mistake? Tell us by fax.</p>
      </div>`,
  };
}

const index = {
  title: 'Webopedia',
  keywords: 'webopedia encyclopedia articles facts learn knowledge reference',
  render: () => {
    const sorted = Object.entries(ARTICLES).sort(([, a], [, b]) => a.title.localeCompare(b.title));
    return `
      <div class="web-page web-pedia">
        <h1 class="web-pedia-logo">Webopedia</h1>
        <p class="web-center"><i>The free encyclopedia of the World Wide Web.</i><br>
          <span class="web-small">${sorted.length} articles and counting!</span></p>
        <h2>All articles, A to Z</h2>
        <ul class="web-pedia-list">
          ${sorted.map(([id, article]) => `<li>${link(articleUrl(id), article.title)}</li>`).join('')}
        </ul>
        <p class="web-small">Can't find it? Try ${link('http://www.seekr.web/', 'Seekr')}.</p>
      </div>`;
  },
};

const pages = { '/': index };
for (const id of Object.keys(ARTICLES)) pages[`/articles/${id}.html`] = page(id);

export const SITE = { 'www.webopedia.web': pages };
