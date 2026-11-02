// Opens the SQLite database and applies migrations. See ADR-0010 and ADR-0011.
import { DatabaseSync } from 'node:sqlite';
import { existsSync, mkdirSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const MIGRATIONS_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'migrations');

/**
 * Opens (creating if needed) the database at `path` and brings its schema up to date.
 * @param {string} path  a file path, or ':memory:' for tests
 * @returns {DatabaseSync}
 */
export function openDatabase(path) {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec('PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;');
  if (path !== ':memory:') db.exec('PRAGMA journal_mode = WAL;');
  migrate(db, path);
  return db;
}

/**
 * Copies the whole database to `file` as a consistent snapshot (ADR-0010).
 * @param {DatabaseSync} db
 * @param {string} file  must not exist yet
 */
export function snapshot(db, file) {
  db.prepare('VACUUM INTO ?').run(file);
}

/**
 * Applies each migration file that has not run yet, in order, each in its own transaction.
 * Before the first pending migration on an existing file, a snapshot is taken.
 * @param {DatabaseSync} db
 * @param {string} [path]  the database file, used to name the snapshot
 */
export function migrate(db, path) {
  db.exec('CREATE TABLE IF NOT EXISTS schema_migrations (version TEXT PRIMARY KEY, applied_at TEXT NOT NULL)');
  const applied = new Set(db.prepare('SELECT version FROM schema_migrations').all().map((r) => r.version));
  const pending = readdirSync(MIGRATIONS_DIR)
    .filter((f) => /^\d{4}_.*\.sql$/.test(f))
    .sort()
    .filter((f) => !applied.has(f));
  if (pending.length === 0) return;

  if (path && path !== ':memory:' && existsSync(path) && applied.size > 0) {
    snapshot(db, `${path}.${new Date().toISOString().replace(/[:.]/g, '-')}.bak`);
  }

  for (const file of pending) {
    const sql = readFileSync(join(MIGRATIONS_DIR, file), 'utf8');
    db.exec('BEGIN');
    try {
      db.exec(sql);
      db.prepare('INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)')
        .run(file, new Date().toISOString());
      db.exec('COMMIT');
    } catch (err) {
      db.exec('ROLLBACK');
      throw new Error(`Migration ${file} failed: ${err.message}`);
    }
  }
}
