// Golden cases for SPEC.md section 5.11 (renewals, ADR-0014). Expectations were worked out by
// hand from the rule. Dates: 2026-11-02 is a Monday.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nextDue } from '../src/schedule.js';
import { outstanding } from '../src/outstanding.js';
import { scheduleText } from '../src/describe.js';

const renewal = (over = {}) => ({ id: 'r', title: 'Car insurance', kind: 'renewal', everyMonths: 12, leadDays: 30, startDate: '2026-03-14', paused: false, ...over });
const done = (doneOn, dueOn = doneOn) => ({ routineId: 'r', doneOn, dueOn, skipped: false });

test('a renewal with no completions is due on its set date', () => {
  assert.equal(nextDue(renewal({ everyMonths: 6 }), []), '2026-03-14');
});

test('every 6 months from 14 March: March, then September', () => {
  const r = renewal({ everyMonths: 6 });
  assert.equal(nextDue(r, [done('2026-03-14')]), '2026-09-14');
  assert.equal(nextDue(r, [done('2026-09-14')]), '2027-03-14');
});

test('early completion counts from the due date, not the day it was done', () => {
  const r = renewal({ everyMonths: 6 });
  assert.equal(nextDue(r, [done('2026-09-01', '2026-09-14')]), '2027-03-14');
});

test('late completion moves the next renewal from the day it was actually done', () => {
  const r = renewal({ everyMonths: 6 });
  assert.equal(nextDue(r, [done('2026-09-20', '2026-09-14')]), '2027-03-14');
});

test('every 3 months from 31 January falls back to the month end in short months', () => {
  const r = renewal({ everyMonths: 3, startDate: '2026-01-31' });
  assert.equal(nextDue(r, []), '2026-01-31');
  assert.equal(nextDue(r, [done('2026-01-31')]), '2026-04-30', 'April has 30 days');
  assert.equal(nextDue(r, [done('2026-04-30')]), '2026-07-31');
});

test('a renewal set on 29 February falls back to 28 February in other years', () => {
  const r = renewal({ everyMonths: 12, startDate: '2028-02-29' });
  assert.equal(nextDue(r, []), '2028-02-29');
  assert.equal(nextDue(r, [done('2028-02-29')]), '2029-02-28');
  assert.equal(nextDue(r, [done('2029-02-28')]), '2030-02-28');
});

test('yearly renewal: a late payment moves the next one a full year from the day paid', () => {
  const r = renewal({ everyMonths: 12 });
  assert.equal(nextDue(r, [done('2027-03-20', '2027-03-14')]), '2028-03-14');
});

test('the set date is kept even after the renewal is paid late', () => {
  const r = renewal({ everyMonths: 3 });
  assert.equal(nextDue(r, [done('2026-06-20', '2026-06-14')]), '2026-09-14', 'stays on the 14th');
});

test('a renewal shows on Outstanding inside its lead time, even past a 7-day horizon', () => {
  const today = '2026-11-02';
  const inside = renewal({ startDate: '2026-11-20', leadDays: 30 });  // 18 days away, lead time 30
  const outside = renewal({ id: 'far', startDate: '2027-01-15', leadDays: 30 });  // 74 days away
  const plainInterval = { id: 'plain', title: 'Plain', kind: 'interval', intervalDays: 365, startDate: '2026-11-20', paused: false };
  const items = outstanding({ routines: [inside, outside, plainInterval].map((r) => ({ ...r, tags: [], places: [] })), completions: [], today, horizonDays: 7 });
  assert.deepEqual(items.map((i) => i.routine.id), ['r'], 'only the renewal inside its lead time');
});

test('the schedule wording names the repeat and the set date', () => {
  assert.equal(scheduleText(renewal({ everyMonths: 12, startDate: '2026-03-14' })), 'Yearly, on 14th March');
  assert.equal(scheduleText(renewal({ everyMonths: 6, startDate: '2026-09-02' })), 'Twice a year, on 2nd September');
  assert.equal(scheduleText(renewal({ everyMonths: 3, startDate: '2026-01-31' })), 'Every 3 months, on 31st January');
});
