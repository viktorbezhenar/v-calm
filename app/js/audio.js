/**
 * Phase sounds, synthesised with the Web Audio API and rendered offline
 * into one audio file per session.
 *
 *   inhale  – struck bell: ~480 Hz body with bright inharmonic partials
 *   in2/in3 – short, light tick for top-up inhales
 *   hold    – soft high chime (~1.19 kHz)
 *   holdOut – the same chime, lower
 *   exhale  – low singing bowl (~344 Hz) with slow beating, rings the whole exhale
 *   end     – deep, long bowl when the session finishes
 *
 * Why offline rendering: iOS treats live Web Audio as "ambient" and mutes it
 * when the screen locks; a rendered file played by an <audio> element keeps
 * going on the lock screen, with Now Playing controls.
 */
import { encodeWav } from './wav.js';

export const LEAD_IN = 2; // seconds of "Get ready" silence before the first inhale
export const END_TAIL = 6; // closing bowl ring-out after the last exhale
const SAMPLE_RATE = 22050; // highest partial is 5.2 kHz, well below Nyquist

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

/**
 * @param {BaseAudioContext} ctx
 * @param {AudioNode} out
 * @param {number[][]} partials
 * @param {number} when    seconds
 * @param {number} length  how long the cue should ring (s)
 */
function strike(ctx, out, partials, when, length, { attack = 0.006, gain = 1, tail = 4.6 } = {}) {
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
    osc.connect(g).connect(out);
    osc.start(when);
    osc.stop(end + 0.4);
  }
}

function cue(ctx, out, type, when, dur) {
  switch (type) {
    case 'in':
      return strike(ctx, out, BELL, when, Math.max(dur, 1.5));
    case 'in2':
    case 'in3':
      return strike(ctx, out, TICK, when, Math.min(1.2, Math.max(dur, 0.6)));
    case 'hold':
      return strike(ctx, out, CHIME, when, dur, { attack: 0.02 });
    case 'holdOut':
      return strike(ctx, out, CHIME_LOW, when, dur, { attack: 0.02 });
    case 'out':
      return strike(ctx, out, BOWL, when, dur, { attack: 0.05, tail: 3 });
    default:
      return undefined;
  }
}

/** Render a short clip offline. `build(ctx, out)` schedules sounds on `out`. */
async function renderClip(seconds, volume, build) {
  const Offline = window.OfflineAudioContext || window.webkitOfflineAudioContext;
  const ctx = new Offline(1, Math.ceil(seconds * SAMPLE_RATE), SAMPLE_RATE);
  const master = ctx.createGain();
  master.gain.value = curve(volume);
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -12;
  comp.ratio.value = 4;
  master.connect(comp).connect(ctx.destination);
  build(ctx, master);
  return (await ctx.startRendering()).getChannelData(0);
}

/**
 * Render a whole session (lead-in silence, every phase cue, closing bowl)
 * into a WAV blob. Every cycle sounds the same, so one cycle is rendered and
 * overlap-added N times: a 5-minute session renders as fast as ~20 seconds.
 * @param {{ segments: { type: string, start: number, dur: number, cycle: number }[], total: number, cycles: number }} timeline
 * @param {{ volume?: number }} [opts] 0..1, baked into the file (iOS ignores <audio>.volume)
 * @returns {Promise<Blob>}
 */
export async function renderSession(timeline, { volume = 0.8 } = {}) {
  const cycleLen = timeline.total / timeline.cycles;
  const firstCycle = timeline.segments.filter((s) => s.cycle === 0);
  const [cycle, ending] = await Promise.all([
    // +0.5 s so the last exhale's fade-out tail is kept and overlaps the next cycle
    renderClip(cycleLen + 0.5, volume, (ctx, out) => {
      for (const seg of firstCycle) cue(ctx, out, seg.type, seg.start, seg.dur);
    }),
    renderClip(END_TAIL, volume, (ctx, out) => strike(ctx, out, END_BOWL, 0, END_TAIL, { attack: 0.05, tail: 3 })),
  ]);

  const lead = Math.round(LEAD_IN * SAMPLE_RATE);
  const body = Math.round(timeline.total * SAMPLE_RATE);
  const out = new Float32Array(lead + body + ending.length);
  for (let c = 0; c < timeline.cycles; c++) {
    mixInto(out, cycle, lead + Math.round(c * cycleLen * SAMPLE_RATE));
  }
  mixInto(out, ending, lead + body);
  return new Blob([encodeWav(out, SAMPLE_RATE)], { type: 'audio/wav' });
}

function mixInto(target, clip, offset) {
  const n = Math.min(clip.length, target.length - offset);
  for (let i = 0; i < n; i++) target[offset + i] += clip[i];
}

/** Perceptual volume curve. */
const curve = (v) => Math.min(1, Math.max(0, v)) ** 2;

/**
 * iOS: play through the silent switch and keep playing when locked.
 * Audio Session API — available in recent Safari; harmless elsewhere.
 */
export function preferPlaybackSession() {
  try {
    if (navigator.audioSession) navigator.audioSession.type = 'playback';
  } catch {
    /* not supported */
  }
}
