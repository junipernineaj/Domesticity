-- migrate: foreign keys off
-- Phase 3 renewals (ADR-0014). SQLite cannot change a CHECK constraint, so the routines table is rebuilt.
-- Foreign keys are off while this runs (see server/db.js), so dropping the old table does not
-- cascade into tags, places or completions. The runner checks foreign keys before it commits.

CREATE TABLE routines_new (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('interval', 'weekly', 'monthly', 'renewal')),
  interval_days INTEGER,
  day_of_month INTEGER,
  weekdays TEXT NOT NULL DEFAULT '',
  start_date TEXT NOT NULL,
  paused INTEGER NOT NULL DEFAULT 0 CHECK (paused IN (0, 1)),
  target_type TEXT,
  assignee_id TEXT REFERENCES persons(id),
  description TEXT,
  every_months INTEGER CHECK (every_months IN (3, 6, 12)),
  lead_days INTEGER CHECK (lead_days BETWEEN 0 AND 365)
);

INSERT INTO routines_new (id, title, kind, interval_days, day_of_month, weekdays, start_date, paused, target_type, assignee_id, description)
  SELECT id, title, kind, interval_days, day_of_month, weekdays, start_date, paused, target_type, assignee_id, description FROM routines;

DROP TABLE routines;
ALTER TABLE routines_new RENAME TO routines;
