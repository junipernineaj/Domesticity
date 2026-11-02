-- Phase 2 images (ADR-0013): one picture per snag or nice to have, kept in the database so a
-- backup or snapshot holds it. Deleting the item deletes its picture.
CREATE TABLE issue_images (
  issue_id TEXT PRIMARY KEY REFERENCES issues(id) ON DELETE CASCADE,
  mime TEXT NOT NULL CHECK (mime IN ('image/jpeg', 'image/png', 'image/webp')),
  bytes BLOB NOT NULL,
  added_at TEXT NOT NULL
);
