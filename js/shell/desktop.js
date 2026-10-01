// The desktop: icons, taskbar, Start menu, clock and calendar.

import { APPS, LISTED_APPS, RECYCLE_BIN_ICONS, fileTypeOf } from '../app.js';
import {
  initWindowManager, openWindow, closeAllWindows, requestClose, requestCloseAll, hasWindow, restoreWindow,
  renameWindow, setWindowTitle, setWindowSize, onWindowsChanged, taskbarClick,
  shakeWindow, callForAttention,
} from '../system/wm.js';
import {
  listFiles, listRecycled, onFilesChanged, onFileRenamed, onRecycleBinChanged,
} from '../system/fs.js';
import { showConfirmDialog } from './dialogs.js';
import { trackEvent } from '../system/analytics.js';
import { isMuted, setMuted, playDing } from '../system/sound.js';
import { showContextMenu } from './context-menu.js';
import { isDoubleClick } from './double-click.js';
import { renameInPlace } from './rename.js';
import { setUpStartMenu } from './start-menu.js';
import { setUpCalendar, formatLongDate } from './calendar.js';
import { setUpAssistant, tellAssistant, toggleAssistant, isAssistantHidden } from './assistant.js';
import { exportFile, importFiles, chooseFilesToImport } from './transfer.js';
import { setUpFileDrag } from './file-drag.js';
import {
  currentDisplaySettings, saveDisplaySettings, onDisplaySettingsChanged, paintBackground, labelTextColor,
} from './background.js';
import { confirmRecycle, confirmEmptyRecycleBin } from './recycle.js';
import { SORT_ORDERS, fileEntry, appEntry, sortByEntry } from './sort-files.js';

// Things to undo when the desktop goes away (timers, listeners
// on the whole page), so nothing is left running after a shut down
const cleanups = [];

// How the desktop icons are sorted: 'name', 'type', 'size', 'date'
// (see sort-files.js), or null for apps first, then files in the
// order they were first saved
const SORT_STORAGE_KEY = 'anachron.desktop-sort';
let sortBy = loadSortBy();

// Icons dragged to a spot of their own stay there: icon -> { x, y },
// in virtual pixels from the top left of the icon area. Empty means
// the icons line up in the grid (see layoutIcons).
const POSITIONS_STORAGE_KEY = 'anachron.icon-positions';
let iconPositions = loadPositions();

// The size of one place in the icon grid, in virtual pixels (as in
// #desktop-icons in os.css)
const ICON_WIDTH = 76;
const ICON_HEIGHT = 70;

// Every open app window: window id -> { id }. The id changes when the
// window's file is renamed, and apps always use the current one.
const openWindows = new Map();

// onShutDown is called after the user confirms Shut Down.
export function showDesktop(screen, { onShutDown }) {
  screen.innerHTML = `
    <div id="desktop">
      <div id="wallpaper"></div>
      <div id="desktop-icons"></div>
      <div id="taskbar">
        <button id="start-button">
          <span class="logo"><span></span><span></span><span></span><span></span></span>
          Start
        </button>
        <div id="taskbar-buttons"></div>
        <div id="tray">
          <button id="volume"></button>
          <button id="clock" aria-label="Calendar"></button>
        </div>
      </div>
    </div>
  `;

  const desktop = screen.querySelector('#desktop');
  initWindowManager(desktop);
  setUpBackground(desktop);
  createIcons(desktop);
  setUpDropping(desktop);

  // Redraw the taskbar buttons whenever a window opens, closes,
  // gets focus, or is minimized
  onWindowsChanged(renderTaskbarButtons);

  cleanups.push(setUpStartMenu(desktop, {
    apps: LISTED_APPS,
    onLaunch: launchApp,
    onShutDown: () => confirmShutDown(desktop, onShutDown),
    assistant: { icon: 'assets/icons/pigeon.svg', isHidden: isAssistantHidden, toggle: toggleAssistant },
  }));

  // Coo the pigeon, with tips in the corner
  cleanups.push(setUpAssistant(desktop));

  // Clicking the clock shows a calendar
  cleanups.push(setUpCalendar(desktop));

  // The speaker next to the clock turns the sound off and on
  setUpVolume(desktop);

  updateClock();
  const clockTimer = setInterval(updateClock, 1000);
  cleanups.push(() => clearInterval(clockTimer));
}

// The speaker in the tray. A red line through it means the sound
// is off.
function setUpVolume(desktop) {
  const button = desktop.querySelector('#volume');

  function draw() {
    const off = isMuted();
    button.innerHTML = off ? SPEAKER_OFF : SPEAKER_ON;
    button.title = off ? 'Sound is off. Click to turn it on.' : 'Sound is on. Click to turn it off.';
    button.setAttribute('aria-label', off ? 'Turn sound on' : 'Turn sound off');
  }

  button.addEventListener('click', () => {
    setMuted(!isMuted());
    draw();
    playDing();
  });
  draw();
}

const SPEAKER = '<path d="M1 5h3l4-4v14l-4-4H1z" fill="#c0c0c0" stroke="#000"/>';
const SPEAKER_ON = `<svg viewBox="0 0 16 16" shape-rendering="crispEdges">${SPEAKER}`
  + '<path d="M10 5.5q1.5 2.5 0 5M12 3.5q3 4.5 0 9" fill="none" stroke="#000"/></svg>';
const SPEAKER_OFF = `<svg viewBox="0 0 16 16" shape-rendering="crispEdges">${SPEAKER}`
  + '<path d="M10 4l5 8M15 4l-5 8" stroke="#ff0000" stroke-width="1.5"/></svg>';

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
    const icon = createIcon(app.icon, app.title, () => launchApp(app));
    icon.dataset.appId = app.id;
    // Apps can be moved around the desktop, but not deleted
    setUpFileDrag(icon, { name: app.title, icon: app.icon, canRecycle: false, onPlace: (spot) => placeIcon(icon, spot) });
    iconArea.append(icon);
  }

  iconArea.append(createRecycleBinIcon(desktop));

  // Saved files come after the apps (unless the icons are arranged,
  // see layoutIcons). They live in their own box
  // (display: contents, so they still line up in the same grid)
  // so we can redraw just them whenever a file is saved.
  const fileIcons = document.createElement('div');
  fileIcons.id = 'file-icons';
  iconArea.append(fileIcons);

  renderFileIcons();
  cleanups.push(onFilesChanged(renderFileIcons));

  // A renamed file's windows get new ids too, so double-clicking
  // the renamed file brings back the window it is already open in.
  // Its icon keeps its spot on the desktop.
  cleanups.push(onFileRenamed((oldName, newName) => {
    if (iconPositions[`file:${oldName}`]) {
      iconPositions[`file:${newName}`] = iconPositions[`file:${oldName}`];
      delete iconPositions[`file:${oldName}`];
      savePositions();
    }
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
      { separator: true },
      { label: 'Import Files...', action: () => chooseFilesToImport(desktop) },
      { label: 'Properties', action: () => launchApp(APPS.find((app) => app.id === 'display')) },
    ]);
  });

  // Pressing anywhere that isn't an icon (the empty desktop,
  // a window, the taskbar) clears the selection
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
    // Keys pressed while a window has the keyboard belong to that window
    if (event.target.closest('.window')) return;
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
  const icons = listFiles().map((file) => {
    const open = () => openFile(file.name);
    const icon = createIcon(fileTypeOf(file).icon, file.name, open);
    icon.dataset.fileName = file.name;

    // Drag it onto the Recycle Bin to delete it, or anywhere on the
    // desktop to move it there
    setUpFileDrag(icon, { name: file.name, icon: fileTypeOf(file).icon, onPlace: (spot) => placeIcon(icon, spot) });

    // Right-click: a small menu to open, rename or delete the file
    icon.addEventListener('contextmenu', (event) => {
      event.preventDefault();
      selectIcon(icon);
      showContextMenu(event, [
        { label: 'Open', action: open },
        // Any picture can go on the desktop
        ...(file.type === 'image' ? [{ label: 'Set as Wallpaper', action: () => setAsWallpaper(file.name) }] : []),
        { label: 'Save to My Computer', action: () => exportFile(document.querySelector('#desktop'), file.name) },
        { label: 'Rename', action: () => renameIcon(icon) },
        { label: 'Delete', action: () => confirmDelete(file.name) },
      ]);
    });

    return icon;
  });

  document.querySelector('#file-icons').replaceChildren(...icons);
  layoutIcons();
}

// ---------- Files from the real computer ----------

// Files dragged from the real computer can be dropped anywhere on
// the screen (the desktop or a window) to import them. While they're
// over it, the screen gets a dotted edge.
function setUpDropping(desktop) {
  const hasFiles = (event) => event.dataTransfer?.types.includes('Files');

  // Browsers let any picture on a page be dragged away (to save it,
  // say). On the desktop that would take over the mouse whenever an
  // icon is pressed by its picture, and icons couldn't be moved or
  // dropped on the Recycle Bin. ANACHRON does its own dragging, so
  // the browser's is switched off for pictures.
  desktop.addEventListener('dragstart', (event) => {
    if (event.target instanceof HTMLImageElement) event.preventDefault();
  });

  desktop.addEventListener('dragover', (event) => {
    if (!hasFiles(event)) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
    desktop.classList.add('is-drop-target');
  });

  desktop.addEventListener('dragleave', (event) => {
    // Only when leaving the whole desktop, not moving between its parts
    if (!desktop.contains(event.relatedTarget)) desktop.classList.remove('is-drop-target');
  });

  desktop.addEventListener('drop', (event) => {
    if (!hasFiles(event)) return;
    event.preventDefault();
    desktop.classList.remove('is-drop-target');
    importFiles(desktop, [...event.dataTransfer.files]);
  });
}

// ---------- Background ----------

// Draws the color, pattern and wallpaper chosen in Display Properties,
// and again whenever they change. Files changing matters too: the
// wallpaper picture may be saved again in Paint, or deleted.
function setUpBackground(desktop) {
  const layer = desktop.querySelector('#wallpaper');

  function paint() {
    const settings = currentDisplaySettings();
    paintBackground(layer, settings);
    // Icon labels sit on the desktop color, like the real thing,
    // so they can be read over any wallpaper
    desktop.style.setProperty('--desktop-color', settings.color);
    desktop.style.setProperty('--desktop-text', labelTextColor(settings.color));
  }

  paint();
  cleanups.push(onDisplaySettingsChanged(paint));
  cleanups.push(onFilesChanged(paint));
}

function setAsWallpaper(name) {
  saveDisplaySettings({ ...currentDisplaySettings(), wallpaper: name });
}

// ---------- Arranging icons ----------

// Puts every icon in its place. Icons that have been dragged somewhere
// stay there, and any icon without a spot yet (a file just saved)
// gets the first free place in the grid, so nothing lands on top of
// another icon. Until an icon is dragged, they all line up in the
// grid instead: in the order chosen with Arrange Icons, or apps
// first, then files in the order they were first saved.
function layoutIcons() {
  const icons = [...document.querySelectorAll('#desktop-icons .desktop-icon')];

  // Icons of files that are gone (deleted, or in the Recycle Bin)
  // give up their spot
  const keys = new Set(icons.map(iconKey));
  let pruned = false;
  for (const key of Object.keys(iconPositions)) {
    if (!keys.has(key)) {
      delete iconPositions[key];
      pruned = true;
    }
  }

  if (Object.keys(iconPositions).length === 0) {
    if (pruned) savePositions();
    for (const icon of icons) {
      icon.classList.remove('is-placed');
      icon.style.left = '';
      icon.style.top = '';
    }
    applyIconOrder(icons);
    return;
  }

  let added = false;
  for (const icon of icons) {
    const key = iconKey(icon);
    if (!iconPositions[key]) {
      iconPositions[key] = freeSpot();
      added = true;
    }
    const { x, y } = iconPositions[key];
    icon.classList.add('is-placed');
    icon.style.order = '';
    icon.style.left = `calc(var(--px) * ${x})`;
    icon.style.top = `calc(var(--px) * ${y})`;
  }
  if (added || pruned) savePositions();
}

// Grid order: puts every icon, apps and files alike, in the order
// chosen with Arrange Icons, using the CSS order property
function applyIconOrder(icons) {
  const files = new Map(listFiles().map((file) => [file.name, file]));
  const items = icons.map((el) => ({
    el,
    entry: el.dataset.fileName
      ? fileEntry(files.get(el.dataset.fileName))
      : appEntry(APPS.find((app) => app.id === el.dataset.appId)),
  }));

  sortByEntry(items, sortBy).forEach(({ el }, index) => {
    el.style.order = sortBy ? index : '';
  });
}

// An icon let go on the empty desktop (spot is where the dragged copy
// was, on screen). The first time, every icon keeps the place it has
// in the grid, so only the one moved changes.
function placeIcon(icon, spot) {
  const area = document.querySelector('#desktop-icons');
  const origin = area.getBoundingClientRect();
  const { scale, width, height } = measureIconArea();
  const toVirtual = (rect) => ({
    x: Math.round((rect.left - origin.left) / scale),
    y: Math.round((rect.top - origin.top) / scale),
  });

  if (Object.keys(iconPositions).length === 0) {
    for (const other of area.querySelectorAll('.desktop-icon')) {
      iconPositions[iconKey(other)] = toVirtual(other.getBoundingClientRect());
    }
  }

  // Kept on the desktop, and off the taskbar
  const { x, y } = toVirtual(spot);
  iconPositions[iconKey(icon)] = {
    x: Math.min(Math.max(x, 0), Math.max(0, width - ICON_WIDTH)),
    y: Math.min(Math.max(y, 0), Math.max(0, height - ICON_HEIGHT)),
  };
  savePositions();
  layoutIcons();
  selectIcon(icon);
}

// The first place in the grid (down each column, then the next
// column) that no icon is on
function freeSpot() {
  const { width, height } = measureIconArea();
  const taken = Object.values(iconPositions);
  const rows = Math.max(1, Math.floor(height / ICON_HEIGHT));
  const columns = Math.max(1, Math.floor(width / ICON_WIDTH));

  for (let column = 0; column < columns; column++) {
    for (let row = 0; row < rows; row++) {
      const x = column * ICON_WIDTH;
      const y = row * ICON_HEIGHT;
      const clear = taken.every((p) => Math.abs(p.x - x) >= ICON_WIDTH || Math.abs(p.y - y) >= ICON_HEIGHT);
      if (clear) return { x, y };
    }
  }
  // A completely full desktop: the top left corner, on top
  return { x: 0, y: 0 };
}

// The icon area's size in virtual pixels, and how many screen pixels
// one virtual pixel is. It runs from the icons' left edge to the
// desktop's right edge, and down to just above the taskbar.
function measureIconArea() {
  const area = document.querySelector('#desktop-icons');
  const desktop = document.querySelector('#desktop');
  const probe = document.createElement('div');
  probe.style.cssText = 'position: absolute; visibility: hidden; width: calc(var(--px) * 100);';
  desktop.append(probe);
  const scale = probe.getBoundingClientRect().width / 100 || 1;
  probe.remove();

  const areaRect = area.getBoundingClientRect();
  const desktopRect = desktop.getBoundingClientRect();
  return {
    scale,
    width: (desktopRect.right - areaRect.left) / scale,
    height: areaRect.height / scale,
  };
}

function iconKey(icon) {
  return icon.dataset.fileName ? `file:${icon.dataset.fileName}` : `app:${icon.dataset.appId}`;
}

// Arrange Icons: lines every icon up in the grid, sorted, and keeps
// them sorted that way as files are saved, renamed or deleted, until
// an icon is dragged somewhere again
function arrangeIcons(order) {
  sortBy = order;
  iconPositions = {};
  savePositions();
  try {
    localStorage.setItem(SORT_STORAGE_KEY, order);
  } catch {
    // Not kept, but the icons are still sorted until the page closes
  }
  layoutIcons();
}

function loadPositions() {
  try {
    return JSON.parse(localStorage.getItem(POSITIONS_STORAGE_KEY)) ?? {};
  } catch {
    return {};
  }
}

function savePositions() {
  try {
    localStorage.setItem(POSITIONS_STORAGE_KEY, JSON.stringify(iconPositions));
  } catch {
    // Not kept, but the icons stay put until the page closes
  }
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
  icon.dataset.appId = app.id;
  // Files dragged onto it go in the bin (see file-drag.js)
  icon.dataset.dropTarget = 'recycle';
  // The bin itself can be moved around the desktop
  setUpFileDrag(icon, { name: app.title, icon: app.icon, canRecycle: false, onPlace: (spot) => placeIcon(icon, spot) });
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
  // The app's other windows (see openWindow below), by key
  const extraWindows = new Map();
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
    // Lets an app close its own window (e.g. an OK button)
    close() {
      requestClose(handle.id);
    },
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
    // Shakes the window for a moment, or makes its taskbar button
    // flash until it's looked at
    shake() {
      shakeWindow(handle.id);
    },
    callForAttention() {
      callForAttention(handle.id);
    },
    // Lets an app open more windows of its own, like a conversation in
    // Messenger. key tells them apart; asking for the same key again
    // brings that window back to the front. Gives back what the app
    // can do with the window: setTitle, focus, close, shake and
    // callForAttention.
    openWindow({ key, title: windowTitle, width, height, minWidth, minHeight, content, onClose }) {
      const extraId = `${app.id}:${key}`;
      if (hasWindow(extraId)) {
        restoreWindow(extraId);
        return extraWindows.get(key);
      }

      const extra = {
        id: extraId,
        setTitle: (newTitle) => setWindowTitle(extraId, newTitle),
        focus: () => restoreWindow(extraId),
        close: () => requestClose(extraId),
        shake: () => shakeWindow(extraId),
        callForAttention: () => callForAttention(extraId),
      };
      extraWindows.set(key, extra);
      openWindow({
        id: extraId,
        title: windowTitle,
        icon: app.icon,
        width,
        height,
        minWidth,
        minHeight,
        content,
        beside: handle.id,
        onClose: () => {
          extraWindows.delete(key);
          onClose?.();
        },
      });
      return extra;
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
  tellAssistant(`open-${app.id}`);
  openWindow({
    id,
    title,
    icon: app.icon,
    width: size?.width ?? app.width,
    height: size?.height ?? app.height,
    resizable: app.resizable !== false,
    minWidth: app.minWidth,
    minHeight: app.minHeight,
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
    // Flashes when the window wants you to look (a new message)
    button.classList.toggle('is-flashing', Boolean(win.attention));
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
  const now = new Date();
  clock.textContent = now.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });
  // Pointing at the clock shows the whole date
  clock.title = formatLongDate(now);
}