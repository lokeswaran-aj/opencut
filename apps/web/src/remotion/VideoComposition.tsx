import { useMemo } from "react"
import type { VideoConfig } from "@repo/types"
import { compileCode } from "./compiler"

// The entire video is a single AI-generated Remotion component.
// No templates, no fixed layers — the model writes whatever it wants.
export function VideoComposition({ code }: VideoConfig) {
  const { Component, error } = useMemo(() => compileCode(code ?? ""), [code])

  if (error) {
    console.warn("[VideoComposition] Compilation error:", error)
    return null
  }
  if (!Component) return null

  return <Component />
}
