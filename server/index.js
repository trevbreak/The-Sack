// Production server: serves the built game from dist/ and the leaderboard API.
// No dependencies beyond Node itself.
//   PORT      port to listen on (default 8080)
//   DATA_DIR  where scores.json lives (default ./data; /data in Docker)
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createScoreStore, scoresApi } from './scores.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist');
const port = Number(process.env.PORT) || 8080;
const dataDir = path.resolve(process.env.DATA_DIR || path.join(root, 'data'));

const store = createScoreStore(path.join(dataDir, 'scores.json'));
const api = scoresApi(store);

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
};

function serveFile(req, res) {
  const url = new URL(req.url, 'http://localhost');
  let file;
  try {
    file = path.join(dist, decodeURIComponent(url.pathname));
  } catch {
    res.statusCode = 400;
    return res.end('Bad request');
  }
  // Never serve anything outside dist/.
  if (file !== dist && !file.startsWith(dist + path.sep)) {
    res.statusCode = 403;
    return res.end('Forbidden');
  }
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(dist, 'index.html');
  const ext = path.extname(file);
  res.setHeader('Content-Type', TYPES[ext] || 'application/octet-stream');
  // Vite's hashed assets never change; everything else should be re-checked.
  res.setHeader('Cache-Control', url.pathname.startsWith('/assets/') ? 'public, max-age=31536000, immutable' : 'no-cache');
  fs.createReadStream(file).pipe(res);
}

const server = http.createServer((req, res) => {
  if (req.url.startsWith('/api/')) return api(req, res);
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.statusCode = 405;
    return res.end();
  }
  return serveFile(req, res);
});

server.listen(port, () => {
  console.log(`The Sack is running on http://localhost:${port} (scores in ${dataDir})`);
});

for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => server.close(() => process.exit(0)));
