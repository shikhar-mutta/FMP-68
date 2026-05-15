# syntax=docker/dockerfile:1.6
# ─────────────────────────────────────────────────────────────
# fmp-api-gateway — 2-stage slim build
#   builder    → install all deps, nest build, prune devDeps
#   runtime    → pruned node_modules + dist + package.json
# ─────────────────────────────────────────────────────────────

# === Stage 1: builder ===
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install --no-audit --no-fund
COPY tsconfig.json nest-cli.json ./
COPY src ./src
RUN npm run build && npm prune --omit=dev

# === Stage 2: runtime ===
FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production \
    SERVICE_NAME=api-gateway \
    PORT=4000

RUN addgroup -S app && adduser -S app -G app
COPY --from=builder --chown=app:app /app/node_modules ./node_modules
COPY --from=builder --chown=app:app /app/dist ./dist
COPY --from=builder --chown=app:app /app/package.json ./package.json
USER app

EXPOSE 4000
HEALTHCHECK --interval=15s --timeout=3s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:4000/health || exit 1

CMD ["node", "dist/main.js"]
