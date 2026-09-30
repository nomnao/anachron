// GeoVillage: free homepages for everyone, sorted into
// "neighborhoods" by what they're about. Three people have moved in
// so far: a cat lover, a band, and a kid who loves dinosaurs.

import { link, UNDER_CONSTRUCTION, BEST_VIEWED } from './common.js';

const VILLAGE = 'http://www.geovillage.web/';
const CAT_PAGE = `${VILLAGE}petstreet/whiskers/`;
const BAND_PAGE = `${VILLAGE}musicrow/floppydisks/`;
const DINO_PAGE = `${VILLAGE}kidsville/tommy/`;

const front = {
  title: 'GeoVillage',
  keywords: 'geovillage free homepage home page neighborhood personal sites people',
  render: () => `
    <div class="web-page web-village">
      <h1>GeoVillage</h1>
      <p class="web-center"><i>Free homepages for everyone! Move in today.</i></p>
      <table class="web-table">
        <tr><th>Neighborhood</th><th>Who lives there</th></tr>
        <tr><td>Pet Street</td><td>${link(CAT_PAGE, "Whiskers' Purrfect Page")}</td></tr>
        <tr><td>Music Row</td><td>${link(BAND_PAGE, 'The Floppy Disks (a band)')}</td></tr>
        <tr><td>Kidsville</td><td>${link(DINO_PAGE, "Tommy's Dinosaur Page")}</td></tr>
      </table>
      <p class="web-center">Want your own homepage? Sign-ups open soon!</p>
      ${UNDER_CONSTRUCTION}
    </div>`,
};

const catPage = {
  title: "Whiskers' Purrfect Page",
  keywords: 'geovillage cat cats kitten whiskers pet homepage',
  render: () => `
    <div class="web-page web-cats">
      <h1 class="web-center">~ Whiskers' Purrfect Page ~</h1>
      <pre class="web-ascii">
  /\\_/\\
 ( o.o )
  &gt; ^ &lt;</pre>
      <p>Hello and welcome! This is the homepage of <b>Whiskers</b>, the best cat in the whole
         world. I am his human. Whiskers is 4 years old and orange, and he likes:</p>
      <ul>
        <li>Sleeping on the warm top of the computer monitor</li>
        <li>Chasing the mouse (the computer one)</li>
        <li>Sitting on the keyboard when I'm typing</li>
      </ul>
      <p>Whiskers does NOT like: the vacuum cleaner, baths, or the noise the modem makes.</p>
      <h2>Cat Fact of the Day</h2>
      <p>Cats sleep for about 15 hours a day. Whiskers is going for the record.</p>
      <p class="web-center">${link(VILLAGE, 'Back to GeoVillage')} |
        ${link('http://www.coo-fan-club.web/', 'My friend Coo')}</p>
      ${BEST_VIEWED}
    </div>`,
};

const bandPage = {
  title: 'The Floppy Disks - Official Band Page',
  keywords: 'geovillage band music floppy disks songs tour concert',
  render: () => `
    <div class="web-page web-band">
      <h1 class="web-center">THE FLOPPY DISKS</h1>
      <p class="web-center"><span class="web-blink">NEW ALBUM OUT NOW!</span><br>
        <i>"Insert Disk 2"</i> on cassette, only $6 at the school gate.</p>
      <h2>Tour Dates</h2>
      <table class="web-table">
        <tr><th>Date</th><th>Place</th></tr>
        <tr><td>Friday</td><td>Dave's garage (bring your own chair)</td></tr>
        <tr><td>Saturday</td><td>The Pizza Palace, back room</td></tr>
        <tr><td>Next month</td><td>The School Talent Show (we'll win this time)</td></tr>
      </table>
      <h2>Song Lyrics: "Save Me (Ctrl+S)"</h2>
      <p class="web-lyrics">I wrote you a letter, three pages long,<br>
         then the power went out, and my letter was gone.<br>
         Oh, save me, save me, before it's too late,<br>
         Ctrl and S, don't make me wait!</p>
      <p class="web-center">${link(VILLAGE, 'Back to GeoVillage')}</p>
    </div>`,
};

const dinoPage = {
  title: "Tommy's Dinosaur Page",
  keywords: 'geovillage dinosaur dinosaurs kids tommy t-rex facts',
  render: () => `
    <div class="web-page web-dinos">
      <h1 class="web-center">TOMMY'S DINOSAUR PAGE!!!</h1>
      <p class="web-center">By Tommy, age 9. My dad helped with the computer part.</p>
      <h2>My Top 3 Dinosaurs</h2>
      <ol>
        <li><b>Tyrannosaurus rex</b>: its teeth were as long as bananas. Its arms were very small though.</li>
        <li><b>Triceratops</b>: it had three horns and a big frill, like a shield.</li>
        <li><b>Stegosaurus</b>: it had plates on its back and spikes on its tail. Its brain was very small.</li>
      </ol>
      <h2>Amazing Fact</h2>
      <p>Birds are dinosaurs! Scientists found out they come from the same family as T. rex.
         So pigeons are dinosaurs too. Even Coo!!</p>
      ${UNDER_CONSTRUCTION}
      <p class="web-center">${link(VILLAGE, 'Back to GeoVillage')} |
        ${link('http://www.webopedia.web/articles/pigeon.html', 'Read about pigeons')}</p>
    </div>`,
};

export const SITE = {
  'www.geovillage.web': {
    '/': front,
    '/petstreet/whiskers/': catPage,
    '/musicrow/floppydisks/': bandPage,
    '/kidsville/tommy/': dinoPage,
  },
};
