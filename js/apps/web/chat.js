// Cyber Cafe Chat: a chat room, the way they were: pick a nickname,
// and chat with whoever's there. The regulars are made up, but they
// chat among themselves, and answer when you say certain things.
// Nothing leaves ANACHRON.

import { escapeHtml } from './common.js';

// The regulars, each with a color for their name
const REGULARS = {
  SkaterBoi98: '#c00000',
  PixelPrincess: '#a000a0',
  ModemMike: '#006000',
  xX_Coo_Fan_Xx: '#0000c0',
};

// Things the regulars say now and then, whatever's going on
const CHATTER = [
  ['SkaterBoi98', 'anyone here play minesweeper on expert??'],
  ['PixelPrincess', 'just made my homepage purple. with stars. its beautiful'],
  ['ModemMike', 'brb, mom needs the phone'],
  ['xX_Coo_Fan_Xx', 'COO IS THE BEST PIGEON'],
  ['PixelPrincess', 'does anyone know how to make text blink'],
  ['SkaterBoi98', 'lol'],
  ['ModemMike', 'my modem just connected at 28.8!!! fastest ever'],
  ['xX_Coo_Fan_Xx', 'sign the guestbook on the fan club page pls'],
  ['PixelPrincess', 'solitaire cards bouncing = best part of the day'],
  ['SkaterBoi98', 'this chat is so 1997'],
  ['ModemMike', 'anyone else\'s page take 5 minutes to load or just me'],
];

// What the regulars answer when you say something with these words
const REPLIES = [
  { words: ['hi', 'hello', 'hey', 'yo', 'sup'], answers: [
    ['PixelPrincess', 'hi {name}!! :)'], ['SkaterBoi98', 'sup {name}'], ['ModemMike', 'welcome {name}'] ] },
  { words: ['asl'], answers: [['SkaterBoi98', 'lol nobody answers that anymore {name}']] },
  { words: ['bye', 'cya', 'gtg'], answers: [['PixelPrincess', 'bye {name}!! come back soon'], ['ModemMike', 'cya {name}']] },
  { words: ['coo', 'pigeon'], answers: [['xX_Coo_Fan_Xx', 'DID SOMEONE SAY COO'], ['xX_Coo_Fan_Xx', '{name} you have great taste']] },
  { words: ['lol', 'haha', 'rofl'], answers: [['SkaterBoi98', 'lol'], ['PixelPrincess', 'hehe']] },
  { words: ['weather', 'rain', 'sunny'], answers: [['ModemMike', 'check pixel-weather.web, its never wrong. well, sometimes']] },
  { words: ['game', 'games', 'play'], answers: [['SkaterBoi98', 'arcade-online.web has tic tac toe, i always lose']] },
  { words: ['modem', 'slow', 'internet'], answers: [['ModemMike', 'tell me about it. i can hear mine from here']] },
];

// Nicknames the regulars are using
const TAKEN = Object.keys(REGULARS).map((name) => name.toLowerCase());

const lobby = {
  title: 'Cyber Cafe Chat',
  keywords: 'cyber cafe chat room talk friends online people',
  render: () => `
    <div class="web-page web-chat">
      <h1>Cyber Cafe Chat</h1>
      <form class="web-chat-join">
        <p>Choose a nickname to enter the <b>#lobby</b> room:</p>
        <input class="web-input" name="nick" maxlength="16" spellcheck="false" value="Guest${100 + Math.floor(Math.random() * 900)}">
        <button class="push-button" type="submit">Enter Chat</button>
        <p class="web-small">Be nice. No shouting (TYPING IN CAPITALS).</p>
      </form>
      <div class="web-chat-room" hidden>
        <div class="web-chat-log" aria-live="polite"></div>
        <div class="web-chat-side">
          <b>In this room</b>
          <ul class="web-chat-people"></ul>
        </div>
        <form class="web-chat-say">
          <input class="web-input" name="line" maxlength="120" spellcheck="false" autocomplete="off" aria-label="Message">
          <button class="push-button" type="submit">Send</button>
        </form>
      </div>
    </div>`,
  // Returns what stops the chatter when the page is left
  setUp: (root) => {
    const join = root.querySelector('.web-chat-join');
    const room = root.querySelector('.web-chat-room');
    const log = root.querySelector('.web-chat-log');
    const timers = new Set();
    let nick = null;

    // Runs something later; leaving the page cancels it
    function later(ms, fn) {
      const timer = setTimeout(() => {
        timers.delete(timer);
        fn();
      }, ms);
      timers.add(timer);
    }

    // A line in the room. Everything is added as text, never HTML.
    function say(name, text, { system = false } = {}) {
      const line = document.createElement('div');
      line.className = system ? 'web-chat-line is-system' : 'web-chat-line';
      if (system) {
        line.textContent = `*** ${text}`;
      } else {
        const who = document.createElement('b');
        who.textContent = `<${name}> `;
        who.style.color = REGULARS[name] ?? '#000000';
        line.append(who, text);
      }
      log.append(line);
      log.scrollTop = log.scrollHeight;
    }

    // The regulars say something every few seconds
    function chatter() {
      const [name, text] = CHATTER[Math.floor(Math.random() * CHATTER.length)];
      say(name, text);
      later(5000 + Math.random() * 7000, chatter);
    }

    // Someone answers, if the line has a word they know
    function answer(text) {
      const words = text.toLowerCase().split(/[^a-z0-9']+/);
      const reply = REPLIES.find((r) => r.words.some((word) => words.includes(word)));
      if (!reply) return;
      const [name, line] = reply.answers[Math.floor(Math.random() * reply.answers.length)];
      later(1200 + Math.random() * 1500, () => say(name, line.replace('{name}', nick)));
    }

    join.addEventListener('submit', (event) => {
      event.preventDefault();
      const wanted = join.elements.nick.value.trim().replace(/\s+/g, '_');
      if (!wanted || TAKEN.includes(wanted.toLowerCase())) {
        join.querySelector('.web-small').textContent = 'Sorry, that nickname is taken. Try another!';
        return;
      }

      nick = wanted;
      join.hidden = true;
      room.hidden = false;
      root.querySelector('.web-chat-people').innerHTML = [...Object.keys(REGULARS), nick]
        .map((name) => `<li>${escapeHtml(name)}</li>`).join('');
      say(null, `You have joined #lobby as ${nick}`, { system: true });
      later(900, () => say('PixelPrincess', `hi ${nick}!`));
      later(4000, chatter);
      room.querySelector('[name="line"]').focus();
    });

    room.querySelector('.web-chat-say').addEventListener('submit', (event) => {
      event.preventDefault();
      const input = event.target.elements.line;
      const text = input.value.trim();
      if (!text) return;
      say(nick, text);
      input.value = '';

      if (text.length > 4 && text === text.toUpperCase() && /[A-Z]/.test(text)) {
        later(1000, () => say('ModemMike', `no need to shout ${nick} :)`));
      } else {
        answer(text);
      }
    });

    return () => timers.forEach((timer) => clearTimeout(timer));
  },
};

export const SITE = { 'www.cybercafe.web': { '/': lobby } };
