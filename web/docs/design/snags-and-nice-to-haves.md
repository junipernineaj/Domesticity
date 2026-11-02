# Snags and nice to haves: design record

2 Nov 2026 · Tony

Living copy: https://claude.ai/artifact/SAf5xibeXKofHht3sEj7yf

This record keeps the reasoning behind the snag and nice-to-have design, so it can be revisited later. It covers what was built, the options considered, and what is still open.

## How we got here

The web app began as a browser copy of the iOS Domesticity app, keeping its scheduling rules. Over several sessions it gained a Status page, an Outstanding dashboard with views by room, day, overdue, category, person and cadence, and a Configure area for routines.

Routines alone did not describe the household's work. Some jobs repeat on a schedule, but others are one-off problems or ideas for later. That gap is what led to snags and nice to haves.

Routines then gained an optional description, shown behind an info button. Storage was discussed next, and ADR-0010 chose a SQLite file over PostgreSQL. Storage is not built yet.

## What is built now

Snags and nice to haves are kept as one open list, separate from routines (ADR-0009). Each item has a title, a kind, an optional space, the day it was added, and a done day. An item stays open until it has a done day.

The Status page shows the open count for each kind, with the first few titles. The Snags page adds items, groups them by space, and offers Done and Remove, with a filter for each kind.

Items have no description, severity, cost or priority yet. They are held in memory only, so they reset when the service restarts.

## Why they are separate from routines

A routine comes back on a schedule and is ticked off each time. A snag stays wrong until someone fixes it, so it has no cycle. A nice to have is an idea that may never be done.

If they were routines, a snag would show as due on some invented interval, and a one-off fix would have a fake repeat. Items that were never meant to be on time would also pull down the on-time rate.

## Snag options

Three ways a snag can move on were considered. They build on each other, so the simplest could be extended later without rework.

| Option | How a snag moves on | What it adds | Trade-off |
| --- | --- | --- | --- |
| Open or done (built) | Open, then done | Simple and clear | Cannot show that a fix is planned or waiting on a part |
| Planned | Reported, then planned with a date, then fixed | Shows the backlog of fixes; a planned snag can become a one-off task with a due date | More states to keep right |
| Severity and age | Any of the above, plus a level (cosmetic, annoying, needs fixing soon, safety) and days open | Shows which problems matter most and which have been open too long | The levels are a judgement call and need agreeing |

## Nice to have options

Three ways of ranking an idea were considered. Each one adds a little more to keep up to date.

| Option | What it records | Trade-off |
| --- | --- | --- |
| Simple list (built) | Items in the order they were added | Nothing to maintain, but no sense of which ideas matter most |
| Priority | A rough rank such as someday, this year, or next | Quick to set and easy to sort |
| Cost and effort | An estimated cost, a rough effort, and optionally a supplier or quote | Useful for planning and budgets, but more to keep current, and it overlaps with the finance planning |

## Other ideas raised

- **Photos:** attach a picture of the problem or the idea. This could tie into the photo library project on junipernine2.
- **Recurring problems:** flag a snag that keeps coming back, such as the same tap or the same damp patch, so it is not fixed and forgotten.
- **Owners:** assign a snag to you or to a contractor, linking to the people already in the app.
- **Notes and history:** a simple log of what was tried and when, as a comment thread on the item.

## Decisions

Recorded 2 Nov 2026, after review with Tony.

- Snags have no deadline.
- Snags have two separate fields. Severity is Cosmetic, Needs fixing soon, or Unsafe. RAG is Red, Amber, or Green, and it is urgency: how soon the item needs attention. They are set independently. They usually correlate, but a snag can be Unsafe and Amber.
- Every snag is assigned to Household or External (a contractor).
- Nice to haves are not RAG rated. They are scored with two sliders, Cost and Effort, each from 1 (low) to 5 (high). The score is the average of the two. Nice to haves list the lowest score first, so the cheapest and easiest ideas can be picked off. This replaces the earlier note that the highest score should come first.
- Snags and nice to haves can be reopened, because a fix may not work.
- The planned status with a date is not wanted, since snags have no deadline. The one-off task idea goes with it.
- An activity log shows every change, newest first. It records adding an item or routine, completing or skipping a routine, editing, deleting, and opening or reopening a snag or nice to have. Entries are never removed, and the log is kept forever.
- Snags and nice to haves can have an image attached, so the problem or idea can be seen. Images are stored on junipernine2 and served behind the same login as the rest of the app.

## Parked idea: family snags

Snags for family members' homes, such as a mother-in-law's kitchen or an aunt's garden. This is recorded only. It needs its own design, including whose home each snag belongs to and who can see it.

## Open questions

None open.

## Annual renewals and holidays

Recorded 2 Nov 2026, from Tony's request. Not built.

- Renewals are bills and subscriptions, such as car insurance and house insurance. Each has its own set date, because renewals vary.
- A renewal can recur every 3 months (quarterly), 6 months (bi-annually), or 12 months (yearly), chosen per item.
- Each renewal has a reminder before it is due. The default lead time is 30 days, and each item can change it.
- Holidays sit under Nice to haves. The default is three a year: April (Tony's Birthday), September (Wedding Anniversary) and December (Christmas). Confirmed by Tony.
- Each holiday has two steps: Planned, then Booked. It stays outstanding until it is Booked.
- Holidays show on the Outstanding dashboard, which changes the rule that issues stay off it (ADR-0009).

### Open questions

None open.

## Calendar view

Recorded 2 Nov 2026, from Tony's request. Not built.

- A calendar of the year, each day coloured by how much is due that day. Completely free days are easy to see.
- Free weekends are the main use: finding weekends for friends and guests.
- Due dates in the future come from projecting each routine and renewal forward. Projections move when a routine is done early or late.

- Booked holidays count as busy days.
- The calendar looks a year ahead, possibly 18 months.

### Open questions

- [ ] What counts as "a lot to do": a count of items, or weighted by time or effort? To be decided from use.
- [ ] Where are the colour thresholds: none, light, busy, heavy? To be decided from use.
