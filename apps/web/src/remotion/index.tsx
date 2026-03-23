import { Composition, registerRoot } from "remotion"
import type { ComponentType } from "react"
import { VideoComposition } from "./VideoComposition"
import { ASPECT_RATIO_DIMENSIONS } from "./utils"
import type { VideoConfig } from "@repo/types"

// Cast to loose type so Remotion accepts our strongly-typed component
const LooseComposition = VideoComposition as unknown as ComponentType<Record<string, unknown>>

function Root() {
  return (
    <Composition
      id="VideoComposition"
      component={LooseComposition}
      durationInFrames={90}
      fps={30}
      width={1080}
      height={1920}
      defaultProps={
        {
          id: "placeholder",
          title: "",
          aspectRatio: "9:16",
          fps: 30,
          scenes: [],
        } as unknown as Record<string, unknown>
      }
      calculateMetadata={async ({ props }) => {
        const config = props as unknown as VideoConfig
        const total = config.scenes.reduce(
          (sum, s) => sum + (Number(s.durationInFrames) || 90),
          0
        )
        const dims =
          ASPECT_RATIO_DIMENSIONS[config.aspectRatio] ??
          ASPECT_RATIO_DIMENSIONS["9:16"]
        return {
          durationInFrames: Math.max(total, 1),
          fps: config.fps ?? 30,
          width: dims.width,
          height: dims.height,
        }
      }}
    />
  )
}

registerRoot(Root)
