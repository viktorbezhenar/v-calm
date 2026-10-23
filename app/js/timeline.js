/**
 * Pure timing engine: turns a program + duration into a list of timed
 * segments, and answers "what is happening at time t?".
 * No DOM, no audio — fully unit-testable.
 */

export const MIN_SCALE = 0.42;
export const MAX_SCALE = 1;

const INHALES = new Set(['in', 'in2', 'in3']);

/** @param {string} type */
export const isInhale = (type) => INHALES.has(type);

/** @param {import('./programs.js').Program} program */
export function cycleLength(program) {
  return program.phases.reduce((sum, p) => sum + p.dur, 0);
}

/**
 * Orb scale at the start and end of each phase in one cycle.
 * Multiple inhales fill the orb in proportion to their time.
 * @param {import('./programs.js').Phase[]} phases
 */
export function cycleScales(phases) {
  const inhaleTotal = phases.filter((p) => isInhale(p.type)).reduce((s, p) => s + p.dur, 0);
  let scale = MIN_SCALE;
  let inhaled = 0;
  return phases.map((p) => {
    const from = scale;
    if (isInhale(p.type)) {
      inhaled += p.dur;
      scale = MIN_SCALE + (MAX_SCALE - MIN_SCALE) * (inhaled / inhaleTotal);
    } else if (p.type === 'out') {
      scale = MIN_SCALE;
      inhaled = 0;
    }
    return { from, to: scale };
  });
}

/**
 * Number of whole cycles for a requested duration. Always finishes the
 * current cycle, so a session ends on an exhale, never mid-breath.
 * @param {import('./programs.js').Program} program
 * @param {number} minutes
 */
export function cycleCount(program, minutes) {
  const len = cycleLength(program);
  return Math.max(1, Math.ceil((minutes * 60) / len - 1e-9));
}

/**
 * @typedef {object} Segment
 * @property {import('./programs.js').PhaseType} type
 * @property {number} start  seconds from session start
 * @property {number} dur
 * @property {number} from   orb scale at start
 * @property {number} to     orb scale at end
 * @property {number} cycle  0-based cycle index
 */

/**
 * @param {import('./programs.js').Program} program
 * @param {number} minutes
 * @returns {{ segments: Segment[], total: number, cycles: number }}
 */
export function buildTimeline(program, minutes) {
  const cycles = cycleCount(program, minutes);
  const scales = cycleScales(program.phases);
  /** @type {Segment[]} */
  const segments = [];
  let t = 0;
  for (let c = 0; c < cycles; c++) {
    program.phases.forEach((p, i) => {
      segments.push({ type: p.type, start: round(t), dur: p.dur, from: scales[i].from, to: scales[i].to, cycle: c });
      t += p.dur;
    });
  }
  return { segments, total: round(t), cycles };
}

/** Sine ease in-out, 0..1 → 0..1 */
export const ease = (x) => 0.5 - Math.cos(Math.PI * Math.min(1, Math.max(0, x))) / 2;

/**
 * State of the session at time t (seconds since session start).
 * t < 0 is the lead-in; t >= total is done.
 * @param {{ segments: Segment[], total: number }} timeline
 * @param {number} t
 */
export function stateAt(timeline, t) {
  const { segments, total } = timeline;
  if (t < 0) {
    return {
      status: 'lead',
      index: -1,
      segment: null,
      progress: 0,
      scale: MIN_SCALE,
      phaseLeft: Math.ceil(-t),
      remaining: total,
    };
  }
  if (t >= total) {
    return {
      status: 'done',
      index: segments.length,
      segment: null,
      progress: 1,
      scale: MIN_SCALE,
      phaseLeft: 0,
      remaining: 0,
    };
  }
  const index = findSegment(segments, t);
  const segment = segments[index];
  const progress = (t - segment.start) / segment.dur;
  const scale = segment.from + (segment.to - segment.from) * ease(progress);
  return {
    status: 'running',
    index,
    segment,
    progress,
    scale,
    phaseLeft: Math.max(1, Math.ceil(segment.start + segment.dur - t - 1e-6)),
    remaining: total - t,
  };
}

/** Binary search: last segment whose start <= t. */
function findSegment(segments, t) {
  let lo = 0;
  let hi = segments.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (segments[mid].start <= t) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

const round = (x) => Math.round(x * 1000) / 1000;

/** "3:10" */
export function formatClock(seconds) {
  const s = Math.max(0, Math.ceil(seconds - 1e-6));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
