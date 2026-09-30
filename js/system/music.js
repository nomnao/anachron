// A tiny music player, for the radio in Web Browser.
//
// A song is written down as notes, like sheet music:
//   { bpm: 120, beats: 16, tracks: [
//       { instrument: 'lead', volume: 1, notes: [[0, 'E5', 1], [1, 'G5', 0.5], ...] },
//       { instrument: 'drums', notes: [[0, 'kick'], [0.5, 'hat'], ...] },
//   ] }
// Each note is [beat it starts on, note, how many beats it lasts].
// The song plays round and round until it is stopped.
//
// Every sound is made on the spot with the Web Audio API, through
// the computer's main volume (so the taskbar speaker mutes it too).

import { getAudio, frequency } from './sound.js';

// How far ahead notes are lined up, and how often more are added
const LOOKAHEAD = 0.3;
const TICK_MS = 60;

// ---------- Instruments ----------

// Each instrument plays one note into output, at a time in seconds,
// for length seconds, at a loudness from 0 to 1.

function voice(context, output, { type, hz, at, length, loudness, attack = 0.01, release = 0.1 }) {
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.type = type;
  oscillator.frequency.value = hz;
  gain.gain.setValueAtTime(0, at);
  gain.gain.linearRampToValueAtTime(loudness, at + attack);
  gain.gain.setValueAtTime(loudness, at + Math.max(attack, length - release));
  gain.gain.linearRampToValueAtTime(0, at + length);
  oscillator.connect(gain);
  gain.connect(output);
  oscillator.start(at);
  oscillator.stop(at + length + 0.05);
  return oscillator;
}

const INSTRUMENTS = {
  // A buzzy square wave, like a game console
  lead(context, output, note, at, length, loudness) {
    voice(context, output, { type: 'square', hz: frequency(note), at, length, loudness: 0.05 * loudness, release: 0.05 });
  },

  // Round, low notes
  bass(context, output, note, at, length, loudness) {
    voice(context, output, { type: 'triangle', hz: frequency(note), at, length, loudness: 0.22 * loudness, release: 0.08 });
  },

  // A music box: struck, then fading
  bell(context, output, note, at, length, loudness) {
    const hz = frequency(note);
    const gain = context.createGain();
    const fade = Math.max(length, 0.8);
    gain.gain.setValueAtTime(0, at);
    gain.gain.linearRampToValueAtTime(0.18 * loudness, at + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + fade);
    gain.connect(output);
    for (const [multiple, level] of [[1, 1], [2.01, 0.3], [3.98, 0.08]]) {
      const oscillator = context.createOscillator();
      const partGain = context.createGain();
      oscillator.frequency.value = hz * multiple;
      partGain.gain.value = level;
      oscillator.connect(partGain);
      partGain.connect(gain);
      oscillator.start(at);
      oscillator.stop(at + fade);
    }
  },

  // Soft, slow chords
  pad(context, output, note, at, length, loudness) {
    for (const detune of [-7, 7]) {
      const oscillator = voice(context, output, {
        type: 'triangle', hz: frequency(note), at, length, loudness: 0.035 * loudness, attack: 0.4, release: 0.6,
      });
      oscillator.detune.value = detune;
    }
  },

  // A pigeon: a soft "coo-OOO-oo" that swoops up and down
  coo(context, output, note, at, length, loudness) {
    const hz = frequency(note);
    const oscillator = context.createOscillator();
    const soften = context.createBiquadFilter();
    const gain = context.createGain();
    oscillator.type = 'triangle';
    oscillator.frequency.setValueAtTime(hz * 0.85, at);
    oscillator.frequency.linearRampToValueAtTime(hz * 1.08, at + length * 0.35);
    oscillator.frequency.linearRampToValueAtTime(hz * 0.8, at + length);
    soften.type = 'lowpass';
    soften.frequency.value = 900;
    gain.gain.setValueAtTime(0, at);
    gain.gain.linearRampToValueAtTime(0.25 * loudness, at + length * 0.3);
    gain.gain.linearRampToValueAtTime(0, at + length);
    oscillator.connect(soften);
    soften.connect(gain);
    gain.connect(output);
    oscillator.start(at);
    oscillator.stop(at + length + 0.05);
  },

  // Drums: 'kick' (a thump) and 'hat' (a short tick of hiss)
  drums(context, output, sound, at, length, loudness) {
    if (sound === 'kick') {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.frequency.setValueAtTime(140, at);
      oscillator.frequency.exponentialRampToValueAtTime(45, at + 0.15);
      gain.gain.setValueAtTime(0.5 * loudness, at);
      gain.gain.exponentialRampToValueAtTime(0.001, at + 0.2);
      oscillator.connect(gain);
      gain.connect(output);
      oscillator.start(at);
      oscillator.stop(at + 0.25);
    } else {
      const source = context.createBufferSource();
      const filter = context.createBiquadFilter();
      const gain = context.createGain();
      source.buffer = noise(context);
      filter.type = 'highpass';
      filter.frequency.value = 6000;
      gain.gain.setValueAtTime(0.12 * loudness, at);
      gain.gain.exponentialRampToValueAtTime(0.001, at + 0.05);
      source.connect(filter);
      filter.connect(gain);
      gain.connect(output);
      source.start(at);
      source.stop(at + 0.06);
    }
  },
};

// A tenth of a second of hiss, made once and used for every hat
let noiseBuffer = null;
function noise(context) {
  if (!noiseBuffer) {
    const length = Math.floor(context.sampleRate / 10);
    noiseBuffer = context.createBuffer(1, length, context.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
  }
  return noiseBuffer;
}

// ---------- Playing ----------

// Starts a song. Gives back { stop(), setVolume(0 to 1) }, or null
// if the browser can't make sound.
export function playSong(song, { volume = 0.8 } = {}) {
  const audio = getAudio();
  if (!audio) return null;
  const { context, master } = audio;

  const output = context.createGain();
  output.gain.value = volume;
  output.connect(master);

  // Every note of every track, in the order they're played
  const events = song.tracks
    .flatMap((track) => track.notes.map(([beat, note, beats = 0.5]) => ({
      beat, note, beats, play: INSTRUMENTS[track.instrument], loudness: track.volume ?? 1,
    })))
    .sort((a, b) => a.beat - b.beat);

  if (events.length === 0) {
    output.disconnect();
    return null;
  }

  const beatLength = 60 / song.bpm;
  const loopLength = song.beats * beatLength;
  const start = context.currentTime + 0.1;
  let loop = 0;
  let next = 0;

  // Lines up the notes due in the next moment; the timer keeps
  // calling it, so the song never runs out
  function schedule() {
    const until = context.currentTime + LOOKAHEAD;
    for (;;) {
      if (next >= events.length) {
        loop++;
        next = 0;
      }
      const event = events[next];
      const at = start + loop * loopLength + event.beat * beatLength;
      if (at > until) break;
      if (at >= context.currentTime) {
        event.play(context, output, event.note, at, event.beats * beatLength, event.loudness);
      }
      next++;
    }
  }

  schedule();
  const timer = setInterval(schedule, TICK_MS);

  return {
    stop() {
      clearInterval(timer);
      output.gain.setTargetAtTime(0, context.currentTime, 0.05);
      setTimeout(() => output.disconnect(), 400);
    },
    setVolume(value) {
      output.gain.setTargetAtTime(value, context.currentTime, 0.05);
    },
  };
}
