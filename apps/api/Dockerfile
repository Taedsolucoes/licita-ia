FROM node:20-alpine AS builder
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml .npmrc ./
COPY apps/api/package.json ./apps/api/
COPY packages/shared-types/package.json ./packages/shared-types/
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
RUN pnpm install --frozen-lockfile
ARG CACHE_BUST=2026-05-17-v2
COPY apps/api ./apps/api
COPY packages/shared-types ./packages/shared-types
RUN find /app/apps/api -name "*.tsbuildinfo" -delete 2>/dev/null || true
RUN pnpm --filter @licita-ia/shared-types build
RUN pnpm --filter @licita-ia/api build
FROM node:20-alpine AS production
RUN apk add --no-cache chromium nss freetype harfbuzz ca-certificates ttf-freefont
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml .npmrc ./
COPY apps/api/package.json ./apps/api/
COPY packages/shared-types/package.json ./packages/shared-types/
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser
ENV NODE_ENV=production
RUN pnpm install --frozen-lockfile --prod
ARG CACHE_BUST=2026-05-17-v2
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/prisma ./node_modules/prisma
RUN chmod +x /app/node_modules/prisma/build/index.js && ln -sf /app/node_modules/prisma/build/index.js /app/node_modules/.bin/prisma
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/packages/shared-types/dist ./packages/shared-types/dist
COPY apps/api/prisma ./apps/api/prisma
EXPOSE 3000
WORKDIR /app/apps/api
CMD ["node", "--unhandled-rejections=throw", "dist/main"]
