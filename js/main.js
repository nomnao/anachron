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
  systemState = 'desktop';
  console.log('System state:', systemState);
}

powerButton.addEventListener('click', () => {
  if (systemState !== 'off') return;

  systemState = 'booting';
  monitor.classList.add('is-on');
  console.log('System state:', systemState);

  boot();
});