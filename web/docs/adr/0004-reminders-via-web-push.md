# ADR-0004: Reminders via Web Push from a server-side scheduler

Status: Accepted
Date: 2026-11-02

## Context

The iOS app schedules local notifications on the phone. A browser cannot do that when the app is closed. Options were Web Push, email, or no reminders in v1. Tony chose Web Push.

Constraints that matter:
- On iOS, Web Push works only for a web app installed to the Home Screen, and needs a user gesture to request permission.
- iOS Safari does not support notification action buttons, so "Mark done" from the notification is not available.
- The iOS app's reminder rules (due day, next-day late, daily overdue) are the behaviour to keep.

## Decision

- Use Web Push with VAPID keys, sent from the API host.
- A scheduler runs every minute. It computes which reminders are due using the pure scheduling module (ADR-0003) and sends them.
- `reminder_log` records each send by routine, kind, and date, so retries and restarts never send duplicates.
- Notifications open the Today page. Completing a routine is one tap there.
- The app badge shows the count of due or overdue routines where supported.

## Consequences

- Parity gap: no "Mark done" action from the notification on iOS. Documented in SPEC.md section 9.
- Reminders depend on the user having installed the app and allowed notifications. The Today page shows a banner when they have not.
- Push endpoints are personal data and are handled under GUARDRAILS.md.
- The scheduler and the API share the pure module, so the two cannot disagree about what is due.
