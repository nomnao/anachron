// My Files: every saved file in one list, with its type and size.
// Double-click (or Enter) opens a file in its own app;
// Delete sends it to the Recycle Bin. Click a column title to sort
// by that column, and again to reverse the order. The list updates by itself whenever
// a file is saved or deleted anywhere.

import { fileTypeOf } from '../app.js';
import { setUpMenuBar } from '../shell/menus.js';
import { showContextMenu } from '../shell/context-menu.js';
import { isDoubleClick } from '../shell/double-click.js';
import { renameInPlace } from '../shell/rename.js';
import { listFiles, onFilesChanged, fileSize } from '../system/fs.js';
import { fileEntry, sortByEntry } from '../shell/sort-files.js';

// The column the list is sorted by ('name', 'type' or 'size', or
// null for the order files were first saved), and which way.
// Kept for next time.
const SORT_STORAGE_KEY = 'anachron.files-sort';
import { confirmRecycle } from '../shell/recycle.js';

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
          <button data-command="rename">Rena<u>m</u>e</button>
          <button data-command="delete"><u>D</u>elete</button>
        </div>
      </div>
    </div>

    <div class="files-list sunken-panel">
      <div class="files-header">
        <span data-sort="name">Name</span>
        <span data-sort="type">Type</span>
        <span data-sort="size">Size</span>
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
    sort: loadSort(),
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
    if (command === 'rename') renameSelected(explorer);
    if (command === 'delete') deleteSelected(explorer);
  });

  setUpRows(explorer);

  // Clicking a column title sorts by it; clicking it again reverses
  root.querySelector('.files-header').addEventListener('click', (event) => {
    const column = event.target.closest('[data-sort]');
    if (!column) return;

    const by = column.dataset.sort;
    explorer.sort = {
      by,
      descending: explorer.sort.by === by ? !explorer.sort.descending : false,
    };
    saveSort(explorer.sort);
    render(explorer);
  });

  return root;
}

// ---------- Drawing the list ----------

function render(explorer) {
  const { root, rows } = explorer;
  const { by, descending } = explorer.sort;
  const withEntries = listFiles().map((file) => ({ ...file, entry: fileEntry(file) }));
  const files = sortByEntry(withEntries, by, descending);

  // A small arrow on the sorted column's title shows which way it goes
  for (const column of root.querySelectorAll('.files-header [data-sort]')) {
    column.classList.toggle('is-sorted', column.dataset.sort === by);
    column.classList.toggle('is-descending', column.dataset.sort === by && descending);
  }

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
    // Column titles sort the list; they don't change the selection
    if (event.target.closest('.files-header')) return;

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
      { label: 'Rename', action: () => renameSelected(explorer) },
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
    if (event.key === 'F2') {
      event.preventDefault();
      renameSelected(explorer);
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

// ---------- Open, rename and delete ----------

function openSelected(explorer) {
  if (explorer.selectedName) explorer.openFile(explorer.selectedName);
}

// Turns the selected file's name into a text box to type a new name.
// Afterwards the file stays selected under its new name.
async function renameSelected(explorer) {
  const oldName = explorer.selectedName;
  if (!oldName) return;

  const row = [...explorer.rows.children].find((r) => r.dataset.name === oldName);
  const newName = await renameInPlace(row.querySelector('.files-name span'), oldName);

  select(explorer, newName ?? oldName);
  explorer.root.focus({ preventScroll: true });
}

async function deleteSelected(explorer) {
  const name = explorer.selectedName;
  if (!name) return;

  await confirmRecycle(explorer.root, name);
  explorer.root.focus({ preventScroll: true });
}

// ---------- Remembering the sort order ----------

function loadSort() {
  try {
    const saved = JSON.parse(localStorage.getItem(SORT_STORAGE_KEY));
    if (saved?.by) return { by: saved.by, descending: Boolean(saved.descending) };
  } catch {
    // Blocked or unreadable: start unsorted
  }
  return { by: null, descending: false };
}

function saveSort(sort) {
  try {
    localStorage.setItem(SORT_STORAGE_KEY, JSON.stringify(sort));
  } catch {
    // Not kept, but the list stays sorted while the window is open
  }
}

// ---------- Sizes ----------

// Sizes are shown in whole kilobytes, rounded up, like "3KB"
export function formatSize(bytes) {
  return `${bytes === 0 ? 0 : Math.ceil(bytes / 1024)}KB`;
}
