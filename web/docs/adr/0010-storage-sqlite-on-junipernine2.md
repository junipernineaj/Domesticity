# ADR-0010: Store data in a SQLite file on junipernine2, using Node's built-in SQLite module

Status: Accepted (2 Nov 2026). Supersedes the database choice in ADR-0002. The Cloudflare Tunnel part of ADR-0002 still stands.
Date: 2026-11-02

## Context

ADR-0002 chose PostgreSQL on junipernine2. That made sense for a shared, multi-user service, but Domesticity is one household with a few dozen routines and a few hundred completions a year. Running a database server for that is more to install, patch, back up and monitor than the data justifies.

The app also has one server process that writes to the database. The browser never talks to the database directly. Those facts fit a single-file database well.

ADR-0006 keeps the zero-dependency stance for the core app. Node 22, which is already installed on junipernine2 for this app, includes a built-in SQLite module (`node:sqlite`). It is still marked experimental.

## Decision

1. **One SQLite database file** at `/var/lib/domesticity/domesticity.db`, owned by the `domesticity` system user and not readable by others. The systemd unit gets write access to that directory only.
2. **The server is the source of truth.** The browser holds a copy for display. Every change is saved through the API before it is treated as saved.
3. **Built-in `node:sqlite`, no npm dependency.** Foreign keys are on and the database uses WAL journaling. Before relying on it, confirm on junipernine2 that the experimental warning is the only problem. If the module is unusable there, the fallback is `better-sqlite3`, which needs a native build and so needs an amendment to this ADR.
4. **Plain SQL migrations** live in `web/migrations/`, numbered in order. Each is reviewed before it runs (GUARDRAILS), applied in a transaction, and recorded in a `schema_migrations` table.
5. **Backups.** Nightly, the service writes a consistent snapshot with `VACUUM INTO` to a dated file, and copies it to Juniper13 as part of the existing offsite backup. A snapshot is taken before every migration.
6. **Single writer.** Only the Domesticity API process opens the database for writing. Nothing else on junipernine2 should touch the file.
7. **Upgrade path.** If the app ever serves more than one household, or needs several writing processes, PostgreSQL is the documented next step. That would be a new ADR.

## Not decided here

These are separate decisions, deferred on purpose:

- **Login.** Until ADR-0005's password login exists, Cloudflare Access is the only gate.
- **Reminders.** Web Push and the scheduler are ADR-0004's business and come after storage.
- **Edit history.** Completion history is kept (GUARDRAILS). Whether to keep an audit trail of edits to routines is open.

## Consequences

- No database server to run, patch or monitor. Restoring a backup is copying a file back.
- A single writer means no concurrent writes from several servers. That is fine for one household.
- `node:sqlite` is experimental, so a Node upgrade could change it. The version is pinned by the install script (`NODE_BIN`).
- The data model in SPEC.md section 7 stays as written. Only the engine changes. Types map as follows: `date` becomes `TEXT` holding `YYYY-MM-DD`, and `uuid` ids become `TEXT`.
