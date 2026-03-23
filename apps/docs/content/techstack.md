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
  "name": "@opencut/types",
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

**Next.js 16 breaking changes used in this project:**
- `params` in route handlers and page components is now a `Promise` → always `await params`
- `middleware.ts` renamed to `proxy.ts` (edge runtime no longer default)
- `PageProps<'/path/[param]'>` helper type for type-safe page props

---

### AI

| Package | Version | Purpose |
|---|---|---|
| `ai` | `^6.0.0` | AI SDK v6 core — `streamText`, `generateObject`, `tool` |
| `@ai-sdk/anthropic` | `^1.0.0` | Anthropic provider for AI SDK |
| `@ai-sdk/react` | `^1.0.0` | `useChat` hook for streaming chat UI |
| `@ai-sdk/mcp` | `^0.2.0` | MCP client (used if Firecrawl MCP needed in future) |

**Models used:**

| Model string | Used for |
|---|---|
| `anthropic("claude-sonnet-4-6")` | Research synthesis, script generation, complex tool routing |
| `anthropic("claude-haiku-4-5-20251001")` | Lightweight edits: patch_scene, update_theme, reorder_scenes |

**AI SDK v6 key changes from v4:**
- Model identifiers: `anthropic("claude-sonnet-4-6")` — same pattern, new model names
- `stopWhen: stepCountIs(N)` replaces `maxSteps`
- `toUIMessageStreamResponse()` replaces `toDataStreamResponse()`
- `message.parts` replaces `message.toolInvocations` for tool call rendering

---

### Authentication

| Package | Version | Purpose |
|---|---|---|
| `@clerk/nextjs` | `^6.0.0` | Auth — prebuilt UI, server helpers, route protection |

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
| `remotion` | `4.0.399` | Core Remotion (frame rendering, `<Audio>`, `<AbsoluteFill>`) |
| `@remotion/player` | `4.0.399` | `<Player>` component for in-browser preview |

> All Remotion packages must be pinned to the **exact same version**. Remove `^` prefix.

---

### UI

| Package / Registry | Version | Purpose |
|---|---|---|
| `tailwindcss` | `^4.0.0` | CSS utility framework (v4 — CSS-first config via `@theme` in globals.css) |
| `shadcn/ui` | components | Accessible UI primitives — `npx shadcn@latest add <component>` |
| AI Elements | registry | Vercel's AI-native chat components — `npx shadcn@latest add <ai-elements-url>` |
| `framer-motion` | `^12.0.0` | Animations for tool cards, page transitions |
| `lucide-react` | `latest` | Icon set |
| `zustand` | `^5.0.0` | Client state — VideoConfig store, render progress store |

**AI Elements** is Vercel's shadcn-based registry for building AI chat UIs. Components are copied into `src/components/ai-elements/` and fully owned/customizable. Install each component via:

```bash
npx shadcn@latest add https://ai-sdk.dev/elements/r/<component-name>.json
```

Components used in Opencut:

| Component | Path | Used for |
|---|---|---|
| `Conversation` | `ai-elements/conversation` | Chat panel scroll container |
| `ConversationContent` | `ai-elements/conversation` | Message list with auto-scroll |
| `ConversationEmptyState` | `ai-elements/conversation` | Empty state before first message |
| `Message` | `ai-elements/message` | User and assistant message bubbles |
| `MessageContent` | `ai-elements/message` | Message inner content wrapper |
| `MessageResponse` | `ai-elements/message` | Markdown-rendered text response |
| `PromptInput` | `ai-elements/prompt-input` | Chat input box container |
| `PromptInputTextarea` | `ai-elements/prompt-input` | Auto-resize textarea |
| `PromptInputSubmit` | `ai-elements/prompt-input` | Send button with streaming state |
| `Loader` | `ai-elements/loader` | Animated dots while Claude is responding |
| `Sources` | `ai-elements/sources` | Collapsible Firecrawl source links |
| `Reasoning` | `ai-elements/reasoning` | Collapsible Claude thinking block |
| `Actions` + `Action` | `ai-elements/actions` | Copy / retry buttons on messages |

Custom tool invocation cards (`SearchCard`, `ScriptCard`, `AudioCard`, etc.) are built as regular shadcn components on top of the `Message` + `MessageContent` structure, rendered from `message.parts` when `part.type` starts with `"tool-"`.

**Tailwind v4 note:** Config is in `app/globals.css` using `@theme` directive, not `tailwind.config.js`.

---

### Storage & External APIs

| Package | Version | Purpose |
|---|---|---|
| `@aws-sdk/client-s3` | `^3.750.0` | Cloudflare R2 (S3-compatible) — upload audio + video |
| `@aws-sdk/s3-request-presigner` | `^3.750.0` | Generate presigned URLs for audio serving |
| `@mendable/firecrawl-js` | `^1.0.0` | Firecrawl SDK — search, scrape, extract, crawl |
| `elevenlabs` | `^1.0.0` | ElevenLabs SDK — TTS + sound effects |

---

### Utilities

| Package | Version | Purpose |
|---|---|---|
| `zod` | `^3.24.0` | Schema validation for tool inputs/outputs and VideoConfig |
| `nanoid` | `^5.0.0` | Short unique IDs for scene IDs, audio segment IDs |
| `@opencut/types` | `workspace:*` | Shared VideoConfig, Scene, AudioSegment types |

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
| `remotion` | `4.0.399` | Core (must match `apps/web`) |
| `@remotion/bundler` | `4.0.399` | `bundle()` — webpack bundle of Remotion compositions |
| `@remotion/renderer` | `4.0.399` | `renderMedia()` — Chromium + FFmpeg render pipeline |
| `@aws-sdk/client-s3` | `^3.750.0` | Upload final `.mp4` to R2 |
| `drizzle-orm` | `^0.44.0` | Update `render_jobs` status in Postgres |
| `postgres` | `^3.4.5` | Postgres driver |
| `@opencut/types` | `workspace:*` | Shared VideoConfig type |

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
  ├─ Left panel:   Chat (useChat + tool invocation cards)
  ├─ Center:       Remotion <Player> live preview + playback controls
  └─ Right panel:  Scene list, theme panel, Export button

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
