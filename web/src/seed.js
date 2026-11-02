// Starter data for the dashboard, based on the iOS app's ChoreTemplate list.
// Tags and places are new: a routine can have several of each, or none.
// Nothing is persisted yet; this is rebuilt on every page load.
import { addDays } from './dates.js';

/**
 * @param {string} today
 */
export function seed(today) {
  const persons = [{ id: 'tony', name: 'Tony' }];

  /** @type {Array<{id: string, title: string, kind: 'interval'|'weekly'|'monthly', intervalDays?: number, dayOfMonth?: number, tags: string[], places: string[], lastDoneAgo: number, assigneeId?: string, description?: string}>} */
  const spec = [
    { id: 'sheets', title: 'Change the bed sheets', kind: 'interval', intervalDays: 7, tags: ['laundry', 'bedding'], places: ['Bedroom'], lastDoneAgo: 5 },
    { id: 'pillows', title: 'Wash pillows & duvet', kind: 'interval', intervalDays: 90, tags: ['laundry', 'bedding'], places: ['Bedroom'], lastDoneAgo: 60 },
    { id: 'mattress', title: 'Rotate the mattress', kind: 'interval', intervalDays: 90, tags: ['bedding', 'maintenance'], places: ['Bedroom'], lastDoneAgo: 100 },
    { id: 'fridge', title: 'Clean out the fridge', kind: 'interval', intervalDays: 30, tags: ['kitchen', 'food-safety'], places: ['Kitchen'], lastDoneAgo: 20 },
    { id: 'oven', title: 'Clean the oven', kind: 'interval', intervalDays: 60, tags: ['kitchen', 'cleaning'], places: ['Kitchen'], lastDoneAgo: 40, description: 'Take out the shelves and runners. Spray the oven walls with oven cleaner, leave for 20 minutes, then wipe clean with a damp cloth. Put the shelves back in.' },
    { id: 'microwave', title: 'Clean the microwave', kind: 'interval', intervalDays: 14, tags: ['kitchen', 'cleaning'], places: ['Kitchen'], lastDoneAgo: 14 },
    { id: 'hob', title: 'Wipe down the hob', kind: 'interval', intervalDays: 3, tags: ['kitchen', 'cleaning'], places: ['Kitchen'], lastDoneAgo: 2, description: 'Wipe with a damp cloth once it has cooled. Use hob cleaner for any greasy patches.' },
    { id: 'kettle', title: 'Descale the kettle', kind: 'interval', intervalDays: 30, tags: ['kitchen', 'appliances'], places: ['Kitchen'], lastDoneAgo: 10 },
    { id: 'freezer', title: 'Defrost the freezer', kind: 'interval', intervalDays: 180, tags: ['kitchen', 'food-safety', 'appliances'], places: ['Kitchen'], lastDoneAgo: 150 },
    { id: 'bins', title: 'Take the bins out', kind: 'interval', intervalDays: 7, tags: ['routine', 'outdoors'], places: ['Kitchen'], lastDoneAgo: 6, assigneeId: 'tony' },
    { id: 'bathroom', title: 'Clean the bathroom', kind: 'interval', intervalDays: 7, tags: ['bathroom', 'cleaning'], places: ['Bathroom'], lastDoneAgo: 6 },
    { id: 'toilet', title: 'Clean the toilet', kind: 'interval', intervalDays: 7, tags: ['bathroom', 'cleaning', 'hygiene'], places: [], targetType: 'Toilet', lastDoneAgo: 8 },
    { id: 'towels', title: 'Wash the towels', kind: 'interval', intervalDays: 7, tags: ['laundry', 'bathroom'], places: ['Bathroom', 'Laundry'], lastDoneAgo: 3 },
    { id: 'hoover', title: 'Hoover', kind: 'interval', intervalDays: 7, tags: ['cleaning', 'floors'], places: ['Living room', 'Bedroom', 'Kitchen', 'Hall'], lastDoneAgo: 9, assigneeId: 'tony' },
    { id: 'mop', title: 'Mop the floors', kind: 'interval', intervalDays: 14, tags: ['cleaning', 'floors'], places: ['Kitchen', 'Bathroom', 'Hall'], lastDoneAgo: 4 },
    { id: 'dust', title: 'Dust surfaces', kind: 'interval', intervalDays: 14, tags: ['cleaning', 'dusting'], places: ['Living room', 'Bedroom'], lastDoneAgo: 10 },
    { id: 'smoke', title: 'Test the smoke alarms', kind: 'monthly', dayOfMonth: 1, tags: ['safety', 'maintenance'], places: ['Hall'], lastDoneAgo: 1 },
    { id: 'water', title: 'Water the plants', kind: 'interval', intervalDays: 3, tags: ['garden', 'plants'], places: ['Garden'], lastDoneAgo: 1 },
    { id: 'feed', title: 'Feed the plants', kind: 'interval', intervalDays: 30, tags: ['garden', 'plants'], places: ['Garden'], lastDoneAgo: 25 },
    { id: 'mow', title: 'Mow the lawn', kind: 'interval', intervalDays: 14, tags: ['garden', 'outdoors'], places: ['Garden'], lastDoneAgo: 16 },
    { id: 'washer', title: 'Clean the washing machine', kind: 'interval', intervalDays: 30, tags: ['laundry', 'appliances'], places: ['Laundry'], lastDoneAgo: 28, description: 'Run an empty hot wash with a cleaning tablet. Wipe the door seal and check the drawer for residue.' },
    { id: 'lint', title: 'Empty the tumble dryer lint', kind: 'interval', intervalDays: 3, tags: ['laundry', 'appliances'], places: ['Laundry'], lastDoneAgo: 3 },
  ];

  // Spaces and things: two toilets, in two spaces. "Clean the toilet" expands to one task each.
  const spaces = [
    { id: 'bathroom', name: 'Bathroom' },
    { id: 'downstairs-loo', name: 'Downstairs loo' },
    { id: 'kitchen', name: 'Kitchen' },
    { id: 'bedroom', name: 'Bedroom' },
    { id: 'living-room', name: 'Living room' },
    { id: 'hall', name: 'Hall' },
    { id: 'laundry', name: 'Laundry' },
    { id: 'garden', name: 'Garden' },
    { id: 'utility-room', name: 'Utility room' },
  ];
  const things = [
    { id: 't-toilet-bathroom', spaceId: 'bathroom', type: 'Toilet' },
    { id: 't-toilet-downstairs', spaceId: 'downstairs-loo', type: 'Toilet' },
  ];

  // Snags are things that are wrong; nice to haves are ideas for later (ADR-0009).
  const issues = [
    { id: 'i-tap', kind: 'snag', title: 'Tap is dripping', spaceId: 'utility-room', addedOn: addDays(today, -4), doneOn: null },
    { id: 'i-curtains', kind: 'nice', title: 'Make curtains to keep the cold out', spaceId: 'living-room', addedOn: addDays(today, -20), doneOn: null },
  ];

  const startDate = addDays(today, -400);
  const routines = spec.map(({ lastDoneAgo, ...routine }) => ({
    ...routine,
    startDate,
    weekdays: [],
    paused: false,
  }));

  // One completion per routine, done on time. A targeted routine gets one per matching thing,
  // keyed the same way the expanded routine is (see spaces.js).
  const completions = spec.flatMap((r) => {
    const doneOn = addDays(today, -r.lastDoneAgo);
    const ids = r.targetType
      ? things.filter((t) => t.type.toLowerCase() === r.targetType.toLowerCase()).map((t) => `${r.id}@${t.id}`)
      : [r.id];
    return ids.map((routineId) => ({ routineId, doneOn, dueOn: doneOn, skipped: false, personId: null }));
  });

  return { persons, routines, completions, spaces, things, issues };
}
