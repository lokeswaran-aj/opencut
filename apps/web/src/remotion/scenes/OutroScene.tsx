import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion"
import type { OutroData } from "../VideoComposition"

export function OutroScene({ data }: { data: OutroData }) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()

  const headlineProgress = spring({ frame, fps, config: { damping: 18 } })
  const ctaProgress = spring({ frame: frame - 12, fps, config: { damping: 18 } })
  const brandProgress = spring({ frame: frame - 22, fps, config: { damping: 20 } })

  const headlineY = interpolate(headlineProgress, [0, 1], [50, 0])
  const headlineOpacity = interpolate(headlineProgress, [0, 1], [0, 1])
  const ctaScale = interpolate(ctaProgress, [0, 1], [0.85, 1])
  const ctaOpacity = interpolate(ctaProgress, [0, 1], [0, 1])
  const brandOpacity = interpolate(brandProgress, [0, 1], [0, 1])

  return (
    <AbsoluteFill
      style={{
        background: "linear-gradient(135deg, #0f0f0f, #1e1b4b)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "80px",
        gap: "40px",
      }}
    >
      <h2
        style={{
          color: "#ffffff",
          fontSize: "80px",
          fontWeight: 700,
          lineHeight: 1.2,
          textAlign: "center",
          fontFamily: "system-ui, sans-serif",
          transform: `translateY(${headlineY}px)`,
          opacity: headlineOpacity,
        }}
      >
        {data.headline}
      </h2>
      {data.cta && (
        <div
          style={{
            backgroundColor: "#6366f1",
            color: "#ffffff",
            fontSize: "38px",
            fontWeight: 600,
            padding: "24px 56px",
            borderRadius: "16px",
            fontFamily: "system-ui, sans-serif",
            transform: `scale(${ctaScale})`,
            opacity: ctaOpacity,
          }}
        >
          {data.cta}
        </div>
      )}
      {data.brand && (
        <p
          style={{
            color: "#4b5563",
            fontSize: "28px",
            fontWeight: 500,
            fontFamily: "system-ui, sans-serif",
            opacity: brandOpacity,
            letterSpacing: "0.15em",
            textTransform: "uppercase",
          }}
        >
          {data.brand}
        </p>
      )}
    </AbsoluteFill>
  )
}
