// Renaming files, for the desktop and My Files.
// The name turns into a text box right where it is shown;
// Enter (or clicking elsewhere) keeps the new name, Escape cancels.

import { showConfirmDialog } from './dialogs.js';
import { fileExists, renameFile } from '../system/fs.js';

// Lets the user rename the file whose name is shown in labelElement.
// Gives back the new name, or null if nothing changed.
export async function renameInPlace(labelElement, oldName) {
  const typed = await editNameInPlace(labelElement, oldName);
  if (typed === null) return null;
  return renameWithChecks(oldName, typed);
}

// Puts a text box over the label, with the name before the
// extension selected, so typing replaces just that part.
// Gives back what was typed, or null if cancelled.
function editNameInPlace(labelElement, name) {
  return new Promise((resolve) => {
    const desktop = document.querySelector('#desktop');
    const input = document.createElement('input');
    input.className = 'rename-input';
    input.value = name;
    input.maxLength = 40;
    input.spellcheck = false;

    // The box floats over the label (it belongs to the whole desktop,
    // so it works for icons and for rows inside a window alike)
    const area = desktop.getBoundingClientRect();
    const label = labelElement.getBoundingClientRect();
    input.style.left = `${label.left - area.left - 2}px`;
    input.style.top = `${label.top - area.top - 2}px`;
    input.style.width = `${Math.max(label.width + 24, area.width * 0.16)}px`;
    input.style.height = `${label.height + 4}px`;

    desktop.append(input);
    input.focus();
    const dot = name.lastIndexOf('.');
    input.setSelectionRange(0, dot > 0 ? dot : name.length);

    let done = false;
    function finish(result) {
      if (done) return;
      done = true;
      input.remove();
      resolve(result);
    }

    input.addEventListener('keydown', (event) => {
      // Keep keys (Enter, Delete, arrows...) from also reaching
      // the desktop or My Files while typing
      event.stopPropagation();
      if (event.key !== 'Enter' && event.key !== 'Escape') return;

      // Use up the key, so it can't also press a button that
      // appears next (like OK on a "name already exists" message)
      event.preventDefault();
      finish(event.key === 'Enter' ? input.value : null);
    });
    input.addEventListener('blur', () => finish(input.value));
  });
}

// Checks the new name and renames the file.
// Gives back the new name, or null if it was not renamed.
async function renameWithChecks(oldName, typed) {
  let newName = typed.trim();
  if (!newName || newName === oldName) return null;

  // Leaving off the extension keeps the old one
  const dot = oldName.lastIndexOf('.');
  if (!newName.includes('.') && dot > 0) newName += oldName.slice(dot);

  const desktop = document.querySelector('#desktop');

  if (fileExists(newName)) {
    await showConfirmDialog(desktop, {
      title: 'Error Renaming File',
      message: `Cannot rename ${oldName}: a file named ${newName} already exists.`,
      cancelLabel: null,
    });
    return null;
  }

  if (!(await renameFile(oldName, newName))) {
    await showConfirmDialog(desktop, {
      title: 'Error Renaming File',
      message: `${oldName} could not be renamed.`,
      cancelLabel: null,
    });
    return null;
  }

  return newName;
}
