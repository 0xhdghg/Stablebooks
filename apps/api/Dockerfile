FROM node:22-alpine

WORKDIR /app

RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json turbo.json ./
COPY apps/api/package.json apps/api/package.json

RUN corepack pnpm install --frozen-lockfile

COPY . .

RUN corepack pnpm --filter @stablebooks/api build

ENV NODE_ENV=production

CMD ["sh", "-lc", "corepack pnpm --filter @stablebooks/api exec prisma migrate deploy && corepack pnpm --filter @stablebooks/api start"]
