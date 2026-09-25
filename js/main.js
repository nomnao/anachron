import { runBoot } from './system/boot.js';
import { showDesktop } from './shell/desktop.js';

const monitor = document.querySelector('#monitor');
const crtScreen = document.querySelector('#crt-screen');
const powerButton = document.querySelector('#power-button');

let systemState = 'off';

powerButton.addEventListener('click', async () => {
  if (systemState !== 'off') return;

  systemState = 'booting';
  monitor.classList.add('is-on');
  console.log('System state:', systemState);

  await runBoot(crtScreen);

  showDesktop(crtScreen);
  systemState = 'desktop';
  console.log('System state:', systemState);
});