// The household leaderboard: a JSON file of finished runs, plus a tiny API.
// Used by both the production server (server/index.js) and the Vite dev server.
import fs from 'node:fs';
import path from 'node:path';

const DIFFICULTIES = ['rookie', 'beginner', 'pro', 'good', 'impossible'];
const KEEP_PER_DIFFICULTY = 200;

export function createScoreStore(file) {
  let scores = [];
  try {
    const data = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (Array.isArray(data)) scores = data;
  } catch {
    // No scores yet (or an unreadable file): start fresh.
  }

  const save = () => {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const tmp = `${file}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(scores, null, 2));
    fs.renameSync(tmp, file);
  };

  return {
    list() {
      return scores;
    },
    add(entry) {
      scores.push(entry);
      // Keep the best runs for each difficulty so the file can't grow forever.
      const keep = [];
      for (const d of DIFFICULTIES) {
        keep.push(...rank(scores.filter((s) => s.difficulty === d)).slice(0, KEEP_PER_DIFFICULTY));
      }
      scores = keep;
      save();
      return entry;
    },
  };
}

// Best first: most days survived, then most creatures smashed, then earliest.
export function rank(list) {
  return [...list].sort((a, b) => b.day - a.day || b.kills - a.kills || a.date.localeCompare(b.date));
}

function clean(body) {
  const int = (v, max) => Math.max(0, Math.min(max, Math.floor(Number(v) || 0)));
  const name = String(body.name ?? '')
    .replace(/[\u0000-\u001f\u007f<>]/g, '')
    .trim()
    .slice(0, 20);
  const difficulty = DIFFICULTIES.includes(body.difficulty) ? body.difficulty : null;
  const day = int(body.day, 100000);
  if (!name || !difficulty || day < 1) return null;
  return {
    id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`,
    name,
    difficulty,
    day,
    kills: int(body.kills, 100000000),
    date: new Date().toISOString(),
  };
}

function send(res, status, data) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(data));
}

// Connect-style middleware: GET /api/scores lists them, POST /api/scores adds one.
export function scoresApi(store) {
  return (req, res, next) => {
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname !== '/api/scores') return next ? next() : send(res, 404, { error: 'not found' });

    if (req.method === 'GET') return send(res, 200, rank(store.list()));

    if (req.method === 'POST') {
      let raw = '';
      req.on('data', (chunk) => {
        raw += chunk;
        if (raw.length > 4096) req.destroy();
      });
      req.on('end', () => {
        let body;
        try {
          body = JSON.parse(raw);
        } catch {
          return send(res, 400, { error: 'bad json' });
        }
        const entry = clean(body);
        if (!entry) return send(res, 400, { error: 'need a name, a difficulty and a day' });
        return send(res, 201, store.add(entry));
      });
      return;
    }

    res.setHeader('Allow', 'GET, POST');
    return send(res, 405, { error: 'method not allowed' });
  };
}
