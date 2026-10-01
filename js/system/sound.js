// The computer's sounds: a beep when the power comes on, a chime
// when the desktop appears, a goodbye when it shuts down, and the
// modem's squeals when Web Browser dials up to get online, and
// Messenger's chimes and nudges.
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

// For music.js: the audio context and the main volume, or null if
// the browser can't make sound. Music plays through the main volume,
// so the taskbar speaker silences it too.
export function getAudio() {
  return context ? { context, master } : null;
}

// Whether a sound should play now
function ready() {
  return context && !muted;
}

// ---------- Notes ----------

// The frequency of a note like 'C5' or 'F#4'
const NOTE_STEPS = { C: -9, D: -7, E: -5, F: -4, G: -2, A: 0, B: 2 };
export function frequency(note) {
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

// ---------- The modem ----------

// A plain tone into output, from start for length seconds
function tone(output, hz, start, length, { loudness = 0.05, type = 'sine' } = {}) {
  const at = context.currentTime + start;
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.type = type;
  oscillator.frequency.value = hz;
  gain.gain.setValueAtTime(loudness, at);
  gain.gain.setValueAtTime(0, at + length);
  oscillator.connect(gain);
  gain.connect(output);
  oscillator.start(at);
  oscillator.stop(at + length + 0.05);
  return oscillator;
}

// Hiss, as the modems squeal their data at each other
function hiss(output, start, length, { loudness = 0.05, center = 1800 } = {}) {
  const at = context.currentTime + start;
  const samples = Math.floor(context.sampleRate * length);
  const buffer = context.createBuffer(1, samples, context.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < samples; i++) data[i] = Math.random() * 2 - 1;

  const source = context.createBufferSource();
  const band = context.createBiquadFilter();
  const gain = context.createGain();
  source.buffer = buffer;
  band.type = 'bandpass';
  band.frequency.value = center;
  band.Q.value = 0.8;
  gain.gain.value = loudness;
  source.connect(band);
  band.connect(gain);
  gain.connect(output);
  source.start(at);
}

// The two tones each telephone key makes
const KEYPAD = {
  1: [697, 1209], 2: [697, 1336], 3: [697, 1477], 4: [770, 1209], 5: [770, 1336],
  6: [770, 1477], 7: [852, 1209], 8: [852, 1336], 9: [852, 1477], 0: [941, 1336],
};

// The sound of a modem getting online, about four seconds: the dial
// tone, the number being dialed, then the squeals and hiss of two
// modems greeting each other, until the speaker goes quiet.
// Gives back a function that stops it early (the Skip button).
export function playDialUp() {
  if (!ready()) return () => {};

  const output = context.createGain();
  // The tones below are quiet on their own; this sets how loud the
  // whole thing is
  output.gain.value = 3;
  output.connect(master);

  tone(output, 350, 0, 0.6, { loudness: 0.04 });
  tone(output, 440, 0, 0.6, { loudness: 0.04 });

  [...'5550199'].forEach((digit, i) => {
    const start = 0.7 + i * 0.13;
    for (const hz of KEYPAD[digit]) tone(output, hz, start, 0.08, { loudness: 0.04 });
  });

  // The other modem answers with a high tone, then they talk
  tone(output, 2100, 1.8, 0.5, { loudness: 0.03 });
  for (let i = 0; i < 4; i++) {
    tone(output, i % 2 ? 1200 : 2400, 2.35 + i * 0.12, 0.1, { loudness: 0.03, type: 'square' });
  }
  tone(output, 980, 2.85, 0.35, { loudness: 0.025, type: 'sawtooth' });
  hiss(output, 3.2, 1.1, { loudness: 0.12, center: 1800 });
  hiss(output, 3.5, 0.8, { loudness: 0.06, center: 3200 });

  return () => {
    output.gain.setTargetAtTime(0, context.currentTime, 0.02);
    setTimeout(() => output.disconnect(), 200);
  };
}

// ---------- Messenger ----------

// A new message: two quick notes going up
export function playMessageChime() {
  if (!ready()) return;
  bell('E6', 0, { length: 0.5, loudness: 0.14 });
  bell('A6', 0.11, { length: 0.7, loudness: 0.14 });
}

// A friend has signed in: three soft notes climbing
export function playSignIn() {
  if (!ready()) return;
  bell('C6', 0, { length: 0.6, loudness: 0.1 });
  bell('E6', 0.12, { length: 0.6, loudness: 0.1 });
  bell('G6', 0.24, { length: 0.9, loudness: 0.12 });
}

// A nudge: a low rattling buzz, like a phone vibrating on a desk
export function playNudge() {
  if (!ready()) return;
  const at = context.currentTime;
  const oscillator = context.createOscillator();
  const rattle = context.createOscillator();
  const depth = context.createGain();
  const gain = context.createGain();
  oscillator.type = 'square';
  oscillator.frequency.value = 110;
  // A fast wobble in the volume makes it rattle
  rattle.frequency.value = 28;
  depth.gain.value = 0.05;
  gain.gain.setValueAtTime(0.05, at);
  gain.gain.setValueAtTime(0.05, at + 0.5);
  gain.gain.linearRampToValueAtTime(0, at + 0.6);
  rattle.connect(depth);
  depth.connect(gain.gain);
  oscillator.connect(gain);
  gain.connect(master);
  oscillator.start(at);
  rattle.start(at);
  oscillator.stop(at + 0.65);
  rattle.stop(at + 0.65);
}
