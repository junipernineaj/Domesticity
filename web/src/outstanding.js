// The Outstanding dashboard: what needs doing soon, and several ways of looking at it.
//
// A routine is never locked to one category. Each one carries free-form tags
// (categories such as 'cleaning' or 'bedding') and places (rooms or areas, zero or
// more). A lens groups the same items differently, so one routine can appear under
// several headings. See docs/adr/0007-multi-facet-categories.md.
import { diffDays } from './dates.js';
import { completionsFor, nextDue } from './schedule.js';

/**
 * @typedef {Object} Item
 * @property {import('./schedule.js').Routine & { tags: string[], places: string[] }} routine
 * @property {string} dueOn
 * @property {number} days            negative when overdue
 * @property {string|null} assigneeName
 */

/**
 * Routines due within `horizonDays` (overdue ones included), most urgent first.
 * @param {Object} args
 * @param {Array<import('./schedule.js').Routine & { tags: string[], places: string[] }>} args.routines
 * @param {import('./schedule.js').Completion[]} args.completions
 * @param {string} args.today
 * @param {number} [args.horizonDays]
 * @param {Map<string, {name: string}>} [args.persons]
 * @returns {Item[]}
 */
export function outstanding({ routines, completions, today, horizonDays = 7, persons = new Map() }) {
  return routines
    .filter((r) => !r.paused)
    .map((routine) => {
      const dueOn = nextDue(routine, completionsFor(completions, routine.id));
      return {
        routine,
        dueOn,
        days: diffDays(today, dueOn),
        assigneeName: persons.get(routine.assigneeId)?.name ?? null,
      };
    })
    // A renewal shows once it is within its lead time, even when that is longer than the horizon.
    .filter((item) => item.days <= Math.max(horizonDays, item.routine.kind === 'renewal' ? item.routine.leadDays ?? 30 : 0))
    .sort((a, b) => a.days - b.days || a.routine.title.localeCompare(b.routine.title));
}

const WHEN_ORDER = ['Overdue', 'Today', 'Tomorrow', 'In 2–7 days', 'In 8–30 days', 'Later'];
const CADENCE_ORDER = ['Every 1–3 days', 'Every 4–14 days', 'Every 15–45 days', 'Every 46+ days', 'Weekly on set days', 'Monthly on a set day', 'Renewals'];

function whenKey(days) {
  if (days < 0) return 'Overdue';
  if (days === 0) return 'Today';
  if (days === 1) return 'Tomorrow';
  if (days <= 7) return 'In 2–7 days';
  if (days <= 30) return 'In 8–30 days';
  return 'Later';
}

function cadenceKey(routine) {
  if (routine.kind === 'weekly') return 'Weekly on set days';
  if (routine.kind === 'monthly') return 'Monthly on a set day';
  if (routine.kind === 'renewal') return 'Renewals';
  const n = routine.intervalDays ?? 7;
  if (n <= 3) return 'Every 1–3 days';
  if (n <= 14) return 'Every 4–14 days';
  if (n <= 45) return 'Every 15–45 days';
  return 'Every 46+ days';
}

/**
 * A way of looking at the outstanding items. `keys` may return several headings,
 * which is how one routine can sit under more than one group.
 * @type {Array<{id: string, label: string, keys: (item: Item) => string[], order?: string[]}>}
 */
export const LENSES = [
  { id: 'when', label: 'When', keys: (i) => [whenKey(i.days)], order: WHEN_ORDER },
  { id: 'category', label: 'Category', keys: (i) => i.routine.tags.length ? i.routine.tags : ['Untagged'] },
  { id: 'place', label: 'Place', keys: (i) => i.routine.places.length ? i.routine.places : ['Anywhere'] },
  { id: 'person', label: 'Person', keys: (i) => [i.assigneeName ?? 'Anyone'] },
  { id: 'cadence', label: 'Cadence', keys: (i) => [cadenceKey(i.routine)], order: CADENCE_ORDER },
];

/**
 * Groups items under one lens. Unordered lenses put the groups with the most overdue
 * items first, then the biggest groups.
 * @param {Item[]} items
 * @param {typeof LENSES[number]} lens
 */
export function group(items, lens) {
  const byKey = new Map();
  for (const item of items) {
    for (const key of lens.keys(item)) {
      if (!byKey.has(key)) byKey.set(key, []);
      byKey.get(key).push(item);
    }
  }

  const groups = [...byKey].map(([key, groupItems]) => ({
    key,
    items: groupItems,
    overdue: groupItems.filter((i) => i.days < 0).length,
  }));

  if (lens.order) {
    const rank = (key) => {
      const index = lens.order.indexOf(key);
      return index === -1 ? lens.order.length : index;
    };
    groups.sort((a, b) => rank(a.key) - rank(b.key) || a.key.localeCompare(b.key));
  } else {
    groups.sort((a, b) => b.overdue - a.overdue || b.items.length - a.items.length || a.key.localeCompare(b.key));
  }
  return groups;
}
