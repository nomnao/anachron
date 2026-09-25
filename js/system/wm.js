// The window manager.
// It is the only code that creates, moves, stacks, minimizes,
// maximizes and closes windows.
// Everything is measured in "virtual pixels" of a 640-pixel-wide screen.

const DESKTOP_WIDTH = 640;
const TASKBAR_HEIGHT = 28;
const DOUBLE_CLICK_MS = 450;

// window id -> { id, title, icon, x, y, width, height, z, minimized, maximized, el }
const windows = new Map();
let activeId = null;
let desktop = null;

// Functions that want to hear about any change (the taskbar is one)
const listeners = [];

export function initWindowManager(desktopElement) {
  desktop = desktopElement;
}

// ---------- Telling others what changed ----------

// Call onWindowsChanged(fn) and fn will run after every change.
export function onWindowsChanged(listener) {
  listeners.push(listener);
}

// A simple list the taskbar can draw from, in the order windows were opened.
export function getWindowList() {
  return [...windows.values()].map((win) => ({
    id: win.id,
    title: win.title,
    icon: win.icon,
    minimized: win.minimized,
    active: win.id === activeId,
  }));
}

function notify() {
  const list = getWindowList();
  for (const listener of listeners) listener(list);
}

// ---------- Opening and closing ----------

export function openWindow({ id, title, icon, width, height, content }) {
  // Only one window per app for now: if it is already open, bring it back
  if (windows.has(id)) {
    restoreWindow(id);
    return;
  }

  // New windows open to the right of the icons, each a little
  // lower and further right than the last one
  const offset = (windows.size % 6) * 22;
  const win = {
    id, title, icon,
    x: 110 + offset, y: 20 + offset, width, height,
    z: 0, minimized: false, maximized: false, el: null,
  };

  win.el = createWindowElement(win, content);
  desktop.append(win.el);
  windows.set(id, win);

  applyGeometry(win);
  focusWindow(id);
}

export function hasWindow(id) {
  return windows.has(id);
}

export function closeWindow(id) {
  const win = windows.get(id);
  if (!win) return;

  win.el.remove();
  windows.delete(id);

  if (activeId === id) {
    activeId = null;
    focusTopWindow();
  }
  notify();
}

// Changes the text in a window's title bar and taskbar button.
export function setWindowTitle(id, title) {
  const win = windows.get(id);
  if (!win) return;

  win.title = title;
  win.el.querySelector('.title-text').textContent = title;
  notify();
}

// ---------- Focus ----------

export function focusWindow(id) {
  const win = windows.get(id);
  if (!win || win.minimized) return;

  // Put this window on top, then renumber every window 1, 2, 3...
  // so z-index never climbs past the taskbar's
  win.z = Infinity;
  const stack = [...windows.values()].sort((a, b) => a.z - b.z);
  stack.forEach((other, index) => {
    other.z = index + 1;
    other.el.style.zIndex = other.z;
  });
  activeId = id;

  for (const other of windows.values()) {
    other.el.classList.toggle('is-active', other === win);
  }
  notify();
}

// Gives focus to the highest window that is still visible, if any.
function focusTopWindow() {
  const visible = [...windows.values()].filter((win) => !win.minimized);
  visible.sort((a, b) => b.z - a.z);

  if (visible.length > 0) {
    focusWindow(visible[0].id);
  } else {
    activeId = null;
    for (const win of windows.values()) win.el.classList.remove('is-active');
  }
}

// ---------- Minimize, restore, maximize ----------

export function minimizeWindow(id) {
  const win = windows.get(id);
  if (!win || win.minimized) return;

  win.minimized = true;
  win.el.classList.add('is-minimized');
  win.el.classList.remove('is-active');

  if (activeId === id) {
    activeId = null;
    focusTopWindow();
  }
  notify();
}

// Shows a minimized window again and brings it to the front.
export function restoreWindow(id) {
  const win = windows.get(id);
  if (!win) return;

  win.minimized = false;
  win.el.classList.remove('is-minimized');
  focusWindow(id);
}

export function toggleMaximize(id) {
  const win = windows.get(id);
  if (!win) return;

  // We only flip a flag. x, y, width and height are kept,
  // so un-maximizing puts the window back where it was.
  win.maximized = !win.maximized;
  win.el.classList.toggle('is-maximized', win.maximized);

  const button = win.el.querySelector('[data-action="maximize"]');
  button.setAttribute('aria-label', win.maximized ? 'Restore' : 'Maximize');

  applyGeometry(win);
  focusWindow(id);
}

// What a taskbar button does when clicked, like on the real thing:
// minimized -> bring it back; active -> minimize it; behind others -> bring forward.
export function taskbarClick(id) {
  const win = windows.get(id);
  if (!win) return;

  if (win.minimized) {
    restoreWindow(id);
  } else if (activeId === id) {
    minimizeWindow(id);
  } else {
    focusWindow(id);
  }
}

// ---------- Building a window ----------

function createWindowElement(win, content) {
  const el = document.createElement('div');
  el.className = 'window';
  el.innerHTML = `
    <div class="title-bar">
      <img class="title-icon" src="${win.icon}" alt="">
      <span class="title-text"></span>
      <div class="title-buttons">
        <button class="title-button" data-action="minimize" aria-label="Minimize"><span class="glyph-min"></span></button>
        <button class="title-button" data-action="maximize" aria-label="Maximize"><span class="glyph-max"></span></button>
        <button class="title-button" data-action="close" aria-label="Close"><span class="glyph-close"></span></button>
      </div>
    </div>
    <div class="window-body"></div>
  `;

  // Titles can contain file names people typed, so they are
  // set as plain text, never as HTML
  el.querySelector('.title-text').textContent = win.title;

  // Content can be plain HTML, or an element an app built itself
  const body = el.querySelector('.window-body');
  if (typeof content === 'string') {
    body.innerHTML = content;
  } else {
    body.append(content);
  }

  // Clicking anywhere on a window brings it to the front
  el.addEventListener('pointerdown', () => focusWindow(win.id));

  el.querySelector('[data-action="minimize"]').addEventListener('click', () => minimizeWindow(win.id));
  el.querySelector('[data-action="maximize"]').addEventListener('click', () => toggleMaximize(win.id));
  el.querySelector('[data-action="close"]').addEventListener('click', () => closeWindow(win.id));

  // Title bar: drag to move, double-click to maximize / restore.
  // We time the double-click ourselves so it also works with a finger.
  const titleBar = el.querySelector('.title-bar');
  let lastTitleClick = 0;

  titleBar.addEventListener('pointerdown', (event) => {
    if (event.target.closest('button')) return;

    const now = Date.now();
    if (now - lastTitleClick < DOUBLE_CLICK_MS) {
      lastTitleClick = 0;
      toggleMaximize(win.id);
      return;
    }
    lastTitleClick = now;

    // A maximized window stays put
    if (!win.maximized) startDrag(win, event);
  });

  return el;
}

// Writes the window's position and size into its style.
function applyGeometry(win) {
  if (win.maximized) {
    // Fill the whole desktop except the taskbar
    win.el.style.left = '0';
    win.el.style.top = '0';
    win.el.style.width = '100%';
    win.el.style.height = `calc(100% - var(--px) * ${TASKBAR_HEIGHT})`;
    return;
  }

  win.el.style.left = `calc(var(--px) * ${win.x})`;
  win.el.style.top = `calc(var(--px) * ${win.y})`;
  win.el.style.width = `calc(var(--px) * ${win.width})`;
  win.el.style.height = `calc(var(--px) * ${win.height})`;
}

// ---------- Dragging ----------

function startDrag(win, event) {
  event.preventDefault();

  // How many real screen pixels one virtual pixel is right now
  const rect = desktop.getBoundingClientRect();
  const scale = rect.width / DESKTOP_WIDTH;
  const desktopHeight = rect.height / scale;

  const startPointerX = event.clientX;
  const startPointerY = event.clientY;
  const startX = win.x;
  const startY = win.y;

  const titleBar = event.currentTarget;
  titleBar.setPointerCapture(event.pointerId);

  function onMove(moveEvent) {
    const dx = (moveEvent.clientX - startPointerX) / scale;
    const dy = (moveEvent.clientY - startPointerY) / scale;

    // Keep enough of the title bar on screen to grab it again
    win.x = clamp(startX + dx, 40 - win.width, DESKTOP_WIDTH - 40);
    win.y = clamp(startY + dy, 0, desktopHeight - TASKBAR_HEIGHT - 18);

    applyGeometry(win);
  }

  function onEnd() {
    titleBar.removeEventListener('pointermove', onMove);
    titleBar.removeEventListener('pointerup', onEnd);
    titleBar.removeEventListener('pointercancel', onEnd);
  }

  titleBar.addEventListener('pointermove', onMove);
  titleBar.addEventListener('pointerup', onEnd);
  titleBar.addEventListener('pointercancel', onEnd);
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}