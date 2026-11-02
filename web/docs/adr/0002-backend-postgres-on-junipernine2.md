# ADR-0002: PostgreSQL on junipernine2, exposed through Cloudflare Tunnel

Status: Accepted
Date: 2026-11-02

## Context

The web app needs a server-side database to sync between devices and to send reminders when no browser is open. Tony has no preference between Postgres and Cloudflare-native services, and is most fluent in Postgres (former DBA). The recipe and photo projects already run on junipernine2, the home server.

## Options considered

1. **PostgreSQL on junipernine2**, with the API and scheduler on the same host, exposed through Cloudflare Tunnel.
2. **Cloudflare Workers with D1 (SQLite)** and Cron Triggers.
3. **Managed Postgres** in the cloud.

## Decision

Option 1. Run PostgreSQL, the API, and the scheduler on junipernine2. Expose the app through a Cloudflare Tunnel on a subdomain of junipernine.com. Keep the landing page on Cloudflare Pages.

## Reasons

- Matches the existing home-server pattern and skills.
- The scheduler needs a long-running process. This is simpler on a server than on Workers with Cron Triggers.
- Full SQL features (`date` types, check constraints, `ON DELETE` rules) support the data model in SPEC.md section 7 directly.
- No data leaves the home network except through the tunnel.

## Consequences

- Uptime depends on junipernine2 and the home connection. Acceptable for a single-household app, and consistent with ADR-0003 (connected use).
- Backups become Tony's responsibility: nightly `pg_dump` to Juniper13, and the dump is included in the offsite backup routine already used for photos.
- The tunnel and its credentials are a security surface. See GUARDRAILS.md.
