// The file system.
// Every file lives on the desktop and has a name and some text.
// Files are kept in the browser, so they survive a reload.

const STORAGE_KEY = 'anachron.files';

// A list of { name, content }, in the order they were first saved
let files = loadFiles();

// Functions that want to hear when files change (the desktop is one)
const listeners = [];

export function onFilesChanged(listener) {
  listeners.push(listener);
}

export function listFiles() {
  return files.map((file) => ({ ...file }));
}

export function fileExists(name) {
  return files.some((file) => file.name === name);
}

// Returns the file's text, or null if there is no such file.
export function readFile(name) {
  const file = files.find((f) => f.name === name);
  return file ? file.content : null;
}

// Creates the file, or replaces its text if it already exists.
export function writeFile(name, content) {
  const file = files.find((f) => f.name === name);
  if (file) {
    file.content = content;
  } else {
    files.push({ name, content });
  }

  saveFiles();
  notify();
}

export function deleteFile(name) {
  files = files.filter((file) => file.name !== name);
  saveFiles();
  notify();
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

function saveFiles() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(files));
  } catch {
    // Nothing we can do; the files stay in memory
  }
}
