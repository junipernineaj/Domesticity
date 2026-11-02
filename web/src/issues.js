// Snags (things that are wrong) and nice-to-haves (ideas for later). See ADR-0009.
// An issue is open until it has a doneOn day. Issues are not routines: they have no schedule.

/** The two kinds of issue, in the order they are shown. */
export const ISSUE_KINDS = [
  { id: 'snag', label: 'Snag', plural: 'Snags' },
  { id: 'nice', label: 'Nice to have', plural: 'Nice to haves' },
];

/**
 * @typedef {Object} Issue
 * @property {string} id
 * @property {'snag'|'nice'} kind
 * @property {string} title
 * @property {string|null} spaceId  null means "Nowhere in particular"
 * @property {string} addedOn       'YYYY-MM-DD'
 * @property {string|null} doneOn   'YYYY-MM-DD' once closed, otherwise null
 */

/** Oldest first, then by title, so the list is stable. */
const oldestFirst = (a, b) => a.addedOn.localeCompare(b.addedOn) || a.title.localeCompare(b.title);

/**
 * Open issues, optionally of one kind, oldest first.
 * @param {Issue[]} issues
 * @param {'snag'|'nice'|null} [kind]  null or undefined means both kinds
 */
export function openIssues(issues, kind = null) {
  return issues
    .filter((i) => i.doneOn == null && (kind == null || i.kind === kind))
    .sort(oldestFirst);
}

/**
 * The counts the Status page shows. Only open issues count.
 * @param {Issue[]} issues
 * @returns {{snags: number, nice: number}}
 */
export function issueCounts(issues) {
  return {
    snags: openIssues(issues, 'snag').length,
    nice: openIssues(issues, 'nice').length,
  };
}

/**
 * Open issues grouped by space, in the order the spaces are listed.
 * Spaces with nothing open are left out. Issues with no space, or with a space that
 * no longer exists, go in a final "Nowhere in particular" group.
 * @param {Issue[]} issues
 * @param {Array<{id: string, name: string}>} spaces
 * @returns {Array<{key: string, items: Issue[]}>}
 */
export function groupIssuesBySpace(issues, spaces) {
  const index = new Map(spaces.map((s, n) => [s.id, n]));
  const groups = spaces.map((s) => ({ key: s.name, items: /** @type {Issue[]} */ ([]) }));
  const loose = { key: 'Nowhere in particular', items: /** @type {Issue[]} */ ([]) };

  for (const issue of [...issues].sort(oldestFirst)) {
    if (issue.doneOn != null) continue;
    if (index.has(issue.spaceId)) groups[index.get(issue.spaceId)].items.push(issue);
    else loose.items.push(issue);
  }

  const shown = groups.filter((g) => g.items.length > 0);
  return loose.items.length > 0 ? [...shown, loose] : shown;
}
