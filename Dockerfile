FROM node:20-alpine

RUN npm install -g pnpm

WORKDIR /app

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/shared-types ./packages/shared-types
COPY apps/api ./apps/api

RUN pnpm install --frozen-lockfile
RUN pnpm --filter @licita-ia/api build

EXPOSE 3000

CMD ["sh", "-c", "cd /app && npx prisma migrate deploy --schema=apps/api/prisma/schema.prisma && node apps/api/dist/main"]
