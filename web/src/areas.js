// Routines belong to an area (ADR-0017). Self care and pets is shown only while the household
// setting is on. Pure functions.

/** The areas, in the order they are listed. The label is the only place the name is set. */
export const AREAS = [
  { id: 'house', label: 'House' },
  { id: 'care', label: 'Self care and pets' },
];

export const CARE_LABEL = 'Self care and pets';

/** @param {string|undefined} area */
export function areaLabel(area) {
  return area === 'care' ? CARE_LABEL : 'House';
}

/**
 * The routines to show. House routines always show. Self care and pets show only when switched on.
 * @param {Array<{area?: string}>} routines
 * @param {boolean} selfCareOn
 */
export function visibleRoutines(routines, selfCareOn) {
  return routines.filter((r) => (r.area ?? 'house') === 'house' || selfCareOn);
}
