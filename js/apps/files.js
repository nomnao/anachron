// My Files: every saved file in one list, with its type and size.
// Double-click (or Enter) opens a file in its own app;
// Delete removes it. The list updates by itself whenever
// a file is saved or deleted anywhere.

import { fileTypeOf } from '../app.js';
import { setUpMenuBar } from '../shell/menus.js';
import { showConfirmDialog } from '../shell/dialogs.js';
import { showContextMenu } from '../shell/context-menu.js';
import { isDoubleClick } from '../shell/double-click.js';
import { listFiles, deleteFile, onFilesChanged } from '../system/fs.js';

// context comes from the desktop:
//   openFile - opens a file in the app that belongs to its type
export function createApp(context) {
  const root = document.createElement('div');
  root.className = 'files';
  // Lets the window receive key presses (Enter, Delete, arrows)
  root.tabIndex = -1;

  root.innerHTML = `
    <div class="menu-bar">
      <div class="menu">
        <button class="menu-title"><u>F</u>ile</button>
        <div class="menu-items">
          <button data-command="open"><u>O</u>pen</button>
          <button data-command="delete"><u>D</u>elete</button>
        </div>
      </div>
    </div>

    <div class="files-list sunken-panel">
      <div class="files-header">
        <span>Name</span>
        <span>Type</span>
        <span>Size</span>
      </div>
      <div class="files-rows"></div>
      <p class="files-empty">This folder is empty.</p>
    </div>

    <div class="status-bar">
      <span class="status-field" data-status="count"></span>
      <span class="status-field" data-status="size"></span>
    </div>
  `;

  const explorer = {
    root,
    rows: root.querySelector('.files-rows'),
    selectedName: null,
    openFile: context.openFile,
  };

  render(explorer);

  // Redraw whenever files change. Once the window has been
  // closed, stop listening.
  const stopListening = onFilesChanged(() => {
    if (!root.isConnected) {
      stopListening();
      return;
    }
    render(explorer);
  });

  setUpMenuBar(root.querySelector('.menu-bar'), (command) => {
    if (command === 'open') openSelected(explorer);
    if (command === 'delete') deleteSelected(explorer);
  });

  setUpRows(explorer);

  return root;
}

// ---------- Drawing the list ----------

function render(explorer) {
  const { root, rows } = explorer;
  const files = listFiles();

  // If the selected file is gone (deleted), nothing is selected
  if (!files.some((file) => file.name === explorer.selectedName)) {
    explorer.selectedName = null;
  }

  rows.replaceChildren(...files.map((file) => {
    const type = fileTypeOf(file);
    const row = document.createElement('div');
    row.className = 'files-row';
    row.dataset.name = file.name;
    row.classList.toggle('is-selected', file.name === explorer.selectedName);
    row.innerHTML = `
      <span class="files-name"><img src="${type.icon}" alt=""><span></span></span>
      <span class="files-type"></span>
      <span class="files-size"></span>
    `;
    // File names are typed by people, so they are plain text, never HTML
    row.querySelector('.files-name span').textContent = file.name;
    row.querySelector('.files-type').textContent = type.label;
    row.querySelector('.files-size').textContent = formatSize(fileSize(file));
    return row;
  }));

  root.querySelector('.files-empty').hidden = files.length > 0;

  const total = files.reduce((sum, file) => sum + fileSize(file), 0);
  root.querySelector('[data-status="count"]').textContent = `${files.length} object(s)`;
  root.querySelector('[data-status="size"]').textContent = formatSize(total);
}

// Picks a file (or nothing, with null) without redrawing the list
function select(explorer, name) {
  explorer.selectedName = name;
  for (const row of explorer.rows.children) {
    row.classList.toggle('is-selected', row.dataset.name === name);
  }
}

// ---------- Clicks and keys ----------

function setUpRows(explorer) {
  const { root } = explorer;
  const list = root.querySelector('.files-list');

  list.addEventListener('pointerdown', () => root.focus({ preventScroll: true }));

  list.addEventListener('click', (event) => {
    const row = event.target.closest('.files-row');
    if (!row) {
      select(explorer, null);
      return;
    }

    select(explorer, row.dataset.name);
    if (isDoubleClick(row)) openSelected(explorer);
  });

  list.addEventListener('contextmenu', (event) => {
    const row = event.target.closest('.files-row');
    if (!row) return;

    event.preventDefault();
    select(explorer, row.dataset.name);
    showContextMenu(event, [
      { label: 'Open', action: () => openSelected(explorer) },
      { label: 'Delete', action: () => deleteSelected(explorer) },
    ]);
  });

  root.addEventListener('keydown', (event) => {
    // Leave keys alone while a dialog is asking something
    if (root.querySelector('.dialog-overlay')) return;

    if (event.key === 'Enter') {
      event.preventDefault();
      openSelected(explorer);
    }
    if (event.key === 'Delete' || event.key === 'Backspace') {
      event.preventDefault();
      deleteSelected(explorer);
    }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      moveSelection(explorer, event.key === 'ArrowDown' ? 1 : -1);
    }
  });
}

// Up and down arrows: select the next or previous file
function moveSelection(explorer, step) {
  const rows = [...explorer.rows.children];
  if (rows.length === 0) return;

  const current = rows.findIndex((row) => row.dataset.name === explorer.selectedName);
  const next = current === -1
    ? (step > 0 ? 0 : rows.length - 1)
    : Math.min(Math.max(current + step, 0), rows.length - 1);

  select(explorer, rows[next].dataset.name);
  rows[next].scrollIntoView({ block: 'nearest' });
}

// ---------- Open and delete ----------

function openSelected(explorer) {
  if (explorer.selectedName) explorer.openFile(explorer.selectedName);
}

async function deleteSelected(explorer) {
  const name = explorer.selectedName;
  if (!name) return;

  const confirmed = await showConfirmDialog(explorer.root, {
    title: 'Confirm File Delete',
    message: `Are you sure you want to delete '${name}'?`,
    confirmLabel: 'Yes',
    cancelLabel: 'No',
  });

  if (confirmed) deleteFile(name);
  explorer.root.focus({ preventScroll: true });
}

// ---------- Sizes ----------

// How many bytes a file takes. Pictures are stored as base64 text,
// which is a third bigger than the picture itself, so we count
// the picture's real size.
function fileSize(file) {
  // Big files (videos) know their own size
  if (file.big) return file.size;
  if (file.type === 'image') {
    const base64 = file.content.split(',')[1] ?? '';
    return Math.floor((base64.length * 3) / 4);
  }
  return new Blob([file.content]).size;
}

// Sizes are shown in whole kilobytes, rounded up, like "3KB"
function formatSize(bytes) {
  return `${bytes === 0 ? 0 : Math.ceil(bytes / 1024)}KB`;
}
