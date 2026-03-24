# Architecture

## Overview

Opencut is a full-stack TypeScript monorepo that lets users generate short-form social videos by chatting with an AI. The AI researches a topic via Firecrawl, generates narration audio via ElevenLabs, optionally generates images via Vertex AI Imagen 3, and then writes a **complete Remotion React component from scratch** as a TypeScript string. That string is compiled in the browser with `@babel/standalone` and rendered live by the Remotion Player — no hardcoded templates, no fixed scene structure.

Key differentiator: the AI has full creative freedom over every visual element, animation, timing, and layout. It can generate viral-style TikTok hooks, Fireship-style tutorial sequences, or anything else — the output style is entirely AI-determined.

---

## Monorepo Structure

```
opencut/
├── apps/
│   ├── web/                        # Next.js 16 — main application
│   └── render-worker/              # Bun + Hono — video export service
├── packages/
│   └── types/                      # Shared Zod schemas + TypeScript types
├── docs/                           # This folder
├── docker-compose.yml
└── package.json                    # pnpm workspaces root
```

### `apps/web`

Next.js 16 application with App Router. Handles:
- All frontend UI (chat, live preview, project dashboard)
- All API route handlers (chat streaming, project CRUD, render trigger)
- AI pipeline via AI SDK v6 `streamText` + custom tools
- Client-side Babel compilation of AI-generated Remotion TSX (`src/remotion/compiler.ts`)
- Auth via Clerk with Google SSO
- Database access via Drizzle ORM

### `apps/render-worker`

Bun + Hono service running on port `8787`. Handles:
- Remotion `bundle()` + `renderMedia()` — must run outside Next.js to avoid webpack conflicts
- Bundle is cached in-process after the first call for fast subsequent renders
- Progress updates written directly to `render_jobs` table (polled by the browser via Next.js)
- Upload of final `.mp4` to Cloudflare R2 on completion
- Authentication via shared `RENDER_WORKER_SECRET` header

### `packages/types`

Shared Zod schemas and TypeScript types. The core `VideoConfig` schema contains:
- `id`, `title`, `aspectRatio`, `fps`, `durationInFrames`
- `code` — the complete AI-generated Remotion TSX component as a raw string

Also exports `AudioAsset` and `ImageAsset` interfaces used during the generation pipeline.

---

## System Architecture

```mermaid
graph TB
    subgraph Browser["Browser"]
        Chat["ChatPanel\nuseChat (DefaultChatTransport)\nTool call indicators per tool type"]
        Player["Remotion Player\ncompileCode(config.code) → Component\nLive preview at 30fps"]
        State["StudioClient React state\nuseState VideoConfig\npolled after streaming ends"]
        Chat -->|"streaming ends → fetch /api/projects/id"| State
        State -->|"config prop"| Player
    end

    subgraph Web["apps/web — Next.js 16"]
        ChatAPI["POST /api/chat\nstreamText + all tools"]
        RenderAPI["POST /api/projects/id/export\ntrigger export job"]
        RenderJob["GET /api/projects/id/render-job\npoll render job status"]
        ProjectsAPI["GET/POST /api/projects\nCRUD + limit check"]
        DownloadAPI["GET /api/projects/id/download\nR2 proxy download"]
    end

    subgraph Worker["apps/render-worker — Bun + Hono :8787"]
        RenderWorker["POST /render\nbundle + renderMedia\nSSE progress stream"]
    end

    subgraph External["External APIs"]
        Firecrawl["Firecrawl JS SDK\nsearch / scrape"]
        ElevenLabs["ElevenLabs API\ntextToSpeech.convert — narration audio"]
        Gemini["Google Vertex AI\nGemini 3.1 Pro — code gen\nGemini 3.1 Flash Lite — edits"]
        Imagen["Vertex AI Imagen 3\nimagen-3.0-generate-001\noptional image generation"]
        Clerk["Clerk\nAuth + session management"]
    end

    subgraph Storage["Storage"]
        R2["Cloudflare R2\naudio/projectId/id.mp3\nimages/projectId/imgN.png\nexports/projectId/jobId.mp4"]
        PG[("PostgreSQL\nDocker :5432")]
    end

    Browser -->|"SSE stream"| ChatAPI
    ChatAPI --> Firecrawl
    ChatAPI --> ElevenLabs
    ChatAPI --> Imagen
    ChatAPI --> Gemini
    ElevenLabs -->|"mp3 blob"| R2
    Imagen -->|"png blob"| R2
    ChatAPI --> PG
    ProjectsAPI --> PG
    Browser --> ProjectsAPI
    Browser -->|"trigger export"| RenderAPI
    RenderAPI --> Worker
    Browser -->|"poll progress"| RenderJob
    RenderJob --> PG
    RenderWorker --> R2
    RenderWorker --> PG
    Browser -->|"force download"| DownloadAPI
    DownloadAPI -->|"stream from R2"| Browser
    Browser <-->|"JWT cookie"| Clerk
    Web <-->|"auth() / currentUser()"| Clerk
```

---

## AI Generation Pipeline

```mermaid
sequenceDiagram
    participant U as User (Chat)
    participant AI as /api/chat (streamText)
    participant FC as Firecrawl
    participant EL as ElevenLabs
    participant IMG as Vertex AI Imagen 3
    participant R2 as Cloudflare R2
    participant GM as Gemini 3.1 Pro
    participant PG as PostgreSQL
    participant RP as Remotion Player

    U->>AI: "Make a TikTok about Stripe APIs"
    AI->>FC: research_topic(input)
    FC-->>AI: research content + summary

    loop For each narration segment (2–5)
        AI->>EL: generate_narration(text, voiceId)
        EL-->>AI: audio buffer
        AI->>R2: upload audio/projectId/id.mp3
        AI-->>U: "Generated narration N..."
    end

    opt AI decides images are useful
        AI->>IMG: generate_image(prompt)
        IMG-->>AI: image buffer
        AI->>R2: upload images/projectId/imgN.png
    end

    AI->>GM: generate_video_code(topic, research, audioAssets, imageAssets)
    Note over GM: Writes complete Remotion TSX<br/>with preloadAudio/preloadImage,<br/>pauseWhenBuffering, all timing
    GM-->>AI: full TSX component string

    AI->>PG: save_video_code(code, durationInFrames, fps, title)
    PG-->>AI: saved
    AI->>PG: UPDATE projects SET status=ready

    RP->>PG: poll GET /api/projects/id
    PG-->>RP: VideoConfig { code, durationInFrames, fps, ... }
    RP->>RP: compileCode(code) → Babel → Component
    RP-->>U: Live preview renders
```

---

## Live Preview — Runs entirely in the browser

The Remotion `<Player>` is a standard React component bundled with the Next.js app. When `save_video_code` sets `status = ready`, `StudioClient` polls `GET /api/projects/[id]` and calls `setConfig()`. The `VideoComposition` component:

1. Receives `VideoConfig` as `inputProps` from the Player
2. Calls `compileCode(config.code)` (memoized) from `src/remotion/compiler.ts`
3. `compiler.ts` uses `@babel/standalone` to transpile the TSX string into plain JS
4. The compiled function is executed via `new Function(...)` with Remotion globals injected
5. The resulting React component is rendered directly

**Injected globals** (no imports needed in generated code):
- Remotion core: `useCurrentFrame`, `useVideoConfig`, `AbsoluteFill`, `Sequence`, `Audio`, `Img`, `spring`, `interpolate`
- Preloading: `preloadAudio`, `preloadImage` (from `@remotion/preload`)
- Shapes: `Rect`, `Circle`, `Triangle`, `Star`, `Polygon`, `Ellipse`, `Heart`, `Pie`
- Transitions: `TransitionSeries`, `linearTiming`, `springTiming`, `fade`, `slide`, `wipe`, `flip`, `clockWipe`
- React hooks: `useState`, `useEffect`, `useMemo`, `useRef`

---

## Final Export — Runs in render-worker

```mermaid
sequenceDiagram
    participant B as Browser
    participant N as Next.js /api/projects/id/export
    participant W as render-worker :8787
    participant R2 as Cloudflare R2
    participant PG as PostgreSQL

    B->>N: POST /api/projects/id/export
    N->>PG: INSERT render_jobs (status: queued)
    N->>W: POST /render { jobId }
    N-->>B: 202 { jobId }
    B->>N: GET /api/projects/id/render-job (poll every 2.5s)
    W-->>B: progress updates via DB polling
    W->>R2: upload exports/projectId/jobId.mp4
    W->>PG: UPDATE render_jobs status=done, output_url
    B->>N: GET /api/projects/id/download
    N-->>B: stream MP4 (force-download proxy)
```

The render-worker runs the same Remotion composition in a headless Chromium instance. The `VideoComposition` component is bundled by `@remotion/bundler`, and the AI-generated `code` string goes through the same Babel compilation path as the live preview.

---

## VideoConfig — Central Data Model

```mermaid
flowchart LR
    GM["Gemini generates\ncomplete TSX string"]
    PG[("PostgreSQL\nvideo_configs table")]
    SC["StudioClient\nuseState VideoConfig"]
    RP["Remotion Player\nBabel compiles code\nbrowser preview"]
    RW["renderMedia()\nrender-worker\nheadless Chromium"]
    MP4["MP4 on R2\ndownload"]

    GM --> PG
    PG -->|"GET /api/projects/id\nafter stream ends"| SC
    SC -->|"config prop"| RP
    PG --> RW
    RW --> MP4
```

The config is pure JSON — safely serializable across all service boundaries.

```typescript
// packages/types/src/index.ts
export const VideoConfigSchema = z.object({
  id: z.string(),
  title: z.string(),
  aspectRatio: z.enum(["9:16", "16:9", "1:1", "4:5"]),
  fps: z.number().default(30),
  durationInFrames: z.number(),
  code: z.string().describe("Complete Remotion TSX component source code"),
})
```

---

## Authentication Flow

```mermaid
flowchart TD
    U["User visits /dashboard or /studio/projectId"]
    PM["proxy.ts\nclerkMiddleware()"]
    SignIn["Clerk hosted sign-in\n/sign-in page"]
    Google["Google OAuth\nvia Clerk dashboard config"]
    Session["Clerk JWT cookie\nstored in browser"]
    API["API Route Handler\nconst { userId } = await auth()"]

    U --> PM
    PM -->|"not signed in"| SignIn
    SignIn --> Google
    Google --> Session
    Session --> PM
    PM -->|"signed in"| U
    U --> API
```

- `proxy.ts` (Next.js 16) uses `clerkMiddleware()` + `createRouteMatcher` to protect `/dashboard` and `/studio/*`
- `auth()` from `@clerk/nextjs/server` gives `userId` in any server component or route handler
- Google OAuth configured entirely in the Clerk dashboard — no client ID/secret in app code

---

## Usage Limits

No separate table, no counters to maintain. Limits are derived at query time by counting rows.

```mermaid
flowchart LR
    REQ["API request"]
    AUTH["auth() → userId"]
    DB[("COUNT projects / render_jobs / chat_messages\nWHERE user_id = ?")]
    CHECK{"within limit?"}
    ALLOW["Allow"]
    BLOCK["Return 429\nLimit reached"]

    REQ --> AUTH
    AUTH --> DB
    DB --> CHECK
    CHECK -->|yes| ALLOW
    CHECK -->|no| BLOCK
```

| Resource | Table counted | Env var |
|---|---|---|
| Projects | `projects` (any status) | `FREE_TIER_MAX_PROJECTS=5` |
| Render exports | `render_jobs` (any status) | `FREE_TIER_MAX_RENDERS=10` |
| Chat messages | `chat_messages` (user role) | `FREE_TIER_MAX_MESSAGES=50` |

---

## Cloudflare R2 Storage

R2 is used for three asset types, accessed via the AWS S3-compatible SDK.

| Path | Content | Uploaded by | Accessed by |
|---|---|---|---|
| `audio/{projectId}/{id}.mp3` | ElevenLabs TTS narration | Next.js API during generation | Remotion Player + renderMedia |
| `images/{projectId}/{name}.png` | Vertex AI Imagen 3 output | Next.js API during generation | Remotion Player + renderMedia |
| `exports/{projectId}/{jobId}.mp4` | Final rendered video | render-worker after `renderMedia()` | `/api/projects/[id]/download` proxy |

**CORS required:** The R2 bucket must have a CORS policy allowing `GET` and `HEAD` from any origin, otherwise the browser cannot load audio and image assets for the Remotion Player.

---

## Streaming Architecture

All real-time communication uses SSE. No WebSockets, no polling on the chat stream.

| Stream | Source | Consumer |
|---|---|---|
| Chat + tool invocations | `/api/chat` via `toUIMessageStreamResponse()` | `useChat` hook |
| Render progress | DB polling at 2.5 s intervals | `VideoPreviewPanel` |

---

## Video Aspect Ratios

| Key | Width | Height | Target |
|---|---|---|---|
| `9:16` | 1080 | 1920 | TikTok, Instagram Reels, YouTube Shorts (default) |
| `16:9` | 1920 | 1080 | YouTube, LinkedIn |
| `1:1` | 1080 | 1080 | Instagram square |
| `4:5` | 1080 | 1350 | Instagram portrait feed |
