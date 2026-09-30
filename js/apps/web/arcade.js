// Arcade Online: little games to play right in the web page.
// Tic-tac-toe against the computer, and Guess the Number.

import { link } from './common.js';

const ARCADE = 'http://www.arcade-online.web/';
const TIC_TAC_TOE = `${ARCADE}tictactoe.html`;
const GUESS = `${ARCADE}guess.html`;

// Your wins, losses and draws while ANACHRON is on
const score = { win: 0, lose: 0, draw: 0 };

const front = {
  title: 'Arcade Online',
  keywords: 'arcade online games play fun tic tac toe guess number',
  render: () => `
    <div class="web-page web-arcade">
      <h1 class="web-arcade-title">ARCADE ONLINE</h1>
      <p class="web-center">Insert coin to continue... just kidding, it's free!</p>
      <table class="web-table">
        <tr><th colspan="2">Games</th></tr>
        <tr><td>${link(TIC_TAC_TOE, 'Tic-Tac-Toe')}</td><td>Beat the computer at noughts and crosses. Good luck.</td></tr>
        <tr><td>${link(GUESS, 'Guess the Number')}</td><td>I'm thinking of a number from 1 to 100...</td></tr>
      </table>
      <p class="web-center web-small">More games coming soon! (Probably.)</p>
    </div>`,
};

// The eight lines of three
const LINES = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]];

function winnerOf(board) {
  for (const [a, b, c] of LINES) {
    if (board[a] && board[a] === board[b] && board[a] === board[c]) return board[a];
  }
  return board.every(Boolean) ? 'draw' : null;
}

// The computer (O): win if it can, block you if it must, then take
// the middle, then a corner, then anything
function computerMove(board) {
  const free = board.map((mark, i) => (mark ? null : i)).filter((i) => i !== null);
  const completes = (mark) => free.find((i) => {
    const next = [...board];
    next[i] = mark;
    return winnerOf(next) === mark;
  });

  // Now and then it doesn't notice your line, so it can be beaten
  const careful = Math.random() < 0.8;
  const win = completes('O');
  if (win !== undefined) return win;
  const block = completes('X');
  if (block !== undefined && careful) return block;
  if (free.includes(4)) return 4;
  const corners = [0, 2, 6, 8].filter((i) => free.includes(i));
  const choices = corners.length ? corners : free;
  return choices[Math.floor(Math.random() * choices.length)];
}

const ticTacToe = {
  title: 'Tic-Tac-Toe - Arcade Online',
  keywords: 'arcade tic tac toe noughts crosses game',
  render: () => `
    <div class="web-page web-arcade">
      <p>${link(ARCADE, '&lt; Back to the Arcade')}</p>
      <h1 class="web-arcade-title">TIC-TAC-TOE</h1>
      <p class="web-center">You are <b>X</b>. Get three in a row!</p>
      <div class="web-ttt">${'<button class="web-ttt-cell"></button>'.repeat(9)}</div>
      <p class="web-center web-ttt-status">Your move.</p>
      <p class="web-center"><button class="push-button" data-again>New Game</button></p>
      <p class="web-center web-small web-ttt-score"></p>
    </div>`,
  setUp: (root) => {
    const cells = [...root.querySelectorAll('.web-ttt-cell')];
    const status = root.querySelector('.web-ttt-status');
    let board;
    let over;
    let timer = null;

    function draw() {
      cells.forEach((cell, i) => {
        cell.textContent = board[i] ?? '';
        cell.className = `web-ttt-cell${board[i] ? ` is-${board[i].toLowerCase()}` : ''}`;
      });
      root.querySelector('.web-ttt-score').textContent =
        `Wins: ${score.win}   Losses: ${score.lose}   Draws: ${score.draw}`;
    }

    function finish(result) {
      over = true;
      if (result === 'X') { score.win++; status.textContent = 'You win! Nice one!'; }
      if (result === 'O') { score.lose++; status.textContent = 'The computer wins. Try again?'; }
      if (result === 'draw') { score.draw++; status.textContent = "It's a draw."; }
      draw();
    }

    function newGame() {
      clearTimeout(timer);
      board = Array(9).fill(null);
      over = false;
      status.textContent = 'Your move.';
      draw();
    }

    root.querySelector('.web-ttt').addEventListener('click', (event) => {
      const i = cells.indexOf(event.target.closest('.web-ttt-cell'));
      if (i === -1 || over || board[i] || timer) return;

      board[i] = 'X';
      draw();
      const result = winnerOf(board);
      if (result) {
        finish(result);
        return;
      }

      // The computer "thinks" for a moment
      status.textContent = 'Thinking...';
      timer = setTimeout(() => {
        timer = null;
        board[computerMove(board)] = 'O';
        const after = winnerOf(board);
        if (after) finish(after);
        else {
          status.textContent = 'Your move.';
          draw();
        }
      }, 400);
    });

    root.querySelector('[data-again]').addEventListener('click', newGame);
    newGame();
    return () => clearTimeout(timer);
  },
};

const guess = {
  title: 'Guess the Number - Arcade Online',
  keywords: 'arcade guess number game higher lower',
  render: () => `
    <div class="web-page web-arcade">
      <p>${link(ARCADE, '&lt; Back to the Arcade')}</p>
      <h1 class="web-arcade-title">GUESS THE NUMBER</h1>
      <p class="web-center">I'm thinking of a number from 1 to 100. Can you guess it?</p>
      <form class="web-search web-guess">
        <input class="web-input" name="guess" inputmode="numeric" maxlength="3" autocomplete="off" aria-label="Your guess">
        <button class="push-button" type="submit">Guess!</button>
      </form>
      <p class="web-center web-guess-hint"></p>
      <p class="web-center"><button class="push-button" data-again>Play Again</button></p>
    </div>`,
  setUp: (root) => {
    const form = root.querySelector('.web-guess');
    const hint = root.querySelector('.web-guess-hint');
    let secret;
    let tries;

    function newGame() {
      secret = 1 + Math.floor(Math.random() * 100);
      tries = 0;
      hint.textContent = 'Type a number and press Guess!';
      form.elements.guess.value = '';
    }

    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const value = Number(form.elements.guess.value);
      if (!Number.isInteger(value) || value < 1 || value > 100) {
        hint.textContent = 'Please type a whole number from 1 to 100.';
        return;
      }

      tries++;
      if (value < secret) hint.textContent = `${value} is too low. Higher!`;
      else if (value > secret) hint.textContent = `${value} is too high. Lower!`;
      else hint.textContent = `Yes! It was ${secret}. You got it in ${tries} ${tries === 1 ? 'try' : 'tries'}!`;
      form.elements.guess.select();
    });

    root.querySelector('[data-again]').addEventListener('click', newGame);
    newGame();
  },
};

export const SITE = {
  'www.arcade-online.web': { '/': front, '/tictactoe.html': ticTacToe, '/guess.html': guess },
};
