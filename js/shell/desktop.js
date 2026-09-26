// The desktop: icons, taskbar, Start menu and clock.

import { APPS, LISTED_APPS, RECYCLE_BIN_ICONS, fileTypeOf } from '../app.js';
import {
  initWindowManager, openWindow, closeAllWindows, requestCloseAll, hasWindow, restoreWindow, renameWindow,
  setWindowTitle, setWindowSize, onWindowsChanged, taskbarClick,
} from '../system/wm.js';
import {
  listFiles, listRecycled, fileSize, onFilesChanged, onFileRenamed, onRecycleBinChanged,
} from '../system/fs.js';
import { showConfirmDialog } from './dialogs.js';
import { trackEvent } from '../system/analytics.js';
import { showContextMenu } from './context-menu.js';
import { isDoubleClick } from './double-click.js';
import { renameInPlace } from './rename.js';
import { setUpStartMenu } from './start-menu.js';
import { confirmRecycle, confirmEmptyRecycleBin } from './recycle.js';

// Things to undo when the desktop goes away (timers, listeners
// on the whole page), so nothing is left running after a shut down
const cleanups = [];

// How the saved files' icons are sorted: 'name', 'type', 'size',
// 'date', or null for the order they were first saved
const SORT_STORAGE_KEY = 'anachron.desktop-sort';
let sortBy = loadSortBy();

// Every open app window: window id -> { id }. The id changes when the
// window's file is renamed, and apps always use the current one.
const openWindows = new Map();

// onShutDown is called after the user confirms Shut Down.
export function showDesktop(screen, { onShutDown }) {
  screen.innerHTML = `
    <div id="desktop">
      <div id="desktop-icons"></div>
      <div id="taskbar">
        <button id="start-button">
          <span class="logo"><span></span><span></span><span></span><span></span></span>
          Start
        </button>
        <div id="taskbar-buttons"></div>
        <div id="clock"></div>
      </div>
    </div>
  `;

  const desktop = screen.querySelector('#desktop');
  initWindowManager(desktop);
  createIcons(desktop);

  // Redraw the taskbar buttons whenever a window opens, closes,
  // gets focus, or is minimized
  onWindowsChanged(renderTaskbarButtons);

  cleanups.push(setUpStartMenu(desktop, {
    apps: LISTED_APPS,
    onLaunch: launchApp,
    onShutDown: () => confirmShutDown(desktop, onShutDown),
  }));

  updateClock();
  const clockTimer = setInterval(updateClock, 1000);
  cleanups.push(() => clearInterval(clockTimer));
}

// Stops everything the desktop started. The screen itself is
// cleared by whoever shows the next thing on it.
export function hideDesktop() {
  closeAllWindows();
  for (const cleanup of cleanups) cleanup();
  cleanups.length = 0;
}

async function confirmShutDown(desktop, onShutDown) {
  const confirmed = await showConfirmDialog(desktop, {
    title: 'Shut Down ANACHRON',
    message: 'Are you sure you want to shut down the computer?',
    confirmLabel: 'Yes',
    cancelLabel: 'No',
  });

  if (!confirmed) return;

  // Each window with unsaved work asks about it first;
  // Cancel on any of them stops the shut down
  if (await requestCloseAll()) onShutDown();
}

// ---------- Icons ----------

function createIcons(desktop) {
  const iconArea = desktop.querySelector('#desktop-icons');

  for (const app of LISTED_APPS) {
    iconArea.append(createIcon(app.icon, app.title, () => launchApp(app)));
  }

  iconArea.append(createRecycleBinIcon(desktop));

  // Saved files come after the apps. They live in their own box
  // (display: contents, so they still line up in the same grid)
  // so we can redraw just them whenever a file is saved.
  const fileIcons = document.createElement('div');
  fileIcons.id = 'file-icons';
  iconArea.append(fileIcons);

  renderFileIcons();
  cleanups.push(onFilesChanged(renderFileIcons));

  // A renamed file's windows get new ids too, so double-clicking
  // the renamed file brings back the window it is already open in
  cleanups.push(onFileRenamed((oldName, newName) => {
    for (const app of APPS) {
      const oldId = `${app.id}:${oldName}`;
      const newId = `${app.id}:${newName}`;
      const handle = openWindows.get(oldId);
      if (!handle) continue;

      renameWindow(oldId, newId);
      openWindows.delete(oldId);
      handle.id = newId;
      openWindows.set(newId, handle);
    }
  }));

  // Pressing anywhere that isn't an icon (the empty desktop,
  // a window, the taskbar) clears the selection
  // Right-clicking the empty desktop: a menu to arrange the icons
  desktop.addEventListener('contextmenu', (event) => {
    if (event.target !== desktop && event.target !== iconArea) return;

    event.preventDefault();
    selectIcon(null);
    showContextMenu(event, [
      { label: 'Arrange Icons', items: SORT_ORDERS.map((order) => ({
        label: order.label,
        checked: sortBy === order.id,
        action: () => arrangeIcons(order.id),
      })) },
    ]);
  });

  desktop.addEventListener('pointerdown', (event) => {
    if (!event.target.closest('.desktop-icon')) {
      selectIcon(null);
    }
  });

  // Keys for the selected file, unless you are typing somewhere:
  // Delete (or Backspace, since Mac laptops have no Delete key)
  // deletes it, F2 renames it
  function onKeyDown(event) {
    if (!['Delete', 'Backspace', 'F2'].includes(event.key)) return;
    if (event.target.closest('input, textarea')) return;
    if (desktop.querySelector('.dialog-overlay')) return;

    const selected = desktop.querySelector('.desktop-icon.is-selected');
    if (!selected?.dataset.fileName) return;

    event.preventDefault();
    if (event.key === 'F2') renameIcon(selected);
    else confirmDelete(selected.dataset.fileName);
  }
  document.addEventListener('keydown', onKeyDown);
  cleanups.push(() => document.removeEventListener('keydown', onKeyDown));
}

// Builds one icon. onOpen runs when it is double-clicked.
function createIcon(image, label, onOpen) {
  const icon = document.createElement('button');
  icon.className = 'desktop-icon';
  icon.innerHTML = `
    <img src="${image}" alt="">
    <span class="icon-label"></span>
  `;
  // File names are typed by people, so the label is plain text, never HTML
  icon.querySelector('.icon-label').textContent = label;
  icon.addEventListener('click', () => handleIconClick(icon, onOpen));
  return icon;
}

function renderFileIcons() {
  const icons = sortFiles(listFiles()).map((file) => {
    const open = () => openFile(file.name);
    const icon = createIcon(fileTypeOf(file).icon, file.name, open);
    icon.dataset.fileName = file.name;

    // Right-click: a small menu to open, rename or delete the file
    icon.addEventListener('contextmenu', (event) => {
      event.preventDefault();
      selectIcon(icon);
      showContextMenu(event, [
        { label: 'Open', action: open },
        { label: 'Rename', action: () => renameIcon(icon) },
        { label: 'Delete', action: () => confirmDelete(file.name) },
      ]);
    });

    return icon;
  });

  document.querySelector('#file-icons').replaceChildren(...icons);
}

// ---------- Arranging icons ----------

// Every way the icons can be sorted. Ties are broken by name.
const byName = (a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
const SORT_ORDERS = [
  { id: 'name', label: 'by Name', compare: byName },
  { id: 'type', label: 'by Type',
    compare: (a, b) => fileTypeOf(a).label.localeCompare(fileTypeOf(b).label) || byName(a, b) },
  { id: 'size', label: 'by Size', compare: (a, b) => fileSize(a) - fileSize(b) || byName(a, b) },
  // Newest first. Files saved before dates were kept count as oldest.
  { id: 'date', label: 'by Date', compare: (a, b) => (b.modified ?? 0) - (a.modified ?? 0) || byName(a, b) },
];

function sortFiles(files) {
  const order = SORT_ORDERS.find((o) => o.id === sortBy);
  return order ? files.sort(order.compare) : files;
}

// Sorts the icons, and keeps them sorted that way from now on,
// even as files are saved, renamed or deleted
function arrangeIcons(order) {
  sortBy = order;
  try {
    localStorage.setItem(SORT_STORAGE_KEY, order);
  } catch {
    // Not kept, but the icons are still sorted until the page closes
  }
  renderFileIcons();
}

function loadSortBy() {
  try {
    return localStorage.getItem(SORT_STORAGE_KEY);
  } catch {
    return null;
  }
}

// Turns the icon's label into a text box to type a new name.
// Afterwards the (redrawn) icon is selected again.
async function renameIcon(icon) {
  const oldName = icon.dataset.fileName;
  const newName = await renameInPlace(icon.querySelector('.icon-label'), oldName);

  const name = newName ?? oldName;
  const redrawn = [...document.querySelectorAll('#file-icons .desktop-icon')]
    .find((i) => i.dataset.fileName === name);
  if (redrawn) selectIcon(redrawn);
}

function confirmDelete(name) {
  confirmRecycle(document.querySelector('#desktop'), name);
}

// The Recycle Bin sits after the apps. Its picture shows whether
// anything is in it, so it changes whenever the bin does.
function createRecycleBinIcon(desktop) {
  const app = APPS.find((a) => a.id === 'recycle');
  const icon = createIcon(app.icon, app.title, () => launchApp(app));
  const image = icon.querySelector('img');

  function update(items) {
    image.src = items.length > 0 ? RECYCLE_BIN_ICONS.full : RECYCLE_BIN_ICONS.empty;
  }
  update(listRecycled());
  cleanups.push(onRecycleBinChanged(update));

  icon.addEventListener('contextmenu', (event) => {
    event.preventDefault();
    selectIcon(icon);
    showContextMenu(event, [
      { label: 'Open', action: () => launchApp(app) },
      { label: 'Empty Recycle Bin', action: () => confirmEmptyRecycleBin(desktop) },
    ]);
  });

  return icon;
}

function handleIconClick(icon, onOpen) {
  selectIcon(icon);
  if (isDoubleClick(icon)) onOpen();
}

function selectIcon(icon) {
  for (const other of document.querySelectorAll('.desktop-icon')) {
    other.classList.toggle('is-selected', other === icon);
  }
}

// Opens a file in the app that belongs to its type, or in
// another app when appId is given (e.g. a picture in Paint)
function openFile(name, appId) {
  const file = listFiles().find((f) => f.name === name);
  if (!file) return;

  const app = APPS.find((a) => a.id === (appId ?? fileTypeOf(file).appId));
  launchApp(app, { fileName: name });
}

// Apps that have been built load their own module and draw
// their own content. The rest show a placeholder for now.
// options.fileName opens that file in the app.
async function launchApp(app, options = {}) {
  // Each file gets its own window; opening it again just
  // brings that window back to the front
  const id = options.fileName ? `${app.id}:${options.fileName}` : app.id;
  if (hasWindow(id)) {
    restoreWindow(id);
    return;
  }

  // What the app gets to work with. An app can call setTitle and
  // setSize while it starts up, before its window exists; we keep
  // them and open the window with them.
  let title = app.title;
  let size = null;
  const closeHandlers = [];
  let beforeClose = null;
  // Holds the window's current id (it changes if its file is renamed)
  const handle = { id };
  const context = {
    fileName: options.fileName ?? null,
    setTitle(newTitle) {
      title = newTitle;
      setWindowTitle(handle.id, newTitle);
    },
    // Lets an app change its window's size (in virtual pixels)
    setSize(width, height) {
      size = { width, height };
      setWindowSize(handle.id, width, height);
    },
    // Lets an app (like My Files) open a file in its own app
    openFile,
    // Lets an app run something when its window closes
    onClose(handler) {
      closeHandlers.push(handler);
    },
    // Lets an app decide whether its window may close, e.g. by
    // asking about unsaved changes. handler gives back (or resolves
    // to) true to close, false to stay open.
    beforeClose(handler) {
      beforeClose = handler;
    },
  };

  const content = app.load
    ? (await app.load()).createApp(context)
    : `
      <div class="placeholder sunken-panel">
        <img src="${app.icon}" alt="">
        <p>${app.title} will be installed in a later phase.</p>
      </div>
    `;

  openWindows.set(id, handle);
  trackEvent(`open-${app.id}`);
  openWindow({
    id,
    title,
    icon: app.icon,
    width: size?.width ?? app.width,
    height: size?.height ?? app.height,
    content,
    beforeClose: () => (beforeClose ? beforeClose() : true),
    onClose: () => {
      openWindows.delete(handle.id);
      closeHandlers.forEach((handler) => handler());
    },
  });

  // A window sized by its app is moved, if needed, to fit on screen
  if (size) setWindowSize(handle.id, size.width, size.height);
}

// ---------- Taskbar buttons ----------

// One button per open window. The window manager hands us the list;
// we simply draw it again from scratch each time.
function renderTaskbarButtons(windowList) {
  const area = document.querySelector('#taskbar-buttons');
  area.innerHTML = '';

  for (const win of windowList) {
    const button = document.createElement('button');
    button.className = 'taskbar-button';
    button.classList.toggle('is-pressed', win.active);
    button.innerHTML = `
      <img src="${win.icon}" alt="">
      <span class="taskbar-button-text"></span>
    `;
    button.querySelector('.taskbar-button-text').textContent = win.title;
    button.addEventListener('click', () => taskbarClick(win.id));
    area.append(button);
  }
}

// ---------- Clock ----------

function updateClock() {
  const clock = document.querySelector('#clock');
  clock.textContent = new Date().toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });
}