# ---- build the game ----
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# ---- run it ----
# A tiny Node server (no dependencies) that serves the game and keeps the
# household leaderboard in /data/scores.json.
FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production \
    PORT=8080 \
    DATA_DIR=/data
COPY package.json ./
COPY server ./server
COPY --from=build /app/dist ./dist
VOLUME ["/data"]
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
  CMD wget -qO- http://127.0.0.1:8080/api/scores > /dev/null || exit 1
CMD ["node", "server/index.js"]
