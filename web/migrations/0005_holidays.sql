-- Phase 3 holiday plans (ADR-0015). Each holiday falls on the same day every year.
-- booked_for holds the date it is booked for. It counts as booked only while it matches the
-- next occurrence, so a booking lapses by itself once the day has passed.
CREATE TABLE holidays (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  target_month INTEGER NOT NULL CHECK (target_month BETWEEN 1 AND 12),
  target_day INTEGER NOT NULL CHECK (target_day BETWEEN 1 AND 31),
  note TEXT,
  booked_for TEXT CHECK (booked_for IS NULL OR booked_for GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]')
);

INSERT INTO holidays (id, name, target_month, target_day) VALUES
  ('holiday-birthday', 'Tony''s Birthday', 4, 26),
  ('holiday-anniversary', 'Wedding Anniversary', 9, 11),
  ('holiday-christmas', 'Christmas', 12, 24);
