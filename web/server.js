// Domesticity web server. Serves the static app (public/ at /, src/ at /src/) and the API at /api/.
// No dependencies: node:http, and node:sqlite for storage (ADR-0010, ADR-0011).
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { openDatabase } from './server/db.js';
import { createApi } from './server/api.js';

const root = resolve(fileURLToPath(new URL('.', import.meta.url)));
const port = Number(process.env.PORT ?? 8080);
// Loopback only by default. Remote access goes through Cloudflare Tunnel on the same
// host (web/deploy/README.md), so nothing on the network can reach the port directly.
const host = process.env.HOST ?? '127.0.0.1';
const dbPath = process.env.DB_PATH ?? join(root, 'data', 'domesticity.db');

const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
};

const db = openDatabase(dbPath);
const api = createApi(db);

createServer(async (req, res) => {
  const { pathname } = new URL(req.url ?? '/', 'http://localhost');
  if (pathname === '/api' || pathname.startsWith('/api/')) {
    await api(req, res);
    return;
  }

  let path = decodeURIComponent(pathname);
  if (path === '/') path = '/index.html';

  const file = path.startsWith('/src/') ? join(root, path) : join(root, 'public', path);
  const resolved = resolve(file);
  if (!resolved.startsWith(root + sep)) {
    res.writeHead(403).end('Forbidden');
    return;
  }

  try {
    const body = await readFile(resolved);
    res.writeHead(200, {
      'content-type': types[extname(resolved)] ?? 'application/octet-stream',
      'cache-control': 'no-store',
    });
    res.end(body);
  } catch {
    res.writeHead(404).end('Not found');
  }
}).listen(port, host, () => {
  console.log(`Domesticity web on http://${host}:${port}; data in ${dbPath}`);
});
