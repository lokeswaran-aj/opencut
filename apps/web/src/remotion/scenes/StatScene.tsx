import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion"
import type { StatData } from "../VideoComposition"

export function StatScene({ data }: { data: StatData }) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()

  const valueProgress = spring({ frame, fps, config: { damping: 14, stiffness: 180 } })
  const labelProgress = spring({ frame: frame - 10, fps, config: { damping: 20 } })
  const contextProgress = spring({ frame: frame - 18, fps, config: { damping: 20 } })

  const valueScale = interpolate(valueProgress, [0, 1], [0.5, 1])
  const valueOpacity = interpolate(valueProgress, [0, 1], [0, 1])
  const labelY = interpolate(labelProgress, [0, 1], [30, 0])
  const labelOpacity = interpolate(labelProgress, [0, 1], [0, 1])
  const contextOpacity = interpolate(contextProgress, [0, 1], [0, 1])

  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#0f0f0f",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "80px",
        gap: "24px",
      }}
    >
      <p
        style={{
          color: "#6366f1",
          fontSize: "180px",
          fontWeight: 900,
          lineHeight: 1,
          fontFamily: "system-ui, sans-serif",
          letterSpacing: "-0.04em",
          transform: `scale(${valueScale})`,
          opacity: valueOpacity,
        }}
      >
        {data.value}
      </p>
      <p
        style={{
          color: "#ffffff",
          fontSize: "52px",
          fontWeight: 600,
          textAlign: "center",
          fontFamily: "system-ui, sans-serif",
          transform: `translateY(${labelY}px)`,
          opacity: labelOpacity,
        }}
      >
        {data.label}
      </p>
      {data.context && (
        <p
          style={{
            color: "#6b7280",
            fontSize: "32px",
            fontWeight: 400,
            textAlign: "center",
            fontFamily: "system-ui, sans-serif",
            opacity: contextOpacity,
          }}
        >
          {data.context}
        </p>
      )}
    </AbsoluteFill>
  )
}
