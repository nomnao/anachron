// Snake: steer the snake to eat the apples. Every apple makes it
// longer. Don't hit the walls or your own tail!
//
// - The arrow keys (or W A S D) steer. On a phone, swipe the board.
// - P or the space bar pauses. F2 starts a new game.
// - Three speeds in the Game menu; faster speeds score more per apple.
//
// The board is a tiny canvas, one canvas pixel per virtual pixel,
// drawn with chunky pixels in the greens of a handheld game screen.
// Making the window bigger (drag its edges, or maximize it) shows
// the same board, only bigger, so scores stay fair.

import { setUpMenuBar } from '../shell/menus.js';
import { showConfirmDialog } from '../shell/dialogs.js';

const STORAGE_KEY = 'anachron.snake';

// The board is COLS x ROWS squares of CELL virtual pixels
const COLS = 24;
const ROWS = 18;
const CELL = 12;

// How many milliseconds each step takes, and points per apple
const SPEEDS = {
  slow:   { label: 'Slow',   step: 250, points: 5 },
  medium: { label: 'Medium', step: 180, points: 10 },
  fast:   { label: 'Fast',   step: 120, points: 20 },
};

// Handheld-screen greens, lightest to darkest
const COLORS = {
  screen: '#9bbc0f',
  light: '#8bac0f',
  mid: '#306230',
  dark: '#0f380f',
};

const DIRECTIONS = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

const KEYS = {
  ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
  w: 'up', s: 'down', a: 'left', d: 'right',
};

// A finger has to move this far (in screen pixels) to count as a swipe
const SWIPE_DISTANCE = 20;

// context comes from the desktop:
//   onClose - runs something when the window closes
export function createApp(context) {
  const root = document.createElement('div');
  root.className = 'snake';
  // Lets the window receive key presses
  root.tabIndex = -1;

  root.innerHTML = `
    <div class="menu-bar">
      <div class="menu">
        <button class="menu-title"><u>G</u>ame</button>
        <div class="menu-items">
          <button data-command="new"><u>N</u>ew</button>
          <button data-command="pause"><u>P</u>ause</button>
          <div class="menu-separator"></div>
          ${Object.entries(SPEEDS).map(([id, speed]) => `
            <button data-command="speed:${id}">${speed.label}</button>
          `).join('')}
          <div class="menu-separator"></div>
          <button data-command="best">Best <u>S</u>cores...</button>
        </div>
      </div>
    </div>

    <div class="snake-area">
      <div class="snake-screen">
        <canvas class="snake-board" width="${COLS * CELL}" height="${ROWS * CELL}"></canvas>
        <p class="snake-message"></p>
      </div>
    </div>

    <div class="status-bar">
      <div class="status-field" data-status="score"></div>
      <div class="status-field" data-status="best"></div>
    </div>
  `;

  const saved = loadSaved();
  const game = {
    root,
    canvas: root.querySelector('.snake-board'),
    ctx: root.querySelector('.snake-board').getContext('2d'),
    message: root.querySelector('.snake-message'),
    speedId: SPEEDS[saved.speed] ? saved.speed : 'medium',
    best: saved.best ?? {},
    timer: null,
  };

  newGame(game);

  setUpMenuBar(root.querySelector('.menu-bar'), (command) => {
    if (command === 'new') newGame(game);
    if (command === 'pause') togglePause(game);
    if (command === 'best') showBestScores(game);

    // A new speed starts a new game at that speed
    if (command.startsWith('speed:')) {
      game.speedId = command.slice('speed:'.length);
      save(game);
      newGame(game);
    }
    root.focus({ preventScroll: true });
  });

  root.addEventListener('keydown', (event) => {
    if (root.querySelector('.dialog-overlay')) return;
    if (event.ctrlKey || event.metaKey || event.altKey) return;

    const direction = KEYS[event.key] ?? KEYS[event.key.toLowerCase()];
    if (direction) {
      event.preventDefault();
      steer(game, direction);
    } else if (event.key === 'F2') {
      event.preventDefault();
      newGame(game);
    } else if (event.key === ' ' || event.key.toLowerCase() === 'p') {
      event.preventDefault();
      togglePause(game);
    }
  });

  setUpSwipes(game);

  // Clicking anywhere in the window lets it hear the arrow keys again
  root.addEventListener('pointerdown', () => root.focus({ preventScroll: true }));

  // Ready to steer as soon as the window opens (once it's on screen)
  setTimeout(() => root.focus({ preventScroll: true }), 0);

  // Clicking another window pauses the game, so the snake doesn't
  // crash while you're not looking
  root.addEventListener('focusout', (event) => {
    if (!root.contains(event.relatedTarget) && game.state === 'playing') togglePause(game);
  });

  // A bigger window shows a bigger board
  const area = root.querySelector('.snake-area');
  const resizeObserver = new ResizeObserver(() => fitBoard(game, area));
  resizeObserver.observe(area);

  context.onClose(() => {
    stopTimer(game);
    resizeObserver.disconnect();
  });

  return root;
}

// ---------- Starting a game ----------

function newGame(game) {
  stopTimer(game);

  // A snake three squares long in the middle, heading right
  const y = Math.floor(ROWS / 2);
  const x = Math.floor(COLS / 3);
  Object.assign(game, {
    snake: [{ x, y }, { x: x - 1, y }, { x: x - 2, y }],
    direction: 'right',
    // Turns pressed but not yet made; quick presses (up then left)
    // are kept so none is lost between two steps
    turns: [],
    // Squares still to grow after eating
    growing: 0,
    apples: 0,
    score: 0,
    // 'ready' until the first key press, then 'playing', 'paused'
    // or 'over'
    state: 'ready',
  });
  placeApple(game);

  // Tick the chosen speed in the menu
  for (const item of game.root.querySelectorAll('[data-command^="speed:"]')) {
    item.classList.toggle('is-checked', item.dataset.command === `speed:${game.speedId}`);
  }

  showMessage(game, 'Press an arrow key to start');
  render(game);
}

// Puts the apple on a random square the snake isn't on
function placeApple(game) {
  const free = [];
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      if (!game.snake.some((part) => part.x === x && part.y === y)) free.push({ x, y });
    }
  }
  game.apple = free[Math.floor(Math.random() * free.length)] ?? null;
}

// ---------- Playing ----------

function steer(game, direction) {
  if (game.state === 'over') return;
  if (game.state === 'paused') togglePause(game);

  // Compare with the last turn waiting, or the way it's going now.
  // The snake can't turn straight back into itself.
  const last = game.turns[game.turns.length - 1] ?? game.direction;
  const opposite = DIRECTIONS[last].x === -DIRECTIONS[direction].x
    && DIRECTIONS[last].y === -DIRECTIONS[direction].y;
  if (direction !== last && !opposite && game.turns.length < 3) game.turns.push(direction);

  // The first press starts the game (but not by reversing into the tail)
  if (game.state === 'ready' && !opposite) {
    game.state = 'playing';
    showMessage(game, '');
    startTimer(game);
  }
}

function togglePause(game) {
  if (game.state === 'playing') {
    game.state = 'paused';
    stopTimer(game);
    showMessage(game, 'Paused\nPress P to carry on');
  } else if (game.state === 'paused') {
    game.state = 'playing';
    showMessage(game, '');
    startTimer(game);
  }
  game.root.querySelector('[data-command="pause"]').classList.toggle('is-checked', game.state === 'paused');
}

// Moves the snake one square
function step(game) {
  if (game.turns.length > 0) game.direction = game.turns.shift();
  const { x: dx, y: dy } = DIRECTIONS[game.direction];
  const head = { x: game.snake[0].x + dx, y: game.snake[0].y + dy };

  // The tail moves out of the way this step, unless the snake is growing
  const body = game.growing > 0 ? game.snake : game.snake.slice(0, -1);
  const hitWall = head.x < 0 || head.x >= COLS || head.y < 0 || head.y >= ROWS;
  const hitSelf = body.some((part) => part.x === head.x && part.y === head.y);
  if (hitWall || hitSelf) {
    gameOver(game);
    return;
  }

  game.snake.unshift(head);
  if (game.growing > 0) game.growing--;
  else game.snake.pop();

  if (game.apple && head.x === game.apple.x && head.y === game.apple.y) {
    game.apples++;
    game.score += SPEEDS[game.speedId].points;
    game.growing += 2;
    placeApple(game);

    // The whole board is snake: nothing left to eat
    if (!game.apple) {
      gameOver(game, true);
      return;
    }
  }

  render(game);
}

async function gameOver(game, filledBoard = false) {
  game.state = 'over';
  stopTimer(game);
  game.turns = [];
  render(game);

  const speed = SPEEDS[game.speedId];
  const best = game.best[game.speedId] ?? 0;
  const newBest = game.score > best;
  if (newBest) {
    game.best[game.speedId] = game.score;
    save(game);
    renderStatus(game);
  }

  const title = filledBoard ? 'You filled the board!' : 'Game Over';
  showMessage(game, `${title}\nPress F2 to play again`);

  if (newBest) {
    await showConfirmDialog(game.root, {
      title: 'Snake',
      message: `A new best score for ${speed.label.toLowerCase()} speed: ${game.score}!`,
      cancelLabel: null,
    });
    game.root.focus({ preventScroll: true });
  }
}

// Swiping the board steers the snake, for phones and tablets
function setUpSwipes(game) {
  const screen = game.root.querySelector('.snake-screen');
  let start = null;

  screen.addEventListener('pointerdown', (event) => {
    start = { x: event.clientX, y: event.clientY };
  });

  screen.addEventListener('pointermove', (event) => {
    if (!start) return;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < SWIPE_DISTANCE) return;

    if (Math.abs(dx) > Math.abs(dy)) steer(game, dx > 0 ? 'right' : 'left');
    else steer(game, dy > 0 ? 'down' : 'up');
    // Keep swiping from here without lifting the finger
    start = { x: event.clientX, y: event.clientY };
  });

  const end = () => { start = null; };
  screen.addEventListener('pointerup', end);
  screen.addEventListener('pointercancel', end);
}

// ---------- The clock ----------

function startTimer(game) {
  stopTimer(game);
  game.timer = setInterval(() => step(game), SPEEDS[game.speedId].step);
}

function stopTimer(game) {
  clearInterval(game.timer);
  game.timer = null;
}

// ---------- Drawing ----------

function render(game) {
  const { ctx } = game;
  // The canvas may have more pixels than the board (see fitBoard);
  // drawing is still done in board pixels
  ctx.setTransform(game.detail ?? 1, 0, 0, game.detail ?? 1, 0, 0);

  ctx.fillStyle = COLORS.screen;
  ctx.fillRect(0, 0, COLS * CELL, ROWS * CELL);

  // Faint dots where the squares meet, like an old LCD
  ctx.fillStyle = COLORS.light;
  for (let y = 1; y < ROWS; y++) {
    for (let x = 1; x < COLS; x++) ctx.fillRect(x * CELL, y * CELL, 1, 1);
  }

  if (game.apple) drawApple(ctx, game.apple.x * CELL, game.apple.y * CELL);

  // The body, tail first so the head is drawn on top
  const crashed = game.state === 'over';
  for (let i = game.snake.length - 1; i >= 1; i--) {
    drawBody(ctx, game.snake[i], game.snake[i - 1], i % 2 === 0);
  }
  drawHead(ctx, game.snake[0], game.direction, crashed);

  renderStatus(game);
}

// One body square, joined to the square in front of it so the snake
// looks like one long body rather than a row of beads
function drawBody(ctx, part, ahead, striped) {
  const x = part.x * CELL;
  const y = part.y * CELL;
  ctx.fillStyle = COLORS.dark;
  ctx.fillRect(x + 1, y + 1, CELL - 2, CELL - 2);

  // Fill the gap between this square and the next
  const dx = ahead.x - part.x;
  const dy = ahead.y - part.y;
  if (dx === 1) ctx.fillRect(x + CELL - 1, y + 1, 2, CELL - 2);
  if (dx === -1) ctx.fillRect(x - 1, y + 1, 2, CELL - 2);
  if (dy === 1) ctx.fillRect(x + 1, y + CELL - 1, CELL - 2, 2);
  if (dy === -1) ctx.fillRect(x + 1, y - 1, CELL - 2, 2);

  // A lighter pattern on every other square
  if (striped) {
    ctx.fillStyle = COLORS.mid;
    ctx.fillRect(x + 4, y + 4, CELL - 8, CELL - 8);
  }
}

function drawHead(ctx, head, direction, crashed) {
  const x = head.x * CELL;
  const y = head.y * CELL;
  ctx.fillStyle = COLORS.dark;
  ctx.fillRect(x, y, CELL, CELL);

  // Two eyes looking the way it's going (crosses once it has crashed)
  const { x: dx, y: dy } = DIRECTIONS[direction];
  const eyes = dx !== 0
    ? [{ x: dx > 0 ? 7 : 3, y: 3 }, { x: dx > 0 ? 7 : 3, y: 7 }]
    : [{ x: 3, y: dy > 0 ? 7 : 3 }, { x: 7, y: dy > 0 ? 7 : 3 }];
  ctx.fillStyle = COLORS.screen;
  for (const eye of eyes) {
    if (crashed) {
      ctx.fillRect(x + eye.x - 1, y + eye.y - 1, 1, 1);
      ctx.fillRect(x + eye.x + 1, y + eye.y - 1, 1, 1);
      ctx.fillRect(x + eye.x, y + eye.y, 1, 1);
      ctx.fillRect(x + eye.x - 1, y + eye.y + 1, 1, 1);
      ctx.fillRect(x + eye.x + 1, y + eye.y + 1, 1, 1);
    } else {
      ctx.fillRect(x + eye.x, y + eye.y, 2, 2);
    }
  }
}

// A little apple with a stalk and a leaf, 12 x 12
const APPLE = [
  '.....dd.....',
  '.....d.mm...',
  '....d..mm...',
  '..dddddddd..',
  '.dddddddddd.',
  '.ddmdddddddd',
  '.ddmdddddddd',
  '.dddddddddd.',
  '.dddddddddd.',
  '..dddddddd..',
  '...dd..dd...',
  '............',
];

function drawApple(ctx, x, y) {
  APPLE.forEach((row, py) => {
    [...row].forEach((pixel, px) => {
      if (pixel === '.') return;
      ctx.fillStyle = pixel === 'd' ? COLORS.dark : COLORS.mid;
      ctx.fillRect(x + px, y + py, 1, 1);
    });
  });
}

function renderStatus(game) {
  const best = game.best[game.speedId] ?? 0;
  game.root.querySelector('[data-status="score"]').textContent = `Score: ${game.score}`;
  game.root.querySelector('[data-status="best"]').textContent = `Best: ${best}`;
}

// Words over the middle of the board ('' hides them)
function showMessage(game, text) {
  game.message.textContent = text;
  game.message.hidden = !text;
}

// Makes the board as big as fits in the window. So the chunky pixels
// stay even at any size, the canvas gets a whole number of its own
// pixels for each board pixel, at least as many as the screen shows.
function fitBoard(game, area) {
  const screen = game.root.querySelector('.snake-screen');
  const border = screen.offsetWidth - game.canvas.offsetWidth;
  const probe = document.createElement('div');
  probe.style.cssText = 'position: absolute; visibility: hidden; width: calc(var(--px) * 100);';
  area.append(probe);
  const scale = probe.getBoundingClientRect().width / 100;
  probe.remove();
  if (!scale) return;

  const roomX = (area.clientWidth - border) / scale / (COLS * CELL);
  const roomY = (area.clientHeight - border) / scale / (ROWS * CELL);
  const zoom = Math.max(1, Math.min(roomX, roomY));
  game.root.style.setProperty('--snake-zoom', zoom);

  const detail = Math.ceil(zoom * scale * (window.devicePixelRatio || 1));
  if (detail !== game.detail) {
    game.detail = detail;
    // Changing the canvas size wipes it, so draw it again
    game.canvas.width = COLS * CELL * detail;
    game.canvas.height = ROWS * CELL * detail;
    render(game);
  }
}

async function showBestScores(game) {
  const lines = Object.entries(SPEEDS).map(([id, speed]) => {
    const best = game.best[id];
    return `${speed.label}: ${best === undefined ? 'no score yet' : best}`;
  });

  if (game.state === 'playing') togglePause(game);
  await showConfirmDialog(game.root, {
    title: 'Best Snake Scores',
    message: lines.join('\n'),
    cancelLabel: null,
  });
  game.root.focus({ preventScroll: true });
}

// ---------- Remembering the speed and best scores ----------

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
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ speed: game.speedId, best: game.best }));
  } catch {
    // Not kept, but the game carries on
  }
}
