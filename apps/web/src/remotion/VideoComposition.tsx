import { useMemo } from "react"
import { AbsoluteFill } from "remotion"
import type { VideoConfig } from "@repo/types"
import { compileCode } from "./compiler"

// The entire video is a single AI-generated Remotion component.
// No templates, no fixed layers — the model writes whatever it wants.
export function VideoComposition({ code }: VideoConfig) {
  const { Component, error } = useMemo(() => compileCode(code ?? ""), [code])

  if (error) {
    console.warn("[VideoComposition] Compilation error:", error)
    return (
      <AbsoluteFill
        style={{
          background: "#0a0a0a",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: 48,
          fontFamily: "monospace",
          gap: 16,
        }}
      >
        <div style={{ fontSize: 32 }}>⚠️</div>
        <div style={{ color: "#f87171", fontSize: 18, fontWeight: 700 }}>
          Compilation error
        </div>
        <div
          style={{
            color: "#9ca3af",
            fontSize: 13,
            textAlign: "center",
            lineHeight: 1.6,
            maxWidth: 560,
            wordBreak: "break-word",
          }}
        >
          {error}
        </div>
        <div style={{ color: "#6b7280", fontSize: 12, marginTop: 8 }}>
          Ask the AI to fix or regenerate the video
        </div>
      </AbsoluteFill>
    )
  }

  if (!Component) return null

  return <Component />
}
