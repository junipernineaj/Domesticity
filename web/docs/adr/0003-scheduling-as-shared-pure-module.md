# ADR-0003: Scheduling rules as one pure module, tested against golden cases; connected use assumed

Status: Accepted
Date: 2026-11-02

## Context

The scheduling rules are the heart of the app and the easiest part to get subtly wrong. The iOS app holds them in Swift methods tied to model objects. A web version would otherwise end up with separate logic in the browser, the API, and the scheduler, which could drift.

Tony has said a network connection can be assumed for now.

## Decision

1. Scheduling is one pure module with no I/O: given routines, completions, a clock, and a timezone, it returns due dates, overdue status, streaks, and stats.
2. The module is used by the API (source of truth), the scheduler (who to remind), and the client (previews only, never saved).
3. Correctness is defined by the golden suite in SPEC.md section 11. Every rule in SPEC.md section 5 has tests.
4. Dates are handled as calendar dates in the household timezone. The module never uses the server's or browser's local zone implicitly.
5. The app is connected-use only in v1. No offline storage, no service-worker caching of data.

## Consequences

- The module is small and easy to test, so the golden suite can be run against both this module and the iOS Swift logic to confirm parity.
- Pure functions make the scheduler's "is this reminder due?" question testable without a real clock or database.
- Offline use would need a second, client-side storage and sync design. Deferred. If it becomes important, it gets its own ADR.
