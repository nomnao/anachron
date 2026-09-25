// The desktop: icons, taskbar and clock.

import { APPS } from '../app.js';
import { initWindowManager, openWindow, onWindowsChanged, taskbarClick } from '../system/wm.js';

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

function createIcons(desktop) {
  const iconArea = desktop.querySelector('#desktop-icons');

  for (const app of APPS) {
    const icon = document.createElement('button');
    icon.className = 'desktop-icon';
    icon.innerHTML = `
      <img src="${app.icon}" alt="">
      <span class="icon-label">${app.title}</span>
    `;
    icon.addEventListener('click', () => handleIconClick(icon, app));
    iconArea.append(icon);
  }

  // Clicking empty desktop clears the selection
  desktop.addEventListener('pointerdown', (event) => {
    if (event.target === desktop || event.target === iconArea) {
      selectIcon(null);
    }
  });
}

// We detect double-clicks ourselves, so it works the same
// with a mouse and with a finger on a phone.
let lastClickedIcon = null;
let lastClickTime = 0;

function handleIconClick(icon, app) {
  const now = Date.now();
  const isDoubleClick = icon === lastClickedIcon && now - lastClickTime < DOUBLE_CLICK_MS;

  lastClickedIcon = icon;
  lastClickTime = now;

  selectIcon(icon);

  if (isDoubleClick) {
    lastClickedIcon = null;
    launchApp(app);
  }
}

function selectIcon(icon) {
  for (const other of document.querySelectorAll('.desktop-icon')) {
    other.classList.toggle('is-selected', other === icon);
  }
}

function launchApp(app) {
  openWindow({
    id: app.id,
    title: app.title,
    icon: app.icon,
    width: app.width,
    height: app.height,
    content: `
      <div class="placeholder">
        <img src="${app.icon}" alt="">
        <p>${app.title} will be installed in a later phase.</p>
      </div>
    `,
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
      <span class="taskbar-button-text">${win.title}</span>
    `;
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