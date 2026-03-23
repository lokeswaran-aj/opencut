import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion"
import type { TitleData } from "../VideoComposition"

export function TitleScene({ data }: { data: TitleData }) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()

  const titleProgress = spring({ frame, fps, config: { damping: 20, stiffness: 120 } })
  const subtitleProgress = spring({ frame: frame - 10, fps, config: { damping: 20 } })

  const titleScale = interpolate(titleProgress, [0, 1], [0.85, 1])
  const titleOpacity = interpolate(titleProgress, [0, 1], [0, 1])
  const subtitleY = interpolate(subtitleProgress, [0, 1], [30, 0])
  const subtitleOpacity = interpolate(subtitleProgress, [0, 1], [0, 1])

  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#0f0f0f",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "80px",
        gap: "28px",
      }}
    >
      <div
        style={{
          width: "64px",
          height: "4px",
          backgroundColor: "#6366f1",
          borderRadius: "2px",
          opacity: titleOpacity,
        }}
      />
      <h2
        style={{
          color: "#ffffff",
          fontSize: "80px",
          fontWeight: 700,
          lineHeight: 1.2,
          textAlign: "center",
          fontFamily: "system-ui, sans-serif",
          transform: `scale(${titleScale})`,
          opacity: titleOpacity,
        }}
      >
        {data.title}
      </h2>
      {data.subtitle && (
        <p
          style={{
            color: "#9ca3af",
            fontSize: "38px",
            fontWeight: 400,
            textAlign: "center",
            fontFamily: "system-ui, sans-serif",
            transform: `translateY(${subtitleY}px)`,
            opacity: subtitleOpacity,
          }}
        >
          {data.subtitle}
        </p>
      )}
    </AbsoluteFill>
  )
}
