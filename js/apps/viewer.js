// Image Viewer: shows a picture, nothing else.
// It opens when you double-click an image file. To draw on
// the picture, choose File > Edit in Paint.

import { setUpMenuBar } from '../shell/menus.js';
import { readFile, onFilesChanged } from '../system/fs.js';

// context comes from the desktop:
//   fileName - the picture to show
//   setTitle - changes the window's title
//   openFile - opens a file, here in Paint
//   onClose  - runs something when the window closes
export function createApp(context) {
  const { fileName } = context;

  const root = document.createElement('div');
  root.className = 'viewer';
  root.innerHTML = `
    <div class="menu-bar">
      <div class="menu">
        <button class="menu-title"><u>F</u>ile</button>
        <div class="menu-items">
          <button data-command="edit"><u>E</u>dit in Paint</button>
        </div>
      </div>
    </div>
    <div class="viewer-view">
      <img class="viewer-image" alt="">
      <p class="viewer-missing" hidden>This picture no longer exists.</p>
    </div>
  `;

  const image = root.querySelector('.viewer-image');
  image.alt = fileName;

  // Show the picture at one virtual pixel per picture pixel,
  // the same size it has in Paint
  image.addEventListener('load', () => {
    image.style.width = `calc(var(--px) * ${image.naturalWidth})`;
    image.style.height = `calc(var(--px) * ${image.naturalHeight})`;
  });

  function show() {
    const picture = readFile(fileName);
    image.hidden = !picture;
    root.querySelector('.viewer-missing').hidden = Boolean(picture);
    if (picture && image.getAttribute('src') !== picture) image.src = picture;
  }

  show();
  context.setTitle(`${fileName} - Image Viewer`);

  // If the picture is edited in Paint and saved, or deleted,
  // show that straight away
  context.onClose(onFilesChanged(show));

  setUpMenuBar(root.querySelector('.menu-bar'), (command) => {
    if (command === 'edit') context.openFile(fileName, 'paint');
  });

  return root;
}
