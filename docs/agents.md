# AI Agents & Tools

## Overview

There is a single `streamText` call per chat request using Gemini as the model. The LLM autonomously decides which tools to invoke based on the message content and conversation history. There is no explicit agent graph — the conversation history acts as memory, and tool descriptions enforce the routing logic.

The pipeline for a new video generation:

```
research_topic → generate_narration (×N) → generate_image (optional, ×M) → generate_video_code → save_video_code
```

---

## Models

All models are Google Vertex AI (Gemini). Provider and model names are configurable via environment variables.

| Use case | Model | Env var |
|---|---|---|
| Code generation, complex reasoning | `gemini-3.1-pro-preview-05-06` | `AI_GENERATION_MODEL` |
| Lightweight edits | `gemini-3.1-flash-lite-preview-05-06` | `AI_EDIT_MODEL` |

Model helpers live in `src/lib/ai/model.ts` and export `getGenerationModel()` and `getEditModel()`.

**Google Vertex AI credentials** — choose one:
- **Local dev**: set `GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json`
- **Deployment**: set `GOOGLE_CLIENT_EMAIL` + `GOOGLE_PRIVATE_KEY` extracted from the service account JSON

---

## Tool Invocation Flow

### New video (first message)

```
User: "Make a TikTok about how Stripe processes payments"

Gemini calls:
  1. research_topic({ input: "how Stripe processes payments" })
     └─ Firecrawl search + scrape → returns research summary

  2. generate_narration({ text: "Hook: Did you know Stripe processes...", segmentId: "seg-1" })
  3. generate_narration({ text: "Stripe's payment flow starts with...", segmentId: "seg-2" })
  4. generate_narration({ text: "The secret is their unified API...", segmentId: "seg-3" })
     └─ ElevenLabs TTS → uploads to R2 → stores AudioAsset in closure

  5. generate_image({ prompt: "futuristic payment network visualization" })  ← optional
     └─ Vertex AI Imagen 3 → uploads to R2 → stores ImageAsset in closure

  6. generate_video_code({ topic, researchSummary, aspectRatio })
     └─ Collects all AudioAssets + ImageAssets from closure
     └─ Builds prompt with asset URLs + durations
     └─ Gemini 3.1 Pro generates complete Remotion TSX component
     └─ Returns { code, durationInFrames, fps, title }

  7. save_video_code({ code, durationInFrames, fps, title, aspectRatio })
     └─ Inserts VideoConfig into video_configs table
     └─ Updates projects.status = "ready"

Gemini: "Your video about Stripe's payment APIs is ready!"
```

### Follow-up edit (regenerate video)

```
User: "Make it more energetic and add a punchy hook at the start"

Gemini calls:
  1. generate_narration({ text: "New hook text...", segmentId: "seg-0" })
     └─ Replaces or adds audio for the hook

  2. generate_video_code({ topic, researchSummary, aspectRatio })
     └─ Regenerates the full component with the new audio + updated style

  3. save_video_code({ code, durationInFrames, fps, title, aspectRatio })
     └─ Saves as a new version

Gemini: "Rewrote the video with a stronger opening hook!"
```

---

## Tool Definitions

All tools are created by `makeTools(projectId, projectAspectRatio)` in `src/lib/ai/tools.ts`. The `projectId` and `aspectRatio` are captured via closure. `audioAssets` and `imageAssets` arrays are also closure variables that accumulate across tool calls within a single `streamText` invocation.

---

### `research_topic`

Researches a topic or URL using Firecrawl. Result is saved to `research_reports` table and returned to the LLM for use in the next steps.

```typescript
research_topic: tool({
  inputSchema: z.object({
    input: z.string().describe("A URL (https://...) or a topic/keyword string"),
  }),
  execute: async ({ input }) => {
    const isUrl = input.startsWith("http")
    if (isUrl) {
      // firecrawl.scrape(input, { formats: ["markdown"] })
    } else {
      // firecrawl.search(input, { limit: 5, scrapeOptions: { formats: ["markdown"] } })
    }
    await db.insert(researchReports).values({ projectId, content, summary, sources })
    return { content, summary, sources }
  },
})
```

---

### `generate_narration`

Generates a single TTS audio segment via ElevenLabs. Uploads the mp3 to R2 and stores the `AudioAsset` in the closure for `generate_video_code` to consume.

```typescript
generate_narration: tool({
  inputSchema: z.object({
    text: z.string().describe("The narration text to speak"),
    segmentId: z.string().describe("Unique ID for this segment e.g. 'seg-1'"),
    voiceId: z.string().optional(),
  }),
  execute: async ({ text, segmentId, voiceId }) => {
    const audioStream = await elevenlabs.textToSpeech.convert(voice, {
      text,
      model_id: "eleven_multilingual_v2",
      output_format: "mp3_44100_128",
    })
    const buffer = await streamToBuffer(audioStream)
    const durationMs = await mp3DurationMs(buffer)
    const publicUrl = await uploadToR2(`audio/${projectId}/${segmentId}.mp3`, buffer)
    await db.insert(audioFiles).values({ projectId, sceneId: segmentId, publicUrl, durationMs, ... })

    const asset: AudioAsset = { id: segmentId, url: publicUrl, durationMs, durationInFrames, text }
    audioAssets.push(asset)  // stored in closure for generate_video_code
    return asset
  },
})
```

---

### `generate_image`

Optional tool — the AI decides whether to call it based on the topic. Generates an image using Vertex AI Imagen 3, uploads to R2, and stores the `ImageAsset` in the closure.

```typescript
generate_image: tool({
  inputSchema: z.object({
    prompt: z.string().describe("Detailed description of the image to generate"),
    imageId: z.string().describe("Unique ID e.g. 'img-1'"),
  }),
  execute: async ({ prompt, imageId }) => {
    const { image } = await experimental_generateImage({
      model: vertex.image("imagen-3.0-generate-001"),
      prompt,
      aspectRatio: toImagenAspectRatio(projectAspectRatio),
    })
    const publicUrl = await uploadToR2(`images/${projectId}/${imageId}.png`, image.uint8Array)

    const asset: ImageAsset = { id: imageId, url: publicUrl }
    imageAssets.push(asset)  // stored in closure for generate_video_code
    return asset
  },
})
```

---

### `generate_video_code`

The core tool. Collects all accumulated `audioAssets` and `imageAssets`, calculates total duration, builds a detailed prompt via `buildCodeGenerationPrompt` (from `remotion-prompt.ts`), and uses Gemini 3.1 Pro to generate the complete Remotion TSX component as a string.

```typescript
generate_video_code: tool({
  inputSchema: z.object({
    topic: z.string(),
    researchSummary: z.string(),
  }),
  execute: async ({ topic, researchSummary }) => {
    const totalDurationInFrames = audioAssets.reduce((sum, a) => sum + a.durationInFrames, 0)
    const prompt = buildCodeGenerationPrompt({
      topic, researchSummary,
      aspectRatio: projectAspectRatio,
      durationInFrames: totalDurationInFrames,
      fps: 30,
      audioAssets,   // all AudioAssets accumulated so far
      imageAssets,   // all ImageAssets accumulated so far (may be empty)
    })
    const { text: code } = await generateText({
      model: getGenerationModel(),
      system: REMOTION_SYSTEM_PROMPT,
      prompt,
    })
    return { code, durationInFrames: totalDurationInFrames, fps: 30, title: topic }
  },
})
```

---

### `save_video_code`

Final step. Takes the generated code and metadata, creates the `VideoConfig`, persists it to the database, and marks the project as ready.

```typescript
save_video_code: tool({
  inputSchema: z.object({
    code: z.string(),
    durationInFrames: z.number(),
    fps: z.number(),
    title: z.string(),
    aspectRatio: z.enum(["9:16", "16:9", "1:1", "4:5"]),
  }),
  execute: async ({ code, durationInFrames, fps, title, aspectRatio }) => {
    const config: VideoConfig = {
      id: nanoid(),
      title,
      aspectRatio,
      fps,
      durationInFrames,
      code,
    }
    await db.insert(videoConfigs).values({ projectId, config, version: nextVersion })
    await db.update(projects).set({ status: "ready" }).where(eq(projects.id, projectId))
    return { success: true, config }
  },
})
```

---

## Remotion Code Generation Prompt

The code generation prompt lives in `src/lib/ai/remotion-prompt.ts` and has two parts:

### `REMOTION_SYSTEM_PROMPT`

System-level instructions that define the AI's role and hard rules for every generated component:
- Output only code — no markdown, no explanations
- Response must start with `export const VideoContent = () => {`
- All constants go inside the component body in `UPPER_SNAKE_CASE`
- Use only inline styles — no CSS classes
- Documents all available globals (no import statements in generated code)
- Mandatory preloading pattern: `preloadAudio()` and `preloadImage()` in `useEffect` at component mount
- `pauseWhenBuffering` on every `<Audio>` — prevents muted audio at scene start
- `premountFor={90}` only on `<Img>` Sequences — pre-downloads images before they appear
- Visual style guidance: dark backgrounds, bold typography, spring animations, gradient usage
- Full example of a 2-scene tech video showing correct timing, audio, and animation patterns

### `buildCodeGenerationPrompt(params)`

Constructs the per-request user prompt with:
- Topic and platform hint (TikTok vs YouTube based on aspect ratio)
- Canvas dimensions
- Total duration in frames
- Research summary (capped at 4000 chars)
- Audio asset block: each URL, text snippet, and duration in ms as constants
- Image asset block: each URL as a constant (if images were generated)
- Final instruction to use all audio assets, add `premountFor` to image Sequences, call `preloadAudio`/`preloadImage`

---

## System Prompt

Built dynamically per request in `src/lib/ai/system-prompt.ts`. Provides:
1. Ordered pipeline instructions (research → narration → image → code → save)
2. Segment count rules (2–5 narration segments, total ≤ 60 s)
3. Aspect ratio default (`9:16` unless user specifies)
4. Current project context (if a video already exists, can regenerate from scratch)

---

## Chat UI

The chat panel lives at `src/components/studio/ChatPanel.tsx`. It uses `useChat` from `@ai-sdk/react` via `StudioClient`, renders `message.parts`, and shows tool call states with human-readable labels.

### Tool call labels

| Tool | Pending label | Done label |
|---|---|---|
| `research_topic` | Researching topic… | Research complete |
| `generate_narration` | Generating narration… | Narration ready |
| `generate_image` | Generating image… | Image ready |
| `generate_video_code` | Writing video code… | Code generated |
| `save_video_code` | Saving video… | Video saved |

### StudioClient wiring

```typescript
const { messages, sendMessage, status, error } = useChat({
  messages: initialMessages,
  transport: new DefaultChatTransport({ api: "/api/chat", body: { projectId } }),
})

// Poll GET /api/projects/[id] after streaming ends to refresh VideoConfig
useEffect(() => {
  if (status === "streaming" || status === "submitted") { wasActiveRef.current = true; return }
  if (status === "ready" && wasActiveRef.current) {
    wasActiveRef.current = false
    setTimeout(() => fetch(`/api/projects/${id}`).then(...).then(setConfig), 600)
  }
}, [status])
```

Tool call states are preserved on refresh: `onFinish` in `/api/chat` converts `type: "tool-call"` parts to `type: "dynamic-tool"` with `state: "output-available"` before saving to `chat_messages`.
