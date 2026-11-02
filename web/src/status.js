// The landing page's counts: what is overdue, due today, and coming up.
// Built on the same outstanding list as the dashboard, so the numbers always agree.
import { outstanding } from './outstanding.js';

/**
 * @param {Object} args
 * @param {Array<any>} args.routines
 * @param {Array<any>} args.completions
 * @param {string} args.today
 * @param {number} [args.comingUpDays]  how far ahead "coming up" looks (default 7)
 */
export function status({ routines, completions, today, comingUpDays = 7 }) {
  const items = outstanding({ routines, completions, today, horizonDays: comingUpDays });
  return {
    overdue: items.filter((i) => i.days < 0),
    dueToday: items.filter((i) => i.days === 0),
    comingUp: items.filter((i) => i.days >= 1),
  };
}
