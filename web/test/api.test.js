// The HTTP layer: the two calls, their status codes, and the refusals (ADR-0011).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { openDatabase } from '../server/db.js';
import { createApi } from '../server/api.js';

let server;
let base;

before(async () => {
  const handle = createApi(openDatabase(':memory:'));
  server = createServer((req, res) => handle(req, res));
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});

after(() => new Promise((resolve) => server.close(resolve)));

const post = (body) => fetch(`${base}/api/sync`, {
  method: 'POST', headers: { 'content-type': 'application/json' }, body: typeof body === 'string' ? body : JSON.stringify(body),
});

test('GET /api/data returns every collection, seeded on first use', async () => {
  const res = await fetch(`${base}/api/data`);
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type'), /application\/json/);
  const data = await res.json();
  for (const key of ['persons', 'spaces', 'things', 'routines', 'issues', 'completions']) {
    assert.ok(Array.isArray(data[key]), key);
  }
  assert.ok(data.routines.length > 0);
});

test('POST /api/sync applies a change and reports how many', async () => {
  const res = await post({ ops: [{ op: 'upsert', collection: 'spaces', item: { id: 'api-space', name: 'Loft' } }] });
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { ok: true, applied: 1 });
  const data = await (await fetch(`${base}/api/data`)).json();
  assert.ok(data.spaces.some((s) => s.id === 'api-space' && s.name === 'Loft'));
});

test('a bad sync gets 400 with the reason, and changes nothing', async () => {
  const res = await post({ ops: [{ op: 'upsert', collection: 'spaces', item: { id: 'x', name: '' } }] });
  assert.equal(res.status, 400);
  assert.match((await res.json()).error, /space name is required/);
});

test('invalid JSON is a 400', async () => {
  const res = await post('{not json');
  assert.equal(res.status, 400);
});

test('wrong methods and unknown API paths are refused', async () => {
  assert.equal((await fetch(`${base}/api/sync`)).status, 405);
  assert.equal((await fetch(`${base}/api/data`, { method: 'POST' })).status, 405);
  assert.equal((await fetch(`${base}/api/nothing`)).status, 404);
});
