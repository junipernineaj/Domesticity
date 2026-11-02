# Domesticity Web: Specification

Status: Draft v0.6, 2 Nov 2026 (v0.2: tags and places replace the single room; Outstanding dashboard added. v0.3: snags and nice-to-haves, ADR-0009. v0.4: routine descriptions. v0.5: snag severity, RAG colours, assignees, reopen. v0.6: separate severity and RAG, cost and effort sliders, images, activity log)
Owner: Tony
Related: `docs/adr/` (decisions), `GUARDRAILS.md` (rules for changing this codebase)

## 1. Problem

A household has many small recurring jobs (change the sheets, water the plants, clean the fridge). They are easy to forget and hard to track. Domesticity brings each job up when it is due, reminds the household, and shows how reliably the jobs get done.

The iOS app (`junipernineaj/domesticity`) solves this for one phone. This spec moves it to a browser app served from junipernine.com, usable on iPhone and desktop.

## 2. Goals and non-goals

### Goals (v1)
- **iOS parity.** Every user-facing feature of the iOS app works in the web app, except where the platform makes it impossible (see section 9).
- **Single user** for now, with the data model ready for more people later.
- **Reminders** via Web Push, sent on time even when the app is closed.
- **Connected use.** The app assumes a network connection. No offline mode in v1.
- **Same scheduling semantics** as the iOS app, verified by a shared test suite.

### Non-goals (v1)
- Multi-user or household sharing (designed for, not built).
- Native iOS or Android apps.
- Offline editing or caching.
- Public sign-up or multiple households.
- Integrations (calendars, smart speakers).

## 3. Users

One owner (Tony). Optionally, later, household members who are added as People and credited for completions.

## 4. Core concepts

- **Routine**: a recurring job with a title, icon, notes, tags, places, a schedule, reminder settings, and a paused flag.
- **Tag**: a free-form category for a routine ("cleaning", "bedding", "food-safety"). A routine can have none or many. There is no fixed list and no hierarchy. See ADR-0007.
- **Place**: a room or area a routine touches ("Kitchen", "Hall", "Garden"). A routine can have none ("Anywhere") or many: "Hoover" covers four places.
- **Schedule**: one of three kinds:
  - *Every N days*: interval routines.
  - *Weekly*: on chosen weekdays.
  - *Monthly*: on a chosen day of the month.
- **Completion**: a record that a routine was done. It stores when it was done, which due date it satisfied, whether it was a skip, and who did it.
- **Skip**: moves the routine on without counting for or against the stats.
- **Person**: a household member. Completions are credited to one person or to nobody.

## 5. Scheduling rules (normative)

These rules are the definition of correct behaviour. They match the iOS app. Every rule below must have at least one test in the golden suite (section 11).

**5.1 Every N days.** Next due = last completed day + N days, where N ≥ 1. Completing late does not create a backlog; the next due is counted from the day it was actually done. A routine with no completions is due on its start date. The "last completed day" is the most recent completion of any kind, skips included, because a skip moves the routine on (this matches the iOS code, `Chore.nextDue`). Weekly and monthly routines use the same rule through section 5.4.

**5.2 Weekly.** Due on the chosen weekdays. A completion covers the slot that was due when it was recorded. The next slot is the first chosen weekday strictly after the covered slot. If no weekdays are chosen, use the weekday of the start date.

**5.3 Monthly.** Due on the chosen day of the month. Days 29 to 31 fall back to the last day of shorter months. The next slot is the first occurrence on or after the day after the covered slot.

**5.4 Covered slot.** For weekly and monthly routines, a completion covers `max(day done, due date it satisfied)`. This lets Monday's job, done on Sunday, count for Monday.

**5.5 On time.** A non-skipped completion is on time if its done day is on or before its due date.

**5.6 Days until due.** Computed in the household timezone. Negative means overdue, zero means due today.

**5.7 Paused routines** never come up in Today, never count as overdue, and send no reminders.

**5.8 Streak.** Count consecutive on-time, non-skipped completions, most recent first. Skips do not break a streak. A routine that is overdue right now has a streak of zero.

**5.9 On-time rate** over a window (default 30 days): on-time completions divided by (completions in the window + routines overdue right now). Routines overdue right now always count against the rate.

**5.10 Weekly and monthly progress chart** groups completions by ISO week (Monday start, or the locale's first day of week as set in settings) into "On time" and "Late" counts.

## 6. Features

### 6.1 Today
- Three sections: Overdue, Today, Next 7 days, plus a summary line and an "All caught up" state.
- Tick a routine to complete it. Long-press (or context menu) to credit someone else or to skip.
- Empty state links to starter suggestions.

### 6.2 Routines
- List of all routines. Grouping uses the same lenses as the Outstanding dashboard (section 6.8), not a fixed room hierarchy.
- Create, edit, pause, resume, and delete a routine.
- Deleting a routine deletes its completions (with a confirmation). Completions are never deleted otherwise (see GUARDRAILS).
- Editor fields: title, icon, what needs doing (a description, see below), tags (existing names offered first), places (multiple), schedule kind and parameters with preset buttons, reminder on/off and time, assignee, notes, pause toggle.
- **Description** (optional, up to 500 characters): what needs doing, in the words the person doing it will read. It is shown behind an "i" button on the Outstanding dashboard and the Configure list, so the lists stay short. Tapping the button shows or hides it. Only routines have a description in v1; snags and nice to haves do not (ADR-0009).

### 6.3 Starter suggestions
- About 30 templates grouped by room, as in the iOS app's `Templates.swift`.
- Adding a template pre-fills the editor.

### 6.4 Progress
- Overall on-time rate over 30 days, with the count of overdue routines.
- Per-routine streak and on-time rate.
- Weekly chart for the last 12 weeks (on time vs late).

### 6.8 Outstanding dashboard
The home screen for the web app. It shows routines due within a chosen horizon (7 or 30 days), overdue ones included, most urgent first.

- **Summary line:** overdue count, due-today count, and the 30-day on-time rate (section 5.9).
- **Lenses:** the same outstanding items grouped in different ways. The v1 lenses are:
  - *When*: Overdue, Today, Tomorrow, In 2–7 days, In 8–30 days.
  - *Category*: one heading per tag.
  - *Place*: one heading per place, or "Anywhere".
  - *Person*: one heading per assignee, or "Anyone".
  - *Cadence*: Every 1–3 days, Every 4–14 days, Every 15–45 days, Every 46+ days, Weekly on set days, Monthly on a set day.
- **Multi-membership:** a routine appears under every heading that applies. The page says so, and group counts are not presented as a total.
- **Actions:** Done and Skip on each item, which record a completion and refresh the list.
- **Sorting:** groups with the most overdue items come first (lenses without a fixed order). Items inside a group are sorted by due day, then title.

The lenses are pure functions of the outstanding list (`web/src/outstanding.js`), tested in `web/test/dashboard.test.js`.

### 6.9 Snags and nice to haves
Routines come back on a schedule. Problems and ideas don't: they stay open until someone deals with them, so they are kept as a separate list (ADR-0009).

- **Snag:** something wrong or broken, such as "the tap is dripping in the utility room".
- **Nice to have:** an improvement or idea, such as "make curtains to keep the cold out of the lounge".
- Each item has a title, a kind, an optional space, the day it was added, a done day, and an optional image. An item is open until it has a done day.
- **Snag severity:** each snag has one severity, which is separate from its RAG colour:
  - Severity: Cosmetic, Needs fixing soon, or Unsafe.
  - RAG: Red, Amber, or Green. Used for colour coding and for ordering, Red first.
  The two are set independently. They usually correlate, but a snag can be, for example, Unsafe and Amber. Within a RAG colour, oldest first.
- **Snags have no deadline.**
- **Snag assignee:** every snag is either Household or External (a contractor).
- **Nice to have score:** two sliders, Cost and Effort. The score is the average of the two. Nice to haves are not RAG rated. The slider scale and direction are not yet decided.
- **Done** closes an item and moves it off the open lists.
- **Reopen:** a closed snag or nice to have can be reopened, because a fix may not work. Reopening clears the done day. Every close and reopen is recorded in the activity log (6.10).
- **Image:** a snag or nice to have can have an image attached, so the problem or idea can be seen. Images are stored on junipernine2 and served behind the same login as the rest of the app. Upload is not built yet.
- **Status page:** shows the open count for each kind, with the first few titles.
- **Issues page:** lists open items grouped by space, with snags ordered by RAG colour. Filter to snags or nice to haves.
- Issues are not routines. They don't appear in Outstanding, don't send reminders, and don't affect the on-time rate.
- Deleting a space keeps its issues. They move to "Nowhere in particular".
- Issues have no description in v1.
- Not in v1: snags for family members' homes. This idea is recorded in the design record and not designed yet.

The design reasoning is in `web/docs/design/snags-and-nice-to-haves.md`.

### 6.10 Activity log
A record of what happened, newest first, so changes can be traced.

- Records every change made in the app: adding a snag, nice to have or routine, completing or skipping a routine, editing, deleting, and opening or reopening a snag or nice to have.
- Each entry has the time, what happened, and the item it concerns. Routine entries name the routine and, where it applies, the place.
- Entries are only added, never edited or removed (GUARDRAILS: history is never hard-deleted).
- The log is shown newest first, on its own page.

### 6.5 Household (People)
- Add, rename, recolour and delete people.
- "This device belongs to" setting. Stored per browser (see ADR-0005).
- With one owner, the default person is Tony.

### 6.6 Reminders and notifications
Specified in section 8.

### 6.7 Settings
- Household timezone (default Europe/London).
- Week start day (default Monday for a UK household).
- Reminder defaults for new routines.

## 7. Data model

Tables are in PostgreSQL. Every table has `id uuid primary key default gen_random_uuid()` and `created_at timestamptz not null default now()`. Foreign keys use `ON DELETE` rules noted below. No nullable columns without a reason.

```
person
  id, name text not null, colour text not null, created_at

routine
  id, title text not null, icon text not null default 'sparkles',
  notes text not null default '',
  schedule_kind text not null check (schedule_kind in ('interval','weekly','monthly')),
  interval_days int not null default 7 check (interval_days >= 1),
  weekday_mask int not null default 0 check (weekday_mask between 0 and 127),
  day_of_month int not null default 1 check (day_of_month between 1 and 31),
  start_date date not null,
  reminders_on boolean not null default true,
  reminder_time time not null default '09:00',
  paused boolean not null default false,
  assignee_id uuid references person(id) on delete set null

tag
  id, name text unique not null           -- free-form, case-insensitive uniqueness

routine_tag
  routine_id uuid not null references routine(id) on delete cascade,
  tag_id uuid not null references tag(id) on delete cascade,
  primary key (routine_id, tag_id)

place
  id, name text unique not null           -- room or area, free-form

routine_place
  routine_id uuid not null references routine(id) on delete cascade,
  place_id uuid not null references place(id) on delete cascade,
  primary key (routine_id, place_id)

completion
  id, routine_id uuid not null references routine(id) on delete cascade,
  done_on date not null,            -- day in household timezone
  done_at timestamptz not null,
  due_on date not null,             -- the due date this satisfied
  skipped boolean not null default false,
  person_id uuid references person(id) on delete set null

push_subscription
  id, endpoint text unique not null, p256dh text not null, auth text not null,
  user_agent text, last_seen_at timestamptz

settings (single row)
  timezone text not null default 'Europe/London',
  week_start smallint not null default 2   -- 1 = Sunday, 2 = Monday (Calendar convention)

reminder_log
  routine_id, kind text check (kind in ('due','late','overdue')), fire_date date,
  primary key (routine_id, kind, fire_date)   -- prevents duplicate sends
```

Notes:
- Dates that matter for scheduling (`done_on`, `due_on`, `start_date`) are `date`, not `timestamptz`. This avoids timezone bugs in the due arithmetic. `done_at` is kept for history only.
- `weekday_mask` uses the same bit layout as iOS: bit `(weekday - 1)` where 1 = Sunday.
- Tags and places are many-to-many (ADR-0007). A tag or place that no routine uses is removed. Renaming a tag or place changes it for every routine that has it.
- The iOS app's single `room` maps to one place per routine when data is migrated. The web app has no data to migrate yet.

## 8. Reminders

### 8.1 Mechanism
- Web Push with VAPID keys, sent from the server.
- The server runs a scheduler every minute. For each active routine, it decides whether a reminder is due and sends it.
- `reminder_log` makes sends idempotent: a reminder is never sent twice for the same routine, kind and date.

### 8.2 Schedule (as iOS)
- **Due**: on the due date at `reminder_time`, kind `due`.
- **Late**: the day after the due date at `reminder_time`, kind `late`, if still not done.
- **Overdue**: from the day after that, daily at `reminder_time`, kind `overdue`, until done or paused.

### 8.3 Content
- Title: the routine title.
- Body: "Due today · {places, or Anywhere}", "Still to do – it was due yesterday", or "Overdue – was due {date}".
- Tag: `chores`, so new reminders replace old ones for the same routine.

### 8.4 Badge
- Set the app badge to the number of routines due today or overdue, where the platform supports it.

### 8.5 iOS limitations (accepted)
- Web Push on iOS works only for a web app installed to the Home Screen, and only after a user gesture to ask for permission.
- The "Mark done" action button from iOS is not available. Tapping a notification opens the Today page, where one tap completes the routine. This is a known parity gap.
- Notifications on iOS may be delayed or grouped by the OS.

### 8.6 Failure handling
- Expired subscriptions (HTTP 404 or 410 from the push service) are deleted.
- Other failures are retried on the next minute tick, up to the day's send window.

## 9. Platform parity table

| iOS feature | Web v1 | Notes |
|---|---|---|
| Today, Routines, Progress, Household | Yes | |
| Schedule kinds, skip, pause | Yes | Same rules (section 5) |
| Templates | Yes | |
| Reminders with due/late/overdue | Yes | Web Push |
| "Mark done" action on notification | No | Platform limit on iOS Safari (8.5) |
| Badge count | Yes | Where supported |
| CloudKit household sharing | No | Future (ADR-0005) |
| Local (offline) data | No | Connected use assumed (ADR-0003) |
| Rooms (single room per routine) | Changed | Tags and places, many per routine (ADR-0007) |
| Routines grouped by room | Changed | Lenses on the Outstanding dashboard (section 6.8) |
| Outstanding dashboard | New | Not in iOS: multi-lens view of what's due |

## 10. Architecture overview

```
Browser (PWA)  ──HTTPS──▶  Cloudflare Tunnel  ──▶  junipernine2
                                                   ├─ API server (routines, completions, stats)
                                                   ├─ Scheduler (minute tick, sends push)
                                                   └─ PostgreSQL
junipernine.com (static landing page) ─ Cloudflare Pages
```

- The API is the only writer to the database. The scheduler is a separate process (or task) on the same host.
- The web client is a static bundle served from the app subdomain.
- Scheduling logic lives in one shared module used by the API, the scheduler, and the client-side previews, so the rules can't drift apart (ADR-0003).

Decision records for each of these are in `docs/adr/`.

## 11. Testing

- **Golden scheduling suite.** Table-driven tests of section 5 with fixed clocks and fixed timezones. Includes the edge cases: month-end fallback, Feb 29, weekly completion early and late, interval completion late, overdue streaks, skip not breaking streaks, paused routines.
- **Port parity check.** The same golden cases are run against the iOS Swift logic where practical, to confirm the rules match. Before the web version ships, any mismatch is resolved in the spec, not in code.
- **API tests** against a real PostgreSQL instance (not mocks).
- **Reminder tests.** Given a clock and a set of routines, the scheduler produces the expected sends and no duplicates.
- **Manual checks** on iPhone (installed PWA) for notification permission and delivery.

## 12. Open questions

1. Stack for the API, scheduler and full client (ADR-0006: Phase 0 is dependency-free JavaScript; TypeScript or Python for the rest is still open).
2. Whether the iOS app's reminder-timing rule (overdue daily at the reminder time) is what Tony still wants, or whether overdue should be a weekly nag.
3. Where the Web Push VAPID private key is stored on junipernine2 (environment file with restricted permissions is the working assumption).
