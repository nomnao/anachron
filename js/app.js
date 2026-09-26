// Every application ANACHRON knows about.
// The desktop reads this list to draw its icons,
// and the window manager uses it to open windows.
// An app with "load" has been built: load() fetches its module,
// whose createApp() returns what goes inside the window.
// An app with "listed: false" only opens files, so it has no
// desktop icon and is not in the Start menu. The Recycle Bin is
// unlisted too: the desktop draws its icon itself, since the
// icon shows whether the bin is empty.

export const RECYCLE_BIN_ICONS = {
  empty: 'assets/icons/recycle-empty.svg',
  full:  'assets/icons/recycle-full.svg',
};

export const APPS = [
  { id: 'files',    title: 'My Files',       icon: 'assets/icons/files.svg',    width: 380, height: 250,
    load: () => import('./apps/files.js') },
  { id: 'notepad',  title: 'Notepad',        icon: 'assets/icons/notepad.svg',  width: 320, height: 220,
    load: () => import('./apps/notepad.js') },
  { id: 'paint',    title: 'Paint',          icon: 'assets/icons/paint.svg',    width: 440, height: 330,
    load: () => import('./apps/paint.js') },
  { id: 'camera',   title: 'Camera',         icon: 'assets/icons/camera.svg',   width: 384, height: 310,
    load: () => import('./apps/camera.js') },
  { id: 'recorder', title: 'Video Recorder', icon: 'assets/icons/recorder.svg', width: 384, height: 340,
    load: () => import('./apps/recorder.js') },
  { id: 'minesweeper', title: 'Minesweeper', icon: 'assets/icons/minesweeper.svg', width: 174, height: 256,
    load: () => import('./apps/minesweeper.js') },
  { id: 'viewer',   title: 'Image Viewer',   icon: 'assets/icons/image-file.svg', width: 384, height: 280,
    load: () => import('./apps/viewer.js'), listed: false },
  { id: 'player',   title: 'Video Player',   icon: 'assets/icons/video-file.svg', width: 384, height: 300,
    load: () => import('./apps/player.js'), listed: false },
  { id: 'recycle',  title: 'Recycle Bin',    icon: RECYCLE_BIN_ICONS.empty, width: 420, height: 250,
    load: () => import('./apps/recycle.js'), listed: false },
];

// The apps people can start themselves (desktop icons, Start menu)
export const LISTED_APPS = APPS.filter((app) => app.listed !== false);

// Every type of file: its icon, the name My Files shows for it,
// and which app opens it
export const FILE_TYPES = {
  text:  { icon: 'assets/icons/text-file.svg',  label: 'Text Document', appId: 'notepad' },
  image: { icon: 'assets/icons/image-file.svg', label: 'PNG Image',     appId: 'viewer' },
  video: { icon: 'assets/icons/video-file.svg', label: 'Video Clip',    appId: 'player' },
};

// The type info for a file. Unknown types are treated as text.
export function fileTypeOf(file) {
  return FILE_TYPES[file.type] ?? FILE_TYPES.text;
}
