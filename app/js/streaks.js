/**
 * Pure streak logic. Practice is stored per local calendar day as
 * { 'YYYY-MM-DD': { sec, n } }. A day counts towards the streak once
 * at least MIN_SECONDS of practice were logged that day.
 */

export const MIN_SECONDS = 120;
const DAY_MS = 86_400_000;

/** Local calendar day key for a Date, e.g. "2026-10-23". */
export function dayKey(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Day number (days since epoch) for a key — DST-safe via UTC. */
function dayNumber(key) {
  const [y, m, d] = key.split('-').map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / DAY_MS);
}

/**
 * Returns a new days object with the session added.
 * @param {Record<string, {sec:number, n:number}>} days
 * @param {Date} date
 * @param {number} seconds
 */
export function addPractice(days, date, seconds) {
  const sec = Math.max(0, Math.round(seconds));
  if (sec === 0) return days;
  const key = dayKey(date);
  const prev = days[key] ?? { sec: 0, n: 0 };
  return { ...days, [key]: { sec: prev.sec + sec, n: prev.n + 1 } };
}

/**
 * @param {Record<string, {sec:number, n:number}>} days
 * @param {Date} [today]
 */
export function computeStats(days, today = new Date()) {
  const qualifying = Object.keys(days)
    .filter((k) => days[k].sec >= MIN_SECONDS)
    .map(dayNumber)
    .sort((a, b) => a - b);
  const set = new Set(qualifying);
  const todayN = dayNumber(dayKey(today));
  const todayDone = set.has(todayN);

  // Current streak: alive if today or yesterday qualifies.
  let current = 0;
  let cursor = todayDone ? todayN : todayN - 1;
  while (set.has(cursor)) {
    current++;
    cursor--;
  }

  let longest = 0;
  let run = 0;
  let prev = null;
  for (const n of qualifying) {
    run = prev !== null && n === prev + 1 ? run + 1 : 1;
    longest = Math.max(longest, run);
    prev = n;
  }

  const totalSeconds = Object.values(days).reduce((s, d) => s + d.sec, 0);
  const todaySeconds = days[dayKey(today)]?.sec ?? 0;

  return {
    current,
    longest,
    todayDone,
    todaySeconds,
    totalMinutes: Math.round(totalSeconds / 60),
    sessions: Object.values(days).reduce((s, d) => s + d.n, 0),
  };
}
