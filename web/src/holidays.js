// Holiday plans (ADR-0015). A holiday falls on the same day every year. Pure functions, no clock.
import { parts, ymd } from './dates.js';

/**
 * @typedef {Object} Holiday
 * @property {string} id
 * @property {string} name
 * @property {number} targetMonth  1-12
 * @property {number} targetDay    1-31
 * @property {string|null} note
 * @property {string|null} bookedFor  'YYYY-MM-DD' of the occurrence it is booked for
 */

/** The next day the holiday falls on, today included. */
export function nextOccurrence(holiday, today) {
  const { year } = parts(today);
  const thisYear = ymd(year, holiday.targetMonth, holiday.targetDay);
  return thisYear >= today ? thisYear : ymd(year + 1, holiday.targetMonth, holiday.targetDay);
}

/** Booked means booked for the occurrence that is next. Once that day passes, it is planned again. */
export function isBooked(holiday, today) {
  return holiday.bookedFor === nextOccurrence(holiday, today);
}
