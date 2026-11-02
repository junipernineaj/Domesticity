// Snags (things that are wrong) and nice-to-haves (ideas for later). See ADR-0009 and ADR-0012.
// An issue is open until it has a doneOn day. Issues are not routines: they have no schedule.
import { RAG_RANK, scoreOf } from './issues-rules.js';

/** The two kinds of issue, in the order they are shown. */
export const ISSUE_KINDS = [
  { id: 'snag', label: 'Snag', plural: 'Snags' },
  { id: 'nice', label: 'Nice to have', plural: 'Nice to haves' },
];

export const SEVERITY_LABELS = { cosmetic: 'Cosmetic', soon: 'Needs fixing soon', unsafe: 'Unsafe' };
export const RAG_LABELS = { red: 'Red', amber: 'Amber', green: 'Green' };
export const ASSIGNEE_LABELS = { household: 'Household', external: 'External (contractor)' };

/**
 * @typedef {Object} Issue
 * @property {string} id
 * @property {'snag'|'nice'} kind
 * @property {string} title
 * @property {string|null} spaceId  null means "Nowhere in particular"
 * @property {string} addedOn       'YYYY-MM-DD'
 * @property {string|null} doneOn   'YYYY-MM-DD' while closed, otherwise null
 * @property {string} [severity]    snags: cosmetic | soon | unsafe
 * @property {string} [rag]         snags: red | amber | green (urgency)
 * @property {string} [assignee]    snags: household | external
 * @property {number|null} [cost]   nice to haves: 1 to 5
 * @property {number|null} [effort] nice to haves: 1 to 5
 */

const oldestFirst = (a, b) => a.addedOn.localeCompare(b.addedOn) || a.title.localeCompare(b.title);

/**
 * Open items in the order they should be worked: snags Red first, then Amber, then Green;
 * nice to haves lowest score first, unscored last. Ties go oldest first.
 */
function compareOpen(a, b) {
  if (a.kind !== b.kind) return a.kind === 'snag' ? -1 : 1;
  if (a.kind === 'snag') {
    const r = (RAG_RANK[a.rag] ?? 3) - (RAG_RANK[b.rag] ?? 3);
    if (r !== 0) return r;
  } else {
    const sa = scoreOf(a);
    const sb = scoreOf(b);
    if (sa !== sb) {
      if (sa == null) return 1;
      if (sb == null) return -1;
      return sa - sb;
    }
  }
  return oldestFirst(a, b);
}

/**
 * Open issues, optionally of one kind, in working order.
 * @param {Issue[]} issues
 * @param {'snag'|'nice'|null} [kind]  null or undefined means both kinds
 */
export function openIssues(issues, kind = null) {
  return issues
    .filter((i) => i.doneOn == null && (kind == null || i.kind === kind))
    .sort(compareOpen);
}

/** Closed issues, most recently closed first. */
export function closedIssues(issues, kind = null) {
  return issues
    .filter((i) => i.doneOn != null && (kind == null || i.kind === kind))
    .sort((a, b) => b.doneOn.localeCompare(a.doneOn) || a.title.localeCompare(b.title));
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
 * Open issues grouped by space, in the order the spaces are listed. Spaces with nothing open
 * are left out. Issues with no space, or with a space that no longer exists, go last.
 * @param {Issue[]} issues
 * @param {Array<{id: string, name: string}>} spaces
 * @returns {Array<{key: string, items: Issue[]}>}
 */
export function groupIssuesBySpace(issues, spaces) {
  const index = new Map(spaces.map((s, n) => [s.id, n]));
  const groups = spaces.map((s) => ({ key: s.name, items: /** @type {Issue[]} */ ([]) }));
  const loose = { key: 'Nowhere in particular', items: /** @type {Issue[]} */ ([]) };

  for (const issue of openIssues(issues)) {
    if (index.has(issue.spaceId)) groups[index.get(issue.spaceId)].items.push(issue);
    else loose.items.push(issue);
  }

  const shown = groups.filter((g) => g.items.length > 0);
  return loose.items.length > 0 ? [...shown, loose] : shown;
}
