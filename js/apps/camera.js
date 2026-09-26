// Camera: shows the webcam and takes pictures.
// After a picture is taken it stays on screen. Nothing is saved
// until you choose to: Ctrl+S (Cmd+S on a Mac) asks for a name.
// Retake goes back to the live picture.
//
// Pictures are the same size as a Paint picture, so Paint can
// open them and you can draw on them.

import { setUpMenuBar } from '../shell/menus.js';
import { showConfirmDialog, showSaveAsDialog } from '../shell/dialogs.js';
import {
  FRAME_WIDTH, FRAME_HEIGHT, openWebcam, explainWebcamError, drawMirroredFrame, stopStream,
} from '../shell/webcam.js';
import { fileExists, writeFile } from '../system/fs.js';

// What to call the save shortcut in messages
const SAVE_KEYS = /Mac|iPhone|iPad/.test(navigator.platform) ? 'Cmd+S' : 'Ctrl+S';

// context comes from the desktop:
//   onClose - runs something when the window closes
export function createApp(context) {
  const root = document.createElement('div');
  root.className = 'camera';
  // Lets the window receive key presses (Ctrl+S)
  root.tabIndex = -1;

  root.innerHTML = `
    <div class="menu-bar">
      <div class="menu">
        <button class="menu-title"><u>F</u>ile</button>
        <div class="menu-items">
          <button data-command="save-as">Save Picture <u>A</u>s...</button>
        </div>
      </div>
    </div>
    <div class="capture-view">
      <canvas class="capture-canvas" width="${FRAME_WIDTH}" height="${FRAME_HEIGHT}"></canvas>
      <div class="capture-message">
        <p></p>
        <button class="push-button" data-action="retry" hidden>Try Again</button>
      </div>
      <div class="camera-flash"></div>
    </div>
    <div class="capture-controls">
      <button class="push-button capture-main" data-action="shoot" disabled>Take Picture</button>
      <button class="push-button" data-action="retake" hidden>Retake</button>
      <button class="push-button" data-action="save" hidden>Save...</button>
      <span class="status-field capture-status"></span>
    </div>
  `;

  const canvas = root.querySelector('.capture-canvas');
  const camera = {
    root,
    canvas,
    ctx: canvas.getContext('2d'),
    video: document.createElement('video'),
    stream: null,
    frame: null,
    closed: false,
    // The picture just taken, as a PNG data URL; null while live
    photo: null,
  };
  // Needed so phones play the webcam inside the page, silently
  camera.video.muted = true;
  camera.video.playsInline = true;

  const button = (action) => root.querySelector(`[data-action="${action}"]`);
  button('shoot').addEventListener('click', () => takePicture(camera));
  button('retake').addEventListener('click', () => retake(camera));
  button('save').addEventListener('click', () => savePicture(camera));
  button('retry').addEventListener('click', () => startCamera(camera));

  setUpMenuBar(root.querySelector('.menu-bar'), (command) => {
    if (command === 'save-as') savePicture(camera);
  });

  root.addEventListener('keydown', (event) => {
    if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== 's') return;
    // Never save the web page itself
    event.preventDefault();
    savePicture(camera);
  });

  // Turn the webcam off when the window closes (or the computer shuts
  // down), otherwise its light would stay on
  context.onClose(() => stopCamera(camera));

  startCamera(camera);
  return root;
}

// ---------- Starting and stopping ----------

async function startCamera(camera) {
  showMessage(camera, 'Waiting for permission to use the camera...', false);
  setStatus(camera, 'Starting camera...');

  let stream;
  try {
    stream = await openWebcam();
  } catch (error) {
    showMessage(camera, explainWebcamError(error), true);
    setStatus(camera, 'No camera');
    return;
  }

  // The window may have been closed while the browser was asking
  if (camera.closed) {
    stopStream(stream);
    return;
  }

  camera.stream = stream;
  camera.video.srcObject = stream;
  await camera.video.play();

  hideMessage(camera);
  showLive(camera);
}

function stopCamera(camera) {
  camera.closed = true;
  cancelAnimationFrame(camera.frame);
  stopStream(camera.stream);
}

// ---------- Live picture and taken picture ----------

// Live: the webcam moves, and Take Picture is the only button
function showLive(camera) {
  camera.photo = null;
  showButtons(camera, ['shoot']);
  camera.root.querySelector('[data-action="shoot"]').disabled = false;
  setStatus(camera, 'Ready');
  drawLoop(camera);
}

// After a picture: it stays still on screen until you save or retake
function takePicture(camera) {
  if (!camera.stream) return;

  cancelAnimationFrame(camera.frame);
  drawMirroredFrame(camera.ctx, camera.video);
  camera.photo = camera.canvas.toDataURL('image/png');

  flash(camera);
  showButtons(camera, ['retake', 'save']);
  setStatus(camera, `Press ${SAVE_KEYS} to save this picture`);
  camera.root.querySelector('[data-action="save"]').focus();
}

function retake(camera) {
  showLive(camera);
  camera.root.querySelector('[data-action="shoot"]').focus();
}

// Shows only the named buttons out of Take Picture, Retake and Save
function showButtons(camera, actions) {
  for (const action of ['shoot', 'retake', 'save']) {
    camera.root.querySelector(`[data-action="${action}"]`).hidden = !actions.includes(action);
  }
}

// Copies the webcam into the canvas on every screen refresh
function drawLoop(camera) {
  drawMirroredFrame(camera.ctx, camera.video);
  camera.frame = requestAnimationFrame(() => drawLoop(camera));
}

// A quick white flash over the viewfinder
function flash(camera) {
  const flashEl = camera.root.querySelector('.camera-flash');
  flashEl.classList.remove('is-flashing');
  // Reading the size makes the browser notice the class was removed,
  // so the animation can play again even on quick repeated shots
  void flashEl.offsetWidth;
  flashEl.classList.add('is-flashing');
}

// ---------- Saving ----------

// Asks for a name, then saves the picture on screen.
// Before a picture has been taken there is nothing to save.
async function savePicture(camera) {
  if (!camera.photo) return;

  const photo = camera.photo;
  const name = await showSaveAsDialog(camera.root, {
    fileName: nextPhotoName(),
    extension: '.png',
  });
  camera.root.focus({ preventScroll: true });
  if (!name) return;

  const kept = writeFile(name, photo, 'image');
  setStatus(camera, `Saved ${name}`);

  if (!kept) {
    showConfirmDialog(camera.root, {
      title: 'Camera',
      message: `There is no room to store ${name}. It will be lost when this page is closed.`,
      cancelLabel: null,
    });
  }
}

// A suggested name: photo1.png, or photo2.png if that is taken, and so on
function nextPhotoName() {
  let number = 1;
  while (fileExists(`photo${number}.png`)) number += 1;
  return `photo${number}.png`;
}

// ---------- Messages ----------

function showMessage(camera, text, canRetry) {
  const message = camera.root.querySelector('.capture-message');
  message.hidden = false;
  message.querySelector('p').textContent = text;
  message.querySelector('[data-action="retry"]').hidden = !canRetry;
}

function hideMessage(camera) {
  camera.root.querySelector('.capture-message').hidden = true;
}

function setStatus(camera, text) {
  camera.root.querySelector('.capture-status').textContent = text;
}
