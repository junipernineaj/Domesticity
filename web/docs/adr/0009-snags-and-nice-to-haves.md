# ADR-0009: Snags and nice-to-haves are an open list, separate from routines

Status: Accepted
Date: 2026-11-02

## Context

Routines are things that come back on a schedule: change the sheets every week, clean the fridge every month. Each one is ticked off when done and comes back again.

Tony also needs to record two other kinds of thing, and neither fits a routine:

- **Snags**: something is wrong or broken. "The tap is dripping in the utility room." It stays wrong until someone fixes it, and it has no cycle.
- **Nice to haves**: an improvement for later. "Make curtains to keep the cold out of the lounge." It is a backlog item, not a chore.

If these were routines, a snag would show as "due" on a schedule, and a one-off fix would have a fake interval. The on-time rate would also be polluted by items that were never meant to be on time.

## Decision

1. **Issues are a separate list.** An issue has a kind (`snag` or `nice`), a title, an optional space, the day it was added, and an optional done day. It is open until it has a done day.
2. **Kinds are fixed and few.** Two kinds only. Tags and free text cover the rest.
3. **Issues are not routines.** They have no schedule, don't appear in Outstanding, and don't count towards the on-time rate.
4. **Open counts appear on the Status page**, one for snags and one for nice-to-haves, so they're visible at a glance.
5. **Deleting a space keeps its issues.** They move to "Nowhere in particular" so a snag isn't lost by accident.

## Consequences

- The data model gains an `issues` collection (SPEC.md section 7), with the space as an optional reference.
- Done is one-way in v1. Reopening an issue is not built yet.
- Snags and nice-to-haves don't send reminders in v1. If Tony wants a snag to nag him, that is a later decision.
