-- Self care and pets (ADR-0017). Routines belong to an area: the house, or self care and pets.
ALTER TABLE routines ADD COLUMN area TEXT NOT NULL DEFAULT 'house' CHECK (area IN ('house', 'care'));

-- The household setting that shows or hides self care. Off until someone switches it on.
CREATE TABLE settings (
  id TEXT PRIMARY KEY,
  self_care INTEGER NOT NULL DEFAULT 0 CHECK (self_care IN (0, 1))
);
INSERT INTO settings (id, self_care) VALUES ('household', 0);
