// Scheduling rules from SPEC.md section 5. Pure functions: no clock, no I/O.
// Every date is a calendar day 'YYYY-MM-DD' in the household timezone.
import { addDays, daysInMonth, diffDays, parts, weekday, ymd } from './dates.js';

/**
 * @typedef {'interval'|'weekly'|'monthly'|'renewal'} Kind
 * @typedef {Object} Routine
 * @property {string} id
 * @property {string} title
 * @property {Kind} kind
 * @property {number} [intervalDays]  for 'interval'; N >= 1
 * @property {number[]} [weekdays]    for 'weekly'; 1 = Sunday ... 7 = Saturday
 * @property {number} [dayOfMonth]    for 'monthly'; 1-31, falls back to month end
 * @property {string} startDate       first due day when nothing has been done yet
 * @property {number} [everyMonths]  for 'renewal'; 3, 6 or 12. The set date is startDate (SPEC 5.11)
 * @property {number} [leadDays]      for 'renewal'; reminder lead time, default 30
 * @property {boolean} [paused]
 *
 * @typedef {Object} Completion
 * @property {string} routineId
 * @property {string} doneOn          calendar day it was done
 * @property {string} dueOn           the due day it satisfied
 * @property {boolean} [skipped]      skips move the routine on but don't count in stats
 * @property {string|null} [personId]
 */

/** @param {Completion[]} completions */
export function completionsFor(completions, routineId) {
  return completions.filter((c) => c.routineId === routineId);
}

/** Latest completion by doneOn, skips included (a skip still moves the routine on). */
export function lastCompletion(completions) {
  let last = null;
  for (const c of completions) {
    if (last === null || c.doneOn >= last.doneOn) last = c;
  }
  return last;
}

/**
 * The calendar day this routine is next due.
 * @param {Routine} routine
 * @param {Completion[]} completions this routine's completions only
 */
export function nextDue(routine, completions) {
  const last = lastCompletion(completions);

  if (routine.kind === 'interval') {
    if (!last) return routine.startDate;
    return addDays(last.doneOn, Math.max(1, routine.intervalDays ?? 7));
  }

  // A completion covers the slot that was due when it was recorded, so doing
  // Monday's job on Sunday still counts for Monday. The next slot comes after both.
  let from = routine.startDate;
  if (last) {
    const covered = last.doneOn > last.dueOn ? last.doneOn : last.dueOn;
    const afterCovered = addDays(covered, 1);
    if (afterCovered > from) from = afterCovered;
  }

  if (routine.kind === 'renewal') return renewalSlot(from, routine);
  return routine.kind === 'weekly' ? weeklySlot(from, routine) : monthlySlot(from, routine.dayOfMonth ?? 1);
}

/**
 * The first renewal date on or after `from` (SPEC 5.11). The set date (startDate) fixes both the
 * day of the month and which months the renewal falls in: every `everyMonths` months from its month.
 */
export function renewalSlot(from, routine) {
  const set = parts(routine.startDate);
  const every = routine.everyMonths ?? 12;
  let { year, month } = parts(from);
  for (let i = 0; i < 12 * 5; i++) {
    const monthsFromSet = (year - set.year) * 12 + (month - set.month);
    if (((monthsFromSet % every) + every) % every === 0) {
      const slot = ymd(year, month, Math.min(set.day, daysInMonth(year, month)));
      if (slot >= from) return slot;
    }
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
  }
  return from;
}

/** First chosen weekday on or after `from`. */
export function weeklySlot(from, routine) {
  const days = routine.weekdays?.length ? new Set(routine.weekdays) : new Set([weekday(routine.startDate)]);
  for (let offset = 0; offset < 7; offset++) {
    const day = addDays(from, offset);
    if (days.has(weekday(day))) return day;
  }
  return from;
}

/** The first occurrence of `dayOfMonth` on or after `from`; short months use their last day. */
export function monthlySlot(from, dayOfMonth) {
  let { year, month } = parts(from);
  for (let i = 0; i < 3; i++) {
    const slot = ymd(year, month, Math.min(dayOfMonth, daysInMonth(year, month)));
    if (slot >= from) return slot;
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
  }
  return from;
}

/** Negative when overdue, 0 when due today. */
export function daysUntilDue(routine, completions, today) {
  return diffDays(today, nextDue(routine, completions));
}

/** A completion is on time if it was done on or before its due day. Skips are never on time. */
export function isOnTime(completion) {
  return !completion.skipped && completion.doneOn <= completion.dueOn;
}

/**
 * Consecutive on-time completions, most recent first. Skips don't break a streak;
 * being overdue right now does.
 */
export function streak(routine, completions, today) {
  if (!routine.paused && daysUntilDue(routine, completions, today) < 0) return 0;
  const done = completions
    .filter((c) => !c.skipped)
    .sort((a, b) => (a.doneOn < b.doneOn ? 1 : a.doneOn > b.doneOn ? -1 : 0));
  let count = 0;
  for (const c of done) {
    if (!isOnTime(c)) break;
    count += 1;
  }
  return count;
}

/** On-time share of this routine's non-skipped completions, or null when none. */
export function onTimeRate(completions) {
  const done = completions.filter((c) => !c.skipped);
  if (done.length === 0) return null;
  return done.filter(isOnTime).length / done.length;
}
