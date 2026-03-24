import { Composition, registerRoot } from "remotion"
import type { ComponentType } from "react"
import { VideoComposition } from "./VideoComposition"
import { ASPECT_RATIO_DIMENSIONS } from "./utils"
import type { VideoConfig } from "@repo/types"

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
          durationInFrames: 90,
          code: "",
        } as unknown as Record<string, unknown>
      }
      calculateMetadata={async ({ props }) => {
        const config = props as unknown as VideoConfig
        const dims =
          ASPECT_RATIO_DIMENSIONS[config.aspectRatio] ??
          ASPECT_RATIO_DIMENSIONS["9:16"]
        return {
          durationInFrames: Math.max(config.durationInFrames, 1),
          fps: config.fps ?? 30,
          width: dims.width,
          height: dims.height,
        }
      }}
    />
  )
}

registerRoot(Root)
