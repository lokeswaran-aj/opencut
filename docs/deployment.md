# Deployment

## Overview

| Service | Platform | Notes |
|---|---|---|
| `apps/web` (Next.js) | Vercel | Auto-detected, free tier |
| `apps/render-worker` (Bun + Hono) | Coolify on Oracle Cloud | Docker image, needs Chromium + FFmpeg |

---

## apps/web → Vercel

### Steps

1. Push the repo to GitHub / GitLab.
2. In the [Vercel dashboard](https://vercel.com/new), import the repo.
3. **Root Directory** — set to `apps/web`. Vercel will pick up `vercel.json` which points install/build back to the monorepo root.
4. Add all environment variables from `apps/web/.env.example`:

```
# Clerk
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=

# Database
DATABASE_URL=

# Google Vertex AI
GOOGLE_VERTEX_PROJECT=
GOOGLE_VERTEX_LOCATION=global
GOOGLE_CLIENT_EMAIL=
GOOGLE_PRIVATE_KEY=

# Cloudflare R2
CLOUDFLARE_R2_ACCOUNT_ID=
CLOUDFLARE_R2_ACCESS_KEY_ID=
CLOUDFLARE_R2_SECRET_ACCESS_KEY=
CLOUDFLARE_R2_BUCKET_NAME=
CLOUDFLARE_R2_PUBLIC_URL=

# ElevenLabs
ELEVENLABS_API_KEY=

# Firecrawl
FIRECRAWL_API_KEY=

# Render worker
RENDER_WORKER_URL=https://<your-coolify-domain>
RENDER_WORKER_SECRET=<random-secret-shared-with-worker>
```

5. Deploy. Vercel runs:
   ```bash
   cd ../.. && pnpm install --frozen-lockfile   # monorepo root install
   cd ../.. && pnpm --filter web build          # Next.js build
   ```

### Notes

- The `vercel.json` at `apps/web/vercel.json` handles the monorepo install/build commands.
- Clerk's `proxy.ts` is the middleware file at `apps/web/proxy.ts` — Vercel picks it up automatically.
- R2 CORS must allow `GET` and `HEAD` from your Vercel domain (or `*` for hackathon):
  ```json
  [{ "AllowedOrigins": ["*"], "AllowedMethods": ["GET", "HEAD"], "AllowedHeaders": ["*"] }]
  ```

---

## apps/render-worker → Coolify (Docker)

### How it works

The render worker is a Bun + Hono HTTP service. When the Next.js API calls `POST /render`, the worker:
1. Bundles `apps/web/src/remotion/index.tsx` with webpack (Remotion bundler)
2. Launches `chrome-headless-shell` to render every frame
3. Encodes to MP4 with FFmpeg
4. Uploads the file to Cloudflare R2
5. Updates the `render_jobs` row in Postgres

The Docker image is built from the **monorepo root** so the worker can reference the Remotion entry file in `apps/web`.

### Dockerfile details

- Base: `ubuntu:22.04`
- Installs: Bun, pnpm, FFmpeg, system libs for `chrome-headless-shell`
- `pnpm install` downloads the Linux `chrome-headless-shell` binary via Remotion's postinstall
- No system Chromium needed — Remotion uses its own headless binary

### Coolify Setup

1. **Create a new application** → "Dockerfile" deployment type.
2. **Repository**: your GitHub/GitLab repo.
3. **Dockerfile Location**: `apps/render-worker/Dockerfile`
4. **Build Context**: `/` (repo root — required so COPY can reach `packages/` and `apps/web/`)
5. **Port**: `8787`
6. **Environment variables**:

```
DATABASE_URL=
CLOUDFLARE_R2_ACCOUNT_ID=
CLOUDFLARE_R2_ACCESS_KEY_ID=
CLOUDFLARE_R2_SECRET_ACCESS_KEY=
CLOUDFLARE_R2_BUCKET_NAME=
CLOUDFLARE_R2_PUBLIC_URL=
RENDER_WORKER_SECRET=<same secret as in apps/web>
PORT=8787
```

7. **Deploy**. Coolify runs `docker build -f apps/render-worker/Dockerfile .` with the repo root as context.
8. After deploy, copy the public URL and set it as `RENDER_WORKER_URL` in your Vercel environment variables.

### Resource requirements

| Resource | Minimum | Recommended |
|---|---|---|
| RAM | 2 GB | 4 GB |
| CPU | 2 vCPU | 4 vCPU |
| Disk | 10 GB | 20 GB |

Oracle Cloud Free Tier (Ampere A1, 4 OCPU / 24 GB) is more than sufficient.

> **Note:** The first render after a cold start takes longer because Remotion bundles the composition (~30 s). Subsequent renders reuse the cached bundle in-memory.

### Build the image locally (optional)

```bash
# From the monorepo root
docker build -f apps/render-worker/Dockerfile -t opencut-worker .

# Run locally
docker run -p 8787:8787 \
  -e DATABASE_URL="..." \
  -e RENDER_WORKER_SECRET="..." \
  -e CLOUDFLARE_R2_ACCOUNT_ID="..." \
  -e CLOUDFLARE_R2_ACCESS_KEY_ID="..." \
  -e CLOUDFLARE_R2_SECRET_ACCESS_KEY="..." \
  -e CLOUDFLARE_R2_BUCKET_NAME="..." \
  -e CLOUDFLARE_R2_PUBLIC_URL="..." \
  opencut-worker
```

---

## Database

The database must be reachable from both Vercel (serverless) and the Coolify server.

Options:
- **Neon** (serverless Postgres, generous free tier) — works from Vercel edge
- **Supabase** (free tier, hosted Postgres) — works from both
- **Self-hosted on Coolify** — create a Postgres service in Coolify and use the internal network URL for the worker, and the public URL for Vercel

If using a self-hosted Postgres on Coolify, create two `DATABASE_URL` values:
- Vercel: use the **public** connection string (with SSL)
- Worker: use the **internal** Coolify network URL (faster, no SSL needed)
