// Golden cases for SPEC.md section 5. Each expectation was worked out by hand
// from the rule, not copied from the code. Dates: 2026-11-02 is a Monday.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addDays, daysInMonth, weekday } from '../src/dates.js';
import { monthlySlot, nextDue, onTimeRate, streak, daysUntilDue } from '../src/schedule.js';

const TODAY = '2026-11-02';

const interval = (over = {}) => ({ id: 'r', title: 't', kind: 'interval', intervalDays: 7, startDate: '2026-10-01', weekdays: [], paused: false, ...over });
const weekly = (over = {}) => ({ id: 'r', title: 't', kind: 'weekly', weekdays: [], startDate: '2026-11-02', paused: false, ...over });
const monthly = (over = {}) => ({ id: 'r', title: 't', kind: 'monthly', dayOfMonth: 1, startDate: '2026-11-01', paused: false, ...over });
const done = (doneOn, dueOn = doneOn, extra = {}) => ({ routineId: 'r', doneOn, dueOn, skipped: false, ...extra });

test('calendar helpers: weekday numbering and month lengths', () => {
  assert.equal(weekday('2026-11-02'), 2, 'Monday');
  assert.equal(weekday('2026-11-01'), 1, 'Sunday');
  assert.equal(daysInMonth(2027, 2), 28);
  assert.equal(daysInMonth(2028, 2), 29);
  assert.equal(addDays('2026-12-31', 1), '2027-01-01');
});

test('every N days: no completions means due on the start date', () => {
  assert.equal(nextDue(interval(), []), '2026-10-01');
});

test('every N days: a late completion counts from the day it was done, no backlog', () => {
  const completions = [done('2026-10-10', '2026-10-08')];
  assert.equal(nextDue(interval(), completions), '2026-10-17');
});

test('every N days: a skip still moves the routine on', () => {
  const completions = [done('2026-10-20', '2026-10-20', { skipped: true })];
  assert.equal(nextDue(interval(), completions), '2026-10-27');
});

test('weekly: completing on the due day moves to the next chosen weekday', () => {
  // Due Monday and Wednesday. Done Monday, so next is Wednesday.
  const routine = weekly({ weekdays: [2, 4] });
  assert.equal(nextDue(routine, []), '2026-11-02');
  assert.equal(nextDue(routine, [done('2026-11-02')]), '2026-11-04');
});

test('weekly: doing Monday\'s job on Sunday counts for Monday', () => {
  const routine = weekly({ weekdays: [2, 4] });
  assert.equal(nextDue(routine, [done('2026-11-01', '2026-11-02')]), '2026-11-04');
});

test('weekly: with no weekdays chosen, uses the start date\'s weekday', () => {
  assert.equal(nextDue(weekly({ weekdays: [] }), []), '2026-11-02');
});

test('monthly: a day past the month end falls back to the last day', () => {
  assert.equal(monthlySlot('2027-02-01', 31), '2027-02-28');
  assert.equal(monthlySlot('2028-02-01', 29), '2028-02-29', 'leap year');
});

test('monthly: a late completion covers its slot, the next one is the following month', () => {
  const routine = monthly({ dayOfMonth: 1 });
  const completions = [done('2027-03-05', '2027-03-01')];
  assert.equal(nextDue(routine, completions), '2027-04-01');
});

test('overdue routines have a streak of zero', () => {
  const routine = interval();
  const completions = [done('2026-10-20')];
  assert.ok(daysUntilDue(routine, completions, TODAY) < 0);
  assert.equal(streak(routine, completions, TODAY), 0);
});

test('a skip does not break a streak; a late completion does', () => {
  const routine = interval();
  const completions = [
    done('2026-10-30', '2026-10-30'),
    done('2026-10-23', '2026-10-23', { skipped: true }),
    done('2026-10-16', '2026-10-16'),
    done('2026-10-12', '2026-10-09'), // late: breaks the streak
  ];
  assert.equal(streak(routine, completions, TODAY), 2);
});

test('on-time rate ignores skips', () => {
  const completions = [
    done('2026-10-01', '2026-10-01'),
    done('2026-10-08', '2026-10-08'),
    done('2026-10-15', '2026-10-10'), // late
    done('2026-10-22', '2026-10-22', { skipped: true }),
  ];
  assert.equal(onTimeRate(completions), 2 / 3);
});

test('a paused routine that is overdue keeps its streak (the pause is what stops it counting)', () => {
  // Paused means it is left out of Today and the stats. The streak itself is still
  // computed from its history, so an overdue paused routine is not forced to zero.
  const routine = interval({ paused: true });
  assert.equal(streak(routine, [done('2026-10-20')], TODAY), 1);
});
