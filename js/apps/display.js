// Display Properties: choose the desktop's color, pattern and
// wallpaper. The little screen at the top shows what you've picked;
// Apply (or OK) puts it on the desktop, Cancel leaves it as it was.
// It opens from the desktop's right-click menu (Properties).

import { fileTypeOf } from '../app.js';
import { listFiles, onFilesChanged } from '../system/fs.js';
import {
  COLORS, PATTERNS, WALLPAPER_MODES,
  currentDisplaySettings, saveDisplaySettings, paintBackground,
} from '../shell/background.js';

// The preview screen is this many virtual pixels wide, standing in
// for the 640-pixel desktop
const PREVIEW_WIDTH = 128;

// context comes from the desktop:
//   close - closes the window
export function createApp(context) {
  const root = document.createElement('div');
  root.className = 'display';
  root.innerHTML = `
    <div class="display-monitor">
      <div class="display-screen"></div>
    </div>

    <div class="display-columns">
      <fieldset class="display-group">
        <legend>Pattern</legend>
        <div class="display-list sunken-panel" data-list="pattern"></div>
      </fieldset>

      <fieldset class="display-group">
        <legend>Wallpaper</legend>
        <div class="display-list sunken-panel" data-list="wallpaper"></div>
        <div class="display-modes">
          ${WALLPAPER_MODES.map((mode) => `
            <label><input type="radio" name="wallpaper-mode" value="${mode.id}"> ${mode.label}</label>
          `).join('')}
        </div>
      </fieldset>
    </div>

    <fieldset class="display-group">
      <legend>Color</legend>
      <div class="display-colors">
        ${COLORS.map((color) => `
          <button class="display-swatch" data-color="${color}" style="background: ${color}"
                  aria-label="Color ${color}"></button>
        `).join('')}
      </div>
    </fieldset>

    <div class="display-buttons">
      <button class="push-button" data-choice="ok">OK</button>
      <button class="push-button" data-choice="cancel">Cancel</button>
      <button class="push-button" data-choice="apply">Apply</button>
    </div>
  `;

  // What's picked in the window, not yet on the desktop
  const display = { root, draft: currentDisplaySettings() };

  render(display);

  // New or deleted pictures show up in the wallpaper list straight
  // away. Once the window has been closed, stop listening.
  const stopListening = onFilesChanged(() => {
    if (!root.isConnected) {
      stopListening();
      return;
    }
    render(display);
  });

  root.addEventListener('click', (event) => {
    const item = event.target.closest('.display-item');
    if (item) {
      const list = item.parentElement.dataset.list;
      // (None) is 'none' for the pattern, and no picture for the wallpaper
      display.draft[list] = list === 'wallpaper' ? item.dataset.value || null : item.dataset.value;
      render(display);
    }

    const swatch = event.target.closest('.display-swatch');
    if (swatch) {
      display.draft.color = swatch.dataset.color;
      render(display);
    }

    const choice = event.target.closest('[data-choice]')?.dataset.choice;
    if (choice === 'ok' || choice === 'apply') saveDisplaySettings(display.draft);
    if (choice === 'ok' || choice === 'cancel') context.close();
  });

  root.addEventListener('change', (event) => {
    if (event.target.name === 'wallpaper-mode') {
      display.draft.wallpaperMode = event.target.value;
      render(display);
    }
  });

  return root;
}

// ---------- Drawing ----------

function render(display) {
  const { root, draft } = display;

  renderList(root.querySelector('[data-list="pattern"]'),
    PATTERNS.map((p) => ({ value: p.id, label: p.label })),
    draft.pattern);

  // Every saved picture can be a wallpaper
  const pictures = listFiles().filter((file) => file.type === 'image');
  renderList(root.querySelector('[data-list="wallpaper"]'),
    [{ value: '', label: '(None)' }, ...pictures.map((file) => ({
      value: file.name, label: file.name, icon: fileTypeOf(file).icon,
    }))],
    draft.wallpaper ?? '');

  // Center, Tile and Stretch only matter when there's a wallpaper
  for (const radio of root.querySelectorAll('[name="wallpaper-mode"]')) {
    radio.checked = radio.value === draft.wallpaperMode;
    radio.disabled = !draft.wallpaper;
  }

  for (const swatch of root.querySelectorAll('.display-swatch')) {
    swatch.classList.toggle('is-selected', swatch.dataset.color === draft.color);
  }

  paintBackground(root.querySelector('.display-screen'), draft, PREVIEW_WIDTH / 640);
}

// Fills a list with items ({ value, label, icon? }), marking the
// one whose value is selectedValue
function renderList(list, items, selectedValue) {
  list.replaceChildren(...items.map((item) => {
    const row = document.createElement('div');
    row.className = 'display-item';
    row.dataset.value = item.value;
    row.classList.toggle('is-selected', item.value === selectedValue);
    if (item.icon) {
      const icon = document.createElement('img');
      icon.src = item.icon;
      icon.alt = '';
      row.append(icon);
    }
    // File names are typed by people, so they are plain text, never HTML
    const label = document.createElement('span');
    label.textContent = item.label;
    row.append(label);
    return row;
  }));

  // Scroll the list (only the list, not the window) to the chosen item
  const selected = list.querySelector('.is-selected');
  if (selected) {
    const top = selected.offsetTop;
    if (top < list.scrollTop) list.scrollTop = top;
    if (top + selected.offsetHeight > list.scrollTop + list.clientHeight) {
      list.scrollTop = top + selected.offsetHeight - list.clientHeight;
    }
  }
}
