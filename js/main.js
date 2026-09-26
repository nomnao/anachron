import { runBoot, runShutdown } from './system/boot.js';
import { showDesktop, hideDesktop } from './shell/desktop.js';

const monitor = document.querySelector('#monitor');
const crtScreen = document.querySelector('#crt-screen');
const powerButton = document.querySelector('#power-button');

// 'off' -> 'booting' -> 'desktop' -> 'shutting-down' -> 'halted' -> 'off'
let systemState = 'off';

function setState(state) {
  systemState = state;
  console.log('System state:', systemState);
}

// The power button is a real power switch: it turns the computer on,
// and turns it off again from the desktop or the "safe to turn off"
// screen. While booting or shutting down it does nothing.
powerButton.addEventListener('click', () => {
  if (systemState === 'off') powerOn();
  else if (systemState === 'desktop' || systemState === 'halted') powerOff();
});

async function powerOn() {
  setState('booting');
  monitor.classList.add('is-on');

  await runBoot(crtScreen);

  showDesktop(crtScreen, { onShutDown: shutDown });
  setState('desktop');
}

// Shut Down from the Start menu
async function shutDown() {
  setState('shutting-down');
  hideDesktop();

  await runShutdown(crtScreen);
  setState('halted');
}

function powerOff() {
  // Pulling the power while the desktop is running: anything
  // unsaved is lost, just like on a real computer
  if (systemState === 'desktop') hideDesktop();

  crtScreen.textContent = '';
  monitor.classList.remove('is-on');
  setState('off');
}
