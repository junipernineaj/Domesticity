// Calendar dates are 'YYYY-MM-DD' strings in the household timezone.
// All arithmetic is done in UTC on whole days, so no local timezone can move a
// due date. Comparing these strings with < and > gives the right order.

const DAY_MS = 86_400_000;

/** @param {number} y @param {number} m 1-12 @param {number} d */
export function ymd(y, m, d) {
  return new Date(Date.UTC(y, m - 1, d)).toISOString().slice(0, 10);
}

/** @param {string} date */
export function parts(date) {
  const [y, m, d] = date.split('-').map(Number);
  return { year: y, month: m, day: d };
}

/** @param {string} date @param {number} days */
export function addDays(date, days) {
  const { year, month, day } = parts(date);
  return ymd(year, month, day + days);
}

/** Whole days from `from` to `to`; negative when `to` is earlier. */
export function diffDays(from, to) {
  const a = parts(from);
  const b = parts(to);
  return Math.round((Date.UTC(b.year, b.month - 1, b.day) - Date.UTC(a.year, a.month - 1, a.day)) / DAY_MS);
}

/** 1 = Sunday ... 7 = Saturday, the same numbering as Swift's Calendar. */
export function weekday(date) {
  const { year, month, day } = parts(date);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay() + 1;
}

/** @param {number} year @param {number} month 1-12 */
export function daysInMonth(year, month) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** Today's calendar date in the given timezone, e.g. 'Europe/London'. */
export function todayIn(timeZone, now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' })
    .format(now);
}
