/**
 * Breathing programs.
 *
 * Each phase is { type, dur } where dur is in seconds.
 * Phase types:
 *   in      – inhale (first or only inhale of the cycle)
 *   in2     – second inhale (physiological sigh)
 *   in3     – quick top-up inhale (physiological sigh)
 *   hold    – hold with full lungs
 *   holdOut – hold with empty lungs (box breathing)
 *   out     – exhale
 *
 * Colours: bg = session background gradient, orb = orb gradient.
 */

/** @typedef {'in'|'in2'|'in3'|'hold'|'holdOut'|'out'} PhaseType */
/** @typedef {{ type: PhaseType, dur: number }} Phase */
/**
 * @typedef {object} Program
 * @property {string} id
 * @property {string} name
 * @property {string} technique
 * @property {string} tagline
 * @property {Phase[]} phases
 * @property {boolean} [advanced]
 * @property {number} defaultMinutes
 * @property {{ bg: [string, string], orb: [string, string] }} colors
 * @property {Partial<Record<PhaseType, string>>} [hints] Optional sub-label per phase.
 */

/** @type {Program[]} */
export const PROGRAMS = [
  {
    id: 'relax',
    name: 'Relax',
    technique: 'Extended exhale',
    tagline: 'Quiet your mind and relieve stress',
    phases: [
      { type: 'in', dur: 4 },
      { type: 'out', dur: 6 },
    ],
    defaultMinutes: 3,
    colors: { bg: ['#1f4f5c', '#2b2766'], orb: ['#5fe3c9', '#7a6cf5'] },
  },
  {
    id: 'balance',
    name: 'Balance',
    technique: 'Equal breathing',
    tagline: 'Relax your body and become more present',
    phases: [
      { type: 'in', dur: 4 },
      { type: 'hold', dur: 2 },
      { type: 'out', dur: 4 },
    ],
    defaultMinutes: 3,
    colors: { bg: ['#2c5a3c', '#22456a'], orb: ['#93e06a', '#48a6ea'] },
  },
  {
    id: 'restore',
    name: 'Restore',
    technique: 'Deep belly breathing',
    tagline: 'Strengthen your body and restore energy',
    phases: [
      { type: 'in', dur: 5 },
      { type: 'out', dur: 5 },
    ],
    defaultMinutes: 3,
    hints: { in: 'into your belly' },
    colors: { bg: ['#4d4456', '#6a3a2d'], orb: ['#a99af7', '#f5a27a'] },
  },
  {
    id: 'focus',
    name: 'Focus',
    technique: 'Box breathing',
    tagline: 'Sharpen concentration and improve performance',
    phases: [
      { type: 'in', dur: 4 },
      { type: 'hold', dur: 4 },
      { type: 'out', dur: 4 },
      { type: 'holdOut', dur: 4 },
    ],
    defaultMinutes: 3,
    colors: { bg: ['#535a22', '#2c5326'], orb: ['#e4dd3c', '#5cc43c'] },
  },
  {
    id: 'energize',
    name: 'Energize',
    technique: 'Energizing breath',
    tagline: 'Boost your energy and alertness',
    phases: [
      { type: 'in', dur: 4 },
      { type: 'out', dur: 2 },
    ],
    advanced: true,
    defaultMinutes: 2,
    colors: { bg: ['#6a3957', '#3d3366'], orb: ['#f3c57c', '#b08af5'] },
  },
  {
    id: 'unwind',
    name: 'Unwind',
    technique: 'Relaxing breath',
    tagline: 'Release tension and calm your mind',
    phases: [
      { type: 'in', dur: 4 },
      { type: 'hold', dur: 7 },
      { type: 'out', dur: 8 },
    ],
    advanced: true,
    defaultMinutes: 3,
    hints: { in: 'through the nose', out: 'through the mouth' },
    colors: { bg: ['#2a3b66', '#3e2667'], orb: ['#5fd2f2', '#9a5fe0'] },
  },
  {
    id: 'sigh',
    name: 'Sigh',
    technique: 'Physiological sigh',
    tagline: 'The fastest way to calm down',
    // Two nasal inhales (the second a short top-up), then a long mouth exhale.
    // Exhale = 2x total inhale. Protocol from Balban et al., 2023 (Cell Reports
    // Medicine), which prescribes no counts; 2-1-6 is our timing. 5 min = study dose.
    phases: [
      { type: 'in', dur: 2 },
      { type: 'in2', dur: 1 },
      { type: 'out', dur: 6 },
    ],
    defaultMinutes: 5,
    hints: { in: 'through the nose', in2: 'top up, through the nose', out: 'slowly, through the mouth' },
    colors: { bg: ['#1d3a60', '#4e5f86'], orb: ['#9ad1ff', '#fff0d4'] },
  },
];

export const DURATIONS = [2, 3, 4, 5];

/** @type {Record<PhaseType, string>} */
export const PHASE_LABELS = {
  in: 'Inhale',
  in2: 'Inhale again',
  in3: 'Top up',
  hold: 'Hold',
  holdOut: 'Hold',
  out: 'Exhale',
};

/** @param {string} id */
export function getProgram(id) {
  return PROGRAMS.find((p) => p.id === id);
}

/**
 * Compact pattern string, e.g. "4-7-8" or "2-1-0.5-7".
 * @param {Program} program
 */
export function patternLabel(program) {
  return program.phases.map((p) => p.dur).join('-');
}
