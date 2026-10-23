import { PROGRAMS, DURATIONS, PHASE_LABELS, getProgram, patternLabel } from './programs.js';
import { formatClock } from './timeline.js';
import { addPractice, computeStats, MIN_SECONDS } from './streaks.js';
import { createAudio, preferPlaybackSession } from './audio.js';
import { runSession } from './session.js';
import { load, save, requestPersistence } from './storage.js';
import { keepAwake, allowSleep } from './wakelock.js';
import { createShimmer } from './shimmer.js';

export const VERSION = '0.1.0';

/** Orb diameter at full inhale, as a fraction of the stage (matches CSS inset). */
const ORB_FRACTION = 0.88;
/** Sessions shorter than this (ended early) are treated as accidental and not logged. */
const MIN_LOGGED_SECONDS = 15;

const $ = (id) => document.getElementById(id);

const store = load();
let openId = null;
/** @type {null | { session: ReturnType<typeof runSession>, audio: any, program: any, minutes: number }} */
let active = null;
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

function unlockAudio() {
  preferPlaybackSession();
  try {
    const audio = createAudio();
    audio.setVolume(store.volume);
    // iOS: start the context inside the tap and play one silent frame.
    audio.ctx.resume();
    const buf = audio.ctx.createBuffer(1, 1, 22050);
    const src = audio.ctx.createBufferSource();
    src.buffer = buf;
    src.connect(audio.ctx.destination);
    src.start(0);
    return audio;
  } catch {
    return null;
  }
}

function start(program, minutes) {
  if (active) return;
  const audio = unlockAudio();

  store.last = { programId: program.id, minutes };
  store.minutesByProgram = { ...store.minutesByProgram, [program.id]: minutes };
  save(store);
  lastPlayed = { program, minutes };

  const screen = $('session');
  paint(screen, program);
  screen.dataset.phase = 'lead';
  screen.classList.remove('paused');
  $('paused').hidden = true;
  $('s-name').textContent = program.name;
  $('volume').value = String(store.volume);
  $('stage').setAttribute('aria-label', 'Pause');
  lastText = {};
  show('session');
  keepAwake();
  shimmer.start();

  const session = runSession({
    program,
    minutes,
    audio,
    onFrame: (state) => renderFrame(program, state),
    onEnd: (result) => end(result),
  });
  active = { session, audio, program, minutes };
}

let lastText = {};
function setText(id, text) {
  if (lastText[id] === text) return;
  lastText[id] = text;
  $(id).textContent = text;
}

function renderFrame(program, state) {
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
  const { session } = active;
  if (session.paused) session.resume();
  else session.pause();
  const paused = session.paused;
  $('session').classList.toggle('paused', paused);
  $('paused').hidden = !paused;
  $('stage').setAttribute('aria-label', paused ? 'Resume' : 'Pause');
}

function end(result) {
  allowSleep();
  shimmer.stop();
  const { audio, program } = active;
  active = null;
  // Let the closing bowl ring out, then release the audio context.
  if (audio && audio.ctx.state !== 'closed') setTimeout(() => audio.ctx.close().catch(() => {}), 7000);

  if (!result.completed && result.seconds < MIN_LOGGED_SECONDS) {
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
  const v = Number(e.target.value);
  active?.audio?.setVolume(v);
  store.volume = v;
});
$('volume').addEventListener('change', () => save(store));
$('done-home').addEventListener('click', () => {
  renderHome();
  show('home');
});
$('done-again').addEventListener('click', () => {
  if (lastPlayed) start(lastPlayed.program, lastPlayed.minutes);
});

// Leaving the app (switching apps, locking the phone) pauses the session.
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden' && active && !active.session.paused) togglePause();
});
window.addEventListener('resize', () => shimmer.resize());

// Deep link: /?p=unwind opens that card.
const deepLink = new URLSearchParams(location.search).get('p');
if (deepLink && getProgram(deepLink)) openId = deepLink;

renderHome();

if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
  navigator.serviceWorker.register('/sw.js').catch(() => {});
}
