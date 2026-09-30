// HotPost Mail: web mail. Read the messages in the inbox, and write
// your own. Mail to Coo gets an answer; mail to anyone else comes
// back, because this web has no one else to deliver it to.
// Mail is kept in this browser only; nothing is really sent.

import { link, escapeHtml, longDate, loadStored, saveStored } from './common.js';

const MAIL = 'http://www.hotpost.web/';
const COMPOSE = `${MAIL}compose.html`;
const SENT = `${MAIL}sent.html`;
const readUrl = (id) => `${MAIL}read?id=${id}`;

const STORAGE_KEY = 'anachron.webmail';
const COO = 'coo@anachron.web';

// The mail already waiting in a new inbox
const WELCOME_MAIL = [
  { id: 1, from: 'welcome@hotpost.web', subject: 'Welcome to HotPost Mail!', date: 'Monday',
    body: 'Hi there!\n\nThanks for choosing HotPost, the hottest free email on the web. You get a whole 2 MB of space for your mail!\n\nTo write a message, click Compose.\n\nThe HotPost Team' },
  { id: 2, from: COO, subject: 'Coo coo!', date: 'Tuesday',
    body: 'Hello friend,\n\nIt\'s me, Coo! I\'ve got my own email address now: coo@anachron.web. Write to me any time, I always write back.\n\nCoo' },
  { id: 3, from: 'webmaster@megamall.web', subject: 'SALE!!! Floppy disks HALF PRICE', date: 'Wednesday',
    body: 'Dear valued shopper,\n\nThis week only at Mega Mall Online: stock up on floppy disks!\n\nVisit www.megamall.web\n\n(To stop getting these emails, write to us by post.)' },
  { id: 4, from: 'pixelprincess@geovillage.web', subject: 'FWD: FWD: FWD: send this to 10 friends', date: 'Thursday',
    body: 'OMG you have to read this!!!\n\nSend this email to 10 friends in the next 10 minutes and your computer will run twice as fast!!!\n\n(i dont think its true but just in case)' },
];

// Coo's answers to your letters, one picked at random
const COO_ANSWERS = [
  'Thank you for your letter! I read it three times, bobbing my head the whole time.',
  'Coo! What a lovely message. It made my feathers fluff up.',
  'Got your mail! Did you know pigeons carried letters long before email? Now I do both.',
];

// { mail: [...], sent: [...], read: [ids], nextId }
function load() {
  return loadStored(STORAGE_KEY, { mail: WELCOME_MAIL, sent: [], read: [], nextId: 5 });
}

function header(box) {
  const { mail, read } = load();
  const unread = mail.filter((m) => !read.includes(m.id)).length;
  return `
    <div class="web-mail-header">
      <span class="web-mail-logo">Hot<b>Post</b> Mail</span>
      <span class="${box === 'inbox' ? 'is-current' : ''}">${link(MAIL, `Inbox${unread ? ` (${unread})` : ''}`)}</span>
      <span class="${box === 'compose' ? 'is-current' : ''}">${link(COMPOSE, 'Compose')}</span>
      <span class="${box === 'sent' ? 'is-current' : ''}">${link(SENT, 'Sent')}</span>
    </div>`;
}

// A list of messages. From, subject and dates were typed by people,
// so they are escaped.
function list(messages, { who, read = [] }) {
  if (messages.length === 0) return '<p class="web-center">No messages here.</p>';
  return `
    <table class="web-mail-list">
      <tr><th>${who === 'to' ? 'To' : 'From'}</th><th>Subject</th><th>Date</th></tr>
      ${[...messages].reverse().map((m) => `
        <tr class="${read.includes(m.id) || who === 'to' ? '' : 'is-unread'}">
          <td>${escapeHtml(m[who])}</td>
          <td>${who === 'to' ? escapeHtml(m.subject) : link(readUrl(m.id), escapeHtml(m.subject))}</td>
          <td>${escapeHtml(m.date)}</td>
        </tr>`).join('')}
    </table>`;
}

const inbox = {
  title: 'Inbox - HotPost Mail',
  keywords: 'hotpost mail email inbox messages letters',
  render: () => {
    const { mail, read } = load();
    const unread = mail.filter((m) => !read.includes(m.id)).length;
    return `
      <div class="web-page web-mail">
        ${header('inbox')}
        <p>${unread ? `<b>You've got mail!</b> ${unread} new ${unread === 1 ? 'message' : 'messages'}.` : 'No new mail.'}</p>
        ${list(mail, { who: 'from', read })}
      </div>`;
  },
};

const reader = {
  title: 'Read Mail - HotPost Mail',
  keywords: '',
  render: (url) => {
    const id = Number(new URL(url).searchParams.get('id'));
    const state = load();
    const message = state.mail.find((m) => m.id === id);
    if (!message) {
      return `<div class="web-page web-mail">${header()}<p>That message has gone missing. ${link(MAIL, 'Back to the Inbox')}</p></div>`;
    }

    if (!state.read.includes(id)) {
      state.read.push(id);
      saveStored(STORAGE_KEY, state);
    }
    return `
      <div class="web-page web-mail">
        ${header()}
        <table class="web-mail-fields">
          <tr><td>From:</td><td><b>${escapeHtml(message.from)}</b></td></tr>
          <tr><td>Subject:</td><td><b>${escapeHtml(message.subject)}</b></td></tr>
          <tr><td>Date:</td><td>${escapeHtml(message.date)}</td></tr>
        </table>
        <div class="web-mail-body">${escapeHtml(message.body)}</div>
        <p>${link(`${COMPOSE}?reply=${id}`, 'Reply')} | ${link(MAIL, 'Back to the Inbox')}</p>
      </div>`;
  },
};

const compose = {
  title: 'Compose - HotPost Mail',
  keywords: 'hotpost mail write compose send email',
  render: (url) => {
    // Replying fills in who to and the subject
    const replyTo = Number(new URL(url).searchParams.get('reply'));
    const original = load().mail.find((m) => m.id === replyTo);
    const to = original ? original.from : '';
    const subject = original ? `Re: ${original.subject.replace(/^Re: /, '')}` : '';
    return `
      <div class="web-page web-mail">
        ${header('compose')}
        <form class="web-mail-compose">
          <table class="web-mail-fields">
            <tr><td>To:</td><td><input class="web-input" name="to" maxlength="60" spellcheck="false" value="${escapeHtml(to)}" placeholder="${COO}"></td></tr>
            <tr><td>Subject:</td><td><input class="web-input" name="subject" maxlength="60" value="${escapeHtml(subject)}"></td></tr>
          </table>
          <textarea class="web-input" name="body" rows="7" maxlength="2000"></textarea>
          <p><button class="push-button" type="submit">Send</button> <span class="web-form-note"></span></p>
        </form>
      </div>`;
  },
  setUp: (root, browser) => {
    const form = root.querySelector('.web-mail-compose');
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const to = form.elements.to.value.trim();
      const subject = form.elements.subject.value.trim() || '(no subject)';
      const body = form.elements.body.value.trim();
      if (!to || !body) {
        form.querySelector('.web-form-note').textContent = 'Please fill in who to send it to, and a message.';
        return;
      }

      const state = load();
      const date = longDate().replace(/^\w+, /, '');
      state.sent.push({ id: state.nextId++, to, subject, date, body });

      // Coo writes back. Anyone else: the mail can't be delivered.
      if (to.toLowerCase() === COO) {
        state.mail.push({ id: state.nextId++, from: COO, subject: `Re: ${subject.replace(/^Re: /i, '')}`, date,
          body: `${COO_ANSWERS[Math.floor(Math.random() * COO_ANSWERS.length)]}\n\nCoo\n\n> ${body.split('\n').join('\n> ')}` });
      } else {
        state.mail.push({ id: state.nextId++, from: 'postmaster@hotpost.web', subject: 'Mail Delivery Failed', date,
          body: `Sorry, your message to ${to} could not be delivered.\n\nThis address is not on the web of the nineties. Try ${COO} instead!` });
      }

      saveStored(STORAGE_KEY, state);
      browser.go(MAIL);
    });
  },
};

const sent = {
  title: 'Sent - HotPost Mail',
  keywords: '',
  render: () => `
    <div class="web-page web-mail">
      ${header('sent')}
      ${list(load().sent, { who: 'to' })}
    </div>`,
};

export const SITE = {
  'www.hotpost.web': {
    '/': inbox, '/read': reader, '/compose.html': compose, '/sent.html': sent,
  },
};
