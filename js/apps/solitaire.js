// Solitaire (Klondike): move every card up to the four piles at the
// top right, one pile per suit, from Ace to King.
//
// - Click the deck (top left) to turn over cards.
// - Drag cards onto the seven piles below, building down in
//   alternating colors (a red 9 on a black 10). Only a King can go
//   on an empty pile.
// - Double-click a card to send it up to its suit's pile, or
//   right-click the green table to send up every card that can go.
// - Game > Undo (Ctrl+Z) takes back a move.
//
// Winning makes the cards bounce off the table, like the real thing.

import { setUpMenuBar } from '../shell/menus.js';
import { showConfirmDialog } from '../shell/dialogs.js';
import { isDoubleClick } from '../shell/double-click.js';

const STORAGE_KEY = 'anachron.solitaire';

// Sizes in virtual pixels. Cards are the size of the Windows ones.
const CARD_WIDTH = 71;
const CARD_HEIGHT = 96;
const TOP = 8;                    // the top row of piles
const PILES_TOP = TOP + CARD_HEIGHT + 10;  // the seven piles below
const DOWN_STEP = 3;              // how far each face-down card peeks out
const UP_STEP = 15;               // ...and each face-up card
const MIN_UP_STEP = 5;            // squeezed together in a long pile
const WASTE_STEP = 14;            // Draw Three fans out the turned cards

// A press that moves further than this (in screen pixels) is a drag
const DRAG_THRESHOLD = 3;

// Suits in card order: 0 spades, 1 hearts, 2 diamonds, 3 clubs.
// Hearts and diamonds are red.
const SUITS = ['spades', 'hearts', 'diamonds', 'clubs'];
const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
const RED = '#d00000';

// Every card is a number from 0 to 51: suit * 13 + (rank - 1)
const suitOf = (id) => Math.floor(id / 13);
const rankOf = (id) => (id % 13) + 1;
const isRed = (id) => suitOf(id) === 1 || suitOf(id) === 2;

// Standard scoring, like Windows
const SCORE = {
  wasteToPile: 5,
  toFoundation: 10,
  fromFoundation: -15,
  turnOver: 5,
  // Going through the deck again costs points
  redeal: { 1: -100, 3: -20 },
  // Every 10 seconds costs 2 points
  timePenalty: -2,
};

const BACKS = {
  blue: 'Blue Weave',
  red: 'Red Diamonds',
  pigeon: 'Pigeon',
};

// context comes from the desktop:
//   onClose - runs something when the window closes
export function createApp(context) {
  const root = document.createElement('div');
  root.className = 'solitaire';
  // Lets the window receive key presses (F2 or N, Ctrl+Z)
  root.tabIndex = -1;

  root.innerHTML = `
    <div class="menu-bar">
      <div class="menu">
        <button class="menu-title"><u>G</u>ame</button>
        <div class="menu-items">
          <button data-command="deal"><u>D</u>eal</button>
          <button data-command="undo"><u>U</u>ndo</button>
          <div class="menu-separator"></div>
          <button data-command="draw:1">Draw <u>O</u>ne</button>
          <button data-command="draw:3">Draw <u>T</u>hree</button>
          <div class="menu-separator"></div>
          <button data-command="best">Best <u>S</u>core...</button>
        </div>
      </div>
      <div class="menu">
        <button class="menu-title">D<u>e</u>ck</button>
        <div class="menu-items">
          ${Object.entries(BACKS).map(([id, label]) => `
            <button data-command="back:${id}">${label}</button>
          `).join('')}
        </div>
      </div>
    </div>

    <div class="sol-table"></div>

    <div class="status-bar">
      <div class="status-field" data-status="score"></div>
      <div class="status-field" data-status="time"></div>
    </div>
  `;

  const saved = loadSaved();
  const game = {
    root,
    table: root.querySelector('.sol-table'),
    drawCount: saved.draw === 1 ? 1 : 3,
    back: BACKS[saved.back] ? saved.back : 'blue',
    best: saved.best ?? null,
    timer: null,
    cascade: null,
  };

  buildTable(game);
  deal(game);

  setUpMenuBar(root.querySelector('.menu-bar'), (command) => {
    if (command === 'deal') deal(game);
    if (command === 'undo') undo(game);
    if (command === 'best') showBestScore(game);
    if (command.startsWith('draw:')) changeDrawCount(game, Number(command.slice('draw:'.length)));
    if (command.startsWith('back:')) {
      game.back = command.slice('back:'.length);
      save(game);
      render(game);
    }
  });

  setUpDragging(game);

  // Right-click the table: send every card that can go up to the
  // suit piles
  game.table.addEventListener('contextmenu', (event) => {
    event.preventDefault();
    if (game.state === 'won') return;
    autoPlay(game);
  });

  root.addEventListener('keydown', (event) => {
    if (root.querySelector('.dialog-overlay')) return;
    const ctrl = event.ctrlKey || event.metaKey;

    if (game.cascade) {
      stopCascade(game);
      return;
    }
    // F2 deals, like Windows. On a Mac, F2 changes the screen
    // brightness unless you hold fn, so N does it too.
    if (event.key === 'F2' || (event.key.toLowerCase() === 'n' && !ctrl && !event.altKey)) {
      event.preventDefault();
      deal(game);
    }
    if (ctrl && event.key.toLowerCase() === 'z') {
      event.preventDefault();
      undo(game);
    }
  });

  // A bigger window spreads the piles out
  const resizeObserver = new ResizeObserver(() => {
    if (game.cascade) stopCascade(game);
    render(game);
  });
  resizeObserver.observe(game.table);

  context.onClose(() => {
    stopTimer(game);
    cancelCascade(game);
    resizeObserver.disconnect();
  });

  return root;
}

// ---------- The table ----------

// The outlines where piles go, and one element for each card.
// They are made once; render() moves them around.
function buildTable(game) {
  game.slots = {};
  for (const key of pileKeys()) {
    const slot = document.createElement('div');
    slot.className = 'sol-slot';
    slot.dataset.pile = key;
    game.slots[key] = slot;
    game.table.append(slot);
  }

  game.cardEls = Array.from({ length: 52 }, (_, id) => {
    const el = document.createElement('div');
    el.className = 'sol-card';
    el.dataset.id = id;
    game.table.append(el);
    return el;
  });
}

// Every pile has a name: 'stock' (the deck), 'waste' (the cards
// turned over from it), 'foundation0'-'foundation3' (the suit piles)
// and 'tableau0'-'tableau6' (the seven piles below).
function pileKeys() {
  return [
    'stock', 'waste',
    ...[0, 1, 2, 3].map((i) => `foundation${i}`),
    ...[0, 1, 2, 3, 4, 5, 6].map((i) => `tableau${i}`),
  ];
}

// ---------- Dealing ----------

function deal(game) {
  stopTimer(game);
  cancelCascade(game);
  game.table.querySelector('.sol-cascade')?.remove();

  // Shuffle
  const deck = Array.from({ length: 52 }, (_, id) => id);
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }

  // Each card in a pile is { id, up }, up meaning face up
  const piles = Object.fromEntries(pileKeys().map((key) => [key, []]));
  for (let i = 0; i < 7; i++) {
    for (let j = i; j < 7; j++) {
      piles[`tableau${j}`].push({ id: deck.pop(), up: j === i });
    }
  }
  piles.stock = deck.map((id) => ({ id, up: false }));

  Object.assign(game, {
    piles,
    // How many turned cards are fanned out on the waste pile
    wasteFan: 0,
    score: 0,
    seconds: 0,
    // 'ready' until the first move, then 'playing', then 'won'
    state: 'ready',
    // Game.drawCount can change mid-game from the menu; this is the
    // number this game is played with
    dealtDrawCount: game.drawCount,
    history: [],
  });

  for (const el of game.cardEls) el.classList.remove('is-gone');
  render(game);
}

async function changeDrawCount(game, count) {
  if (count === game.drawCount) return;

  // Like Windows, the new setting starts a new game. A game being
  // played is only thrown away if you say so.
  if (game.state === 'playing') {
    const ok = await showConfirmDialog(game.root, {
      title: 'Solitaire',
      message: `Start a new game with Draw ${count === 1 ? 'One' : 'Three'}?`,
      confirmLabel: 'Yes',
      cancelLabel: 'No',
    });
    game.root.focus({ preventScroll: true });
    if (!ok) return;
  }

  game.drawCount = count;
  save(game);
  deal(game);
}

// ---------- Moves ----------

// Remembers how things are now, so Undo can go back to it
function remember(game) {
  game.history.push({
    piles: structuredClone(game.piles),
    wasteFan: game.wasteFan,
    score: game.score,
  });
  // Plenty of undo, without keeping every move of a very long game
  if (game.history.length > 200) game.history.shift();
}

function undo(game) {
  if (game.state === 'won' || game.history.length === 0) return;
  Object.assign(game, game.history.pop());
  render(game);
}

// The first move starts the clock
function startPlaying(game) {
  if (game.state !== 'ready') return;
  game.state = 'playing';
  startTimer(game);
}

// Clicking the deck turns over one or three cards. An empty deck
// takes the turned cards back, to go through them again.
function drawFromStock(game) {
  const { stock, waste } = game.piles;
  if (stock.length === 0 && waste.length === 0) return;

  startPlaying(game);
  remember(game);

  if (stock.length === 0) {
    while (waste.length > 0) stock.push({ id: waste.pop().id, up: false });
    game.wasteFan = 0;
    addScore(game, SCORE.redeal[game.dealtDrawCount]);
  } else {
    const count = Math.min(game.dealtDrawCount, stock.length);
    for (let i = 0; i < count; i++) waste.push({ id: stock.pop().id, up: true });
    game.wasteFan = count;
  }
  render(game);
}

// Can these cards (the first one on top of the others) be put on
// the pile called key?
function canDrop(game, cards, key) {
  const pile = game.piles[key];
  const top = pile[pile.length - 1];
  const first = cards[0].id;

  if (key.startsWith('foundation')) {
    if (cards.length !== 1) return false;
    if (!top) return rankOf(first) === 1;
    return suitOf(top.id) === suitOf(first) && rankOf(first) === rankOf(top.id) + 1;
  }

  if (key.startsWith('tableau')) {
    if (!top) return rankOf(first) === 13;
    return top.up && isRed(top.id) !== isRed(first) && rankOf(first) === rankOf(top.id) - 1;
  }

  return false;
}

// Moves the last count cards of one pile onto another, and scores it.
// The caller has already checked the move is allowed, and called
// remember() so it can be undone.
function moveCards(game, from, count, to) {
  const source = game.piles[from];
  const cards = source.splice(source.length - count, count);
  game.piles[to].push(...cards);

  const toFoundation = to.startsWith('foundation');
  if (from === 'waste') {
    addScore(game, toFoundation ? SCORE.toFoundation : SCORE.wasteToPile);
    game.wasteFan = Math.max(game.wasteFan - 1, 1);
  } else if (from.startsWith('tableau') && toFoundation) {
    addScore(game, SCORE.toFoundation);
  } else if (from.startsWith('foundation') && to.startsWith('tableau')) {
    addScore(game, SCORE.fromFoundation);
  }

  // A face-down card left on top of a pile turns over by itself
  const newTop = source[source.length - 1];
  if (from.startsWith('tableau') && newTop && !newTop.up) {
    newTop.up = true;
    addScore(game, SCORE.turnOver);
  }
}

// Where the top card of a pile can go up to its suit pile, if anywhere
function foundationFor(game, from) {
  const pile = game.piles[from];
  const top = pile[pile.length - 1];
  if (!top || !top.up) return null;

  for (let i = 0; i < 4; i++) {
    if (canDrop(game, [top], `foundation${i}`)) return `foundation${i}`;
  }
  return null;
}

// Double-click: send the card up to its suit pile
function sendHome(game, from) {
  const to = foundationFor(game, from);
  if (!to) return;

  startPlaying(game);
  remember(game);
  moveCards(game, from, 1, to);
  render(game);
  checkWin(game);
}

// Right-click: send up every card that can go, over and over, until
// none can. It all counts as one move for Undo.
function autoPlay(game) {
  const sources = ['waste', ...[0, 1, 2, 3, 4, 5, 6].map((i) => `tableau${i}`)];
  let remembered = false;
  let moved = true;

  while (moved) {
    moved = false;
    for (const from of sources) {
      const to = foundationFor(game, from);
      if (!to) continue;

      if (!remembered) {
        startPlaying(game);
        remember(game);
        remembered = true;
      }
      moveCards(game, from, 1, to);
      moved = true;
    }
  }

  if (remembered) {
    render(game);
    checkWin(game);
  }
}

function addScore(game, points) {
  game.score = Math.max(0, game.score + points);
}

// ---------- Dragging ----------

// Where a card is: the name of its pile, and its place in the pile
function findCard(game, id) {
  for (const [key, pile] of Object.entries(game.piles)) {
    const index = pile.findIndex((card) => card.id === id);
    if (index !== -1) return { key, index };
  }
  return null;
}

function setUpDragging(game) {
  const { table } = game;

  table.addEventListener('pointerdown', (event) => {
    game.root.focus({ preventScroll: true });
    // Stop the browser moving focus itself: a card turned over here
    // gets a new picture, and focus would be lost with the old one
    // (then keys like F2 and Ctrl+Z stop working)
    event.preventDefault();
    if (event.button !== 0) return;

    // Clicking during the bouncing cards stops them
    if (game.cascade) {
      stopCascade(game);
      return;
    }
    if (game.state === 'won') return;

    const cardEl = event.target.closest('.sol-card');
    const slotEl = event.target.closest('.sol-slot');

    // The deck, or its empty outline
    if ((slotEl && slotEl.dataset.pile === 'stock')
      || (cardEl && findCard(game, Number(cardEl.dataset.id)).key === 'stock')) {
      drawFromStock(game);
      return;
    }
    if (!cardEl) return;

    const { key, index } = findCard(game, Number(cardEl.dataset.id));
    const pile = game.piles[key];
    const isTop = index === pile.length - 1;

    // Only face-up cards move: from the waste and suit piles just the
    // top one, from the seven piles a card and everything on it
    if (!pile[index].up) return;
    if (key !== 'waste' && !key.startsWith('tableau') && !key.startsWith('foundation')) return;
    if (!key.startsWith('tableau') && !isTop) return;

    startDrag(game, event, key, index, cardEl);
  });
}

function startDrag(game, event, key, index, cardEl) {
  const { table } = game;
  const scale = measureScale(table);
  const startX = event.clientX;
  const startY = event.clientY;
  const cards = game.piles[key].slice(index);
  const els = cards.map((card) => game.cardEls[card.id]);
  const starts = cards.map((card) => game.positions.get(card.id));
  let dragging = false;

  table.setPointerCapture(event.pointerId);

  function onMove(moveEvent) {
    const dx = (moveEvent.clientX - startX) / scale;
    const dy = (moveEvent.clientY - startY) / scale;

    if (!dragging) {
      if (Math.hypot(moveEvent.clientX - startX, moveEvent.clientY - startY) < DRAG_THRESHOLD) return;
      dragging = true;
      els.forEach((el, i) => {
        el.classList.add('is-dragging');
        el.style.zIndex = 1000 + i;
      });
    }

    els.forEach((el, i) => placeElement(el, starts[i].x + dx, starts[i].y + dy));
  }

  function onEnd(endEvent) {
    table.removeEventListener('pointermove', onMove);
    table.removeEventListener('pointerup', onEnd);
    table.removeEventListener('pointercancel', onEnd);
    els.forEach((el) => el.classList.remove('is-dragging'));

    if (!dragging) {
      // A click. The second quick click on a top card sends it home.
      if (endEvent.type === 'pointerup' && index === game.piles[key].length - 1
        && isDoubleClick(cardEl)) {
        sendHome(game, key);
      }
      return;
    }

    const x = starts[0].x + (endEvent.clientX - startX) / scale;
    const y = starts[0].y + (endEvent.clientY - startY) / scale;
    const to = endEvent.type === 'pointerup' ? dropTarget(game, cards, key, x, y) : null;

    if (to) {
      startPlaying(game);
      remember(game);
      moveCards(game, key, cards.length, to);
    }
    // Moved, or put back where it came from
    render(game);
    if (to) checkWin(game);
  }

  table.addEventListener('pointermove', onMove);
  table.addEventListener('pointerup', onEnd);
  table.addEventListener('pointercancel', onEnd);
}

// The pile the dragged cards were dropped on: of the piles they
// may go on, the one the top dragged card overlaps the most
function dropTarget(game, cards, from, x, y) {
  let best = null;
  let bestOverlap = 0;

  for (const key of pileKeys()) {
    if (key === from || key === 'stock' || key === 'waste') continue;

    // The pile's top card, or its outline when it's empty
    const pile = game.piles[key];
    const top = pile[pile.length - 1];
    const spot = top ? game.positions.get(top.id) : game.slotPositions[key];

    const overlapX = Math.min(x, spot.x) + CARD_WIDTH - Math.max(x, spot.x);
    const overlapY = Math.min(y, spot.y) + CARD_HEIGHT - Math.max(y, spot.y);
    const overlap = Math.max(0, overlapX) * Math.max(0, overlapY);

    if (overlap > bestOverlap && canDrop(game, cards, key)) {
      best = key;
      bestOverlap = overlap;
    }
  }
  return best;
}

// How many screen pixels one virtual pixel is right now
function measureScale(container) {
  const probe = document.createElement('div');
  probe.style.cssText = 'position: absolute; visibility: hidden; width: calc(var(--px) * 100);';
  container.append(probe);
  const scale = probe.getBoundingClientRect().width / 100;
  probe.remove();
  return scale || 1;
}

// ---------- Drawing ----------

function placeElement(el, x, y) {
  el.style.left = `calc(var(--px) * ${x})`;
  el.style.top = `calc(var(--px) * ${y})`;
}

// Works out where every pile and card goes for the table's size,
// then moves the elements there
function render(game) {
  const scale = measureScale(game.table);
  const width = game.table.clientWidth / scale;
  const height = game.table.clientHeight / scale;

  // The seven columns spread evenly across the table
  const gap = Math.max(4, (width - 7 * CARD_WIDTH) / 8);
  const columnX = (column) => gap + column * (CARD_WIDTH + gap);

  const slotPositions = {
    stock: { x: columnX(0), y: TOP },
    waste: { x: columnX(1), y: TOP },
  };
  for (let i = 0; i < 4; i++) slotPositions[`foundation${i}`] = { x: columnX(3 + i), y: TOP };
  for (let i = 0; i < 7; i++) slotPositions[`tableau${i}`] = { x: columnX(i), y: PILES_TOP };

  const positions = new Map();
  let z = 1;
  for (const key of pileKeys()) {
    const pile = game.piles[key];
    const base = slotPositions[key];
    const upStep = key.startsWith('tableau') ? upStepFor(pile, height) : 0;
    let y = base.y;

    pile.forEach((card, i) => {
      let x = base.x;

      if (key === 'stock' || key.startsWith('foundation')) {
        // A little thicker every ten cards, like a real stack
        x += Math.floor(i / 10) * 2;
        y = base.y + Math.floor(i / 10);
      } else if (key === 'waste') {
        // Draw Three fans out the cards turned over last
        const fanned = pile.length - i;
        if (fanned <= game.wasteFan) x += (game.wasteFan - fanned) * WASTE_STEP;
      } else if (i > 0) {
        y += pile[i - 1].up ? upStep : DOWN_STEP;
      }

      positions.set(card.id, { x, y, z: z++ });
    });
  }

  game.positions = positions;
  game.slotPositions = slotPositions;

  for (const [key, slot] of Object.entries(game.slots)) {
    placeElement(slot, slotPositions[key].x, slotPositions[key].y);
  }

  // The empty deck shows a circle when the turned cards can be
  // gone through again, and a cross when there are none left
  const stockSlot = game.slots.stock;
  const mark = game.piles.waste.length > 0 ? 'again' : 'none';
  if (stockSlot.dataset.mark !== mark) {
    stockSlot.dataset.mark = mark;
    stockSlot.innerHTML = STOCK_MARKS[mark];
  }

  for (const [key, pile] of Object.entries(game.piles)) {
    for (const card of pile) {
      const el = game.cardEls[card.id];
      const { x, y, z: cardZ } = positions.get(card.id);
      placeElement(el, x, y);
      el.style.zIndex = cardZ;

      const face = card.up ? `face${card.id}` : `back-${game.back}`;
      if (el.dataset.face !== face) {
        el.dataset.face = face;
        el.innerHTML = card.up ? cardFace(card.id) : cardBack(game.back);
      }
      el.classList.toggle('is-down', !card.up);
      el.dataset.pile = key;
    }
  }

  renderStatus(game);
  checkMenus(game);
}

// How far apart the face-up cards of a pile are: squeezed together
// when the pile would otherwise run off the bottom of the table
function upStepFor(pile, height) {
  const down = pile.filter((card) => !card.up).length;
  const up = pile.length - down;
  if (up < 2) return UP_STEP;

  const room = height - PILES_TOP - CARD_HEIGHT - 4 - down * DOWN_STEP;
  return Math.max(MIN_UP_STEP, Math.min(UP_STEP, room / (up - 1)));
}

function renderStatus(game) {
  game.root.querySelector('[data-status="score"]').textContent = `Score: ${game.score}`;
  game.root.querySelector('[data-status="time"]').textContent = `Time: ${game.seconds}`;
}

// Tick the chosen draw count and card back in the menus, and grey
// out Undo when there is nothing to undo
function checkMenus(game) {
  for (const item of game.root.querySelectorAll('[data-command^="draw:"]')) {
    item.classList.toggle('is-checked', item.dataset.command === `draw:${game.drawCount}`);
  }
  for (const item of game.root.querySelectorAll('[data-command^="back:"]')) {
    item.classList.toggle('is-checked', item.dataset.command === `back:${game.back}`);
  }
  game.root.querySelector('[data-command="undo"]').disabled =
    game.history.length === 0 || game.state === 'won';
}

// ---------- The clock ----------

function startTimer(game) {
  stopTimer(game);
  game.timer = setInterval(() => {
    game.seconds++;
    if (game.seconds % 10 === 0) addScore(game, SCORE.timePenalty);
    renderStatus(game);
  }, 1000);
}

function stopTimer(game) {
  clearInterval(game.timer);
  game.timer = null;
}

// ---------- Winning ----------

function checkWin(game) {
  const home = [0, 1, 2, 3].reduce((sum, i) => sum + game.piles[`foundation${i}`].length, 0);
  if (home < 52) return;

  game.state = 'won';
  stopTimer(game);

  // A bonus for finishing quickly (games under 30 seconds get none,
  // so it can't be huge)
  if (game.seconds >= 30) game.score += Math.round(700000 / game.seconds);

  game.newBest = game.best === null || game.score > game.best;
  if (game.newBest) {
    game.best = game.score;
    save(game);
  }

  render(game);
  startCascade(game);
}

// The cards leap off the suit piles one at a time, Kings first, and
// bounce across the table, leaving a trail behind them. They are
// drawn on a canvas laid over the table.
function startCascade(game) {
  const { table } = game;
  const scale = measureScale(table);
  const width = table.clientWidth / scale;
  const height = table.clientHeight / scale;

  const canvas = document.createElement('canvas');
  canvas.className = 'sol-cascade';
  const ratio = scale * (window.devicePixelRatio || 1);
  canvas.width = Math.round(width * ratio);
  canvas.height = Math.round(height * ratio);
  table.append(canvas);

  const ctx = canvas.getContext('2d');
  ctx.scale(ratio, ratio);

  // Kings first, from every suit pile in turn, then Queens...
  const order = [];
  for (let rank = 13; rank >= 1; rank--) {
    for (let i = 0; i < 4; i++) {
      const card = game.piles[`foundation${i}`][rank - 1];
      if (card) order.push(card.id);
    }
  }

  const images = new Map(order.map((id) => [id, svgImage(cardFace(id))]));
  let flying = null;

  function launchNext() {
    const id = order.shift();
    if (id === undefined) return false;

    const { x, y } = game.positions.get(id);
    game.cardEls[id].classList.add('is-gone');
    flying = {
      id,
      x,
      y,
      vx: (2 + Math.random() * 4) * (Math.random() < 0.5 ? -1 : 1),
      vy: -Math.random() * 8,
    };
    return true;
  }

  function frame() {
    if (!flying && !launchNext()) {
      finishCascade(game);
      return;
    }

    // Several steps each frame, so the show doesn't take all day
    for (let step = 0; step < 4 && flying; step++) {
      flying.vy += 0.5;
      flying.x += flying.vx;
      flying.y += flying.vy;

      // Bounce off the bottom of the table, a little lower each time
      if (flying.y > height - CARD_HEIGHT) {
        flying.y = height - CARD_HEIGHT;
        flying.vy = -flying.vy * 0.8;
      }

      const image = images.get(flying.id);
      if (image.complete) ctx.drawImage(image, flying.x, flying.y, CARD_WIDTH, CARD_HEIGHT);

      // Gone off the side: on to the next card
      if (flying.x < -CARD_WIDTH || flying.x > width) flying = null;
    }

    game.cascade.frame = requestAnimationFrame(frame);
  }

  game.cascade = { frame: requestAnimationFrame(frame) };
}

// A click or key press ends the bouncing early
function stopCascade(game) {
  if (!game.cascade) return;
  finishCascade(game);
}

// Stops the bouncing without asking anything (a new deal, or the
// window closing)
function cancelCascade(game) {
  if (!game.cascade) return;
  cancelAnimationFrame(game.cascade.frame);
  game.cascade = null;
}

// The bouncing is over: offer another game
async function finishCascade(game) {
  cancelCascade(game);

  const again = await showConfirmDialog(game.root, {
    title: 'Solitaire',
    message: `Congratulations, you won!\nScore: ${game.score}${game.newBest ? ' (your best yet!)' : ''}\n\nDeal again?`,
    confirmLabel: 'Yes',
    cancelLabel: 'No',
  });
  game.root.focus({ preventScroll: true });
  if (again) deal(game);
}

function svgImage(svg) {
  const image = new Image();
  image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  return image;
}

async function showBestScore(game) {
  await showConfirmDialog(game.root, {
    title: 'Solitaire',
    message: game.best === null
      ? 'No games won yet. Good luck!'
      : `Your best score: ${game.best}`,
    cancelLabel: null,
  });
  game.root.focus({ preventScroll: true });
}

// ---------- Card pictures ----------

// Each card is an SVG picture, 71 by 96. The same picture is used on
// the table and for the bouncing cards when you win.

const SUIT_SHAPES = {
  spades: '<path d="M5 0L9 4.3C10.6 6 9.8 8.8 7.4 8.8C6.5 8.8 5.8 8.4 5.4 7.8L6.3 10H3.7L4.6 7.8C4.2 8.4 3.5 8.8 2.6 8.8C.2 8.8-.6 6 1 4.3Z"/>',
  hearts: '<path d="M5 9.6L1 5.3C-.6 3.6.2.6 2.7.6C3.8.6 4.6 1.3 5 2.2C5.4 1.3 6.2.6 7.3.6C9.8.6 10.6 3.6 9 5.3Z"/>',
  diamonds: '<path d="M5 0L8.8 5L5 10L1.2 5Z"/>',
  clubs: '<circle cx="5" cy="2.6" r="2.3"/><circle cx="2.5" cy="6.1" r="2.3"/>'
    + '<circle cx="7.5" cy="6.1" r="2.3"/><path d="M4.3 5.5L3.6 10H6.4L5.7 5.5Z"/>',
};

// A suit symbol, size units wide, centred on (x, y). Upside down
// in the bottom half of the card, as on real cards.
function pip(suit, x, y, size, flip = false) {
  const scale = size / 10;
  const turn = flip ? ` rotate(180 ${x} ${y})` : '';
  return `<g transform="${turn} translate(${x - size / 2} ${y - size / 2}) scale(${scale})">${SUIT_SHAPES[suit]}</g>`;
}

// Where the suit symbols go on the number cards (columns and rows
// in card units)
const LEFT = 22;
const MIDDLE = 35.5;
const RIGHT = 49;
const ROW = { top: 20, third: 37, center: 48, twoThirds: 59, bottom: 76 };
const PIPS = {
  2: [[MIDDLE, ROW.top], [MIDDLE, ROW.bottom]],
  3: [[MIDDLE, ROW.top], [MIDDLE, ROW.center], [MIDDLE, ROW.bottom]],
  4: [[LEFT, ROW.top], [RIGHT, ROW.top], [LEFT, ROW.bottom], [RIGHT, ROW.bottom]],
};
PIPS[5] = [...PIPS[4], [MIDDLE, ROW.center]];
PIPS[6] = [...PIPS[4], [LEFT, ROW.center], [RIGHT, ROW.center]];
PIPS[7] = [...PIPS[6], [MIDDLE, 34]];
PIPS[8] = [...PIPS[7], [MIDDLE, 62]];
PIPS[9] = [
  [LEFT, ROW.top], [RIGHT, ROW.top], [LEFT, 38.7], [RIGHT, 38.7],
  [LEFT, 57.3], [RIGHT, 57.3], [LEFT, ROW.bottom], [RIGHT, ROW.bottom], [MIDDLE, ROW.center],
];
PIPS[10] = [...PIPS[9].slice(0, 8), [MIDDLE, 29.3], [MIDDLE, 66.7]];

// Little pictures for the Jack, Queen and King: a feathered cap,
// a tiara and a crown
const FACE_HATS = {
  11: '<path d="M26 34h19v5H26z" fill="#1a3fb0"/><path d="M40 34c2-8 8-11 10-10-3 2-5 6-6 10z" fill="#d00000"/>',
  12: '<path d="M27 38l2-6 4 3 2.5-6 2.5 6 4-3 2 6z" fill="#e8b400" stroke="#000" stroke-width=".6"/>'
    + '<circle cx="35.5" cy="33" r="1.4" fill="#d00000"/>',
  13: '<path d="M26 39v-9l4.5 4 5-7 5 7 4.5-4v9z" fill="#e8b400" stroke="#000" stroke-width=".6"/>'
    + '<path d="M26 37h19" stroke="#d00000" stroke-width="1.5"/>',
};

function cardFace(id) {
  const suit = SUITS[suitOf(id)];
  const rank = rankOf(id);
  const color = isRed(id) ? RED : '#000000';
  const label = RANKS[rank - 1];

  // The rank and a small suit in two corners, the other one upside down
  const corner = `
    <text x="8" y="13" text-anchor="middle" font-size="${label === '10' ? 10 : 12}"
      font-family="Arial, Helvetica, sans-serif" font-weight="bold"
      ${label === '10' ? 'letter-spacing="-1"' : ''}>${label}</text>
    ${pip(suit, 8, 20, 8)}`;

  let middle;
  if (rank === 1) {
    middle = pip(suit, 35.5, 48, 26);
  } else if (rank <= 10) {
    middle = PIPS[rank].map(([x, y]) => pip(suit, x, y, 12, y > ROW.center)).join('');
  } else {
    // Jack, Queen and King: a yellow panel with a hat, the letter
    // and the suit
    middle = `
      <rect x="17.5" y="14.5" width="36" height="67" fill="#fff4b0" stroke="${color}"/>
      ${FACE_HATS[rank]}
      <text x="35.5" y="60" text-anchor="middle" font-size="22"
        font-family="Georgia, 'Times New Roman', serif" font-weight="bold">${label}</text>
      ${pip(suit, 35.5, 71, 10)}`;
  }

  return `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 71 96" width="71" height="96" fill="${color}">
      <rect x=".5" y=".5" width="70" height="95" rx="4" fill="#ffffff" stroke="#000000"/>
      ${corner}
      <g transform="rotate(180 35.5 48)">${corner}</g>
      ${middle}
    </svg>`;
}

// The pigeon from Coo, for the Pigeon card back
const PIGEON = `
  <rect x="19" y="12" width="6" height="3" fill="#5f6678"/>
  <rect x="24" y="12" width="2" height="3" fill="#2a2d38"/>
  <rect x="7" y="10" width="13" height="1" fill="#a3abbd"/>
  <rect x="6" y="11" width="16" height="5" fill="#a3abbd"/>
  <rect x="7" y="16" width="14" height="2" fill="#a3abbd"/>
  <rect x="9" y="18" width="9" height="1" fill="#8d95a8"/>
  <rect x="6" y="11" width="5" height="5" fill="#bcc3d1"/>
  <rect x="11" y="11" width="9" height="5" fill="#7d8599"/>
  <rect x="13" y="13" width="5" height="1" fill="#2a2d38"/>
  <rect x="14" y="15" width="5" height="1" fill="#2a2d38"/>
  <rect x="10" y="19" width="1" height="2" fill="#e8708a"/>
  <rect x="9" y="21" width="3" height="1" fill="#e8708a"/>
  <rect x="14" y="19" width="1" height="2" fill="#e8708a"/>
  <rect x="13" y="21" width="3" height="1" fill="#e8708a"/>
  <rect x="5" y="8" width="6" height="1" fill="#5fa87a"/>
  <rect x="6" y="9" width="6" height="2" fill="#8a5fa8"/>
  <rect x="4" y="2" width="6" height="1" fill="#8d95a8"/>
  <rect x="3" y="3" width="8" height="4" fill="#8d95a8"/>
  <rect x="4" y="7" width="6" height="1" fill="#8d95a8"/>
  <rect x="1" y="5" width="2" height="1" fill="#3a3a3a"/>
  <rect x="2" y="4" width="1" height="1" fill="#f0f0f0"/>
  <rect x="5" y="4" width="2" height="2" fill="#ff8a1a"/>
  <rect x="5" y="4" width="1" height="1" fill="#111111"/>`;

// The patterns inside the white border of each card back
const BACK_PATTERNS = {
  blue: `
    <pattern id="sol-back-blue" width="6" height="6" patternUnits="userSpaceOnUse">
      <rect width="6" height="6" fill="#0000a8"/>
      <path d="M0 0L6 6M6 0L0 6" stroke="#5a5aff" stroke-width="1"/>
    </pattern>
    <rect x="4" y="4" width="63" height="88" fill="url(#sol-back-blue)"/>`,
  red: `
    <pattern id="sol-back-red" width="8" height="8" patternUnits="userSpaceOnUse">
      <rect width="8" height="8" fill="#a00000"/>
      <path d="M4 1L7 4L4 7L1 4Z" fill="#ff5a5a"/>
    </pattern>
    <rect x="4" y="4" width="63" height="88" fill="url(#sol-back-red)"/>`,
  pigeon: `
    <rect x="4" y="4" width="63" height="88" fill="#6fa8dc"/>
    <path d="M10 22h14v4H10zM45 70h16v4H45zM48 18h12v3H48z" fill="#ffffff"/>
    <svg x="7.5" y="30" width="56" height="48" viewBox="0 0 28 24" shape-rendering="crispEdges">${PIGEON}</svg>`,
};

function cardBack(back) {
  return `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 71 96" width="71" height="96">
      <rect x=".5" y=".5" width="70" height="95" rx="4" fill="#ffffff" stroke="#000000"/>
      ${BACK_PATTERNS[back]}
      <rect x="4.5" y="4.5" width="62" height="87" fill="none" stroke="#000000"/>
    </svg>`;
}

// The empty deck: a circle to go through the cards again, or a cross
const STOCK_MARKS = {
  again: `<svg viewBox="0 0 71 96"><circle cx="35.5" cy="48" r="18" fill="none" stroke="#00ff00" stroke-width="6"/></svg>`,
  none: `<svg viewBox="0 0 71 96"><path d="M20 32l31 32M51 32L20 64" stroke="#ff0000" stroke-width="6"/></svg>`,
};

// ---------- Remembering the settings and best score ----------

// localStorage can be missing or blocked (e.g. private browsing).
// Then the game still works; it just forgets when the page closes.

function loadSaved() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) ?? {};
  } catch {
    return {};
  }
}

function save(game) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      draw: game.drawCount, back: game.back, best: game.best,
    }));
  } catch {
    // Not kept, but the game carries on
  }
}
