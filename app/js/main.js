import { PROGRAMS, DURATIONS, PHASE_LABELS, getProgram, patternLabel } from './programs.js';
import { buildTimeline, formatClock } from './timeline.js';
import { addPractice, computeStats, MIN_SECONDS } from './streaks.js';
import { renderSession, preferPlaybackSession, LEAD_IN } from './audio.js';
import { silentWav } from './wav.js';
import { runSession } from './session.js';
import { load, save, requestPersistence } from './storage.js';
import { keepAwake, allowSleep } from './wakelock.js';
import { createShimmer } from './shimmer.js';

export const VERSION = '0.2.0';

/** Orb diameter at full inhale, as a fraction of the stage (matches CSS inset). */
const ORB_FRACTION = 0.88;
/** Sessions shorter than this (ended early) are treated as accidental and not logged. */
const MIN_LOGGED_SECONDS = 15;
/** After a completed session, the screen fades to black after this long (bedtime use). */
const SLEEP_FADE_MS = 5000;

const $ = (id) => document.getElementById(id);

const store = load();
let openId = null;
/** @type {null | { session: ReturnType<typeof runSession>, withAudio: boolean, program: any, minutes: number }} */
let active = null;
let starting = false;
let swapping = false;
let sleepTimer = 0;

/** One <audio> element for every session: iOS keeps it playing on the lock screen. */
const player = $('player');
const silentUrl = URL.createObjectURL(new Blob([silentWav()], { type: 'audio/wav' }));
let sessionUrl = null;
/** @type {null | { program: any, minutes: number }} */
let lastPlayed = null;

const shimmer = createShimmer($('shimmer'));

/* ---------- helpers ---------- */

/**
 * Minimal element builder.
 * @param {string} tag
 * @param {Record<string, any>} [props]
 * @param {...(Node|string|null|false)} children
 */
function h(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === 'class') node.className = v;
    else if (k === 'dataset') Object.assign(node.dataset, v);
    else if (k.startsWith('on')) node.addEventListener(k.slice(2), v);
    else if (v === true) node.setAttribute(k, '');
    else if (v !== false && v != null) node.setAttribute(k, v);
  }
  for (const c of children) if (c || c === 0) node.append(c);
  return node;
}

function paint(el, program) {
  const { bg, orb } = program.colors;
  el.style.setProperty('--bg1', bg[0]);
  el.style.setProperty('--bg2', bg[1]);
  el.style.setProperty('--orb1', orb[0]);
  el.style.setProperty('--orb2', orb[1]);
}

function show(screen) {
  for (const id of ['home', 'session', 'done']) $(id).hidden = id !== screen;
  window.scrollTo(0, 0);
}

function greeting(date = new Date()) {
  const hr = date.getHours();
  if (hr < 5) return 'Still up? Let’s slow down';
  if (hr < 12) return 'Good morning';
  if (hr < 18) return 'Good afternoon';
  return 'Good evening';
}

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

/* ---------- home ---------- */

function renderHome() {
  const stats = computeStats(store.days);
  $('streak-count').textContent = String(stats.current);
  $('streak-pill').classList.toggle('lit', stats.todayDone);
  $('streak-pill').setAttribute(
    'aria-label',
    `${plural(stats.current, 'day')} streak${stats.todayDone ? ', done today' : ''}`,
  );
  $('greeting').textContent = greeting();
  $('stats').textContent =
    stats.sessions > 0
      ? `Longest streak ${plural(stats.longest, 'day')} · ${stats.totalMinutes} min breathed`
      : 'Pick a practice. Tap a time to begin.';
  $('version').textContent = `v${VERSION}`;

  const last = store.last && getProgram(store.last.programId);
  const repeat = $('repeat');
  if (last) {
    repeat.hidden = false;
    paint(repeat, last);
    $('repeat-label').textContent = `${last.name} · ${store.last.minutes} min`;
  } else {
    repeat.hidden = true;
  }

  $('programs').replaceChildren(...PROGRAMS.map(programCard));
}

function programCard(p) {
  const preferred = store.minutesByProgram[p.id] ?? p.defaultMinutes;
  const durId = `dur-${p.id}`;
  const isOpen = openId === p.id;

  const li = h(
    'li',
    { class: `card${isOpen ? ' open' : ''}`, dataset: { id: p.id } },
    h(
      'button',
      {
        type: 'button',
        class: 'card-main',
        'aria-expanded': String(isOpen),
        'aria-controls': durId,
        onclick: () => toggle(p.id),
      },
      h('span', { class: 'card-orb', 'aria-hidden': 'true' }),
      h(
        'span',
        { class: 'card-text' },
        h('span', { class: 'card-name' }, p.name, p.advanced && h('span', { class: 'badge' }, 'Advanced')),
        h('span', { class: 'card-tech' }, `${p.technique} · ${patternLabel(p)}`),
        h('span', { class: 'card-tag' }, p.tagline),
      ),
      h('span', { class: 'chev', 'aria-hidden': 'true' }),
    ),
    h(
      'div',
      { class: 'durations-wrap', id: durId },
      h(
        'div',
        { class: 'durations', role: 'group', 'aria-label': `${p.name} duration` },
        ...DURATIONS.map((m) =>
          h(
            'button',
            {
              type: 'button',
              class: `dur${m === preferred ? ' preferred' : ''}`,
              tabindex: isOpen ? null : '-1',
              'aria-label': `Start ${p.name}, ${m} minutes`,
              onclick: () => start(p, m),
            },
            h('span', { class: 'dur-n' }, String(m)),
            h('span', { class: 'dur-u' }, 'min'),
          ),
        ),
      ),
    ),
  );
  paint(li, p);
  return li;
}

function toggle(id) {
  openId = openId === id ? null : id;
  for (const li of $('programs').children) {
    const open = li.dataset.id === openId;
    li.classList.toggle('open', open);
    li.querySelector('.card-main').setAttribute('aria-expanded', String(open));
    li.querySelectorAll('.dur').forEach((b) =>
      open ? b.removeAttribute('tabindex') : b.setAttribute('tabindex', '-1'),
    );
    if (open) setTimeout(() => li.scrollIntoView({ block: 'nearest', behavior: 'smooth' }), 180);
  }
}

/* ---------- session ---------- */

function setSource(blob) {
  if (sessionUrl) URL.revokeObjectURL(sessionUrl);
  sessionUrl = URL.createObjectURL(blob);
  player.src = sessionUrl;
  player.load();
}

const once = (el, type) => new Promise((resolve) => el.addEventListener(type, resolve, { once: true }));

async function start(program, minutes) {
  if (active || starting) return;
  starting = true;
  cancelSleep();

  // iOS: unlock the media element synchronously inside the tap; it stays
  // allowed to play once the real session audio is ready.
  preferPlaybackSession();
  player.src = silentUrl;
  const unlocked = player.play().catch(() => {});

  store.last = { programId: program.id, minutes };
  store.minutesByProgram = { ...store.minutesByProgram, [program.id]: minutes };
  save(store);
  lastPlayed = { program, minutes };

  const screen = $('session');
  paint(screen, program);
  screen.dataset.phase = 'lead';
  setPausedUI(false);
  lastText = {};
  $('s-name').textContent = program.name;
  $('volume').value = String(store.volume);
  $('orb').style.transform = 'scale(0.42)';
  setText('cue-label', 'Get ready');
  setText('cue-sub', 'Preparing sounds…');
  setText('cue-count', '');
  setText('s-remaining', '');
  show('session');
  keepAwake();
  shimmer.start();

  const timeline = buildTimeline(program, minutes);
  let withAudio = true;
  try {
    await unlocked;
    setSource(await renderSession(timeline, { volume: store.volume }));
  } catch {
    withAudio = false; // no Web Audio rendering available: run silently
  }

  setupMediaSession(program, minutes);
  const session = runSession({
    program,
    minutes,
    player: withAudio ? player : null,
    onFrame: (state) => renderFrame(program, state),
    onPauseChange: (paused) => !swapping && setPausedUI(paused),
    onEnd: (result) => end(result),
  });
  active = { session, withAudio, program, minutes };
  store.pending = { programId: program.id, total: timeline.total, startedAt: Date.now() };
  save(store);
  starting = false;
}

/** Volume is baked into the rendered file (iOS ignores <audio>.volume): re-render and resume in place. */
async function applyVolume() {
  save(store);
  if (!active?.withAudio) return;
  const { timeline } = active.session;
  const blob = await renderSession(timeline, { volume: store.volume });
  if (!active) return;
  const at = player.currentTime;
  const wasPlaying = !player.paused;
  swapping = true;
  setSource(blob);
  await once(player, 'loadedmetadata');
  player.currentTime = at;
  if (wasPlaying) await player.play().catch(() => {});
  swapping = false;
}

/** Lock-screen / Control Center "Now Playing" with play, pause and stop. */
function setupMediaSession(program, minutes) {
  if (!('mediaSession' in navigator)) return;
  const ms = navigator.mediaSession;
  try {
    ms.metadata = new MediaMetadata({
      title: `${program.name} · ${minutes} min`,
      artist: 'V-Calm',
      album: program.technique,
      artwork: [{ src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' }],
    });
  } catch {
    /* MediaMetadata unsupported */
  }
  const handlers = {
    play: () => active?.session.resume(),
    pause: () => active?.session.pause(),
    stop: () => active?.session.stop(),
    seekbackward: null,
    seekforward: null,
    previoustrack: null,
    nexttrack: null,
  };
  for (const [action, fn] of Object.entries(handlers)) {
    try {
      ms.setActionHandler(action, fn);
    } catch {
      /* action unsupported on this platform */
    }
  }
}

function clearMediaSession() {
  if ('mediaSession' in navigator) navigator.mediaSession.metadata = null;
}

let lastText = {};
function setText(id, text) {
  if (lastText[id] === text) return;
  lastText[id] = text;
  $(id).textContent = text;
}

function renderFrame(program, state) {
  if (swapping) return;
  const orb = $('orb');
  orb.style.transform = `scale(${state.scale.toFixed(4)})`;
  $('glow').style.opacity = String(((state.scale - 0.42) / 0.58) * 0.55 + 0.15);
  setText('s-remaining', formatClock(state.remaining));

  const screen = $('session');
  if (state.status === 'lead') {
    screen.dataset.phase = 'lead';
    setText('cue-label', 'Get ready');
    setText('cue-sub', program.technique);
    setText('cue-count', String(state.phaseLeft));
  } else if (state.status === 'running') {
    const { type, dur } = state.segment;
    screen.dataset.phase = type;
    setText('cue-label', PHASE_LABELS[type]);
    setText('cue-sub', program.hints?.[type] ?? '');
    setText('cue-count', dur >= 2 ? String(state.phaseLeft) : '');
  }
  shimmer.update(state, ORB_FRACTION);
}

function togglePause() {
  if (!active) return;
  if (active.session.paused) active.session.resume();
  else active.session.pause();
}

function setPausedUI(paused) {
  $('session').classList.toggle('paused', paused);
  $('paused').hidden = !paused;
  $('stage').setAttribute('aria-label', paused ? 'Resume' : 'Pause');
}

function end(result) {
  allowSleep(); // let iOS Auto-Lock take over straight away
  shimmer.stop();
  clearMediaSession();
  const { program } = active;
  active = null;
  delete store.pending;

  if (!result.completed && result.seconds < MIN_LOGGED_SECONDS) {
    save(store);
    renderHome();
    show('home');
    return;
  }

  const before = computeStats(store.days);
  store.days = addPractice(store.days, new Date(), result.seconds);
  save(store);
  requestPersistence();
  renderDone(program, result, before, computeStats(store.days));
  show('done');
  if (result.completed) sleepTimer = setTimeout(() => ($('sleep').hidden = false), SLEEP_FADE_MS);
}

/* ---------- bedtime: fade to black after a completed session ---------- */

function cancelSleep() {
  clearTimeout(sleepTimer);
  $('sleep').hidden = true;
}

/**
 * A session that was still running when the page was killed in the
 * background (possible on a long locked-screen session) is credited on the
 * next launch, so the streak survives.
 */
function recoverPending() {
  const p = store.pending;
  if (!p) return;
  delete store.pending;
  const seconds = Math.min(p.total, (Date.now() - p.startedAt) / 1000 - LEAD_IN);
  if (seconds >= MIN_LOGGED_SECONDS) store.days = addPractice(store.days, new Date(p.startedAt), seconds);
  save(store);
}

/* ---------- done ---------- */

function renderDone(program, result, before, after) {
  paint($('done'), program);
  $('done-title').textContent = result.completed ? 'Well done' : 'Good pause';
  $('done-summary').textContent = `${program.name} · ${formatClock(result.seconds)}`;

  const grew = after.current > before.current;
  $('done-flame').classList.toggle('grew', grew);
  $('done-flame').classList.toggle('lit', after.todayDone);
  $('done-streak').textContent = after.current > 0 ? `${plural(after.current, 'day')} streak` : '';

  const missing = MIN_SECONDS - after.todaySeconds;
  $('done-note').textContent = after.todayDone
    ? grew && after.current > 1
      ? 'Streak extended. See you tomorrow.'
      : ''
    : `${Math.ceil(missing / 60)} more min today counts towards your streak.`;

  $('done-longest').textContent = plural(after.longest, 'day');
  $('done-total').textContent = `${after.totalMinutes} min`;
  $('done-sessions').textContent = String(after.sessions);
}

/* ---------- wiring ---------- */

$('repeat').addEventListener('click', () => {
  const p = store.last && getProgram(store.last.programId);
  if (p) start(p, store.last.minutes);
});
$('stage').addEventListener('click', togglePause);
$('session-close').addEventListener('click', () => active?.session.stop());
$('volume').addEventListener('input', (e) => {
  store.volume = Number(e.target.value);
});
$('volume').addEventListener('change', () => applyVolume());
$('sleep').addEventListener('click', cancelSleep);
$('done-home').addEventListener('click', () => {
  cancelSleep();
  renderHome();
  show('home');
});
$('done-again').addEventListener('click', () => {
  if (lastPlayed) start(lastPlayed.program, lastPlayed.minutes);
});

// Locking the phone keeps the session going (audio continues on the lock
// screen). Coming back catches up on a session that ended meanwhile.
// Without audio there is nothing to follow, so the silent fallback pauses.
document.addEventListener('visibilitychange', () => {
  if (!active) return;
  if (document.visibilityState === 'visible') active.session.sync();
  else if (!active.withAudio && !active.session.paused) active.session.pause();
});
window.addEventListener('resize', () => shimmer.resize());

// Deep link: /?p=unwind opens that card.
const deepLink = new URLSearchParams(location.search).get('p');
if (deepLink && getProgram(deepLink)) openId = deepLink;

recoverPending();
renderHome();

if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
  navigator.serviceWorker.register('/sw.js').catch(() => {});
}
