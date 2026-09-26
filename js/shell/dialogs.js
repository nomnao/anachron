// Small pop-up boxes that ask a question.
// Each one covers `container` so nothing behind it can be clicked,
// and gives back the answer as a promise.

import { fileExists } from '../system/fs.js';

// A yes/no question. Gives back true (confirmed) or false (cancelled).
//
//   const ok = await showConfirmDialog(desktop, {
//     title: 'Confirm File Delete',
//     message: "Are you sure you want to delete 'diary.txt'?",
//     confirmLabel: 'Yes',
//     cancelLabel: 'No',
//   });
//
// With cancelLabel: null there is only one button, for simple messages.
export async function showConfirmDialog(container, { title, message, confirmLabel = 'OK', cancelLabel = 'Cancel' }) {
  const choices = [{ label: confirmLabel, value: 'confirm' }];
  if (cancelLabel) choices.push({ label: cancelLabel, value: 'cancel' });

  const choice = await showChoiceDialog(container, { title, message, choices, escapeValue: 'cancel' });
  return choice === 'confirm';
}

// "Do you want to save changes to letter.txt?" with Yes, No and Cancel.
// A different question can be passed as message.
// Gives back 'save', 'discard' or 'cancel'.
export function showSaveChangesDialog(container, { title, fileName, message }) {
  return showChoiceDialog(container, {
    title,
    message: message ?? `Do you want to save changes to ${fileName}?`,
    choices: [
      { label: 'Yes', value: 'save' },
      { label: 'No', value: 'discard' },
      { label: 'Cancel', value: 'cancel' },
    ],
    escapeValue: 'cancel',
  });
}

// A message with a row of buttons. Gives back the value of the button
// pressed, or escapeValue if Escape was pressed. The first button has
// focus, so Enter presses it.
function showChoiceDialog(container, { title, message, choices, escapeValue }) {
  return new Promise((resolve) => {
    const overlay = createDialog(title, `
      <p class="dialog-message"></p>
      <div class="dialog-buttons"></div>
    `);

    // The message can contain file names people typed,
    // so all the words are set as plain text, never HTML
    overlay.querySelector('.dialog-message').textContent = message;

    function finish(result) {
      overlay.remove();
      resolve(result);
    }

    const buttons = choices.map(({ label, value }) => {
      const button = document.createElement('button');
      button.className = 'push-button';
      button.dataset.choice = value;
      button.textContent = label;
      button.addEventListener('click', () => finish(value));
      return button;
    });
    overlay.querySelector('.dialog-buttons').append(...buttons);

    overlay.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') finish(escapeValue);
    });

    container.append(overlay);
    buttons[0].focus();
  });
}

// The "Save As" box. Gives back the chosen file name, or null if cancelled.
//
//   fileName  - the name to start with, e.g. 'Untitled.txt'
//   extension - added when the name has none, e.g. '.txt'
//
// If the name is already taken it warns first; pressing Save again
// with the same name means "yes, replace it".
export function showSaveAsDialog(container, { fileName, extension }) {
  // Only one Save As box at a time
  if (container.querySelector(':scope > .dialog-overlay')) {
    return Promise.resolve(null);
  }

  return new Promise((resolve) => {
    const overlay = createDialog('Save As', `
      <label class="dialog-field">
        File name:
        <input class="dialog-input sunken-panel" type="text" maxlength="40" spellcheck="false">
      </label>
      <p class="dialog-message"></p>
      <div class="dialog-buttons">
        <button class="push-button" data-choice="save">Save</button>
        <button class="push-button" data-choice="cancel">Cancel</button>
      </div>
    `);
    container.append(overlay);

    const input = overlay.querySelector('.dialog-input');
    const message = overlay.querySelector('.dialog-message');
    input.value = fileName;
    input.focus();
    input.select();

    // The name we already warned about
    let warnedName = null;

    function trySave() {
      const name = toFileName(input.value, extension);

      if (!name) {
        message.textContent = 'Please type a file name.';
        input.focus();
        return;
      }

      if (fileExists(name) && name !== fileName && name !== warnedName) {
        message.textContent = `${name} already exists. Press Save again to replace it.`;
        warnedName = name;
        input.focus();
        return;
      }

      finish(name);
    }

    function finish(result) {
      overlay.remove();
      resolve(result);
    }

    overlay.querySelector('[data-choice="save"]').addEventListener('click', trySave);
    overlay.querySelector('[data-choice="cancel"]').addEventListener('click', () => finish(null));

    input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') trySave();
      if (event.key === 'Escape') finish(null);
    });

    // Typing a different name clears the warning
    input.addEventListener('input', () => {
      message.textContent = '';
      warnedName = null;
    });
  });
}

// Tidies what was typed into a file name: trims spaces and adds the
// extension when there is none. Returns '' if nothing is left.
function toFileName(typed, extension) {
  const name = typed.trim();
  if (!name) return '';
  return name.includes('.') ? name : name + extension;
}

// The grey box with a blue title bar that every dialog shares.
function createDialog(title, bodyHtml) {
  const overlay = document.createElement('div');
  overlay.className = 'dialog-overlay';
  overlay.innerHTML = `
    <div class="dialog" role="dialog">
      <div class="dialog-title"></div>
      <div class="dialog-body">${bodyHtml}</div>
    </div>
  `;
  overlay.querySelector('.dialog').setAttribute('aria-label', title);
  overlay.querySelector('.dialog-title').textContent = title;
  return overlay;
}
