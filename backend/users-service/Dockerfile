# syntax=docker/dockerfile:1.6
# ─────────────────────────────────────────────────────────────
# fmp-users-service — 3-stage slim build with Prisma
#   builder    → all deps + prisma generate + nest build
#   prod-deps  → fresh prod-only install
#   runtime    → prod node_modules + generated Prisma client overlay
# ─────────────────────────────────────────────────────────────

FROM node:20-alpine AS builder
RUN apk add --no-cache openssl
WORKDIR /app
COPY package*.json ./
RUN npm install --no-audit --no-fund
COPY tsconfig.json nest-cli.json ./
COPY prisma ./prisma
COPY src ./src
RUN npx prisma generate
RUN npm run build

FROM node:20-alpine AS prod-deps
WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev --no-audit --no-fund

FROM node:20-alpine
WORKDIR /app
RUN apk add --no-cache openssl
ENV NODE_ENV=production \
    SERVICE_NAME=users-service \
    PORT=4002

RUN addgroup -S app && adduser -S app -G app

# Base prod-only node_modules (already contains @prisma/client + @prisma/engines)
COPY --from=prod-deps --chown=app:app /app/node_modules ./node_modules
# Overlay ONLY the generated client (npm install can't generate without prisma CLI)
COPY --from=builder  --chown=app:app /app/node_modules/.prisma  ./node_modules/.prisma

COPY --from=builder  --chown=app:app /app/dist ./dist
COPY --from=builder  --chown=app:app /app/prisma ./prisma
COPY --from=builder  --chown=app:app /app/package.json ./package.json

USER app

EXPOSE 4002
HEALTHCHECK --interval=15s --timeout=3s --start-period=15s --retries=3 \
  CMD wget -qO- http://localhost:4002/health || exit 1

CMD ["node", "dist/main.js"]
