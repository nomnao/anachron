// Drop-down menu bars (File, Edit...) that apps put at the top of their window.
//
// The HTML looks like this:
//   <div class="menu-bar">
//     <div class="menu">
//       <button class="menu-title">File</button>
//       <div class="menu-items">
//         <button data-command="new">New</button>
//       </div>
//     </div>
//   </div>
//
// Clicking an item calls onCommand with its data-command, e.g. onCommand('new').

export function setUpMenuBar(menuBar, onCommand) {
  let openMenu = null;

  function open(menu) {
    if (openMenu) openMenu.classList.remove('is-open');
    openMenu = menu;
    if (menu) menu.classList.add('is-open');
  }

  for (const menu of menuBar.querySelectorAll('.menu')) {
    const title = menu.querySelector('.menu-title');

    // Click a title to open its menu, click it again to close
    title.addEventListener('click', () => open(openMenu === menu ? null : menu));

    // While a menu is open, moving to another title opens that one instead
    title.addEventListener('pointerenter', () => {
      if (openMenu && openMenu !== menu) open(menu);
    });
  }

  menuBar.addEventListener('click', (event) => {
    const item = event.target.closest('[data-command]');
    if (!item) return;

    open(null);
    onCommand(item.dataset.command);
  });

  // Pressing anywhere outside the menu bar closes the open menu.
  // Once the window has been closed, this listener removes itself.
  function onPointerDown(event) {
    if (!menuBar.isConnected) {
      document.removeEventListener('pointerdown', onPointerDown);
      return;
    }
    if (!menuBar.contains(event.target)) open(null);
  }
  document.addEventListener('pointerdown', onPointerDown);
}
