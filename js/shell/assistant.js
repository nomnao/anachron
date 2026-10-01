// Coo, the helper pigeon: sits in the bottom-right corner of the
// desktop and offers tips in a speech balloon, like the office
// assistants of the nineties.
//
//   - Click Coo for a tip.
//   - Coo chimes in, once each, when you first do certain things
//     (open Minesweeper, delete a file...). Apps tell Coo with
//     tellAssistant('open-paint') and the like.
//   - Start a Notepad letter with "Dear" and Coo offers to help.
//   - Drag Coo anywhere on the desktop; it stays there.
//   - Right-click Coo to hide it; the Start menu brings it back.

import { showContextMenu } from './context-menu.js';

const STORAGE_KEY = 'anachron.assistant';

// How long a balloon stays up if nobody answers it
const BALLOON_MS = 20000;

// Where Coo sits unless dragged somewhere else: this far from the
// desktop's right and bottom edges, in virtual pixels
const HOME = { right: 10, bottom: 32 };
const TASKBAR_HEIGHT = 28;

// A press that moves further than this (in screen pixels) is a drag,
// not a click
const DRAG_THRESHOLD = 4;

// Tips for clicking Coo, one picked at random each time
const TIPS = [
  'You can drag files from your real computer onto the screen to bring them into ANACHRON.',
  'Right-click a file and choose Save to My Computer to keep a copy safe.',
  'Right-click the empty desktop and choose Properties to change the wallpaper.',
  'In Paint, hold Shift to draw straight lines, squares and circles.',
  'Click the clock in the corner to see a calendar.',
  'Drag the edge of a window to make it bigger or smaller.',
  'Deleted something by mistake? It waits in the Recycle Bin until you empty it.',
  'In Notepad, press Ctrl+F to find a word, and F3 to find the next one.',
  'Maximize Minesweeper for a much bigger board!',
  'In Snake, press P to pause. Faster speeds score more for every apple!',
  'In Web Browser, type a few words in the address box to search the web with Seekr.',
  'In ChitChat Messenger, type :) or <3 and it turns into a little picture.',
  'In Solitaire, right-click the green table to send every card you can up to the top.',
  'Right-click the empty desktop and choose Arrange Icons to tidy up.',
  'Any picture you draw or photograph can become your wallpaper.',
];

// What Coo says when you first do something. Each is said only once
// (remembered for next time), except the letter, once per visit.
const MOMENTS = {
  'open-paint': 'Hold Shift while you drag a line, rectangle or ellipse to keep it straight, square or round.',
  'open-minesweeper': 'Right-click a square to plant a flag. Your first click is always safe!',
  'open-solitaire': 'Drag cards onto each other in alternating colors. Double-click a card to send it up to the top!',
  'open-snake': 'Steer with the arrow keys and eat the apples. Mind the walls, and your own tail!',
  'open-browser': "Welcome to the World Wide Web! Don't miss my fan club: it's in the Favorites menu.",
  'open-messenger': 'Double-click a friend to chat. Feeling cheeky? Send them a nudge!',
  'open-camera': 'Smile! Photos you save can be drawn on in Paint, or used as wallpaper.',
  'open-recorder': 'Videos you record can be saved to your real computer: right-click one and choose Save to My Computer.',
  'open-files': 'Click a column title to sort your files by name, type or size.',
  'open-display': 'Any picture you have saved can be your wallpaper. Try Tile for a repeating pattern!',
  'recycle': 'Changed your mind? Deleted files wait in the Recycle Bin until you empty it.',
};

// ---------- Remembering ----------

// { hidden, greeted, seen: [moment names already said],
//   position: { right, bottom } once dragged }
function loadState() {
  try {
    return { hidden: false, greeted: false, seen: [], ...JSON.parse(localStorage.getItem(STORAGE_KEY)) };
  } catch {
    return { hidden: false, greeted: false, seen: [] };
  }
}

function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Not kept, but Coo carries on until the page closes
  }
}

let state = loadState();

// Coo on screen now: { el, balloon, timers } (null while the
// desktop isn't showing)
let coo = null;

// ---------- Setting up ----------

// Returns a function that cleans up when the desktop goes away.
export function setUpAssistant(desktop) {
  state = loadState();
  const el = document.createElement('div');
  el.className = 'assistant';
  el.hidden = state.hidden;
  el.innerHTML = `
    <div class="assistant-balloon" hidden>
      <p class="assistant-text"></p>
      <div class="assistant-choices"></div>
    </div>
    <button class="assistant-bird" aria-label="Coo, the helper pigeon" title="Click me for a tip">
      ${BIRD}
    </button>
  `;
  desktop.append(el);

  coo = { el, balloon: el.querySelector('.assistant-balloon'), timers: [], lastTip: -1 };

  // Clicking Coo or its balloon leaves the keyboard where it was,
  // so you can carry on typing in Notepad
  el.addEventListener('mousedown', (event) => event.preventDefault());

  const bird = el.querySelector('.assistant-bird');
  bird.addEventListener('click', () => {
    // The click at the end of a drag isn't a click on Coo
    if (coo.justDragged) {
      coo.justDragged = false;
      return;
    }
    sayTip();
  });
  bird.addEventListener('contextmenu', (event) => {
    event.preventDefault();
    showContextMenu(event, [
      { label: 'Show a Tip', action: sayTip },
      { label: 'Move Back to Corner', action: () => moveTo(HOME, true) },
      { separator: true },
      { label: 'Hide Coo', action: () => setHidden(true) },
    ]);
  });
  setUpDragging(desktop, bird);
  moveTo(state.position ?? HOME, false);

  // Blinks, bobs its head and flaps now and then, so Coo looks alive
  const moves = ['is-blinking', 'is-blinking', 'is-bobbing', 'is-flapping'];
  coo.timers.push(setInterval(() => wiggle(moves[Math.floor(Math.random() * moves.length)]), 3500));

  // The first time ever, Coo says hello after a moment
  if (!state.greeted && !state.hidden) {
    coo.timers.push(setTimeout(greet, 2500));
  }

  return () => {
    for (const timer of coo.timers) clearTimeout(timer);
    clearTimeout(coo.balloonTimer);
    coo = null;
  };
}

// ---------- What Coo says ----------

// Apps call this when something happens that Coo might have a word
// about, e.g. tellAssistant('open-paint')
export function tellAssistant(moment) {
  if (!coo || state.hidden) return;

  if (moment === 'writing-letter') {
    offerLetterHelp();
    return;
  }

  const text = MOMENTS[moment];
  if (!text || state.seen.includes(moment)) return;
  state.seen.push(moment);
  saveState();
  say(text);
}

// Shows or hides Coo, from the Start menu. Coo says hello when it
// comes back.
export function toggleAssistant() {
  if (!coo) return;
  setHidden(!state.hidden);
  if (!state.hidden) say("I'm back! Click me any time for a tip.");
}

export function isAssistantHidden() {
  return state.hidden;
}

function greet() {
  state.greeted = true;
  saveState();
  say("Coo! I'm Coo, the ANACHRON pigeon. I know my way around. Click me any time for a tip.", [
    { label: 'Show me a tip', action: sayTip },
    { label: 'OK' },
  ]);
}

function sayTip() {
  if (!coo) return;
  // Never the same tip twice in a row
  let index = Math.floor(Math.random() * TIPS.length);
  if (index === coo.lastTip) index = (index + 1) % TIPS.length;
  coo.lastTip = index;
  say(TIPS[index], [{ label: 'Another tip', action: sayTip }, { label: 'OK' }]);
}

// The famous one
function offerLetterHelp() {
  if (coo.letterOffered) return;
  coo.letterOffered = true;

  say("It looks like you're writing a letter. Would you like help?", [
    {
      label: 'Get help with writing the letter',
      action: () => say('Say who it\'s for, then why you\'re writing, and finish with "Yours sincerely" and your name. Good luck!'),
    },
    { label: 'Just type the letter without help' },
    { label: "Don't show me this tip again", action: () => setHidden(true) },
  ]);
}

// Opens the balloon with some words and, optionally, choices to
// click. Each choice closes the balloon, then runs its action.
function say(text, choices = [{ label: 'OK' }]) {
  if (!coo) return;
  const { el, balloon } = coo;
  el.hidden = false;

  balloon.querySelector('.assistant-text').textContent = text;
  balloon.querySelector('.assistant-choices').replaceChildren(...choices.map((choice) => {
    const button = document.createElement('button');
    button.className = 'assistant-choice';
    button.textContent = choice.label;
    button.addEventListener('click', () => {
      closeBalloon();
      choice.action?.();
    });
    return button;
  }));
  balloon.hidden = false;
  placeBalloon();
  wiggle('is-hopping');

  clearTimeout(coo.balloonTimer);
  coo.balloonTimer = setTimeout(closeBalloon, BALLOON_MS);
}

function closeBalloon() {
  if (coo) coo.balloon.hidden = true;
}

function setHidden(hidden) {
  state.hidden = hidden;
  saveState();
  if (!coo) return;
  closeBalloon();
  coo.el.hidden = hidden;
  // Coming back, make sure it's still on screen
  if (!hidden) moveTo(currentPosition(), false);
}

// ---------- Moving Coo ----------

// Press and drag Coo to move it. While it's carried, it flaps.
function setUpDragging(desktop, bird) {
  bird.addEventListener('pointerdown', (event) => {
    if (event.button !== 0) return;

    const start = { x: event.clientX, y: event.clientY, ...currentPosition() };
    const { scale } = measureDesktop(desktop);
    let dragging = false;
    bird.setPointerCapture(event.pointerId);

    function onMove(moveEvent) {
      const dx = moveEvent.clientX - start.x;
      const dy = moveEvent.clientY - start.y;
      if (!dragging && Math.hypot(dx, dy) < DRAG_THRESHOLD) return;

      if (!dragging) {
        dragging = true;
        bird.classList.add('is-carried');
      }
      // Right and bottom grow as Coo moves left and up
      moveTo({ right: start.right - dx / scale, bottom: start.bottom - dy / scale }, false);
    }

    function onEnd() {
      bird.removeEventListener('pointermove', onMove);
      bird.removeEventListener('pointerup', onEnd);
      bird.removeEventListener('pointercancel', onEnd);
      if (!dragging) return;

      bird.classList.remove('is-carried');
      coo.justDragged = true;
      // A click doesn't follow a drag on every browser, so don't
      // let the flag wait for one forever
      setTimeout(() => { if (coo) coo.justDragged = false; }, 0);
      moveTo(currentPosition(), true);
      wiggle('is-hopping');
    }

    bird.addEventListener('pointermove', onMove);
    bird.addEventListener('pointerup', onEnd);
    bird.addEventListener('pointercancel', onEnd);
  });
}

// Puts Coo at { right, bottom } (virtual pixels from the desktop's
// right and bottom edges), kept on screen and off the taskbar.
// remember keeps the spot for next time.
function moveTo(position, remember) {
  if (!coo) return;
  const { el } = coo;
  const desktop = el.parentElement;
  const screen = measureDesktop(desktop);
  const size = { width: el.offsetWidth / screen.scale, height: el.offsetHeight / screen.scale };

  let { right, bottom } = position;
  if (screen.width) {
    right = Math.min(Math.max(right, 0), Math.max(0, screen.width - size.width));
    bottom = Math.min(Math.max(bottom, TASKBAR_HEIGHT + 2), Math.max(TASKBAR_HEIGHT + 2, screen.height - size.height));
  }

  el.style.right = `calc(var(--px) * ${right})`;
  el.style.bottom = `calc(var(--px) * ${bottom})`;
  coo.position = { right, bottom };
  if (!coo.balloon.hidden) placeBalloon();

  if (remember) {
    // Back in its corner, Coo just goes home next time too
    state.position = right === HOME.right && bottom === HOME.bottom ? undefined : { right, bottom };
    saveState();
  }
}

function currentPosition() {
  return coo.position ?? HOME;
}

// The balloon goes above Coo and to its left, unless that would run
// off the screen: then below, or to the right, instead
function placeBalloon() {
  const { el, balloon } = coo;
  balloon.classList.remove('is-below', 'is-right');
  const area = el.parentElement.getBoundingClientRect();
  const bird = el.getBoundingClientRect();
  const size = balloon.getBoundingClientRect();

  if (bird.top - size.height - 12 < area.top) balloon.classList.add('is-below');
  if (bird.right - size.width < area.left) balloon.classList.add('is-right');
}

// How many screen pixels one virtual pixel is, and the desktop's
// size in virtual pixels (measured, as the window manager does)
function measureDesktop(desktop) {
  const probe = document.createElement('div');
  probe.style.cssText = 'position: absolute; visibility: hidden; width: calc(var(--px) * 100);';
  desktop.append(probe);
  const scale = probe.getBoundingClientRect().width / 100 || 1;
  probe.remove();
  const rect = desktop.getBoundingClientRect();
  return { scale, width: rect.width / scale, height: rect.height / scale };
}

// Plays one of the pigeon's little animations (see .assistant in os.css)
function wiggle(className) {
  const bird = coo?.el.querySelector('.assistant-bird');
  if (!bird) return;
  bird.classList.remove(className);
  // Reading the size restarts the animation if it was just playing
  void bird.offsetWidth;
  bird.classList.add(className);
  bird.addEventListener('animationend', () => bird.classList.remove(className), { once: true });
}

// ---------- The pigeon ----------

// A plump little pigeon on a 28 x 24 grid, facing left, drawn in
// chunky pixels. The head, eye and wing are separate so they can be
// animated: pigeons bob their heads, blink and flap.
const BIRD = `
  <svg viewBox="0 0 28 24" shape-rendering="crispEdges">
    <!-- tail -->
    <rect x="19" y="12" width="6" height="3" fill="#5f6678"/>
    <rect x="24" y="12" width="2" height="3" fill="#2a2d38"/>
    <!-- body, with a paler breast -->
    <rect x="7" y="10" width="13" height="1" fill="#a3abbd"/>
    <rect x="6" y="11" width="16" height="5" fill="#a3abbd"/>
    <rect x="7" y="16" width="14" height="2" fill="#a3abbd"/>
    <rect x="9" y="18" width="9" height="1" fill="#8d95a8"/>
    <rect x="6" y="11" width="5" height="5" fill="#bcc3d1"/>
    <!-- wing, with two dark bars -->
    <g class="assistant-wing">
      <rect x="11" y="11" width="9" height="5" fill="#7d8599"/>
      <rect x="13" y="13" width="5" height="1" fill="#2a2d38"/>
      <rect x="14" y="15" width="5" height="1" fill="#2a2d38"/>
    </g>
    <!-- feet -->
    <rect x="10" y="19" width="1" height="2" fill="#e8708a"/>
    <rect x="9" y="21" width="3" height="1" fill="#e8708a"/>
    <rect x="14" y="19" width="1" height="2" fill="#e8708a"/>
    <rect x="13" y="21" width="3" height="1" fill="#e8708a"/>
    <!-- head, with its shiny green and purple neck -->
    <g class="assistant-head">
      <rect x="5" y="8" width="6" height="1" fill="#5fa87a"/>
      <rect x="6" y="9" width="6" height="2" fill="#8a5fa8"/>
      <rect x="4" y="2" width="6" height="1" fill="#8d95a8"/>
      <rect x="3" y="3" width="8" height="4" fill="#8d95a8"/>
      <rect x="4" y="7" width="6" height="1" fill="#8d95a8"/>
      <rect x="1" y="5" width="2" height="1" fill="#3a3a3a"/>
      <rect x="2" y="4" width="1" height="1" fill="#f0f0f0"/>
      <g class="assistant-eyes">
        <rect x="5" y="4" width="2" height="2" fill="#ff8a1a"/>
        <rect x="5" y="4" width="1" height="1" fill="#111111"/>
      </g>
    </g>
  </svg>
`;
