import { z } from "zod"

export type AspectRatio = "9:16" | "16:9" | "1:1" | "4:5"

export type SceneType =
  | "intro"
  | "title"
  | "bullets"
  | "quote"
  | "stat"
  | "outro"

export interface AudioSegment {
  id: string
  type: "narration" | "sound_effect"
  text?: string
  r2Key: string
  publicUrl: string
  durationMs: number
  durationInFrames: number
  voiceId?: string
}

export interface Scene {
  id: string
  type: SceneType
  durationInFrames: number
  audio?: AudioSegment
  data: Record<string, unknown>
}

export interface VideoConfig {
  id: string
  title: string
  aspectRatio: AspectRatio
  fps: number
  scenes: Scene[]
}

// Zod schema used by generateObject inside generate_video_script tool.
// Covers the scene structure Claude must produce (no audio yet — that's added
// by generate_audio_segment calls that follow).
export const VideoScriptSchema = z.object({
  title: z.string().describe("Short, compelling video title"),
  scenes: z
    .array(
      z.object({
        id: z.string().describe("Unique ID like 's1', 's2', etc."),
        type: z.enum(["intro", "title", "bullets", "quote", "stat", "outro"]),
        durationInFrames: z
          .number()
          .min(60)
          .max(180)
          .describe("Duration at 30 fps — 60=2s, 90=3s, 120=4s, 150=5s"),
        narrationText: z
          .string()
          .optional()
          .describe(
            "Text to be converted to speech for this scene. Omit for silent scenes."
          ),
        data: z
          .object({
            // intro
            headline: z.string().optional(),
            subtext: z.string().optional(),
            gradient: z.tuple([z.string(), z.string()]).optional(),
            // title
            title: z.string().optional(),
            subtitle: z.string().optional(),
            // bullets
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
          .describe(
            "Fill only the fields relevant to the scene type. See scene type docs."
          ),
      })
    )
    .min(4)
    .max(10),
})

export type VideoScript = z.infer<typeof VideoScriptSchema>
