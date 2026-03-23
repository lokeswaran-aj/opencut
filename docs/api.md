# API Reference

All Next.js API routes live under `apps/web/app/api/`. All render-worker routes live in `apps/render-worker/src/`.

---

## Next.js API Routes

### `POST /api/chat`

Main AI streaming endpoint. Accepts a chat message, loads the current project state, and runs `streamText` with Firecrawl + video production tools. Returns an SSE stream compatible with AI SDK v6's `useChat` hook.

**Request body**
```json
{
  "messages": [UIMessage],
  "projectId": "uuid"
}
```

**Response**
`text/event-stream` — AI SDK UI message stream (`toUIMessageStreamResponse()`).

The stream emits:
- Text deltas (assistant thinking/narrating)
- Tool call start events (shows tool name + input in the chat panel)
- Tool result events (shows tool output in the chat panel)
- Final `finish` event

**Behavior by message type**

| User message pattern | Tools invoked |
|---|---|
| New topic / URL | `research_topic` → `generate_video_script` → `generate_audio_segment` × N → `generate_sound_effect` × N → `save_video_config` |
| "Change text in scene X" | `patch_scene` |
| "Change narration in scene X" | `regenerate_audio_segment` |
| "Add a section about Y" | `add_scene` → `generate_audio_segment` |
| "Remove scene X" | `remove_scene` |
| "Change colors / theme" | `update_theme` |
| "Make it landscape / square" | `generate_video_script` (new aspect ratio, reuses research report from DB) |

**Notes**
- Conversation history is loaded from `chat_messages` table on each request.
- Current `VideoConfig` is injected into the system prompt so the LLM can reference existing scenes without re-generating everything.
- Firecrawl MCP client is initialized per-request and closed in `onFinish`.
- The `claude-3-5-sonnet-20241022` model handles all reasoning. `claude-3-5-haiku-20241022` is used only for `patch_scene` and `update_theme` (lightweight structured edits).

---

### `GET /api/projects`

List all projects for the authenticated user, ordered by `updated_at` descending.

**Response**
```json
[
  {
    "id": "uuid",
    "title": "string",
    "status": "draft | generating | ready | rendering | done",
    "topic": "string | null",
    "sourceUrl": "string | null",
    "createdAt": "ISO8601",
    "updatedAt": "ISO8601"
  }
]
```

---

### `POST /api/projects`

Create a new empty project. Checks the user's `user_limits` row before creating — returns `429` if they have reached `maxVideos`. Upserts the `user_limits` row if this is the user's first project.

**Request body**
```json
{
  "title": "string",
  "topic": "string (optional)",
  "sourceUrl": "string (optional)",
  "aspectRatio": "9:16 | 16:9 | 1:1 | 4:5 (default: 9:16)"
}
```

**Response** — `201 Created`
```json
{
  "id": "uuid",
  "title": "string",
  "status": "draft",
  "createdAt": "ISO8601"
}
```

**Error** — `429 Too Many Requests`
```json
{
  "error": "You have reached the free tier limit of 5 videos.",
  "code": "LIMIT_REACHED",
  "videosGenerated": 5,
  "maxVideos": 5
}
```

---

### `GET /api/projects/[id]`

Get a single project including its current `VideoConfig` and full chat message history.

**Response**
```json
{
  "project": { "id", "title", "status", "aspectRatio", "topic", "sourceUrl", "createdAt", "updatedAt" },
  "config": VideoConfig | null,
  "messages": [UIMessage]
}
```

> **Next.js 16 note:** `params` is async. Route handler must `await params` before accessing `id`.

---

### `PUT /api/projects/[id]`

Update project metadata (title, status). Does not update the VideoConfig — that is handled by `save_video_config` tool.

**Request body**
```json
{
  "title": "string?",
  "status": "draft | generating | ready | rendering | done?"
}
```

**Response** — updated project object.

---

### `DELETE /api/projects/[id]`

Delete a project and all associated data (video config, audio files metadata, render jobs, chat messages). R2 objects are also deleted via the S3 client.

**Response** — `204 No Content`

---

### `GET /api/audio/[id]`

Redirect to a short-lived Cloudflare R2 presigned URL for the audio file. Presigned URL expires in 1 hour. This keeps R2 credentials server-side while still allowing Remotion Player and renderMedia to fetch audio from R2.

**Response** — `302 Redirect` to presigned R2 URL.

---

### `POST /api/render`

Trigger an export render job. Creates a `render_jobs` row with status `queued`, then calls the render-worker's `POST /render` endpoint asynchronously.

**Request body**
```json
{
  "projectId": "uuid"
}
```

**Response** — `202 Accepted`
```json
{
  "jobId": "uuid"
}
```

---

### `GET /api/render/[jobId]/stream`

SSE proxy that forwards the render-worker's progress stream to the browser. The browser connects to this once after receiving the `jobId` from `POST /api/render`.

**Response** — `text/event-stream`

Events emitted:

| Event | Data |
|---|---|
| `progress` | `{ "percent": 0–100, "stage": "bundling \| rendering \| uploading" }` |
| `done` | `{ "outputUrl": "https://r2.../exports/..." }` |
| `error` | `{ "message": "string" }` |

**Example client usage**
```typescript
const es = new EventSource(`/api/render/${jobId}/stream`)
es.addEventListener('progress', (e) => setProgress(JSON.parse(e.data).percent))
es.addEventListener('done', (e) => setDownloadUrl(JSON.parse(e.data).outputUrl))
es.addEventListener('error', () => es.close())
```

---

### `GET /api/usage`

Return the authenticated user's current generation usage against their tier limit. Used by the dashboard and studio to show the usage indicator and gate the "New video" button.

**Response**
```json
{
  "videosGenerated": 3,
  "maxVideos": 5,
  "tier": "free",
  "canGenerate": true
}
```

Returns `401` if not signed in.

---

### Auth — Clerk

Clerk handles all authentication. There is no `/api/auth` route in this app. Clerk's integration points are:

| Layer | How |
|---|---|
| Route protection | `proxy.ts` — `clerkMiddleware()` + `createRouteMatcher(['/dashboard(.*)', '/studio(.*)'])` |
| Server components / route handlers | `const { userId } = await auth()` from `@clerk/nextjs/server` |
| Client components | `const { user } = useUser()` from `@clerk/nextjs` |
| Sign-in page | `/sign-in` — renders Clerk `<SignIn />` component |
| Sign-up page | `/sign-up` — renders Clerk `<SignUp />` component |
| Header user button | `<UserButton />` component |

Google OAuth is configured entirely inside the Clerk dashboard — no client ID/secret needed in app environment variables.

`proxy.ts` (Next.js 16 replacement for `middleware.ts`):

```typescript
import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server"

const isProtected = createRouteMatcher(["/dashboard(.*)", "/studio(.*)"])

export default clerkMiddleware(async (auth, req) => {
  if (isProtected(req)) await auth.protect()
})

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
}
```

---

## Render Worker Routes (Bun + Hono, port 3001)

Internal service — not exposed to the browser directly. Only called by Next.js.

---

### `POST /render`

Start a render job. Bundles the Remotion project (cached after first run), renders with the provided `VideoConfig`, streams SSE progress, uploads to R2, and updates the DB.

**Request body**
```json
{
  "jobId": "uuid",
  "projectId": "uuid",
  "videoConfig": VideoConfig,
  "audioSegmentUrls": {
    "[sceneId]": "https://r2.../audio/..."
  }
}
```

**Response** — `text/event-stream`

Same event shape as `GET /api/render/[jobId]/stream`. Next.js proxies this stream directly.

**Internal process**

```mermaid
flowchart TD
    A["Receive POST /render<br/>videoConfig + jobId"]
    B["bundle()<br/>webpack Remotion entry<br/>SSE: bundling 0–30%"]
    C["selectComposition()<br/>VideoComposition + inputProps"]
    D["renderMedia()<br/>Chromium + FFmpeg<br/>SSE: rendering 30–90%"]
    E["Upload .mp4 to R2<br/>exports/projectId/jobId.mp4<br/>SSE: uploading 90–100%"]
    F["UPDATE render_jobs<br/>status=done, output_url"]
    G["SSE: done event<br/>outputUrl to browser"]

    A --> B --> C --> D --> E --> F --> G
```

---

### `GET /health`

Health check.

**Response** — `200 OK`
```json
{ "status": "ok" }
```

---

## Shared Types

All request/response types that cross service boundaries are defined in `packages/types/src/index.ts` and validated with Zod. Key exported types:

```typescript
VideoConfig        // Full video config passed to Player and renderMedia
Scene              // Union type of all scene variants
AudioSegment       // Audio track segment with R2 URL + frame offset
AspectRatio        // "9:16" | "16:9" | "1:1" | "4:5"
RenderJobStatus    // "queued" | "bundling" | "rendering" | "uploading" | "done" | "failed"
ResearchReport     // Synthesized research output from Firecrawl
```

---

## Error Handling

All API routes return consistent error shapes:

```json
{
  "error": "string",
  "code": "UNAUTHORIZED | NOT_FOUND | VALIDATION_ERROR | INTERNAL_ERROR"
}
```

HTTP status codes: `400` validation, `401` unauthorized, `404` not found, `500` internal.

Streaming routes (`/api/chat`, `/api/render/[id]/stream`) emit an `error` SSE event on failure rather than returning an HTTP error code, since the stream header has already been sent.
