// Dragging a file (a desktop icon or a row in My Files) onto the
// Recycle Bin, like the real thing: its icon or its open window.
//
// A press that moves a little starts a drag: a see-through copy of
// the file's icon follows the pointer, and the Recycle Bin lights up
// while the file is over it. Letting go there asks, then sends the
// file to the bin. Letting go anywhere else puts it back.
//
// Drop targets are marked with data-drop-target="recycle".

import { confirmRecycle } from './recycle.js';

// A press that moves further than this (in screen pixels) is a drag,
// not a click
const DRAG_THRESHOLD = 5;

// Makes element draggable as the file called name, shown by icon
export function setUpFileDrag(element, { name, icon }) {
  element.addEventListener('pointerdown', (event) => {
    if (event.button !== 0) return;

    const desktop = document.querySelector('#desktop');
    const start = { x: event.clientX, y: event.clientY };
    let ghost = null;
    let target = null;

    function onMove(moveEvent) {
      if (!ghost) {
        if (Math.hypot(moveEvent.clientX - start.x, moveEvent.clientY - start.y) < DRAG_THRESHOLD) return;
        ghost = makeGhost(desktop, name, icon);
        element.classList.add('is-dragging');
      }

      const area = desktop.getBoundingClientRect();
      ghost.style.left = `${moveEvent.clientX - area.left - ghost.offsetWidth / 2}px`;
      ghost.style.top = `${moveEvent.clientY - area.top - ghost.offsetHeight / 2}px`;

      // The ghost lets the pointer through, so this finds what's under it
      const over = document.elementFromPoint(moveEvent.clientX, moveEvent.clientY)
        ?.closest('[data-drop-target="recycle"]') ?? null;
      if (over !== target) {
        target?.classList.remove('is-drop-over');
        over?.classList.add('is-drop-over');
        target = over;
      }
    }

    function onEnd() {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onEnd);
      window.removeEventListener('pointercancel', onEnd);
      if (!ghost) return;

      ghost.remove();
      element.classList.remove('is-dragging');
      target?.classList.remove('is-drop-over');
      ignoreNextClick();
      if (target) confirmRecycle(desktop, name);
    }

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onEnd);
    window.addEventListener('pointercancel', onEnd);
  });
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
