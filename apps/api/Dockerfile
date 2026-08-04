FROM node:24-bookworm-slim AS build

WORKDIR /workspace
RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates openssl \
    && rm -rf /var/lib/apt/lists/*
RUN corepack enable && corepack prepare pnpm@10.13.1 --activate

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY apps/api/package.json apps/api/package.json
COPY packages/contracts/package.json packages/contracts/package.json
RUN pnpm install --frozen-lockfile

COPY apps/api apps/api
COPY packages/contracts packages/contracts
RUN DATABASE_URL=postgresql://build:build@localhost:5432/build \
    pnpm --filter @stockpilot/api prisma:generate
RUN pnpm --filter @stockpilot/contracts build && pnpm --filter @stockpilot/api build

ENV NODE_ENV=production
EXPOSE 4000
CMD ["pnpm", "--filter", "@stockpilot/api", "start"]
