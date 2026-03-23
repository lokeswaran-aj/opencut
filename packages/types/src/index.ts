// Full VideoConfig Zod schema is defined in Step 4 (Remotion compositions).
// Stub exported here so the DB schema compiles cleanly.

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
