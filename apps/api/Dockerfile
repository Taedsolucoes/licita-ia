# ─── Stage 1: Builder ────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# Copy workspace manifests + .npmrc (enforces node-linker=hoisted → flat node_modules)
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml .npmrc ./
COPY apps/api/package.json ./apps/api/
COPY packages/shared-types/package.json ./packages/shared-types/

# Skip Puppeteer Chromium download during build
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true

# Install ALL dependencies (dev + prod) with hoisted flat node_modules
RUN pnpm install --frozen-lockfile

# Copy source code
COPY apps/api ./apps/api
COPY packages/shared-types ./packages/shared-types

# Build shared-types (api depends on its dist/)
RUN pnpm --filter @licita-ia/shared-types build

# Build NestJS (runs "prisma generate && nest build")
# With node-linker=hoisted, prisma generate writes to /app/node_modules/.prisma/client/
RUN pnpm --filter @licita-ia/api build

# ─── Stage 2: Production ─────────────────────────────────────────────────────
FROM node:20-alpine AS production

# System Chromium + fonts required by Puppeteer (PDF generation)
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    harfbuzz \
    ca-certificates \
    ttf-freefont

RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# Copy workspace manifests + .npmrc (must match builder so node_modules layout is identical)
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml .npmrc ./
COPY apps/api/package.json ./apps/api/
COPY packages/shared-types/package.json ./packages/shared-types/

ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser
ENV NODE_ENV=production

# Install production-only dependencies (hoisted flat node_modules)
# @prisma/client lands at /app/node_modules/@prisma/client (no .prisma yet)
RUN pnpm install --frozen-lockfile --prod

# Copy the Prisma-generated client from builder.
# With node-linker=hoisted this path is deterministic: /app/node_modules/.prisma/client/
# @prisma/client/index.js does require('.prisma/client/...') which Node resolves here.
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma

# Copy prisma CLI from builder (needed for `prisma migrate deploy` at startup)
COPY --from=builder /app/node_modules/prisma ./node_modules/prisma
RUN chmod +x /app/node_modules/prisma/build/index.js \
    && ln -sf /app/node_modules/prisma/build/index.js /app/node_modules/.bin/prisma

# Copy compiled NestJS application
COPY --from=builder /app/apps/api/dist ./apps/api/dist

# Copy built shared-types
COPY --from=builder /app/packages/shared-types/dist ./packages/shared-types/dist

# Copy Prisma schema and migrations (required for migrate deploy)
COPY apps/api/prisma ./apps/api/prisma

EXPOSE 3000

WORKDIR /app/apps/api

CMD ["node", "dist/main"]
