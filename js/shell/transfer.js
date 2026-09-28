// Moving files between ANACHRON and the real computer.
//
// Export: "Save to My Computer" downloads a file, like any download
// from a website: text as .txt, pictures as .png, videos as they
// were recorded.
//
// Import: files dropped onto the screen, or chosen with Import
// Files..., become ANACHRON files. Text files open in Notepad,
// pictures (any kind the browser can show) become PNG pictures for
// Paint, and videos go to the Video Player. Pictures are shrunk to
// fit the 640 x 480 screen, which also keeps them small enough for
// the browser to store.

import { listFiles, fileExists, writeFile, writeBigFile, readBigFile } from '../system/fs.js';
import { showConfirmDialog } from './dialogs.js';
import { trackEvent } from '../system/analytics.js';

const MAX_PICTURE_WIDTH = 640;
const MAX_PICTURE_HEIGHT = 480;

// File names are at most this long, like the Save As box allows
const MAX_NAME_LENGTH = 40;

// Text files are recognized by their type, or by these endings
// (a browser doesn't always know the type)
const TEXT_ENDINGS = ['.txt', '.md', '.csv', '.log', '.json', '.xml', '.html', '.css', '.js', '.ini'];

// ---------- Export ----------

// Downloads the file to the real computer. container is where to
// show a message if it can't be found.
export async function exportFile(container, name) {
  const file = listFiles().find((f) => f.name === name);
  const blob = file ? await fileToBlob(file) : null;
  if (!blob) {
    await showConfirmDialog(container, {
      title: 'Save to My Computer',
      message: `${name} could not be saved to your computer.`,
      cancelLabel: null,
    });
    return;
  }

  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = name;
  link.click();
  // Give the browser a moment to start the download before letting go
  setTimeout(() => URL.revokeObjectURL(link.href), 10000);
  trackEvent('export-file');
}

async function fileToBlob(file) {
  if (file.big) return readBigFile(file.name);
  if (file.type === 'image') return (await fetch(file.content)).blob();
  return new Blob([file.content], { type: 'text/plain' });
}

// ---------- Import ----------

// Opens the computer's own file chooser, then imports what's chosen
export function chooseFilesToImport(container) {
  const input = document.createElement('input');
  input.type = 'file';
  input.multiple = true;
  input.addEventListener('change', () => importFiles(container, [...input.files]));
  input.click();
}

// Imports files from the real computer (a FileList or File array).
// Anything that can't be imported is listed in one message at the end.
export async function importFiles(container, files) {
  const problems = [];

  for (const file of files) {
    const problem = await importFile(file);
    if (problem) problems.push(problem);
  }

  if (problems.length > 0) {
    await showConfirmDialog(container, {
      title: 'Import Files',
      message: problems.join('\n'),
      cancelLabel: null,
    });
  }
}

// Imports one file. Gives back what went wrong, or null.
async function importFile(file) {
  const kind = kindOf(file);
  if (!kind) {
    return `${file.name} can't be opened on ANACHRON. It can import text files, pictures and videos.`;
  }

  try {
    let kept;
    if (kind === 'text') {
      kept = writeFile(freeName(file.name), await file.text(), 'text');
    }
    if (kind === 'image') {
      const picture = await toPicture(file);
      if (!picture) return `${file.name} doesn't look like a picture ANACHRON can open.`;
      kept = writeFile(freeName(withEnding(file.name, '.png')), picture, 'image');
    }
    if (kind === 'video') {
      const duration = await videoDuration(file);
      kept = await writeBigFile(freeName(file.name), file, 'video', { duration });
    }

    trackEvent('import-file');
    if (!kept) return `There is no room to store ${file.name}. It will be lost when this page is closed.`;
    return null;
  } catch {
    return `${file.name} could not be imported.`;
  }
}

// 'text', 'image', 'video', or null for files ANACHRON can't use
function kindOf(file) {
  const lower = file.name.toLowerCase();
  if (file.type.startsWith('image/')) return 'image';
  if (file.type.startsWith('video/')) return 'video';
  if (file.type.startsWith('text/') || TEXT_ENDINGS.some((ending) => lower.endsWith(ending))) return 'text';
  return null;
}

// Loads a picture, shrinks it to fit the screen if it's bigger, and
// gives it back as a PNG data URL (the way Paint keeps pictures),
// or null if the browser can't read it
async function toPicture(file) {
  const url = URL.createObjectURL(file);
  try {
    const image = await new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = url;
    });

    const scale = Math.min(1, MAX_PICTURE_WIDTH / image.naturalWidth, MAX_PICTURE_HEIGHT / image.naturalHeight);
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));

    // Transparent parts become white, like paper, as in Paint
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/png');
  } catch {
    return null;
  } finally {
    URL.revokeObjectURL(url);
  }
}

// How long a video is, in seconds, or 0 if the browser can't tell
async function videoDuration(file) {
  const url = URL.createObjectURL(file);
  try {
    return await new Promise((resolve) => {
      const video = document.createElement('video');
      video.preload = 'metadata';
      video.onloadedmetadata = () => resolve(Number.isFinite(video.duration) ? Math.round(video.duration) : 0);
      video.onerror = () => resolve(0);
      video.src = url;
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

// ---------- Names ----------

// Swaps the name's ending for another, e.g. photo.jpg -> photo.png
function withEnding(name, ending) {
  const dot = name.lastIndexOf('.');
  return (dot > 0 ? name.slice(0, dot) : name) + ending;
}

// A name no file has yet: the file's own name, shortened to fit if
// needed, or "photo (2).png", "photo (3).png"... if it's taken
function freeName(name) {
  const dot = name.lastIndexOf('.');
  const ending = dot > 0 ? name.slice(dot) : '';
  const base = (dot > 0 ? name.slice(0, dot) : name).trim() || 'file';

  for (let n = 1; ; n++) {
    const suffix = n === 1 ? '' : ` (${n})`;
    const candidate = base.slice(0, MAX_NAME_LENGTH - ending.length - suffix.length) + suffix + ending;
    if (!fileExists(candidate)) return candidate;
  }
}
