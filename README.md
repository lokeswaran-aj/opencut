# Opencut

AI-powered short-form video generation platform. Chat with an AI to generate complete, animated videos for TikTok, Instagram Reels, and YouTube Shorts — no templates, full creative freedom.

## How it works

1. Describe a topic or paste a URL in the chat
2. The AI researches the topic via Firecrawl, generates narration audio via ElevenLabs, and optionally generates images via Vertex AI Imagen 3
3. The AI writes a complete Remotion React component from scratch — no fixed templates
4. The component is compiled in the browser using Babel and rendered live in the Remotion Player
5. Export and download as an MP4

## Tech stack

| Layer | Technology |
|---|---|
| Frontend + API | Next.js 16 (App Router) |
| AI | Google Vertex AI — Gemini 3.1 Pro (code gen) / Flash Lite (edits) |
| Video (preview) | Remotion Player + `@babel/standalone` (client-side TSX compiler) |
| Video (export) | Remotion `renderMedia()` in `apps/render-worker` (Bun + Hono) |
| Audio | ElevenLabs TTS SDK |
| Images | Vertex AI Imagen 3 (optional, AI decides) |
| Research | Firecrawl JS SDK |
| Auth | Clerk (Google SSO) |
| Database | PostgreSQL + Drizzle ORM |
| Storage | Cloudflare R2 (audio + exported MP4s) |

## Monorepo structure

```
opencut/
├── apps/
│   ├── web/              # Next.js 16 — main application
│   └── render-worker/    # Bun + Hono — video export service
├── packages/
│   └── types/            # Shared Zod schemas + TypeScript types
└── docs/                 # Architecture, API, agent, and DB docs
```

## Getting started

### Prerequisites

- Node.js 20+, pnpm 10+, Bun 1.2+
- Docker (for PostgreSQL)
- API keys: Clerk, ElevenLabs, Firecrawl, Google Vertex AI, Cloudflare R2

### 1. Install dependencies

```bash
pnpm install
```

### 2. Start PostgreSQL

```bash
pnpm docker:start
```

### 3. Configure environment variables

```bash
cp apps/web/.env.example apps/web/.env.local
cp apps/render-worker/.env.example apps/render-worker/.env
```

Fill in your API keys. See [docs/techstack.md](docs/techstack.md) for details on each variable.

### 4. Push database schema

```bash
pnpm --filter web db:push
```

### 5. Start development servers

```bash
# In one terminal — Next.js web app
pnpm --filter web dev

# In another terminal — render worker
pnpm --filter render-worker dev
```

Open [http://localhost:3000](http://localhost:3000).

### Cloudflare R2 CORS

Your R2 bucket must have a CORS policy to allow the browser to load audio and images. In the Cloudflare dashboard → R2 → your bucket → Settings → CORS Policy:

```json
[
  {
    "AllowedOrigins": ["*"],
    "AllowedMethods": ["GET", "HEAD"],
    "AllowedHeaders": ["*"],
    "MaxAgeSeconds": 3600
  }
]
```

## Free tier limits

| Resource | Default limit | Env var |
|---|---|---|
| Projects | 5 per account | `FREE_TIER_MAX_PROJECTS` |
| Render exports | 10 per account | `FREE_TIER_MAX_RENDERS` |
| Chat messages | 50 per account | `FREE_TIER_MAX_MESSAGES` |

Limits are derived at query time from existing table rows — no separate counters table.

## Documentation

- [Architecture](docs/architecture.md) — system design, data flow, live preview vs export
- [Tech Stack](docs/techstack.md) — all packages, versions, and environment variables
- [AI Agents & Tools](docs/agents.md) — tool definitions, AI pipeline, prompt engineering
- [API Reference](docs/api.md) — all Next.js and render-worker routes
- [Database](docs/database.md) — Drizzle schema, ER diagram, and usage limit logic
