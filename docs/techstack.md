# Tech Stack & Packages

## Monorepo Root

```json
{
  "private": true,
  "packageManager": "pnpm@10.x",
  "scripts": {
    "dev": "pnpm --parallel -r dev",
    "build": "pnpm -r build",
    "typecheck": "pnpm -r typecheck",
    "docker:start": "docker compose up -d",
    "docker:stop": "docker compose down",
    "docker:clean": "docker compose down -v"
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

Key exports: `VideoConfig`, `VideoConfigSchema`, `AudioAsset`, `ImageAsset`, `AspectRatio`, `ASPECT_RATIOS`

---

## `apps/web`

### Runtime & Framework

| Package      | Version   | Purpose                                            |
| ------------ | --------- | -------------------------------------------------- |
| `next`       | `^16.2.0` | App framework — App Router, async params, proxy.ts |
| `react`      | `^19.2.0` | UI                                                 |
| `react-dom`  | `^19.2.0` | DOM rendering                                      |
| `typescript` | `^5.8.0`  | Type checking                                      |

**Next.js 16 notes:**

- `params` in route handlers and page components is a `Promise` → always `await params`
- `proxy.ts` lives at the project root alongside `app/` (not inside `src/`)

---

### AI

| Package                 | Version  | Purpose                                                                       |
| ----------------------- | -------- | ----------------------------------------------------------------------------- |
| `ai`                    | `^6.0.0` | AI SDK v6 core — `streamText`, `generateText`, `tool`, `DefaultChatTransport` |
| `@ai-sdk/google-vertex` | latest   | Google Vertex AI provider — Gemini models + Imagen 3 image generation         |
| `@ai-sdk/react`         | `^3.0.0` | `useChat` hook                                                                |

**Provider:** Google Vertex AI exclusively. No Anthropic or OpenAI keys required.

| Env var                          | Value                                             |
| -------------------------------- | ------------------------------------------------- |
| `GOOGLE_VERTEX_PROJECT`          | Your GCP project ID                               |
| `GOOGLE_VERTEX_LOCATION`         | `global` (required for Gemini 3.1 preview models) |
| `GOOGLE_APPLICATION_CREDENTIALS` | Path to service account JSON (local dev)          |
| `GOOGLE_CLIENT_EMAIL`            | Service account email (deployment)                |
| `GOOGLE_PRIVATE_KEY`             | Service account private key (deployment)          |

**Models used:**

| Use case                 | Model                                                        |
| ------------------------ | ------------------------------------------------------------ |
| Remotion code generation | `gemini-3.1-pro-preview`                                     |
| Lightweight edits        | `gemini-3.1-flash-lite-preview`                              |
| Image generation         | `imagen-3.0-generate-001` (via `experimental_generateImage`) |

**AI SDK v6 key patterns used in this project:**

- `stopWhen: stepCountIs(25)` for multi-step tool calling
- `toUIMessageStreamResponse()` for SSE chat streaming
- `message.parts` for rendering tool invocations in the chat UI
- `new DefaultChatTransport({ api, body })` for `useChat` transport config
- `UIMessage` uses `parts` array only — no `content` field

---

### Authentication

| Package         | Version  | Purpose                                              |
| --------------- | -------- | ---------------------------------------------------- |
| `@clerk/nextjs` | `^7.0.6` | Auth — prebuilt UI, server helpers, route protection |

**Integration points:**

- `proxy.ts` — `clerkMiddleware()` protects `/dashboard` and `/studio/*`
- `<ClerkProvider>` wraps root layout
- `auth()` server helper gives `userId` in route handlers and server components
- `useUser()` hook in client components — `isSignedIn` for conditional rendering
- Google OAuth configured in Clerk dashboard — no client ID/secret in app env vars

---

### Database

| Package       | Version   | Purpose                                                |
| ------------- | --------- | ------------------------------------------------------ |
| `drizzle-orm` | `^0.44.0` | ORM — `pgTable`, `jsonb`, relations, queries           |
| `drizzle-kit` | `^0.31.5` | Schema push, migrations, studio                        |
| `postgres`    | `^3.4.5`  | postgres.js driver                                     |
| `dotenv-cli`  | latest    | Load `.env.local` in `db:push` / `db:generate` scripts |

**Scripts:**

```bash
pnpm --filter web db:push      # push schema to DB (uses dotenv-cli to load .env.local)
pnpm --filter web db:generate  # generate migration files
pnpm --filter web db:studio    # open Drizzle Studio
```

---

### Video (preview — browser only)

| Package                 | Version   | Purpose                                                                                  |
| ----------------------- | --------- | ---------------------------------------------------------------------------------------- |
| `remotion`              | `4.0.438` | Core — `<Audio>`, `<AbsoluteFill>`, `<Sequence>`, `<Img>`, `spring`, `interpolate`       |
| `@remotion/player`      | `4.0.438` | `<Player>` component for in-browser preview                                              |
| `@remotion/preload`     | `4.0.438` | `preloadAudio()`, `preloadImage()` — eager asset loading                                 |
| `@remotion/shapes`      | `4.0.438` | `<Rect>`, `<Circle>`, `<Triangle>`, etc. — injected as globals                           |
| `@remotion/transitions` | `4.0.438` | `<TransitionSeries>`, `fade`, `slide`, `wipe`, `flip`, `clockWipe` — injected as globals |
| `@babel/standalone`     | `^7.29.0` | Client-side TSX compiler for AI-generated Remotion code                                  |

> All Remotion packages must be pinned to the **exact same version** — no `^` prefix.

**How the compiler works (`src/remotion/compiler.ts`):**

1. Strips import statements from the AI-generated TSX string
2. Wraps it in a `const DynamicOverlay = () => { ... }` shell
3. Calls `Babel.transform(..., { presets: ["react", "typescript"] })`
4. Executes via `new Function(...)` with all Remotion globals pre-injected
5. Returns `{ Component, error }` — `VideoComposition` renders `<Component />` if no error

---

### UI

| Package                        | Purpose                                                            |
| ------------------------------ | ------------------------------------------------------------------ |
| `tailwindcss` `^4.0.0`         | CSS utility framework (v4 — CSS-first via `@import "tailwindcss"`) |
| shadcn/ui components           | Accessible UI primitives                                           |
| `@ai-sdk/ai-elements` (Vercel) | `PromptInput`, `Conversation`, `Message` — AI chat UI              |
| `sonner`                       | Toast notifications (`<Toaster richColors />`)                     |
| `lucide-react`                 | Icon set                                                           |

**Installed shadcn components:** `button`, `textarea`, `scroll-area`, `badge`, `separator`, `tooltip`, `hover-card`, `dialog`

**Tailwind v4 note:** Config is via `@import "tailwindcss"` in `app/globals.css` — no `tailwind.config.js`.

---

### Storage & External APIs

| Package                         | Version     | Purpose                                                         |
| ------------------------------- | ----------- | --------------------------------------------------------------- |
| `@aws-sdk/client-s3`            | `^3.1014.0` | Cloudflare R2 (S3-compatible) — upload audio, images, and video |
| `@aws-sdk/s3-request-presigner` | `^3.1014.0` | Presigned URLs (used internally)                                |
| `@mendable/firecrawl-js`        | `^4.16.0`   | Firecrawl SDK — `search()`, `scrape()`                          |
| `elevenlabs`                    | `^1.59.0`   | ElevenLabs SDK — `textToSpeech.convert()`                       |

**R2 environment variables:**

| Env var                           | Description                                      |
| --------------------------------- | ------------------------------------------------ |
| `CLOUDFLARE_R2_ACCOUNT_ID`        | Cloudflare account ID                            |
| `CLOUDFLARE_R2_ACCESS_KEY_ID`     | R2 API token key ID                              |
| `CLOUDFLARE_R2_SECRET_ACCESS_KEY` | R2 API token secret                              |
| `CLOUDFLARE_R2_BUCKET_NAME`       | Bucket name (e.g. `opencut-assets`)              |
| `CLOUDFLARE_R2_PUBLIC_URL`        | Public R2 domain (e.g. `https://pub-xxx.r2.dev`) |

**CORS required on R2 bucket** (via Cloudflare dashboard → R2 → Settings → CORS Policy):

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

---

### Utilities

| Package                     | Purpose                                                   |
| --------------------------- | --------------------------------------------------------- |
| `zod` `^3.25.0`             | Schema validation for tool inputs/outputs and VideoConfig |
| `nanoid` `^5.0.0`           | Short unique IDs                                          |
| `@repo/types` `workspace:*` | Shared VideoConfig, AudioAsset, ImageAsset types          |

---

## `apps/render-worker`

Bun + Hono service. Handles final video export only — not exposed to the browser.

### Runtime

| Tool  | Version  | Purpose                                                       |
| ----- | -------- | ------------------------------------------------------------- |
| `bun` | `^1.2.0` | JavaScript runtime — officially supported by Remotion 4.0.88+ |

### Packages

| Package              | Version       | Purpose                                              |
| -------------------- | ------------- | ---------------------------------------------------- |
| `hono`               | `^4.0.0`      | Web framework for Bun                                |
| `remotion`           | `4.0.438`     | Core (must match `apps/web`)                         |
| `@remotion/bundler`  | `4.0.438`     | `bundle()` — webpack bundle of Remotion compositions |
| `@remotion/renderer` | `4.0.438`     | `renderMedia()` — Chromium + FFmpeg render pipeline  |
| `@aws-sdk/client-s3` | `^3.750.0`    | Upload final `.mp4` to R2                            |
| `drizzle-orm`        | `^0.44.0`     | Update `render_jobs` status in Postgres              |
| `postgres`           | `^3.4.5`      | Postgres driver                                      |
| `@repo/types`        | `workspace:*` | Shared VideoConfig type                              |

---

## Infrastructure

### Docker Compose (PostgreSQL only)

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

volumes:
  postgres_data:
```

The render-worker runs locally during development (`pnpm --filter render-worker dev`).

---

## Full Environment Variables Reference

### `apps/web/.env.local`

```bash
# Database
DATABASE_URL=postgresql://opencut:opencut@localhost:5432/opencut

# Clerk
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL=/dashboard
NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL=/dashboard

# ElevenLabs
ELEVENLABS_API_KEY=

# Firecrawl
FIRECRAWL_API_KEY=

# Google Vertex AI (Gemini models + Imagen 3)
GOOGLE_VERTEX_PROJECT=your-gcp-project-id
GOOGLE_VERTEX_LOCATION=global
# Local dev — service account JSON file:
GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json
# Deployment — individual fields from service account JSON:
GOOGLE_CLIENT_EMAIL=
GOOGLE_PRIVATE_KEY=
GOOGLE_PRIVATE_KEY_ID=

# Cloudflare R2
CLOUDFLARE_R2_ACCOUNT_ID=
CLOUDFLARE_R2_ACCESS_KEY_ID=
CLOUDFLARE_R2_SECRET_ACCESS_KEY=
CLOUDFLARE_R2_BUCKET_NAME=
CLOUDFLARE_R2_PUBLIC_URL=https://pub-xxx.r2.dev

# Render worker
RENDER_WORKER_URL=http://localhost:8787
RENDER_WORKER_SECRET=some-shared-secret

# Usage limits (account-level cumulative counts)
FREE_TIER_MAX_PROJECTS=5
FREE_TIER_MAX_RENDERS=10
FREE_TIER_MAX_MESSAGES=50
```

### `apps/render-worker/.env`

```bash
DATABASE_URL=postgresql://opencut:opencut@localhost:5432/opencut
CLOUDFLARE_R2_ACCOUNT_ID=
CLOUDFLARE_R2_ACCESS_KEY_ID=
CLOUDFLARE_R2_SECRET_ACCESS_KEY=
CLOUDFLARE_R2_BUCKET_NAME=
CLOUDFLARE_R2_PUBLIC_URL=
RENDER_WORKER_SECRET=some-shared-secret
PORT=8787
```

---

## App Routes (Next.js)

```
/                              Landing page
/sign-in                       Clerk <SignIn /> component
/sign-up                       Clerk <SignUp /> component
/dashboard                     Project grid — list, create, delete (protected)
/studio/[projectId]            Main editor (protected)
  ├─ Left panel:   ChatPanel (useChat + tool call cards)
  └─ Right panel:  VideoPreviewPanel — Remotion <Player> + Export button

/api/chat                      POST — AI streaming endpoint (SSE)
/api/projects                  GET / POST
/api/projects/[id]             GET / PUT / DELETE
/api/projects/[id]/export      POST — trigger render job
/api/projects/[id]/render-job  GET — poll render job status
/api/projects/[id]/download    GET — force-download proxy for exported MP4
/api/usage                     GET — usage counts vs limits
```
