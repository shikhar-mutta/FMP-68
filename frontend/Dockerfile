# ── Build stage ──────────────────────────────────────────────────────────
# react-scripts@5 requires Node 18 (ajv peer-dep conflict on Node 20)
FROM node:18-alpine AS builder
WORKDIR /app

COPY package*.json ./
# Step 1: install all deps
RUN npm install --legacy-peer-deps
# Step 2: force ajv v6 to top-level — schema-utils v3 (used by react-scripts)
# requires ajv v6 but ajv-keywords v5 hoists ajv v8. --no-save avoids package.json conflict.
RUN npm install ajv@6.12.6 --no-save --force

COPY . .

# REACT_APP_API_URL must be baked in at build time (browser-side env var)
ARG REACT_APP_API_URL=http://localhost:4000
ARG REACT_APP_SOCKET_URL=http://localhost:4000
ENV REACT_APP_API_URL=$REACT_APP_API_URL
ENV REACT_APP_SOCKET_URL=$REACT_APP_SOCKET_URL

ENV GENERATE_SOURCEMAP=false
RUN npm run build

# ── Production stage: nginx ───────────────────────────────────────────────
FROM nginx:1.25-alpine AS production

# Copy built React app
COPY --from=builder /app/build /usr/share/nginx/html

# Custom nginx config for SPA routing
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 3000
CMD ["nginx", "-g", "daemon off;"]
