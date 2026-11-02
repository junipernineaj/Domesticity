// Spaces and things: where the work happens, and what is in each place.
//
// A space is a place that needs something doing to it (Bedroom, Car, Front garden).
// A thing is something in a space that gets worked on (a Toilet, an Oven, a Fridge).
//
// A routine with a targetType (for example "Clean the toilet", targetType "Toilet") is
// expanded into one routine per matching thing, so the task says where each toilet is.
// Each expanded routine has its own id, `${routine.id}@${thing.id}`, and so its own history.

const norm = (s) => s.trim().toLowerCase();

/**
 * @param {Array<any>} routines
 * @param {Array<{id: string, name: string}>} spaces
 * @param {Array<{id: string, spaceId: string, type: string}>} things
 * @returns {Array<any>} routines ready for scheduling; targeted ones are expanded
 */
export function expandRoutines(routines, spaces, things) {
  const spaceName = new Map(spaces.map((s) => [s.id, s.name]));
  const expanded = [];
  for (const routine of routines) {
    if (!routine.targetType) {
      expanded.push(routine);
      continue;
    }
    const matches = things.filter((t) => norm(t.type) === norm(routine.targetType));
    for (const thing of matches) {
      const space = spaceName.get(thing.spaceId) ?? 'Unassigned';
      expanded.push({
        ...routine,
        id: `${routine.id}@${thing.id}`,
        baseId: routine.id,
        title: `${routine.title} · ${space}`,
        places: [space],
        thingId: thing.id,
      });
    }
  }
  return expanded;
}
