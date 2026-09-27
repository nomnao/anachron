// The desktop background: a color, a pattern drawn over it in black,
// and a wallpaper picture (any saved image) on top. Chosen in
// Display Properties, kept in the browser, and drawn on the desktop
// and on the little preview screen in Display Properties.

import { readFile, onFileRenamed } from '../system/fs.js';

const STORAGE_KEY = 'anachron.display';

// 16 colors, like an old graphics card. The first is the one
// ANACHRON starts with.
export const COLORS = [
  '#008080', '#000000', '#808080', '#c0c0c0', '#ffffff', '#800000', '#008000', '#000080',
  '#800080', '#808000', '#ff0000', '#00ff00', '#0000ff', '#ff00ff', '#ffff00', '#00ffff',
];

// Patterns are 8 by 8 pixels, repeated over the whole desktop.
// Each row is 8 pixels: 1 is black, 0 lets the color show through.
export const PATTERNS = [
  { id: 'none', label: '(None)' },
  { id: 'bricks', label: 'Bricks', rows: ['11111111', '10000000', '10000000', '10000000',
    '11111111', '00001000', '00001000', '00001000'] },
  { id: 'checkers', label: 'Checkers', rows: ['10101010', '01010101', '10101010', '01010101',
    '10101010', '01010101', '10101010', '01010101'] },
  { id: 'diagonal', label: 'Diagonal', rows: ['10000000', '01000000', '00100000', '00010000',
    '00001000', '00000100', '00000010', '00000001'] },
  { id: 'diamonds', label: 'Diamonds', rows: ['00010000', '00101000', '01000100', '10000010',
    '01000100', '00101000', '00010000', '00000000'] },
  { id: 'dots', label: 'Dots', rows: ['10000000', '00000000', '00001000', '00000000',
    '10000000', '00000000', '00001000', '00000000'] },
  { id: 'waffle', label: 'Waffle', rows: ['11111111', '10000000', '10000000', '10000000',
    '10000000', '10000000', '10000000', '10000000'] },
  { id: 'weave', label: 'Weave', rows: ['10001000', '01010100', '00100010', '01000101',
    '10001000', '00010101', '00100010', '01010001'] },
  { id: 'zigzag', label: 'Zigzag', rows: ['10000000', '01000001', '00100010', '00010100',
    '00001000', '00000000', '00000000', '00000000'] },
];

// How a wallpaper picture is laid out
export const WALLPAPER_MODES = [
  { id: 'center', label: 'Center' },
  { id: 'tile', label: 'Tile' },
  { id: 'stretch', label: 'Stretch' },
];

const DEFAULTS = { color: COLORS[0], pattern: 'none', wallpaper: null, wallpaperMode: 'center' };

// ---------- The settings ----------

const listeners = [];

// The settings in use. Also kept in memory, in case the browser
// can't store them.
let current = loadDisplaySettings();

// listener(settings) runs whenever the settings are saved.
// Returns a function that stops listening.
export function onDisplaySettingsChanged(listener) {
  listeners.push(listener);
  return () => listeners.splice(listeners.indexOf(listener), 1);
}

function loadDisplaySettings() {
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(STORAGE_KEY)) };
  } catch {
    return { ...DEFAULTS };
  }
}

export function saveDisplaySettings(settings) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Not kept, but the desktop still changes until the page closes
  }
  current = { ...settings };
  for (const listener of [...listeners]) listener({ ...settings });
}

export function currentDisplaySettings() {
  return { ...current };
}

// The wallpaper follows its picture when the picture is renamed
onFileRenamed((oldName, newName) => {
  if (current.wallpaper === oldName) saveDisplaySettings({ ...current, wallpaper: newName });
});

// ---------- Drawing it ----------

// Paints the background onto an element. scale shrinks the wallpaper
// picture, for the preview screen (the desktop itself uses 1).
// A wallpaper whose picture no longer exists is left out.
export async function paintBackground(element, settings, scale = 1) {
  // Only the latest call gets to paint (pictures load at their own pace)
  const ticket = (element.paintTicket ?? 0) + 1;
  element.paintTicket = ticket;

  const layers = [];

  const picture = settings.wallpaper ? readFile(settings.wallpaper) : null;
  if (picture) {
    const size = await pictureSize(picture);
    if (element.paintTicket !== ticket) return;
    if (size) layers.push(wallpaperLayer(picture, size, settings.wallpaperMode, scale));
  }

  const pattern = PATTERNS.find((p) => p.id === settings.pattern);
  if (pattern?.rows) {
    layers.push({
      image: `url("${patternImage(pattern.rows)}")`,
      // Each pattern pixel is 2 virtual pixels: at 1, the fine lines
      // round unevenly to screen pixels and blur into moiré
      size: 'calc(var(--px) * 16) calc(var(--px) * 16)',
      position: '0 0',
      repeat: 'repeat',
    });
  }

  element.style.backgroundColor = settings.color;
  element.style.backgroundImage = layers.map((l) => l.image).join(', ');
  element.style.backgroundSize = layers.map((l) => l.size).join(', ');
  element.style.backgroundPosition = layers.map((l) => l.position).join(', ');
  element.style.backgroundRepeat = layers.map((l) => l.repeat).join(', ');
}

function wallpaperLayer(picture, { width, height }, mode, scale) {
  const size = `calc(var(--px) * ${width * scale}) calc(var(--px) * ${height * scale})`;
  if (mode === 'stretch') {
    return { image: `url("${picture}")`, size: '100% 100%', position: '0 0', repeat: 'no-repeat' };
  }
  if (mode === 'tile') {
    return { image: `url("${picture}")`, size, position: '0 0', repeat: 'repeat' };
  }
  return { image: `url("${picture}")`, size, position: 'center', repeat: 'no-repeat' };
}

// Icon labels sit on the desktop color, so they need dark text on
// light colors and white text on dark ones
export function labelTextColor(color) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(color.slice(i, i + 2), 16));
  return 0.299 * r + 0.587 * g + 0.114 * b > 150 ? '#000000' : '#ffffff';
}

// An 8 by 8 picture of the pattern, as a data URL
function patternImage(rows) {
  const squares = rows.flatMap((row, y) => [...row].map((bit, x) => (bit === '1' ? `M${x} ${y}h1v1h-1z` : '')));
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="8" height="8" shape-rendering="crispEdges">`
    + `<path d="${squares.join('')}" fill="#000"/></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

// A picture's size in pixels, or null if it can't be loaded.
// The last few are remembered, since the same picture is asked
// about again and again.
const sizes = new Map();

function pictureSize(url) {
  if (!sizes.has(url)) {
    if (sizes.size >= 8) sizes.delete(sizes.keys().next().value);
    sizes.set(url, new Promise((resolve) => {
      const image = new Image();
      image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight });
      image.onerror = () => resolve(null);
      image.src = url;
    }));
  }
  return sizes.get(url);
}
