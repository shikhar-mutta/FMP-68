# syntax=docker/dockerfile:1.6
# ─────────────────────────────────────────────────────────────
# fmp-paths-service — 3-stage slim build with Prisma
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
    SERVICE_NAME=paths-service \
    PORT=4003

RUN addgroup -S app && adduser -S app -G app

COPY --from=prod-deps --chown=app:app /app/node_modules ./node_modules
COPY --from=builder  --chown=app:app /app/node_modules/.prisma  ./node_modules/.prisma

COPY --from=builder  --chown=app:app /app/dist ./dist
COPY --from=builder  --chown=app:app /app/prisma ./prisma
COPY --from=builder  --chown=app:app /app/package.json ./package.json

USER app

EXPOSE 4003
HEALTHCHECK --interval=15s --timeout=3s --start-period=15s --retries=3 \
  CMD wget -qO- http://localhost:4003/health || exit 1

CMD ["node", "dist/main.js"]
