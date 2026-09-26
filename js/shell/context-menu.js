// The right-click menu: a small list that appears at the pointer.
//
//   showContextMenu(event, [
//     { label: 'Open', action: () => ... },
//     { label: 'Delete', action: () => ... },
//   ]);
//
// Choosing an item, or pressing anywhere else, closes it.

export function showContextMenu(event, items) {
  // It belongs to the whole desktop, so it can reach past a window's edge
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
