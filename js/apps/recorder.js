// Video Recorder: records short videos from the webcam (with sound,
// if a microphone is allowed).
// Record starts, Stop ends. The video then plays back on screen.
// Nothing is saved until you choose to: Ctrl+S (Cmd+S on a Mac)
// asks for a name. Record Again throws it away and starts over.
//
// The video is recorded from the same mirrored, chunky-pixel
// picture you see, so it looks just like the preview.

import { setUpMenuBar } from '../shell/menus.js';
import { showConfirmDialog, showSaveAsDialog } from '../shell/dialogs.js';
import { createVideoPlayer, formatTime } from '../shell/video-player.js';
import {
  FRAME_WIDTH, FRAME_HEIGHT, openWebcam, explainWebcamError, drawMirroredFrame, stopStream,
} from '../shell/webcam.js';
import { fileExists, writeBigFile } from '../system/fs.js';

// Longest recording, in seconds. Videos are big, so this keeps
// them from filling up the browser's storage.
const MAX_SECONDS = 60;

// What to call the save shortcut in messages
const SAVE_KEYS = /Mac|iPhone|iPad/.test(navigator.platform) ? 'Cmd+S' : 'Ctrl+S';

// context comes from the desktop:
//   onClose - runs something when the window closes
export function createApp(context) {
  const root = document.createElement('div');
  root.className = 'recorder';
  // Lets the window receive key presses (Ctrl+S)
  root.tabIndex = -1;

  root.innerHTML = `
    <div class="menu-bar">
      <div class="menu">
        <button class="menu-title"><u>F</u>ile</button>
        <div class="menu-items">
          <button data-command="save-as">Save Video <u>A</u>s...</button>
        </div>
      </div>
    </div>
    <div class="capture-view">
      <canvas class="capture-canvas" width="${FRAME_WIDTH}" height="${FRAME_HEIGHT}"></canvas>
      <div class="recorder-review"></div>
      <div class="recording-badge" hidden><span class="recording-dot"></span>REC <span class="recording-time">0:00</span></div>
      <div class="capture-message">
        <p></p>
        <button class="push-button" data-action="retry" hidden>Try Again</button>
      </div>
    </div>
    <div class="capture-controls">
      <button class="push-button capture-main" data-action="record" disabled><span class="glyph-record"></span>Record</button>
      <button class="push-button capture-main" data-action="stop" hidden><span class="glyph-stop"></span>Stop</button>
      <button class="push-button" data-action="again" hidden>Record Again</button>
      <button class="push-button" data-action="save" hidden>Save...</button>
      <span class="status-field capture-status"></span>
    </div>
  `;

  const canvas = root.querySelector('.capture-canvas');
  const recorder = {
    root,
    canvas,
    ctx: canvas.getContext('2d'),
    video: document.createElement('video'),
    player: createVideoPlayer(),
    stream: null,
    frame: null,
    closed: false,
    // While recording: the MediaRecorder, its pieces of video,
    // when it started, and the timer that updates "REC 0:05"
    mediaRecorder: null,
    chunks: [],
    startedAt: 0,
    timer: null,
    // After recording: the video and its length in seconds
    clip: null,
    seconds: 0,
  };
  // Needed so phones play the webcam inside the page, silently
  recorder.video.muted = true;
  recorder.video.playsInline = true;
  root.querySelector('.recorder-review').append(recorder.player.element);

  const button = (action) => root.querySelector(`[data-action="${action}"]`);
  button('record').addEventListener('click', () => startRecording(recorder));
  button('stop').addEventListener('click', () => stopRecording(recorder));
  button('again').addEventListener('click', () => showLive(recorder));
  button('save').addEventListener('click', () => saveVideo(recorder));
  button('retry').addEventListener('click', () => startWebcam(recorder));

  setUpMenuBar(root.querySelector('.menu-bar'), (command) => {
    if (command === 'save-as') saveVideo(recorder);
  });

  root.addEventListener('keydown', (event) => {
    if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== 's') return;
    // Never save the web page itself
    event.preventDefault();
    saveVideo(recorder);
  });

  // When the window closes (or the computer shuts down): stop any
  // recording, let go of the video, and turn the webcam off
  context.onClose(() => shutDown(recorder));

  startWebcam(recorder);
  return root;
}

// ---------- Webcam ----------

async function startWebcam(recorder) {
  showMessage(recorder, 'Waiting for permission to use the camera...', false);
  setStatus(recorder, 'Starting camera...');

  let stream;
  try {
    stream = await openWebcam({ withSound: true });
  } catch (error) {
    showMessage(recorder, explainWebcamError(error), true);
    setStatus(recorder, 'No camera');
    return;
  }

  // The window may have been closed while the browser was asking
  if (recorder.closed) {
    stopStream(stream);
    return;
  }

  recorder.stream = stream;
  recorder.video.srcObject = stream;
  await recorder.video.play();

  hideMessage(recorder);
  showLive(recorder);
}

function shutDown(recorder) {
  recorder.closed = true;
  cancelAnimationFrame(recorder.frame);
  clearInterval(recorder.timer);
  if (recorder.mediaRecorder?.state === 'recording') {
    recorder.mediaRecorder.onstop = null;
    recorder.mediaRecorder.stop();
  }
  recorder.player.unload();
  stopStream(recorder.stream);
}

// Copies the webcam into the canvas on every screen refresh.
// While recording, the video is made from this canvas.
function drawLoop(recorder) {
  drawMirroredFrame(recorder.ctx, recorder.video);
  recorder.frame = requestAnimationFrame(() => drawLoop(recorder));
}

// ---------- The three stages: live, recording, playing back ----------

// Live: the webcam moves, and Record is the only button
function showLive(recorder) {
  recorder.clip = null;
  recorder.player.unload();
  setView(recorder, 'live');
  showButtons(recorder, ['record']);
  recorder.root.querySelector('[data-action="record"]').disabled = false;
  setStatus(recorder, 'Ready');

  cancelAnimationFrame(recorder.frame);
  drawLoop(recorder);
}

function startRecording(recorder) {
  if (!recorder.stream) return;

  // The picture comes from the canvas (mirrored, chunky pixels),
  // the sound straight from the microphone
  const canvasStream = recorder.canvas.captureStream(30);
  const recording = new MediaStream([
    ...canvasStream.getVideoTracks(),
    ...recorder.stream.getAudioTracks(),
  ]);

  const mimeType = pickVideoFormat();
  const mediaRecorder = new MediaRecorder(recording, mimeType ? { mimeType } : undefined);
  recorder.mediaRecorder = mediaRecorder;
  recorder.chunks = [];

  mediaRecorder.ondataavailable = (event) => {
    if (event.data.size > 0) recorder.chunks.push(event.data);
  };
  mediaRecorder.onstop = () => {
    canvasStream.getTracks().forEach((track) => track.stop());
    showPlayback(recorder);
  };

  mediaRecorder.start(1000);
  recorder.startedAt = performance.now();

  showButtons(recorder, ['stop']);
  recorder.root.querySelector('.recording-badge').hidden = false;
  setStatus(recorder, 'Recording...');
  updateTimer(recorder);
  recorder.timer = setInterval(() => updateTimer(recorder), 250);
  recorder.root.querySelector('[data-action="stop"]').focus();
}

// Shows how long we've been recording, and stops at the limit
function updateTimer(recorder) {
  const seconds = (performance.now() - recorder.startedAt) / 1000;
  recorder.root.querySelector('.recording-time').textContent = formatTime(seconds);
  if (seconds >= MAX_SECONDS) stopRecording(recorder);
}

function stopRecording(recorder) {
  if (recorder.mediaRecorder?.state !== 'recording') return;

  clearInterval(recorder.timer);
  recorder.seconds = (performance.now() - recorder.startedAt) / 1000;
  recorder.root.querySelector('.recording-badge').hidden = true;
  recorder.mediaRecorder.stop();
  // The rest happens in showPlayback, once the last piece arrives
}

// Playing back: the new video on screen, until you save or record again
function showPlayback(recorder) {
  cancelAnimationFrame(recorder.frame);

  recorder.clip = new Blob(recorder.chunks, { type: recorder.mediaRecorder.mimeType });
  recorder.chunks = [];
  recorder.player.load(recorder.clip, recorder.seconds);

  setView(recorder, 'playback');
  showButtons(recorder, ['again', 'save']);
  setStatus(recorder, `Press ${SAVE_KEYS} to save this video`);
  recorder.root.querySelector('[data-action="save"]').focus();
}

// The first video format this browser can record:
// WebM in Chrome and Firefox, MP4 in Safari
function pickVideoFormat() {
  const formats = ['video/webm;codecs=vp8,opus', 'video/webm', 'video/mp4'];
  return formats.find((format) => MediaRecorder.isTypeSupported(format)) ?? '';
}

// ---------- Saving ----------

// Asks for a name, then saves the video on screen.
// Before a video has been recorded there is nothing to save.
async function saveVideo(recorder) {
  if (!recorder.clip) return;

  const { clip, seconds } = recorder;
  const extension = clip.type.includes('mp4') ? '.mp4' : '.webm';
  const name = await showSaveAsDialog(recorder.root, {
    fileName: nextVideoName(extension),
    extension,
  });
  recorder.root.focus({ preventScroll: true });
  if (!name) return;

  setStatus(recorder, `Saving ${name}...`);
  const kept = await writeBigFile(name, clip, 'video', { duration: seconds });

  if (kept) {
    setStatus(recorder, `Saved ${name}`);
  } else {
    setStatus(recorder, 'Not saved');
    showConfirmDialog(recorder.root, {
      title: 'Video Recorder',
      message: `There is no room to store ${name}.`,
      cancelLabel: null,
    });
  }
}

// A suggested name: video1.webm, or video2.webm if that is taken...
function nextVideoName(extension) {
  let number = 1;
  while (fileExists(`video${number}${extension}`)) number += 1;
  return `video${number}${extension}`;
}

// ---------- What's on screen ----------

// 'live' shows the webcam, 'playback' shows the player
function setView(recorder, view) {
  recorder.canvas.hidden = view !== 'live';
  recorder.root.querySelector('.recorder-review').hidden = view !== 'playback';
}

// Shows only the named buttons out of Record, Stop, Record Again and Save
function showButtons(recorder, actions) {
  for (const action of ['record', 'stop', 'again', 'save']) {
    recorder.root.querySelector(`[data-action="${action}"]`).hidden = !actions.includes(action);
  }
}

function showMessage(recorder, text, canRetry) {
  const message = recorder.root.querySelector('.capture-message');
  message.hidden = false;
  message.querySelector('p').textContent = text;
  message.querySelector('[data-action="retry"]').hidden = !canRetry;
}

function hideMessage(recorder) {
  recorder.root.querySelector('.capture-message').hidden = true;
}

function setStatus(recorder, text) {
  recorder.root.querySelector('.capture-status').textContent = text;
}
