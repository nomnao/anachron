// Paint: draw pictures with a pencil, an eraser and a paint bucket.
// Save puts an image file on the desktop; double-clicking that
// file opens it here again.

import { setUpMenuBar } from '../shell/menus.js';
import { showConfirmDialog, showSaveAsDialog, showSaveChangesDialog } from '../shell/dialogs.js';
import { readFile, writeFile, onFileRenamed } from '../system/fs.js';

// The picture is always this many pixels. On screen each of its
// pixels is one "virtual pixel", so drawings look chunky and retro.
const CANVAS_WIDTH = 360;
const CANVAS_HEIGHT = 220;

// The classic 28-colour palette: dark shades on top, bright ones below
const PALETTE = [
  '#000000', '#808080', '#800000', '#808000', '#008000', '#008080', '#000080',
  '#800080', '#808040', '#004040', '#0080ff', '#004080', '#8000ff', '#804000',
  '#ffffff', '#c0c0c0', '#ff0000', '#ffff00', '#00ff00', '#00ffff', '#0000ff',
  '#ff00ff', '#ffff80', '#00ff80', '#80ffff', '#8080ff', '#ff0080', '#ff8040',
];

// Brush sizes in picture pixels. The eraser is always bigger than the pencil.
const SIZES = [1, 3, 6];
const eraserSize = (size) => size * 2 + 3;

// How many steps Undo remembers
const MAX_UNDO = 20;

// Each tool's button picture, drawn on a 16x16 grid
const TOOLS = [
  {
    id: 'pencil',
    label: 'Pencil',
    icon: `<path d="M3.5 12.5l1-3 7-7 2 2-7 7z" fill="#e8c040" stroke="#000"/>
           <path d="M3 13l1.5-3.5 2 2z" fill="#000"/>`,
  },
  {
    id: 'eraser',
    label: 'Eraser',
    icon: `<path d="M2.5 9.5l6-6 5 5-4 4h-3z" fill="#ffffff" stroke="#000"/>
           <path d="M3 9.5l3-3 4.5 4.5-2 2h-2.5z" fill="#e080a0"/>`,
  },
  {
    id: 'fill',
    label: 'Fill With Color',
    icon: `<path d="M2.5 7.5l5-5 6 6-5 5z" fill="#c0c0c0" stroke="#000"/>
           <path d="M4 8h9" stroke="#000"/>
           <path d="M13.5 10v4" stroke="#0000ff" stroke-width="2"/>`,
  },
];

// context comes from the desktop:
//   fileName - the picture to open, or null for a new, blank one
//   setTitle - changes the window's title
//   onClose  - runs something when the window closes
//   beforeClose - lets Paint ask about unsaved changes first
export function createApp(context) {
  const root = document.createElement('div');
  root.className = 'paint';
  // Lets the Paint window receive key presses (Ctrl+Z, Ctrl+S)
  root.tabIndex = -1;

  root.innerHTML = `
    <div class="menu-bar">
      <div class="menu">
        <button class="menu-title"><u>F</u>ile</button>
        <div class="menu-items">
          <button data-command="new"><u>N</u>ew</button>
          <button data-command="save"><u>S</u>ave</button>
          <button data-command="save-as">Save <u>A</u>s...</button>
        </div>
      </div>
      <div class="menu">
        <button class="menu-title"><u>E</u>dit</button>
        <div class="menu-items">
          <button data-command="undo"><u>U</u>ndo</button>
        </div>
      </div>
    </div>

    <div class="paint-main">
      <div class="paint-toolbox">
        <div class="paint-tools">
          ${TOOLS.map((tool) => `
            <button class="tool-button" data-tool="${tool.id}" title="${tool.label}" aria-label="${tool.label}">
              <svg viewBox="0 0 16 16" shape-rendering="crispEdges">${tool.icon}</svg>
            </button>
          `).join('')}
        </div>
        <div class="paint-sizes sunken-panel">
          ${SIZES.map((size) => `
            <button class="size-button" data-size="${size}" aria-label="Size ${size}">
              <span style="height: calc(var(--px) * ${size})"></span>
            </button>
          `).join('')}
        </div>
      </div>

      <div class="paint-canvas-area">
        <canvas class="paint-canvas" width="${CANVAS_WIDTH}" height="${CANVAS_HEIGHT}"></canvas>
      </div>
    </div>

    <div class="paint-palette">
      <div class="current-color sunken-panel"><span></span></div>
      <div class="palette-colors">
        ${PALETTE.map((color) => `
          <button class="palette-color" data-color="${color}" style="background: ${color}" aria-label="${color}"></button>
        `).join('')}
      </div>
    </div>
  `;

  const canvas = root.querySelector('.paint-canvas');
  const paint = {
    root,
    canvas,
    // We read pixels back often (fill, undo), and this makes that faster
    ctx: canvas.getContext('2d', { willReadFrequently: true }),
    fileName: context.fileName,
    setTitle: context.setTitle,
    tool: 'pencil',
    size: SIZES[0],
    color: '#000000',
    undoSteps: [],
    // True when the picture has changes that haven't been saved yet
    changed: false,
  };

  clearCanvas(paint);
  if (paint.fileName) openPicture(paint, readFile(paint.fileName));
  updateTitle(paint);

  // If the file is renamed (on the desktop or in My Files),
  // carry on with it under its new name
  context.onClose(onFileRenamed((oldName, newName) => {
    if (paint.fileName !== oldName) return;
    paint.fileName = newName;
    updateTitle(paint);
  }));

  // Closing with unsaved changes asks to save them first
  context.beforeClose(() => askToSave(paint));

  setUpToolbox(paint);
  setUpDrawing(paint);
  setUpMenuBar(root.querySelector('.menu-bar'), (command) => runCommand(command, paint));

  root.addEventListener('keydown', (event) => {
    if (!(event.ctrlKey || event.metaKey)) return;
    // Leave Ctrl+Z alone while typing a file name
    if (event.target.closest('input')) return;

    const key = event.key.toLowerCase();
    if (key === 'z') {
      event.preventDefault();
      undo(paint);
    }
    if (key === 's') {
      event.preventDefault();
      save(paint);
    }
  });

  return root;
}

function runCommand(command, paint) {
  if (command === 'new') startNewPicture(paint);
  if (command === 'save') save(paint);
  if (command === 'save-as') saveAs(paint);
  if (command === 'undo') undo(paint);
}

// New: a blank, untitled picture (after asking about unsaved changes)
async function startNewPicture(paint) {
  if (!(await askToSave(paint))) return;

  rememberForUndo(paint);
  clearCanvas(paint);
  paint.fileName = null;
  paint.changed = false;
  updateTitle(paint);
}

// "sunset.png - Paint", or "untitled - Paint" before the first save
function updateTitle(paint) {
  paint.setTitle(`${paint.fileName ?? 'untitled'} - Paint`);
}

// ---------- Tools, sizes and colours ----------

function setUpToolbox(paint) {
  const { root } = paint;

  function select(selector, matches) {
    for (const button of root.querySelectorAll(selector)) {
      button.classList.toggle('is-selected', matches(button));
    }
  }

  function selectTool(tool) {
    paint.tool = tool;
    select('.tool-button', (b) => b.dataset.tool === tool);
  }

  function selectSize(size) {
    paint.size = size;
    select('.size-button', (b) => Number(b.dataset.size) === size);
  }

  function selectColor(color) {
    paint.color = color;
    root.querySelector('.current-color span').style.background = color;
  }

  root.querySelector('.paint-tools').addEventListener('click', (event) => {
    const button = event.target.closest('[data-tool]');
    if (button) selectTool(button.dataset.tool);
  });

  root.querySelector('.paint-sizes').addEventListener('click', (event) => {
    const button = event.target.closest('[data-size]');
    if (button) selectSize(Number(button.dataset.size));
  });

  root.querySelector('.palette-colors').addEventListener('click', (event) => {
    const button = event.target.closest('[data-color]');
    if (button) selectColor(button.dataset.color);
  });

  selectTool(paint.tool);
  selectSize(paint.size);
  selectColor(paint.color);
}

// ---------- Drawing ----------

function setUpDrawing(paint) {
  const { canvas, root } = paint;
  let lastPoint = null;

  canvas.addEventListener('pointerdown', (event) => {
    // Left button, a finger or a pen; not right-click
    if (event.button !== 0) return;
    event.preventDefault();
    root.focus({ preventScroll: true });

    rememberForUndo(paint);
    const point = toCanvasPoint(canvas, event);

    if (paint.tool === 'fill') {
      floodFill(paint, point, paint.color);
      return;
    }

    lastPoint = point;
    drawLine(paint, point, point);

    // Keep getting moves even if the pointer leaves the canvas
    canvas.setPointerCapture(event.pointerId);
  });

  canvas.addEventListener('pointermove', (event) => {
    if (!lastPoint) return;
    const point = toCanvasPoint(canvas, event);
    drawLine(paint, lastPoint, point);
    lastPoint = point;
  });

  const stop = () => { lastPoint = null; };
  canvas.addEventListener('pointerup', stop);
  canvas.addEventListener('pointercancel', stop);
}

// Turns a pointer position on screen into a pixel of the picture.
function toCanvasPoint(canvas, event) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: Math.floor((event.clientX - rect.left) * CANVAS_WIDTH / rect.width),
    y: Math.floor((event.clientY - rect.top) * CANVAS_HEIGHT / rect.height),
  };
}

// Draws with the pencil or eraser from one point to another by
// stamping a square at every pixel along the way. Stamping whole
// pixels (instead of the canvas's smooth lines) keeps the edges
// sharp, and keeps every colour exact so the paint bucket works.
function drawLine(paint, from, to) {
  const { ctx } = paint;
  const isEraser = paint.tool === 'eraser';
  const size = isEraser ? eraserSize(paint.size) : paint.size;
  const half = Math.floor(size / 2);

  ctx.fillStyle = isEraser ? '#ffffff' : paint.color;

  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const steps = Math.max(Math.abs(dx), Math.abs(dy), 1);

  for (let i = 0; i <= steps; i++) {
    const x = Math.round(from.x + (dx * i) / steps);
    const y = Math.round(from.y + (dy * i) / steps);
    ctx.fillRect(x - half, y - half, size, size);
  }
}

// The paint bucket: changes the clicked pixel and every touching
// pixel of the same colour to the new colour.
function floodFill(paint, start, color) {
  const { ctx } = paint;
  const image = ctx.getImageData(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  // Each pixel as one number, so comparing colours is quick
  const pixels = new Uint32Array(image.data.buffer);

  const target = pixels[start.y * CANVAS_WIDTH + start.x];
  const fill = colorToPixel(color);
  if (target === fill) return;

  // Pixels still to look at, as positions in the pixels list
  const toVisit = [start.y * CANVAS_WIDTH + start.x];

  while (toVisit.length > 0) {
    const i = toVisit.pop();
    if (pixels[i] !== target) continue;
    pixels[i] = fill;

    const x = i % CANVAS_WIDTH;
    if (x > 0) toVisit.push(i - 1);
    if (x < CANVAS_WIDTH - 1) toVisit.push(i + 1);
    if (i >= CANVAS_WIDTH) toVisit.push(i - CANVAS_WIDTH);
    if (i < CANVAS_WIDTH * (CANVAS_HEIGHT - 1)) toVisit.push(i + CANVAS_WIDTH);
  }

  ctx.putImageData(image, 0, 0);
}

// '#ff8040' -> the same number the canvas uses for that colour
function colorToPixel(color) {
  const n = parseInt(color.slice(1), 16);
  const rgba = new Uint8ClampedArray([n >> 16, (n >> 8) & 255, n & 255, 255]);
  return new Uint32Array(rgba.buffer)[0];
}

function clearCanvas(paint) {
  paint.ctx.fillStyle = '#ffffff';
  paint.ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
}

// ---------- Undo ----------

// Takes a copy of the picture before each change.
// Every change goes through here, so it also marks the picture changed.
function rememberForUndo(paint) {
  paint.changed = true;
  paint.undoSteps.push(paint.ctx.getImageData(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT));
  if (paint.undoSteps.length > MAX_UNDO) paint.undoSteps.shift();
}

function undo(paint) {
  const previous = paint.undoSteps.pop();
  if (!previous) return;
  paint.ctx.putImageData(previous, 0, 0);
  paint.changed = true;
}

// ---------- Opening and saving ----------

// Pictures are stored as PNG data URLs
function openPicture(paint, dataUrl) {
  if (!dataUrl) return;
  const image = new Image();
  image.onload = () => paint.ctx.drawImage(image, 0, 0);
  image.src = dataUrl;
}

// If there are unsaved changes, asks "Save changes?".
// Gives back true to carry on (saved, or No), false to stop (Cancel,
// or the Save As box was cancelled).
async function askToSave(paint) {
  if (!paint.changed) return true;

  const choice = await showSaveChangesDialog(paint.root, {
    title: 'Paint',
    fileName: paint.fileName ?? 'untitled',
  });
  if (choice === 'discard') return true;
  if (choice === 'cancel') return false;
  return save(paint);
}

// A picture that already has a name is saved straight away;
// a new one asks for a name first. Gives back true if it was saved.
async function save(paint) {
  if (!paint.fileName) return saveAs(paint);

  writeAndCheck(paint, paint.fileName);
  return true;
}

async function saveAs(paint) {
  const name = await showSaveAsDialog(paint.root, {
    fileName: paint.fileName ?? 'untitled.png',
    extension: '.png',
  });

  if (name) {
    paint.fileName = name;
    updateTitle(paint);
    writeAndCheck(paint, name);
  }
  paint.root.focus({ preventScroll: true });
  return Boolean(name);
}

// Saves, and says so if the browser had no room to keep the file.
function writeAndCheck(paint, name) {
  const picture = paint.canvas.toDataURL('image/png');
  paint.changed = false;
  if (!writeFile(name, picture, 'image')) {
    showConfirmDialog(paint.root, {
      title: 'Paint',
      message: `There is no room to store ${name}. It will be lost when this page is closed.`,
      cancelLabel: null,
    });
  }
}
