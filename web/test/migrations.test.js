// Migrations: a database that already holds data survives the routines rebuild (ADR-0014).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { migrate, openDatabase } from '../server/db.js';

const MIGRATIONS = join(dirname(fileURLToPath(import.meta.url)), '..', 'migrations');

test('a routine with tags, places and history survives the renewals migration', () => {
  // Build a database as it was before 0004: run 0001 to 0003 by hand, with data in it.
  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys = ON');
  db.exec('CREATE TABLE schema_migrations (version TEXT PRIMARY KEY, applied_at TEXT NOT NULL)');
  for (const file of ['0001_init.sql', '0002_snags_nice_activity.sql', '0003_issue_images.sql']) {
    db.exec(readFileSync(join(MIGRATIONS, file), 'utf8'));
    db.prepare('INSERT INTO schema_migrations VALUES (?, ?)').run(file, 'then');
  }
  db.exec(`
    INSERT INTO tags (name) VALUES ('cleaning');
    INSERT INTO places (name) VALUES ('Kitchen');
    INSERT INTO routines (id, title, kind, interval_days, start_date) VALUES ('bins', 'Bins', 'interval', 7, '2026-10-01');
    INSERT INTO routine_tags (routine_id, tag_name) VALUES ('bins', 'cleaning');
    INSERT INTO routine_places (routine_id, place_name) VALUES ('bins', 'Kitchen');
    INSERT INTO completions (id, routine_id, done_on, due_on, skipped) VALUES ('c1', 'bins', '2026-10-08', '2026-10-08', 0);
  `);

  migrate(db, undefined);

  assert.deepEqual(db.prepare('SELECT title, kind FROM routines').all().map((r) => ({ ...r })), [{ title: 'Bins', kind: 'interval' }]);
  assert.equal(db.prepare('SELECT tag_name FROM routine_tags').get().tag_name, 'cleaning');
  assert.equal(db.prepare('SELECT place_name FROM routine_places').get().place_name, 'Kitchen');
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM completions').get().n, 1);
  assert.equal(db.prepare('PRAGMA foreign_keys').get().foreign_keys, 1, 'foreign keys are back on');
  assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(), []);
  // The new kind is accepted now.
  db.exec("INSERT INTO routines (id, title, kind, start_date, every_months, lead_days) VALUES ('ins', 'Car insurance', 'renewal', '2027-03-14', 12, 30)");
});

test('a fresh database gets every migration', () => {
  const db = openDatabase(':memory:');
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM schema_migrations').get().n, 6);
});
