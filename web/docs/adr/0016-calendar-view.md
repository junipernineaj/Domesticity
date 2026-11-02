# ADR-0016: The calendar projects due dates forward and colours each day by its load

Status: Accepted (2 Nov 2026). Phase 4. Builds SPEC 6.12.
Date: 2026-11-02

## Context

Tony wants to see the year ahead at a glance: which days are busy, and which are free for guests. Routines are due on rules that depend on when they were last done, so the future is a forecast, not a stored plan.

## Decision

1. **Projection.** Each routine's future due dates come from the schedule rules (SPEC section 5). Each occurrence is treated as done on the day it falls due, so the next one is worked out from there. Early or late completions change the forecast when they happen, as the calendar is recalculated on every load.
2. **Overdue routines** fall on today, once. They are not piled onto later days.
3. **Range.** Twelve months from today. The range is one constant in `src/calendar.js`, so 18 months is a one-line change later.
4. **Load.** The number of tasks on a day: each projected routine due that day, plus each booked holiday that falls on that day. Planned holidays are not load, and snags have no date so they are not shown. Colours (SPEC 6.12): free 0 (green), 1 to 2 (amber), 3 to 4 (red), 5 or more (deeper red).
5. **Booked holidays are busy days** (ADR-0015). Counting one as a task means a day with a booked holiday is never green.
6. **Where it is computed.** In the browser, from the working copy. It is a preview and nothing is saved from it, so it does not break the rule that the server is the source of truth for due dates (GUARDRAILS, scheduling). The same functions as the server-side rules are used, and the golden tests cover them.
7. **Selecting a day** lists the tasks and booked holidays on it, below the calendar.

## Consequences

- The calendar shows the forecast, not a commitment. A late completion moves the days after it.
- Routines expanded from targets (for example each toilet) each count as a task, as they do on Outstanding.
- The calendar and Outstanding use the same projection, so a day's count matches what Outstanding lists for that day.
