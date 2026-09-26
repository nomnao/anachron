// A small video player: the picture, a Play/Pause button,
// a progress bar you can click to jump, and the time.
// Video Recorder uses it to show what was just recorded,
// and Video Player uses it to play saved videos.
//
//   const player = createVideoPlayer();
//   someElement.append(player.element);
//   player.load(blob, 12);   // a video Blob and its length in seconds
//   player.unload();         // stop and let go of the video

export function createVideoPlayer() {
  const element = document.createElement('div');
  element.className = 'video-player';
  element.innerHTML = `
    <div class="player-screen">
      <video class="player-video" playsinline></video>
    </div>
    <div class="player-controls">
      <button class="push-button player-play" aria-label="Play"><span class="glyph-play"></span></button>
      <div class="player-track sunken-panel"><div class="player-progress"></div></div>
      <span class="player-time">0:00 / 0:00</span>
    </div>
  `;

  const video = element.querySelector('video');
  const playButton = element.querySelector('.player-play');
  const track = element.querySelector('.player-track');
  let url = null;
  let knownDuration = 0;

  // Recordings from some browsers don't say how long they are
  // (they report Infinity), so we use the length we were given
  function duration() {
    return Number.isFinite(video.duration) && video.duration > 0 ? video.duration : knownDuration;
  }

  function update() {
    const total = duration();
    const current = video.ended ? total : Math.min(video.currentTime, total);
    const fraction = total > 0 ? current / total : 0;

    element.querySelector('.player-progress').style.width = `${fraction * 100}%`;
    element.querySelector('.player-time').textContent = `${formatTime(current)} / ${formatTime(total)}`;

    const playing = !video.paused && !video.ended;
    playButton.setAttribute('aria-label', playing ? 'Pause' : 'Play');
    playButton.querySelector('span').className = playing ? 'glyph-pause' : 'glyph-play';
  }

  function togglePlay() {
    if (!url) return;
    if (video.paused || video.ended) video.play();
    else video.pause();
  }

  for (const eventName of ['timeupdate', 'play', 'pause', 'ended', 'loadedmetadata', 'durationchange']) {
    video.addEventListener(eventName, update);
  }

  playButton.addEventListener('click', togglePlay);
  video.addEventListener('click', togglePlay);

  // Clicking the bar jumps to that point
  track.addEventListener('pointerdown', (event) => {
    const total = duration();
    if (!url || total === 0) return;
    const rect = track.getBoundingClientRect();
    const fraction = Math.min(Math.max((event.clientX - rect.left) / rect.width, 0), 1);
    video.currentTime = fraction * total;
    update();
  });

  function unload() {
    video.pause();
    video.removeAttribute('src');
    video.load();
    if (url) URL.revokeObjectURL(url);
    url = null;
    knownDuration = 0;
    update();
  }

  function load(blob, seconds = 0) {
    unload();
    url = URL.createObjectURL(blob);
    knownDuration = seconds;
    video.src = url;
    update();
  }

  update();
  return { element, load, unload };
}

// 75 seconds -> "1:15"
export function formatTime(seconds) {
  const whole = Math.floor(seconds);
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`;
}
