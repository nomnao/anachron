// The computer's sounds: a beep when the power comes on, a chime
// when the desktop appears, and a goodbye when it shuts down.
//
// There are no sound files. Every sound is made on the spot with
// the Web Audio API: simple waves, shaped to sound like bells and
// soft organ chords. The tunes are ANACHRON's own.
//
// Browsers only allow sound after the person has clicked something,
// so unlockSound() is called when the power button is pressed.
// The speaker in the corner of the taskbar turns the sound off and
// on; the choice is remembered.

const STORAGE_KEY = 'anachron.sound';

// How loud everything is, from 0 to 1
const VOLUME = 0.5;

let context = null;
let master = null;
let echo = null;
let muted = loadMuted();

// ---------- Turning sound on and off ----------

function loadMuted() {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'off';
  } catch {
    return false;
  }
}

export function isMuted() {
  return muted;
}

export function setMuted(value) {
  muted = value;
  try {
    localStorage.setItem(STORAGE_KEY, muted ? 'off' : 'on');
  } catch {
    // Not kept, but the setting works until the page closes
  }

  // Muting silences a sound that is already playing, too
  if (master) {
    master.gain.cancelScheduledValues(context.currentTime);
    master.gain.setTargetAtTime(muted ? 0 : VOLUME, context.currentTime, 0.02);
  }
}

// Gets sound ready. Must be called from a click (the power button),
// or the browser keeps the sound switched off.
export function unlockSound() {
  if (!context) {
    const AudioContext = window.AudioContext ?? window.webkitAudioContext;
    // A very old browser with no Web Audio: ANACHRON is just silent
    if (!AudioContext) return;

    context = new AudioContext();
    master = context.createGain();
    master.gain.value = muted ? 0 : VOLUME;
    master.connect(context.destination);
    echo = createEcho();
  }
  if (context.state === 'suspended') context.resume();
}

// A soft echo that makes the chimes sound like they're in a room:
// each repeat is quieter and a little duller than the last
function createEcho() {
  const input = context.createGain();
  const delay = context.createDelay();
  const feedback = context.createGain();
  const dull = context.createBiquadFilter();

  delay.delayTime.value = 0.23;
  feedback.gain.value = 0.35;
  dull.type = 'lowpass';
  dull.frequency.value = 2200;

  input.connect(delay);
  delay.connect(dull);
  dull.connect(feedback);
  feedback.connect(delay);
  dull.connect(master);
  return input;
}

// Whether a sound should play now
function ready() {
  return context && !muted;
}

// ---------- Notes ----------

// The frequency of a note like 'C5' or 'F#4'
const NOTE_STEPS = { C: -9, D: -7, E: -5, F: -4, G: -2, A: 0, B: 2 };
function frequency(note) {
  const [, letter, sharp, octave] = note.match(/^([A-G])(#?)(\d)$/);
  const steps = NOTE_STEPS[letter] + (sharp ? 1 : 0) + (Number(octave) - 4) * 12;
  return 440 * 2 ** (steps / 12);
}

// A bell: a pure tone with a quieter, slightly out-of-tune tone an
// octave up, struck and then fading away
function bell(note, start, { length = 1.8, loudness = 0.25 } = {}) {
  const at = context.currentTime + start;
  const envelope = context.createGain();
  envelope.gain.setValueAtTime(0, at);
  envelope.gain.linearRampToValueAtTime(loudness, at + 0.01);
  envelope.gain.exponentialRampToValueAtTime(0.0001, at + length);
  envelope.connect(master);
  envelope.connect(echo);

  for (const [multiple, level] of [[1, 1], [2.01, 0.3], [3.98, 0.08]]) {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.frequency.value = frequency(note) * multiple;
    gain.gain.value = level;
    oscillator.connect(gain);
    gain.connect(envelope);
    oscillator.start(at);
    oscillator.stop(at + length);
  }
}

// A soft organ chord that swells in and fades out
function pad(notes, start, length, { loudness = 0.07 } = {}) {
  const at = context.currentTime + start;
  const envelope = context.createGain();
  const soften = context.createBiquadFilter();
  soften.type = 'lowpass';
  soften.frequency.value = 1400;

  envelope.gain.setValueAtTime(0, at);
  envelope.gain.linearRampToValueAtTime(loudness, at + 0.5);
  envelope.gain.setValueAtTime(loudness, at + length - 1);
  envelope.gain.linearRampToValueAtTime(0, at + length);
  soften.connect(envelope);
  envelope.connect(master);
  envelope.connect(echo);

  for (const note of notes) {
    // Two waves a hair apart in pitch make the chord shimmer
    for (const detune of [-6, 6]) {
      const oscillator = context.createOscillator();
      oscillator.type = 'triangle';
      oscillator.frequency.value = frequency(note);
      oscillator.detune.value = detune;
      oscillator.connect(soften);
      oscillator.start(at);
      oscillator.stop(at + length);
    }
  }
}

// ---------- The sounds ----------

// The short beep a PC makes when it has checked itself and is
// ready to start
export function playPowerOnBeep() {
  if (!ready()) return;

  const at = context.currentTime;
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.type = 'square';
  oscillator.frequency.value = 988;
  gain.gain.setValueAtTime(0.08, at);
  gain.gain.setValueAtTime(0, at + 0.12);
  oscillator.connect(gain);
  gain.connect(master);
  oscillator.start(at);
  oscillator.stop(at + 0.15);
}

// The welcome chime, about five seconds: a warm chord with bells
// climbing up over it, turning to a bright final chord
export function playStartup() {
  if (!ready()) return;

  pad(['C3', 'G3', 'E4', 'B4'], 0, 2.2);
  pad(['F3', 'A3', 'E4', 'C5'], 1.6, 1.4);
  pad(['C3', 'G3', 'D4', 'E4', 'G4'], 2.6, 3);

  const climb = ['E5', 'G5', 'B5', 'D6'];
  climb.forEach((note, i) => bell(note, 0.2 + i * 0.22, { loudness: 0.16 }));
  bell('C6', 1.6, { loudness: 0.14 });
  bell('A5', 1.85, { loudness: 0.12 });
  bell('G5', 2.6, { length: 3, loudness: 0.2 });
  bell('C6', 2.62, { length: 3, loudness: 0.14 });
  bell('E6', 2.64, { length: 3, loudness: 0.1 });
}

// The goodbye: three bells stepping down, over a chord that fades
export function playShutdown() {
  if (!ready()) return;

  pad(['F3', 'C4', 'A4'], 0, 1.2);
  pad(['C3', 'G3', 'E4'], 0.9, 2);
  bell('A5', 0, { loudness: 0.16 });
  bell('F5', 0.35, { loudness: 0.16 });
  bell('C5', 0.7, { length: 2.4, loudness: 0.2 });
}

// A little "ding", played when the sound is turned back on, so
// you can hear that it worked
export function playDing() {
  if (!ready()) return;
  bell('A5', 0, { length: 0.8, loudness: 0.18 });
}
