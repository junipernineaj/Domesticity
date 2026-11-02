// Human wording for a routine's schedule, used on the Configure page.
import { parts, weekday } from './dates.js';

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function ordinal(n) {
  const suffixes = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return suffixes[(v - 20) % 10] || suffixes[v] || suffixes[0];
}

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** @param {{kind: string, intervalDays?: number, weekdays?: number[], dayOfMonth?: number, startDate: string, everyMonths?: number}} r */
export function scheduleText(r) {
  if (r.kind === 'renewal') {
    const { day, month } = parts(r.startDate);
    const every = r.everyMonths ?? 12;
    const how = every === 12 ? 'Yearly' : every === 6 ? 'Twice a year' : 'Every 3 months';
    return `${how}, on ${day}${ordinal(day)} ${MONTH_NAMES[month - 1]}`;
  }
  if (r.kind === 'interval') {
    const n = r.intervalDays ?? 7;
    if (n === 1) return 'Every day';
    if (n === 7) return 'Every week';
    if (n % 7 === 0) return `Every ${n / 7} weeks`;
    return `Every ${n} days`;
  }
  if (r.kind === 'weekly') {
    const days = r.weekdays?.length ? [...r.weekdays] : [weekday(r.startDate)];
    if (days.length === 7) return 'Every day';
    days.sort((a, b) => a - b);
    return 'Every ' + days.map((d) => DAY_NAMES[d - 1].slice(0, 3)).join(', ');
  }
  const d = r.dayOfMonth ?? 1;
  return `Monthly on the ${d}${ordinal(d)}` + (d > 28 ? ' (or the last day in shorter months)' : '');
}
