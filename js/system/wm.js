// The window manager.
// It is the only code that creates, moves, resizes, stacks,
// minimizes, maximizes and closes windows.
// Everything is measured in "virtual pixels" (the CSS --px unit).

const TASKBAR_HEIGHT = 28;
const DOUBLE_CLICK_MS = 450;

// The smallest a window can be made by dragging its edges, unless
// its app asks for more
const MIN_WIDTH = 200;
const MIN_HEIGHT = 120;

// The edges and corners a window can be resized from
const RESIZE_EDGES = ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'];

// window id -> { id, title, icon, x, y, width, height, z, minimized, maximized, el,
//                 resizable, minWidth, minHeight, onClose, beforeClose, closing,
//                 attention }
const windows = new Map();
let activeId = null;
let desktop = null;

// Functions that want to hear about any change (the taskbar is one)
const listeners = [];

// Called on every boot. Forgets any windows and listeners
// left over from before a shut down, so each boot starts clean.
export function initWindowManager(desktopElement) {
  desktop = desktopElement;
  windows.clear();
  activeId = null;
  listeners.length = 0;
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
    attention: win.attention,
  }));
}

function notify() {
  const list = getWindowList();
  for (const listener of listeners) listener(list);
}

// ---------- Opening and closing ----------

// beforeClose (optional) runs when someone asks to close the window.
// It can ask about unsaved changes, and gives back (or resolves to)
// false to keep the window open.
// onClose (optional) runs when the window closes, so an app can
// stop anything it started, like a webcam.
// resizable (true unless false) lets its edges be dragged, down to
// minWidth x minHeight (optional).
// beside (optional) is another window's id: the new window opens next
// to it instead of in the usual place, like a conversation opening
// next to Messenger's contact list.
export function openWindow({
  id, title, icon, width, height, content, onClose, beforeClose,
  resizable = true, minWidth = MIN_WIDTH, minHeight = MIN_HEIGHT, beside,
}) {
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
    z: 0, minimized: false, maximized: false, el: null, onClose, beforeClose, closing: false, attention: false,
    resizable, minWidth: Math.min(minWidth, width), minHeight: Math.min(minHeight, height),
  };

  // Next to another window: on its right if there's room, else on its
  // left, a little lower for each window already open beside it
  const neighbor = windows.get(beside);
  const screen = measureDesktop();
  if (neighbor && !neighbor.maximized && screen) {
    const besideIt = [...windows.values()].filter((other) => other.beside === beside).length;
    const right = neighbor.x + neighbor.width + 4;
    win.x = right + width <= screen.width ? right : neighbor.x - width - 4;
    win.y = neighbor.y + (besideIt % 5) * 22;
    win.beside = beside;
  }

  // A wide or tall window (like Solitaire) moves left or up so it
  // isn't cut off by the edge of the screen
  if (screen) {
    win.x = clamp(win.x, 0, Math.max(0, screen.width - width));
    win.y = clamp(win.y, 0, Math.max(0, screen.height - TASKBAR_HEIGHT - height));
  }

  win.el = createWindowElement(win, content);
  desktop.append(win.el);
  windows.set(id, win);

  applyGeometry(win);
  focusWindow(id);
  giveKeyboardTo(win);
}

// Moves the keyboard into a window that has just come to the front
// (opened, or brought back from the taskbar), so typing goes to it
// and not to whatever had the keyboard before, like a desktop icon.
// Notepad's text area gets it, or else the app's own area, or else
// the window itself.
function giveKeyboardTo(win) {
  if (win.el.contains(document.activeElement)) return;
  const target = win.el.querySelector('.window-body textarea, .window-body [tabindex="-1"]') ?? win.el;
  target.focus({ preventScroll: true });
}

export function hasWindow(id) {
  return windows.has(id);
}

export function closeWindow(id) {
  const win = windows.get(id);
  if (!win) return;

  win.onClose?.();
  win.el.remove();
  windows.delete(id);

  if (activeId === id) {
    activeId = null;
    focusTopWindow();
  }
  notify();
}

// Gives a window a new id, e.g. 'notepad:old.txt' -> 'notepad:new.txt'
// when its file is renamed, so opening the file again finds it.
export function renameWindow(oldId, newId) {
  const win = windows.get(oldId);
  if (!win || windows.has(newId)) return;

  windows.delete(oldId);
  win.id = newId;
  windows.set(newId, win);
  if (activeId === oldId) activeId = newId;
  notify();
}

// Asks the window's app first (it may want to save), then closes it.
// Gives back true if the window closed.
export async function requestClose(id) {
  const win = windows.get(id);
  if (!win) return true;
  // Already asking (e.g. the close button was clicked twice)
  if (win.closing) return false;

  win.closing = true;
  const ok = win.beforeClose ? await win.beforeClose() : true;
  win.closing = false;

  if (ok) closeWindow(win.id);
  return ok;
}

// Asks every window in turn, e.g. before shutting down. Each one is
// brought to the front first, so you can see what is being asked
// about. Stops (and gives back false) if any window stays open.
export async function requestCloseAll() {
  for (const win of [...windows.values()]) {
    if (!windows.has(win.id)) continue;
    if (win.beforeClose) restoreWindow(win.id);
    if (!(await requestClose(win.id))) return false;
  }
  return true;
}

// Closes every window, e.g. when the computer shuts down,
// so each app gets the chance to clean up.
export function closeAllWindows() {
  for (const id of [...windows.keys()]) closeWindow(id);
}

// Changes the text in a window's title bar and taskbar button.
export function setWindowTitle(id, title) {
  const win = windows.get(id);
  if (!win) return;

  win.title = title;
  win.el.querySelector('.title-text').textContent = title;
  notify();
}

// Changes a window's size, e.g. when Minesweeper switches to a bigger
// board. The window moves left or up if it would no longer fit.
export function setWindowSize(id, width, height) {
  const win = windows.get(id);
  if (!win) return;

  win.width = width;
  win.height = height;

  const screen = measureDesktop();
  if (screen) {
    win.x = clamp(win.x, 0, Math.max(0, screen.width - width));
    win.y = clamp(win.y, 0, Math.max(0, screen.height - TASKBAR_HEIGHT - height));
  }

  applyGeometry(win);
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
  // Looking at a window answers its call for attention
  win.attention = false;

  for (const other of windows.values()) {
    other.el.classList.toggle('is-active', other === win);
  }
  notify();
}

// ---------- Getting noticed ----------

// Makes a window's taskbar button flash until the window is brought
// to the front, e.g. a new message in a conversation you're not
// looking at. A window already in front doesn't need to.
export function callForAttention(id) {
  const win = windows.get(id);
  if (!win || (win.id === activeId && !win.minimized)) return;
  win.attention = true;
  notify();
}

// Shakes a window from side to side for a moment (a "nudge")
export function shakeWindow(id) {
  const win = windows.get(id);
  if (!win || win.maximized) return;
  win.el.classList.remove('is-shaking');
  // Reading the size restarts the animation if it was already shaking
  void win.el.offsetWidth;
  win.el.classList.add('is-shaking');
  win.el.addEventListener('animationend', () => win.el.classList.remove('is-shaking'), { once: true });
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
  giveKeyboardTo(win);
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
    giveKeyboardTo(win);
  }
}

// ---------- Building a window ----------

function createWindowElement(win, content) {
  const el = document.createElement('div');
  el.className = 'window';
  // Lets the window itself hold the keyboard (see giveKeyboardTo)
  el.tabIndex = -1;
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
  el.querySelector('[data-action="close"]').addEventListener('click', () => requestClose(win.id));

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

  // Invisible strips along the edges and squares at the corners,
  // to drag the window bigger or smaller
  if (win.resizable) {
    for (const edge of RESIZE_EDGES) {
      const handle = document.createElement('div');
      handle.className = `resize-handle resize-${edge}`;
      handle.addEventListener('pointerdown', (event) => {
        if (event.button !== 0 || win.maximized) return;
        startResize(win, edge, event);
      });
      el.append(handle);
    }
  }

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

  const { scale, width: desktopWidth, height: desktopHeight } = measureDesktop();

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
    win.x = clamp(startX + dx, 40 - win.width, desktopWidth - 40);
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

// ---------- Resizing ----------

// Drags one edge (or two, at a corner) of the window. The opposite
// edges stay where they are. The window can't get smaller than its
// minimum size, or reach past the edges of the desktop.
function startResize(win, edge, event) {
  event.preventDefault();
  event.stopPropagation();
  focusWindow(win.id);

  const screen = measureDesktop();
  const { scale } = screen;
  const desktopWidth = screen.width;
  const desktopHeight = screen.height - TASKBAR_HEIGHT;

  const startPointerX = event.clientX;
  const startPointerY = event.clientY;
  const start = { left: win.x, top: win.y, right: win.x + win.width, bottom: win.y + win.height };

  const handle = event.currentTarget;
  handle.setPointerCapture(event.pointerId);

  function onMove(moveEvent) {
    const dx = (moveEvent.clientX - startPointerX) / scale;
    const dy = (moveEvent.clientY - startPointerY) / scale;
    let { left, top, right, bottom } = start;

    if (edge.includes('e')) right = clamp(start.right + dx, left + win.minWidth, Math.max(desktopWidth, right));
    if (edge.includes('w')) left = clamp(start.left + dx, Math.min(0, left), right - win.minWidth);
    if (edge.includes('s')) bottom = clamp(start.bottom + dy, top + win.minHeight, Math.max(desktopHeight, bottom));
    if (edge.includes('n')) top = clamp(start.top + dy, 0, bottom - win.minHeight);

    win.x = left;
    win.y = top;
    win.width = right - left;
    win.height = bottom - top;
    applyGeometry(win);
  }

  function onEnd() {
    handle.removeEventListener('pointermove', onMove);
    handle.removeEventListener('pointerup', onEnd);
    handle.removeEventListener('pointercancel', onEnd);
  }

  handle.addEventListener('pointermove', onMove);
  handle.addEventListener('pointerup', onEnd);
  handle.addEventListener('pointercancel', onEnd);
}

// How many real screen pixels one virtual pixel is right now, and
// the desktop's size in virtual pixels. One virtual pixel is measured
// rather than worked out from the desktop's width, since the desktop
// isn't exactly 640 of them wide. Gives back null while the desktop
// isn't on screen.
function measureDesktop() {
  const probe = document.createElement('div');
  probe.style.cssText = 'position: absolute; visibility: hidden; width: calc(var(--px) * 100);';
  desktop.append(probe);
  const scale = probe.getBoundingClientRect().width / 100;
  probe.remove();

  if (!scale) return null;
  const rect = desktop.getBoundingClientRect();
  return { scale, width: rect.width / scale, height: rect.height / scale };
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}