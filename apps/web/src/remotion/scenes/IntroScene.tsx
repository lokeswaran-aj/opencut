import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion"
import type { IntroData } from "../VideoComposition"

export function IntroScene({ data }: { data: IntroData }) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const [from, to] = data.gradient ?? ["#6366f1", "#8b5cf6"]

  const headlineProgress = spring({ frame, fps, config: { damping: 18 } })
  const subtextProgress = spring({
    frame: frame - 12,
    fps,
    config: { damping: 18 },
  })

  const headlineY = interpolate(headlineProgress, [0, 1], [60, 0])
  const headlineOpacity = interpolate(headlineProgress, [0, 1], [0, 1])
  const subtextY = interpolate(subtextProgress, [0, 1], [40, 0])
  const subtextOpacity = interpolate(subtextProgress, [0, 1], [0, 1])

  return (
    <AbsoluteFill
      style={{
        background: `linear-gradient(135deg, ${from}, ${to})`,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "80px",
        gap: "32px",
      }}
    >
      <h1
        style={{
          color: "#ffffff",
          fontSize: "96px",
          fontWeight: 800,
          lineHeight: 1.1,
          textAlign: "center",
          fontFamily: "system-ui, sans-serif",
          transform: `translateY(${headlineY}px)`,
          opacity: headlineOpacity,
        }}
      >
        {data.headline}
      </h1>
      {data.subtext && (
        <p
          style={{
            color: "rgba(255,255,255,0.85)",
            fontSize: "42px",
            fontWeight: 400,
            textAlign: "center",
            fontFamily: "system-ui, sans-serif",
            transform: `translateY(${subtextY}px)`,
            opacity: subtextOpacity,
          }}
        >
          {data.subtext}
        </p>
      )}
    </AbsoluteFill>
  )
}
