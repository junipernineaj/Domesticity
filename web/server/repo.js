// Reads and writes Domesticity data. Every write is validated first, then applied in one
// transaction, so a sync either lands whole or not at all. See ADR-0011.
import { seed } from '../src/seed.js';
import { todayIn } from '../src/dates.js';

export const COLLECTIONS = ['persons', 'spaces', 'things', 'routines', 'issues', 'completions'];
const MAX_OPS = 500;

export class ValidationError extends Error {}
export class ConflictError extends Error {}

const fail = (message) => {
  throw new ValidationError(message);
};

const isDate = (v) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);

function idOf(v, field) {
  if (typeof v !== 'string' || v.length < 1 || v.length > 120) fail(`${field} must be an id`);
  return v;
}

const idOrNull = (v, field) => (v == null || v === '' ? null : idOf(v, field));

function str(v, field, max, { optional = false } = {}) {
  if (v == null || v === '') {
    if (optional) return null;
    fail(`${field} is required`);
  }
  if (typeof v !== 'string' || v.trim() === '' || v.length > max) fail(`${field} must be 1 to ${max} characters`);
  return v.trim();
}

function date(v, field) {
  if (!isDate(v)) fail(`${field} must be a date as YYYY-MM-DD`);
  return v;
}

function dateOrNull(v, field) {
  return v == null ? null : date(v, field);
}

function bool01(v, field) {
  if (typeof v !== 'boolean') fail(`${field} must be true or false`);
  return v ? 1 : 0;
}

function oneOf(v, list, field) {
  if (!list.includes(v)) fail(`${field} must be one of ${list.join(', ')}`);
  return v;
}

function intOrNull(v, min, max, field) {
  if (v == null) return null;
  if (!Number.isInteger(v) || v < min || v > max) fail(`${field} must be a whole number from ${min} to ${max}`);
  return v;
}

function listOf(v, field, max) {
  if (v == null) return [];
  if (!Array.isArray(v)) fail(`${field} must be a list`);
  return [...new Set(v.map((x) => str(x, field, max)))];
}

function weekdaysOf(v) {
  if (v == null) return '';
  if (!Array.isArray(v) || v.some((d) => !Number.isInteger(d) || d < 1 || d > 7)) {
    fail('weekdays must be a list of numbers 1 (Sunday) to 7 (Saturday)');
  }
  return [...new Set(v)].sort((a, b) => a - b).join(',');
}

// Each validator turns a browser item into the table row(s) to store.
const VALIDATORS = {
  persons: (item) => ({
    row: { id: idOf(item.id, 'person id'), name: str(item.name, 'name', 60) },
  }),

  spaces: (item) => ({
    row: { id: idOf(item.id, 'space id'), name: str(item.name, 'space name', 60) },
  }),

  things: (item) => ({
    row: {
      id: idOf(item.id, 'thing id'),
      space_id: idOf(item.spaceId, 'space'),
      type: str(item.type, 'type', 40),
    },
  }),

  routines: (item) => ({
    row: {
      id: idOf(item.id, 'routine id'),
      title: str(item.title, 'title', 80),
      kind: oneOf(item.kind, ['interval', 'weekly', 'monthly'], 'kind'),
      interval_days: intOrNull(item.intervalDays, 1, 365, 'every how many days'),
      day_of_month: intOrNull(item.dayOfMonth, 1, 31, 'day of the month'),
      weekdays: weekdaysOf(item.weekdays),
      start_date: date(item.startDate, 'start date'),
      paused: bool01(item.paused ?? false, 'paused'),
      target_type: str(item.targetType, 'target type', 40, { optional: true }),
      assignee_id: idOrNull(item.assigneeId, 'assignee'),
      description: str(item.description, 'description', 500, { optional: true }),
    },
    tags: listOf(item.tags, 'tags', 40),
    places: listOf(item.places, 'places', 40),
  }),

  issues: (item) => ({
    row: {
      id: idOf(item.id, 'issue id'),
      kind: oneOf(item.kind, ['snag', 'nice'], 'kind'),
      title: str(item.title, 'title', 120),
      space_id: idOrNull(item.spaceId, 'space'),
      added_on: date(item.addedOn, 'added date'),
      done_on: dateOrNull(item.doneOn, 'done date'),
    },
  }),

  // A completion's routineId may be 'routine@thing' for a task expanded from a targeted routine.
  completions: (item) => {
    const raw = idOf(item.routineId, 'routine');
    const at = raw.indexOf('@');
    const routineId = at < 0 ? raw : raw.slice(0, at);
    const thingId = at < 0 ? null : raw.slice(at + 1);
    if (thingId === '') fail('routine must not end in @');
    return {
      row: {
        id: idOf(item.id, 'completion id'),
        routine_id: routineId,
        thing_id: thingId,
        done_on: date(item.doneOn, 'done date'),
        due_on: date(item.dueOn, 'due date'),
        skipped: bool01(item.skipped, 'skipped'),
        person_id: idOrNull(item.personId, 'person'),
      },
    };
  },
};

function transaction(db, fn) {
  db.exec('BEGIN IMMEDIATE');
  try {
    const result = fn();
    db.exec('COMMIT');
    return result;
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

function upsertRow(db, table, row) {
  const cols = Object.keys(row);
  const updates = cols.filter((c) => c !== 'id').map((c) => `${c} = excluded.${c}`).join(', ');
  db.prepare(
    `INSERT INTO ${table} (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})
     ON CONFLICT(id) DO UPDATE SET ${updates}`,
  ).run(...cols.map((c) => row[c]));
}

function replaceRoutineSets(db, routineId, tags, places) {
  db.prepare('DELETE FROM routine_tags WHERE routine_id = ?').run(routineId);
  db.prepare('DELETE FROM routine_places WHERE routine_id = ?').run(routineId);
  for (const tag of tags) {
    db.prepare('INSERT OR IGNORE INTO tags (name) VALUES (?)').run(tag);
    db.prepare('INSERT INTO routine_tags (routine_id, tag_name) VALUES (?, ?)').run(routineId, tag);
  }
  for (const place of places) {
    db.prepare('INSERT OR IGNORE INTO places (name) VALUES (?)').run(place);
    db.prepare('INSERT INTO routine_places (routine_id, place_name) VALUES (?, ?)').run(routineId, place);
  }
}

/** Reads every collection in the shape the browser uses. */
export function loadAll(db) {
  const tagsBy = new Map();
  for (const r of db.prepare('SELECT routine_id, tag_name FROM routine_tags ORDER BY tag_name').all()) {
    tagsBy.set(r.routine_id, [...(tagsBy.get(r.routine_id) ?? []), r.tag_name]);
  }
  const placesBy = new Map();
  for (const r of db.prepare('SELECT routine_id, place_name FROM routine_places ORDER BY place_name').all()) {
    placesBy.set(r.routine_id, [...(placesBy.get(r.routine_id) ?? []), r.place_name]);
  }

  return {
    persons: db.prepare('SELECT id, name FROM persons ORDER BY rowid').all(),
    spaces: db.prepare('SELECT id, name FROM spaces ORDER BY rowid').all(),
    things: db.prepare('SELECT id, space_id AS spaceId, type FROM things ORDER BY rowid').all(),
    routines: db.prepare('SELECT * FROM routines ORDER BY rowid').all().map((r) => ({
      id: r.id,
      title: r.title,
      kind: r.kind,
      intervalDays: r.interval_days,
      dayOfMonth: r.day_of_month,
      weekdays: r.weekdays ? r.weekdays.split(',').map(Number) : [],
      startDate: r.start_date,
      paused: r.paused === 1,
      targetType: r.target_type,
      assigneeId: r.assignee_id,
      description: r.description,
      tags: tagsBy.get(r.id) ?? [],
      places: placesBy.get(r.id) ?? [],
    })),
    issues: db.prepare(
      'SELECT id, kind, title, space_id AS spaceId, added_on AS addedOn, done_on AS doneOn FROM issues ORDER BY rowid',
    ).all(),
    completions: db.prepare(
      'SELECT id, routine_id, thing_id, done_on, due_on, skipped, person_id FROM completions ORDER BY done_on, rowid',
    ).all().map((c) => ({
      id: c.id,
      routineId: c.thing_id ? `${c.routine_id}@${c.thing_id}` : c.routine_id,
      doneOn: c.done_on,
      dueOn: c.due_on,
      skipped: c.skipped === 1,
      personId: c.person_id,
    })),
  };
}

/**
 * Applies a list of changes in one transaction. Each change is {op:'upsert', collection, item}
 * or {op:'delete', collection, id}. Everything is validated before anything is written.
 * @returns {number} how many changes were applied
 */
export function applySync(db, ops) {
  if (!Array.isArray(ops)) fail('ops must be a list');
  if (ops.length > MAX_OPS) fail(`at most ${MAX_OPS} changes per sync`);

  const parsed = ops.map((op) => {
    if (!op || typeof op !== 'object') fail('each change must be an object');
    if (!COLLECTIONS.includes(op.collection)) fail(`unknown collection ${op.collection}`);
    if (op.op === 'upsert') {
      const v = VALIDATORS[op.collection](op.item ?? {});
      return { op: 'upsert', collection: op.collection, ...v, id: v.row.id };
    }
    if (op.op === 'delete') return { op: 'delete', collection: op.collection, id: idOf(op.id, 'id') };
    return fail(`unknown operation ${op.op}`);
  });

  return transaction(db, () => {
    for (const p of parsed) {
      try {
        if (p.op === 'upsert') {
          upsertRow(db, p.collection, p.row);
          if (p.collection === 'routines') replaceRoutineSets(db, p.row.id, p.tags, p.places);
        } else {
          db.prepare(`DELETE FROM ${p.collection} WHERE id = ?`).run(p.id);
        }
      } catch (err) {
        if (/FOREIGN KEY/i.test(err.message)) {
          throw new ConflictError(`Cannot change ${p.collection} ${p.id ?? p.row.id}: other records still refer to it.`);
        }
        throw err;
      }
    }
    return parsed.length;
  });
}

/**
 * Seeds the starter data the first time the database is used. Recorded in `meta`, so
 * deleting everything later never brings the starter data back.
 * @returns {boolean} true if seeding happened now
 */
export function ensureSeeded(db, today = todayIn('Europe/London')) {
  if (db.prepare("SELECT 1 FROM meta WHERE key = 'seeded'").get()) return false;
  const s = seed(today);
  transaction(db, () => {
    const upserts = [
      ...s.persons.map((item) => ({ collection: 'persons', item })),
      ...s.spaces.map((item) => ({ collection: 'spaces', item })),
      ...s.things.map((item) => ({ collection: 'things', item })),
      ...s.routines.map((item) => ({ collection: 'routines', item })),
      ...s.issues.map((item) => ({ collection: 'issues', item })),
      ...s.completions.map((item) => ({ collection: 'completions', item })),
    ];
    for (const u of upserts) {
      const v = VALIDATORS[u.collection](u.item);
      upsertRow(db, u.collection, v.row);
      if (u.collection === 'routines') replaceRoutineSets(db, v.row.id, v.tags, v.places);
    }
    db.prepare("INSERT INTO meta (key, value) VALUES ('seeded', ?)").run(today);
  });
  return true;
}
