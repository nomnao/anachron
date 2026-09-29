// Recycle Bin: files that were deleted from the desktop or My Files.
// Files dragged onto the bin's icon, or into this window, land here.
// Restore puts a file back on the desktop; Delete (or Empty Recycle
// Bin) gets rid of it for good. Click a column title to sort by
// that column, and again to reverse the order. The list updates by
// itself whenever something is deleted or restored anywhere.

import { fileTypeOf } from '../app.js';
import { formatSize } from './files.js';
import { setUpMenuBar } from '../shell/menus.js';
import { showConfirmDialog } from '../shell/dialogs.js';
import { showContextMenu } from '../shell/context-menu.js';
import { confirmEmptyRecycleBin } from '../shell/recycle.js';
import { fileEntry, sortByEntry, setUpColumnSorting } from '../shell/sort-files.js';
import {
  listRecycled, fileExists, restoreFile, deleteRecycled, onRecycleBinChanged, fileSize,
} from '../system/fs.js';

// Where the column the list is sorted by is kept for next time
const SORT_STORAGE_KEY = 'anachron.recycle-sort';

export function createApp() {
  const root = document.createElement('div');
  root.className = 'files recycle-bin';
  // Files dragged into the open bin go in it (see file-drag.js)
  root.dataset.dropTarget = 'recycle';
  // Lets the window receive key presses (Enter, Delete, arrows)
  root.tabIndex = -1;

  root.innerHTML = `
    <div class="menu-bar">
      <div class="menu">
        <button class="menu-title"><u>F</u>ile</button>
        <div class="menu-items">
          <button data-command="restore">R<u>e</u>store</button>
          <button data-command="delete"><u>D</u>elete</button>
          <div class="menu-separator"></div>
          <button data-command="empty">Empty Recycle <u>B</u>in</button>
        </div>
      </div>
    </div>

    <div class="files-list sunken-panel">
      <div class="files-header">
        <span data-sort="name">Name</span>
        <span data-sort="date">Date Deleted</span>
        <span data-sort="size">Size</span>
      </div>
      <div class="files-rows"></div>
      <p class="files-empty">The Recycle Bin is empty.</p>
    </div>

    <div class="status-bar">
      <span class="status-field" data-status="count"></span>
      <span class="status-field" data-status="size"></span>
    </div>
  `;

  const bin = {
    root,
    rows: root.querySelector('.files-rows'),
    selectedId: null,
    // Which column the list is sorted by ('name', 'date' or 'size',
    // or null for most recently deleted first), and which way
    sort: setUpColumnSorting(root.querySelector('.files-header'), SORT_STORAGE_KEY, () => render(bin)),
  };

  render(bin);

  // Redraw whenever the bin changes. Once the window has been
  // closed, stop listening.
  const stopListening = onRecycleBinChanged(() => {
    if (!root.isConnected) {
      stopListening();
      return;
    }
    render(bin);
  });

  setUpMenuBar(root.querySelector('.menu-bar'), (command) => {
    if (command === 'restore') restoreSelected(bin);
    if (command === 'delete') deleteSelected(bin);
    if (command === 'empty') confirmEmpty(bin);
  });

  setUpRows(bin);

  return root;
}

// ---------- Drawing the list ----------

function render(bin) {
  const { root, rows } = bin;
  // Date Deleted sorts by when the file was deleted, newest first
  // (clicking it again puts the oldest first)
  const withEntries = listRecycled().reverse().map((item) => ({
    ...item,
    entry: { ...fileEntry(item), modified: item.deletedAt },
  }));
  const items = sortByEntry(withEntries, bin.sort.by, bin.sort.descending);

  if (!items.some((item) => item.id === bin.selectedId)) {
    bin.selectedId = null;
  }

  rows.replaceChildren(...items.map((item) => {
    const row = document.createElement('div');
    row.className = 'files-row';
    row.dataset.id = item.id;
    row.classList.toggle('is-selected', item.id === bin.selectedId);
    row.innerHTML = `
      <span class="files-name"><img src="${fileTypeOf(item).icon}" alt=""><span></span></span>
      <span class="files-date"></span>
      <span class="files-size"></span>
    `;
    // File names are typed by people, so they are plain text, never HTML
    row.querySelector('.files-name span').textContent = item.name;
    row.querySelector('.files-date').textContent = formatDate(item.deletedAt);
    row.querySelector('.files-size').textContent = formatSize(fileSize(item));
    return row;
  }));

  root.querySelector('.files-empty').hidden = items.length > 0;

  const total = items.reduce((sum, item) => sum + fileSize(item), 0);
  root.querySelector('[data-status="count"]').textContent = `${items.length} object(s)`;
  root.querySelector('[data-status="size"]').textContent = formatSize(total);
}

// Picks a file (or nothing, with null) without redrawing the list
function select(bin, id) {
  bin.selectedId = id;
  for (const row of bin.rows.children) {
    row.classList.toggle('is-selected', row.dataset.id === id);
  }
}

// e.g. "9/26/2026 3:07 PM"
function formatDate(time) {
  const date = new Date(time);
  const day = date.toLocaleDateString('en-US');
  const clock = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  return `${day} ${clock}`;
}

// ---------- Clicks and keys ----------

function setUpRows(bin) {
  const { root } = bin;
  const list = root.querySelector('.files-list');

  list.addEventListener('pointerdown', () => root.focus({ preventScroll: true }));

  list.addEventListener('click', (event) => {
    // Column titles sort the list; they don't change the selection
    if (event.target.closest('.files-header')) return;

    const row = event.target.closest('.files-row');
    select(bin, row ? row.dataset.id : null);
  });

  list.addEventListener('contextmenu', (event) => {
    event.preventDefault();
    const row = event.target.closest('.files-row');

    // Right-clicking the empty part of the list offers to empty the bin
    if (!row) {
      select(bin, null);
      showContextMenu(event, [{ label: 'Empty Recycle Bin', action: () => confirmEmpty(bin) }]);
      return;
    }

    select(bin, row.dataset.id);
    showContextMenu(event, [
      { label: 'Restore', action: () => restoreSelected(bin) },
      { label: 'Delete', action: () => deleteSelected(bin) },
    ]);
  });

  root.addEventListener('keydown', (event) => {
    // Leave keys alone while a dialog is asking something
    if (root.querySelector('.dialog-overlay')) return;

    if (event.key === 'Enter') {
      event.preventDefault();
      restoreSelected(bin);
    }
    if (event.key === 'Delete' || event.key === 'Backspace') {
      event.preventDefault();
      deleteSelected(bin);
    }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      moveSelection(bin, event.key === 'ArrowDown' ? 1 : -1);
    }
  });
}

// Up and down arrows: select the next or previous file
function moveSelection(bin, step) {
  const rows = [...bin.rows.children];
  if (rows.length === 0) return;

  const current = rows.findIndex((row) => row.dataset.id === bin.selectedId);
  const next = current === -1
    ? (step > 0 ? 0 : rows.length - 1)
    : Math.min(Math.max(current + step, 0), rows.length - 1);

  select(bin, rows[next].dataset.id);
  rows[next].scrollIntoView({ block: 'nearest' });
}

// ---------- Restore, delete and empty ----------

function selectedItem(bin) {
  return listRecycled().find((item) => item.id === bin.selectedId) ?? null;
}

// Puts the selected file back on the desktop. If a file with the
// same name has been saved since, asks before replacing it.
async function restoreSelected(bin) {
  const item = selectedItem(bin);
  if (!item) return;

  if (fileExists(item.name)) {
    const replace = await showConfirmDialog(bin.root, {
      title: 'Confirm File Replace',
      message: `This folder already contains a file named '${item.name}'. Would you like to replace it?`,
      confirmLabel: 'Yes',
      cancelLabel: 'No',
    });
    if (!replace) {
      bin.root.focus({ preventScroll: true });
      return;
    }
  }

  if (!(await restoreFile(item.id))) {
    await showConfirmDialog(bin.root, {
      title: 'Error Restoring File',
      message: `${item.name} could not be restored.`,
      cancelLabel: null,
    });
  }
  bin.root.focus({ preventScroll: true });
}

async function deleteSelected(bin) {
  const item = selectedItem(bin);
  if (!item) return;

  const confirmed = await showConfirmDialog(bin.root, {
    title: 'Confirm File Delete',
    message: `Are you sure you want to permanently delete '${item.name}'?`,
    confirmLabel: 'Yes',
    cancelLabel: 'No',
  });

  if (confirmed) deleteRecycled(item.id);
  bin.root.focus({ preventScroll: true });
}

async function confirmEmpty(bin) {
  await confirmEmptyRecycleBin(bin.root);
  bin.root.focus({ preventScroll: true });
}
