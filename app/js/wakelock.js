/**
 * Keep the screen on during a session (Screen Wake Lock API).
 * Re-acquired automatically when the page becomes visible again.
 */
let sentinel = null;
let wanted = false;

async function acquire() {
  try {
    if (!('wakeLock' in navigator) || document.visibilityState !== 'visible') return;
    sentinel = await navigator.wakeLock.request('screen');
    sentinel.addEventListener('release', () => {
      sentinel = null;
    });
  } catch {
    /* denied or unsupported */
  }
}

document.addEventListener('visibilitychange', () => {
  if (wanted && !sentinel && document.visibilityState === 'visible') acquire();
});

export function keepAwake() {
  wanted = true;
  acquire();
}

export function allowSleep() {
  wanted = false;
  sentinel?.release().catch(() => {});
  sentinel = null;
}
