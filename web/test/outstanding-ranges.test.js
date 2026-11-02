// The longer-range windows on the Cadence tab: which items they hold.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { inRange, LONG_RANGES } from '../src/outstanding.js';

const item = (id, dueOn, days) => ({ routine: { id }, dueOn, days });

test('next quarter holds 31 to 91 days out, and next year holds 92 to 365', () => {
  const items = [item('soon', '2026-11-20', 18), item('edge30', '2026-12-02', 30), item('q1', '2026-12-03', 31),
    item('q-end', '2027-02-01', 91), item('y1', '2027-02-02', 92), item('y-end', '2027-11-02', 365), item('beyond', '2027-11-03', 366)];
  const q = LONG_RANGES['next-quarter'];
  const y = LONG_RANGES['next-year'];
  assert.deepEqual(inRange(items, q.min, q.max).map((i) => i.routine.id), ['q1', 'q-end']);
  assert.deepEqual(inRange(items, y.min, y.max).map((i) => i.routine.id), ['y1', 'y-end']);
});
