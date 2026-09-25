// The desktop: icons, taskbar and clock.

import { APPS } from '../app.js';
import {
  initWindowManager, openWindow, hasWindow, restoreWindow,
  setWindowTitle, onWindowsChanged, taskbarClick,
} from '../system/wm.js';
import { listFiles, onFilesChanged } from '../system/fs.js';

const DOUBLE_CLICK_MS = 450;

export function showDesktop(screen) {
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

  updateClock();
  setInterval(updateClock, 1000);
}

// ---------- Icons ----------

const TEXT_FILE_ICON = 'assets/icons/text-file.svg';

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
  onFilesChanged(renderFileIcons);

  // Clicking empty desktop clears the selection
  desktop.addEventListener('pointerdown', (event) => {
    if (event.target === desktop || event.target === iconArea) {
      selectIcon(null);
    }
  });
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
  const notepad = APPS.find((app) => app.id === 'notepad');
  const icons = listFiles().map((file) =>
    createIcon(TEXT_FILE_ICON, file.name, () => launchApp(notepad, { fileName: file.name })),
  );
  document.querySelector('#file-icons').replaceChildren(...icons);
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