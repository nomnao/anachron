const monitor = document.querySelector('#monitor');
const crtScreen = document.querySelector('#crt-screen');
const powerButton = document.querySelector('#power-button');

let systemState = 'off';

// Each line of the boot sequence.
// If a line has a "check", the label appears first,
// then "OK" appears after a short pause.
const BOOT_LINES = [
  { text: 'ANACHRON SYSTEM' },
  { text: 'REVISION 95.3' },
  { text: '' },
  { text: 'MEMORY TEST', check: true },
  { text: 'DISPLAY DEVICE', check: true },
  { text: 'INPUT DEVICE', check: true },
  { text: 'STORAGE', check: true },
  { text: '' },
  { text: 'LOADING SYSTEM...' },
];

// Turns "STORAGE" into "STORAGE ................. "
// so every "OK" lines up in the same column.
function withDots(label) {
  return (label + ' ').padEnd(25, '.') + ' ';
}

// Returns a Promise that finishes after `ms` milliseconds.
// Used with `await` to pause without freezing the page.
function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Adds one new line to the screen and returns it,
// so we can add more text to it later.
function printLine(text) {
  const line = document.createElement('div');
  line.className = 'boot-line';
  line.textContent = text;
  crtScreen.append(line);
  return line;
}

async function boot() {
  crtScreen.textContent = '';
  await wait(600);

  for (const bootLine of BOOT_LINES) {
    if (bootLine.check) {
      const line = printLine(withDots(bootLine.text));
      await wait(400);
      line.textContent += 'OK';
    } else {
      printLine(bootLine.text);
    }

    await wait(250);
  }

  await wait(800);
  crtScreen.textContent = '';
  await wait(500);

  showDesktop();
  systemState = 'desktop';
  console.log('System state:', systemState);
}

// Builds the desktop inside the screen.
function showDesktop() {
  crtScreen.innerHTML = `
    <div id="desktop">
      <div id="taskbar">
        <button id="start-button">
          <span class="logo"><span></span><span></span><span></span><span></span></span>
          Start
        </button>
        <div id="clock"></div>
      </div>
    </div>
  `;

  updateClock();
  setInterval(updateClock, 1000);
}

// Shows the real current time, e.g. "4:17 PM".
function updateClock() {
  const clock = document.querySelector('#clock');
  clock.textContent = new Date().toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });
}

powerButton.addEventListener('click', () => {
  if (systemState !== 'off') return;

  systemState = 'booting';
  monitor.classList.add('is-on');
  console.log('System state:', systemState);

  boot();
});