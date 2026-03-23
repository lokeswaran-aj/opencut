# Tech Stack & Packages

## Package Versions

All confirmed latest as of March 2026. Pin exact versions in `package.json` (no `^` prefix on Remotion packages — they must all be the exact same version).

---

## Monorepo Root

```json
{
  "private": true,
  "packageManager": "pnpm@10.x",
  "scripts": {
    "dev": "pnpm --parallel -r dev",
    "build": "pnpm -r build",
    "typecheck": "pnpm -r typecheck"
  }
}
```

`pnpm-workspace.yaml`:
```yaml
packages:
  - "apps/*"
  - "packages/*"
```

---

## `packages/types`

Shared Zod schemas and TypeScript types consumed by both apps.

```json
{
  "name": "@repo/types",
  "dependencies": {
    "zod": "^3.24.0"
  }
}
```

---

## `apps/web`

### Runtime & Framework

| Package | Version | Purpose |
|---|---|---|
| `next` | `^16.1.6` | App framework. App Router, async params, proxy.ts |
| `react` | `^19.0.0` | UI |
| `react-dom` | `^19.0.0` | DOM rendering |
| `typescript` | `^5.8.0` | Type checking |

**Next.js 16 notes used in this project:**
- `params` in route handlers and page components is now a `Promise` → always `await params`
- `proxy.ts` lives at the project root alongside `app/` (not inside `src/`)
- `PageProps<'/path/[param]'>` helper type for type-safe page props

---

### AI

| Package | Version | Purpose |
|---|---|---|
| `ai` | `^6.0.134` | AI SDK v6 core — `streamText`, `generateObject`, `tool`, `DefaultChatTransport` |
| `@ai-sdk/anthropic` | `^3.0.63` | Anthropic provider for AI SDK |
| `@ai-sdk/react` | `^3.0.136` | `useChat` hook — installed separately (not bundled with `ai` in v6) |

**Models used:**

| Model string | Used for |
|---|---|
| `anthropic("claude-3-5-sonnet-20241022")` | Research synthesis, script generation, complex tool routing |
| `anthropic("claude-3-5-haiku-20241022")` | Lightweight edits: patch_scene, update_theme, reorder_scenes |

**AI SDK v6 key changes from v4:**
- Model identifiers: `anthropic("claude-3-5-sonnet-20241022")` — same pattern, new model names
- `stopWhen: stepCountIs(N)` replaces `maxSteps`
- `toUIMessageStreamResponse()` replaces `toDataStreamResponse()`
- `message.parts` replaces `message.toolInvocations` for tool call rendering
- `useChat` no longer returns `input`/`handleInputChange`/`handleSubmit` — manage input state manually
- Transport config: `new DefaultChatTransport({ api, body })` replaces top-level `api`/`body` options
- `messages: initialMessages` option (renamed from `initialMessages` in v5)
- `UIMessage` has no `content` field — `parts` array only
- Tool invocations stream as `type: "dynamic-tool"` parts for server-side tools

---

### Authentication

| Package | Version | Purpose |
|---|---|---|
| `@clerk/nextjs | ^7.0.6` | Auth — prebuilt UI, server helpers, route protection |

**Why Clerk over Better Auth:**
- Zero DB tables for auth — Clerk manages users in their cloud
- Prebuilt `<SignIn />`, `<SignUp />`, `<UserButton />` components work out of the box
- `auth()` server helper gives `userId` instantly in any route handler or server component
- Google OAuth configured in Clerk dashboard — no client ID/secret in app env vars
- Saves significant setup time for a hackathon

**Key integration points:**
- `proxy.ts` — `clerkMiddleware()` protects `/dashboard` and `/studio/*`
- `<ClerkProvider>` wraps root layout
- `/sign-in` and `/sign-up` pages use Clerk's prebuilt components
- `@clerk/elements` + shadcn for custom-styled auth forms if needed

---

### Database

| Package | Version | Purpose |
|---|---|---|
| `drizzle-orm` | `^0.44.0` | ORM — `pgTable`, `jsonb`, relations, queries |
| `drizzle-kit` | `^0.31.5` | Migrations, studio, codegen |
| `postgres` | `^3.4.5` | postgres.js driver (faster than `pg` for serverless-style use) |

---

### Video (Preview — browser only)

| Package | Version | Purpose |
|---|---|---|
| `remotion` | `4.0.438` | Core Remotion (frame rendering, `<Audio>`, `<AbsoluteFill>`) |
| `@remotion/player` | `4.0.438` | `<Player>` component for in-browser preview |

> All Remotion packages must be pinned to the **exact same version**. Remove `^` prefix.

---

### UI

| Package / Registry | Version | Purpose |
|---|---|---|
| `tailwindcss` | `^4.0.0` | CSS utility framework (v4 — CSS-first via `@import "tailwindcss"` in globals.css) |
| `shadcn/ui` | components | Accessible UI primitives — `npx shadcn@latest add <component>` |

**Installed shadcn components:** `button`, `textarea`, `scroll-area`, `badge`, `separator`

**Chat UI** is built as a custom `ChatPanel` component (`src/components/studio/ChatPanel.tsx`). It uses `useChat` from `@ai-sdk/react` via `StudioClient`, renders `message.parts`, and handles `type: "dynamic-tool"` parts with human-readable tool call indicators (pending spinner → done checkmark).

**Planned (not yet installed):**
- `framer-motion` — animations for tool cards, page transitions
- `lucide-react` — icon set
- `zustand` — client state for render progress store

**Tailwind v4 note:** Config is via `@import "tailwindcss"` in `app/globals.css`, not `tailwind.config.js`.

---

### Storage & External APIs

| Package | Version | Purpose |
|---|---|---|
| `@aws-sdk/client-s3` | `^3.1014.0` | Cloudflare R2 (S3-compatible) — upload audio + video |
| `@aws-sdk/s3-request-presigner` | `^3.1014.0` | Generate presigned URLs for audio serving |
| `@mendable/firecrawl-js` | `^4.16.0` | Firecrawl SDK — `search()`, `scrape()`, `extract()` |
| `elevenlabs` | `^1.59.0` | ElevenLabs SDK — TTS (`textToSpeech.convert`) |

---

### Utilities

| Package | Version | Purpose |
|---|---|---|
| `zod` | `^3.25.0` | Schema validation for tool inputs/outputs and VideoConfig |
| `nanoid` | `^5.0.0` | Short unique IDs for scene IDs, audio segment IDs |
| `@repo/types` | `workspace:*` | Shared VideoConfig, Scene, AudioSegment types |

---

## `apps/render-worker`

Bun + Hono service. Handles final video export only.

### Runtime

| Tool | Version | Purpose |
|---|---|---|
| `bun` | `^1.2.0` | JavaScript runtime — officially supported by Remotion 4.0.88+ |

**Known Bun + Remotion caveats (minor):**
- `lazyComponent` prop disabled in Bun — not used in render-worker
- Script may not auto-quit — handled with explicit `process.exit(0)` after render completes

---

### Packages

| Package | Version | Purpose |
|---|---|---|
| `hono` | `^4.0.0` | Web framework for Bun — request routing, SSE streaming |
| `remotion` | `4.0.438` | Core (must match `apps/web`) |
| `@remotion/bundler` | `4.0.438` | `bundle()` — webpack bundle of Remotion compositions |
| `@remotion/renderer` | `4.0.438` | `renderMedia()` — Chromium + FFmpeg render pipeline |
| `@aws-sdk/client-s3` | `^3.750.0` | Upload final `.mp4` to R2 |
| `drizzle-orm` | `^0.44.0` | Update `render_jobs` status in Postgres |
| `postgres` | `^3.4.5` | Postgres driver |
| `@repo/types` | `workspace:*` | Shared VideoConfig type |

---

## Infrastructure

### Docker Compose

```yaml
services:
  postgres:
    image: postgres:16
    restart: unless-stopped
    ports:
      - "5432:5432"
    environment:
      POSTGRES_DB: opencut
      POSTGRES_USER: opencut
      POSTGRES_PASSWORD: opencut
    volumes:
      - postgres_data:/var/lib/postgresql/data

  render-worker:
    build:
      context: ./apps/render-worker
      dockerfile: Dockerfile
    ports:
      - "3001:3001"
    environment:
      - DATABASE_URL=postgresql://opencut:opencut@postgres:5432/opencut
      - R2_ACCOUNT_ID=${R2_ACCOUNT_ID}
      - R2_ACCESS_KEY_ID=${R2_ACCESS_KEY_ID}
      - R2_SECRET_ACCESS_KEY=${R2_SECRET_ACCESS_KEY}
      - R2_BUCKET=${R2_BUCKET}
    depends_on:
      - postgres

volumes:
  postgres_data:
```

### Cloudflare R2

R2 configuration uses the S3-compatible API. Set the endpoint as:
```
https://{R2_ACCOUNT_ID}.r2.cloudflarestorage.com
```

Bucket structure:
```
opencut-bucket/
├── audio/
│   └── {projectId}/
│       ├── {sceneId}.mp3       (narration)
│       └── sfx-{type}.mp3     (sound effects)
└── exports/
    └── {projectId}/
        └── {jobId}.mp4         (final rendered video)
```

---

## Environment Variables

`apps/web/.env.local`:
```bash
# Database
DATABASE_URL=postgresql://opencut:opencut@localhost:5432/opencut

# Clerk — get from clerk.com dashboard
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/dashboard
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/dashboard
# Google OAuth is configured in the Clerk dashboard — no env vars needed here

# Anthropic
ANTHROPIC_API_KEY=

# ElevenLabs
ELEVENLABS_API_KEY=

# Firecrawl
FIRECRAWL_API_KEY=

# Cloudflare R2
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET=opencut-bucket
R2_PUBLIC_URL=https://pub-xxx.r2.dev     # public R2 domain (optional)

# Render Worker
RENDER_WORKER_URL=http://localhost:3001
RENDER_WORKER_SECRET=                    # shared secret for auth between web + worker
```

`apps/render-worker/.env`:
```bash
DATABASE_URL=postgresql://opencut:opencut@localhost:5432/opencut
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET=opencut-bucket
RENDER_WORKER_SECRET=
PORT=3001
```

---

## App Routes (Next.js)

```
/                              Landing page (marketing)
/sign-in                       Clerk <SignIn /> component
/sign-up                       Clerk <SignUp /> component
/dashboard                     Project grid — list, create, delete projects (protected)
/studio/[projectId]            Main editor (protected)
  ├─ Left panel:   ChatPanel (useChat + tool invocation cards)
  └─ Right panel:  VideoPreviewPanel — Remotion <Player> + Export button

/api/chat                      POST — AI streaming endpoint
/api/projects                  GET / POST (POST checks usage limit)
/api/projects/[id]             GET / PUT / DELETE
/api/audio/[id]                GET — R2 presigned redirect
/api/render                    POST — trigger render
/api/render/[jobId]/stream     GET — SSE render progress proxy
/api/usage                     GET — videosGenerated / maxVideos for current user
```

`proxy.ts` (Next.js 16) protects `/dashboard` and `/studio/*` via `clerkMiddleware`. All `/api/*` routes verify `userId` via `auth()` inside the handler.

---

## Remotion Compositions

Remotion entry point: `apps/web/remotion/index.ts`

```
apps/web/remotion/
├── index.ts                   registerRoot(Root)
├── Root.tsx                   <Composition> definitions
└── compositions/
    ├── VideoComposition.tsx   Main composition — renders VideoConfig
    └── scenes/
        ├── IntroScene.tsx
        ├── TitleScene.tsx
        ├── BulletsScene.tsx
        ├── QuoteScene.tsx
        ├── StatScene.tsx
        └── OutroScene.tsx
```

`VideoComposition` receives `VideoConfig` as `inputProps`, iterates over `scenes`, and renders the matching scene component using Remotion's `<Sequence>` for timing. Audio segments are rendered with `<Audio src={segment.url} startFrom={segment.startFrame} />`.

Scene components have layout variants for each aspect ratio (9:16, 16:9, 1:1, 4:5) selected via the `aspectRatio` field on the config.
