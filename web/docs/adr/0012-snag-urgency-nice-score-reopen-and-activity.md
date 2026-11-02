# ADR-0012: Snag severity and urgency, nice-to-have score, reopen, and the activity log

Status: Accepted (2 Nov 2026). Phase 2. Amends ADR-0009: reopen is now allowed, and snags and nice to haves carry the fields below.
Date: 2026-11-02

## Context

The design record (`docs/design/snags-and-nice-to-haves.md`) settles how snags and nice to haves are rated. This ADR turns those decisions into rules the server enforces.

## Decision

1. **Snags carry three fields, all required:**
   - Severity: `cosmetic`, `soon` (Needs fixing soon) or `unsafe`.
   - Urgency (RAG): `red`, `amber` or `green`. Set independently of severity.
   - Assignee: `household` or `external`.
   Snags have no cost, effort or deadline.
2. **Nice to haves carry two optional scores:** cost and effort, each a whole number from 1 (low) to 5 (high). Their score is the average of the two. A nice to have with either missing has no score, and sorts last. Nice to haves have no severity, urgency or assignee.
3. **Ordering.** Snags sort Red, then Amber, then Green; within a colour, oldest first. Nice to haves sort by score, lowest first (cheapest and easiest first); unscored items last; ties oldest first. Closed items sort most recently closed first.
4. **Reopen.** A closed snag or nice to have can be reopened. Reopening clears its done day. Closing and reopening are both recorded in the activity log.
5. **Activity log.** A table of entries, each with a time, the collection it concerns, and a line of text. The server writes entries itself, inside the same transaction as the change, so an entry always matches a real change. Entries are never edited or deleted (SPEC 6.10). Seeding writes no entries.
   Entries record: items added, changed, closed, reopened and deleted; routines done or skipped, with the space where it applies. Deleting a completion alone is not logged; deleting its routine is.
6. **Reading the log.** The log is read in pages, newest first, through `GET /api/activity`. It is not part of the main data load, because it grows without limit.

## Migration

`0002_snags_nice_activity.sql` adds the columns and the table. Existing snags are given severity `soon`, urgency `amber` and assignee `household`, as the seed does, so they are valid. Existing nice to haves have no scores until they are rated.

## Consequences

- The server rejects a snag without severity, urgency or assignee, and a nice to have with any of them.
- Logging inside the write transaction means the log and the data cannot disagree.
- Reopen keeps the full history, so nothing needs a separate history table for issues.
- Images are not in this ADR. They follow as their own phase-2 step, with storage and serving decided then.
