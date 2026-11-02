// Snag and nice-to-have rules shared by the server and the browser (ADR-0012).
// The browser has its own copy for display; the server is the one that enforces these.
export const SEVERITIES = ['cosmetic', 'soon', 'unsafe'];
export const RAGS = ['red', 'amber', 'green'];
export const ASSIGNEES = ['household', 'external'];
export const RAG_RANK = { red: 0, amber: 1, green: 2 };

/** Average of cost and effort, or null when either is missing. */
export function scoreOf(issue) {
  if (typeof issue.cost !== 'number' || typeof issue.effort !== 'number') return null;
  return (issue.cost + issue.effort) / 2;
}
