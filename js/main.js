const monitor = document.querySelector('#monitor');
const crtScreen = document.querySelector('#crt-screen');
const powerButton = document.querySelector('#power-button');

let systemState = 'off';

powerButton.addEventListener('click', () => {
  if (systemState !== 'off') return;

  systemState = 'booting';
  monitor.classList.add('is-on');
  crtScreen.textContent = 'ANACHRON SYSTEM';

  console.log('System state:', systemState);
});