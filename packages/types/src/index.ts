import { z } from "zod"

export type AspectRatio = "9:16" | "16:9" | "1:1" | "4:5"

// VideoConfig — the AI generates a complete Remotion TSX component as `code`.
// There are no scene types, no fixed layers, no templates.
// The Remotion Player compiles `code` with Babel and renders it directly.
export const VideoConfigSchema = z.object({
  id: z.string(),
  title: z.string(),
  aspectRatio: z.enum(["9:16", "16:9", "1:1", "4:5"]),
  fps: z.number().default(30),
  durationInFrames: z.number(),
  code: z.string().describe("Complete Remotion TSX component source code"),
})

export type VideoConfig = z.infer<typeof VideoConfigSchema>

// Asset types returned by the generate_narration and generate_image tools
export interface AudioAsset {
  id: string
  url: string
  durationMs: number
  durationInFrames: number
  text: string
}

export interface ImageAsset {
  id: string
  url: string
}
