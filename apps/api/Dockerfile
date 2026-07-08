FROM node:20-alpine AS builder

# ✅ SET ENV VARS ANTES de tudo
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_SKIP_DOWNLOAD=true
ENV NODE_OPTIONS="--max-old-space-size=512"

RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# Copy package files
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml .npmrc ./
COPY apps/api/package.json ./apps/api/
COPY packages/shared-types/package.json ./packages/shared-types/

# ✅ Install with Puppeteer skip already set
RUN pnpm install --frozen-lockfile

# Build args for Prisma (dummy during build)
ARG CACHE_BUST=2026-06-09-v1
ARG DATABASE_URL=postgresql://placeholder:placeholder@placeholder:5432/placeholder

ENV DATABASE_URL=${DATABASE_URL}

# Copy source code
COPY apps/api ./apps/api
COPY packages/shared-types ./packages/shared-types

# Clean tsbuildinfo cache
RUN find /app/apps/api -name "*.tsbuildinfo" -delete 2>/dev/null || true

# Build shared types and API
RUN pnpm --filter @licita-ia/shared-types build
RUN pnpm --filter @licita-ia/api build

# ============================================================
# PRODUCTION STAGE
# ============================================================

FROM node:20-alpine AS production

# ✅ Install system deps (chromium for Puppeteer, dumb-init for signal handling)
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    harfbuzz \
    ca-certificates \
    ttf-freefont \
    dumb-init

# ✅ Set env vars FIRST
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
# /usr/bin/chromium is the canonical binary on Alpine (chromium-browser is only
# a compat symlink that has been dropped in some Alpine releases).
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
ENV NODE_ENV=production
ENV NODE_OPTIONS="--max-old-space-size=512"

# ✅ Fail the build immediately if the chromium binary is missing/moved
RUN test -x /usr/bin/chromium || { echo "FATAL: /usr/bin/chromium not found"; ls -la /usr/bin/chromium* || true; exit 1; }

RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# Copy package files again
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml .npmrc ./
COPY apps/api/package.json ./apps/api/
COPY packages/shared-types/package.json ./packages/shared-types/

# Install ONLY production dependencies
RUN pnpm install --frozen-lockfile --prod

# Copy Prisma artifacts from builder
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/prisma ./node_modules/prisma

# Make Prisma executable and symlink
RUN chmod +x /app/node_modules/prisma/build/index.js && \
    ln -sf /app/node_modules/prisma/build/index.js /app/node_modules/.bin/prisma

# Copy compiled output from builder
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/packages/shared-types/dist ./packages/shared-types/dist

# Copy Prisma schema and migrations
COPY apps/api/prisma ./apps/api/prisma

EXPOSE 3000

WORKDIR /app/apps/api

# ✅ Use dumb-init for proper signal handling (important for Render)
ENTRYPOINT ["dumb-init", "--"]

# ✅ FIXED: Added .js extension and proper Node options
CMD ["node", "--unhandled-rejections=throw", "dist/main.js"]
