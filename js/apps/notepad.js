// Notepad: a plain text editor.
// Save puts a text file on the desktop; double-clicking that
// file opens it here again. Search > Find and Replace look through
// the text, and Edit > Word Wrap chooses whether long lines wrap.

import { setUpMenuBar } from '../shell/menus.js';
import { showConfirmDialog, showSaveAsDialog, showSaveChangesDialog } from '../shell/dialogs.js';
import { readFile, writeFile, onFileRenamed } from '../system/fs.js';
import { tellAssistant } from '../shell/assistant.js';

// Word Wrap is on or off in every Notepad, and remembered
const WRAP_STORAGE_KEY = 'anachron.notepad-wrap';

// context comes from the desktop:
//   fileName - the file to open, or null for a new, untitled one
//   setTitle - changes the window's title
//   onClose  - runs something when the window closes
//   beforeClose - lets Notepad ask about unsaved changes first
export function createApp(context) {
  const root = document.createElement('div');
  root.className = 'notepad';
  root.innerHTML = `
    <div class="menu-bar">
      <div class="menu">
        <button class="menu-title"><u>F</u>ile</button>
        <div class="menu-items">
          <button data-command="new"><u>N</u>ew</button>
          <button data-command="save"><u>S</u>ave</button>
          <button data-command="save-as">Save <u>A</u>s...</button>
        </div>
      </div>
      <div class="menu">
        <button class="menu-title"><u>E</u>dit</button>
        <div class="menu-items">
          <button data-command="select-all">Select <u>A</u>ll</button>
          <button data-command="time-date">Time/<u>D</u>ate</button>
          <div class="menu-separator"></div>
          <button data-command="word-wrap"><u>W</u>ord Wrap</button>
        </div>
      </div>
      <div class="menu">
        <button class="menu-title"><u>S</u>earch</button>
        <div class="menu-items">
          <button data-command="find"><u>F</u>ind...</button>
          <button data-command="find-next">Find <u>N</u>ext</button>
          <button data-command="replace"><u>R</u>eplace...</button>
        </div>
      </div>
    </div>
    <textarea class="notepad-text sunken-panel" spellcheck="false"></textarea>
  `;

  const notepad = {
    root,
    text: root.querySelector('.notepad-text'),
    fileName: context.fileName,
    setTitle: context.setTitle,
    // True when there is typing that hasn't been saved yet
    changed: false,
    // What Find and Replace last looked for (F3 looks for it again)
    search: { find: '', replace: '', matchCase: false },
    // Where Find Next last found it: { start, end }
    lastFound: null,
    // Runs a Find or Replace button while that box is open
    runSearch: null,
  };

  setWordWrap(notepad, loadWordWrap());

  if (notepad.fileName) {
    notepad.text.value = readFile(notepad.fileName) ?? '';
  }
  updateTitle(notepad);

  // If the file is renamed (on the desktop or in My Files),
  // carry on with it under its new name
  context.onClose(onFileRenamed((oldName, newName) => {
    if (notepad.fileName !== oldName) return;
    notepad.fileName = newName;
    updateTitle(notepad);
  }));

  setUpMenuBar(root.querySelector('.menu-bar'), (command) => runCommand(command, notepad));

  notepad.text.addEventListener('input', () => {
    notepad.changed = true;
    // Starting a letter with "Dear" brings Coo the pigeon over
    if (/^\s*dear\s/i.test(notepad.text.value)) tellAssistant('writing-letter');
  });

  // Closing with unsaved typing asks to save it first
  context.beforeClose(() => askToSave(notepad));

  // Ctrl+S (Cmd+S on a Mac) saves, instead of saving the web page.
  // Ctrl+F finds, F3 finds the next one, Ctrl+H replaces.
  notepad.text.addEventListener('keydown', (event) => {
    // While the Find or Replace box is open and what it found is still
    // selected, Enter finds the next one (instead of typing over it),
    // and Escape closes the box
    if (notepad.runSearch && (event.key === 'Enter' || event.key === 'Escape') && isLastFoundSelected(notepad)) {
      event.preventDefault();
      notepad.runSearch(event.key === 'Enter' ? 'find-next' : 'close');
      return;
    }

    const key = event.key.toLowerCase();
    const ctrl = event.ctrlKey || event.metaKey;
    const command = (ctrl && key === 's' && 'save')
      || (ctrl && key === 'f' && 'find')
      || (ctrl && key === 'h' && 'replace')
      || (event.key === 'F3' && 'find-next');
    if (!command) return;

    event.preventDefault();
    runCommand(command, notepad);
  });

  return root;
}

function runCommand(command, notepad) {
  const { text } = notepad;

  if (command === 'new') {
    startNewFile(notepad);
    return;
  }

  if (command === 'save') {
    save(notepad);
    return;
  }

  if (command === 'save-as') {
    saveAs(notepad);
    return;
  }

  if (command === 'find' || command === 'replace') {
    openSearchBox(notepad, command);
    return;
  }

  if (command === 'find-next') {
    // With nothing looked for yet, it's the same as Find...
    if (notepad.search.find) findNext(notepad);
    else openSearchBox(notepad, 'find');
    return;
  }

  if (command === 'word-wrap') {
    setWordWrap(notepad, !notepad.wordWrap);
    saveWordWrap(notepad.wordWrap);
  }

  if (command === 'select-all') {
    text.select();
  }

  // Types the current time and date where the cursor is, e.g. "5:03 PM 9/25/2026"
  if (command === 'time-date') {
    const now = new Date();
    const stamp = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
      + ' ' + now.toLocaleDateString('en-US');
    text.setRangeText(stamp, text.selectionStart, text.selectionEnd, 'end');
    notepad.changed = true;
  }

  text.focus();
}

// New: an empty, untitled page (after asking about unsaved typing)
async function startNewFile(notepad) {
  if (await askToSave(notepad)) {
    notepad.text.value = '';
    notepad.fileName = null;
    notepad.changed = false;
    updateTitle(notepad);
  }
  notepad.text.focus();
}

// "letter.txt - Notepad", or "Untitled - Notepad" before the first save
function updateTitle(notepad) {
  notepad.setTitle(`${notepad.fileName ?? 'Untitled'} - Notepad`);
}

// ---------- Word Wrap ----------

// On: long lines wrap at the window's edge. Off: each line stays on
// one line, and the text scrolls sideways.
function setWordWrap(notepad, on) {
  notepad.wordWrap = on;
  notepad.text.wrap = on ? 'soft' : 'off';
  notepad.root.querySelector('[data-command="word-wrap"]').classList.toggle('is-checked', on);
}

// On unless it was turned off
function loadWordWrap() {
  try {
    return localStorage.getItem(WRAP_STORAGE_KEY) !== 'off';
  } catch {
    return true;
  }
}

function saveWordWrap(on) {
  try {
    localStorage.setItem(WRAP_STORAGE_KEY, on ? 'on' : 'off');
  } catch {
    // Not kept, but this Notepad still wraps (or not) as chosen
  }
}

// ---------- Find and Replace ----------

// The Find (or Replace) box: a small window in the corner of Notepad
// that stays open while you work, like the real thing. Each Find Next
// selects what it finds in the text, so you can see it.
function openSearchBox(notepad, mode) {
  const { root, search } = notepad;
  root.querySelector('.notepad-search')?.remove();

  // Starts with the selected text, if a little is selected
  const selected = notepad.text.value.slice(notepad.text.selectionStart, notepad.text.selectionEnd);
  if (selected && !selected.includes('\n') && selected.length <= 60) search.find = selected;

  const box = document.createElement('div');
  box.className = 'notepad-search dialog';
  box.setAttribute('role', 'dialog');
  box.innerHTML = `
    <div class="dialog-title">
      <span></span>
      <button class="title-button" data-choice="close" aria-label="Close"><span class="glyph-close"></span></button>
    </div>
    <div class="dialog-body">
      <label class="dialog-field">
        <span class="search-label">Find what:</span>
        <input class="dialog-input sunken-panel" data-field="find" spellcheck="false">
      </label>
      ${mode === 'replace' ? `
        <label class="dialog-field">
          <span class="search-label">Replace with:</span>
          <input class="dialog-input sunken-panel" data-field="replace" spellcheck="false">
        </label>` : ''}
      <label class="search-case"><input type="checkbox" data-field="match-case"><span>Match <u>c</u>ase</span></label>
      <p class="search-message"></p>
      <div class="dialog-buttons">
        <button class="push-button" data-choice="find-next">Find Next</button>
        ${mode === 'replace' ? `
          <button class="push-button" data-choice="replace">Replace</button>
          <button class="push-button" data-choice="replace-all">Replace All</button>` : ''}
        <button class="push-button" data-choice="close">Cancel</button>
      </div>
    </div>
  `;
  box.querySelector('.dialog-title span').textContent = mode === 'replace' ? 'Replace' : 'Find';

  const findInput = box.querySelector('[data-field="find"]');
  const replaceInput = box.querySelector('[data-field="replace"]');
  const matchCase = box.querySelector('[data-field="match-case"]');
  const message = box.querySelector('.search-message');
  findInput.value = search.find;
  if (replaceInput) replaceInput.value = search.replace;
  matchCase.checked = search.matchCase;

  // Remembers what's typed, for the next Find Next (or F3)
  box.addEventListener('input', () => {
    search.find = findInput.value;
    if (replaceInput) search.replace = replaceInput.value;
    search.matchCase = matchCase.checked;
    message.textContent = '';
  });

  function close() {
    box.remove();
    notepad.runSearch = null;
    notepad.text.focus();
  }

  function run(choice) {
    if (choice === 'close') {
      close();
      return;
    }
    if (!search.find) {
      message.textContent = 'Type something to look for.';
      findInput.focus();
      return;
    }
    if (choice === 'find-next') message.textContent = findNext(notepad) ? '' : `Cannot find "${search.find}"`;
    if (choice === 'replace') message.textContent = replaceOne(notepad) ? '' : `Cannot find "${search.find}"`;
    if (choice === 'replace-all') {
      const count = replaceAll(notepad);
      message.textContent = count === 0 ? `Cannot find "${search.find}"` : `Replaced ${count} ${count === 1 ? 'time' : 'times'}.`;
    }
  }

  notepad.runSearch = run;

  box.addEventListener('click', (event) => {
    const button = event.target.closest('[data-choice]');
    if (button) run(button.dataset.choice);
  });

  box.addEventListener('keydown', (event) => {
    // Keep keys (like Ctrl+S) for the box while typing in it
    event.stopPropagation();
    if (event.key === 'Escape') {
      event.preventDefault();
      close();
    }
    // Enter is Find Next, like the box's first button
    if (event.key === 'Enter' && event.target.matches('.dialog-input')) {
      event.preventDefault();
      run('find-next');
    }
  });

  root.append(box);
  findInput.focus();
  findInput.select();
}

// Where the search term next appears after the cursor, going round
// to the top at the end. Gives back its position, or -1.
function nextMatch(notepad) {
  const { text, search } = notepad;
  const haystack = search.matchCase ? text.value : text.value.toLowerCase();
  const needle = search.matchCase ? search.find : search.find.toLowerCase();

  const after = haystack.indexOf(needle, text.selectionEnd);
  return after !== -1 ? after : haystack.indexOf(needle);
}

// Selects the next match in the text. Gives back false if there's none.
function findNext(notepad) {
  const { text, search } = notepad;
  const at = nextMatch(notepad);
  if (at === -1) return false;

  selectAndShow(notepad, at, at + search.find.length);
  notepad.lastFound = { start: at, end: at + search.find.length };
  return true;
}

function isLastFoundSelected(notepad) {
  const { text, lastFound } = notepad;
  return Boolean(lastFound) && text.selectionStart === lastFound.start && text.selectionEnd === lastFound.end;
}

// Replace: swaps the selected match for the replacement, then finds
// the next one. (If what's selected isn't a match, it just finds.)
// Gives back false if there's nothing to find.
function replaceOne(notepad) {
  const { text, search } = notepad;
  const selected = text.value.slice(text.selectionStart, text.selectionEnd);
  const isMatch = search.matchCase
    ? selected === search.find
    : selected.toLowerCase() === search.find.toLowerCase();

  if (isMatch) {
    replaceText(notepad, text.selectionStart, text.selectionEnd, search.replace);
  }
  return findNext(notepad) || isMatch;
}

// Replace All: swaps every match at once (one Ctrl+Z undoes it all).
// Gives back how many there were.
function replaceAll(notepad) {
  const { text, search } = notepad;
  const escaped = search.find.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(escaped, search.matchCase ? 'g' : 'gi');

  const count = (text.value.match(pattern) ?? []).length;
  if (count > 0) {
    replaceText(notepad, 0, text.value.length, text.value.replace(pattern, () => search.replace));
    text.setSelectionRange(0, 0);
    text.scrollTop = 0;
  }
  return count;
}

// Changes part of the text in a way Ctrl+Z can undo. (Setting the
// text directly would forget the undo history.)
function replaceText(notepad, start, end, value) {
  const { text } = notepad;
  text.focus();
  text.setSelectionRange(start, end);
  const done = value !== '' && document.execCommand('insertText', false, value);
  if (!done) text.setRangeText(value, start, end, 'end');
  notepad.changed = true;
}

// Selects part of the text and scrolls it into view (setting the
// selection from code doesn't scroll by itself), clear of the Find
// box: just below it, or, for the first lines of the text (which
// can't scroll down that far), with the box moved to the bottom
function selectAndShow(notepad, start, end) {
  const { text } = notepad;
  text.focus();
  text.setSelectionRange(start, end);

  const spot = positionOf(text, start);
  const box = notepad.root.querySelector('.notepad-search');

  // How much of the top of the text the Find box covers
  let covered = 0;
  if (box) {
    box.classList.remove('is-low');
    covered = Math.max(0, box.getBoundingClientRect().bottom - text.getBoundingClientRect().top);
    if (spot.top < covered) {
      box.classList.add('is-low');
      covered = 0;
    }
  }

  const visibleTop = text.scrollTop + covered;
  const visibleBottom = text.scrollTop + text.clientHeight - spot.height;
  if (spot.top < visibleTop || spot.top > visibleBottom) {
    text.scrollTop = Math.max(0, spot.top - (covered ? covered + 2 : text.clientHeight / 3));
  }
  if (spot.left < text.scrollLeft || spot.left > text.scrollLeft + text.clientWidth - 20) {
    text.scrollLeft = Math.max(0, spot.left - text.clientWidth / 3);
  }
}

// Where a character sits inside the text, in pixels from the top-left
// of all the text (not just the part scrolled into view). A hidden copy
// of the text is laid out the same way, lines wrapped (or not) just
// like the real one, and the spot is measured there.
function positionOf(text, index) {
  const style = getComputedStyle(text);
  const copy = document.createElement('div');
  for (const property of ['fontFamily', 'fontSize', 'fontWeight', 'lineHeight', 'letterSpacing', 'tabSize',
    'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft']) {
    copy.style[property] = style[property];
  }
  Object.assign(copy.style, {
    position: 'absolute',
    visibility: 'hidden',
    top: '0',
    left: '0',
    boxSizing: 'border-box',
    // The same width lines wrap at (inside any scrollbar)
    width: `${text.clientWidth}px`,
    whiteSpace: text.wrap === 'off' ? 'pre' : 'pre-wrap',
    overflowWrap: 'break-word',
  });

  const marker = document.createElement('span');
  marker.textContent = '\u200b';
  copy.append(text.value.slice(0, index), marker);
  text.parentElement.append(copy);
  const spot = { top: marker.offsetTop, left: marker.offsetLeft, height: marker.offsetHeight };
  copy.remove();
  return spot;
}

// ---------- Saving ----------

// If there is unsaved typing, asks "Save changes?".
// Gives back true to carry on (saved, or No), false to stop (Cancel,
// or the Save As box was cancelled).
async function askToSave(notepad) {
  if (!notepad.changed) return true;

  const choice = await showSaveChangesDialog(notepad.root, {
    title: 'Notepad',
    fileName: notepad.fileName ?? 'Untitled',
  });
  if (choice === 'discard') return true;
  if (choice === 'cancel') {
    // Stay in the app, so typing and Ctrl+S carry on working
    notepad.text.focus();
    return false;
  }
  return save(notepad);
}

// A file that already has a name is saved straight away;
// a new one asks for a name first. Gives back true if it was saved.
async function save(notepad) {
  if (!notepad.fileName) return saveAs(notepad);

  writeAndCheck(notepad, notepad.fileName);
  return true;
}

async function saveAs(notepad) {
  const name = await showSaveAsDialog(notepad.root, {
    fileName: notepad.fileName ?? 'Untitled.txt',
    extension: '.txt',
  });

  if (name) {
    notepad.fileName = name;
    updateTitle(notepad);
    writeAndCheck(notepad, name);
  }
  notepad.text.focus();
  return Boolean(name);
}

// Saves, and says so if the browser had no room to keep the file.
function writeAndCheck(notepad, name) {
  notepad.changed = false;
  if (!writeFile(name, notepad.text.value, 'text')) {
    showConfirmDialog(notepad.root, {
      title: 'Notepad',
      message: `There is no room to store ${name}. It will be lost when this page is closed.`,
      cancelLabel: null,
    });
  }
}
