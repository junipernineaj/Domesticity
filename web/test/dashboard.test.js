// Outstanding list and lenses (docs/adr/0007-multi-facet-categories.md).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { householdStats } from '../src/stats.js';
import { group, LENSES, outstanding } from '../src/outstanding.js';
import { seed } from '../src/seed.js';

const TODAY = '2026-11-02';
const lens = (id) => LENSES.find((l) => l.id === id);
const r = (over) => ({ paused: false, weekdays: [], tags: [], places: [], startDate: '2026-01-01', kind: 'interval', intervalDays: 7, ...over });

test('outstanding: overdue first, then by due day; paused and far-off routines excluded', () => {
  const routines = [
    r({ id: 'soon', title: 'Soon', intervalDays: 3 }),
    r({ id: 'late', title: 'Late', intervalDays: 7 }),
    r({ id: 'paused', title: 'Paused', paused: true }),
    r({ id: 'far', title: 'Far', intervalDays: 60 }),
  ];
  const completions = [
    { routineId: 'soon', doneOn: '2026-10-31', dueOn: '2026-10-31', skipped: false },
    { routineId: 'late', doneOn: '2026-10-20', dueOn: '2026-10-20', skipped: false },
    { routineId: 'far', doneOn: '2026-11-01', dueOn: '2026-11-01', skipped: false },
  ];
  const items = outstanding({ routines, completions, today: TODAY });
  assert.deepEqual(items.map((i) => i.routine.id), ['late', 'soon']);
  assert.equal(items[0].days, -6); // due 27 Oct
  assert.equal(items[1].days, 1);  // due 3 Nov
});

test('a routine with several tags appears under each category', () => {
  const routines = [r({ id: 'hoover', title: 'Hoover', tags: ['cleaning', 'floors'], places: [] })];
  const items = outstanding({ routines, completions: [], today: TODAY, horizonDays: 400 });
  const groups = group(items, lens('category'));
  assert.deepEqual(groups.map((g) => g.key).sort(), ['cleaning', 'floors']);
  assert.ok(groups.every((g) => g.items[0].routine.id === 'hoover'));
});

test('a routine across several places appears under each place', () => {
  const routines = [r({ id: 'hoover', title: 'Hoover', places: ['Kitchen', 'Hall'] })];
  const items = outstanding({ routines, completions: [], today: TODAY, horizonDays: 400 });
  assert.deepEqual(group(items, lens('place')).map((g) => g.key).sort(), ['Hall', 'Kitchen']);
});

test('untagged and unplaced routines get their own headings', () => {
  const routines = [r({ id: 'x', title: 'X' })];
  const items = outstanding({ routines, completions: [], today: TODAY, horizonDays: 400 });
  assert.deepEqual(group(items, lens('category')).map((g) => g.key), ['Untagged']);
  assert.deepEqual(group(items, lens('place')).map((g) => g.key), ['Anywhere']);
});

test('when lens orders overdue, today, tomorrow, then later', () => {
  const routines = [
    r({ id: 'a', title: 'A', intervalDays: 1 }),
    r({ id: 'b', title: 'B', intervalDays: 7 }),
    r({ id: 'c', title: 'C', intervalDays: 3 }),
  ];
  const completions = [
    { routineId: 'a', doneOn: '2026-11-01', dueOn: '2026-11-01', skipped: false }, // due 2 Nov: today
    { routineId: 'b', doneOn: '2026-10-20', dueOn: '2026-10-20', skipped: false }, // due 27 Oct: overdue
    { routineId: 'c', doneOn: '2026-11-01', dueOn: '2026-11-01', skipped: false }, // due 4 Nov: in 2 days
  ];
  const items = outstanding({ routines, completions, today: TODAY, horizonDays: 30 });
  assert.deepEqual(group(items, lens('when')).map((g) => g.key), ['Overdue', 'Today', 'In 2–7 days']);
});

test('person lens shows unassigned routines as Anyone', () => {
  const persons = new Map([['tony', { name: 'Tony' }]]);
  const routines = [r({ id: 'a', title: 'A', assigneeId: 'tony' }), r({ id: 'b', title: 'B' })];
  const items = outstanding({ routines, completions: [], today: TODAY, horizonDays: 400, persons });
  assert.deepEqual(group(items, lens('person')).map((g) => g.key).sort(), ['Anyone', 'Tony']);
});

test('household stats count routines overdue right now against the on-time rate', () => {
  const routines = [r({ id: 'a', title: 'A', intervalDays: 7 }), r({ id: 'b', title: 'B', intervalDays: 7 })];
  const completions = [
    { routineId: 'a', doneOn: '2026-10-20', dueOn: '2026-10-20', skipped: false }, // overdue now
    { routineId: 'b', doneOn: '2026-10-31', dueOn: '2026-10-31', skipped: false }, // on time
  ];
  const stats = householdStats(routines, completions, TODAY, 30);
  assert.equal(stats.done, 2);
  assert.equal(stats.overdueNow, 1);
  assert.equal(stats.onTimeRate, 2 / 3);
});

test('seed data gives a dashboard with overdue, due today and upcoming items', () => {
  const { persons, routines, completions } = seed(TODAY);
  const personMap = new Map(persons.map((p) => [p.id, p]));
  const items = outstanding({ routines, completions, today: TODAY, horizonDays: 7, persons: personMap });
  const whens = group(items, lens('when')).map((g) => g.key);
  assert.ok(whens.includes('Overdue'));
  assert.ok(whens.includes('Today'));
  assert.ok(items.length > 0);
});
