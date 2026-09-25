// Notepad: a plain text editor.
// Save puts a text file on the desktop; double-clicking that
// file opens it here again.

import { setUpMenuBar } from '../shell/menus.js';
import { fileExists, readFile, writeFile } from '../system/fs.js';

// context comes from the desktop:
//   fileName - the file to open, or null for a new, untitled one
//   setTitle - changes the window's title
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
  };

  if (notepad.fileName) {
    notepad.text.value = readFile(notepad.fileName) ?? '';
  }
  updateTitle(notepad);

  setUpMenuBar(root.querySelector('.menu-bar'), (command) => runCommand(command, notepad));

  // Ctrl+S (Cmd+S on a Mac) saves, instead of saving the web page
  notepad.text.addEventListener('keydown', (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
      event.preventDefault();
      save(notepad);
    }
  });

  return root;
}

function runCommand(command, notepad) {
  const { text } = notepad;

  if (command === 'new') {
    text.value = '';
    notepad.fileName = null;
    updateTitle(notepad);
  }

  if (command === 'save') {
    save(notepad);
    return;
  }

  if (command === 'save-as') {
    showSaveDialog(notepad);
    return;
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
  }

  text.focus();
}

// "letter.txt - Notepad", or "Untitled - Notepad" before the first save
function updateTitle(notepad) {
  notepad.setTitle(`${notepad.fileName ?? 'Untitled'} - Notepad`);
}

// ---------- Saving ----------

// A file that already has a name is saved straight away;
// a new one asks for a name first.
function save(notepad) {
  if (notepad.fileName) {
    writeFile(notepad.fileName, notepad.text.value);
  } else {
    showSaveDialog(notepad);
  }
}

// The "Save As" box. It sits over the Notepad window until
// you save or cancel.
function showSaveDialog(notepad) {
  if (notepad.root.querySelector('.dialog-overlay')) return;

  const overlay = document.createElement('div');
  overlay.className = 'dialog-overlay';
  overlay.innerHTML = `
    <div class="dialog" role="dialog" aria-label="Save As">
      <div class="dialog-title">Save As</div>
      <div class="dialog-body">
        <label class="dialog-field">
          File name:
          <input class="dialog-input sunken-panel" type="text" maxlength="40" spellcheck="false">
        </label>
        <p class="dialog-message"></p>
        <div class="dialog-buttons">
          <button class="push-button" data-choice="save">Save</button>
          <button class="push-button" data-choice="cancel">Cancel</button>
        </div>
      </div>
    </div>
  `;
  notepad.root.append(overlay);

  const input = overlay.querySelector('.dialog-input');
  const message = overlay.querySelector('.dialog-message');
  input.value = notepad.fileName ?? 'Untitled.txt';
  input.focus();
  input.select();

  // The name we already warned about. Pressing Save again with
  // the same name means "yes, replace it".
  let warnedName = null;

  function trySave() {
    const name = toFileName(input.value);

    if (!name) {
      message.textContent = 'Please type a file name.';
      input.focus();
      return;
    }

    if (fileExists(name) && name !== notepad.fileName && name !== warnedName) {
      message.textContent = `${name} already exists. Press Save again to replace it.`;
      warnedName = name;
      input.focus();
      return;
    }

    writeFile(name, notepad.text.value);
    notepad.fileName = name;
    updateTitle(notepad);
    close();
  }

  function close() {
    overlay.remove();
    notepad.text.focus();
  }

  overlay.querySelector('[data-choice="save"]').addEventListener('click', trySave);
  overlay.querySelector('[data-choice="cancel"]').addEventListener('click', close);

  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') trySave();
    if (event.key === 'Escape') close();
  });

  // Typing a different name clears the warning
  input.addEventListener('input', () => {
    message.textContent = '';
    warnedName = null;
  });
}

// Tidies what was typed into a file name: trims spaces and adds
// ".txt" when there is no extension. Returns '' if nothing is left.
function toFileName(typed) {
  const name = typed.trim();
  if (!name) return '';
  return name.includes('.') ? name : `${name}.txt`;
}
