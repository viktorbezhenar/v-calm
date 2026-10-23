/**
 * Runs one breathing session against a clock and reports animation frames.
 *
 * Normally the clock is the <audio> element playing the rendered session
 * (its currentTime is the single source of truth for sound and animation, and
 * it keeps running on a locked screen). Without audio, a performance.now()
 * clock with the same interface is used.
 */
import { buildTimeline, stateAt } from './timeline.js';
import { LEAD_IN } from './audio.js';

/**
 * @param {object} opts
 * @param {import('./programs.js').Program} opts.program
 * @param {number} opts.minutes
 * @param {HTMLAudioElement | null} opts.player  already loaded with the rendered session
 * @param {(state: ReturnType<typeof stateAt>) => void} opts.onFrame
 * @param {(paused: boolean) => void} opts.onPauseChange
 * @param {(result: { completed: boolean, seconds: number }) => void} opts.onEnd
 */
export function runSession({ program, minutes, player, onFrame, onPauseChange, onEnd }) {
  const timeline = buildTimeline(program, minutes);
  const clock = player ? mediaClock(player) : perfClock();

  let raf = 0;
  let ended = false;

  const elapsed = () => clock.now() - LEAD_IN;

  function frame() {
    if (ended) return;
    const state = stateAt(timeline, elapsed());
    onFrame(state);
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
    clock.detach();
    onEnd({ completed, seconds: Math.max(0, Math.min(timeline.total, seconds)) });
  }

  // Pauses can come from the lock screen / Control Center, not just the UI.
  clock.onPauseChange((paused) => {
    if (!ended) onPauseChange(paused);
  });
  clock.onEnded(() => finish(true, timeline.total));

  clock.start();
  raf = requestAnimationFrame(frame);

  return {
    timeline,
    get paused() {
      return clock.paused;
    },
    pause: () => clock.pause(),
    resume: () => clock.resume(),
    /** User ended early (✕ or lock-screen stop). */
    stop() {
      const practiced = elapsed();
      clock.halt();
      finish(false, practiced);
    },
    /** Called when the page becomes visible again: catch up on a session that ended while locked. */
    sync() {
      if (!ended && elapsed() >= timeline.total) finish(true, timeline.total);
    },
  };
}

/** @param {HTMLAudioElement} el */
function mediaClock(el) {
  const listeners = [];
  const on = (type, fn) => {
    el.addEventListener(type, fn);
    listeners.push([type, fn]);
  };
  return {
    now: () => el.currentTime,
    get paused() {
      return el.paused;
    },
    start: () => el.play().catch(() => {}),
    pause: () => el.pause(),
    resume: () => el.play().catch(() => {}),
    halt: () => el.pause(),
    onPauseChange(fn) {
      on('pause', () => !el.ended && fn(true));
      on('play', () => fn(false));
    },
    onEnded(fn) {
      on('ended', fn);
    },
    detach() {
      for (const [type, fn] of listeners) el.removeEventListener(type, fn);
    },
  };
}

/** Silent fallback clock (no audio available). */
function perfClock() {
  const raw = () => performance.now() / 1000;
  let offset = raw();
  let pausedAt = null;
  let pauseFn = () => {};
  return {
    now: () => (pausedAt ?? raw()) - offset,
    get paused() {
      return pausedAt !== null;
    },
    start() {},
    pause() {
      if (pausedAt === null) {
        pausedAt = raw();
        pauseFn(true);
      }
    },
    resume() {
      if (pausedAt !== null) {
        offset += raw() - pausedAt;
        pausedAt = null;
        pauseFn(false);
      }
    },
    halt() {},
    onPauseChange(fn) {
      pauseFn = fn;
    },
    onEnded() {},
    detach() {},
  };
}
