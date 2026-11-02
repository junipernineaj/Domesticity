-- Phase 2 (ADR-0012): snag severity, urgency and assignee; nice-to-have cost and effort; the activity log.

ALTER TABLE issues ADD COLUMN severity TEXT CHECK (severity IN ('cosmetic', 'soon', 'unsafe'));
ALTER TABLE issues ADD COLUMN rag TEXT CHECK (rag IN ('red', 'amber', 'green'));
ALTER TABLE issues ADD COLUMN assignee TEXT CHECK (assignee IN ('household', 'external'));
ALTER TABLE issues ADD COLUMN cost INTEGER CHECK (cost BETWEEN 1 AND 5);
ALTER TABLE issues ADD COLUMN effort INTEGER CHECK (effort BETWEEN 1 AND 5);

-- Existing snags get the same defaults the seed uses, so they are valid under the new rules.
UPDATE issues SET severity = 'soon', rag = 'amber', assignee = 'household' WHERE kind = 'snag';

-- Entries are only ever added. Nothing deletes from this table (SPEC 6.10).
CREATE TABLE activity (
  seq INTEGER PRIMARY KEY AUTOINCREMENT,
  id TEXT NOT NULL UNIQUE,
  at TEXT NOT NULL,
  collection TEXT NOT NULL,
  text TEXT NOT NULL
);
