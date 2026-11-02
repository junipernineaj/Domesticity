import { test } from 'node:test';
import assert from 'node:assert/strict';
import { closedIssues, groupIssuesBySpace, issueCounts, openIssues } from '../src/issues.js';
import { scoreOf } from '../src/issues-rules.js';

const snag = (over) => ({ kind: 'snag', title: 'x', spaceId: null, addedOn: '2026-11-01', doneOn: null, severity: 'soon', rag: 'amber', assignee: 'household', ...over });
const nice = (over) => ({ kind: 'nice', title: 'x', spaceId: null, addedOn: '2026-11-01', doneOn: null, cost: null, effort: null, ...over });

const issues = [
  snag({ id: 'a', title: 'Tap dripping', spaceId: 'utility', rag: 'amber', addedOn: '2026-10-28' }),
  snag({ id: 'd', title: 'Loose tile', spaceId: 'deleted-space', rag: 'red', addedOn: '2026-10-29' }),
  snag({ id: 'f', title: 'Scuff on door', rag: 'green', addedOn: '2026-10-01' }),
  nice({ id: 'b', title: 'Curtains', spaceId: 'lounge', cost: 2, effort: 3, addedOn: '2026-10-20' }),
  nice({ id: 'e', title: 'Shelf in the hall', addedOn: '2026-10-25' }),
  nice({ id: 'g', title: 'Paint the fence', cost: 5, effort: 5, addedOn: '2026-10-02' }),
  snag({ id: 'c', title: 'Gutter loose', spaceId: 'garden', doneOn: '2026-11-01', rag: 'red', addedOn: '2026-10-30' }),
];

const spaces = [
  { id: 'lounge', name: 'Lounge' },
  { id: 'utility', name: 'Utility room' },
  { id: 'garden', name: 'Garden' },
];

test('snags come out Red first, then Amber, then Green, oldest first within a colour', () => {
  assert.deepEqual(openIssues(issues, 'snag').map((i) => i.id), ['d', 'a', 'f']);
});

test('nice to haves come out lowest score first, unscored last, oldest first on a tie', () => {
  assert.deepEqual(openIssues(issues, 'nice').map((i) => i.id), ['b', 'g', 'e']);
});

test('scores are the average of cost and effort', () => {
  assert.equal(scoreOf({ cost: 2, effort: 3 }), 2.5);
  assert.equal(scoreOf({ cost: 5, effort: 5 }), 5);
  assert.equal(scoreOf({ cost: null, effort: 4 }), null);
});

test('closed items come out most recently closed first', () => {
  const closed = [...issues, snag({ id: 'h', title: 'Old', doneOn: '2026-10-15' })];
  assert.deepEqual(closedIssues(closed).map((i) => i.id), ['c', 'h']);
});

test('issueCounts counts open snags and nice to haves only', () => {
  assert.deepEqual(issueCounts(issues), { snags: 3, nice: 3 });
  assert.deepEqual(issueCounts([]), { snags: 0, nice: 0 });
});

test('reopening an item brings it back into the open counts', () => {
  const reopened = issues.map((i) => (i.id === 'c' ? { ...i, doneOn: null } : i));
  assert.equal(issueCounts(reopened).snags, 4);
});

test('groupIssuesBySpace keeps space order, skips empty spaces, and puts loose issues last', () => {
  const groups = groupIssuesBySpace(issues, spaces).map((g) => [g.key, g.items.map((i) => i.id)]);
  assert.deepEqual(groups, [
    ['Lounge', ['b']],
    ['Utility room', ['a']],
    ['Nowhere in particular', ['d', 'f', 'g', 'e']],
  ]);
});
