// The right-click menu: a small list that appears at the pointer.
//
//   showContextMenu(event, [
//     { label: 'Open', action: () => ... },
//     { label: 'Delete', action: () => ... },
//   ]);
//
// An item can also have:
//   checked: true  - a tick in front of it (e.g. the chosen sort order)
//   items: [...]   - a submenu instead of an action; it opens to the
//                    side when you point at the item
//
// Choosing an item, pressing anywhere else, or Escape closes it.

export function showContextMenu(event, items) {
  // It belongs to the whole desktop, so it can reach past a window's edge
  const desktop = document.querySelector('#desktop');
  for (const old of desktop.querySelectorAll('.context-menu')) old.remove();

  // The open menus: [0] is the main one, [1] its submenu
  const menus = [];

  function buildMenu(menuItems, level) {
    const menu = document.createElement('div');
    menu.className = 'menu-items context-menu';

    for (const item of menuItems) {
      const button = document.createElement('button');
      button.textContent = item.label;
      button.classList.toggle('is-checked', Boolean(item.checked));

      if (item.items) {
        button.classList.add('has-submenu');
        const open = () => openSubmenu(button, item.items, level);
        button.addEventListener('pointerenter', open);
        button.addEventListener('click', open);
      } else {
        // Pointing at a plain item closes any submenu next to it
        button.addEventListener('pointerenter', () => closeFrom(level + 1));
        button.addEventListener('click', () => {
          close();
          item.action();
        });
      }
      menu.append(button);
    }

    menus[level] = menu;
    desktop.append(menu);
    return menu;
  }

  // Opens a submenu to the right of its item, or to the left
  // if there is no room on the right
  function openSubmenu(button, menuItems, level) {
    if (menus[level + 1] && button.classList.contains('is-open')) return;

    closeFrom(level + 1);
    button.classList.add('is-open');

    const submenu = buildMenu(menuItems, level + 1);
    const area = desktop.getBoundingClientRect();
    const item = button.getBoundingClientRect();
    const parent = menus[level].getBoundingClientRect();

    let x = parent.right - area.left - 3;
    if (x + submenu.offsetWidth > area.width) x = parent.left - area.left - submenu.offsetWidth + 3;
    const y = Math.min(item.top - area.top - 3, area.height - submenu.offsetHeight);
    submenu.style.left = `${Math.max(0, x)}px`;
    submenu.style.top = `${Math.max(0, y)}px`;
  }

  // Closes the menus from this level down
  function closeFrom(level) {
    for (const menu of menus.splice(level)) menu.remove();
    menus[level - 1]?.querySelector('.is-open')?.classList.remove('is-open');
  }

  const menu = buildMenu(items, 0);

  // Open at the pointer, but keep the whole menu on screen
  const area = desktop.getBoundingClientRect();
  const x = Math.min(event.clientX - area.left, area.width - menu.offsetWidth);
  const y = Math.min(event.clientY - area.top, area.height - menu.offsetHeight);
  menu.style.left = `${x}px`;
  menu.style.top = `${y}px`;

  function onPointerDown(downEvent) {
    if (!menus.some((m) => m.contains(downEvent.target))) close();
  }

  function onKeyDown(keyEvent) {
    if (keyEvent.key === 'Escape') close();
  }

  function close() {
    closeFrom(0);
    document.removeEventListener('pointerdown', onPointerDown, true);
    document.removeEventListener('keydown', onKeyDown);
  }

  // "true" = hear about the press before anything else does
  document.addEventListener('pointerdown', onPointerDown, true);
  document.addEventListener('keydown', onKeyDown);
}
