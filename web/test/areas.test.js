// Self care and pets (ADR-0017): the area rule, the household setting, and what the log says about it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openDatabase } from '../server/db.js';
import { activityPage, applySync, ensureSeeded, loadAll, ValidationError } from '../server/repo.js';
import { visibleRoutines } from '../src/areas.js';

const fresh = () => {
  const db = openDatabase(':memory:');
  ensureSeeded(db, '2026-11-02');
  return db;
};

test('house routines always show; self care and pets show only when on', () => {
  const routines = [{ id: 'bins', area: 'house' }, { id: 'teeth', area: 'care' }, { id: 'old' }];
  assert.deepEqual(visibleRoutines(routines, false).map((r) => r.id), ['bins', 'old']);
  assert.deepEqual(visibleRoutines(routines, true).map((r) => r.id), ['bins', 'teeth', 'old']);
});

test('the household setting starts off and can be switched on and off', () => {
  const db = fresh();
  assert.deepEqual(loadAll(db).settings, [{ id: 'household', selfCare: false }]);
  applySync(db, [{ op: 'upsert', collection: 'settings', item: { id: 'household', selfCare: true } }]);
  assert.equal(loadAll(db).settings[0].selfCare, true);
});

test('there is only one settings row, and its flag must be a boolean', () => {
  const db = fresh();
  assert.throws(() => applySync(db, [{ op: 'upsert', collection: 'settings', item: { id: 'other', selfCare: true } }]), ValidationError);
  assert.throws(() => applySync(db, [{ op: 'upsert', collection: 'settings', item: { id: 'household', selfCare: 'yes' } }]), ValidationError);
});

test('a routine is in the house or in self care and pets, and nothing else', () => {
  const db = fresh();
  const routine = (area) => ({
    id: `r-${area}`, title: 'Brush teeth', kind: 'interval', intervalDays: 1, weekdays: [], dayOfMonth: 1,
    startDate: '2026-10-01', paused: false, places: [], tags: [], assigneeId: null, area,
  });
  applySync(db, [{ op: 'upsert', collection: 'routines', item: routine('care') }]);
  assert.equal(loadAll(db).routines.find((r) => r.id === 'r-care').area, 'care');
  assert.throws(() => applySync(db, [{ op: 'upsert', collection: 'routines', item: routine('garden') }]), ValidationError);
});

test('switching self care and pets on and off is recorded in the activity log', () => {
  const db = fresh();
  applySync(db, [{ op: 'upsert', collection: 'settings', item: { id: 'household', selfCare: true } }]);
  applySync(db, [{ op: 'upsert', collection: 'settings', item: { id: 'household', selfCare: false } }]);
  const texts = activityPage(db, { limit: 50 }).items.map((e) => e.text);
  assert.ok(texts.includes('Turned on self care and pets'));
  assert.ok(texts.includes('Turned off self care and pets'));
});
