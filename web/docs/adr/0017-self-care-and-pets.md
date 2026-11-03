# ADR-0017: Self care and pets are a second area of routines, switched on and off

Status: Accepted (3 Nov 2026). Builds SPEC 6.13.
Date: 2026-11-03

## Context

The app tracks care of the house. Tony also wants the same routines for care of himself: brushing teeth, cutting hair, showering, clipping toenails, eye tests, vaccinations. The dogs need the same, so "Personal" would be the wrong name. Each person may not want this area, so it has to be switched on and off.

## Decision

1. **Routines have an area.** `area` is `house` (the default, and what all existing routines are) or `care`. Care is labelled "Self care and pets" in the app. The label is one constant, so it can be renamed without touching data.
2. **The same model applies.** A care routine has the same schedules, completions, skips, assignees, notes and activity log as a house routine. Nothing new is needed for the rules.
3. **Switched by a household setting** (`settings` collection, one row, `household`). It is off by default, so nothing changes until someone switches it on.
4. **When off, care routines are hidden everywhere:** Outstanding, the Status page, the calendar, the on-time rate and the Configure list. They are not deleted, so switching back on restores them with their history.
5. **Shared, not per browser.** The setting is household-wide and synced, so every device agrees. Changing it is logged in the activity log.
6. **Dogs are routines for now.** A routine such as "Walk the dogs" is a care routine. Repeating a task for each dog, as with toilets, needs a list of dogs, which is not built yet.
7. **No starter care routines.** The seed is for new databases only, and care tasks are for the household to add.

## Consequences

- Migration 0006 adds `routines.area` (default `house`) and the `settings` table with the setting off.
- The Configure page has a switch at the top. The Area field appears on the routine editor only while the setting is on.
- The on-time rate and streaks count care routines only while they are visible.
