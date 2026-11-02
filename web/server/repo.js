// Reads and writes Domesticity data. Every write is validated first, then applied in one
// transaction, so a sync either lands whole or not at all. See ADR-0011.
import { seed } from '../src/seed.js';
import { todayIn } from '../src/dates.js';
import { ASSIGNEES, RAGS, SEVERITIES } from '../src/issues-rules.js';
import { randomUUID } from 'node:crypto';
import { sniffImage } from './images.js';
import { daysInMonth, parts } from '../src/dates.js';

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

// '2027-04-26' reads as '26 April 2027' in the activity log.
function formatDay(date) {
  const { year, month, day } = parts(date);
  return `${day} ${MONTH_NAMES[month - 1]} ${year}`;
}

export const COLLECTIONS = ['persons', 'spaces', 'things', 'routines', 'issues', 'completions', 'holidays'];
const MAX_OPS = 500;

export class ValidationError extends Error {}
export class ConflictError extends Error {}
export class NotFoundError extends Error {}

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

// A field that does not apply to this kind of issue: it must be empty.
function onlyFor(v, _unused, field) {
  if (v == null) return null;
  fail(`${field} does not apply to this kind of item`);
}

function listOf(v, field, max) {
  if (v == null) return [];
  if (!Array.isArray(v)) fail(`${field} must be a list`);
  return [...new Set(v.map((x) => str(x, field, max)))];
}

function renewalMonthsOf(v) {
  if (!Number.isInteger(v) || ![3, 6, 12].includes(v)) fail('renewals repeat every 3, 6 or 12 months');
  return v;
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

  routines: (item) => {
    const kind = oneOf(item.kind, ['interval', 'weekly', 'monthly', 'renewal'], 'kind');
    const isRenewal = kind === 'renewal';
    return {
      row: {
        id: idOf(item.id, 'routine id'),
        title: str(item.title, 'title', 80),
        kind,
        interval_days: intOrNull(item.intervalDays, 1, 365, 'every how many days'),
        day_of_month: intOrNull(item.dayOfMonth, 1, 31, 'day of the month'),
        weekdays: weekdaysOf(item.weekdays),
        start_date: date(item.startDate, 'start date'),
        paused: bool01(item.paused ?? false, 'paused'),
        target_type: str(item.targetType, 'target type', 40, { optional: true }),
        assignee_id: idOrNull(item.assigneeId, 'assignee'),
        description: str(item.description, 'description', 500, { optional: true }),
        // Renewals only (ADR-0014): repeat every 3, 6 or 12 months, with a reminder lead time.
        every_months: isRenewal ? renewalMonthsOf(item.everyMonths) : null,
        lead_days: isRenewal ? intOrNull(item.leadDays ?? 30, 0, 365, 'reminder lead time') : null,
      },
      tags: listOf(item.tags, 'tags', 40),
      places: listOf(item.places, 'places', 40),
    };
  },

  holidays: (item) => {
    const row = {
      id: idOf(item.id, 'holiday id'),
      name: str(item.name, 'name', 60),
      target_month: intOrNull(item.targetMonth, 1, 12, 'month'),
      target_day: intOrNull(item.targetDay, 1, 31, 'day'),
      note: str(item.note, 'note', 500, { optional: true }),
      booked_for: dateOrNull(item.bookedFor, 'booked date'),
    };
    if (row.target_month == null || row.target_day == null) fail('a holiday needs a month and a day');
    if (row.target_day > daysInMonth(2028, row.target_month)) fail(`${row.name}: that day is not in that month`);
    // A booking must be for an occurrence of this holiday (ADR-0015).
    if (row.booked_for) {
      const { month, day } = parts(row.booked_for);
      if (month !== row.target_month || day !== row.target_day) fail('a holiday can only be booked for its own day');
    }
    return { row };
  },

  issues: (item) => {
    const kind = oneOf(item.kind, ['snag', 'nice'], 'kind');
    const isSnag = kind === 'snag';
    return {
      row: {
        id: idOf(item.id, 'issue id'),
        kind,
        title: str(item.title, 'title', 120),
        space_id: idOrNull(item.spaceId, 'space'),
        added_on: date(item.addedOn, 'added date'),
        done_on: dateOrNull(item.doneOn, 'done date'),
        // Snags: severity, urgency and assignee are required, and they have no scores.
        severity: isSnag ? oneOf(item.severity, SEVERITIES, 'severity') : onlyFor(item.severity, false, 'severity'),
        rag: isSnag ? oneOf(item.rag, RAGS, 'urgency') : onlyFor(item.rag, false, 'urgency'),
        assignee: isSnag ? oneOf(item.assignee, ASSIGNEES, 'assignee') : onlyFor(item.assignee, false, 'assignee'),
        // Nice to haves: cost and effort are whole numbers from 1 to 5, and may be left unset.
        cost: isSnag ? onlyFor(item.cost, false, 'cost') : intOrNull(item.cost, 1, 5, 'cost'),
        effort: isSnag ? onlyFor(item.effort, false, 'effort') : intOrNull(item.effort, 1, 5, 'effort'),
      },
    };
  },

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

const KIND_LABEL = { snag: 'snag', nice: 'nice to have' };
const COLUMN_NAMES = {
  persons: ['id', 'name'], spaces: ['id', 'name'], things: ['id', 'space_id', 'type'],
  routines: ['id', 'title', 'kind', 'interval_days', 'day_of_month', 'weekdays', 'start_date', 'paused', 'target_type', 'assignee_id', 'description', 'every_months', 'lead_days'],
  issues: ['id', 'kind', 'title', 'space_id', 'added_on', 'done_on', 'severity', 'rag', 'assignee', 'cost', 'effort'],
  holidays: ['id', 'name', 'target_month', 'target_day', 'note', 'booked_for'],
  completions: ['id', 'routine_id', 'thing_id', 'done_on', 'due_on', 'skipped', 'person_id'],
};

// The title a routine shows in the browser, including the space for a task expanded from a thing.
function taskTitle(db, routineId, thingId) {
  const r = db.prepare('SELECT title FROM routines WHERE id = ?').get(routineId);
  const title = r ? r.title : routineId;
  if (!thingId) return title;
  const s = db.prepare('SELECT s.name AS name FROM things t JOIN spaces s ON s.id = t.space_id WHERE t.id = ?').get(thingId);
  return s ? `${title} · ${s.name}` : title;
}

function spaceName(db, id) {
  const s = id ? db.prepare('SELECT name FROM spaces WHERE id = ?').get(id) : null;
  return s ? s.name : null;
}

/**
 * Says in words what a change does, for the activity log. Returns null when nothing is worth
 * recording. Called before the change is written, so the old row is still there.
 */
function describeChange(db, p) {
  const table = p.collection;
  if (p.op === 'delete') {
    const before = db.prepare(`SELECT * FROM ${table} WHERE id = ?`).get(p.id);
    if (!before) return null;
    switch (table) {
      case 'routines': return `Deleted routine: ${before.title}`;
      case 'issues': return `Removed ${KIND_LABEL[before.kind]}: ${before.title}`;
      case 'spaces': return `Deleted space: ${before.name}`;
      case 'things': return `Removed ${before.type} from ${spaceName(db, before.space_id) ?? 'a space'}`;
      case 'persons': return `Removed person: ${before.name}`;
      case 'holidays': return `Removed holiday: ${before.name}`;
      default: return null; // completions go with their routine, which is logged
    }
  }

  const row = p.row;
  const before = db.prepare(`SELECT * FROM ${table} WHERE id = ?`).get(row.id);
  if (table === 'completions') {
    if (before) return null;
    const title = taskTitle(db, row.routine_id, row.thing_id);
    return `${row.skipped ? 'Skipped' : 'Did'} ${title}`;
  }
  if (table === 'persons') return before ? `Changed person: ${row.name}` : `Added person: ${row.name}`;
  if (table === 'holidays') {
    if (!before) return `Added holiday: ${row.name}`;
    if (before.booked_for == null && row.booked_for != null) return `Booked holiday: ${row.name}, ${formatDay(row.booked_for)}`;
    if (before.booked_for != null && row.booked_for == null) return `Unbooked holiday: ${row.name}`;
    const changed = COLUMN_NAMES.holidays.some((c) => before[c] !== row[c]);
    return changed ? `Edited holiday: ${row.name}` : null;
  }
  if (table === 'spaces') return before ? `Changed space: ${row.name}` : `Added space: ${row.name}`;
  if (table === 'things') {
    const where = spaceName(db, row.space_id) ?? 'a space';
    return before ? `Changed ${row.type} in ${where}` : `Added ${row.type} to ${where}`;
  }
  if (table === 'routines') {
    const label = `routine: ${row.title}`;
    if (!before) return `Added ${label}`;
    const changed = COLUMN_NAMES.routines.some((c) => before[c] !== row[c]) || !sameSets(db, row.id, p.tags, p.places);
    return changed ? `Edited ${label}` : null;
  }
  if (table === 'issues') {
    const label = KIND_LABEL[row.kind];
    if (!before) return `Added ${label}: ${row.title}`;
    if (before.done_on == null && row.done_on != null) return `Closed ${label}: ${row.title}`;
    if (before.done_on != null && row.done_on == null) return `Reopened ${label}: ${row.title}`;
    const changed = COLUMN_NAMES.issues.some((c) => before[c] !== row[c]);
    return changed ? `Edited ${label}: ${row.title}` : null;
  }
  return null;
}

function sameSets(db, routineId, tags, places) {
  const now = (sql) => db.prepare(sql).all(routineId).map((r) => Object.values(r)[0]).sort().join('|');
  return now('SELECT tag_name FROM routine_tags WHERE routine_id = ?') === [...tags].sort().join('|')
    && now('SELECT place_name FROM routine_places WHERE routine_id = ?') === [...places].sort().join('|');
}

function logActivity(db, collection, text) {
  db.prepare('INSERT INTO activity (id, at, collection, text) VALUES (?, ?, ?, ?)')
    .run(randomUUID(), new Date().toISOString(), collection, text);
}

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
      everyMonths: r.every_months,
      leadDays: r.lead_days,
      tags: tagsBy.get(r.id) ?? [],
      places: placesBy.get(r.id) ?? [],
    })),
    holidays: db.prepare(
      `SELECT id, name, target_month AS targetMonth, target_day AS targetDay, note, booked_for AS bookedFor
       FROM holidays ORDER BY rowid`,
    ).all(),
    issues: db.prepare(
      `SELECT id, kind, title, space_id AS spaceId, added_on AS addedOn, done_on AS doneOn,
              severity, rag, assignee, cost, effort
       FROM issues ORDER BY rowid`,
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
    // Ids of the items that have a picture. The pictures themselves come from their own endpoint (ADR-0013).
    issueImages: db.prepare('SELECT issue_id FROM issue_images ORDER BY issue_id').all().map((r) => r.issue_id),
  };
}

/** The picture for an item, or null when it has none. */
export function getIssueImage(db, issueId) {
  const row = db.prepare('SELECT mime, bytes FROM issue_images WHERE issue_id = ?').get(issueId);
  return row ?? null;
}

/**
 * Stores the picture for an item, replacing any earlier one, and logs it (ADR-0013).
 * @param {import('node:sqlite').DatabaseSync} db
 * @param {string} issueId
 * @param {Uint8Array} bytes
 */
export function setIssueImage(db, issueId, bytes) {
  const mime = sniffImage(bytes);
  if (!mime) fail('The file is not a JPEG, PNG or WebP picture');
  return transaction(db, () => {
    const issue = db.prepare('SELECT kind, title FROM issues WHERE id = ?').get(issueId);
    if (!issue) throw new NotFoundError('No such item');
    const replacing = db.prepare('SELECT 1 FROM issue_images WHERE issue_id = ?').get(issueId);
    db.prepare(
      `INSERT INTO issue_images (issue_id, mime, bytes, added_at) VALUES (?, ?, ?, ?)
       ON CONFLICT(issue_id) DO UPDATE SET mime = excluded.mime, bytes = excluded.bytes, added_at = excluded.added_at`,
    ).run(issueId, mime, bytes, new Date().toISOString());
    const verb = replacing ? 'Replaced image on' : 'Added image to';
    logActivity(db, 'issues', `${verb} ${KIND_LABEL[issue.kind]}: ${issue.title}`);
  });
}

/** Removes the picture for an item and logs it. */
export function removeIssueImage(db, issueId) {
  return transaction(db, () => {
    const issue = db.prepare('SELECT kind, title FROM issues WHERE id = ?').get(issueId);
    if (!issue) throw new NotFoundError('No such item');
    const removed = db.prepare('DELETE FROM issue_images WHERE issue_id = ?').run(issueId);
    if (removed.changes === 0) throw new NotFoundError('No picture on this item');
    logActivity(db, 'issues', `Removed image from ${KIND_LABEL[issue.kind]}: ${issue.title}`);
  });
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
        const text = describeChange(db, p);
        if (p.op === 'upsert') {
          upsertRow(db, p.collection, p.row);
          if (p.collection === 'routines') replaceRoutineSets(db, p.row.id, p.tags, p.places);
        } else {
          db.prepare(`DELETE FROM ${p.collection} WHERE id = ?`).run(p.id);
        }
        if (text) logActivity(db, p.collection, text);
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

/**
 * One page of the activity log, newest first. `before` is the seq of the last entry the
 * reader already has; omit it for the newest page.
 */
export function activityPage(db, { before = null, limit = 50 } = {}) {
  const rows = before == null
    ? db.prepare('SELECT seq, at, collection, text FROM activity ORDER BY seq DESC LIMIT ?').all(limit)
    : db.prepare('SELECT seq, at, collection, text FROM activity WHERE seq < ? ORDER BY seq DESC LIMIT ?').all(before, limit);
  return {
    items: rows,
    next: rows.length === limit ? rows[rows.length - 1].seq : null,
  };
}
