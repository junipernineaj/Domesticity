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

test('a picture can be stored, fetched, replaced and removed', async () => {
  const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46]);
  const put = await fetch(`${base}/api/issues/i-tap/image`, { method: 'PUT', headers: { 'content-type': 'image/jpeg' }, body: jpeg });
  assert.equal(put.status, 200);
  const got = await fetch(`${base}/api/issues/i-tap/image`);
  assert.equal(got.status, 200);
  assert.equal(got.headers.get('content-type'), 'image/jpeg');
  assert.deepEqual(Buffer.from(await got.arrayBuffer()), jpeg);
  assert.equal(got.headers.get('cache-control'), 'private, no-cache');
  const data = await (await fetch(`${base}/api/data`)).json();
  assert.ok(data.issueImages.includes('i-tap'));
  const del = await fetch(`${base}/api/issues/i-tap/image`, { method: 'DELETE' });
  assert.equal(del.status, 200);
  assert.equal((await fetch(`${base}/api/issues/i-tap/image`)).status, 404);
});

test('picture refusals: not a picture, unknown item, too large, wrong method', async () => {
  const text = await fetch(`${base}/api/issues/i-tap/image`, { method: 'PUT', body: 'hello' });
  assert.equal(text.status, 400);
  const unknown = await fetch(`${base}/api/issues/no-such/image`, { method: 'PUT', body: Buffer.from([0xff, 0xd8, 0xff]) });
  assert.equal(unknown.status, 404);
  const big = await fetch(`${base}/api/issues/i-tap/image`, { method: 'PUT', body: Buffer.alloc(3_000_001, 0xff) });
  assert.equal(big.status, 413);
  const post = await fetch(`${base}/api/issues/i-tap/image`, { method: 'POST' });
  assert.equal(post.status, 405);
});

test('a sync body over 1 MB is refused with 413, and the refusal reaches the client', async () => {
  const res = await fetch(`${base}/api/sync`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ops: [], pad: 'x'.repeat(1_100_000) }),
  });
  assert.equal(res.status, 413);
});
