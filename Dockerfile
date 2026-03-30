# ── Stage 1: Dependencies ──
FROM node:22-bookworm-slim AS deps

RUN corepack enable && corepack prepare pnpm@10 --activate

WORKDIR /app

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml .npmrc ./
COPY packages/shared/package.json packages/shared/package.json
COPY packages/storage/package.json packages/storage/package.json
COPY packages/core/package.json packages/core/package.json
COPY packages/summon/package.json packages/summon/package.json
COPY packages/channels/package.json packages/channels/package.json
COPY packages/ink/package.json packages/ink/package.json
COPY packages/tentacle/package.json packages/tentacle/package.json
COPY packages/realmhub/package.json packages/realmhub/package.json
COPY packages/dashboard/package.json packages/dashboard/package.json

RUN pnpm install --frozen-lockfile

# ── Stage 2: Build ──
FROM deps AS build

COPY . .

RUN NODE_OPTIONS="--max-old-space-size=2048" pnpm build
RUN CI=true pnpm prune --prod && \
    find packages -name '*.d.ts' -delete && \
    find packages -name '*.map' -delete

# ── Stage 3: Runtime ──
FROM node:22-bookworm-slim AS runtime

LABEL org.opencontainers.image.title="OpenOctopus" \
      org.opencontainers.image.description="Realm-native personal life assistant Agent system" \
      org.opencontainers.image.source="https://github.com/openoctopus/openoctopus"

RUN apt-get update && \
    apt-get install -y --no-install-recommends curl procps && \
    rm -rf /var/lib/apt/lists/*

RUN corepack enable

USER node
WORKDIR /app

COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/packages ./packages
COPY --from=build --chown=node:node /app/package.json ./
COPY --from=build --chown=node:node /app/pnpm-workspace.yaml ./
COPY --from=build --chown=node:node /app/realms ./realms

ENV NODE_ENV=production
ENV OPENOCTOPUS_PORT=19790
ENV OPENOCTOPUS_WS_PORT=19789

EXPOSE 19789 19790

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://127.0.0.1:19790/healthz || exit 1

CMD ["node", "packages/ink/dist/index.js", "serve"]
