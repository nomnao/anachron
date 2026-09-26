// Starting up and shutting down: the text the screen shows
// before the desktop appears and after it goes away.

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
function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Adds one new line to the screen and returns it.
function printLine(screen, text) {
  const line = document.createElement('div');
  line.className = 'boot-line';
  line.textContent = text;
  screen.append(line);
  return line;
}

export async function runBoot(screen) {
  screen.textContent = '';
  await wait(600);

  for (const bootLine of BOOT_LINES) {
    if (bootLine.check) {
      const line = printLine(screen, withDots(bootLine.text));
      await wait(400);
      line.textContent += 'OK';
    } else {
      printLine(screen, bootLine.text);
    }

    await wait(250);
  }

  await wait(800);
  screen.textContent = '';
  await wait(500);
}

// Shows a short goodbye, then the classic message. The computer
// stays on this screen until the power button is pressed.
export async function runShutdown(screen) {
  screen.textContent = '';
  printLine(screen, 'ANACHRON is shutting down...');
  await wait(1500);

  screen.textContent = '';
  const message = document.createElement('div');
  message.className = 'shutdown-message';
  message.textContent = 'It is now safe to turn off\nyour computer.';
  screen.append(message);
}
