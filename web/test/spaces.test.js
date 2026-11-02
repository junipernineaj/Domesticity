// Spaces and things: targeted routines expand to one task per thing.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { expandRoutines } from '../src/spaces.js';
import { nextDue, completionsFor } from '../src/schedule.js';

const spaces = [{ id: 'bath', name: 'Bathroom' }, { id: 'loo', name: 'Downstairs loo' }, { id: 'car', name: 'Car' }];
const things = [
  { id: 't1', spaceId: 'bath', type: 'Toilet' },
  { id: 't2', spaceId: 'loo', type: 'Toilet' },
  { id: 't3', spaceId: 'car', type: 'Dashboard' },
];
const clean = { id: 'toilet', title: 'Clean the toilet', kind: 'interval', intervalDays: 7, startDate: '2026-01-01', tags: ['cleaning'], places: [], weekdays: [], paused: false, targetType: 'Toilet' };
const bins = { id: 'bins', title: 'Take the bins out', kind: 'interval', intervalDays: 7, startDate: '2026-01-01', tags: [], places: ['Kitchen'], weekdays: [], paused: false };

test('a routine without a target passes through unchanged', () => {
  const out = expandRoutines([bins], spaces, things);
  assert.deepEqual(out, [bins]);
});

test('a targeted routine expands to one routine per matching thing, with its space named', () => {
  const out = expandRoutines([clean], spaces, things);
  assert.deepEqual(out.map((r) => r.id), ['toilet@t1', 'toilet@t2']);
  assert.deepEqual(out.map((r) => r.title), ['Clean the toilet · Bathroom', 'Clean the toilet · Downstairs loo']);
  assert.deepEqual(out.map((r) => r.places), [['Bathroom'], ['Downstairs loo']]);
  assert.ok(out.every((r) => r.baseId === 'toilet'));
});

test('matching ignores case and spaces around the type', () => {
  const out = expandRoutines([{ ...clean, targetType: '  toilet ' }], spaces, things);
  assert.equal(out.length, 2);
});

test('a targeted routine with no matching things produces nothing', () => {
  const out = expandRoutines([{ ...clean, targetType: 'Oven' }], spaces, things);
  assert.deepEqual(out, []);
});

test('each expanded task keeps its own history', () => {
  const out = expandRoutines([clean], spaces, things);
  const completions = [
    { routineId: 'toilet@t1', doneOn: '2026-10-30', dueOn: '2026-10-30', skipped: false },
  ];
  const bathroom = out.find((r) => r.thingId === 't1');
  const downstairs = out.find((r) => r.thingId === 't2');
  assert.equal(nextDue(bathroom, completionsFor(completions, bathroom.id)), '2026-11-06');
  // No history for the downstairs toilet, so it is still due from its start date.
  assert.equal(nextDue(downstairs, completionsFor(completions, downstairs.id)), '2026-01-01');
});
