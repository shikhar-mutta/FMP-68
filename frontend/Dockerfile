# ── Build stage ──────────────────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

COPY package*.json ./
RUN npm install --legacy-peer-deps

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
