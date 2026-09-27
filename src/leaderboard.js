import { holidayOf, holidayLabel } from './config.js';
// Household leaderboard. Scores live on the server (shared by every computer
// in the house). If the server can't be reached, they're kept in this browser.
const LOCAL_KEY = 'theSack.scores';
const NAME_KEY = 'theSack.playerName';

function localScores() {
  try {
    return JSON.parse(localStorage.getItem(LOCAL_KEY)) || [];
  } catch {
    return [];
  }
}

function rank(list) {
  return [...list].sort((a, b) => b.day - a.day || b.kills - a.kills || a.date.localeCompare(b.date));
}

export async function fetchScores() {
  try {
    const res = await fetch('/api/scores', { cache: 'no-store' });
    if (!res.ok) throw new Error(res.statusText);
    return { scores: await res.json(), shared: true };
  } catch {
    return { scores: rank(localScores()), shared: false };
  }
}

export async function submitScore({ name, difficulty, day, kills }) {
  try {
    localStorage.setItem(NAME_KEY, name);
  } catch {
    // fine
  }
  try {
    const res = await fetch('/api/scores', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, difficulty, day, kills }),
    });
    if (!res.ok) throw new Error(res.statusText);
    return { entry: await res.json(), shared: true };
  } catch {
    const entry = { id: `local${Date.now()}`, name, difficulty, day, kills, date: new Date().toISOString() };
    try {
      localStorage.setItem(LOCAL_KEY, JSON.stringify([...localScores(), entry].slice(-500)));
    } catch {
      // fine
    }
    return { entry, shared: false };
  }
}

export function lastName() {
  try {
    return localStorage.getItem(NAME_KEY) || '';
  } catch {
    return '';
  }
}

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const MEDALS = ['🥇', '🥈', '🥉'];

export function formatDate(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

// A small table of the top runs for one difficulty.
export function boardHTML(scores, difficulty, { limit = 10, highlight = null } = {}) {
  const list = scores.filter((s) => s.difficulty === difficulty).slice(0, limit);
  if (!list.length) return '<div class="lb-empty">No scores yet. Be the first!</div>';
  return `<ol class="lb">${list
    .map(
      (s, i) => `<li class="${s.id === highlight ? 'me' : ''}">
        <span class="lb-rank">${MEDALS[i] || i + 1}</span>
        <span class="lb-name">${esc(s.name)}</span>
        <span class="lb-day" title="Day ${s.day} overall">${holidayOf(s.day).icon} ${holidayLabel(s.day)}</span>
        <span class="lb-date">${formatDate(s.date)}</span>
      </li>`,
    )
    .join('')}</ol>`;
}
