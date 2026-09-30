// Pixel Pets Shelter: adopt a little pixel pet, then look after it.
// Feed it, play with it and let it nap. Its fullness, happiness and
// energy go down slowly as real time passes (even while ANACHRON is
// off), so come back to visit. A pet that's been left alone gets
// hungry and grumpy, but never comes to any harm.
// One pet at a time; it's remembered in this browser.

import { link, escapeHtml, longDate, loadStored, saveStored } from './common.js';

const SHELTER = 'http://www.pixelpets.web/';
const MY_PET = `${SHELTER}mypet.html`;
const CERTIFICATE = `${SHELTER}certificate.html`;
const adoptUrl = (id) => `${SHELTER}adopt?pet=${id}`;

const STORAGE_KEY = 'anachron.pixel-pet';

// How many points a minute each need goes down
const DECAY = { fullness: 2, happiness: 1.5, energy: 1 };

// The pets, drawn as tiny pictures: each letter is a color from
// `colors`, and '.' is see-through
const PETS = {
  cat: {
    name: 'Mittens', species: 'Kitten', age: '3 months',
    about: 'Loves naps on warm keyboards and chasing the mouse pointer.',
    colors: { o: '#f0a040', d: '#c07020', k: '#202020', w: '#ffffff', p: '#ff8fa8' },
    picture: [
      '.o......o...',
      '.oo....oo...',
      '.oooooooo...',
      '.okwoowko...',
      '.oooppooo...',
      '.odooooodo.o',
      '..oooooooo.o',
      '..oooooooooo',
      '..oo.oo.oo..',
    ],
  },
  dog: {
    name: 'Biscuit', species: 'Puppy', age: '5 months',
    about: 'Wags at everything. Will fetch your floppy disks (and chew them).',
    colors: { b: '#b07840', d: '#6a4424', k: '#202020', w: '#ffffff', p: '#ff7090' },
    picture: [
      'dd......dd..',
      'dbbbbbbbbd..',
      'dbkbbbbkbd..',
      '.bbbbbbbb...',
      '.bbbkkbbb...',
      '.bbbbppbb..d',
      '..bbbbbbbbd.',
      '.bbbbbbbbb..',
      '.bb.bb.bb.b.',
    ],
  },
  hamster: {
    name: 'Nibbles', species: 'Hamster', age: '2 months',
    about: 'Stuffs its cheeks with seeds. Runs on its wheel all night.',
    colors: { t: '#e8b878', w: '#fff4e0', k: '#202020', p: '#ff9fb0' },
    picture: [
      '..p......p..',
      '.ttt....ttt.',
      '.tttttttttt.',
      'tttkttttkttt',
      'tttttppttttt',
      'ttwwwwwwwwtt',
      '.twwwwwwwwt.',
      '..tttttttt..',
      '..pp....pp..',
    ],
  },
  fish: {
    name: 'Bubbles', species: 'Goldfish', age: '1 year',
    about: 'Swims in circles and never gets bored. Remembers you for months!',
    colors: { g: '#ff8a20', y: '#ffc040', k: '#202020', w: '#ffffff', b: '#80c0ff' },
    picture: [
      '..........b.',
      '....ggg.....',
      '..gggggg...g',
      '.gwkggyggggg',
      'gggggggyggg.',
      '.gggggyggggg',
      '..gggggg...g',
      '....ggg.....',
      '.........b..',
    ],
  },
  bunny: {
    name: 'Clover', species: 'Bunny', age: '4 months',
    about: 'Hops about, twitches its nose, and loves carrots more than anything.',
    colors: { w: '#f8f8f8', a: '#a8a8a8', p: '#ff9fb0', k: '#202020' },
    picture: [
      '..ap..pa....',
      '..ap..pa....',
      '.awwwwwwa...',
      '.awkwwkwa...',
      '.awwppwwa...',
      '..awwwwa.ww.',
      '.awwwwwwaww.',
      '.awwwwwwwa..',
      '..aa..aa....',
    ],
  },
  pigeon: {
    name: 'Pidge', species: 'Pigeon', age: '6 months',
    about: "Coo's little cousin! Bobs its head and loves crumbs.",
    colors: { g: '#a3abbd', d: '#7d8599', n: '#5fa87a', u: '#8a5fa8', k: '#202020', f: '#e8708a' },
    picture: [
      '..ggg.......',
      '.gkggg......',
      'kggggg......',
      '..nnug......',
      '..guuggggg..',
      '..gggddddgg.',
      '...ggddddggk',
      '....gggggg..',
      '....f..f....',
    ],
  },
};

// A pet's picture as an SVG, one square per letter
function picture(pet, className = 'web-pet-picture') {
  const width = pet.picture[0].length;
  const squares = pet.picture.flatMap((row, y) => [...row].map((letter, x) => (
    letter === '.' ? '' : `<rect x="${x}" y="${y}" width="1" height="1" fill="${pet.colors[letter]}"/>`
  ))).join('');
  return `<svg class="${className}" viewBox="0 0 ${width} ${pet.picture.length}" shape-rendering="crispEdges">${squares}</svg>`;
}

// ---------- The pet you adopted ----------

// { kind, name, adopted (date), stats: { fullness, happiness, energy },
//   updated (time) }, or null. The needs have gone down since it was
// last saved.
function loadPet() {
  const pet = loadStored(STORAGE_KEY, null);
  if (!pet || !PETS[pet.kind]) return null;

  const minutes = Math.max(0, (Date.now() - pet.updated) / 60000);
  for (const [need, rate] of Object.entries(DECAY)) {
    pet.stats[need] = Math.max(0, pet.stats[need] - minutes * rate);
  }
  pet.updated = Date.now();
  return pet;
}

function savePet(pet) {
  saveStored(STORAGE_KEY, pet);
}

// What your pet is feeling, from its lowest need
function moodOf(pet) {
  const { fullness, happiness, energy } = pet.stats;
  const lowest = Math.min(fullness, happiness, energy);
  if (lowest >= 60) return { face: 'happy', text: 'is very happy!' };
  if (fullness === lowest && fullness < 40) return { face: 'sad', text: 'is hungry. Feed me!' };
  if (energy === lowest && energy < 40) return { face: 'sleepy', text: 'is sleepy. Time for a nap?' };
  if (happiness === lowest && happiness < 40) return { face: 'sad', text: 'is bored. Play with me!' };
  return { face: 'happy', text: 'is doing fine.' };
}

// ---------- The pages ----------

const shelter = {
  title: 'Pixel Pets Shelter',
  keywords: 'pixel pets shelter adopt adoption pet animals kitten puppy hamster goldfish bunny pigeon',
  render: () => {
    const pet = loadPet();
    return `
      <div class="web-page web-pets">
        <h1>Pixel Pets Shelter</h1>
        <p class="web-center">These little pixels are looking for a loving home. Could it be yours?</p>
        ${pet ? `<p class="web-center web-pets-have">You adopted <b>${escapeHtml(pet.name)}</b>.
          ${link(MY_PET, `Visit ${escapeHtml(pet.name)}`)}</p>` : ''}
        <div class="web-pets-grid">
          ${Object.entries(PETS).map(([id, info]) => `
            <div class="web-pets-card">
              ${picture(info)}
              <b>${info.name}</b>
              <span class="web-small">${info.species}, ${info.age}</span>
              <span class="web-small">${info.about}</span>
              ${link(adoptUrl(id), 'Adopt me!')}
            </div>`).join('')}
        </div>
      </div>`;
  },
};

const adopt = {
  title: 'Adopt a Pet - Pixel Pets Shelter',
  keywords: '',
  render: (url) => {
    const id = new URL(url).searchParams.get('pet');
    const info = PETS[id];
    if (!info) return `<div class="web-page web-pets"><p>That pet has found a home already! ${link(SHELTER, 'See the others')}</p></div>`;

    const current = loadPet();
    return `
      <div class="web-page web-pets" data-pet="${id}">
        <p>${link(SHELTER, '&lt; Back to the shelter')}</p>
        <h1>Adopt ${info.name}</h1>
        <div class="web-pets-adopt">
          ${picture(info, 'web-pet-picture is-big')}
          <div>
            <p><b>${info.species}</b>, ${info.age}. ${info.about}</p>
            ${current ? `
              <p>You already have <b>${escapeHtml(current.name)}</b>. A good owner looks after one pet at a time.</p>
              <p>${link(MY_PET, `Visit ${escapeHtml(current.name)}`)}, or
                 <button class="push-button" data-give-back>Bring ${escapeHtml(current.name)} back to the shelter</button></p>
              <p class="web-small">(${escapeHtml(current.name)} will be very well looked after here.)</p>` : `
              <form class="web-pets-form">
                <p>Give your new pet a name:<br>
                  <input class="web-input" name="name" maxlength="16" spellcheck="false" value="${info.name}"></p>
                <p><label><input type="checkbox" name="promise"> I promise to feed my pet and play with it.</label></p>
                <p><button class="push-button" type="submit">Adopt!</button> <span class="web-form-note"></span></p>
              </form>`}
          </div>
        </div>
      </div>`;
  },
  setUp: (root, browser) => {
    const page = root.querySelector('.web-pets');
    const id = page.dataset.pet;
    if (!id) return;

    page.addEventListener('click', (event) => {
      if (!event.target.closest('[data-give-back]')) return;
      saveStored(STORAGE_KEY, null);
      browser.go(adoptUrl(id));
    });

    page.querySelector('.web-pets-form')?.addEventListener('submit', (event) => {
      event.preventDefault();
      const form = event.target;
      const name = form.elements.name.value.trim();
      const note = form.querySelector('.web-form-note');
      if (!name) {
        note.textContent = 'Your pet needs a name!';
        return;
      }
      if (!form.elements.promise.checked) {
        note.textContent = 'Please tick the promise first.';
        return;
      }

      savePet({
        kind: id, name, adopted: longDate(),
        stats: { fullness: 80, happiness: 80, energy: 80 }, updated: Date.now(),
      });
      browser.go(CERTIFICATE);
    });
  },
};

const certificate = {
  title: 'Adoption Certificate - Pixel Pets Shelter',
  keywords: '',
  render: () => {
    const pet = loadPet();
    if (!pet) return `<div class="web-page web-pets"><p>No adoption yet. ${link(SHELTER, 'Visit the shelter')}</p></div>`;
    const info = PETS[pet.kind];
    return `
      <div class="web-page web-pets">
        <div class="web-pets-certificate">
          <p class="web-pets-certificate-title">Certificate of Adoption</p>
          ${picture(info)}
          <p>This is to certify that <b>${escapeHtml(pet.name)}</b> the ${info.species.toLowerCase()}
             has found a loving new home.</p>
          <p class="web-small">Adopted on ${escapeHtml(pet.adopted)} &middot; Pixel Pets Shelter</p>
        </div>
        <p class="web-center">${link(MY_PET, `Say hello to ${escapeHtml(pet.name)}!`)}</p>
      </div>`;
  },
};

const myPet = {
  title: 'My Pet - Pixel Pets Shelter',
  keywords: 'pixel pets my pet feed play care virtual pet',
  render: () => {
    const pet = loadPet();
    if (!pet) {
      return `
        <div class="web-page web-pets">
          <h1>My Pet</h1>
          <p>You don't have a pet yet. ${link(SHELTER, 'Visit the shelter')} and adopt one!</p>
        </div>`;
    }
    const info = PETS[pet.kind];
    return `
      <div class="web-page web-pets">
        <h1>${escapeHtml(pet.name)}'s Home</h1>
        <div class="web-pets-home">
          <div class="web-pets-stage">
            ${picture(info, 'web-pet-picture is-big')}
            <span class="web-pets-bubble" hidden></span>
          </div>
          <div>
            <p class="web-pets-mood"></p>
            <table class="web-pets-stats">
              <tr><td>Fullness</td><td><span class="web-pets-bar"><i data-stat="fullness"></i></span></td></tr>
              <tr><td>Happiness</td><td><span class="web-pets-bar"><i data-stat="happiness"></i></span></td></tr>
              <tr><td>Energy</td><td><span class="web-pets-bar"><i data-stat="energy"></i></span></td></tr>
            </table>
            <p class="web-pets-actions">
              <button class="push-button" data-do="feed">Feed</button>
              <button class="push-button" data-do="play">Play</button>
              <button class="push-button" data-do="nap">Nap</button>
              <button class="push-button" data-do="pat">Pat</button>
            </p>
          </div>
        </div>
        <p class="web-small">${info.species}, adopted ${escapeHtml(pet.adopted)}.
          ${escapeHtml(pet.name)} misses you when you're away, so come back often!
          ${link(SHELTER, 'Back to the shelter')}</p>
      </div>`;
  },
  setUp: (root) => {
    const page = root.querySelector('.web-pets-home');
    if (!page) return undefined;

    const stage = page.querySelector('.web-pet-picture');
    const bubble = page.querySelector('.web-pets-bubble');
    let bubbleTimer = null;

    function draw(pet) {
      const mood = moodOf(pet);
      page.querySelector('.web-pets-mood').textContent = `${pet.name} ${mood.text}`;
      stage.dataset.mood = mood.face;
      for (const bar of page.querySelectorAll('[data-stat]')) {
        const value = pet.stats[bar.dataset.stat];
        bar.style.width = `${value}%`;
        bar.classList.toggle('is-low', value < 30);
      }
    }

    // A speech bubble for a moment, and a little hop
    function react(text, hop = true) {
      bubble.textContent = text;
      bubble.hidden = false;
      clearTimeout(bubbleTimer);
      bubbleTimer = setTimeout(() => { bubble.hidden = true; }, 1800);
      if (hop) {
        stage.classList.remove('is-hopping');
        // Reading the size restarts the animation
        void stage.offsetWidth;
        stage.classList.add('is-hopping');
      }
    }

    page.querySelector('.web-pets-actions').addEventListener('click', (event) => {
      const action = event.target.closest('[data-do]')?.dataset.do;
      const pet = loadPet();
      if (!action || !pet) return;
      const { stats } = pet;

      if (action === 'feed') {
        if (stats.fullness > 90) react('Too full!', false);
        else { stats.fullness = Math.min(100, stats.fullness + 30); react('Yum!'); }
      }
      if (action === 'play') {
        if (stats.energy < 15) react('Too tired...', false);
        else {
          stats.happiness = Math.min(100, stats.happiness + 25);
          stats.energy = Math.max(0, stats.energy - 10);
          stats.fullness = Math.max(0, stats.fullness - 5);
          react('Wheee!');
        }
      }
      if (action === 'nap') {
        stats.energy = Math.min(100, stats.energy + 40);
        react('Zzz...', false);
      }
      if (action === 'pat') {
        stats.happiness = Math.min(100, stats.happiness + 5);
        react('♥');
      }

      savePet(pet);
      draw(pet);
    });

    // The needs go down while you watch, too
    const pet = loadPet();
    savePet(pet);
    draw(pet);
    const timer = setInterval(() => {
      const now = loadPet();
      if (!now) return;
      savePet(now);
      draw(now);
    }, 5000);

    return () => {
      clearInterval(timer);
      clearTimeout(bubbleTimer);
    };
  },
};

export const SITE = {
  'www.pixelpets.web': {
    '/': shelter, '/adopt': adopt, '/certificate.html': certificate, '/mypet.html': myPet,
  },
};
