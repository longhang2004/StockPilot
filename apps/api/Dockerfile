# StockPilot API production image.
#
# Multi-stage: the build stage compiles the workspace and prunes
# dependencies with `pnpm deploy --prod`; the runtime stage copies only the
# compiled output plus production dependencies and runs as the non-root
# `node` user. Prisma's generated client and driver adapter travel inside
# the production node_modules, so the runtime image contains no source,
# compiler, or package manager.

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
# Prisma generate requires a DATABASE_URL in the config file, but never
# connects during generation.
RUN DATABASE_URL=postgresql://build:build@localhost:5432/build \
    pnpm --filter @stockpilot/api prisma:generate
RUN pnpm --filter @stockpilot/contracts build && pnpm --filter @stockpilot/api build
# Prune to production dependencies only (includes @prisma/client, the pg
# driver adapter, argon2/openssl runtime libs, and sharp prebuilds).
RUN pnpm --filter @stockpilot/api deploy --prod --legacy /workspace/runtime

FROM node:24-bookworm-slim AS runtime

ENV NODE_ENV=production
ENV PORT=4000
WORKDIR /app

# Runtime requirements: openssl for Prisma's query engine, ca-certificates
# for outbound TLS (Cloudinary, Stripe, Sentry). Source, build tooling and
# devDependencies are not copied.
RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates openssl \
    && rm -rf /var/lib/apt/lists/*

COPY --from=build --chown=node:node /workspace/runtime /app

USER node
EXPOSE 4000
CMD ["node", "dist/main.js"]
