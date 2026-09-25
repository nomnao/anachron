// The window manager.
// It is the only code that creates, moves, stacks and closes windows.
// Everything is measured in "virtual pixels" of a 640-pixel-wide screen.

const DESKTOP_WIDTH = 640;
const TASKBAR_HEIGHT = 28;

const windows = new Map(); // window id -> { id, x, y, width, height, el }
let topZ = 0;
let desktop = null;

export function initWindowManager(desktopElement) {
  desktop = desktopElement;
}

export function openWindow({ id, title, icon, width, height, content }) {
  // Only one window per app for now: if it is already open, bring it forward
  if (windows.has(id)) {
    focusWindow(id);
    return;
  }

  // New windows open to the right of the icons, each a little
  // lower and further right than the last one
  const offset = (windows.size % 6) * 22;
  const win = { id, x: 110 + offset, y: 20 + offset, width, height, el: null };

  win.el = createWindowElement(win, title, icon, content);
  desktop.append(win.el);
  windows.set(id, win);

  applyGeometry(win);
  focusWindow(id);
}

export function focusWindow(id) {
  const win = windows.get(id);
  if (!win) return;

  topZ += 1;
  win.el.style.zIndex = topZ;

  for (const other of windows.values()) {
    other.el.classList.toggle('is-active', other === win);
  }
}

export function closeWindow(id) {
  const win = windows.get(id);
  if (!win) return;

  win.el.remove();
  windows.delete(id);

  // Give focus to whichever window is now on top
  const next = [...windows.values()].sort((a, b) => b.el.style.zIndex - a.el.style.zIndex)[0];
  if (next) focusWindow(next.id);
}

// ---------- Building a window ----------

function createWindowElement(win, title, icon, content) {
  const el = document.createElement('div');
  el.className = 'window';
  el.innerHTML = `
    <div class="title-bar">
      <img class="title-icon" src="${icon}" alt="">
      <span class="title-text">${title}</span>
      <div class="title-buttons">
        <button class="title-button" data-action="minimize" aria-label="Minimize"><span class="glyph-min"></span></button>
        <button class="title-button" data-action="maximize" aria-label="Maximize"><span class="glyph-max"></span></button>
        <button class="title-button" data-action="close" aria-label="Close"><span class="glyph-close"></span></button>
      </div>
    </div>
    <div class="window-body">${content}</div>
  `;

  // Clicking anywhere on a window brings it to the front
  el.addEventListener('pointerdown', () => focusWindow(win.id));

  el.querySelector('[data-action="close"]').addEventListener('click', () => closeWindow(win.id));

  const titleBar = el.querySelector('.title-bar');
  titleBar.addEventListener('pointerdown', (event) => {
    if (event.target.closest('button')) return;
    startDrag(win, event);
  });

  return el;
}

// Writes the window's position and size into its style.
function applyGeometry(win) {
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