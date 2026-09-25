// The desktop: icons, taskbar and clock.

import { APPS } from '../app.js';
import { initWindowManager, openWindow } from '../system/wm.js';

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
        <div id="clock"></div>
      </div>
    </div>
  `;

  const desktop = screen.querySelector('#desktop');
  initWindowManager(desktop);
  createIcons(desktop);

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

// ---------- Clock ----------

function updateClock() {
  const clock = document.querySelector('#clock');
  clock.textContent = new Date().toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });
}