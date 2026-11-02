// Household-level progress, from SPEC.md section 5.9.
import { addDays } from './dates.js';
import { completionsFor, daysUntilDue, isOnTime } from './schedule.js';

/**
 * Success over a recent window. Routines overdue right now count against the rate,
 * so ignoring a job can't flatter the score.
 * @param {import('./schedule.js').Routine[]} routines
 * @param {import('./schedule.js').Completion[]} completions
 * @param {string} today
 * @param {number} [windowDays]
 */
export function householdStats(routines, completions, today, windowDays = 30) {
  const since = addDays(today, -windowDays);
  const done = completions.filter((c) => !c.skipped && c.doneOn >= since);
  const onTimeCount = done.filter(isOnTime).length;
  const overdueNow = routines.filter(
    (r) => !r.paused && daysUntilDue(r, completionsFor(completions, r.id), today) < 0,
  ).length;
  const total = done.length + overdueNow;
  return {
    done: done.length,
    onTime: onTimeCount,
    late: done.length - onTimeCount,
    overdueNow,
    onTimeRate: total === 0 ? null : onTimeCount / total,
  };
}
