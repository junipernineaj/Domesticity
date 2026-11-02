# ADR-0011: Server-side storage with one API call for reads and one for writes

Status: Accepted (2 Nov 2026). Phase 1 of the storage build. Builds on ADR-0010 (SQLite) and ADR-0007 (tags and places).
Date: 2026-11-02

## Context

Until now the app held all data in the browser's memory, so nothing survived a reload and nothing was shared between devices. Phase 1 makes the server the source of truth. The data is small and written by one household, so the design favours simple code over throughput.

## Decision

1. **Data lives in one SQLite file**, opened with Node's built-in `node:sqlite` (ADR-0010). No npm dependency.
2. **Modules.** `web/server/db.js` opens the file and runs migrations. `web/server/repo.js` loads data and applies writes. `web/server/api.js` routes HTTP. `web/server.js` serves the static files and sends `/api/` to the API. Migrations are plain SQL in `web/migrations/`, numbered, and applied in order.
3. **Two API calls only.**
   - `GET /api/data` returns every collection in one response: persons, spaces, things, routines, issues and completions.
   - `POST /api/sync` takes a list of operations (upsert or delete, on one collection and one id) and applies them in one transaction. If any operation fails, none are applied.
   The API is behind Cloudflare Access only, as before (ADR-0005 covers app-level login later).
4. **The browser keeps a working copy.** After each render it compares the copy with the last state the server confirmed, and sends the difference through `/api/sync`. A failed send is retried, and a status line shows the problem. Actions in the UI change the working copy directly, so the actions themselves stay as they were.
5. **Order matters.** Upserts go parent first (persons, spaces, things, routines, issues, completions). Deletes go child first (completions, issues, things, routines, spaces, persons). A routine's history must be deleted before the routine, which the client does, and the database refuses to delete a routine that still has history.
6. **Seeding happens once, on the server.** The first `GET /api/data` seeds the starter data, and a row in `meta` records that it has. Deleting everything later never brings the seed back.
7. **Validation.** Every write is checked against its collection: required fields, types, lengths, and allowed values. Unknown fields are dropped. A failed check rejects the whole sync.
8. **History is protected.** Completions have no cascade. A completion's thing reference is not a foreign key, so removing a thing never removes its history (GUARDRAILS).
9. **Migrations are backed up first.** Before any pending migration runs, the file is copied with `VACUUM INTO` to a dated `.bak` file beside it.
10. **Location.** `DB_PATH` sets the file. The default is `web/data/domesticity.db` (git-ignored). The service uses `/var/lib/domesticity/domesticity.db`, created by systemd through `StateDirectory=`.

## Simplifications for Phase 1

- Weekdays are stored as comma-separated numbers on the routine, not in a join table. The set is small and always read whole.
- Tags and places are stored in their own tables, with the name as the key, as ADR-0007 asks. Unused names are not yet removed.
- Dates are `TEXT` in the form `YYYY-MM-DD` (ADR-0010).
- Expanded routines (one task per thing) are stored as their routine plus the thing. The browser's combined id is rebuilt when data is loaded.

## Not in Phase 1

- The activity log, snag severity and RAG, the Cost and Effort sliders, reopen, images, renewals and holidays. Each comes in a later migration, with its own ADR where the rules change.
- Automated nightly backup to Juniper13. The snapshot function exists, but scheduling it needs the destination settled first.

## Consequences

- Every change now crosses the network, so a dropped connection shows a status message, and the browser retries.
- Two browsers editing at once: the last successful write wins for each item. This is acceptable for one household, and is the reason for ADR-0005 before sharing is added.
- `node:sqlite` is experimental, so the service log will show a warning on start.
