// NetRadio 95: radio stations on the web. Pick a station and it
// plays, round and round, until you stop it or leave the page.
// The music is made on the spot by music.js: some tunes are
// ANACHRON's own, and Classic 101.5 plays Beethoven's "Ode to Joy"
// (written in 1824, so free for everyone).

import { playSong } from '../../system/music.js';
import { isMuted } from '../../system/sound.js';

// A chord's notes played one after another, over and over, every
// `step` beats, from `from` for `beats` beats
function arpeggio(chord, from, beats, step = 0.25) {
  const notes = [];
  for (let i = 0; i < beats / step; i++) notes.push([from + i * step, chord[i % chord.length], step]);
  return notes;
}

// Each chord held for `beats` beats, one after another
function chords(list, beats) {
  return list.flatMap((chord, i) => chord.map((note) => [i * beats, note, beats]));
}

// A kick on every beat in kicks, and a tick of hat every half beat
function drumBeat(bars, kicks = [0, 2]) {
  const notes = [];
  for (let bar = 0; bar < bars; bar++) {
    for (const beat of kicks) notes.push([bar * 4 + beat, 'kick']);
    for (let half = 0; half < 8; half++) notes.push([bar * 4 + half / 2, 'hat']);
  }
  return notes;
}

const PIXEL_PARADE = {
  bpm: 132,
  beats: 16,
  // Square waves sound louder than they measure: this brings it in
  // line with the other stations
  volume: 0.85,
  tracks: [
    { instrument: 'lead', notes: [
      [0, 'E5', 1], [1, 'G5', 1], [2, 'C6', 1.5], [3.5, 'B5', 0.5],
      [4, 'A5', 1], [5, 'E5', 1], [6, 'C5', 1], [7, 'E5', 1],
      [8, 'F5', 1], [9, 'A5', 1], [10, 'C6', 1], [11, 'A5', 0.5], [11.5, 'G5', 0.5],
      [12, 'G5', 1.5], [13.5, 'F5', 0.5], [14, 'D5', 1], [15, 'B4', 1],
    ] },
    { instrument: 'lead', volume: 0.35, notes: [
      ...arpeggio(['C4', 'E4', 'G4', 'E4'], 0, 4),
      ...arpeggio(['A3', 'C4', 'E4', 'C4'], 4, 4),
      ...arpeggio(['F3', 'A3', 'C4', 'A3'], 8, 4),
      ...arpeggio(['G3', 'B3', 'D4', 'B3'], 12, 4),
    ] },
    { instrument: 'bass', notes: ['C2', 'A1', 'F1', 'G1'].flatMap((root, bar) => {
      const octave = root.replace(/\d/, (n) => Number(n) + 1);
      return [0, 1, 2, 3].flatMap((beat) => [[bar * 4 + beat, root, 0.4], [bar * 4 + beat + 0.5, octave, 0.4]]);
    }) },
    { instrument: 'drums', volume: 0.7, notes: drumBeat(4) },
  ],
};

// Beethoven's "Ode to Joy", on a music box
const ODE_TO_JOY = {
  bpm: 104,
  beats: 32,
  tracks: [
    { instrument: 'bell', notes: [
      [0, 'E5', 1], [1, 'E5', 1], [2, 'F5', 1], [3, 'G5', 1],
      [4, 'G5', 1], [5, 'F5', 1], [6, 'E5', 1], [7, 'D5', 1],
      [8, 'C5', 1], [9, 'C5', 1], [10, 'D5', 1], [11, 'E5', 1],
      [12, 'E5', 1.5], [13.5, 'D5', 0.5], [14, 'D5', 2],
      [16, 'E5', 1], [17, 'E5', 1], [18, 'F5', 1], [19, 'G5', 1],
      [20, 'G5', 1], [21, 'F5', 1], [22, 'E5', 1], [23, 'D5', 1],
      [24, 'C5', 1], [25, 'C5', 1], [26, 'D5', 1], [27, 'E5', 1],
      [28, 'D5', 1.5], [29.5, 'C5', 0.5], [30, 'C5', 2],
    ] },
    { instrument: 'pad', volume: 0.9, notes: chords([
      ['C4', 'E4', 'G4'], ['B3', 'D4', 'G4'], ['C4', 'E4', 'G4'], ['B3', 'D4', 'G4'],
      ['C4', 'E4', 'G4'], ['B3', 'D4', 'G4'], ['C4', 'E4', 'G4'], ['C4', 'E4', 'G4'],
    ], 4) },
    { instrument: 'bass', volume: 0.7, notes: ['C3', 'G2', 'C3', 'G2', 'C3', 'G2', 'C3', 'C3']
      .flatMap((root, bar) => [[bar * 4, root, 1.8], [bar * 4 + 2, root, 1.8]]) },
  ],
};

const LATE_NIGHT_MODEM = {
  bpm: 76,
  beats: 16,
  tracks: [
    { instrument: 'pad', notes: chords([
      ['F3', 'A3', 'C4', 'E4'], ['E3', 'G3', 'B3', 'D4'], ['D3', 'F3', 'A3', 'C4'], ['C3', 'E3', 'G3', 'B3'],
    ], 4) },
    { instrument: 'bass', volume: 0.8, notes: [[0, 'F2', 4], [4, 'E2', 4], [8, 'D2', 4], [12, 'C2', 4]] },
    { instrument: 'bell', volume: 0.7, notes: [
      [0, 'A5', 1], [1.5, 'C6', 0.5], [2, 'E6', 2],
      [4, 'G5', 1], [5, 'B5', 1], [6, 'D6', 2],
      [8, 'F5', 1], [9, 'A5', 1], [10, 'C6', 1.5], [11.5, 'A5', 0.5],
      [12, 'G5', 1], [13, 'E5', 1], [14, 'B5', 2],
    ] },
    { instrument: 'drums', volume: 0.35, notes: [[0, 'kick'], [2.5, 'kick'], [4, 'kick'], [6.5, 'kick'],
      [8, 'kick'], [10.5, 'kick'], [12, 'kick'], [14.5, 'kick'],
      ...Array.from({ length: 16 }, (_, beat) => [beat + 0.5, 'hat'])] },
  ],
};

// Pigeons, and a little gentle music under them
const COO_FM = {
  bpm: 90,
  beats: 16,
  tracks: [
    { instrument: 'coo', notes: [
      [0, 'A3', 1.2], [1.5, 'C4', 0.8], [2.5, 'A3', 1.4],
      [4, 'G3', 1.2], [5.5, 'A3', 0.8], [6.5, 'E3', 1.4],
      [8, 'A3', 1.2], [9.5, 'C4', 0.8], [10.5, 'D4', 1.4],
      [12, 'C4', 1], [13, 'A3', 1], [14, 'G3', 1.8],
    ] },
    { instrument: 'pad', volume: 0.6, notes: chords([['A3', 'C4', 'E4'], ['G3', 'B3', 'E4'], ['F3', 'A3', 'D4'], ['E3', 'G3', 'C4']], 4) },
    { instrument: 'bass', volume: 0.6, notes: [[0, 'A2', 3.5], [4, 'E2', 3.5], [8, 'D2', 3.5], [12, 'C2', 3.5]] },
  ],
};

const STATIONS = [
  { id: 'chip', frequency: '88.8', name: 'Chip FM', song: 'Pixel Parade', about: 'Non-stop 8-bit hits from the arcade.', music: PIXEL_PARADE },
  { id: 'classic', frequency: '101.5', name: 'Classic 101.5', song: 'Beethoven: Ode to Joy', about: 'The great composers, on music box.', music: ODE_TO_JOY },
  { id: 'dream', frequency: '96.3', name: 'Dreamwave', song: 'Late Night Modem', about: 'Slow, sleepy sounds for late-night surfing.', music: LATE_NIGHT_MODEM },
  { id: 'coo', frequency: '107.7', name: 'Coo FM', song: 'Morning on the Rooftop', about: 'All pigeon, all day. Coo would approve.', music: COO_FM },
];

const radio = {
  title: 'NetRadio 95',
  keywords: 'netradio net radio music station listen songs stereo',
  render: () => `
    <div class="web-page web-radio">
      <h1>NetRadio 95</h1>
      <p class="web-center">Real radio, on the World Wide Web! No antenna needed.</p>
      <div class="web-radio-set">
        <div class="web-radio-display">
          <span class="web-radio-freq" data-freq>--.-</span>
          <span class="web-radio-text">
            <b data-name>Choose a station</b>
            <span data-song>Press a button below</span>
          </span>
          <span class="web-radio-bars">${'<i></i>'.repeat(8)}</span>
        </div>
        <div class="web-radio-presets">
          ${STATIONS.map((station) => `
            <button class="push-button" data-station="${station.id}">${station.frequency}<br>${station.name}</button>`).join('')}
        </div>
        <div class="web-radio-controls">
          <button class="push-button" data-stop>Stop</button>
          <label>Volume <input type="range" min="0" max="100" value="80" data-volume></label>
        </div>
      </div>
      <p class="web-center web-small web-radio-note"></p>
      <table class="web-table">
        <tr><th>Station</th><th>What's on</th></tr>
        ${STATIONS.map((station) => `<tr><td>${station.frequency} ${station.name}</td><td>${station.about}</td></tr>`).join('')}
      </table>
    </div>`,
  // Gives back what stops the music when the page is left
  setUp: (root) => {
    const radioSet = root.querySelector('.web-radio-set');
    const note = root.querySelector('.web-radio-note');
    const volume = root.querySelector('[data-volume]');
    const show = (key, text) => { root.querySelector(`[data-${key}]`).textContent = text; };
    let playing = null;
    let buffering = null;

    function stop() {
      clearTimeout(buffering);
      buffering = null;
      playing?.stop();
      playing = null;
      radioSet.classList.remove('is-playing');
      for (const button of root.querySelectorAll('[data-station]')) button.classList.remove('is-on');
    }

    function tune(station) {
      stop();
      root.querySelector(`[data-station="${station.id}"]`).classList.add('is-on');
      show('freq', station.frequency);
      show('name', station.name);
      show('song', 'Buffering...');
      note.textContent = isMuted()
        ? 'Your sound is off. Click the speaker next to the clock to hear the radio.'
        : '';

      // Like the real thing, it takes a moment to start
      buffering = setTimeout(() => {
        buffering = null;
        playing = playSong(station.music, { volume: volume.value / 100 });
        if (!playing) {
          show('song', 'No sound card found');
          return;
        }
        show('song', `Now playing: ${station.song}`);
        radioSet.classList.add('is-playing');
      }, 900);
    }

    radioSet.addEventListener('click', (event) => {
      const button = event.target.closest('[data-station]');
      if (button) tune(STATIONS.find((station) => station.id === button.dataset.station));
      if (event.target.closest('[data-stop]') && (playing || buffering)) {
        stop();
        show('song', 'Stopped');
      }
    });

    volume.addEventListener('input', () => playing?.setVolume(volume.value / 100));

    return stop;
  },
};

export const SITE = { 'www.netradio.web': { '/': radio } };
