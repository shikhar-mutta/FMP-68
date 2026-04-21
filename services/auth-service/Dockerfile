# ── Stage 1: Build ───────────────────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

# Install deps first (cache layer)
COPY package*.json ./
RUN npm install --legacy-peer-deps

# Generate Prisma client before copying source
COPY prisma ./prisma
RUN npx prisma generate

# Copy source and build
COPY tsconfig.json nest-cli.json ./
COPY src ./src
RUN npm run build

# ── Stage 2: Production ──────────────────────────────────────────────────────
FROM node:20-alpine AS production
WORKDIR /app
ENV NODE_ENV=production NODE_OPTIONS=--no-deprecation
RUN apk add --no-cache openssl

# Install only production dependencies
COPY package*.json ./
RUN npm install --omit=dev --legacy-peer-deps

# Copy compiled output
COPY --from=builder /app/dist ./dist

# Copy generated Prisma client (needed at runtime)
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma/client ./node_modules/@prisma/client

# Copy prisma schema (needed for engine resolution)
COPY prisma ./prisma

EXPOSE 4001
CMD ["node", "dist/main"]
