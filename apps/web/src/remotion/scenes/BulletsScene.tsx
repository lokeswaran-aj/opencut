import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion"
import type { BulletsData } from "../VideoComposition"

export function BulletsScene({ data }: { data: BulletsData }) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()

  const headingProgress = spring({ frame, fps, config: { damping: 20 } })
  const headingOpacity = interpolate(headingProgress, [0, 1], [0, 1])
  const headingY = interpolate(headingProgress, [0, 1], [30, 0])

  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#0f0f0f",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        padding: "80px 100px",
        gap: "48px",
      }}
    >
      <h3
        style={{
          color: "#6366f1",
          fontSize: "36px",
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: "0.1em",
          fontFamily: "system-ui, sans-serif",
          transform: `translateY(${headingY}px)`,
          opacity: headingOpacity,
        }}
      >
        {data.heading}
      </h3>
      <div style={{ display: "flex", flexDirection: "column", gap: "36px" }}>
        {data.items.map((item, i) => {
          const itemProgress = spring({
            frame: frame - 8 - i * 6,
            fps,
            config: { damping: 18 },
          })
          const itemX = interpolate(itemProgress, [0, 1], [-60, 0])
          const itemOpacity = interpolate(itemProgress, [0, 1], [0, 1])

          return (
            <div
              key={i}
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: "28px",
                transform: `translateX(${itemX}px)`,
                opacity: itemOpacity,
              }}
            >
              <div
                style={{
                  width: "12px",
                  height: "12px",
                  borderRadius: "50%",
                  backgroundColor: "#6366f1",
                  flexShrink: 0,
                  marginTop: "16px",
                }}
              />
              <p
                style={{
                  color: "#e5e7eb",
                  fontSize: "44px",
                  fontWeight: 500,
                  lineHeight: 1.4,
                  fontFamily: "system-ui, sans-serif",
                }}
              >
                {item}
              </p>
            </div>
          )
        })}
      </div>
    </AbsoluteFill>
  )
}
