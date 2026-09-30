// Dragging a file (a desktop icon or a row in My Files) onto the
// Recycle Bin, like the real thing: its icon or its open window.
//
// A press that moves a little starts a drag: a see-through copy of
// the file's icon follows the pointer, and the Recycle Bin lights up
// while the file is over it. Letting go there asks, then sends the
// file to the bin. Letting go anywhere else puts it back.
//
// Drop targets are marked with data-drop-target="recycle".
//
// Desktop icons can also be dropped anywhere on the empty desktop to
// move them there: the desktop passes onPlace, which gets the spot
// (the dragged copy's screen rectangle) where it was let go.

import { confirmRecycle } from './recycle.js';

// A press that moves further than this (in screen pixels) is a drag,
// not a click
const DRAG_THRESHOLD = 5;

// Makes element draggable as the file called name, shown by icon.
//   canRecycle - false for things that can't be deleted (app icons,
//                the Recycle Bin itself)
//   onPlace    - called with the drop spot when let go on the empty
//                desktop (only desktop icons pass it)
export function setUpFileDrag(element, { name, icon, canRecycle = true, onPlace = null }) {
  element.addEventListener('pointerdown', (event) => {
    if (event.button !== 0) return;

    const desktop = document.querySelector('#desktop');
    const start = { x: event.clientX, y: event.clientY };
    // A desktop icon keeps the point where it was grabbed under the
    // pointer, so it doesn't jump when let go; a row is held by its middle
    const box = element.getBoundingClientRect();
    const grab = element.classList.contains('desktop-icon')
      ? { x: start.x - box.left, y: start.y - box.top }
      : null;
    let ghost = null;
    let target = null;

    function onMove(moveEvent) {
      if (!ghost) {
        if (Math.hypot(moveEvent.clientX - start.x, moveEvent.clientY - start.y) < DRAG_THRESHOLD) return;
        ghost = makeGhost(desktop, name, icon);
        element.classList.add('is-dragging');
      }

      const area = desktop.getBoundingClientRect();
      const offset = grab ?? { x: ghost.offsetWidth / 2, y: ghost.offsetHeight / 2 };
      ghost.style.left = `${moveEvent.clientX - area.left - offset.x}px`;
      ghost.style.top = `${moveEvent.clientY - area.top - offset.y}px`;

      // The ghost lets the pointer through, so this finds what's under it
      const over = canRecycle
        ? document.elementFromPoint(moveEvent.clientX, moveEvent.clientY)
          ?.closest('[data-drop-target="recycle"]') ?? null
        : null;
      if (over !== target) {
        target?.classList.remove('is-drop-over');
        over?.classList.add('is-drop-over');
        target = over;
      }
    }

    function onEnd(endEvent) {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onEnd);
      window.removeEventListener('pointercancel', onEnd);
      if (!ghost) return;

      const spot = ghost.getBoundingClientRect();
      ghost.remove();
      element.classList.remove('is-dragging');
      target?.classList.remove('is-drop-over');
      ignoreNextClick();

      if (target) {
        confirmRecycle(desktop, name);
      } else if (onPlace && endEvent.type === 'pointerup' && isEmptyDesktop(endEvent.clientX, endEvent.clientY)) {
        onPlace(spot);
      }
      // Anywhere else (a window, the taskbar, off the desktop): it
      // goes back where it was
    }

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onEnd);
    window.addEventListener('pointercancel', onEnd);
  });
}

// Whether this point is on the desktop itself, not on a window, the
// taskbar, a menu or Coo
function isEmptyDesktop(x, y) {
  const under = document.elementFromPoint(x, y);
  if (!under?.closest('#desktop')) return false;
  return !under.closest('.window, #taskbar, #start-menu, .context-menu, .assistant, .dialog-overlay');
}

// The see-through copy of the file's icon that follows the pointer
function makeGhost(desktop, name, icon) {
  const ghost = document.createElement('div');
  ghost.className = 'desktop-icon drag-ghost';
  ghost.innerHTML = `<img src="${icon}" alt=""><span class="icon-label"></span>`;
  // File names are typed by people, so the label is plain text, never HTML
  ghost.querySelector('.icon-label').textContent = name;
  desktop.append(ghost);
  return ghost;
}

// The click that ends a drag isn't a click on anything: it mustn't
// select, open or clear. (Not every browser sends one, so the guard
// doesn't wait around.)
function ignoreNextClick() {
  const swallow = (event) => {
    event.stopPropagation();
    event.preventDefault();
  };
  window.addEventListener('click', swallow, { capture: true, once: true });
  setTimeout(() => window.removeEventListener('click', swallow, { capture: true }), 0);
}
