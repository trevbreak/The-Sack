import { defineConfig } from 'vite';
import path from 'node:path';
import { createScoreStore, scoresApi } from './server/scores.js';

// In dev, serve the leaderboard API from the Vite server itself, using the
// same code (and the same ./data/scores.json) as the production server.
function leaderboard() {
  return {
    name: 'the-sack-leaderboard',
    configureServer(server) {
      const store = createScoreStore(path.resolve('data/scores.json'));
      server.middlewares.use(scoresApi(store));
    },
  };
}

export default defineConfig({
  plugins: [leaderboard()],
  server: { host: true },
});
