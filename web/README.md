# Domesticity Web (Phase 0)

The browser version of Domesticity. This phase covers the scheduling rules, the Outstanding dashboard and the dashboard's multi-lens views, using seeded data in memory. It has no database, no login and no reminders yet.

Specification: [`SPEC.md`](SPEC.md). Decisions: [`docs/adr/`](docs/adr/). Rules for changes: [`GUARDRAILS.md`](GUARDRAILS.md).

## Run

Requires Node 22 or later. No dependencies to install.

```sh
cd web
npm test        # golden scheduling tests and dashboard tests
npm start       # http://localhost:8080
```

Set `PORT` to use another port.

## Layout

- `src/dates.js`: calendar-day arithmetic, in UTC, on `YYYY-MM-DD` strings.
- `src/schedule.js`: scheduling rules from SPEC section 5.
- `src/stats.js`: household on-time rate (SPEC 5.9).
- `src/outstanding.js`: the outstanding list and the lenses (ADR-0007).
- `src/seed.js`: starter routines from the iOS templates, with tags and places added.
- `public/`: the dashboard page.
- `test/`: `schedule.test.js` (golden cases from SPEC section 5), `dashboard.test.js` (outstanding list, lenses, stats).

## Not yet

Persistence, editing routines, people, reminders, login, and the API. See SPEC section 12 for open questions.
