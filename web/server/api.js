// HTTP handler for /api/. Two calls: GET /api/data and POST /api/sync (ADR-0011).
import {
  activityPage, applySync, ConflictError, ensureSeeded, getIssueImage, loadAll, NotFoundError,
  removeIssueImage, setIssueImage, ValidationError,
} from './repo.js';
import { MAX_IMAGE_BYTES } from './images.js';

const MAX_BODY = 1_000_000;
const IMAGE_PATH = /^\/api\/issues\/([^/]+)\/image$/;

function send(res, status, body) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  res.end(JSON.stringify(body));
}

// Reads the whole body up to `max` bytes. Past the limit it rejects with status 413 but keeps
// draining the request, so the refusal can still be sent back.
function readRaw(req, max) {
  return new Promise((resolve, reject) => {
    let size = 0;
    let tooBig = false;
    const chunks = [];
    req.on('data', (chunk) => {
      if (tooBig) return;
      size += chunk.length;
      if (size > max) {
        tooBig = true;
        const err = new Error('too large');
        err.status = 413;
        reject(err);
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      if (!tooBig) resolve(Buffer.concat(chunks));
    });
    req.on('error', reject);
  });
}

/**
 * @param {import('node:sqlite').DatabaseSync} db
 * @returns {(req: any, res: any) => Promise<void>}
 */
export function createApi(db) {
  ensureSeeded(db);

  return async function handle(req, res) {
    const { pathname } = new URL(req.url ?? '/', 'http://localhost');

    if (pathname === '/api/data') {
      if (req.method !== 'GET') return send(res, 405, { error: 'Use GET' });
      return send(res, 200, loadAll(db));
    }

    if (pathname === '/api/activity') {
      if (req.method !== 'GET') return send(res, 405, { error: 'Use GET' });
      const params = new URL(req.url ?? '/', 'http://localhost').searchParams;
      const before = params.has('before') ? Number(params.get('before')) : null;
      const limit = Math.min(200, Math.max(1, Number(params.get('limit') ?? 50)));
      if (before !== null && !Number.isInteger(before)) return send(res, 400, { error: 'before must be a whole number' });
      return send(res, 200, activityPage(db, { before, limit }));
    }

    const image = IMAGE_PATH.exec(pathname);
    if (image) {
      const issueId = decodeURIComponent(image[1]);
      if (req.method === 'GET') {
        const picture = getIssueImage(db, issueId);
        if (!picture) return send(res, 404, { error: 'No picture' });
        res.writeHead(200, {
          'content-type': picture.mime,
          'content-length': picture.bytes.byteLength,
          'cache-control': 'private, no-cache',
        });
        return res.end(Buffer.from(picture.bytes));
      }
      if (req.method === 'PUT') {
        let bytes;
        try {
          bytes = await readRaw(req, MAX_IMAGE_BYTES);
        } catch (err) {
          if (err.status === 413) return send(res, 413, { error: 'Picture is too large' });
          return send(res, 400, { error: 'Could not read the picture' });
        }
        try {
          setIssueImage(db, issueId, bytes);
          return send(res, 200, { ok: true });
        } catch (err) {
          if (err instanceof ValidationError) return send(res, 400, { error: err.message });
          if (err instanceof NotFoundError) return send(res, 404, { error: err.message });
          console.error(err);
          return send(res, 500, { error: 'Could not save' });
        }
      }
      if (req.method === 'DELETE') {
        try {
          removeIssueImage(db, issueId);
          return send(res, 200, { ok: true });
        } catch (err) {
          if (err instanceof NotFoundError) return send(res, 404, { error: err.message });
          console.error(err);
          return send(res, 500, { error: 'Could not remove' });
        }
      }
      return send(res, 405, { error: 'Use GET, PUT or DELETE' });
    }

    if (pathname === '/api/sync') {
      if (req.method !== 'POST') return send(res, 405, { error: 'Use POST' });
      let body;
      try {
        body = JSON.parse((await readRaw(req, MAX_BODY)).toString('utf8'));
      } catch (err) {
        if (err.status === 413) return send(res, 413, { error: 'Too much data in one sync' });
        return send(res, 400, { error: 'Body must be JSON' });
      }
      try {
        const applied = applySync(db, body?.ops);
        return send(res, 200, { ok: true, applied });
      } catch (err) {
        if (err instanceof ValidationError) return send(res, 400, { error: err.message });
        if (err instanceof ConflictError) return send(res, 409, { error: err.message });
        console.error(err);
        return send(res, 500, { error: 'Could not save' });
      }
    }

    return send(res, 404, { error: 'Not found' });
  };
}
