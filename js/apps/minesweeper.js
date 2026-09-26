// Minesweeper: find every mine without stepping on one.
// Click a square to uncover it; a number says how many of the eight
// squares around it hide a mine. Right-click to plant a flag where
// you think a mine is. Clicking a number whose mines are all flagged
// uncovers the squares around it. The first click is always safe.

import { setUpMenuBar } from '../shell/menus.js';
import { showConfirmDialog } from '../shell/dialogs.js';

const LEVELS = {
  beginner:     { label: 'Beginner',     rows: 9,  cols: 9,  mines: 10 },
  intermediate: { label: 'Intermediate', rows: 16, cols: 16, mines: 40 },
  expert:       { label: 'Expert',       rows: 16, cols: 30, mines: 99 },
};

const STORAGE_KEY = 'anachron.minesweeper';

// Every square is 16 virtual pixels. The window is the board plus
// the frame around it: the borders, the counters and the menu bar.
const CELL = 16;
const FRAME_WIDTH = 30;
const FRAME_HEIGHT = 114;

// The yellow face on the button in the middle
const FACES = {
  smile: '<rect x="5" y="5" width="2" height="2"/><rect x="10" y="5" width="2" height="2"/>'
    + '<path d="M4.5 10.5q4 4 8 0" fill="none" stroke="#000"/>',
  surprised: '<rect x="5" y="5" width="2" height="2"/><rect x="10" y="5" width="2" height="2"/>'
    + '<circle cx="8.5" cy="11.5" r="2" fill="none" stroke="#000"/>',
  cool: '<path d="M2.5 5.5h12M3.5 6h4v2h-4zM9.5 6h4v2h-4z" stroke="#000"/>'
    + '<path d="M4.5 10.5q4 4 8 0" fill="none" stroke="#000"/>',
  dead: '<path d="M4 4l3 3M7 4l-3 3M10 4l3 3M13 4l-3 3" stroke="#000"/>'
    + '<path d="M4.5 13q4-4 8 0" fill="none" stroke="#000"/>',
};

const MINE = `
  <svg viewBox="0 0 12 12" shape-rendering="crispEdges">
    <path d="M6 0v12M0 6h12M2 2l8 8M10 2l-8 8" stroke="#000"/>
    <circle cx="6" cy="6" r="4" fill="#000"/>
    <rect x="4" y="4" width="2" height="2" fill="#fff"/>
  </svg>`;

const FLAG = `
  <svg viewBox="0 0 12 12" shape-rendering="crispEdges">
    <path d="M7 1L2 3.5 7 6z" fill="#f00"/>
    <path d="M7.5 1v8" stroke="#000"/>
    <path d="M4 9h7v2H2V10h2z" fill="#000"/>
  </svg>`;

// A crossed-out mine: a flag where there was no mine
const WRONG_FLAG = MINE.replace('</svg>', '<path d="M1 1l10 10M11 1L1 11" stroke="#f00" stroke-width="1.5"/></svg>');

// context comes from the desktop:
//   setSize - changes the window's size to fit the board
//   onClose - runs something when the window closes
export function createApp(context) {
  const root = document.createElement('div');
  root.className = 'minesweeper';
  // Lets the window receive key presses (F2)
  root.tabIndex = -1;

  root.innerHTML = `
    <div class="menu-bar">
      <div class="menu">
        <button class="menu-title"><u>G</u>ame</button>
        <div class="menu-items">
          <button data-command="new"><u>N</u>ew</button>
          <div class="menu-separator"></div>
          ${Object.entries(LEVELS).map(([id, level]) => `
            <button data-command="level:${id}">${level.label}</button>
          `).join('')}
          <div class="menu-separator"></div>
          <button data-command="best">Best <u>T</u>imes...</button>
        </div>
      </div>
    </div>

    <div class="mine-game">
      <div class="mine-header">
        <span class="mine-led" data-led="mines"></span>
        <button class="mine-face" aria-label="New game"></button>
        <span class="mine-led" data-led="time"></span>
      </div>
      <div class="mine-board"></div>
    </div>
  `;

  const saved = loadSaved();
  const game = {
    root,
    board: root.querySelector('.mine-board'),
    face: root.querySelector('.mine-face'),
    context,
    levelId: LEVELS[saved.level] ? saved.level : 'beginner',
    best: saved.best ?? {},
    timer: null,
  };

  newGame(game);

  setUpMenuBar(root.querySelector('.menu-bar'), (command) => {
    if (command === 'new') newGame(game);
    if (command === 'best') showBestTimes(game);

    // Choosing a level starts a new game at that level
    if (command.startsWith('level:')) {
      game.levelId = command.slice('level:'.length);
      save(game);
      newGame(game);
    }
  });

  setUpBoard(game);

  game.face.addEventListener('click', () => newGame(game));

  root.addEventListener('keydown', (event) => {
    if (root.querySelector('.dialog-overlay')) return;
    if (event.key === 'F2') {
      event.preventDefault();
      newGame(game);
    }
  });

  context.onClose(() => stopTimer(game));

  return root;
}

// ---------- Starting a game ----------

function newGame(game) {
  const level = LEVELS[game.levelId];
  stopTimer(game);

  Object.assign(game, {
    rows: level.rows,
    cols: level.cols,
    mines: level.mines,
    // 'ready' until the first click, then 'playing', then 'won' or 'lost'
    state: 'ready',
    seconds: 0,
    flags: 0,
    opened: 0,
    exploded: null,
    cells: Array.from({ length: level.rows * level.cols }, () => ({
      mine: false, count: 0, open: false, flag: false,
    })),
  });

  game.context.setSize(level.cols * CELL + FRAME_WIDTH, level.rows * CELL + FRAME_HEIGHT);
  game.board.style.gridTemplateColumns = `repeat(${level.cols}, calc(var(--px) * ${CELL}))`;
  game.board.replaceChildren(...game.cells.map((_, index) => {
    const cell = document.createElement('div');
    cell.className = 'mine-cell';
    cell.dataset.index = index;
    return cell;
  }));

  // Tick the chosen level in the menu
  for (const item of game.root.querySelectorAll('[data-command^="level:"]')) {
    item.classList.toggle('is-checked', item.dataset.command === `level:${game.levelId}`);
  }

  render(game);
}

// Hides the mines, keeping them away from the first square clicked
// and its neighbors, so the first click always opens up some room
function placeMines(game, firstIndex) {
  const safe = new Set([firstIndex, ...neighbors(game, firstIndex)]);
  const spots = game.cells.map((_, index) => index).filter((index) => !safe.has(index));

  for (let placed = 0; placed < game.mines; placed++) {
    const pick = placed + Math.floor(Math.random() * (spots.length - placed));
    [spots[placed], spots[pick]] = [spots[pick], spots[placed]];
    game.cells[spots[placed]].mine = true;
  }

  game.cells.forEach((cell, index) => {
    cell.count = neighbors(game, index).filter((n) => game.cells[n].mine).length;
  });
}

// The (up to eight) squares around a square
function neighbors(game, index) {
  const row = Math.floor(index / game.cols);
  const col = index % game.cols;
  const result = [];

  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      const r = row + dr;
      const c = col + dc;
      if ((dr || dc) && r >= 0 && r < game.rows && c >= 0 && c < game.cols) {
        result.push(r * game.cols + c);
      }
    }
  }
  return result;
}

// ---------- Playing ----------

function setUpBoard(game) {
  const { root, board } = game;

  // While the mouse button is held down on the board the face looks
  // worried, like the real thing
  board.addEventListener('pointerdown', (event) => {
    root.focus({ preventScroll: true });
    if (event.button !== 0 || isOver(game)) return;

    setFace(game, 'surprised');
    document.addEventListener('pointerup', () => setFace(game, faceFor(game)), { once: true });
  });

  board.addEventListener('click', (event) => {
    const index = cellIndex(event);
    if (index === null) return;

    if (game.cells[index].open) chord(game, index);
    else uncover(game, index);
    render(game);
  });

  // Right-click plants or removes a flag
  root.querySelector('.mine-game').addEventListener('contextmenu', (event) => {
    event.preventDefault();
    const index = cellIndex(event);
    if (index === null) return;

    toggleFlag(game, index);
    render(game);
  });
}

function cellIndex(event) {
  const cell = event.target.closest('.mine-cell');
  return cell ? Number(cell.dataset.index) : null;
}

function isOver(game) {
  return game.state === 'won' || game.state === 'lost';
}

function uncover(game, index) {
  const cell = game.cells[index];
  if (isOver(game) || cell.open || cell.flag) return;

  if (game.state === 'ready') {
    placeMines(game, index);
    game.state = 'playing';
    startTimer(game);
  }

  if (cell.mine) {
    game.exploded = index;
    endGame(game, false);
    return;
  }

  // An empty square (no mines around it) opens its neighbors too,
  // and so on, until the edge of the empty area
  const toOpen = [index];
  while (toOpen.length > 0) {
    const at = toOpen.pop();
    const next = game.cells[at];
    if (next.open || next.flag) continue;

    next.open = true;
    game.opened++;
    if (next.count === 0) {
      toOpen.push(...neighbors(game, at).filter((n) => !game.cells[n].open));
    }
  }

  if (game.opened === game.cells.length - game.mines) endGame(game, true);
}

// Clicking an uncovered number with the right number of flags around
// it uncovers all its other neighbors (a wrong flag loses the game)
function chord(game, index) {
  const cell = game.cells[index];
  if (isOver(game) || cell.count === 0) return;

  const around = neighbors(game, index);
  const flagged = around.filter((n) => game.cells[n].flag).length;
  if (flagged !== cell.count) return;

  for (const n of around) uncover(game, n);
}

function toggleFlag(game, index) {
  const cell = game.cells[index];
  if (isOver(game) || cell.open) return;

  cell.flag = !cell.flag;
  game.flags += cell.flag ? 1 : -1;
}

function endGame(game, won) {
  game.state = won ? 'won' : 'lost';
  stopTimer(game);

  // Winning flags every mine for you
  if (won) {
    for (const cell of game.cells) {
      if (cell.mine && !cell.flag) {
        cell.flag = true;
        game.flags++;
      }
    }
    render(game);
    checkBestTime(game);
  }
}

// ---------- The clock ----------

function startTimer(game) {
  game.seconds = 1;
  game.timer = setInterval(() => {
    // The counter only has three digits
    game.seconds = Math.min(game.seconds + 1, 999);
    renderCounters(game);
  }, 1000);
}

function stopTimer(game) {
  clearInterval(game.timer);
  game.timer = null;
}

// ---------- Drawing ----------

function render(game) {
  const lost = game.state === 'lost';

  game.cells.forEach((cell, index) => {
    const el = game.board.children[index];
    let className = 'mine-cell';
    let content = '';

    if (cell.open) {
      className += ' is-open';
      if (cell.count > 0) {
        className += ` count-${cell.count}`;
        content = String(cell.count);
      }
    } else if (lost && cell.mine && !cell.flag) {
      // Losing shows where the other mines were
      className += ' is-open';
      if (index === game.exploded) className += ' is-exploded';
      content = MINE;
    } else if (lost && cell.flag && !cell.mine) {
      className += ' is-open';
      content = WRONG_FLAG;
    } else if (cell.flag) {
      content = FLAG;
    }

    // Only touch squares that changed, so the board redraws quickly
    if (el.className !== className) el.className = className;
    if (el.dataset.content !== content) {
      el.dataset.content = content;
      el.innerHTML = content;
    }
  });

  renderCounters(game);
  setFace(game, faceFor(game));
}

function renderCounters(game) {
  const left = game.mines - game.flags;
  game.root.querySelector('[data-led="mines"]').textContent = formatLed(left);
  game.root.querySelector('[data-led="time"]').textContent = formatLed(game.seconds);
}

// Three digits, like 007. Too many flags shows a minus, like -05.
function formatLed(value) {
  if (value < 0) return `-${String(Math.min(-value, 99)).padStart(2, '0')}`;
  return String(Math.min(value, 999)).padStart(3, '0');
}

function faceFor(game) {
  if (game.state === 'won') return 'cool';
  if (game.state === 'lost') return 'dead';
  return 'smile';
}

function setFace(game, face) {
  if (game.face.dataset.face === face) return;
  game.face.dataset.face = face;
  game.face.innerHTML = `
    <svg viewBox="0 0 17 17">
      <circle cx="8.5" cy="8.5" r="8" fill="#ff0" stroke="#000"/>
      ${FACES[face]}
    </svg>`;
}

// ---------- Best times ----------

async function checkBestTime(game) {
  const level = LEVELS[game.levelId];
  const best = game.best[game.levelId];
  if (best !== undefined && best <= game.seconds) return;

  game.best[game.levelId] = game.seconds;
  save(game);

  await showConfirmDialog(game.root, {
    title: 'Minesweeper',
    message: `You have the fastest time for ${level.label.toLowerCase()} level: ${plural(game.seconds)}!`,
    cancelLabel: null,
  });
  game.root.focus({ preventScroll: true });
}

async function showBestTimes(game) {
  const lines = Object.entries(LEVELS).map(([id, level]) => {
    const best = game.best[id];
    return `${level.label}: ${best === undefined ? 'no time yet' : plural(best)}`;
  });

  await showConfirmDialog(game.root, {
    title: 'Fastest Mine Sweepers',
    message: lines.join('\n'),
    cancelLabel: null,
  });
  game.root.focus({ preventScroll: true });
}

function plural(seconds) {
  return `${seconds} ${seconds === 1 ? 'second' : 'seconds'}`;
}

// ---------- Remembering the level and best times ----------

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
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ level: game.levelId, best: game.best }));
  } catch {
    // Not kept, but the game carries on
  }
}
