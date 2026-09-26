// Questions about the Recycle Bin that the desktop, My Files and
// the Recycle Bin window all ask.

import { showConfirmDialog } from './dialogs.js';
import { recycleFile, listRecycled, emptyRecycleBin } from '../system/fs.js';

// Deleting a file: asks first, then sends it to the Recycle Bin,
// where it can still be restored.
// Gives back true if the file went to the Recycle Bin.
export async function confirmRecycle(container, name) {
  const confirmed = await showConfirmDialog(container, {
    title: 'Confirm File Delete',
    message: `Are you sure you want to send '${name}' to the Recycle Bin?`,
    confirmLabel: 'Yes',
    cancelLabel: 'No',
  });

  if (confirmed) await recycleFile(name);
  return confirmed;
}

// Asks, then deletes everything in the Recycle Bin for good.
// Does nothing if the bin is already empty.
export async function confirmEmptyRecycleBin(container) {
  const count = listRecycled().length;
  if (count === 0) return;

  const confirmed = await showConfirmDialog(container, {
    title: 'Confirm Multiple File Delete',
    message: count === 1
      ? 'Are you sure you want to permanently delete this item?'
      : `Are you sure you want to permanently delete these ${count} items?`,
    confirmLabel: 'Yes',
    cancelLabel: 'No',
  });

  if (confirmed) emptyRecycleBin();
}
