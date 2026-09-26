// Video Player: plays a saved video, nothing else.
// It opens when you double-click a video file.

import { createVideoPlayer } from '../shell/video-player.js';
import { listFiles, readBigFile, onFileRenamed } from '../system/fs.js';

// context comes from the desktop:
//   fileName - the video to play
//   setTitle - changes the window's title
//   onClose  - runs something when the window closes
export function createApp(context) {
  const { fileName } = context;

  const root = document.createElement('div');
  root.className = 'player';
  root.innerHTML = `<p class="player-message">Loading...</p>`;

  const player = createVideoPlayer();
  player.element.hidden = true;
  root.append(player.element);

  context.setTitle(`${fileName} - Video Player`);
  context.onClose(() => player.unload());

  // If the video is renamed, show its new name. (It has already
  // been read, so it keeps playing.)
  let shownName = fileName;
  context.onClose(onFileRenamed((oldName, newName) => {
    if (shownName !== oldName) return;
    shownName = newName;
    context.setTitle(`${newName} - Video Player`);
  }));

  // Videos are read from the browser's database, which takes a moment
  const file = listFiles().find((f) => f.name === fileName);
  readBigFile(fileName).then((blob) => {
    if (!blob) {
      root.querySelector('.player-message').textContent = 'This video could not be found.';
      return;
    }
    root.querySelector('.player-message').remove();
    player.element.hidden = false;
    player.load(blob, file?.duration ?? 0);
  });

  return root;
}
