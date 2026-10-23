import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addPractice, computeStats, dayKey, MIN_SECONDS } from '../app/js/streaks.js';

const at = (iso) => new Date(`${iso}T12:00:00`);

function practice(days, list) {
  return list.reduce((d, [iso, sec]) => addPractice(d, at(iso), sec), days);
}

test('dayKey uses the local calendar day', () => {
  assert.equal(dayKey(new Date(2026, 9, 23, 23, 59)), '2026-10-23');
  assert.equal(dayKey(new Date(2026, 0, 5, 0, 1)), '2026-01-05');
});

test('empty history', () => {
  const s = computeStats({}, at('2026-10-23'));
  assert.deepEqual(s, { current: 0, longest: 0, todayDone: false, todaySeconds: 0, totalMinutes: 0, sessions: 0 });
});

test('consecutive days build a streak, including today', () => {
  const days = practice({}, [
    ['2026-10-21', 180],
    ['2026-10-22', 180],
    ['2026-10-23', 180],
  ]);
  const s = computeStats(days, at('2026-10-23'));
  assert.equal(s.current, 3);
  assert.equal(s.longest, 3);
  assert.equal(s.todayDone, true);
});

test('streak stays alive until today is over', () => {
  const days = practice({}, [
    ['2026-10-21', 180],
    ['2026-10-22', 180],
  ]);
  assert.equal(computeStats(days, at('2026-10-23')).current, 2);
  assert.equal(computeStats(days, at('2026-10-24')).current, 0);
});

test('short sessions add up within a day', () => {
  let days = practice({}, [['2026-10-23', 70]]);
  assert.equal(computeStats(days, at('2026-10-23')).todayDone, false);
  days = practice(days, [['2026-10-23', 60]]);
  const s = computeStats(days, at('2026-10-23'));
  assert.equal(s.todayDone, true);
  assert.equal(s.todaySeconds, 130);
  assert.equal(s.sessions, 2);
  assert.ok(130 >= MIN_SECONDS);
});

test('longest streak survives a gap; DST changes do not break days', () => {
  const days = practice({}, [
    ['2026-03-27', 300],
    ['2026-03-28', 300],
    ['2026-03-29', 300], // EU DST starts
    ['2026-03-30', 300],
    ['2026-04-02', 300],
  ]);
  const s = computeStats(days, at('2026-04-02'));
  assert.equal(s.longest, 4);
  assert.equal(s.current, 1);
  assert.equal(s.totalMinutes, 25);
});

test('addPractice is immutable and ignores zero', () => {
  const a = {};
  const b = addPractice(a, at('2026-10-23'), 120);
  assert.deepEqual(a, {});
  assert.equal(addPractice(b, at('2026-10-23'), 0), b);
});
