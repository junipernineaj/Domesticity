// Holiday plans (ADR-0015): the next date, booking, Outstanding, and the server's checks.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isBooked, nextOccurrence } from '../src/holidays.js';
import { outstanding } from '../src/outstanding.js';
import { openDatabase } from '../server/db.js';
import { activityPage, applySync, ensureSeeded, loadAll, ValidationError } from '../server/repo.js';

const christmas = { id: 'holiday-christmas', name: 'Christmas', targetMonth: 12, targetDay: 24, note: null, bookedFor: null };

test('a holiday falls next on its day, this year if still ahead, else next year', () => {
  assert.equal(nextOccurrence(christmas, '2026-11-02'), '2026-12-24');
  assert.equal(nextOccurrence(christmas, '2026-12-24'), '2026-12-24', 'today counts');
  assert.equal(nextOccurrence(christmas, '2026-12-25'), '2027-12-24');
});

test('a booking is for one occurrence, and lapses once that day has passed', () => {
  const booked = { ...christmas, bookedFor: '2026-12-24' };
  assert.equal(isBooked(booked, '2026-11-02'), true);
  assert.equal(isBooked(booked, '2026-12-25'), false, 'planned again for next year');
});

test('a planned holiday is on Outstanding inside the window, and a booked one is not', () => {
  const holidays = [christmas, { ...christmas, id: 'booked', bookedFor: '2026-12-24' }];
  const items = outstanding({ routines: [], completions: [], today: '2026-11-02', horizonDays: 60, holidays });
  assert.deepEqual(items.map((i) => i.routine.id), ['holiday:holiday-christmas']);
  assert.equal(items[0].dueOn, '2026-12-24');
  assert.equal(items[0].days, 52);
});

test('the server seeds the three holidays with their days', () => {
  const db = openDatabase(':memory:');
  ensureSeeded(db, '2026-11-02');
  const days = loadAll(db).holidays.map((h) => [h.name, h.targetMonth, h.targetDay]);
  assert.deepEqual(days, [["Tony's Birthday", 4, 26], ['Wedding Anniversary', 9, 11], ['Christmas', 12, 24]]);
});

test('a booking must be for the holiday\'s own day, and is logged', () => {
  const db = openDatabase(':memory:');
  ensureSeeded(db, '2026-11-02');
  const xmas = loadAll(db).holidays.find((h) => h.name === 'Christmas');
  assert.throws(() => applySync(db, [{ op: 'upsert', collection: 'holidays', item: { ...xmas, bookedFor: '2026-12-23' } }]), ValidationError);
  applySync(db, [{ op: 'upsert', collection: 'holidays', item: { ...xmas, bookedFor: '2026-12-24' } }]);
  assert.equal(activityPage(db, { limit: 1 }).items[0].text, 'Booked holiday: Christmas, 24 December 2026');
  applySync(db, [{ op: 'upsert', collection: 'holidays', item: { ...xmas, bookedFor: null } }]);
  assert.equal(activityPage(db, { limit: 1 }).items[0].text, 'Unbooked holiday: Christmas');
});

test('a holiday cannot fall on a day its month does not have', () => {
  const db = openDatabase(':memory:');
  ensureSeeded(db, '2026-11-02');
  assert.throws(() => applySync(db, [{ op: 'upsert', collection: 'holidays', item: { id: 'x', name: 'Nope', targetMonth: 4, targetDay: 31 } }]), ValidationError);
});
