// HTTP handler for /api/. Two calls: GET /api/data and POST /api/sync (ADR-0011).
import { applySync, ConflictError, ensureSeeded, loadAll, ValidationError } from './repo.js';

const MAX_BODY = 1_000_000;

function send(res, status, body) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  res.end(JSON.stringify(body));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY) {
        const err = new Error('too large');
        err.status = 413;
        reject(err);
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
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

    if (pathname === '/api/sync') {
      if (req.method !== 'POST') return send(res, 405, { error: 'Use POST' });
      let body;
      try {
        body = JSON.parse(await readBody(req));
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
