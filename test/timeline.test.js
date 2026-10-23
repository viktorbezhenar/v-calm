import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PROGRAMS, getProgram, patternLabel } from '../app/js/programs.js';
import {
  buildTimeline,
  cycleCount,
  cycleLength,
  cycleScales,
  formatClock,
  stateAt,
  MIN_SCALE,
  MAX_SCALE,
} from '../app/js/timeline.js';

test('every program has the expected pattern', () => {
  const patterns = Object.fromEntries(PROGRAMS.map((p) => [p.id, patternLabel(p)]));
  assert.deepEqual(patterns, {
    relax: '4-6',
    balance: '4-2-4',
    restore: '5-5',
    focus: '4-4-4-4',
    energize: '4-2',
    unwind: '4-7-8',
    sigh: '2-1-6',
  });
});

test('physiological sigh: two nasal inhales, exhale twice as long as inhales', () => {
  const sigh = getProgram('sigh');
  assert.deepEqual(
    sigh.phases.map((p) => p.type),
    ['in', 'in2', 'out'],
  );
  const inhale = sigh.phases.filter((p) => p.type.startsWith('in')).reduce((s, p) => s + p.dur, 0);
  const exhale = sigh.phases.find((p) => p.type === 'out').dur;
  assert.equal(exhale, inhale * 2);
  assert.equal(sigh.defaultMinutes, 5);
});

test('every cycle ends on an exhale or an empty-lung hold', () => {
  for (const p of PROGRAMS) {
    const last = p.phases.at(-1).type;
    assert.ok(['out', 'holdOut'].includes(last), `${p.id} ends with ${last}`);
  }
});

test('cycle count rounds up so the session always finishes the breath', () => {
  const unwind = getProgram('unwind'); // 19 s cycle
  assert.equal(cycleLength(unwind), 19);
  assert.equal(cycleCount(unwind, 3), 10); // 180 / 19 = 9.47 → 10
  const relax = getProgram('relax'); // 10 s cycle
  assert.equal(cycleCount(relax, 3), 18); // exact, no extra cycle
  assert.equal(cycleCount(getProgram('sigh'), 5), 34); // 300 / 9 = 33.3 → 34
});

test('timeline totals and segment starts are contiguous', () => {
  for (const p of PROGRAMS) {
    for (const m of [2, 3, 4, 5]) {
      const tl = buildTimeline(p, m);
      assert.ok(tl.total >= m * 60, `${p.id} ${m}min too short`);
      assert.ok(tl.total < m * 60 + cycleLength(p), `${p.id} ${m}min too long`);
      let t = 0;
      for (const s of tl.segments) {
        assert.ok(Math.abs(s.start - t) < 1e-6, `${p.id} gap at ${t}`);
        t += s.dur;
      }
      assert.ok(Math.abs(t - tl.total) < 1e-6);
    }
  }
});

test('orb fills on inhales, stays on holds, empties on exhale', () => {
  const box = cycleScales(getProgram('focus').phases);
  assert.deepEqual(box, [
    { from: MIN_SCALE, to: MAX_SCALE },
    { from: MAX_SCALE, to: MAX_SCALE },
    { from: MAX_SCALE, to: MIN_SCALE },
    { from: MIN_SCALE, to: MIN_SCALE },
  ]);
  const sigh = cycleScales(getProgram('sigh').phases);
  assert.equal(sigh[0].from, MIN_SCALE);
  assert.ok(sigh[0].to > MIN_SCALE && sigh[0].to < MAX_SCALE, 'first inhale partially fills');
  assert.equal(sigh[1].to, MAX_SCALE, 'top-up fills completely');
  assert.equal(sigh[2].to, MIN_SCALE);
});

test('stateAt: lead-in, running and done', () => {
  const tl = buildTimeline(getProgram('unwind'), 2);
  const lead = stateAt(tl, -1.5);
  assert.equal(lead.status, 'lead');
  assert.equal(lead.phaseLeft, 2);

  const inhale = stateAt(tl, 1);
  assert.equal(inhale.segment.type, 'in');
  assert.equal(inhale.phaseLeft, 3);

  const hold = stateAt(tl, 4);
  assert.equal(hold.segment.type, 'hold');
  assert.equal(hold.scale, MAX_SCALE);

  const exhale = stateAt(tl, 11 + 4);
  assert.equal(exhale.segment.type, 'out');
  assert.ok(Math.abs(exhale.scale - (MIN_SCALE + MAX_SCALE) / 2) < 1e-9, 'half-way through exhale');

  assert.equal(stateAt(tl, 19).segment.cycle, 1);
  assert.equal(stateAt(tl, tl.total).status, 'done');
});

test('formatClock', () => {
  assert.equal(formatClock(190), '3:10');
  assert.equal(formatClock(59.2), '1:00');
  assert.equal(formatClock(0), '0:00');
  assert.equal(formatClock(-3), '0:00');
});
