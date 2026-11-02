// The calendar (SPEC 6.12, ADR-0016). Projects future due dates with the schedule rules from
// section 5, treating each occurrence as done on the day it falls due. A forecast, not a plan.
import { addDays, daysInMonth, parts, weekday, ymd } from './dates.js';
import { completionsFor, nextDue } from './schedule.js';
import { nextOccurrence } from './holidays.js';

/** How many days the calendar shows, counting today. One constant to change the range (ADR-0016). */
export const CALENDAR_DAYS = 365;

/** Load levels from SPEC 6.12: free, 1 to 2, 3 to 4, and 5 or more. */
export const LOAD_LEVELS = [
  { id: 'free', min: 0, max: 0, label: 'Free' },
  { id: 'light', min: 1, max: 2, label: '1 to 2 tasks' },
  { id: 'busy', min: 3, max: 4, label: '3 to 4 tasks' },
  { id: 'heavy', min: 5, max: Infinity, label: '5 or more tasks' },
];

/** @param {number} count tasks due on the day */
export function loadLevel(count) {
  return LOAD_LEVELS.find((l) => count >= l.min && count <= l.max).id;
}

/**
 * Every due date of one routine from `from` to `to`, inclusive. An occurrence still outstanding
 * on `from` is listed on `from` once, and the forecast carries on from there.
 * @param {Object} routine
 * @param {Array<any>} completions this routine's completions only
 */
export function projectDue(routine, completions, from, to) {
  const dates = [];
  const history = [...completions];
  let due = nextDue(routine, history);
  while (due <= to) {
    const day = due < from ? from : due;
    dates.push(day);
    history.push({ routineId: routine.id, doneOn: day, dueOn: day, skipped: false });
    due = nextDue(routine, history);
  }
  return dates;
}

/**
 * Tasks by day for the calendar range.
 * @param {Object} args
 * @param {Array<any>} args.routines  routines, with targeted ones already expanded (spaces.js)
 * @param {Array<any>} args.completions
 * @param {Array<any>} args.holidays
 * @param {string} args.today
 * @param {number} [args.days]
 * @returns {Map<string, Array<{title: string, kind: 'routine'|'holiday'}>>}
 */
export function buildCalendar({ routines, completions, holidays, today, days = CALENDAR_DAYS }) {
  const to = addDays(today, days - 1);
  const byDay = new Map();
  const add = (date, item) => {
    if (!byDay.has(date)) byDay.set(date, []);
    byDay.get(date).push(item);
  };

  for (const routine of routines) {
    if (routine.paused) continue;
    for (const date of projectDue(routine, completionsFor(completions, routine.id), today, to)) {
      add(date, { title: routine.title, kind: 'routine' });
    }
  }

  // Only booked holidays are tasks for the calendar. Planned ones are not yet a commitment.
  for (const holiday of holidays) {
    if (!holiday.bookedFor) continue;
    let date = nextOccurrence(holiday, today);
    while (date <= to) {
      if (date === holiday.bookedFor) add(date, { title: holiday.name, kind: 'holiday' });
      date = ymd(parts(date).year + 1, holiday.targetMonth, holiday.targetDay);
    }
  }
  return byDay;
}

/**
 * The months the range touches, each with its days laid out Monday first. Days outside the range
 * are null, so a month starts and ends on the right weekday.
 * @returns {Array<{year: number, month: number, weeks: Array<Array<string|null>>}>}
 */
export function monthsInRange(today, days = CALENDAR_DAYS) {
  const to = addDays(today, days - 1);
  const months = [];
  let { year, month } = parts(today);
  const end = parts(to);
  for (;;) {
    const cells = [];
    const first = weekday(ymd(year, month, 1));
    for (let i = 0; i < (first + 5) % 7; i++) cells.push(null);
    for (let day = 1; day <= daysInMonth(year, month); day++) {
      const date = ymd(year, month, day);
      cells.push(date >= today && date <= to ? date : null);
    }
    while (cells.length % 7 !== 0) cells.push(null);
    const weeks = [];
    for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
    months.push({ year, month, weeks });
    if (year === end.year && month === end.month) break;
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
  }
  return months;
}
