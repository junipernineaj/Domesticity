# ADR-0014: Renewals are a schedule kind with a set date, repeating every 3, 6 or 12 months

Status: Accepted (2 Nov 2026). Phase 3 step. Adds rule 5.11 to SPEC section 5, and builds the renewal part of SPEC 6.11.
Date: 2026-11-02

## Context

Some items come up once or twice a year on a date that belongs to the item: car insurance, house insurance, subscriptions. Each has its own set date, so one shared date does not fit. The existing schedule kinds do not fit either:

- "Every N days" drifts. A year is 365 days, so the date moves by a day in each leap year and would not stay on the same date.
- "Monthly" repeats every month. It cannot express quarterly or twice-yearly.

## Decision

1. **A new schedule kind, `renewal`.** Its set date is the routine's `startDate`. The day of the month comes from that date, and the months it falls in come from the set date's month and the repeat.
2. **Repeat:** `every_months` is 3, 6 or 12. Only renewals have it. Other kinds store null.
3. **Due dates** follow SPEC 5.11: the first matching month on or after the covered slot, using the same month-end fallback and covered-slot rule as monthly (5.3 and 5.4).
4. **Lead time:** `lead_days` is the reminder lead time, default 30, 0 to 365. Only renewals have it. A renewal shows on Outstanding once it is within its lead time, even when that is longer than the Outstanding range. This makes the lead time visible, before reminders exist (ADR-0004).
5. **Cadence lens:** renewals form their own group, "Renewals", as SPEC 6.11 says.
6. **Changing the set date** moves the schedule. The editor says so. Completions are not changed.
7. **Migration 0004** rebuilds the `routines` table. SQLite cannot alter a CHECK constraint, so the kind check has to be rewritten. The migration runs with foreign keys off, which is the only safe way to replace a parent table here. Cascading deletes would otherwise wipe tags, places and history. Foreign key checks run before commit, and the migration rolls back if any fail. A snapshot is taken before it runs (ADR-0010).

## Consequences

- The scheduling rules gain 5.11. Golden tests in `test/renewals.test.js` cover each rule, including leap years, month ends and early or late completion.
- The on-time rate and streak treat renewals like other routines, so a renewal that is overdue counts against the rate. This matches 5.8 and 5.9.
- Reminders for renewals will use `lead_days` when they are built (ADR-0004). Nothing is sent yet.
