# StockPilot web production image.
#
# Multi-stage with Next.js `output: "standalone"` (see next.config.ts): the
# build stage compiles the workspace and emits a self-contained server
# trace; the runtime stage copies `.next/standalone`, static assets, and
# public files, then runs as the non-root `node` user. No source, dev
# dependencies, or package manager reach the runtime image.
#
# API_INTERNAL_URL is baked into the routes manifest at build time (Next
# evaluates rewrites during `next build`), so it must be passed as a build
# arg; the same value is set in the runtime environment for consistency.

FROM node:24-bookworm-slim AS deps

WORKDIR /workspace
RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates openssl \
    && rm -rf /var/lib/apt/lists/*
RUN corepack enable && corepack prepare pnpm@10.13.1 --activate

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY apps/web/package.json apps/web/package.json
COPY packages/contracts/package.json packages/contracts/package.json
RUN pnpm install --frozen-lockfile

FROM node:24-bookworm-slim AS build

WORKDIR /workspace
RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates openssl \
    && rm -rf /var/lib/apt/lists/*
RUN corepack enable && corepack prepare pnpm@10.13.1 --activate

COPY --from=deps /workspace/node_modules ./node_modules
COPY --from=deps /workspace/apps/web/node_modules ./apps/web/node_modules
COPY --from=deps /workspace/packages/contracts/node_modules ./packages/contracts/node_modules

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY apps/web apps/web
COPY packages/contracts packages/contracts

ARG API_INTERNAL_URL=http://localhost:4000
ENV API_INTERNAL_URL=$API_INTERNAL_URL
ENV NODE_ENV=production
ENV SITE_URL=http://localhost:3000

RUN pnpm --filter @stockpilot/contracts build && pnpm --filter @stockpilot/web build

FROM node:24-bookworm-slim AS runtime

ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
ENV PORT=3000
# Read server-side for metadata/robots/sitemap at runtime; deployments set
# the canonical origin explicitly.
ENV SITE_URL=http://localhost:3000
WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates openssl \
    && rm -rf /var/lib/apt/lists/*

COPY --from=build --chown=node:node /workspace/apps/web/.next/standalone ./
# The standalone server resolves .next/static and public/ relative to the
# traced app directory (apps/web inside the standalone root).
COPY --from=build --chown=node:node /workspace/apps/web/.next/static ./apps/web/.next/static
COPY --from=build --chown=node:node /workspace/apps/web/public ./apps/web/public

USER node
EXPOSE 3000
CMD ["node", "apps/web/server.js"]
