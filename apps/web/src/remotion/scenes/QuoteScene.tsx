import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion"
import type { QuoteData } from "../VideoComposition"

export function QuoteScene({ data }: { data: QuoteData }) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()

  const quoteProgress = spring({ frame, fps, config: { damping: 22, stiffness: 100 } })
  const authorProgress = spring({ frame: frame - 15, fps, config: { damping: 20 } })

  const quoteOpacity = interpolate(quoteProgress, [0, 1], [0, 1])
  const quoteScale = interpolate(quoteProgress, [0, 1], [0.92, 1])
  const authorOpacity = interpolate(authorProgress, [0, 1], [0, 1])
  const authorY = interpolate(authorProgress, [0, 1], [20, 0])

  return (
    <AbsoluteFill
      style={{
        background: "linear-gradient(160deg, #1e1b4b, #0f0f0f)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "100px",
        gap: "40px",
      }}
    >
      <div
        style={{
          color: "#6366f1",
          fontSize: "160px",
          lineHeight: 0.8,
          fontFamily: "Georgia, serif",
          fontWeight: 700,
          opacity: quoteOpacity,
          alignSelf: "flex-start",
        }}
      >
        "
      </div>
      <p
        style={{
          color: "#f9fafb",
          fontSize: "52px",
          fontWeight: 500,
          lineHeight: 1.5,
          textAlign: "center",
          fontFamily: "Georgia, serif",
          fontStyle: "italic",
          transform: `scale(${quoteScale})`,
          opacity: quoteOpacity,
        }}
      >
        {data.text}
      </p>
      {data.author && (
        <p
          style={{
            color: "#9ca3af",
            fontSize: "34px",
            fontWeight: 500,
            fontFamily: "system-ui, sans-serif",
            transform: `translateY(${authorY}px)`,
            opacity: authorOpacity,
          }}
        >
          — {data.author}
        </p>
      )}
    </AbsoluteFill>
  )
}
