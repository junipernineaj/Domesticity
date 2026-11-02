# ADR-0013: Images on snags and nice to haves

Status: Accepted (2 Nov 2026). Phase 2 step. Completes the image bullet in ADR-0009 and SPEC 6.9.
Date: 2026-11-02

## Context

ADR-0012 left images for their own step, with storage and serving to be decided. A snag is easier to act on when the problem can be seen, and a nice to have is easier to judge from a photo of the spot.

Two storage options were weighed:

- **Files on disk** beside the database. The database would then hold a pointer, and a backup would need two places kept in step. Deleting an item would also need a file removed outside the transaction, so a crash could leave an orphan or a broken link.
- **Bytes in SQLite.** One file is backed up and snapshotted as a whole (ADR-0010), and an item and its picture are removed in the same transaction.

The household has a few dozen issues at most, and a photo shrunk in the browser is a few hundred kilobytes. The database stays small enough for SQLite to hold the pictures without trouble.

## Decision

1. **One image per item.** A snag or nice to have can have one image. Adding a new one replaces the old. Several photos can wait until someone asks for them.
2. **Stored in SQLite,** in table `issue_images` (migration 0003), one row per item, deleted with its item (`ON DELETE CASCADE`). Backups and the migration snapshot include the pictures.
3. **Formats:** JPEG, PNG and WebP. The server works out the type from the file's first bytes and ignores the type the browser claims. Anything else is refused.
4. **Size:** the browser shrinks a picture to at most 1600 pixels on its longest side, as JPEG at quality 0.85, before sending it. The server refuses anything over 3 MB.
5. **Endpoints,** separate from `/api/sync` because they carry binary data:
   - `GET /api/issues/{id}/image` returns the picture. It is `Cache-Control: private, no-cache`.
   - `PUT /api/issues/{id}/image` stores or replaces it.
   - `DELETE /api/issues/{id}/image` removes it.
   - Refusals: 404 for an unknown item or no picture, 400 when the bytes are not a picture, 413 when over the size limit, 405 for other methods.
6. **Loading:** `GET /api/data` adds `issueImages`, the list of item ids that have a picture. The browser shows the picture only for those ids. Pictures are not part of the working copy, so they are not synced and do not affect the diff.
7. **Activity log (SPEC 6.10):** each change is recorded, written server-side in the same transaction: "Added image to snag: X", "Replaced image on nice to have: X", "Removed image from snag: X".
8. **Access:** pictures are served behind the same Cloudflare Access login as the rest of the app (ADR-0008). Nothing is public.

## Consequences

- The database file grows with each picture. At a few hundred kilobytes per picture this is no concern for a household, and the figure should be revisited if the file passes about 500 MB.
- A picture is not in the activity log as bytes, only as a line saying it changed.
- The browser must be able to decode the file it is given. Modern phone browsers can, so the shrink step is the only conversion. If a browser cannot decode a picture, the user is told to try a JPEG or PNG.
- Reminders and the on-time rate are unaffected, as ADR-0009 requires.
