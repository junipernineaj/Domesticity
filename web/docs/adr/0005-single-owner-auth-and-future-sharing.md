# ADR-0005: Single owner with password login; data model ready for household members

Status: Accepted
Date: 2026-11-02

## Context

Only Tony uses the app for now. The app is reachable from the internet through a tunnel, so it still needs login. The iOS app's "This phone belongs to" setting and CloudKit sharing show that households may want several people later.

## Decision

1. **Auth:** one owner account. Password login (Argon2id), a server-side session with an HTTP-only, secure, SameSite cookie, and a session lifetime of 30 days.
2. **People:** the `person` table exists from v1. Completions carry an optional `person_id`. The "This device belongs to" setting is stored in the browser, not on the server, which matches the iOS behaviour.
3. **Sharing:** not built. The data model has no `household_id` yet. When sharing is added, a `household` table and a `household_member` table will be introduced by a new ADR and migration. Until then, the single household is implicit.

## Consequences

- Simple and secure for one user, with no sign-up flow to attack.
- Adding multiple users later is a migration, not a rewrite, because `person` and `completion.person_id` already exist.
- Losing the password means a manual reset on junipernine2. Document the procedure in the runbook when the app is built.
- The phone-to-person mapping lives per browser, so a new device needs the setting chosen once.
