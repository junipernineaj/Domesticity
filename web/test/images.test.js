// Issue pictures: the type check, storage, activity wording, and removal with the item (ADR-0013).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openDatabase } from '../server/db.js';
import { sniffImage } from '../server/images.js';
import {
  activityPage, applySync, ensureSeeded, getIssueImage, loadAll, NotFoundError, removeIssueImage, setIssueImage, ValidationError,
} from '../server/repo.js';

const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46]);
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0x0d]);
const WEBP = Buffer.from('RIFF\0\0\0\0WEBPVP8 ', 'latin1');

const fresh = () => {
  const db = openDatabase(':memory:');
  ensureSeeded(db, '2026-11-02');
  return db;
};

test('pictures are recognised by their first bytes, not by what they claim to be', () => {
  assert.equal(sniffImage(JPEG), 'image/jpeg');
  assert.equal(sniffImage(PNG), 'image/png');
  assert.equal(sniffImage(WEBP), 'image/webp');
  assert.equal(sniffImage(Buffer.from('GIF89a', 'latin1')), null);
  assert.equal(sniffImage(Buffer.from('<html>', 'latin1')), null);
  assert.equal(sniffImage(Buffer.alloc(0)), null);
});

test('a picture is stored for an item, and loadAll lists the item as having one', () => {
  const db = fresh();
  assert.deepEqual(loadAll(db).issueImages, []);
  setIssueImage(db, 'i-tap', JPEG);
  assert.deepEqual(loadAll(db).issueImages, ['i-tap']);
  const stored = getIssueImage(db, 'i-tap');
  assert.equal(stored.mime, 'image/jpeg');
  assert.deepEqual(Buffer.from(stored.bytes), JPEG);
});

test('adding a second picture replaces the first, and the activity log says so', () => {
  const db = fresh();
  setIssueImage(db, 'i-tap', JPEG);
  setIssueImage(db, 'i-tap', PNG);
  assert.equal(getIssueImage(db, 'i-tap').mime, 'image/png');
  const texts = activityPage(db, { limit: 2 }).items.map((i) => i.text);
  assert.deepEqual(texts, [
    'Replaced image on snag: Tap is dripping',
    'Added image to snag: Tap is dripping',
  ]);
});

test('removing a picture logs it, and removing a missing one is refused', () => {
  const db = fresh();
  setIssueImage(db, 'i-curtains', WEBP);
  removeIssueImage(db, 'i-curtains');
  assert.equal(getIssueImage(db, 'i-curtains'), null);
  assert.equal(activityPage(db, { limit: 1 }).items[0].text, 'Removed image from nice to have: Make curtains to keep the cold out');
  assert.throws(() => removeIssueImage(db, 'i-curtains'), NotFoundError);
});

test('bytes that are not a picture are refused and nothing is stored', () => {
  const db = fresh();
  assert.throws(() => setIssueImage(db, 'i-tap', Buffer.from('not a picture')), ValidationError);
  assert.equal(getIssueImage(db, 'i-tap'), null);
});

test('a picture for an unknown item is refused', () => {
  const db = fresh();
  assert.throws(() => setIssueImage(db, 'no-such-item', JPEG), NotFoundError);
});

test('deleting an item removes its picture with it', () => {
  const db = fresh();
  setIssueImage(db, 'i-tap', JPEG);
  applySync(db, [{ op: 'delete', collection: 'issues', id: 'i-tap' }]);
  assert.equal(getIssueImage(db, 'i-tap'), null);
  assert.deepEqual(loadAll(db).issueImages, []);
});
