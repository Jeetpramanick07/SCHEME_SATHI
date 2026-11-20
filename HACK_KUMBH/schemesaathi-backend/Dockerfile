# ==============================================================================
# SchemeSaathi Backend - Production Dockerfile
# Multi-stage build for minimal image size and fast startup
# ==============================================================================

FROM node:20-alpine AS builder

WORKDIR /app

# Enable pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Copy package manifests
COPY package.json pnpm-lock.yaml ./

# Install dependencies (including devDependencies for build)
RUN pnpm install --frozen-lockfile

# Copy source code and configs
COPY tsconfig.json ./
COPY src ./src
COPY scripts ./scripts

# Build TypeScript to JavaScript
RUN pnpm run build

# ------------------------------------------------------------------------------
# Production Runner Stage
# ------------------------------------------------------------------------------
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOST=0.0.0.0

RUN corepack enable && corepack prepare pnpm@latest --activate

# Copy package manifests
COPY package.json pnpm-lock.yaml ./

# Install only production dependencies
RUN pnpm install --prod --frozen-lockfile

# Copy compiled files from builder
COPY --from=builder /app/dist ./dist

# Copy seed data, openapi specs and assets needed at runtime
COPY src/seed ./dist/seed
COPY openapi.json ./dist/openapi.json

EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:3000/api/v1/meta || exit 1

CMD ["node", "dist/server.js"]
