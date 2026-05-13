# syntax=docker/dockerfile:1.6
# ─────────────────────────────────────────────────────────────
# fmp-api-gateway — 3-stage slim build
#   builder    → installs all deps, runs nest build
#   prod-deps  → fresh install of prod-only deps (no devDep traces)
#   runtime    → minimal: prod node_modules + dist + package.json
# ─────────────────────────────────────────────────────────────

# === Stage 1: builder ===
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN --mount=type=cache,target=/root/.npm \
    npm ci --no-audit --no-fund
COPY tsconfig.json nest-cli.json ./
COPY src ./src
RUN npm run build

# === Stage 2: production node_modules only ===
FROM node:20-alpine AS prod-deps
WORKDIR /app
COPY package*.json ./
RUN --mount=type=cache,target=/root/.npm \
    npm ci --omit=dev --no-audit --no-fund

# === Stage 3: runtime ===
FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production \
    SERVICE_NAME=api-gateway \
    PORT=4000

RUN addgroup -S app && adduser -S app -G app
COPY --from=prod-deps --chown=app:app /app/node_modules ./node_modules
COPY --from=builder  --chown=app:app /app/dist ./dist
COPY --from=builder  --chown=app:app /app/package.json ./package.json
USER app

EXPOSE 4000
HEALTHCHECK --interval=15s --timeout=3s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:4000/health || exit 1

CMD ["node", "dist/main.js"]
