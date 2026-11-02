# ADR-0007: Routines carry free-form tags and places; the dashboard offers several lenses

Status: Accepted
Date: 2026-11-02

## Context

The iOS app gives each routine a single room, and the Routines list groups by that room. Tony's view is that this is too rigid. "Hoover" covers the living room, bedroom, kitchen and hall at once. "Clean the bathroom" is about cleaning, but also about bathrooms. Some jobs are about a category of work rather than a place ("bedding", "food safety", "appliances"), and some have no place at all ("Take the bins out").

A single hierarchy (room, then task) forces a choice that doesn't match how a household thinks about its jobs. The dashboard needs to answer several questions: what's overdue, what's in the kitchen, what's all the cleaning, what's due this week.

## Decision

1. **Tags** are free-form categories for a routine, zero or more. They describe the kind of work ("cleaning", "laundry", "food-safety"). There is no fixed list and no hierarchy.
2. **Places** are the rooms or areas the routine touches, zero or more. A routine can cover many places ("Hoover" covers four). A routine with no places is shown as "Anywhere".
3. The Outstanding dashboard offers **lenses**: different groupings of the same outstanding items. The lenses in v1 are When (overdue, today, tomorrow, later), Category (by tag), Place (by place), Person (by assignee), and Cadence (how often the routine recurs).
4. A routine **appears under every heading that applies** to it. A grouping is a view, not a filing system, so one routine can show in several groups. The page says so.
5. The lenses are computed from the same outstanding list, so they always agree on which items are due and how late they are.

## Consequences

- The `room` column from the iOS model becomes a `places` relation. Migration from iOS data would map each room to one place. (No migration is needed yet: the web app has no data.)
- The data model in SPEC.md section 7 changes to join tables for tags and places. Tags and places are both many-to-many.
- Tag and place names are free text, so typos create new categories. Mitigation: the editor offers existing names first. Renaming and merging names is a later feature.
- Group counts will not add up to the total, because items can appear more than once. The UI must not present group counts as a sum.
- Lenses are a read-only view in v1. Adding a new lens is a code change, not a data change, so the set stays small and reviewed.
- Cadence buckets (1–3, 4–14, 15–45, 46+ days) are a judgement call. They may need tuning once Tony has used the dashboard for a while.
