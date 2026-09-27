// Paint: draw pictures with a pencil, an eraser, a paint bucket,
// straight lines, rectangles, ellipses and text, and pick up colors
// from the picture. Save puts an image file on the desktop;
// double-clicking that file opens it here again.

import { setUpMenuBar } from '../shell/menus.js';
import { showConfirmDialog, showSaveAsDialog, showSaveChangesDialog, showSizeDialog } from '../shell/dialogs.js';
import { readFile, writeFile, onFileRenamed } from '../system/fs.js';

// A new picture is this many pixels, until Image > Attributes
// changes it; an opened picture keeps its own size. On screen each
// of its pixels is one "virtual pixel", so drawings look chunky
// and retro.
const DEFAULT_WIDTH = 360;
const DEFAULT_HEIGHT = 220;
const MAX_SIZE = 1000;

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

// The Text tool's letter heights, in picture pixels, one for each size
const FONT_SIZES = [11, 16, 24];
const FONT_FAMILY = 'Tahoma, Verdana, sans-serif';

// Tools you drag out from one corner to the other. Holding Shift
// keeps a line straight or at 45 degrees, and makes rectangles
// square and ellipses round.
const SHAPE_TOOLS = ['line', 'rectangle', 'ellipse'];

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
  {
    id: 'picker',
    label: 'Pick Color',
    icon: `<path d="M9.5 3.5l3 3-7 7h-3v-3z" fill="#ffffff" stroke="#000"/>
           <path d="M10 2l4 4-1.5 1.5-4-4z" fill="#000"/>`,
  },
  {
    id: 'line',
    label: 'Line',
    icon: '<path d="M3 13L13 3" stroke="#000" stroke-width="1.5"/>',
  },
  {
    id: 'rectangle',
    label: 'Rectangle',
    icon: '<rect x="2.5" y="4.5" width="11" height="8" fill="none" stroke="#000"/>',
  },
  {
    id: 'ellipse',
    label: 'Ellipse',
    icon: '<ellipse cx="8" cy="8.5" rx="5.5" ry="4.5" fill="none" stroke="#000"/>',
  },
  {
    id: 'text',
    label: 'Text',
    icon: '<path d="M4 13L8 3l4 10M5.5 9.5h5" fill="none" stroke="#000" stroke-width="1.5"/>',
  },
];

// Rectangles and ellipses are drawn as an outline or filled in
const FILL_STYLES = [
  { id: 'outline', label: 'Outline', icon: '<rect x="2.5" y="3.5" width="11" height="6" fill="none" stroke="#000"/>' },
  { id: 'filled', label: 'Filled', icon: '<rect x="2" y="3" width="12" height="7" fill="#000"/>' },
];

// context comes from the desktop:
//   fileName - the picture to open, or null for a new, blank one
//   setTitle - changes the window's title
//   onClose  - runs something when the window closes
//   beforeClose - lets Paint ask about unsaved changes first
export function createApp(context) {
  const root = document.createElement('div');
  root.className = 'paint';
  // Lets the Paint window receive key presses (Ctrl+Z, Ctrl+S, Ctrl+E)
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
      <div class="menu">
        <button class="menu-title"><u>I</u>mage</button>
        <div class="menu-items">
          <button data-command="attributes"><u>A</u>ttributes...</button>
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
        <div class="paint-fills sunken-panel" hidden>
          ${FILL_STYLES.map((style) => `
            <button class="fill-button" data-fill="${style.id}" title="${style.label}" aria-label="${style.label}">
              <svg viewBox="0 0 16 13" shape-rendering="crispEdges">${style.icon}</svg>
            </button>
          `).join('')}
        </div>
      </div>

      <div class="paint-canvas-area">
        <canvas class="paint-canvas"></canvas>
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
    // The tool to go back to after picking a color
    previousTool: 'pencil',
    size: SIZES[0],
    fillStyle: 'outline',
    color: '#000000',
    // The Text tool's box while you type, or null
    textBox: null,
    undoSteps: [],
    // True when the picture has changes that haven't been saved yet
    changed: false,
  };

  setCanvasSize(paint, DEFAULT_WIDTH, DEFAULT_HEIGHT);
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
    if (key === 'e') {
      event.preventDefault();
      changeSize(paint);
    }
  });

  return root;
}

function runCommand(command, paint) {
  if (command === 'new') startNewPicture(paint);
  if (command === 'save') save(paint);
  if (command === 'save-as') saveAs(paint);
  if (command === 'undo') undo(paint);
  if (command === 'attributes') changeSize(paint);
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
    if (tool !== paint.tool) paint.previousTool = paint.tool;
    paint.tool = tool;
    select('.tool-button', (b) => b.dataset.tool === tool);
    // Only rectangles and ellipses can be filled in
    root.querySelector('.paint-fills').hidden = !['rectangle', 'ellipse'].includes(tool);
  }

  function selectFillStyle(style) {
    paint.fillStyle = style;
    select('.fill-button', (b) => b.dataset.fill === style);
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

  root.querySelector('.paint-fills').addEventListener('click', (event) => {
    const button = event.target.closest('[data-fill]');
    if (button) selectFillStyle(button.dataset.fill);
  });

  root.querySelector('.palette-colors').addEventListener('click', (event) => {
    const button = event.target.closest('[data-color]');
    if (button) selectColor(button.dataset.color);
  });

  selectTool(paint.tool);
  selectSize(paint.size);
  selectFillStyle(paint.fillStyle);
  selectColor(paint.color);

  // The color picker changes the color and the tool
  paint.selectTool = selectTool;
  paint.selectColor = selectColor;
}

// ---------- Drawing ----------

function setUpDrawing(paint) {
  const { canvas, root } = paint;
  // While drawing with the pencil or eraser: the last point drawn
  let lastPoint = null;
  // While dragging out a shape: where it started, and the picture
  // from before, to draw the shape afresh over it at every move
  let shape = null;

  canvas.addEventListener('pointerdown', (event) => {
    // Left button, a finger or a pen; not right-click
    if (event.button !== 0) return;
    event.preventDefault();
    const point = clampToCanvas(canvas, toCanvasPoint(canvas, event));

    // A text box being typed in is finished first. With the Text
    // tool, that's all a click does, like the real thing.
    if (paint.textBox) {
      paint.textBox.blur();
      if (paint.tool === 'text') return;
    }

    if (paint.tool === 'text') {
      // Wait for the pointer to be let go, so the new text box
      // keeps the focus
      canvas.addEventListener('pointerup', () => startText(paint, point), { once: true });
      return;
    }

    root.focus({ preventScroll: true });

    if (paint.tool === 'picker') {
      pickColor(paint, point);
      return;
    }

    rememberForUndo(paint);

    if (paint.tool === 'fill') {
      floodFill(paint, point, paint.color);
      return;
    }

    // Keep getting moves even if the pointer leaves the canvas
    canvas.setPointerCapture(event.pointerId);

    if (SHAPE_TOOLS.includes(paint.tool)) {
      shape = { start: point, before: paint.undoSteps.at(-1) };
      drawShape(paint, point, point);
      return;
    }

    lastPoint = point;
    drawLine(paint, lastPoint, point);
  });

  canvas.addEventListener('pointermove', (event) => {
    const point = toCanvasPoint(canvas, event);

    if (shape) {
      paint.ctx.putImageData(shape.before, 0, 0);
      const end = event.shiftKey ? constrain(paint.tool, shape.start, point) : point;
      drawShape(paint, shape.start, end);
      return;
    }

    if (!lastPoint) return;
    drawLine(paint, lastPoint, point);
    lastPoint = point;
  });

  const stop = () => {
    lastPoint = null;
    shape = null;
  };
  canvas.addEventListener('pointerup', stop);
  canvas.addEventListener('pointercancel', stop);
}

// Turns a pointer position on screen into a pixel of the picture.
function toCanvasPoint(canvas, event) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: Math.floor((event.clientX - rect.left) * canvas.width / rect.width),
    y: Math.floor((event.clientY - rect.top) * canvas.height / rect.height),
  };
}

// A click on the very edge can land just outside the picture
function clampToCanvas(canvas, point) {
  return {
    x: Math.min(Math.max(point.x, 0), canvas.width - 1),
    y: Math.min(Math.max(point.y, 0), canvas.height - 1),
  };
}

// Draws with the pencil or eraser from one point to another
function drawLine(paint, from, to) {
  const isEraser = paint.tool === 'eraser';
  stampLine(paint.ctx, from, to,
    isEraser ? eraserSize(paint.size) : paint.size,
    isEraser ? '#ffffff' : paint.color);
}

// Draws a line by stamping a square at every pixel along the way.
// Stamping whole pixels (instead of the canvas's smooth lines) keeps
// the edges sharp, and keeps every colour exact so the paint bucket
// works. Every tool draws its lines this way.
function stampLine(ctx, from, to, size, color) {
  const half = Math.floor(size / 2);
  ctx.fillStyle = color;

  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const steps = Math.max(Math.abs(dx), Math.abs(dy), 1);

  for (let i = 0; i <= steps; i++) {
    const x = Math.round(from.x + (dx * i) / steps);
    const y = Math.round(from.y + (dy * i) / steps);
    ctx.fillRect(x - half, y - half, size, size);
  }
}

// ---------- Lines, rectangles and ellipses ----------

// Draws the chosen shape between two corners (for a line, its two ends)
function drawShape(paint, a, b) {
  const { ctx, size, color } = paint;
  const filled = paint.fillStyle === 'filled';
  const left = Math.min(a.x, b.x);
  const right = Math.max(a.x, b.x);
  const top = Math.min(a.y, b.y);
  const bottom = Math.max(a.y, b.y);

  if (paint.tool === 'line') {
    stampLine(ctx, a, b, size, color);
  }

  if (paint.tool === 'rectangle') {
    if (filled) {
      ctx.fillStyle = color;
      ctx.fillRect(left, top, right - left + 1, bottom - top + 1);
    } else {
      const corners = [
        { x: left, y: top }, { x: right, y: top }, { x: right, y: bottom }, { x: left, y: bottom },
      ];
      corners.forEach((corner, i) => stampLine(ctx, corner, corners[(i + 1) % 4], size, color));
    }
  }

  if (paint.tool === 'ellipse') {
    drawEllipse(ctx, { left, right, top, bottom }, filled, size, color);
  }
}

function drawEllipse(ctx, box, filled, size, color) {
  const cx = (box.left + box.right) / 2;
  const cy = (box.top + box.bottom) / 2;
  const rx = (box.right - box.left) / 2;
  const ry = (box.bottom - box.top) / 2;

  if (filled) {
    // One row of pixels at a time, as wide as the ellipse is there
    ctx.fillStyle = color;
    for (let y = box.top; y <= box.bottom; y++) {
      const dy = ry === 0 ? 0 : (y - cy) / (ry + 0.5);
      const halfWidth = (rx + 0.5) * Math.sqrt(Math.max(0, 1 - dy * dy));
      const from = Math.round(cx - halfWidth);
      const to = Math.round(cx + halfWidth);
      ctx.fillRect(from, y, Math.max(1, to - from), 1);
    }
    return;
  }

  // The outline: points all the way round, joined by short lines.
  // Enough points that neighbours are never more than a pixel apart.
  const steps = Math.max(8, Math.ceil(2 * Math.PI * Math.max(rx, ry)));
  let previous = null;
  for (let i = 0; i <= steps; i++) {
    const angle = (2 * Math.PI * i) / steps;
    const point = { x: Math.round(cx + rx * Math.cos(angle)), y: Math.round(cy + ry * Math.sin(angle)) };
    if (previous) stampLine(ctx, previous, point, size, color);
    previous = point;
  }
}

// With Shift held: a line snaps to the nearest of horizontal,
// vertical and 45 degrees; a rectangle or ellipse becomes square
function constrain(tool, start, point) {
  const dx = point.x - start.x;
  const dy = point.y - start.y;

  if (tool === 'line') {
    const angle = Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) * (Math.PI / 4);
    const length = Math.hypot(dx, dy);
    return { x: start.x + Math.round(length * Math.cos(angle)), y: start.y + Math.round(length * Math.sin(angle)) };
  }

  const side = Math.max(Math.abs(dx), Math.abs(dy));
  return { x: start.x + side * Math.sign(dx || 1), y: start.y + side * Math.sign(dy || 1) };
}

// ---------- Picking a color ----------

// Takes the color of the clicked pixel, then goes back to the tool
// you were using before
function pickColor(paint, point) {
  const [r, g, b] = paint.ctx.getImageData(point.x, point.y, 1, 1).data;
  const hex = `#${[r, g, b].map((n) => n.toString(16).padStart(2, '0')).join('')}`;
  paint.selectColor(hex);
  paint.selectTool(paint.previousTool);
}

// ---------- Text ----------

// Opens a box on the picture to type in. Enter (or clicking
// elsewhere) puts the text on the picture; Escape leaves it off.
function startText(paint, point) {
  const { canvas } = paint;
  const fontSize = FONT_SIZES[SIZES.indexOf(paint.size)];
  // How many screen pixels one picture pixel is right now
  const scale = canvas.clientWidth / canvas.width;

  const input = document.createElement('input');
  input.className = 'paint-text-input';
  input.spellcheck = false;
  input.style.left = `${canvas.offsetLeft + point.x * scale}px`;
  input.style.top = `${canvas.offsetTop + point.y * scale}px`;
  input.style.font = `${fontSize * scale}px ${FONT_FAMILY}`;
  input.style.color = paint.color;
  input.style.width = '3ch';

  let done = false;
  function finish(keep) {
    if (done) return;
    done = true;
    input.remove();
    paint.textBox = null;
    if (keep && input.value.trim()) {
      rememberForUndo(paint);
      drawText(paint, input.value, point, fontSize, paint.color);
    }
    paint.root.focus({ preventScroll: true });
  }

  input.addEventListener('input', () => {
    input.style.width = `${Math.max(3, input.value.length + 2)}ch`;
  });
  input.addEventListener('keydown', (event) => {
    // Keep keys (like Ctrl+Z) for the text box while typing
    event.stopPropagation();
    if (event.key === 'Enter') finish(true);
    if (event.key === 'Escape') finish(false);
  });
  input.addEventListener('blur', () => finish(true));

  paint.textBox = input;
  canvas.parentElement.append(input);
  input.focus();
}

// Puts text on the picture in solid pixels of one color. The canvas
// draws letters with soft, blended edges; those would make the paint
// bucket stop short, so the letters are drawn on a spare canvas first
// and every pixel that is mostly covered is copied across in full.
function drawText(paint, text, point, fontSize, color) {
  const { width, height } = paint.canvas;
  const spare = document.createElement('canvas');
  spare.width = width;
  spare.height = height;
  const spareCtx = spare.getContext('2d', { willReadFrequently: true });
  spareCtx.font = `${fontSize}px ${FONT_FAMILY}`;
  spareCtx.textBaseline = 'top';
  spareCtx.fillStyle = '#000000';
  spareCtx.fillText(text, point.x, point.y);
  const letters = spareCtx.getImageData(0, 0, width, height).data;

  const image = paint.ctx.getImageData(0, 0, width, height);
  const pixels = new Uint32Array(image.data.buffer);
  const fill = colorToPixel(color);
  for (let i = 0; i < pixels.length; i++) {
    if (letters[i * 4 + 3] >= 128) pixels[i] = fill;
  }
  paint.ctx.putImageData(image, 0, 0);
}

// The paint bucket: changes the clicked pixel and every touching
// pixel of the same colour to the new colour.
function floodFill(paint, start, color) {
  const { ctx } = paint;
  const { width, height } = paint.canvas;
  const image = ctx.getImageData(0, 0, width, height);
  // Each pixel as one number, so comparing colours is quick
  const pixels = new Uint32Array(image.data.buffer);

  const target = pixels[start.y * width + start.x];
  const fill = colorToPixel(color);
  if (target === fill) return;

  // Pixels still to look at, as positions in the pixels list
  const toVisit = [start.y * width + start.x];

  while (toVisit.length > 0) {
    const i = toVisit.pop();
    if (pixels[i] !== target) continue;
    pixels[i] = fill;

    const x = i % width;
    if (x > 0) toVisit.push(i - 1);
    if (x < width - 1) toVisit.push(i + 1);
    if (i >= width) toVisit.push(i - width);
    if (i < width * (height - 1)) toVisit.push(i + width);
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
  paint.ctx.fillRect(0, 0, paint.canvas.width, paint.canvas.height);
}

// ---------- The picture's size ----------

// Sets the picture's size in pixels (which empties it), and its size
// on screen to match: one virtual pixel per picture pixel
function setCanvasSize(paint, width, height) {
  const { canvas } = paint;
  canvas.width = width;
  canvas.height = height;
  canvas.style.width = `calc(var(--px) * ${width})`;
  canvas.style.height = `calc(var(--px) * ${height})`;
}

// Image > Attributes: asks for a new size. The picture stays in the
// top-left corner; a bigger one gets white around it, a smaller one
// loses its right and bottom edges. Undo puts the old size back.
async function changeSize(paint) {
  const { canvas } = paint;
  const size = await showSizeDialog(paint.root, {
    width: canvas.width,
    height: canvas.height,
    defaultWidth: DEFAULT_WIDTH,
    defaultHeight: DEFAULT_HEIGHT,
    max: MAX_SIZE,
  });
  paint.root.focus({ preventScroll: true });
  if (!size || (size.width === canvas.width && size.height === canvas.height)) return;

  rememberForUndo(paint);
  const picture = paint.undoSteps.at(-1);
  setCanvasSize(paint, size.width, size.height);
  clearCanvas(paint);
  paint.ctx.putImageData(picture, 0, 0);
}

// ---------- Undo ----------

// Takes a copy of the picture before each change.
// Every change goes through here, so it also marks the picture changed.
function rememberForUndo(paint) {
  paint.changed = true;
  paint.undoSteps.push(paint.ctx.getImageData(0, 0, paint.canvas.width, paint.canvas.height));
  if (paint.undoSteps.length > MAX_UNDO) paint.undoSteps.shift();
}

function undo(paint) {
  const previous = paint.undoSteps.pop();
  if (!previous) return;
  // Undoing a change of size puts the old size back too
  if (previous.width !== paint.canvas.width || previous.height !== paint.canvas.height) {
    setCanvasSize(paint, previous.width, previous.height);
  }
  paint.ctx.putImageData(previous, 0, 0);
  paint.changed = true;
}

// ---------- Opening and saving ----------

// Pictures are stored as PNG data URLs. The picture keeps its own size.
function openPicture(paint, dataUrl) {
  if (!dataUrl) return;
  const image = new Image();
  image.onload = () => {
    setCanvasSize(paint, image.naturalWidth, image.naturalHeight);
    paint.ctx.drawImage(image, 0, 0);
  };
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
  if (choice === 'cancel') {
    // Stay in the app, so typing and Ctrl+S carry on working
    paint.root.focus({ preventScroll: true });
    return false;
  }
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
