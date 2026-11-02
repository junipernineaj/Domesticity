// The calendar (SPEC 6.12, ADR-0016): projected due dates, load levels, holidays, month layout.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildCalendar, loadLevel, monthsInRange, projectDue } from '../src/calendar.js';

const TODAY = '2026-11-02'; // a Monday

const weekly = (over = {}) => ({ id: 'w', title: 'Weekly', kind: 'weekly', weekdays: [2], startDate: TODAY, paused: false, ...over });
const interval = (over = {}) => ({ id: 'i', title: 'Every 3', kind: 'interval', intervalDays: 3, startDate: TODAY, paused: false, ...over });

test('a weekly routine projects each chosen weekday through the range', () => {
  assert.deepEqual(projectDue(weekly(), [], TODAY, '2026-11-20'), ['2026-11-02', '2026-11-09', '2026-11-16']);
});

test('an every-N-days routine projects N days apart', () => {
  assert.deepEqual(projectDue(interval(), [], TODAY, '2026-11-10'), ['2026-11-02', '2026-11-05', '2026-11-08']);
});

test('an overdue routine lands on today once, then the forecast carries on from today', () => {
  const overdue = interval({ startDate: '2026-10-20' });
  assert.deepEqual(projectDue(overdue, [], TODAY, '2026-11-08'), ['2026-11-02', '2026-11-05', '2026-11-08']);
});

test('a paused routine adds nothing', () => {
  const cal = buildCalendar({ routines: [weekly({ paused: true })], completions: [], holidays: [], today: TODAY, days: 14 });
  assert.equal(cal.size, 0);
});

test('load is the number of tasks on a day, and a booked holiday counts as one', () => {
  const routines = [weekly({ id: 'a', title: 'A' }), weekly({ id: 'b', title: 'B' })];
  const holidays = [{ id: 'xmas', name: 'Christmas', targetMonth: 12, targetDay: 24, note: null, bookedFor: '2026-12-24' }];
  const cal = buildCalendar({ routines, completions: [], holidays, today: TODAY, days: 60 });
  assert.equal(cal.get('2026-11-02').length, 2);
  assert.deepEqual(cal.get('2026-12-24'), [{ title: 'Christmas', kind: 'holiday' }]);
});

test('a planned holiday is not load, and only the booked one shows', () => {
  const holidays = [{ id: 'xmas', name: 'Christmas', targetMonth: 12, targetDay: 24, note: null, bookedFor: null }];
  const cal = buildCalendar({ routines: [], completions: [], holidays, today: TODAY, days: 60 });
  assert.equal(cal.size, 0);
});

test('load levels follow SPEC 6.12: 0 free, 1 to 2, 3 to 4, 5 or more', () => {
  assert.deepEqual([0, 1, 2, 3, 4, 5, 9].map(loadLevel), ['free', 'light', 'light', 'busy', 'busy', 'heavy', 'heavy']);
});

test('months start on the right weekday, Monday first, and cover the whole range', () => {
  const months = monthsInRange(TODAY, 60);
  assert.deepEqual([months[0].year, months[0].month], [2026, 11]);
  // 1 November 2026 is a Sunday, so the first week has six blanks before it.
  assert.deepEqual(months[0].weeks[0], [null, null, null, null, null, null, null]);
  assert.equal(months[0].weeks[0].length, 7);
  assert.equal(months[0].weeks[0][0], null);
  assert.equal(months[0].weeks[1][0], '2026-11-02');
  assert.deepEqual([months[1].year, months[1].month], [2026, 12]);
});
