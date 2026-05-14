# syntax=docker/dockerfile:1.6
# ─────────────────────────────────────────────────────────────
# fmp-frontend — 2-stage build
#   Stage 1: node:20-alpine — npm ci + npm run build → /app/build
#   Stage 2: nginx:alpine   — serves /app/build, SPA fallback,
#                              long-cache for /static/, healthcheck on /
# ─────────────────────────────────────────────────────────────

# === Stage 1: builder ===
FROM node:20-alpine AS builder
WORKDIR /app

COPY package*.json ./
# Use `npm install` (not `npm ci`) so the lockfile can lag behind
# package.json without breaking the build — matches the reference
# frontend repo's behaviour.
RUN npm install --no-audit --no-fund

# Copy source + production env file. CRA picks up .env.production
# automatically when NODE_ENV=production (which `npm run build` sets).
COPY public  ./public
COPY src     ./src
COPY .env.production ./

# Build-time API URL override. CRA reads process.env first, so this
# wins over the value baked into .env.production. Local docker-compose
# passes http://localhost:4000; K8s build leaves the default and the
# Ingress hostname from .env.production takes effect.
ARG REACT_APP_API_URL=http://localhost:4000
ENV REACT_APP_API_URL=$REACT_APP_API_URL

# CI=false so build warnings don't fail the build (React-Scripts behaviour)
ENV CI=false
RUN npm run build

# === Stage 2: runtime (nginx) ===
FROM nginx:alpine

# wget for the HEALTHCHECK
RUN apk add --no-cache wget

# Custom server block (SPA fallback + cache headers)
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy compiled static assets
COPY --from=builder /app/build /usr/share/nginx/html

EXPOSE 80
HEALTHCHECK --interval=15s --timeout=3s --start-period=5s --retries=3 \
    CMD wget -qO- http://localhost/ >/dev/null || exit 1

CMD ["nginx", "-g", "daemon off;"]
