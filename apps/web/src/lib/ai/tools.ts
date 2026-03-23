import { generateObject, tool } from "ai"
import { ElevenLabsClient } from "elevenlabs"
import { getGenerationModel } from "@/lib/ai/model"
import FirecrawlApp from "@mendable/firecrawl-js"
import { createHash } from "crypto"
import { z } from "zod"
import { eq, desc } from "drizzle-orm"
import { db } from "@/db"
import { projects, videoConfigs, researchReports, audioFiles } from "@/db/schema"
import { uploadToR2, audioKey } from "@/lib/r2"
import { VideoScriptSchema } from "@repo/types"
import type { VideoConfig, Scene, AudioSegment } from "@repo/types"

const firecrawl = new FirecrawlApp({ apiKey: process.env.FIRECRAWL_API_KEY! })
const elevenlabs = new ElevenLabsClient({ apiKey: process.env.ELEVENLABS_API_KEY! })

const DEFAULT_VOICE_ID = "21m00Tcm4TlvDq8ikWAM" // Rachel

// --------------- helpers ---------------

async function streamToBuffer(stream: AsyncIterable<Uint8Array>): Promise<Buffer> {
  const chunks: Buffer[] = []
  for await (const chunk of stream) {
    chunks.push(Buffer.from(chunk))
  }
  return Buffer.concat(chunks)
}

function mp3DurationMs(buffer: Buffer): number {
  // 128 kbps MP3: 16 000 bytes/sec
  return Math.ceil((buffer.length / 16000) * 1000)
}

function buildScriptPrompt(
  researchContent: string,
  topic: string,
  aspectRatio: string
): string {
  const platformHint =
    aspectRatio === "9:16"
      ? "TikTok / Instagram Reels (vertical, punchy, fast-paced)"
      : aspectRatio === "16:9"
        ? "YouTube / LinkedIn (landscape, informational)"
        : "Square / Instagram feed"

  return `You are a professional video scriptwriter. Create a compelling short-form video script.

Topic: ${topic}
Platform: ${platformHint}

Research content:
${researchContent.slice(0, 8000)}

Instructions:
- Choose 5-8 scenes that tell a clear story arc
- Use "intro" to hook, "title"/"bullets"/"stat"/"quote" for content, "outro" to close
- Keep narrationText concise (1-3 sentences per scene — it will be read aloud)
- durationInFrames should reflect narration length (90-150 for narrated scenes, 60-75 for silent)
- For "outro" scene set brand to "opencut"
- Use engaging, direct language appropriate for the platform`
}

// --------------- tools ---------------

export function makeTools(projectId: string) {
  return {

    research_topic: tool({
      description: `Research a topic or URL to gather content for a video.
Call this ONLY for new projects or when the user asks to research something new.
Do NOT call this when editing an existing video.
Returns a research report with key facts and sources.`,
      inputSchema: z.object({
        input: z.string().describe("A URL (https://...) or a topic / keyword string"),
        depth: z
          .enum(["quick", "deep"])
          .default("quick")
          .describe("quick: search + top 3 results. deep: top 5 results"),
      }),
      execute: async ({ input, depth }) => {
        const isUrl = input.startsWith("http")
        const limit = depth === "deep" ? 5 : 3
        let content = ""
        const sources: { url: string; title: string }[] = []

        if (isUrl) {
          const scraped = await firecrawl.scrape(input, {
            formats: ["markdown"],
          })
          content = scraped.markdown ?? ""
          sources.push({ url: input, title: scraped.metadata?.title ?? input })
        } else {
          const results = await firecrawl.search(input, {
            limit,
            scrapeOptions: { formats: ["markdown"] },
          })
          const webResults = (results as { data?: { web?: unknown[] } }).data?.web ??
            (Array.isArray((results as { data?: unknown }).data) ? (results as { data: unknown[] }).data : [])
          for (const r of webResults as { url?: string; title?: string; markdown?: string }[]) {
            if (r.markdown) content += `\n\n## ${r.title ?? r.url}\n${r.markdown}`
            if (r.url) sources.push({ url: r.url, title: r.title ?? r.url })
          }
        }

        const summary = content.slice(0, 500)
        const keyFacts = content
          .split("\n")
          .filter((l) => l.startsWith("- ") || l.startsWith("* "))
          .slice(0, 10)
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

        return { content, summary, keyFacts, sources }
      },
    }),

    generate_video_script: tool({
      description: `Generate a complete video script structure from research content.
Returns a VideoConfig skeleton (scenes with narration text, no audio yet).
Call this AFTER research_topic. Do NOT call during edits.`,
      inputSchema: z.object({
        researchContent: z.string().describe("The research content returned by research_topic"),
        topic: z.string().describe("The original topic or URL the user provided"),
        aspectRatio: z.enum(["9:16", "16:9", "1:1", "4:5"]).default("9:16"),
      }),
      execute: async ({ researchContent, topic, aspectRatio }) => {
        const { object: script } = await generateObject({
          model: getGenerationModel(),
          schema: VideoScriptSchema,
          prompt: buildScriptPrompt(researchContent, topic, aspectRatio),
        })

        const config: VideoConfig = {
          id: projectId,
          title: script.title,
          aspectRatio,
          fps: 30,
          scenes: script.scenes.map((s) => ({
            id: s.id,
            type: s.type,
            durationInFrames: s.durationInFrames,
            data: s.data as Record<string, unknown>,
            // narrationText stored temporarily in data for audio generation step
            ...(s.narrationText ? { data: { ...s.data, _narrationText: s.narrationText } } : {}),
          })),
        }

        return config
      },
    }),

    generate_audio_segment: tool({
      description: `Generate narration audio for a single scene using ElevenLabs TTS.
Call once per scene that has narration text.
Always call AFTER generate_video_script has returned a VideoConfig.`,
      inputSchema: z.object({
        sceneId: z.string().describe("The scene ID to generate audio for"),
        narrationText: z.string().max(600).describe("Text to convert to speech"),
        voiceId: z
          .string()
          .optional()
          .describe("ElevenLabs voice ID. Omit to use the default voice."),
      }),
      execute: async ({ sceneId, narrationText, voiceId }) => {
        const voice = voiceId ?? DEFAULT_VOICE_ID
        const textHash = createHash("md5").update(narrationText).digest("hex").slice(0, 8)
        const key = audioKey(projectId, sceneId, "narration", textHash)

        const audioStream = await elevenlabs.textToSpeech.convert(voice, {
          text: narrationText,
          model_id: "eleven_multilingual_v2",
          output_format: "mp3_44100_128",
        })

        const buffer = await streamToBuffer(audioStream)
        const { publicUrl } = await uploadToR2(key, buffer, "audio/mpeg")
        const durationMs = mp3DurationMs(buffer)
        const durationInFrames = Math.ceil((durationMs / 1000) * 30)

        const [saved] = await db
          .insert(audioFiles)
          .values({
            projectId,
            sceneId,
            type: "narration",
            r2Key: key,
            publicUrl,
            durationMs,
            durationInFrames,
            voiceId: voice,
            textHash,
          })
          .returning()

        const segment: AudioSegment = {
          id: saved!.id,
          type: "narration",
          text: narrationText,
          r2Key: key,
          publicUrl,
          durationMs,
          durationInFrames,
          voiceId: voice,
        }

        return segment
      },
    }),

    save_video_config: tool({
      description: `Persist the final VideoConfig to the database after ALL audio has been generated.
Call this once as the last step, passing the complete config with audio segments populated.
Updates the project status to 'ready' so the player can display the video.`,
      inputSchema: z.object({
        config: z.custom<VideoConfig>().describe("The complete VideoConfig with all audio segments"),
      }),
      execute: async ({ config }) => {
        const [latest] = await db
          .select({ version: videoConfigs.version })
          .from(videoConfigs)
          .where(eq(videoConfigs.projectId, projectId))
          .orderBy(desc(videoConfigs.version))
          .limit(1)

        const nextVersion = (latest?.version ?? 0) + 1

        const [saved] = await db
          .insert(videoConfigs)
          .values({
            projectId,
            config,
            version: nextVersion,
          })
          .returning()

        await db
          .update(projects)
          .set({ status: "ready", updatedAt: new Date() })
          .where(eq(projects.id, projectId))

        return { videoConfigId: saved!.id, version: nextVersion, config }
      },
    }),

    patch_scene: tool({
      description: `Update a single scene's content or data without regenerating the whole video.
Use this for quick edits like changing text, tweaking timing, or updating scene data.
Saves a new video config version to DB.`,
      inputSchema: z.object({
        sceneId: z.string().describe("The ID of the scene to patch"),
        updates: z
          .record(z.unknown())
          .describe("Partial scene data fields to merge into the scene's data object"),
        newDurationInFrames: z
          .number()
          .optional()
          .describe("If the scene duration should change"),
      }),
      execute: async ({ sceneId, updates, newDurationInFrames }) => {
        const [latest] = await db
          .select()
          .from(videoConfigs)
          .where(eq(videoConfigs.projectId, projectId))
          .orderBy(desc(videoConfigs.version))
          .limit(1)

        if (!latest) throw new Error("No video config found for this project")

        const config = latest.config as VideoConfig
        const updatedScenes = config.scenes.map((scene: Scene) => {
          if (scene.id !== sceneId) return scene
          return {
            ...scene,
            durationInFrames: newDurationInFrames ?? scene.durationInFrames,
            data: { ...scene.data, ...updates },
          }
        })

        const newConfig: VideoConfig = { ...config, scenes: updatedScenes }

        const [saved] = await db
          .insert(videoConfigs)
          .values({
            projectId,
            config: newConfig,
            version: latest.version + 1,
          })
          .returning()

        await db
          .update(projects)
          .set({ updatedAt: new Date() })
          .where(eq(projects.id, projectId))

        return { videoConfigId: saved!.id, config: newConfig }
      },
    }),

    regenerate_audio_segment: tool({
      description: `Regenerate the narration audio for a scene with new or updated text.
Use when the user asks to rewrite, change tone, or re-record a scene's voiceover.`,
      inputSchema: z.object({
        sceneId: z.string(),
        newNarrationText: z.string().max(600),
        voiceId: z.string().optional(),
      }),
      execute: async ({ sceneId, newNarrationText, voiceId }) => {
        const voice = voiceId ?? DEFAULT_VOICE_ID
        const textHash = createHash("md5").update(newNarrationText).digest("hex").slice(0, 8)
        const key = audioKey(projectId, sceneId, "narration", textHash)

        const audioStream = await elevenlabs.textToSpeech.convert(voice, {
          text: newNarrationText,
          model_id: "eleven_multilingual_v2",
          output_format: "mp3_44100_128",
        })

        const buffer = await streamToBuffer(audioStream)
        const { publicUrl } = await uploadToR2(key, buffer, "audio/mpeg")
        const durationMs = mp3DurationMs(buffer)
        const durationInFrames = Math.ceil((durationMs / 1000) * 30)

        await db.insert(audioFiles).values({
          projectId,
          sceneId,
          type: "narration",
          r2Key: key,
          publicUrl,
          durationMs,
          durationInFrames,
          voiceId: voice,
          textHash,
        })

        const segment: AudioSegment = {
          id: `${sceneId}-${textHash}`,
          type: "narration",
          text: newNarrationText,
          r2Key: key,
          publicUrl,
          durationMs,
          durationInFrames,
          voiceId: voice,
        }

        return segment
      },
    }),
  }
}
