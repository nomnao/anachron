// Every application ANACHRON knows about.
// The desktop reads this list to draw its icons,
// and the window manager uses it to open windows.

export const APPS = [
  { id: 'files',    title: 'My Files',       icon: 'assets/icons/files.svg',    width: 340, height: 230 },
  { id: 'notepad',  title: 'Notepad',        icon: 'assets/icons/notepad.svg',  width: 320, height: 220 },
  { id: 'paint',    title: 'Paint',          icon: 'assets/icons/paint.svg',    width: 380, height: 280 },
  { id: 'camera',   title: 'Camera',         icon: 'assets/icons/camera.svg',   width: 300, height: 260 },
  { id: 'recorder', title: 'Video Recorder', icon: 'assets/icons/recorder.svg', width: 300, height: 280 },
];