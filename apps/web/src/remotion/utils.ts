import type { AspectRatio } from "@repo/types"

export const ASPECT_RATIO_DIMENSIONS: Record<
  AspectRatio,
  { width: number; height: number }
> = {
  "9:16": { width: 1080, height: 1920 },
  "16:9": { width: 1920, height: 1080 },
  "1:1": { width: 1080, height: 1080 },
  "4:5": { width: 1080, height: 1350 },
}

export function getTotalDurationInFrames(
  scenes: { durationInFrames: number }[]
): number {
  return scenes.reduce((sum, s) => sum + (Number(s.durationInFrames) || 0), 0)
}
