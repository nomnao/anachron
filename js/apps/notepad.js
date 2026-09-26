// Notepad: a plain text editor.
// Save puts a text file on the desktop; double-clicking that
// file opens it here again.

import { setUpMenuBar } from '../shell/menus.js';
import { showConfirmDialog, showSaveAsDialog, showSaveChangesDialog } from '../shell/dialogs.js';
import { readFile, writeFile, onFileRenamed } from '../system/fs.js';

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
  };

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

  notepad.text.addEventListener('input', () => { notepad.changed = true; });

  // Closing with unsaved typing asks to save it first
  context.beforeClose(() => askToSave(notepad));

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
  if (choice === 'cancel') return false;
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
