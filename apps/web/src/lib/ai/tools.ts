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

const DEFAULT_VOICE_ID = "21m00Tcm4TlvDq8ikWAM" // Rachel

function mp3DurationMs(buffer: Buffer): number {
  return Math.ceil((buffer.length / 16000) * 1000)
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

        return { content: content.slice(0, 8000), summary, keyFacts, sources }
      },
    }),

    generate_narration: tool({
      description: `Generate a narration audio clip using ElevenLabs TTS.
Call once per narration segment — typically one per scene or section.
Returns the audio URL and duration to use as constants in the Remotion component code.`,
      inputSchema: z.object({
        id: z.string().describe("Unique identifier for this audio clip, e.g. 'scene1', 'intro'"),
        text: z.string().max(500).describe("Text to be spoken aloud"),
        voiceId: z.string().optional().describe("ElevenLabs voice ID. Omit to use default (Rachel)."),
      }),
      execute: async ({ id, text, voiceId }) => {
        const voice = voiceId ?? DEFAULT_VOICE_ID
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

        return asset
      },
    }),

    generate_image: tool({
      description: `Generate an image using Vertex AI Imagen for use as a visual in the video.
Use when the video needs a custom background, illustration, or visual element that doesn't exist as stock.
Returns an image URL to use as a constant in the Remotion component code.
Only call if VERTEX AI image generation is configured (GOOGLE_VERTEX_PROJECT is set).`,
      inputSchema: z.object({
        id: z.string().describe("Unique identifier for this image, e.g. 'bg1', 'hero'"),
        prompt: z.string().describe("Detailed visual description of the image to generate"),
        aspectRatio: z.enum(["9:16", "16:9", "1:1", "3:4"]).default("9:16"),
      }),
      execute: async ({ id, prompt, aspectRatio }) => {
        const project = process.env.GOOGLE_VERTEX_PROJECT
        if (!project) {
          throw new Error("GOOGLE_VERTEX_PROJECT is required for image generation")
        }

        // Use the AI SDK's experimental_generateImage for Vertex AI Imagen
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
          providerOptions: {
            vertex: { sampleCount: 1 },
          },
        })

        // Upload to R2
        const key = `images/${projectId}/${id}-${createHash("md5").update(prompt).digest("hex").slice(0, 8)}.png`
        const buffer = Buffer.from(image.base64, "base64")
        const { publicUrl } = await uploadToR2(key, buffer, "image/png")

        const asset: ImageAsset = { id, url: publicUrl }
        imageAssets.push(asset)

        return asset
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

        return { code, durationInFrames, fps }
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

        return { videoConfigId: saved!.id, version: nextVersion, durationInFrames }
      },
    }),

  }
}
