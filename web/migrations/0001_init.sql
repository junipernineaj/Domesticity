-- Phase 1 schema (ADR-0011). Dates are 'YYYY-MM-DD' text in the household timezone (SPEC section 7).

CREATE TABLE meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE persons (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL
);

CREATE TABLE spaces (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL
);

CREATE TABLE things (
  id TEXT PRIMARY KEY,
  space_id TEXT NOT NULL REFERENCES spaces(id),
  type TEXT NOT NULL
);

CREATE TABLE routines (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('interval', 'weekly', 'monthly')),
  interval_days INTEGER,
  day_of_month INTEGER,
  weekdays TEXT NOT NULL DEFAULT '',
  start_date TEXT NOT NULL,
  paused INTEGER NOT NULL DEFAULT 0 CHECK (paused IN (0, 1)),
  target_type TEXT,
  assignee_id TEXT REFERENCES persons(id),
  description TEXT
);

CREATE TABLE tags (
  name TEXT PRIMARY KEY
);

CREATE TABLE places (
  name TEXT PRIMARY KEY
);

CREATE TABLE routine_tags (
  routine_id TEXT NOT NULL REFERENCES routines(id) ON DELETE CASCADE,
  tag_name TEXT NOT NULL REFERENCES tags(name),
  PRIMARY KEY (routine_id, tag_name)
);

CREATE TABLE routine_places (
  routine_id TEXT NOT NULL REFERENCES routines(id) ON DELETE CASCADE,
  place_name TEXT NOT NULL REFERENCES places(name),
  PRIMARY KEY (routine_id, place_name)
);

-- History. Never cascade-deleted (GUARDRAILS). thing_id is deliberately not a foreign key,
-- so removing a thing never removes its history.
CREATE TABLE completions (
  id TEXT PRIMARY KEY,
  routine_id TEXT NOT NULL REFERENCES routines(id),
  thing_id TEXT,
  done_on TEXT NOT NULL,
  due_on TEXT NOT NULL,
  skipped INTEGER NOT NULL CHECK (skipped IN (0, 1)),
  person_id TEXT REFERENCES persons(id)
);

CREATE INDEX completions_by_routine ON completions(routine_id, thing_id);

CREATE TABLE issues (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL CHECK (kind IN ('snag', 'nice')),
  title TEXT NOT NULL,
  space_id TEXT REFERENCES spaces(id),
  added_on TEXT NOT NULL,
  done_on TEXT
);
