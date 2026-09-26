// The file system.
// Every file lives on the desktop and has a name, a type and its content.
//   type 'text'  - content is the text itself (Notepad)
//   type 'image' - content is a PNG picture as a data URL (Paint)
// Files are kept in the browser, so they survive a reload.

const STORAGE_KEY = 'anachron.files';

// A list of { name, type, content }, in the order they were first saved.
// Files saved before types existed were all text.
let files = loadFiles().map((file) => ({ type: 'text', ...file }));

// Functions that want to hear when files change (the desktop is one)
const listeners = [];

// Returns a function that stops listening.
export function onFilesChanged(listener) {
  listeners.push(listener);
  return () => listeners.splice(listeners.indexOf(listener), 1);
}

export function listFiles() {
  return files.map((file) => ({ ...file }));
}

export function fileExists(name) {
  return files.some((file) => file.name === name);
}

// Returns the file's content, or null if there is no such file.
export function readFile(name) {
  const file = files.find((f) => f.name === name);
  return file ? file.content : null;
}

// Creates the file, or replaces it if it already exists.
// Returns false if the browser had no room to keep it: the file
// still works until the page is closed, but will then be lost.
export function writeFile(name, content, type = 'text') {
  const file = files.find((f) => f.name === name);
  if (file) {
    file.content = content;
    file.type = type;
  } else {
    files.push({ name, type, content });
  }

  const kept = saveFiles();
  notify();
  return kept;
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
