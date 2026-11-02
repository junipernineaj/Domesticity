# Guardrails

Rules for anyone (human or Claude) changing Domesticity Web. These protect the household's data and the scheduling behaviour the app depends on.

## Scheduling semantics

- Do not change any rule in SPEC.md section 5 without first updating the spec and recording an ADR. The golden suite must change in the same commit as the code.
- A change that makes any golden test fail is a semantics change, not a bug fix, unless the test itself is wrong. Say which in the commit message.
- Do not compute due dates in the browser for anything that is saved or sent. The server is the source of truth. The client may preview.

## Data safety

- Completion history is never hard-deleted. Deleting a routine cascades to its completions only through the explicit delete action with confirmation.
- No migration may drop or rewrite columns that hold history (`completion.*`) without a reviewed backup first.
- Every migration is reviewed before it runs on junipernine2. Take a `pg_dump` before any schema change.
- Dates for scheduling are stored as `date` in the household timezone. Do not store scheduling dates as `timestamptz`.

## Security and secrets

- Never commit secrets: VAPID private key, database passwords, session secrets, Cloudflare tokens. Use an environment file on junipernine2 with mode 600, and a `.env.example` in the repo with placeholder values only.
- Every API route except login and the public health check requires an authenticated session.
- Passwords are hashed with Argon2id. Never log passwords, session tokens, or push subscription endpoints in full.
- Push subscription endpoints are personal data. Do not send them to any service other than the push service that issued them.
- The app is reachable only through Cloudflare Tunnel with the password-protected login. Do not open a port on the router.

## External services

- No third-party analytics, trackers, or CDN scripts in the web client. Keep it self-hosted apart from Cloudflare Pages for the landing page.
- Do not add a dependency that calls an external API at runtime without an ADR.

## Changes to the repo

- Do not push to the default branch directly. Work on a branch and open a pull request.
- Do not add a new dependency without a one-line justification in the pull request.
- Keep iOS parity table (SPEC.md section 9) up to date when a feature changes.

## Working with Claude

- Claude may draft specs, ADRs, code, and tests. Claude does not deploy to junipernine2 or change DNS, tunnel, or Cloudflare settings without an explicit yes in chat for that specific action.
- Claude does not send push notifications to real subscriptions for testing. Use a test subscription or a dry-run flag.
- Claude asks before deleting data, dropping tables, or resetting the database, even on a development instance.
