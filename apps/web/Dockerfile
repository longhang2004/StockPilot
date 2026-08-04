FROM node:24-bookworm-slim AS build

WORKDIR /workspace
RUN corepack enable && corepack prepare pnpm@10.13.1 --activate

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY apps/web/package.json apps/web/package.json
COPY packages/contracts/package.json packages/contracts/package.json
RUN pnpm install --frozen-lockfile

COPY apps/web apps/web
COPY packages/contracts packages/contracts
RUN pnpm --filter @stockpilot/contracts build && pnpm --filter @stockpilot/web build

ENV HOSTNAME=0.0.0.0
ENV NODE_ENV=production
EXPOSE 3000
CMD ["pnpm", "--filter", "@stockpilot/web", "start"]

