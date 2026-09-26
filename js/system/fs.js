import { trackEvent } from './analytics.js';

// The file system.
// Every file lives on the desktop and has a name, a type and its content.
//   type 'text'  - content is the text itself (Notepad)
//   type 'image' - content is a PNG picture as a data URL (Paint)
//   type 'video' - a recording (Video Recorder). Videos are far too big
//                  for the file list, so they are kept separately as
//                  "big files" (see the end of this file); the list
//                  only holds their size and length.
// Files are kept in the browser, so they survive a reload.

const STORAGE_KEY = 'anachron.files';

// A list of files, in the order they were first saved:
//   { name, type, content }                 - small files
//   { name, type, big: true, size, ... }    - big files
// Files saved before types existed were all text.
let files = loadFiles().map((file) => ({ type: 'text', ...file }));

// Functions that want to hear when files change (the desktop is one)
const listeners = [];
// Functions that want to hear when a file gets a new name
// (apps showing that file, so they can follow it)
const renameListeners = [];

// Returns a function that stops listening.
export function onFilesChanged(listener) {
  listeners.push(listener);
  return () => listeners.splice(listeners.indexOf(listener), 1);
}

// listener(oldName, newName) runs after a file is renamed.
// Returns a function that stops listening.
export function onFileRenamed(listener) {
  renameListeners.push(listener);
  return () => renameListeners.splice(renameListeners.indexOf(listener), 1);
}

export function listFiles() {
  return files.map((file) => ({ ...file }));
}

export function fileExists(name) {
  return files.some((file) => file.name === name);
}

// Returns a small file's content, or null if there is no such file.
export function readFile(name) {
  const file = files.find((f) => f.name === name);
  return file ? file.content : null;
}

// Creates the file, or replaces it if it already exists.
// Returns false if the browser had no room to keep it: the file
// still works until the page is closed, but will then be lost.
export function writeFile(name, content, type = 'text') {
  replaceEntry({ name, type, content });
  const kept = saveFiles();
  trackEvent('save-file');
  notify();
  return kept;
}

export function deleteFile(name) {
  const file = files.find((f) => f.name === name);
  files = files.filter((f) => f.name !== name);
  if (file?.big) deleteBig(name);

  saveFiles();
  notify();
}

// Gives a file a new name. Returns false if there is no such file,
// the new name is taken, or a big file couldn't be moved.
export async function renameFile(oldName, newName) {
  const file = files.find((f) => f.name === oldName);
  if (!file || fileExists(newName)) return false;

  // A big file's data is stored under its name, so move it
  if (file.big) {
    const blob = await readBigFile(oldName);
    if (!blob) return false;
    try {
      await useStore('readwrite', (store) => store.put(blob, newName));
    } catch {
      return false;
    }
    deleteBig(oldName);
  }

  file.name = newName;
  saveFiles();
  // Apps showing the file hear first, so they already know the
  // new name when everything else redraws
  for (const listener of [...renameListeners]) listener(oldName, newName);
  notify();
  return true;
}

// Puts a file in the list, in place of any file with the same name.
// If the old file was big, its stored data is removed too.
function replaceEntry(entry) {
  const index = files.findIndex((f) => f.name === entry.name);
  if (index === -1) {
    files.push(entry);
    return;
  }

  if (files[index].big && !entry.big) deleteBig(entry.name);
  files[index] = entry;
}

function notify() {
  for (const listener of listeners) listener(listFiles());
}

// ---------- Keeping files in the browser ----------

// localStorage can be missing or blocked (e.g. private browsing).
// Then files still work until the page is closed; they just aren't kept.

function loadFiles() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) ?? [];
  } catch {
    return [];
  }
}

// Returns true if the files were stored.
function saveFiles() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(files));
    return true;
  } catch {
    // Blocked, or full (pictures take far more room than text).
    // The files stay in memory.
    return false;
  }
}

// ---------- Big files (videos) ----------

// Big files live in IndexedDB, the browser's database, which has room
// for far more than localStorage. It is slower and works in the
// background, so saving and reading big files take a moment.

const DB_NAME = 'anachron';
const DB_STORE = 'big-files';
let database = null;

// Saves a big file (a Blob). extra is kept in the file list alongside
// it, e.g. { duration: 12 } for a video.
// Returns false if the browser could not keep it.
export async function writeBigFile(name, blob, type, extra = {}) {
  try {
    await useStore('readwrite', (store) => store.put(blob, name));
  } catch {
    return false;
  }

  replaceEntry({ name, type, big: true, size: blob.size, ...extra });
  saveFiles();
  trackEvent('save-file');
  notify();
  return true;
}

// Returns the big file's Blob, or null if it can't be found.
export async function readBigFile(name) {
  try {
    return (await useStore('readonly', (store) => store.get(name))) ?? null;
  } catch {
    return null;
  }
}

function deleteBig(name) {
  // Nothing to do if it fails; the file is already off the list
  useStore('readwrite', (store) => store.delete(name)).catch(() => {});
}

// Opens the database (only once), creating it on first use
function openDatabase() {
  database ??= new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(DB_STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  return database;
}

// Runs one request against the big-file store and waits for it to finish
async function useStore(mode, makeRequest) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(DB_STORE, mode);
    const request = makeRequest(transaction.objectStore(DB_STORE));
    transaction.oncomplete = () => resolve(request.result);
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
}
