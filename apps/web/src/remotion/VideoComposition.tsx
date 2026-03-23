import { AbsoluteFill, Sequence } from "remotion"
import type { VideoConfig, Scene } from "@repo/types"
import { IntroScene } from "./scenes/IntroScene"
import { TitleScene } from "./scenes/TitleScene"
import { BulletsScene } from "./scenes/BulletsScene"
import { QuoteScene } from "./scenes/QuoteScene"
import { StatScene } from "./scenes/StatScene"
import { OutroScene } from "./scenes/OutroScene"

function renderScene(scene: Scene) {
  switch (scene.type) {
    case "intro":
      return <IntroScene data={scene.data as unknown as IntroData} />
    case "title":
      return <TitleScene data={scene.data as unknown as TitleData} />
    case "bullets":
      return <BulletsScene data={scene.data as unknown as BulletsData} />
    case "quote":
      return <QuoteScene data={scene.data as unknown as QuoteData} />
    case "stat":
      return <StatScene data={scene.data as unknown as StatData} />
    case "outro":
      return <OutroScene data={scene.data as unknown as OutroData} />
    default:
      return null
  }
}

export function VideoComposition({ scenes }: VideoConfig) {
  let offset = 0

  return (
    <AbsoluteFill style={{ backgroundColor: "#0a0a0a" }}>
      {scenes.map((scene) => {
        const from = offset
        offset += scene.durationInFrames
        return (
          <Sequence
            key={scene.id}
            from={from}
            durationInFrames={scene.durationInFrames}
          >
            {renderScene(scene)}
          </Sequence>
        )
      })}
    </AbsoluteFill>
  )
}

// Scene data shapes — used only inside Remotion compositions
export interface IntroData {
  headline: string
  subtext?: string
  gradient?: [string, string]
}
export interface TitleData {
  title: string
  subtitle?: string
}
export interface BulletsData {
  heading: string
  items: string[]
}
export interface QuoteData {
  text: string
  author?: string
}
export interface StatData {
  value: string
  label: string
  context?: string
}
export interface OutroData {
  headline: string
  cta?: string
  brand?: string
}
