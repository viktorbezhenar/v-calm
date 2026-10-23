/**
 * Tiny persistence layer over localStorage. Everything stays on the device.
 * Every access is wrapped: storage can be unavailable (private mode, quota).
 */

const KEY = 'vcalm:v1';

/**
 * @typedef {object} Store
 * @property {Record<string, {sec:number, n:number}>} days  practice per local day
 * @property {{ programId: string, minutes: number } | null} last
 * @property {Record<string, number>} minutesByProgram
 * @property {number} volume
 */

/** @returns {Store} */
function empty() {
  return { days: {}, last: null, minutesByProgram: {}, volume: 0.8 };
}

/** @returns {Store} */
export function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return empty();
    const data = JSON.parse(raw);
    return { ...empty(), ...data };
  } catch {
    return empty();
  }
}

/** @param {Store} store */
export function save(store) {
  try {
    localStorage.setItem(KEY, JSON.stringify(store));
    return true;
  } catch {
    return false;
  }
}

/** Ask the browser not to evict our data (best effort). */
export async function requestPersistence() {
  try {
    if (navigator.storage?.persist && !(await navigator.storage.persisted())) {
      await navigator.storage.persist();
    }
  } catch {
    /* ignore */
  }
}
