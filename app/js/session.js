/**
 * Runs one breathing session: drives the clock, schedules sounds a little
 * ahead of time and reports animation frames to the UI.
 *
 * The AudioContext clock is the single source of truth for both sound and
 * animation, so they stay in sync for long sessions. Pausing suspends the
 * AudioContext, which freezes that clock.
 */
import { buildTimeline, stateAt } from './timeline.js';

const LEAD_IN = 2; // seconds of "Get ready" before the first inhale
const LOOKAHEAD = 1.0; // schedule sounds this far ahead (s)

/**
 * @param {object} opts
 * @param {import('./programs.js').Program} opts.program
 * @param {number} opts.minutes
 * @param {ReturnType<import('./audio.js').createAudio> | null} opts.audio
 * @param {(state: ReturnType<typeof stateAt>, timeline: ReturnType<typeof buildTimeline>) => void} opts.onFrame
 * @param {(result: { completed: boolean, seconds: number }) => void} opts.onEnd
 */
export function runSession({ program, minutes, audio, onFrame, onEnd }) {
  const timeline = buildTimeline(program, minutes);
  const clock = audio ? audioClock(audio.ctx) : perfClock();
  const t0 = clock.now() + LEAD_IN;

  let scheduled = 0; // index of next segment to schedule a sound for
  let raf = 0;
  let timer = 0;
  let paused = false;
  let ended = false;

  const elapsed = () => clock.now() - t0;

  function schedule() {
    if (!audio || paused || scheduled === -1) return;
    const horizon = elapsed() + LOOKAHEAD;
    while (scheduled < timeline.segments.length && timeline.segments[scheduled].start <= horizon) {
      const seg = timeline.segments[scheduled];
      audio.cue(seg.type, t0 + seg.start, seg.dur);
      scheduled++;
    }
    if (scheduled === timeline.segments.length && timeline.total <= horizon) {
      audio.end(t0 + timeline.total);
      scheduled = -1; // sentinel: everything scheduled
    }
  }

  function frame() {
    const t = elapsed();
    const state = stateAt(timeline, t);
    onFrame(state, timeline);
    if (state.status === 'done') {
      finish(true, timeline.total);
      return;
    }
    raf = requestAnimationFrame(frame);
  }

  function finish(completed, seconds) {
    if (ended) return;
    ended = true;
    cancelAnimationFrame(raf);
    clearInterval(timer);
    onEnd({ completed, seconds: Math.max(0, seconds) });
  }

  schedule();
  timer = setInterval(schedule, 200);
  raf = requestAnimationFrame(frame);

  return {
    timeline,
    get paused() {
      return paused;
    },
    pause() {
      if (paused || ended) return;
      paused = true;
      clock.pause();
    },
    resume() {
      if (!paused || ended) return;
      paused = false;
      clock.resume();
    },
    /** User ended early (✕). */
    stop() {
      const practiced = Math.min(timeline.total, Math.max(0, elapsed()));
      if (audio && paused) clock.resume();
      finish(false, practiced);
      // Silence anything already scheduled.
      if (audio) silence(audio.ctx);
    },
  };
}

function audioClock(ctx) {
  return {
    now: () => ctx.currentTime,
    pause: () => ctx.suspend(),
    resume: () => ctx.resume(),
  };
}

/** Fallback clock when Web Audio is unavailable. */
function perfClock() {
  let offset = 0;
  let pausedAt = null;
  const raw = () => performance.now() / 1000;
  return {
    now: () => (pausedAt ?? raw()) - offset,
    pause: () => {
      pausedAt = raw();
    },
    resume: () => {
      if (pausedAt !== null) offset += raw() - pausedAt;
      pausedAt = null;
    },
  };
}

/**
 * Oscillators already scheduled into the future can't be cancelled
 * individually without bookkeeping; briefly suspending and closing the
 * output is simplest. The UI creates a fresh context per session.
 */
function silence(ctx) {
  try {
    ctx.close();
  } catch {
    /* already closed */
  }
}
