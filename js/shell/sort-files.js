// Sorting icons and files, for the desktop's Arrange Icons and the
// column titles in My Files. Both sort "entries", which describe
// an app or a file the same way:
//   { name, typeLabel, size, modified }
// Apps have no size (0) and no date.

import { fileTypeOf } from '../app.js';
import { fileSize } from '../system/fs.js';

export function fileEntry(file) {
  return {
    name: file.name,
    typeLabel: fileTypeOf(file).label,
    size: fileSize(file),
    modified: file.modified,
  };
}

export function appEntry(app) {
  return { name: app.title, typeLabel: 'Application', size: 0, modified: undefined };
}

// A to Z, ignoring case, with numbers in order ("notes 9" before "notes 10")
const byName = (a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });

// Every way to sort. Ties are broken by name.
export const SORT_ORDERS = [
  { id: 'name', label: 'by Name', compare: byName },
  { id: 'type', label: 'by Type', compare: (a, b) => a.typeLabel.localeCompare(b.typeLabel) || byName(a, b) },
  { id: 'size', label: 'by Size', compare: (a, b) => a.size - b.size || byName(a, b) },
  // Newest first. Anything without a date (apps, and files saved
  // before dates were kept) comes last.
  { id: 'date', label: 'by Date', compare: (a, b) => (b.modified ?? 0) - (a.modified ?? 0) || byName(a, b) },
];

// Sorts a list of { entry, ... } items by one of SORT_ORDERS' ids.
// descending reverses it. Gives back a new list.
export function sortByEntry(items, orderId, descending = false) {
  const order = SORT_ORDERS.find((o) => o.id === orderId);
  if (!order) return [...items];

  const sorted = [...items].sort((a, b) => order.compare(a.entry, b.entry));
  return descending ? sorted.reverse() : sorted;
}
