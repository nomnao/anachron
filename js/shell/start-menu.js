// The Start menu: pops up above the Start button with every app,
// and Shut Down at the bottom.

const SHUT_DOWN_ICON = 'assets/icons/shutdown.svg';

// apps       - the list of apps to show (from app.js)
// onLaunch   - called with an app when it is chosen
// onShutDown - called when Shut Down is chosen
// Returns a function that cleans up when the desktop goes away.
export function setUpStartMenu(desktop, { apps, onLaunch, onShutDown }) {
  const startButton = desktop.querySelector('#start-button');

  const menu = document.createElement('div');
  menu.id = 'start-menu';
  menu.hidden = true;
  menu.innerHTML = `
    <div class="start-banner"><span>ANACHRON <b>95</b></span></div>
    <div class="start-items">
      ${apps.map((app) => `
        <button class="start-item" data-app-id="${app.id}">
          <img src="${app.icon}" alt="">
          <span>${app.title}</span>
        </button>
      `).join('')}
      <div class="start-separator"></div>
      <button class="start-item" data-command="shut-down">
        <img src="${SHUT_DOWN_ICON}" alt="">
        <span>Sh<u>u</u>t Down...</span>
      </button>
    </div>
  `;
  desktop.append(menu);

  function setOpen(open) {
    menu.hidden = !open;
    startButton.classList.toggle('is-pressed', open);
  }

  startButton.addEventListener('click', () => setOpen(menu.hidden));

  menu.addEventListener('click', (event) => {
    const item = event.target.closest('.start-item');
    if (!item) return;

    setOpen(false);
    if (item.dataset.command === 'shut-down') {
      onShutDown();
    } else {
      onLaunch(apps.find((app) => app.id === item.dataset.appId));
    }
  });

  // Pressing anywhere else on the desktop closes the menu
  desktop.addEventListener('pointerdown', (event) => {
    if (!menu.hidden && !menu.contains(event.target) && !startButton.contains(event.target)) {
      setOpen(false);
    }
  });

  // Escape closes it too. This listens on the whole page (Safari
  // doesn't focus buttons you click), so it hands back a function
  // that stops listening, for when the desktop goes away.
  function onKeyDown(event) {
    if (event.key === 'Escape' && !menu.hidden) setOpen(false);
  }
  document.addEventListener('keydown', onKeyDown);

  return () => document.removeEventListener('keydown', onKeyDown);
}
