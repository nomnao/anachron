// The desktop: icons, taskbar, Start menu and clock.

import { APPS } from '../app.js';
import {
  initWindowManager, openWindow, hasWindow, restoreWindow,
  setWindowTitle, onWindowsChanged, taskbarClick,
} from '../system/wm.js';
import { listFiles, deleteFile, onFilesChanged } from '../system/fs.js';
import { showConfirmDialog } from './dialogs.js';
import { setUpStartMenu } from './start-menu.js';

const DOUBLE_CLICK_MS = 450;

// Things to undo when the desktop goes away (timers, listeners
// on the whole page), so nothing is left running after a shut down
const cleanups = [];

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
    apps: APPS,
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

  if (confirmed) onShutDown();
}

// ---------- Icons ----------

// What each type of file looks like, and which app opens it
const FILE_TYPES = {
  text:  { icon: 'assets/icons/text-file.svg',  appId: 'notepad' },
  image: { icon: 'assets/icons/image-file.svg', appId: 'paint' },
};

function createIcons(desktop) {
  const iconArea = desktop.querySelector('#desktop-icons');

  for (const app of APPS) {
    iconArea.append(createIcon(app.icon, app.title, () => launchApp(app)));
  }

  // Saved files come after the apps. They live in their own box
  // (display: contents, so they still line up in the same grid)
  // so we can redraw just them whenever a file is saved.
  const fileIcons = document.createElement('div');
  fileIcons.id = 'file-icons';
  iconArea.append(fileIcons);

  renderFileIcons();
  cleanups.push(onFilesChanged(renderFileIcons));

  // Pressing anywhere that isn't an icon (the empty desktop,
  // a window, the taskbar) clears the selection
  desktop.addEventListener('pointerdown', (event) => {
    if (!event.target.closest('.desktop-icon')) {
      selectIcon(null);
    }
  });

  // Delete (or Backspace, since Mac laptops have no Delete key)
  // deletes the selected file, unless you are typing somewhere
  function onKeyDown(event) {
    if (event.key !== 'Delete' && event.key !== 'Backspace') return;
    if (event.target.closest('input, textarea')) return;
    if (desktop.querySelector('.dialog-overlay')) return;

    const selected = desktop.querySelector('.desktop-icon.is-selected');
    if (selected?.dataset.fileName) {
      event.preventDefault();
      confirmDelete(selected.dataset.fileName);
    }
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
    const type = FILE_TYPES[file.type] ?? FILE_TYPES.text;
    const app = APPS.find((a) => a.id === type.appId);
    const open = () => launchApp(app, { fileName: file.name });
    const icon = createIcon(type.icon, file.name, open);
    icon.dataset.fileName = file.name;

    // Right-click: a small menu to open or delete the file
    icon.addEventListener('contextmenu', (event) => {
      event.preventDefault();
      selectIcon(icon);
      showContextMenu(event, [
        { label: 'Open', action: open },
        { label: 'Delete', action: () => confirmDelete(file.name) },
      ]);
    });

    return icon;
  });

  document.querySelector('#file-icons').replaceChildren(...icons);
}

async function confirmDelete(name) {
  const desktop = document.querySelector('#desktop');
  const confirmed = await showConfirmDialog(desktop, {
    title: 'Confirm File Delete',
    message: `Are you sure you want to delete '${name}'?`,
    confirmLabel: 'Yes',
    cancelLabel: 'No',
  });

  if (confirmed) deleteFile(name);
}

// ---------- Right-click menu ----------

// Shows a list of { label, action } where the pointer is.
// Choosing one, or pressing anywhere else, closes it.
function showContextMenu(event, items) {
  const desktop = document.querySelector('#desktop');
  desktop.querySelector('.context-menu')?.remove();

  const menu = document.createElement('div');
  menu.className = 'menu-items context-menu';

  for (const item of items) {
    const button = document.createElement('button');
    button.textContent = item.label;
    button.addEventListener('click', () => {
      close();
      item.action();
    });
    menu.append(button);
  }

  desktop.append(menu);

  // Open at the pointer, but keep the whole menu on screen
  const area = desktop.getBoundingClientRect();
  const x = Math.min(event.clientX - area.left, area.width - menu.offsetWidth);
  const y = Math.min(event.clientY - area.top, area.height - menu.offsetHeight);
  menu.style.left = `${x}px`;
  menu.style.top = `${y}px`;

  function onPointerDown(downEvent) {
    if (!menu.contains(downEvent.target)) close();
  }

  function close() {
    menu.remove();
    document.removeEventListener('pointerdown', onPointerDown, true);
  }

  // "true" = hear about the press before anything else does
  document.addEventListener('pointerdown', onPointerDown, true);
}

// We detect double-clicks ourselves, so it works the same
// with a mouse and with a finger on a phone.
let lastClickedIcon = null;
let lastClickTime = 0;

function handleIconClick(icon, onOpen) {
  const now = Date.now();
  const isDoubleClick = icon === lastClickedIcon && now - lastClickTime < DOUBLE_CLICK_MS;

  lastClickedIcon = icon;
  lastClickTime = now;

  selectIcon(icon);

  if (isDoubleClick) {
    lastClickedIcon = null;
    onOpen();
  }
}

function selectIcon(icon) {
  for (const other of document.querySelectorAll('.desktop-icon')) {
    other.classList.toggle('is-selected', other === icon);
  }
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

  // What the app gets to work with. An app can call setTitle
  // while it starts up, before its window exists; we keep that
  // title and open the window with it.
  let title = app.title;
  const context = {
    fileName: options.fileName ?? null,
    setTitle(newTitle) {
      title = newTitle;
      setWindowTitle(id, newTitle);
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

  openWindow({
    id,
    title,
    icon: app.icon,
    width: app.width,
    height: app.height,
    content,
  });
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