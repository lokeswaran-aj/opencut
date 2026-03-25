# Build context must be the MONOREPO ROOT:
#   docker build -f apps/web/Dockerfile .
#
# In Coolify: set "Dockerfile Location" to apps/web/Dockerfile
# and leave the build context as the repository root (default).

FROM node:20-alpine AS base
RUN corepack enable

# ── Install dependencies (layer-cached separately from source) ────────────────
FROM base AS deps
WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/                          ./packages/
COPY apps/web/package.json              ./apps/web/package.json
# render-worker package.json is required so pnpm can resolve the workspace
COPY apps/render-worker/package.json    ./apps/render-worker/package.json

RUN pnpm install --frozen-lockfile

# ── Build Next.js ─────────────────────────────────────────────────────────────
FROM base AS builder
WORKDIR /app

COPY --from=deps /app/node_modules  ./node_modules
COPY --from=deps /app/packages      ./packages
COPY . .

ENV NEXT_TELEMETRY_DISABLED=1

RUN pnpm --filter web build

# ── Minimal production image ──────────────────────────────────────────────────
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# standalone output already includes all traced node_modules
COPY --from=builder /app/apps/web/.next/standalone          ./
# static assets are not bundled into standalone — copy them separately
COPY --from=builder /app/apps/web/.next/static              ./apps/web/.next/static
COPY --from=builder /app/apps/web/public                    ./apps/web/public

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# server.js lives at apps/web/server.js inside the standalone root
CMD ["node", "apps/web/server.js"]
