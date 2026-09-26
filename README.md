# ANACHRON

A computer from a timeline that never existed.

ANACHRON is a fictional 1990s operating system that runs entirely in your browser. It sits on a beige CRT monitor: press the power button, watch it boot, and you get a desktop with windows, a Start menu and working apps. You can write notes, draw pictures, take photos with your webcam and record short videos, and everything you save stays on the computer's desktop.

**Try it:** https://nomnao.github.io/anachron/

> ANACHRON is made for a computer with a mouse and keyboard. It opens on phones and tablets, but it is much nicer on a desktop or laptop.

## Getting started

1. Open https://nomnao.github.io/anachron/ in Chrome, Firefox, Safari or Edge on your computer.
2. Press the **power button**, the small button in the bottom-right corner of the monitor. The green light comes on.
3. Watch the start-up checks run, and the desktop appears.
4. **Double-click** an icon to open an app, or click **Start** in the bottom-left corner.

## What you can do

### The desktop

- **Windows** can be dragged by their title bar, minimized, maximized (or double-click the title bar) and closed. Every open window has a button on the taskbar; click it to bring the window back or hide it.
- **The Start menu** lists every app, and has **Shut Down...** at the bottom.
- **Saved files** appear as icons on the desktop. Double-click one to open it.
- **Right-click** a file for **Open**, **Rename** and **Delete**.

### The apps

| App | What it does |
|---|---|
| **Notepad** | Write plain text. File > Save puts a `.txt` file on the desktop. Edit > Time/Date types the current time. |
| **Paint** | Draw with a pencil, eraser and paint bucket, in three brush sizes and 28 colors. Saves `.png` pictures. |
| **Camera** | Shows your webcam. Take Picture freezes the shot; save it if you like it, or Retake. |
| **Video Recorder** | Records up to 60 seconds of webcam video (with sound, if you allow the microphone). It plays back straight away; save it if you like it, or Record Again. |
| **My Files** | Lists every file with its type and size. Open, rename or delete files from here too. |

Double-clicking a saved file opens the right program:

- **Text files** open in Notepad.
- **Pictures** open in the **Image Viewer**. To draw on one, choose File > Edit in Paint.
- **Videos** open in the **Video Player**.

Photos and videos have the same chunky-pixel look as Paint, and a photo is exactly the size of a Paint picture, so you can take a photo and then draw on it.

### Saving works like a real computer

- Nothing is saved until you choose to. Press **Ctrl+S** (**Cmd+S** on a Mac) or use File > Save, then give the file a name.
- If you try to close a window with unsaved work, it asks **"Do you want to save changes?"**. Yes saves, No throws the changes away, and Cancel keeps the window open.
- **Shut Down** (in the Start menu) asks about each window with unsaved work, then shows *"It is now safe to turn off your computer."* Press the power button to turn the monitor off, and again to start it back up.
- Pressing the power button while the desktop is running cuts the power straight away. Unsaved work is lost, just like pulling the plug.

### Keyboard shortcuts

| Keys | What they do |
|---|---|
| Ctrl+S / Cmd+S | Save in Notepad, Paint, Camera and Video Recorder |
| Ctrl+Z / Cmd+Z | Undo in Paint |
| F2 | Rename the selected file (desktop or My Files) |
| Delete (or Backspace) | Delete the selected file, after asking |
| Enter | Open the selected file in My Files |
| ↑ / ↓ | Move through the list in My Files |
| Esc | Close the Start menu or a dialog, or cancel renaming |

## Where your files are kept

Your files never leave your computer. They are stored in your browser: text and pictures in its local storage, and videos in its built-in database (IndexedDB), which has room for bigger files.

This means:

- Files are still there after you close the page or restart the computer.
- Each browser has its own files. Chrome and Safari, or another computer, won't see each other's.
- Clearing your browser's site data for this page deletes the files.
- Private or incognito windows forget everything when they close.

## Camera and microphone

Camera and Video Recorder ask your browser for permission the first time you use them. The picture and sound are only used on your screen and in files you choose to save; nothing is uploaded anywhere. The webcam turns off as soon as you close the app, shut down or press the power button.

If you blocked access by mistake, allow the camera (and microphone) again in your browser's address bar, then press **Try Again** in the app.

