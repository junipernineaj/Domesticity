// Storage: migrations, seeding, validation, and the write rules (ADR-0011).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openDatabase } from '../server/db.js';
import { activityPage, applySync, ConflictError, ensureSeeded, loadAll, ValidationError } from '../server/repo.js';

const fresh = () => {
  const db = openDatabase(':memory:');
  ensureSeeded(db, '2026-11-02');
  return db;
};

const routine = (over = {}) => ({
  id: 'bins', title: 'Take the bins out', kind: 'interval', intervalDays: 7, weekdays: [], dayOfMonth: 1,
  startDate: '2026-10-01', paused: false, places: ['Kitchen'], tags: ['routine'], targetType: undefined,
  assigneeId: null, description: undefined, ...over,
});

test('the first use seeds the starter data, and only once', () => {
  const db = openDatabase(':memory:');
  assert.equal(ensureSeeded(db, '2026-11-02'), true);
  const first = loadAll(db);
  assert.ok(first.routines.length > 0);
  assert.equal(ensureSeeded(db, '2026-11-02'), false);
  assert.equal(loadAll(db).routines.length, first.routines.length);
});

test('starter data is not brought back after everything is deleted', () => {
  const db = fresh();
  const all = loadAll(db);
  const ops = [
    ...all.completions.map((c) => ({ op: 'delete', collection: 'completions', id: c.id })),
    ...all.routines.map((r) => ({ op: 'delete', collection: 'routines', id: r.id })),
  ];
  applySync(db, ops);
  assert.equal(loadAll(db).routines.length, 0);
  assert.equal(ensureSeeded(db, '2026-11-02'), false);
  assert.equal(loadAll(db).routines.length, 0);
});

test('a routine round-trips with its tags and places, and edits replace them', () => {
  const db = fresh();
  applySync(db, [{ op: 'upsert', collection: 'routines', item: routine({ id: 'x1', tags: ['a', 'b'], places: ['Hall'] }) }]);
  let r = loadAll(db).routines.find((x) => x.id === 'x1');
  assert.deepEqual(r.tags, ['a', 'b']);
  assert.deepEqual(r.places, ['Hall']);
  assert.equal(r.paused, false);

  applySync(db, [{ op: 'upsert', collection: 'routines', item: routine({ id: 'x1', tags: ['c'], places: [], paused: true }) }]);
  r = loadAll(db).routines.find((x) => x.id === 'x1');
  assert.deepEqual(r.tags, ['c']);
  assert.deepEqual(r.places, []);
  assert.equal(r.paused, true);
});

test('a completion for an expanded task keeps its routine and thing, and comes back in the same form', () => {
  const db = fresh();
  applySync(db, [{ op: 'upsert', collection: 'completions', item: {
    id: 'c-test', routineId: 'toilet@t-toilet-bathroom', doneOn: '2026-11-01', dueOn: '2026-11-01', skipped: false, personId: null,
  } }]);
  const c = loadAll(db).completions.find((x) => x.id === 'c-test');
  assert.equal(c.routineId, 'toilet@t-toilet-bathroom');
  assert.equal(c.skipped, false);
});

test('a routine with history cannot be deleted on its own', () => {
  const db = fresh();
  applySync(db, [{ op: 'upsert', collection: 'routines', item: routine({ id: 'x2' }) }, { op: 'upsert', collection: 'completions', item: {
    id: 'c2', routineId: 'x2', doneOn: '2026-11-01', dueOn: '2026-11-01', skipped: false, personId: null,
  } }]);
  assert.throws(() => applySync(db, [{ op: 'delete', collection: 'routines', id: 'x2' }]), ConflictError);
  assert.ok(loadAll(db).routines.some((x) => x.id === 'x2'), 'the routine is still there');
});

test('history first, then the routine, deletes cleanly', () => {
  const db = fresh();
  applySync(db, [{ op: 'upsert', collection: 'routines', item: routine({ id: 'x3' }) }, { op: 'upsert', collection: 'completions', item: {
    id: 'c3', routineId: 'x3', doneOn: '2026-11-01', dueOn: '2026-11-01', skipped: false, personId: null,
  } }]);
  applySync(db, [
    { op: 'delete', collection: 'completions', id: 'c3' },
    { op: 'delete', collection: 'routines', id: 'x3' },
  ]);
  assert.ok(!loadAll(db).routines.some((x) => x.id === 'x3'));
});

test('a bad change rejects the whole sync, and nothing is written', () => {
  const db = fresh();
  const before = loadAll(db).routines.length;
  assert.throws(() => applySync(db, [
    { op: 'upsert', collection: 'routines', item: routine({ id: 'good' }) },
    { op: 'upsert', collection: 'routines', item: routine({ id: 'bad', kind: 'yearly' }) },
  ]), ValidationError);
  assert.equal(loadAll(db).routines.length, before);
});

test('values are checked: dates, ranges, weekdays and lengths', () => {
  const db = fresh();
  const reject = (item) => assert.throws(
    () => applySync(db, [{ op: 'upsert', collection: 'routines', item }]), ValidationError);
  reject(routine({ startDate: '01/10/2026' }));
  reject(routine({ intervalDays: 0 }));
  reject(routine({ dayOfMonth: 32 }));
  reject(routine({ weekdays: [9] }));
  reject(routine({ title: 'x'.repeat(81) }));
  reject(routine({ kind: 'yearly' }));
  reject(routine({ paused: 'yes' }));
});

test('unknown collections and operations are refused', () => {
  const db = fresh();
  assert.throws(() => applySync(db, [{ op: 'upsert', collection: 'users', item: {} }]), ValidationError);
  assert.throws(() => applySync(db, [{ op: 'truncate', collection: 'routines' }]), ValidationError);
});

// Phase 2 (ADR-0012): snags, nice to haves, reopen, and the activity log.

const snagItem = (over = {}) => ({
  id: 's1', kind: 'snag', title: 'Tap dripping', spaceId: null, addedOn: '2026-11-01', doneOn: null,
  severity: 'soon', rag: 'amber', assignee: 'household', cost: null, effort: null, ...over,
});
const niceItem = (over = {}) => ({
  id: 'n1', kind: 'nice', title: 'Curtains', spaceId: null, addedOn: '2026-11-01', doneOn: null,
  severity: null, rag: null, assignee: null, cost: 2, effort: 4, ...over,
});

test('a snag needs severity, urgency and assignee; a nice to have must not have them', () => {
  const db = fresh();
  const reject = (item) => assert.throws(() => applySync(db, [{ op: 'upsert', collection: 'issues', item }]), ValidationError);
  reject(snagItem({ severity: undefined }));
  reject(snagItem({ rag: 'purple' }));
  reject(snagItem({ assignee: 'landlord' }));
  reject(snagItem({ cost: 3 }));
  reject(niceItem({ rag: 'red' }));
  reject(niceItem({ severity: 'unsafe' }));
  reject(niceItem({ cost: 6 }));
  reject(niceItem({ effort: 0 }));
  applySync(db, [{ op: 'upsert', collection: 'issues', item: snagItem() }, { op: 'upsert', collection: 'issues', item: niceItem({ cost: null, effort: null }) }]);
  const data = loadAll(db);
  assert.equal(data.issues.find((i) => i.id === 's1').rag, 'amber');
});

test('closing and reopening an item are both recorded, and the item comes back open', () => {
  const db = fresh();
  applySync(db, [{ op: 'upsert', collection: 'issues', item: snagItem({ id: 'r1', title: 'Gutter' }) }]);
  applySync(db, [{ op: 'upsert', collection: 'issues', item: snagItem({ id: 'r1', title: 'Gutter', doneOn: '2026-11-02' }) }]);
  applySync(db, [{ op: 'upsert', collection: 'issues', item: snagItem({ id: 'r1', title: 'Gutter', doneOn: null }) }]);
  assert.equal(loadAll(db).issues.find((i) => i.id === 'r1').doneOn, null);
  const texts = activityTexts(db).filter((t) => t.includes('Gutter'));
  assert.deepEqual(texts, ['Reopened snag: Gutter', 'Closed snag: Gutter', 'Added snag: Gutter']);
});

test('the activity log records what was done, with the space for a task in a space', () => {
  const db = fresh();
  applySync(db, [{ op: 'upsert', collection: 'completions', item: {
    id: 'cx', routineId: 'toilet@t-toilet-downstairs', doneOn: '2026-11-02', dueOn: '2026-11-02', skipped: false, personId: null,
  } }]);
  assert.ok(activityTexts(db).includes('Did Clean the toilet · Downstairs loo'));
});

test('seeding writes nothing to the activity log', () => {
  const db = fresh();
  assert.equal(activityTexts(db).length, 0);
});

test('deleting a routine is recorded; the log is newest first and never shrinks', () => {
  const db = fresh();
  applySync(db, [{ op: 'upsert', collection: 'routines', item: routine({ id: 'gone', title: 'Gone soon' }) }]);
  applySync(db, [{ op: 'delete', collection: 'routines', id: 'gone' }]);
  const page = activityPage(db, { limit: 5 });
  assert.equal(page.items[0].text, 'Deleted routine: Gone soon');
  assert.equal(page.items[1].text, 'Added routine: Gone soon');
  const all = activityPage(db, { limit: 500 }).items.length;
  assert.ok(all >= 2);
});

test('the activity log pages from the newest entry backwards', () => {
  const db = fresh();
  for (let i = 0; i < 5; i += 1) {
    applySync(db, [{ op: 'upsert', collection: 'spaces', item: { id: `sp${i}`, name: `Space ${i}` } }]);
  }
  const first = activityPage(db, { limit: 2 });
  assert.deepEqual(first.items.map((e) => e.text), ['Added space: Space 4', 'Added space: Space 3']);
  const second = activityPage(db, { before: first.next, limit: 2 });
  assert.deepEqual(second.items.map((e) => e.text), ['Added space: Space 2', 'Added space: Space 1']);
});

function activityTexts(db) {
  return activityPage(db, { limit: 500 }).items.map((e) => e.text).reverse().reverse();
}
