/**
 * Phase sounds, synthesised with the Web Audio API (no audio files).
 *
 *   inhale  – struck bell: ~480 Hz body with bright inharmonic partials
 *   in2/in3 – short, light tick for top-up inhales
 *   hold    – soft high chime (~1.19 kHz)
 *   holdOut – the same chime, lower
 *   exhale  – low singing bowl (~344 Hz) with slow beating, rings the whole exhale
 *   end     – deep, long bowl when the session finishes
 *
 * Each cue's decay is matched to its phase length, so the sound "carries"
 * the phase and the app can be used with eyes closed.
 */

/** [frequency Hz, amplitude, decay factor (1 = lasts the whole phase)] */
const BELL = [
  [480, 0.5, 1],
  [1276, 0.42, 0.75],
  [2360, 0.18, 0.4],
  [3100, 0.1, 0.28],
  [5200, 0.05, 0.18],
];
const TICK = [
  [1276, 0.22, 1],
  [2360, 0.08, 0.6],
];
const CHIME = [
  [1188, 0.16, 1],
  [2896, 0.06, 0.6],
];
const CHIME_LOW = [
  [990, 0.15, 1],
  [2414, 0.05, 0.6],
];
const BOWL = [
  [344, 0.36, 1],
  [345.6, 0.3, 1], // detuned twin → slow 1.6 Hz "wah" beating
  [1012, 0.17, 0.85],
  [1014.2, 0.12, 0.85],
  [1960, 0.04, 0.5],
];
const END_BOWL = [
  [258, 0.4, 1],
  [259.1, 0.32, 1],
  [760, 0.14, 0.8],
  [1470, 0.04, 0.5],
];

export function createAudio() {
  const Ctx = window.AudioContext || window.webkitAudioContext;
  const ctx = new Ctx({ latencyHint: 'playback' });

  const master = ctx.createGain();
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -12;
  comp.ratio.value = 4;
  master.connect(comp).connect(ctx.destination);

  let volume = 0.8;
  master.gain.value = curve(volume);

  /**
   * @param {number[][]} partials
   * @param {number} when    AudioContext time
   * @param {number} length  how long the cue should ring (s)
   * @param {{ attack?: number, gain?: number, tail?: number }} [opts]
   */
  function strike(partials, when, length, { attack = 0.006, gain = 1, tail = 4.6 } = {}) {
    const end = when + length;
    for (const [freq, amp, decay] of partials) {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = freq;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, when);
      g.gain.linearRampToValueAtTime(amp * gain, when + attack);
      // Exponential decay: reaches ~1% after `length * decay` seconds.
      g.gain.setTargetAtTime(0, when + attack, Math.max(0.05, (length * decay) / tail));
      // Short fade at the very end to avoid clicks.
      g.gain.setTargetAtTime(0, end, 0.06);
      osc.connect(g).connect(master);
      osc.start(when);
      osc.stop(end + 0.4);
    }
  }

  return {
    ctx,

    /**
     * Schedule the cue for a phase.
     * @param {string} type phase type
     * @param {number} when AudioContext time
     * @param {number} dur  phase duration (s)
     */
    cue(type, when, dur) {
      switch (type) {
        case 'in':
          return strike(BELL, when, Math.max(dur, 1.5));
        case 'in2':
        case 'in3':
          return strike(TICK, when, Math.min(1.2, Math.max(dur, 0.6)), { gain: 1 });
        case 'hold':
          return strike(CHIME, when, dur, { attack: 0.02 });
        case 'holdOut':
          return strike(CHIME_LOW, when, dur, { attack: 0.02 });
        case 'out':
          return strike(BOWL, when, dur, { attack: 0.05, tail: 3 });
        default:
          return undefined;
      }
    },

    /** Deep closing bowl. */
    end(when) {
      strike(END_BOWL, when, 6, { attack: 0.05, tail: 3 });
    },

    /** @param {number} v 0..1 */
    setVolume(v) {
      volume = Math.min(1, Math.max(0, v));
      master.gain.setTargetAtTime(curve(volume), ctx.currentTime, 0.05);
    },

    get volume() {
      return volume;
    },
  };
}

/** Perceptual volume curve. */
const curve = (v) => v * v;

/**
 * iOS: let sound play even when the ring/silent switch is on silent.
 * Audio Session API — available in recent Safari; harmless elsewhere.
 */
export function preferPlaybackSession() {
  try {
    if (navigator.audioSession) navigator.audioSession.type = 'playback';
  } catch {
    /* not supported */
  }
}
