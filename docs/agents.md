# AI Agents & Tools

## Overview

There is a single `streamText` call per chat request, using Claude as the model. The LLM autonomously decides which tools to invoke based on the message content and conversation history. There is no explicit agent graph — the conversation history acts as memory, and tool descriptions enforce the routing logic.

Two logical phases exist within this single call:
- **Phase 1 — Research**: Firecrawl JS SDK tools wrapped as AI SDK tools
- **Phase 2 — Video Production**: Custom AI SDK tools (ElevenLabs, Remotion config generation)

A third phase handles iterative edits on follow-up messages.

---

## Models

The model provider and names are configurable via environment variables. Defaults are Anthropic.

| Use case | Default model | Env var |
|---|---|---|
| Research synthesis, script generation, complex reasoning | `claude-sonnet-4-5` | `AI_GENERATION_MODEL` |
| Lightweight edits (`patch_scene`) | `claude-haiku-4-5` | `AI_EDIT_MODEL` |

The provider is selected by `AI_PROVIDER` (`anthropic` or `vertex`). The `getGenerationModel()` / `getEditModel()` helpers in `src/lib/ai/model.ts` return the correct model instance. The `/api/chat` route classifies each incoming message as generation vs. edit and picks the appropriate model.

---

## Tool Invocation Flow

### New project (first message)

```
User: "Make a TikTok video about Stripe's payment APIs"

Claude calls:
  1. research_topic({ input: "Stripe payment APIs" })
      └─ internally calls firecrawl.search / firecrawl.scrape
      └─ returns: { content, summary, keyFacts, sources }

  2. generate_video_script({ researchContent, topic, aspectRatio: "9:16" })
      └─ uses generateObject with VideoScriptSchema
      └─ returns: VideoConfig skeleton (scenes with _narrationText in data, no audio yet)

  3. generate_audio_segment({ sceneId: "scene-0", narrationText: "...", voiceId? })
  4. generate_audio_segment({ sceneId: "scene-1", narrationText: "..." })
  5. generate_audio_segment({ sceneId: "scene-2", narrationText: "..." })
     ... (one call per scene, run sequentially so progress is visible in chat)

  6. save_video_config({ config: VideoConfig })
      └─ auto-merges audio files from audioFiles table by sceneId
      └─ saves complete config (with scene.audio populated) to video_configs
      └─ updates project status to "ready"
      └─ returns: { videoConfigId, version, config }

Claude: "Here's your video about Stripe's APIs! I've created 5 scenes covering
        their core payment flow, Stripe Elements, and webhooks. Preview is ready."
```

### Follow-up edit (visual change only)

```
User: "Make the intro heading bigger"

Claude calls:
  1. patch_scene({ sceneId: "scene-0", updates: { heading: "NEW HEADING TEXT" }, newDurationInFrames? })
      └─ model: getEditModel() (haiku by default)
      └─ merges updates into scene.data, saves new version to video_configs
      └─ returns: { videoConfigId, config }

Claude: "Updated the intro heading."
```

### Follow-up edit (narration change)

```
User: "Rewrite the narration for scene 2 to be more energetic"

Claude calls:
  1. regenerate_audio_segment({ sceneId: "scene-2", newNarrationText: "...", voiceId? })
      └─ calls ElevenLabs TTS with new text
      └─ uploads new audio to R2, inserts new audio_files row
      └─ returns: AudioSegment with new publicUrl

Claude: "Redone! Scene 2's narration now has more energy."
```

---

## Tool Definitions

All tools are created by `makeTools(projectId)` in `src/lib/ai/tools.ts`. The `projectId` is captured via closure — no tool accepts it as an explicit input.

### Phase 1 — Research Tools

These wrap the Firecrawl JS SDK (`@mendable/firecrawl-js`). The LLM calls `research_topic` and the tool internally orchestrates Firecrawl calls based on whether the input is a URL or a topic string.

---

#### `research_topic`

```typescript
research_topic: tool({
  inputSchema: z.object({
    input: z.string().describe("A URL (https://...) or a topic/keyword string"),
  }),
  execute: async ({ input }) => {
    const isUrl = input.startsWith("http")
    if (isUrl) {
      const result = await firecrawl.scrape(input, { formats: ["markdown"] })
      // build content from result.markdown
    } else {
      const results = await firecrawl.search(input, {
        limit: 5,
        scrapeOptions: { formats: ["markdown"], onlyMainContent: true },
      })
      // build content from results[].markdown
    }
    await db.insert(researchReports).values({ projectId, content, summary, keyFacts, sources })
    return { content, summary, keyFacts, sources }
  },
})
```

**Internally uses:**
- `firecrawl.search(query, { limit, scrapeOptions })` — web search + scrape (topic input)
- `firecrawl.scrape(url, { formats: ["markdown"] })` — single-page scrape (URL input)

---

### Phase 2 — Video Production Tools

#### `generate_video_script`

```typescript
generate_video_script: tool({
  inputSchema: z.object({
    researchContent: z.string(),
    topic: z.string(),
    aspectRatio: z.enum(["9:16", "16:9", "1:1", "4:5"]).default("9:16"),
  }),
  execute: async ({ researchContent, topic, aspectRatio }) => {
    const { object: script } = await generateObject({
      model: getGenerationModel(),
      schema: VideoScriptSchema,   // from @repo/types
      prompt: buildScriptPrompt(researchContent, topic, aspectRatio),
    })
    // Maps script.scenes → VideoConfig; stores narrationText in scene.data._narrationText
    return config   // VideoConfig (fps: 30, no audio yet)
  },
})
```

---

#### `generate_audio_segment`

```typescript
generate_audio_segment: tool({
  inputSchema: z.object({
    sceneId: z.string(),
    narrationText: z.string().max(600),
    voiceId: z.string().optional(),
  }),
  execute: async ({ sceneId, narrationText, voiceId }) => {
    const audioStream = await elevenlabs.textToSpeech.convert(voice, {
      text: narrationText,
      model_id: "eleven_multilingual_v2",
      output_format: "mp3_44100_128",
    })
    const buffer = await streamToBuffer(audioStream)
    const { publicUrl } = await uploadToR2(key, buffer, "audio/mpeg")
    await db.insert(audioFiles).values({ projectId, sceneId, publicUrl, durationMs, ... })
    return AudioSegment  // { id, type, r2Key, publicUrl, durationMs, durationInFrames, voiceId }
  },
})
```

---

#### `save_video_config`

```typescript
save_video_config: tool({
  // Audio is auto-merged from audioFiles table — AI does NOT need to pass audio in config
  inputSchema: z.object({
    config: z.custom<VideoConfig>(),
  }),
  execute: async ({ config }) => {
    // 1. Query all audioFiles for this project (latest per sceneId)
    // 2. Attach each as scene.audio: AudioSegment
    // 3. Enforce fps: config.fps ?? 30
    // 4. INSERT into video_configs with merged config
    // 5. UPDATE projects SET status = "ready"
    return { videoConfigId, version, config: configWithAudio }
  },
})
```

---

### Phase 3 — Edit Tools

Edit tools use `getEditModel()` (haiku by default). Only called on follow-up messages when a video already exists.

---

#### `patch_scene`

```typescript
patch_scene: tool({
  inputSchema: z.object({
    sceneId: z.string(),
    updates: z.record(z.unknown()),          // merged into scene.data
    newDurationInFrames: z.number().optional(),
  }),
  // Loads latest VideoConfig from DB, merges updates into target scene.data,
  // saves as a new version. Does NOT touch audio.
})
```

---

#### `regenerate_audio_segment`

```typescript
regenerate_audio_segment: tool({
  inputSchema: z.object({
    sceneId: z.string(),
    newNarrationText: z.string().max(600),
    voiceId: z.string().optional(),
  }),
  // Calls ElevenLabs TTS, uploads to R2, inserts new audioFiles row.
  // Returns updated AudioSegment with new publicUrl.
})
```

---

## System Prompt

Built dynamically per request in `apps/web/src/lib/ai/system-prompt.ts`:

```typescript
export function buildSystemPrompt(existingConfig: VideoConfig | null): string {
  const hasVideo = existingConfig !== null
  const editContext = hasVideo
    ? `## Current Video State\n...(JSON slice of existingConfig)...\nPrefer EDIT tools over regeneration.`
    : `## No video yet\nRun the full pipeline:\n1. research_topic\n2. generate_video_script\n3. generate_audio_segment per scene\n4. save_video_config`

  return `You are Opencut, an AI video generation assistant...
## Scene types and required data fields
| Type    | Required data                          | Optional data  |
|---------|----------------------------------------|----------------|
| intro   | headline                               | subtext, gradient |
| title   | title                                  | subtitle       |
| bullets | heading, items (non-empty string array)| —              |
| quote   | text                                   | author         |
| stat    | value, label                           | context        |
| outro   | headline                               | cta, brand     |

IMPORTANT: for bullets scenes always provide both heading and items.
## Rules
- Always call save_video_config as the final step after all audio is ready
- Generate audio for every scene that has narrationText
...${editContext}`
}
```

---

## VideoConfig Schema (Zod)

Defined in `packages/types/src/index.ts`. This is the central data model.

```typescript
// Scene data uses a flat optional object (all fields optional because they're shared
// across scene types). Scene components access fields via scene.data.fieldName.
const SceneDataSchema = z.object({
  // intro
  headline: z.string().optional(),
  subtext: z.string().optional(),
  gradient: z.tuple([z.string(), z.string()]).optional(),
  // title
  title: z.string().optional(),
  subtitle: z.string().optional(),
  // bullets — items MUST be provided for bullets scenes
  heading: z.string().optional(),
  items: z.array(z.string()).optional(),
  // quote
  text: z.string().optional(),
  author: z.string().optional(),
  // stat
  value: z.string().optional(),
  label: z.string().optional(),
  context: z.string().optional(),
  // outro
  cta: z.string().optional(),
  brand: z.string().optional(),
})

const AudioSegmentSchema = z.object({
  id: z.string(),
  type: z.enum(["narration", "sound_effect"]),
  r2Key: z.string(),
  publicUrl: z.string(),           // direct R2 public URL
  durationMs: z.number(),
  durationInFrames: z.number(),
  voiceId: z.string().optional(),
})

const SceneSchema = z.object({
  id: z.string(),
  type: z.enum(["intro", "title", "bullets", "quote", "stat", "outro"]),
  durationInFrames: z.number(),
  data: SceneDataSchema,
  audio: AudioSegmentSchema.optional(),   // populated by save_video_config auto-merge
})

export const VideoConfigSchema = z.object({
  id: z.string(),
  title: z.string(),
  aspectRatio: z.enum(["9:16", "16:9", "1:1", "4:5"]),
  fps: z.number().default(30),
  scenes: z.array(SceneSchema),
})

export type VideoConfig = z.infer<typeof VideoConfigSchema>
export type Scene = z.infer<typeof SceneSchema>
export type AudioSegment = z.infer<typeof AudioSegmentSchema>
```

Scene components (`IntroScene`, `TitleScene`, etc.) cast `scene.data` to their specific local interface using `as unknown as IntroData` etc. All Remotion scene components include null-safe access for optional fields (`data.items ?? []`, `config.fps ?? 30`).

---

## Chat UI

The chat panel is a **custom component** — no Vercel AI Elements. Lives at `src/components/studio/ChatPanel.tsx`.

### ChatPanel

```typescript
// Props received from StudioClient
interface ChatPanelProps {
  messages: UIMessage[]
  onSend: (text: string) => void
  isStreaming: boolean
  error?: Error
}

// Rendering message parts
message.parts.map((part) => {
  if (part.type === "text") return <TextBubble text={part.text} />
  if (part.type === "dynamic-tool") return <ToolCallBubble toolName={part.toolName} isDone={part.state === "output-available"} />
  if (part.type.startsWith("tool-")) return <ToolCallBubble toolName={part.type.slice(5)} isDone={part.state === "output-available"} />
})
```

### Tool call labels shown in chat

| Tool | Pending label | Done label |
|---|---|---|
| `research_topic` | Researching topic… | Research complete |
| `generate_video_script` | Writing video script… | Script ready |
| `generate_audio_segment` | Generating audio… | Audio created |
| `save_video_config` | Saving video… | Video saved |
| `patch_scene` | Updating scene… | Scene updated |
| `regenerate_audio_segment` | Regenerating audio… | Audio updated |

### StudioClient wiring

```typescript
// useChat with DefaultChatTransport (AI SDK v6)
const { messages, sendMessage, status, error } = useChat({
  messages: initialMessages,
  transport: new DefaultChatTransport({ api: "/api/chat", body: { projectId } }),
})

// Poll GET /api/projects/[id] after streaming ends to refresh VideoConfig
useEffect(() => {
  if (status === "streaming" || status === "submitted") { wasActiveRef.current = true; return }
  if (status === "ready" && wasActiveRef.current) {
    wasActiveRef.current = false
    setTimeout(() => fetch(`/api/projects/${id}`).then(...setConfig), 600)
  }
}, [status])
```

Scroll is implemented with a native `overflow-y-auto` div and `el.scrollTop = el.scrollHeight` — not shadcn `ScrollArea` (which breaks `scrollIntoView`).
