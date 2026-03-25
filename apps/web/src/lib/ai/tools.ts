import { generateText, tool } from "ai"
import { ElevenLabsClient } from "elevenlabs"
import { getGenerationModel } from "@/lib/ai/model"
import FirecrawlApp from "@mendable/firecrawl-js"
import { createHash } from "crypto"
import { z } from "zod"
import { eq, desc } from "drizzle-orm"
import { db } from "@/db"
import { projects, videoConfigs, researchReports, audioFiles } from "@/db/schema"
import { uploadToR2, audioKey } from "@/lib/r2"
import type { VideoConfig, AudioAsset, ImageAsset } from "@repo/types"
import { REMOTION_SYSTEM_PROMPT, buildCodeGenerationPrompt } from "./remotion-prompt"

const firecrawl = new FirecrawlApp({ apiKey: process.env.FIRECRAWL_API_KEY! })
const elevenlabs = new ElevenLabsClient({ apiKey: process.env.ELEVENLABS_API_KEY! })

export const ELEVENLABS_VOICES = [
  { id: "21m00Tcm4TlvDq8ikWAM", name: "Rachel",   gender: "female", age: "young",        accent: "american",         description: "calm",         useCase: "narration" },
  { id: "pNInz6obpgDQGcFmaJgB", name: "Adam",     gender: "male",   age: "middle-aged",  accent: "american",         description: "deep",         useCase: "narration" },
  { id: "Xb7hH8MSUJpSbSDYk0k2", name: "Alice",    gender: "female", age: "middle-aged",  accent: "british",          description: "confident",    useCase: "news" },
  { id: "ErXwobaYiN019PkySvjV", name: "Antoni",   gender: "male",   age: "young",        accent: "american",         description: "well-rounded", useCase: "narration" },
  { id: "VR6AewLTigWG4xSOukaG", name: "Arnold",   gender: "male",   age: "middle-aged",  accent: "american",         description: "crisp",        useCase: "narration" },
  { id: "pqHfZKP75CvOlQylNhV4", name: "Bill",     gender: "male",   age: "middle-aged",  accent: "american",         description: "strong",       useCase: "documentary" },
  { id: "nPczCjzI2devNBz1zQrb", name: "Brian",    gender: "male",   age: "middle-aged",  accent: "american",         description: "deep",         useCase: "narration" },
  { id: "N2lVS1w4EtoT3dr4eOWO", name: "Callum",   gender: "male",   age: "middle-aged",  accent: "american",         description: "hoarse",       useCase: "video games" },
  { id: "IKne3meq5aSn9XLyUdCD", name: "Charlie",  gender: "male",   age: "middle-aged",  accent: "australian",       description: "casual",       useCase: "conversational" },
  { id: "XB0fDUnXU5powFXDhCwa", name: "Charlotte",gender: "female", age: "middle-aged",  accent: "english-swedish",  description: "seductive",    useCase: "video games" },
  { id: "iP95p4xoKVk53GoZ742B", name: "Chris",    gender: "male",   age: "middle-aged",  accent: "american",         description: "casual",       useCase: "conversational" },
  { id: "2EiwWnXFnvU5JabPnv8n", name: "Clyde",    gender: "male",   age: "middle-aged",  accent: "american",         description: "war veteran",  useCase: "video games" },
  { id: "onwK4e9ZLuTAKqWW03F9", name: "Daniel",   gender: "male",   age: "middle-aged",  accent: "british",          description: "deep",         useCase: "news presenter" },
  { id: "CYw3kZ02Hs0563khs1Fj", name: "Dave",     gender: "male",   age: "young",        accent: "british-essex",    description: "conversational",useCase: "video games" },
  { id: "AZnzlk1XvdvUeBnXmlld", name: "Domi",     gender: "female", age: "young",        accent: "american",         description: "strong",       useCase: "narration" },
  { id: "ThT5KcBeYPX3keUQqHPh", name: "Dorothy",  gender: "female", age: "young",        accent: "british",          description: "pleasant",     useCase: "children's stories" },
  { id: "29vD33N1CtxCmqQRPOHJ", name: "Drew",     gender: "male",   age: "middle-aged",  accent: "american",         description: "well-rounded", useCase: "news" },
  { id: "LcfcDJNUP1GQjkzn1xUU", name: "Emily",    gender: "female", age: "young",        accent: "american",         description: "calm",         useCase: "meditation" },
  { id: "g5CIjZEefAph4nQFvHAz", name: "Ethan",    gender: "male",   age: "young",        accent: "american",         description: "soft",         useCase: "ASMR" },
  { id: "D38z5RcWu1voky8WS1ja", name: "Fin",      gender: "male",   age: "old",          accent: "irish",            description: "sailor",       useCase: "video games" },
  { id: "jsCqWAovK2LkecY7zXl4", name: "Freya",    gender: "female", age: "young",        accent: "american",         description: "expressive",   useCase: "narration" },
  { id: "JBFqnCBsd6RMkjVDRZzb", name: "George",   gender: "male",   age: "middle-aged",  accent: "british",          description: "raspy",        useCase: "narration" },
  { id: "jBpfuIE2acCO8z3wKNLl", name: "Gigi",     gender: "female", age: "young",        accent: "american",         description: "childlike",    useCase: "animation" },
  { id: "zcAOhNBS3c14rBihAFp1", name: "Giovanni", gender: "male",   age: "young",        accent: "english-italian",  description: "foreigner",    useCase: "audiobook" },
  { id: "z9fAnlkpzviPz146aGWa", name: "Glinda",   gender: "female", age: "middle-aged",  accent: "american",         description: "witch",        useCase: "video games" },
  { id: "oWAxZDx7w5VEj9dCyTzz", name: "Grace",    gender: "female", age: "young",        accent: "american-southern", description: "warm",        useCase: "audiobook" },
  { id: "SOYHLrjzK2X1ezoPC6cr", name: "Harry",    gender: "male",   age: "young",        accent: "american",         description: "anxious",      useCase: "video games" },
  { id: "ZQe5CZNOzWyzPSCn5a3c", name: "James",    gender: "male",   age: "old",          accent: "australian",       description: "calm",         useCase: "news" },
  { id: "bVMeCyTHy58xNoL34h3p", name: "Jeremy",   gender: "male",   age: "young",        accent: "american-irish",   description: "excited",      useCase: "narration" },
  { id: "t0jbNlBVZ17f02VDIeMI", name: "Jessie",   gender: "male",   age: "old",          accent: "american",         description: "raspy",        useCase: "video games" },
  { id: "Zlb1dXrM653N07WRdFW3", name: "Joseph",   gender: "male",   age: "middle-aged",  accent: "british",          description: "authoritative",useCase: "news" },
  { id: "TxGEqnHWrfWFTfGW9XjX", name: "Josh",     gender: "male",   age: "young",        accent: "american",         description: "deep",         useCase: "narration" },
  { id: "TX3LPaxmHKxFdv7VOQHJ", name: "Liam",     gender: "male",   age: "young",        accent: "american",         description: "clear",        useCase: "narration" },
  { id: "pFZP5JQG7iQjIQuC4Bku", name: "Lily",     gender: "female", age: "middle-aged",  accent: "british",          description: "raspy",        useCase: "narration" },
  { id: "XrExE9yKIg1WjnnlVkGX", name: "Matilda",  gender: "female", age: "young",        accent: "american",         description: "warm",         useCase: "audiobook" },
  { id: "flq6f7yk4E4fJM5XTYuZ", name: "Michael",  gender: "male",   age: "old",          accent: "american",         description: "authoritative",useCase: "audiobook" },
  { id: "zrHiDhphv9ZnVXBqCLjz", name: "Mimi",     gender: "female", age: "young",        accent: "english-swedish",  description: "childish",     useCase: "animation" },
  { id: "piTKgcLEGmPE4e6mEKli", name: "Nicole",   gender: "female", age: "young",        accent: "american",         description: "whisper",      useCase: "audiobook" },
  { id: "ODq5zmih8GrVes37Dizd", name: "Patrick",  gender: "male",   age: "middle-aged",  accent: "american",         description: "shouty",       useCase: "video games" },
  { id: "5Q0t7uMcjvnagumLfvZi", name: "Paul",     gender: "male",   age: "middle-aged",  accent: "american",         description: "ground reporter",useCase: "news" },
  { id: "yoZ06aMxZJJ28mfd3POQ", name: "Sam",      gender: "male",   age: "young",        accent: "american",         description: "raspy",        useCase: "narration" },
  { id: "EXAVITQu4vr4xnSDxMaL", name: "Sarah",    gender: "female", age: "young",        accent: "american",         description: "soft",         useCase: "news" },
  { id: "pMsXgVXv3BLzUgSXRplE", name: "Serena",   gender: "female", age: "middle-aged",  accent: "american",         description: "pleasant",     useCase: "interactive" },
  { id: "GBv7mTt0atIp3Br8iCZE", name: "Thomas",   gender: "male",   age: "young",        accent: "american",         description: "calm",         useCase: "meditation" },
] as const

const DEFAULT_VOICE_ID = "21m00Tcm4TlvDq8ikWAM" // Rachel – calm, young American female, narration

function mp3DurationMs(buffer: Buffer): number {
  return Math.ceil((buffer.length / 16000) * 1000)
}

function toolLog(provider: string, msg: string, data?: Record<string, unknown>) {
  const ts = new Date().toISOString()
  const extra = data ? ` ${JSON.stringify(data)}` : ""
  console.log(`[tool:${provider}] ${ts} ${msg}${extra}`)
}
function toolError(provider: string, msg: string, err: unknown) {
  const detail = err instanceof Error ? err.message : String(err)
  console.error(`[tool:${provider}] ERROR ${new Date().toISOString()} ${msg} — ${detail}`)
}

// --------------- tools ---------------

export function makeTools(projectId: string) {
  // Accumulate assets across tool calls so generate_video_code can reference them all
  const audioAssets: AudioAsset[] = []
  const imageAssets: ImageAsset[] = []

  return {

    research_topic: tool({
      description: `Research a topic or URL using Firecrawl to gather content for the video.
Returns a research summary to inform the video script and visuals.
Call this FIRST for new videos, or skip if the user provides enough context.`,
      inputSchema: z.object({
        input: z.string().describe("A URL (https://...) or a topic / keyword string"),
        depth: z.enum(["quick", "deep"]).default("quick"),
      }),
      execute: async ({ input, depth }) => {
        const isUrl = input.startsWith("http")
        const limit = depth === "deep" ? 5 : 3
        toolLog("firecrawl", `starting research`, { projectId, input: input.slice(0, 80), isUrl, depth })

        try {
          let content = ""
          const sources: { url: string; title: string }[] = []

          if (isUrl) {
            const scraped = await firecrawl.scrape(input, { formats: ["markdown"] })
            content = scraped.markdown ?? ""
            sources.push({ url: input, title: scraped.metadata?.title ?? input })
          } else {
            const results = await firecrawl.search(input, {
              limit,
              scrapeOptions: { formats: ["markdown"] },
            })
            const webResults =
              (results as { data?: { web?: unknown[] } }).data?.web ??
              (Array.isArray((results as { data?: unknown }).data)
                ? (results as { data: unknown[] }).data
                : [])
            for (const r of webResults as { url?: string; title?: string; markdown?: string }[]) {
              if (r.markdown) content += `\n\n## ${r.title ?? r.url}\n${r.markdown}`
              if (r.url) sources.push({ url: r.url, title: r.title ?? r.url })
            }
          }

          const summary = content.slice(0, 1000)
          const keyFacts = content
            .split("\n")
            .filter((l) => l.startsWith("- ") || l.startsWith("* "))
            .slice(0, 12)
            .map((l) => l.replace(/^[-*]\s+/, ""))

          await db.insert(researchReports).values({
            projectId,
            topic: isUrl ? undefined : input,
            sourceUrl: isUrl ? input : undefined,
            content,
            summary,
            keyFacts,
            sources,
          })

          toolLog("firecrawl", `research done`, { projectId, sources: sources.length, contentLen: content.length })
          return { content: content.slice(0, 8000), summary, keyFacts, sources }
        } catch (err) {
          toolError("firecrawl", `research failed for "${input.slice(0, 80)}"`, err)
          throw err
        }
      },
    }),

    generate_narration: tool({
      description: `Generate a narration audio clip using ElevenLabs TTS.
Call once per narration segment — typically one per scene or section.
Returns the audio URL and duration to use as constants in the Remotion component code.

Pick the voice that best fits the video's tone, audience, and content. Available voices:
- Rachel (21m00Tcm4TlvDq8ikWAM) — female, young, American, calm → general narration
- Adam (pNInz6obpgDQGcFmaJgB) — male, middle-aged, American, deep → general narration
- Alice (Xb7hH8MSUJpSbSDYk0k2) — female, middle-aged, British, confident → news
- Antoni (ErXwobaYiN019PkySvjV) — male, young, American, well-rounded → narration
- Arnold (VR6AewLTigWG4xSOukaG) — male, middle-aged, American, crisp → narration
- Bill (pqHfZKP75CvOlQylNhV4) — male, middle-aged, American, strong → documentary
- Brian (nPczCjzI2devNBz1zQrb) — male, middle-aged, American, deep → narration
- Callum (N2lVS1w4EtoT3dr4eOWO) — male, middle-aged, American, hoarse → video games
- Charlie (IKne3meq5aSn9XLyUdCD) — male, middle-aged, Australian, casual → conversational
- Charlotte (XB0fDUnXU5powFXDhCwa) — female, middle-aged, English-Swedish, seductive → video games
- Chris (iP95p4xoKVk53GoZ742B) — male, middle-aged, American, casual → conversational
- Clyde (2EiwWnXFnvU5JabPnv8n) — male, middle-aged, American, war veteran → video games
- Daniel (onwK4e9ZLuTAKqWW03F9) — male, middle-aged, British, deep → news presenter
- Dave (CYw3kZ02Hs0563khs1Fj) — male, young, British-Essex, conversational → video games
- Domi (AZnzlk1XvdvUeBnXmlld) — female, young, American, strong → narration
- Dorothy (ThT5KcBeYPX3keUQqHPh) — female, young, British, pleasant → children's stories
- Drew (29vD33N1CtxCmqQRPOHJ) — male, middle-aged, American, well-rounded → news
- Emily (LcfcDJNUP1GQjkzn1xUU) — female, young, American, calm → meditation
- Ethan (g5CIjZEefAph4nQFvHAz) — male, young, American, soft → ASMR
- Fin (D38z5RcWu1voky8WS1ja) — male, old, Irish, sailor → video games
- Freya (jsCqWAovK2LkecY7zXl4) — female, young, American, expressive → narration
- George (JBFqnCBsd6RMkjVDRZzb) — male, middle-aged, British, raspy → narration
- Gigi (jBpfuIE2acCO8z3wKNLl) — female, young, American, childlike → animation
- Giovanni (zcAOhNBS3c14rBihAFp1) — male, young, English-Italian, foreigner → audiobook
- Glinda (z9fAnlkpzviPz146aGWa) — female, middle-aged, American, witch → video games
- Grace (oWAxZDx7w5VEj9dCyTzz) — female, young, American-Southern, warm → audiobook
- Harry (SOYHLrjzK2X1ezoPC6cr) — male, young, American, anxious → video games
- James (ZQe5CZNOzWyzPSCn5a3c) — male, old, Australian, calm → news
- Jeremy (bVMeCyTHy58xNoL34h3p) — male, young, American-Irish, excited → narration
- Jessie (t0jbNlBVZ17f02VDIeMI) — male, old, American, raspy → video games
- Joseph (Zlb1dXrM653N07WRdFW3) — male, middle-aged, British, authoritative → news
- Josh (TxGEqnHWrfWFTfGW9XjX) — male, young, American, deep → narration
- Liam (TX3LPaxmHKxFdv7VOQHJ) — male, young, American, clear → narration
- Lily (pFZP5JQG7iQjIQuC4Bku) — female, middle-aged, British, raspy → narration
- Matilda (XrExE9yKIg1WjnnlVkGX) — female, young, American, warm → audiobook
- Michael (flq6f7yk4E4fJM5XTYuZ) — male, old, American, authoritative → audiobook
- Mimi (zrHiDhphv9ZnVXBqCLjz) — female, young, English-Swedish, childish → animation
- Nicole (piTKgcLEGmPE4e6mEKli) — female, young, American, whisper → audiobook
- Patrick (ODq5zmih8GrVes37Dizd) — male, middle-aged, American, shouty → video games
- Paul (5Q0t7uMcjvnagumLfvZi) — male, middle-aged, American, ground reporter → news
- Sam (yoZ06aMxZJJ28mfd3POQ) — male, young, American, raspy → narration
- Sarah (EXAVITQu4vr4xnSDxMaL) — female, young, American, soft → news
- Serena (pMsXgVXv3BLzUgSXRplE) — female, middle-aged, American, pleasant → interactive
- Thomas (GBv7mTt0atIp3Br8iCZE) — male, young, American, calm → meditation`,
      inputSchema: z.object({
        id: z.string().describe("Unique identifier for this audio clip, e.g. 'scene1', 'intro'"),
        text: z.string().max(500).describe("Text to be spoken aloud"),
        voiceId: z.string().optional().describe("ElevenLabs voice ID chosen from the available voices list. Omit to use default (Rachel — 21m00Tcm4TlvDq8ikWAM)."),
      }),
      execute: async ({ id, text, voiceId }) => {
        const voice = voiceId ?? DEFAULT_VOICE_ID
        toolLog("elevenlabs", `generating narration`, { projectId, id, voiceId: voice, textLen: text.length })

        try {
          const textHash = createHash("md5").update(text).digest("hex").slice(0, 8)
          const key = audioKey(projectId, id, "narration", textHash)

          const audioStream = await elevenlabs.textToSpeech.convert(voice, {
            text,
            model_id: "eleven_multilingual_v2",
            output_format: "mp3_44100_128",
          })

          const chunks: Buffer[] = []
          for await (const chunk of audioStream) {
            chunks.push(Buffer.from(chunk))
          }
          const buffer = Buffer.concat(chunks)

          toolLog("elevenlabs", `TTS done, uploading to R2`, { projectId, id, bufferBytes: buffer.length })

          const { publicUrl } = await uploadToR2(key, buffer, "audio/mpeg")
          const durationMs = mp3DurationMs(buffer)
          const durationInFrames = Math.ceil((durationMs / 1000) * 30)

          await db.insert(audioFiles).values({
            projectId,
            sceneId: id,
            type: "narration",
            r2Key: key,
            publicUrl,
            durationMs,
            durationInFrames,
            voiceId: voice,
            textHash,
          })

          const asset: AudioAsset = { id, url: publicUrl, durationMs, durationInFrames, text }
          audioAssets.push(asset)

          toolLog("elevenlabs", `narration ready`, { projectId, id, durationMs, publicUrl })
          return asset
        } catch (err) {
          toolError("elevenlabs", `narration failed for id="${id}"`, err)
          throw err
        }
      },
    }),

    generate_image: tool({
      description: `Generate an image using Vertex AI Imagen for use as a visual in the video.
Use sparingly — only when a real photo-style image genuinely improves the video over pure animation.
Good use cases: a product screenshot concept, a real-world scene, a clean flat illustration.
BAD use cases: abstract AI art, glowing orbs, cosmic backgrounds, generic "futuristic" visuals — these make the video look AI-generated.

When writing the prompt:
- Be highly specific and photorealistic: "a clean flat-lay of a MacBook on a white desk, soft natural window light, top-down angle, editorial photography style"
- Reference real-world aesthetics: "Bloomberg terminal screenshot aesthetic", "Apple product page style", "Stripe dashboard interface mockup"
- Avoid: "futuristic", "glowing", "neon", "ethereal", "cosmic", "magical", "abstract"
- Add negative guidance in the prompt: "no glowing effects, no neon colors, no abstract shapes, no AI art style"

Returns an image URL to use as a constant in the Remotion component code.
Only call if GOOGLE_VERTEX_PROJECT is configured.`,
      inputSchema: z.object({
        id: z.string().describe("Unique identifier for this image, e.g. 'bg1', 'hero'"),
        prompt: z.string().describe("Highly specific, realistic visual description. Describe lighting, angle, style, and add 'no glowing effects, no neon, no abstract AI art' to the prompt."),
        aspectRatio: z.enum(["9:16", "16:9", "1:1", "3:4"]).default("9:16"),
      }),
      execute: async ({ id, prompt, aspectRatio }) => {
        const project = process.env.GOOGLE_VERTEX_PROJECT
        if (!project) {
          toolError("vertex-imagen", "GOOGLE_VERTEX_PROJECT env var missing", "")
          throw new Error("GOOGLE_VERTEX_PROJECT is required for image generation")
        }

        toolLog("vertex-imagen", `generating image`, { projectId, id, aspectRatio, promptLen: prompt.length })

        try {
          const { experimental_generateImage: generateImage } = await import("ai")
          const { createVertex } = await import("@ai-sdk/google-vertex")

          const vertex = createVertex({
            project,
            location: process.env.GOOGLE_VERTEX_LOCATION ?? "us-central1",
          })

          const { image } = await generateImage({
            model: vertex.image("imagen-3.0-generate-001"),
            prompt,
            aspectRatio,
            providerOptions: { vertex: { sampleCount: 1 } },
          })

          toolLog("vertex-imagen", `image generated, uploading to R2`, { projectId, id })

          const key = `images/${projectId}/${id}-${createHash("md5").update(prompt).digest("hex").slice(0, 8)}.png`
          const buffer = Buffer.from(image.base64, "base64")
          const { publicUrl } = await uploadToR2(key, buffer, "image/png")

          const asset: ImageAsset = { id, url: publicUrl }
          imageAssets.push(asset)

          toolLog("vertex-imagen", `image ready`, { projectId, id, publicUrl })
          return asset
        } catch (err) {
          toolError("vertex-imagen", `image generation failed for id="${id}"`, err)
          throw err
        }
      },
    }),

    generate_video_code: tool({
      description: `Generate the complete Remotion video component code using all collected assets.
This writes a full React/Remotion TSX component from scratch — no templates, full creative freedom.
Call this AFTER all generate_narration and generate_image calls are done.
The AI will write animations, layouts, text, scenes, and audio sync from scratch.`,
      inputSchema: z.object({
        topic: z.string().describe("The video topic or title"),
        researchSummary: z.string().describe("Key facts and context from research to inform the video content"),
        aspectRatio: z.enum(["9:16", "16:9", "1:1", "4:5"]).default("9:16"),
        style: z.string().optional().describe("Visual style hints, e.g. 'dark cinematic', 'colorful playful', 'minimal tech'"),
      }),
      execute: async ({ topic, researchSummary, aspectRatio, style }) => {
        const fps = 30
        const totalDurationMs = audioAssets.reduce((sum, a) => sum + a.durationMs, 0) || 10000
        // Add 1.5s buffer at end + 0.5s intro
        const totalWithBuffer = totalDurationMs + 2000
        const durationInFrames = Math.round((totalWithBuffer * fps) / 1000)

        toolLog("gemini", `generating Remotion code`, {
          projectId, topic: topic.slice(0, 60), aspectRatio, durationInFrames,
          audioAssets: audioAssets.length, imageAssets: imageAssets.length,
        })

        try {
          const prompt = buildCodeGenerationPrompt({
            topic,
            researchSummary: researchSummary + (style ? `\n\nVisual style: ${style}` : ""),
            aspectRatio,
            durationInFrames,
            fps,
            audioAssets,
            imageAssets,
          })

          const { text: rawCode } = await generateText({
            model: getGenerationModel(),
            system: REMOTION_SYSTEM_PROMPT,
            prompt,
            temperature: 0.7,
          })

          // Strip markdown fences if the model wraps in ```tsx ... ```
          const code = rawCode
            .replace(/^```(?:tsx?|jsx?|javascript|typescript)?\s*\n/m, "")
            .replace(/\n```\s*$/m, "")
            .trim()

          toolLog("gemini", `code generation done`, { projectId, codeLen: code.length, durationInFrames })
          return { code, durationInFrames, fps }
        } catch (err) {
          toolError("gemini", `code generation failed for topic="${topic.slice(0, 60)}"`, err)
          throw err
        }
      },
    }),

    save_video_code: tool({
      description: `Save the generated Remotion component code to the database.
Call this as the FINAL step, passing the code and duration from generate_video_code.
Updates project status to 'ready' so the Remotion Player can display the video.`,
      inputSchema: z.object({
        title: z.string().describe("Video title"),
        code: z.string().describe("The complete Remotion component code from generate_video_code"),
        durationInFrames: z.number().describe("Total duration in frames from generate_video_code"),
        fps: z.number().default(30),
        aspectRatio: z.enum(["9:16", "16:9", "1:1", "4:5"]).default("9:16"),
      }),
      execute: async ({ title, code, durationInFrames, fps, aspectRatio }) => {
        toolLog("db", `saving video config`, { projectId, title, durationInFrames, codeLen: code.length })

        try {
          const config: VideoConfig = {
            id: projectId,
            title,
            aspectRatio,
            fps,
            durationInFrames,
            code,
          }

          const [latest] = await db
            .select({ version: videoConfigs.version })
            .from(videoConfigs)
            .where(eq(videoConfigs.projectId, projectId))
            .orderBy(desc(videoConfigs.version))
            .limit(1)

          const nextVersion = (latest?.version ?? 0) + 1

          const [saved] = await db
            .insert(videoConfigs)
            .values({ projectId, config, version: nextVersion })
            .returning()

          await db
            .update(projects)
            .set({ status: "ready", updatedAt: new Date() })
            .where(eq(projects.id, projectId))

          toolLog("db", `video config saved`, { projectId, videoConfigId: saved!.id, version: nextVersion })
          return { videoConfigId: saved!.id, version: nextVersion, durationInFrames }
        } catch (err) {
          toolError("db", `failed to save video config for project="${projectId}"`, err)
          throw err
        }
      },
    }),

  }
}
