// Landing page counts and schedule wording.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { status } from '../src/status.js';
import { scheduleText } from '../src/describe.js';

const TODAY = '2026-11-02';
const r = (over) => ({ id: 'x', title: 'X', paused: false, weekdays: [], tags: [], places: [], startDate: '2026-01-01', kind: 'interval', intervalDays: 7, ...over });

test('status splits overdue, due today and coming up', () => {
  const routines = [
    r({ id: 'late', intervalDays: 7 }),      // last done 20 Oct: overdue
    r({ id: 'today', intervalDays: 3 }),     // last done 30 Oct: due 2 Nov
    r({ id: 'soon', intervalDays: 5 }),      // last done 31 Oct: due 5 Nov
    r({ id: 'far', intervalDays: 60 }),      // beyond 7 days: not counted
    r({ id: 'paused', paused: true }),       // paused: not counted
  ];
  const completions = [
    { routineId: 'late', doneOn: '2026-10-20', dueOn: '2026-10-20', skipped: false },
    { routineId: 'today', doneOn: '2026-10-30', dueOn: '2026-10-30', skipped: false },
    { routineId: 'soon', doneOn: '2026-10-31', dueOn: '2026-10-31', skipped: false },
    { routineId: 'far', doneOn: '2026-11-01', dueOn: '2026-11-01', skipped: false },
  ];
  const s = status({ routines, completions, today: TODAY });
  assert.deepEqual(s.overdue.map((i) => i.routine.id), ['late']);
  assert.deepEqual(s.dueToday.map((i) => i.routine.id), ['today']);
  assert.deepEqual(s.comingUp.map((i) => i.routine.id), ['soon']);
});

test('schedule wording for each kind', () => {
  assert.equal(scheduleText(r({ intervalDays: 1 })), 'Every day');
  assert.equal(scheduleText(r({ intervalDays: 7 })), 'Every week');
  assert.equal(scheduleText(r({ intervalDays: 14 })), 'Every 2 weeks');
  assert.equal(scheduleText(r({ intervalDays: 30 })), 'Every 30 days');
  assert.equal(scheduleText(r({ kind: 'weekly', weekdays: [4, 2] })), 'Every Mon, Wed');
  assert.equal(scheduleText(r({ kind: 'weekly', weekdays: [1, 2, 3, 4, 5, 6, 7] })), 'Every day');
  assert.equal(scheduleText(r({ kind: 'monthly', dayOfMonth: 1 })), 'Monthly on the 1st');
  assert.equal(scheduleText(r({ kind: 'monthly', dayOfMonth: 2 })), 'Monthly on the 2nd');
  assert.equal(scheduleText(r({ kind: 'monthly', dayOfMonth: 11 })), 'Monthly on the 11th');
  assert.equal(scheduleText(r({ kind: 'monthly', dayOfMonth: 31 })), 'Monthly on the 31st (or the last day in shorter months)');
});
