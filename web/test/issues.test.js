import { test } from 'node:test';
import assert from 'node:assert/strict';
import { groupIssuesBySpace, issueCounts, openIssues } from '../src/issues.js';

const issue = (over) => ({ id: over.id, kind: 'snag', title: 'x', spaceId: null, addedOn: '2026-11-01', doneOn: null, ...over });

const issues = [
  issue({ id: 'a', kind: 'snag', title: 'Tap dripping', spaceId: 'utility', addedOn: '2026-10-28' }),
  issue({ id: 'b', kind: 'nice', title: 'Curtains for the lounge', spaceId: 'lounge', addedOn: '2026-10-20' }),
  issue({ id: 'c', kind: 'snag', title: 'Gutter loose', spaceId: 'garden', addedOn: '2026-10-30', doneOn: '2026-11-01' }),
  issue({ id: 'd', kind: 'snag', title: 'Loose tile', spaceId: 'deleted-space', addedOn: '2026-10-29' }),
  issue({ id: 'e', kind: 'nice', title: 'Shelf in the hall', spaceId: null, addedOn: '2026-10-25' }),
];

const spaces = [
  { id: 'lounge', name: 'Lounge' },
  { id: 'utility', name: 'Utility room' },
  { id: 'garden', name: 'Garden' },
  { id: 'hall', name: 'Hall' },
];

test('openIssues leaves out done issues and sorts oldest first', () => {
  assert.deepEqual(openIssues(issues).map((i) => i.id), ['b', 'e', 'a', 'd']);
});

test('openIssues filters by kind', () => {
  assert.deepEqual(openIssues(issues, 'snag').map((i) => i.id), ['a', 'd']);
  assert.deepEqual(openIssues(issues, 'nice').map((i) => i.id), ['b', 'e']);
});

test('issueCounts counts open snags and nice-to-haves only', () => {
  assert.deepEqual(issueCounts(issues), { snags: 2, nice: 2 });
  assert.deepEqual(issueCounts([]), { snags: 0, nice: 0 });
});

test('closing an issue drops it from the count', () => {
  const closed = issues.map((i) => (i.id === 'a' ? { ...i, doneOn: '2026-11-02' } : i));
  assert.deepEqual(issueCounts(closed), { snags: 1, nice: 2 });
});

test('groupIssuesBySpace keeps space order, skips empty spaces, and puts loose issues last', () => {
  const groups = groupIssuesBySpace(issues, spaces).map((g) => [g.key, g.items.map((i) => i.id)]);
  assert.deepEqual(groups, [
    ['Lounge', ['b']],
    ['Utility room', ['a']],
    ['Nowhere in particular', ['e', 'd']],
  ]);
});

test('groupIssuesBySpace returns nothing when every issue is done', () => {
  const allDone = issues.map((i) => ({ ...i, doneOn: '2026-11-02' }));
  assert.deepEqual(groupIssuesBySpace(allDone, spaces), []);
});
