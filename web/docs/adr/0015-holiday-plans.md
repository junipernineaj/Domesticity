# ADR-0015: Holiday plans fall on a fixed day each year, and stay outstanding until booked

Status: Accepted (2 Nov 2026). Phase 3 step. Amends ADR-0009: holidays are not issues, and planned holidays appear on Outstanding. Builds SPEC 6.11 (holiday plans).
Date: 2026-11-02

## Context

The household has three occasions held once a year, each with a fixed day:

- Tony's Birthday, 26 April
- Wedding Anniversary, 11 September
- Christmas, 24 December

Each one has to be planned, then booked. Until it is booked it should be visible as outstanding, and it should be visible well ahead, so it is not missed until a reminder.

ADR-0009 kept snags and nice to haves apart from routines and fixed the issue kinds at two. A holiday is neither, so it gets its own collection.

## Decision

1. **A `holidays` collection,** not an issue kind. Each holiday has a name, a fixed month and day, an optional note, and the date it is booked for. ADR-0009's two issue kinds stay as they are.
2. **Listed under Nice to haves,** in a "Holiday plans" section above the issues. The section shows the next date, planned or booked, a note, and a button to book or unbook.
3. **Next occurrence.** A holiday falls next on its day, this year if the day is still ahead, otherwise next year.
4. **Booking.** Booking sets `booked_for` to the next occurrence. The server refuses a date that is not the holiday's own day. A booking counts only while it matches the next occurrence, so it lapses by itself once the day has passed and the holiday is planned again for next year.
5. **Outstanding.** A planned holiday is outstanding. It appears in the 7 and 30 day views when it is in range, and in Next quarter and Next year on Cadence once it is further off. It is grouped under "Holidays" in the Cadence lens. A booked holiday is not outstanding.
6. **Activity log.** Adding, changing, booking and unbooking are logged, as with other items (SPEC 6.10).
7. **Seeding.** Migration 0005 creates the three holidays, so an existing database gets them without a reseed. The migration seeds data, which is the only case of that.
8. **Booked holidays are busy days** for the calendar (SPEC 6.12). That is built with the calendar, not here.

## Consequences

- The issues validator and ADR-0009's kinds are unchanged.
- Holidays take part in Outstanding through the same window rules as routines, so they show in Next quarter and Next year without special cases.
- A holiday has no cadence, Done or Skip action. It is booked or planned, and nothing else.
- Holidays do not appear on the Status page yet.
