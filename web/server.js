// Static file server for the Phase 0 dashboard. No dependencies.
// Serves web/public at / and web/src at /src/. Nothing else is reachable.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('.', import.meta.url)));
const port = Number(process.env.PORT ?? 8080);
// Loopback only by default. Remote access goes through Cloudflare Tunnel on the same
// host (web/deploy/README.md), so nothing on the network can reach the port directly.
const host = process.env.HOST ?? '127.0.0.1';

const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
};

createServer(async (req, res) => {
  const { pathname } = new URL(req.url ?? '/', 'http://localhost');
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
  console.log(`Domesticity web on http://${host}:${port}`);
});
