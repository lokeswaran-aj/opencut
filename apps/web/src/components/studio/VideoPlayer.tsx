"use client"

import { useMemo } from "react"
import { Player } from "@remotion/player"
import type { ComponentType } from "react"
import type { VideoConfig } from "@repo/types"
import { VideoComposition } from "@/remotion/VideoComposition"

// Remotion's Player types inputProps as Record<string, unknown>; VideoConfig
// satisfies that contract at runtime since it's a plain object.
const TypedComposition = VideoComposition as unknown as ComponentType<Record<string, unknown>>
import { ASPECT_RATIO_DIMENSIONS, getTotalDurationInFrames } from "@/remotion/utils"

interface VideoPlayerProps {
  config: VideoConfig
  className?: string
}

export function VideoPlayer({ config, className }: VideoPlayerProps) {
  const { width, height } =
    ASPECT_RATIO_DIMENSIONS[config.aspectRatio] ?? ASPECT_RATIO_DIMENSIONS["9:16"]
  const durationInFrames = useMemo(
    () => getTotalDurationInFrames(config.scenes),
    [config.scenes]
  )
  const inputProps = useMemo(() => config, [config])

  if (!durationInFrames || isNaN(durationInFrames)) return null

  return (
    <div className={className}>
      <Player
        component={TypedComposition}
        inputProps={inputProps}
        durationInFrames={durationInFrames}
        compositionWidth={width}
        compositionHeight={height}
        fps={config.fps ?? 30}
        style={{ width: "100%", height: "100%" }}
        controls
        loop
      />
    </div>
  )
}
