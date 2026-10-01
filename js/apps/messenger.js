// ChitChat Messenger: instant messages with your friends, the way
// it was around the year 2000.
//
// - Sign in with a display name and a status (Online, Busy, Away,
//   Appear Offline), and type a personal message for others to see.
// - Your contact list shows who's online. Friends sign in while
//   you're there, with a little pop-up in the corner.
// - Double-click a friend to chat in a window of its own. You'll see
//   when they're typing. Emoticons like :) turn into little faces.
// - Nudge shakes the conversation window. (Friends may nudge you too.)
//
// ANACHRON has no server, so the friends aren't real people: they're
// made up (see messenger-contacts.js) and answer by themselves.
// Nothing you type leaves your computer.

import { CONTACTS, replyTo, pick } from './messenger-contacts.js';
import { isDoubleClick } from '../shell/double-click.js';
import { playMessageChime, playSignIn, playNudge } from '../system/sound.js';

const STORAGE_KEY = 'anachron.messenger';

// Your status, and how each status is shown
const MY_STATUSES = { online: 'Online', busy: 'Busy', away: 'Away', offline: 'Appear Offline' };
const STATUS_LABELS = { online: 'Online', busy: 'Busy', away: 'Away', offline: 'Offline' };

// How long a pop-up stays in the corner, and how often you may nudge
const TOAST_MS = 5000;
const NUDGE_EVERY_MS = 5000;

// The emoticons, longest code first so ":D" isn't read as ":" "D".
// Each is a little face drawn in SVG.
const FACE = '<circle cx="8" cy="8" r="7" fill="#ffd800" stroke="#a07000"/>';
const EYES = '<rect x="5" y="5" width="2" height="2.5" fill="#000"/><rect x="9" y="5" width="2" height="2.5" fill="#000"/>';
const EMOTICONS = {
  ':)': `${FACE}${EYES}<path d="M4.5 9.5q3.5 3.5 7 0" fill="none" stroke="#000"/>`,
  ':(': `${FACE}${EYES}<path d="M4.5 12q3.5-3 7 0" fill="none" stroke="#000"/>`,
  ':D': `${FACE}${EYES}<path d="M4 9h8q-1 4-4 4t-4-4z" fill="#800000"/>`,
  ';)': `${FACE}<rect x="5" y="5" width="2" height="2.5" fill="#000"/><path d="M8.5 6.5h3" stroke="#000"/><path d="M4.5 9.5q3.5 3.5 7 0" fill="none" stroke="#000"/>`,
  ':P': `${FACE}${EYES}<path d="M4.5 10h7" stroke="#000"/><path d="M7 10h3v2q-1.5 1.5-3 0z" fill="#ff6080"/>`,
  ':O': `${FACE}${EYES}<circle cx="8" cy="11" r="2" fill="#800000"/>`,
  ':$': `${FACE}${EYES}<circle cx="4" cy="10" r="1.5" fill="#ff8080"/><circle cx="12" cy="10" r="1.5" fill="#ff8080"/><path d="M6 11h4" stroke="#000"/>`,
  'B)': `${FACE}<path d="M3 5.5h10v2h-4l-1 -1-1 1H3z" fill="#000"/><path d="M4.5 10q3.5 3 7 0" fill="none" stroke="#000"/>`,
  '<3': '<path d="M8 14L2.5 8.5C0.5 6.5 2 2.5 5 2.5c1.5 0 2.5 1 3 2 .5-1 1.5-2 3-2 3 0 4.5 4 2.5 6z" fill="#e02040" stroke="#800010"/>',
};
const EMOTICON_PATTERN = new RegExp(
  `(${Object.keys(EMOTICONS).sort((a, b) => b.length - a.length).map((code) => code.replace(/[()$]/g, '\\$&')).join('|')})`,
  'g',
);

// The one signed-in session (there's only one Messenger window).
// Friends' statuses and conversations last until you sign out.
let session = null;

// context comes from the desktop: openWindow, shake, onClose...
export function createApp(context) {
  const root = document.createElement('div');
  root.className = 'messenger';
  root.tabIndex = -1;

  context.onClose(() => signOut({ closing: true }));

  showSignIn(root, context);
  return root;
}

// ---------- Signing in and out ----------

function loadProfile() {
  try {
    return { name: '', status: 'online', message: '', ...JSON.parse(localStorage.getItem(STORAGE_KEY)) };
  } catch {
    return { name: '', status: 'online', message: '' };
  }
}

function saveProfile(me) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(me));
  } catch {
    // Not kept, but it works until the page closes
  }
}

function showSignIn(root, context) {
  const profile = loadProfile();
  root.innerHTML = `
    <div class="messenger-signin">
      ${LOGO}
      <p class="messenger-brand">ChitChat Messenger</p>
      <form class="messenger-signin-form">
        <label>Display name:
          <input class="messenger-input sunken-panel" name="name" maxlength="20" spellcheck="false">
        </label>
        <label>Status:
          <select class="messenger-input" name="status">
            ${Object.entries(MY_STATUSES).map(([id, label]) => `<option value="${id}">${label}</option>`).join('')}
          </select>
        </label>
        <button class="push-button" type="submit">Sign In</button>
        <p class="messenger-note"></p>
      </form>
    </div>`;

  const form = root.querySelector('.messenger-signin-form');
  form.elements.name.value = profile.name || 'Me';
  form.elements.status.value = MY_STATUSES[profile.status] ? profile.status : 'online';

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const name = form.elements.name.value.trim();
    if (!name) {
      form.querySelector('.messenger-note').textContent = 'Please type a display name.';
      return;
    }

    const me = { ...profile, name, status: form.elements.status.value };
    saveProfile(me);

    // Connecting takes a moment, with the logo spinning
    root.innerHTML = `
      <div class="messenger-signin is-signing-in">
        ${LOGO}
        <p>Signing in...</p>
      </div>`;
    setTimeout(() => {
      if (root.isConnected) signIn(root, context, me);
    }, 1500);
  });
}

function signIn(root, context, me) {
  session = {
    root,
    context,
    me,
    contacts: new Map(CONTACTS.map((contact) => [contact.id, { ...contact }])),
    // contact id -> { lines, unread, window, view, pending, lastNudge, awayReplied }
    conversations: new Map(),
    timers: new Set(),
    toast: null,
  };

  showContactList();
  startFriendsLives();
}

function signOut({ closing = false } = {}) {
  if (!session) return;
  const { root, context, conversations, timers } = session;

  timers.forEach((timer) => clearTimeout(timer));
  session.toast?.remove();
  const chatWindows = [...conversations.values()].map((conversation) => conversation.window).filter(Boolean);
  session = null;
  chatWindows.forEach((chatWindow) => chatWindow.close());

  if (!closing) showSignIn(root, context);
}

// Runs something later, unless you sign out first
function later(ms, fn) {
  const timer = setTimeout(() => {
    session?.timers.delete(timer);
    if (session) fn();
  }, ms);
  session.timers.add(timer);
}

// ---------- The contact list ----------

function showContactList() {
  const { root, me } = session;
  root.innerHTML = `
    <div class="messenger-me">
      <span class="messenger-avatar" data-avatar></span>
      <div class="messenger-me-text">
        <b class="messenger-me-name"></b>
        <select class="messenger-status" aria-label="Your status">
          ${Object.entries(MY_STATUSES).map(([id, label]) => `<option value="${id}">(${label})</option>`).join('')}
        </select>
        <input class="messenger-message" maxlength="40" spellcheck="false"
          placeholder="&lt;Type a personal message&gt;" aria-label="Personal message">
      </div>
    </div>
    <div class="messenger-list sunken-panel"></div>
    <div class="messenger-footer">
      <button class="push-button" data-sign-out>Sign Out</button>
    </div>`;

  const avatar = root.querySelector('[data-avatar]');
  avatar.textContent = me.name[0].toUpperCase();
  root.querySelector('.messenger-me-name').textContent = me.name;

  const status = root.querySelector('.messenger-status');
  status.value = me.status;
  status.addEventListener('change', () => {
    me.status = status.value;
    saveProfile(me);
    avatar.dataset.status = me.status;
  });
  avatar.dataset.status = me.status;

  const message = root.querySelector('.messenger-message');
  message.value = me.message;
  message.addEventListener('change', () => {
    me.message = message.value.trim();
    saveProfile(me);
  });

  root.querySelector('[data-sign-out]').addEventListener('click', () => signOut());

  // Double-click (or Enter) on a friend opens a conversation
  const list = root.querySelector('.messenger-list');
  list.addEventListener('click', (event) => {
    const row = event.target.closest('[data-contact]');
    if (row && isDoubleClick(row)) openConversation(row.dataset.contact);
  });
  list.addEventListener('keydown', (event) => {
    const row = event.target.closest('[data-contact]');
    if (row && event.key === 'Enter') openConversation(row.dataset.contact);
  });

  renderContacts();
}

// Draws the list again: online friends first, then offline ones
function renderContacts() {
  const list = session.root.querySelector('.messenger-list');
  if (!list) return;

  const all = [...session.contacts.values()];
  const groups = [
    ['Online', all.filter((contact) => contact.status !== 'offline')],
    ['Offline', all.filter((contact) => contact.status === 'offline')],
  ];

  list.replaceChildren(...groups.flatMap(([label, contacts]) => {
    const heading = document.createElement('p');
    heading.className = 'messenger-group';
    heading.textContent = `${label} (${contacts.length})`;

    const rows = contacts.map((contact) => {
      const row = document.createElement('button');
      row.className = 'messenger-contact';
      row.dataset.contact = contact.id;
      row.classList.toggle('is-unread', Boolean(session.conversations.get(contact.id)?.unread));
      row.innerHTML = `
        <span class="messenger-dot" data-status="${contact.status}"></span>
        <span class="messenger-contact-text">
          <span class="messenger-contact-name"></span>
          <span class="messenger-contact-message"></span>
        </span>`;
      const name = contact.status === 'online' ? contact.name : `${contact.name} (${STATUS_LABELS[contact.status]})`;
      row.querySelector('.messenger-contact-name').textContent = name;
      row.querySelector('.messenger-contact-message').textContent = contact.message;
      return row;
    });
    return [heading, ...rows];
  }));
}

// ---------- Friends doing things by themselves ----------

function startFriendsLives() {
  for (const contact of session.contacts.values()) {
    if (contact.becomes) later(contact.becomes.after, () => changeStatus(contact, contact.becomes));
    if (contact.opener) later(contact.opener.after, () => friendSays(contact, contact.opener.text, { opener: true }));
    if (contact.nudge) later(contact.nudge.after, () => friendNudges(contact));
  }
}

function changeStatus(contact, { status, message }) {
  const signingIn = contact.status === 'offline' && status !== 'offline';
  contact.status = status;
  if (message) contact.message = message;
  renderContacts();
  updateConversationHeader(contact.id);

  if (signingIn && !quiet()) {
    playSignIn();
    showToast(`${contact.name} has just signed in.`, contact.id);
  }
}

// Busy or Appear Offline: no pop-ups, and friends don't start chats
function quiet() {
  return session.me.status === 'busy' || session.me.status === 'offline';
}

// ---------- Conversations ----------

function conversationOf(id) {
  if (!session.conversations.has(id)) {
    session.conversations.set(id, {
      lines: [], unread: false, window: null, view: null, pending: null, lastNudge: 0, awayReplied: false,
    });
  }
  return session.conversations.get(id);
}

function openConversation(id) {
  const contact = session.contacts.get(id);
  const conversation = conversationOf(id);
  conversation.unread = false;
  renderContacts();

  if (conversation.window) {
    conversation.window.focus();
    return;
  }

  const view = buildConversation(contact, conversation);
  conversation.view = view;
  conversation.window = session.context.openWindow({
    key: id,
    title: `${contact.name} - Conversation`,
    width: 310,
    height: 290,
    minWidth: 260,
    minHeight: 230,
    content: view,
    onClose: () => {
      conversation.window = null;
      conversation.view = null;
    },
  });
  setTimeout(() => view.querySelector('.messenger-type')?.focus(), 0);
}

function buildConversation(contact, conversation) {
  const view = document.createElement('div');
  view.className = 'messenger-chat';
  view.tabIndex = -1;
  view.innerHTML = `
    <div class="messenger-chat-to">
      <span class="messenger-dot"></span>
      <span>To: <b class="messenger-chat-name"></b> <span class="messenger-chat-status"></span></span>
    </div>
    <div class="messenger-log sunken-panel" aria-live="polite"></div>
    <p class="messenger-typing"></p>
    <div class="messenger-tools">
      <button class="push-button messenger-smile" title="Emoticons">${emoticonSvg(':)')}</button>
      <button class="push-button" data-nudge title="Shake their window">Nudge</button>
      <div class="messenger-picker" hidden>
        ${Object.keys(EMOTICONS).map((code) => `<button data-code="${code}" title="${code}">${emoticonSvg(code)}</button>`).join('')}
      </div>
    </div>
    <form class="messenger-send">
      <textarea class="messenger-type sunken-panel" rows="2" maxlength="400" spellcheck="false" aria-label="Message"></textarea>
      <button class="push-button" type="submit">Send</button>
    </form>`;

  for (const line of conversation.lines) addLine(view, line);
  fillHeader(view, contact);

  const form = view.querySelector('.messenger-send');
  const input = form.querySelector('textarea');
  const send = () => {
    const text = input.value.trim();
    if (!text) return;
    input.value = '';
    youSay(contact, text);
  };
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    send();
  });
  // Enter sends; Shift+Enter starts a new line
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      send();
    }
  });

  const picker = view.querySelector('.messenger-picker');
  view.querySelector('.messenger-smile').addEventListener('click', () => {
    picker.hidden = !picker.hidden;
  });
  picker.addEventListener('click', (event) => {
    const button = event.target.closest('[data-code]');
    if (!button) return;
    // Put the emoticon's code where the cursor is
    const { selectionStart: start, selectionEnd: end, value } = input;
    input.value = `${value.slice(0, start)}${button.dataset.code}${value.slice(end)}`;
    input.selectionStart = input.selectionEnd = start + button.dataset.code.length;
    picker.hidden = true;
    input.focus();
  });

  view.querySelector('[data-nudge]').addEventListener('click', () => youNudge(contact));
  return view;
}

function fillHeader(view, contact) {
  view.querySelector('.messenger-dot').dataset.status = contact.status;
  view.querySelector('.messenger-chat-name').textContent = contact.name;
  view.querySelector('.messenger-chat-status').textContent =
    `(${STATUS_LABELS[contact.status]})${contact.message ? ` - ${contact.message}` : ''}`;
}

function updateConversationHeader(id) {
  const conversation = session.conversations.get(id);
  if (conversation?.view) fillHeader(conversation.view, session.contacts.get(id));
}

// Adds a line to a conversation, and shows it if its window is open.
// line: { from: 'me' | 'them' | 'system', name, text }
function record(id, line) {
  const conversation = conversationOf(id);
  conversation.lines.push(line);
  if (conversation.view) addLine(conversation.view, line);
}

function addLine(view, line) {
  const log = view.querySelector('.messenger-log');
  const entry = document.createElement('div');
  entry.className = `messenger-line is-${line.from}`;

  if (line.from === 'system') {
    entry.textContent = line.text;
  } else {
    const says = document.createElement('span');
    says.className = 'messenger-says';
    says.textContent = `${line.name} says:`;
    const text = document.createElement('div');
    text.className = 'messenger-text';
    writeWithEmoticons(text, line.text);
    entry.append(says, text);
  }

  log.append(entry);
  log.scrollTop = log.scrollHeight;
}

// Puts text into an element, with emoticon codes turned into faces.
// The text itself always goes in as text, never as HTML.
function writeWithEmoticons(element, text) {
  for (const part of text.split(EMOTICON_PATTERN)) {
    if (EMOTICONS[part]) {
      const face = document.createElement('span');
      face.className = 'messenger-emoticon';
      face.title = part;
      face.innerHTML = emoticonSvg(part);
      element.append(face);
    } else if (part) {
      element.append(part);
    }
  }
}

function emoticonSvg(code) {
  return `<svg viewBox="0 0 16 16">${EMOTICONS[code]}</svg>`;
}

function setTyping(id, typing) {
  const view = session.conversations.get(id)?.view;
  if (!view) return;
  const contact = session.contacts.get(id);
  view.querySelector('.messenger-typing').textContent = typing ? `${contact.name} is typing a message...` : '';
}

// ---------- Talking ----------

function youSay(contact, text) {
  const conversation = conversationOf(contact.id);
  record(contact.id, { from: 'me', name: session.me.name, text });

  if (contact.status === 'offline') {
    record(contact.id, { from: 'system', text: `${contact.name} is offline and can't reply right now.` });
    return;
  }

  // Away: an automatic answer, once
  if (contact.status === 'away') {
    if (!conversation.awayReplied && contact.awayReply) {
      conversation.awayReplied = true;
      later(700, () => friendSays(contact, contact.awayReply));
    }
    return;
  }

  // They read it, start typing, and answer the last thing you said
  clearTimeout(conversation.pending);
  session.timers.delete(conversation.pending);
  const thinking = 400 + Math.random() * 600;
  const typing = 1200 + Math.random() * 1600 + (contact.slow ? 3000 : 0);
  later(thinking, () => setTyping(contact.id, true));
  conversation.pending = setTimeout(() => {
    session?.timers.delete(conversation.pending);
    if (!session) return;
    setTyping(contact.id, false);
    friendSays(contact, replyTo(contact, text, session.me.name));
  }, thinking + typing);
  session.timers.add(conversation.pending);
}

// A friend sends you a message. If their window isn't open, a pop-up
// says so and their name goes bold in the list.
function friendSays(contact, text, { opener = false } = {}) {
  // Friends don't start chats while you're Busy or hidden
  if (opener && (quiet() || contact.status === 'offline')) return;

  const conversation = conversationOf(contact.id);
  const line = text.replaceAll('{name}', session.me.name);
  record(contact.id, { from: 'them', name: contact.name, text: line });
  playMessageChime();

  if (conversation.window) {
    conversation.window.callForAttention();
  } else {
    conversation.unread = true;
    renderContacts();
    if (!quiet()) showToast(`${contact.name} says:\n${line}`, contact.id);
  }
}

function youNudge(contact) {
  const conversation = conversationOf(contact.id);
  const now = Date.now();
  if (now - conversation.lastNudge < NUDGE_EVERY_MS) {
    record(contact.id, { from: 'system', text: 'You can\'t send nudges so often. Wait a few seconds.' });
    return;
  }

  conversation.lastNudge = now;
  record(contact.id, { from: 'system', text: 'You have just sent a nudge!' });
  conversation.window?.shake();
  playNudge();

  if (contact.status === 'online' || contact.status === 'busy') {
    later(1500, () => friendSays(contact, contact.nudgeReply));
  }
}

function friendNudges(contact) {
  if (quiet()) return;
  const conversation = conversationOf(contact.id);
  record(contact.id, { from: 'system', text: `${contact.name} has just sent you a nudge!` });
  playNudge();

  if (conversation.window) {
    conversation.window.shake();
    conversation.window.callForAttention();
  } else {
    // Shake the contact list instead, and say who it was
    session.context.shake();
    conversation.unread = true;
    renderContacts();
    showToast(`${contact.name} has just sent you a nudge!`, contact.id);
  }
  later(1200, () => friendSays(contact, contact.nudge.text));
}

// ---------- Pop-ups ----------

// A little box rising from the bottom-right corner of the screen.
// Clicking it opens that friend's conversation.
function showToast(text, contactId) {
  const desktop = session.root.closest('#desktop');
  if (!desktop) return;

  session.toast?.remove();
  const toast = document.createElement('button');
  toast.className = 'messenger-toast';
  toast.innerHTML = `<span class="messenger-toast-title">${LOGO}ChitChat Messenger</span><span class="messenger-toast-text"></span>`;
  toast.querySelector('.messenger-toast-text').textContent = text;
  toast.addEventListener('click', () => {
    toast.remove();
    if (session) openConversation(contactId);
  });
  desktop.append(toast);
  session.toast = toast;

  later(TOAST_MS, () => toast.remove());
}

// Two speech bubbles: ChitChat's logo
const LOGO = `
  <svg class="messenger-logo" viewBox="0 0 24 24" shape-rendering="crispEdges">
    <path d="M2.5 3.5h12v8h-7l-3 3v-3h-2z" fill="#3a8ee6" stroke="#000"/>
    <path d="M9.5 9.5h12v8h-2v3l-3-3h-7z" fill="#5cc85c" stroke="#000"/>
    <rect x="5" y="7" width="2" height="1" fill="#fff"/><rect x="8" y="7" width="2" height="1" fill="#fff"/>
    <rect x="13" y="13" width="2" height="1" fill="#fff"/><rect x="16" y="13" width="2" height="1" fill="#fff"/>
  </svg>`;
