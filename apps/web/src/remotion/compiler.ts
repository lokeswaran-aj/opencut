import * as Babel from "@babel/standalone"
import * as RemotionShapes from "@remotion/shapes"
import { preloadAudio, preloadImage } from "@remotion/preload"
import { TransitionSeries, linearTiming, springTiming } from "@remotion/transitions"
import { clockWipe } from "@remotion/transitions/clock-wipe"
import { fade } from "@remotion/transitions/fade"
import { flip } from "@remotion/transitions/flip"
import { slide } from "@remotion/transitions/slide"
import { wipe } from "@remotion/transitions/wipe"
import React, { useEffect, useMemo, useRef, useState } from "react"
import {
  AbsoluteFill,
  Audio,
  Img,
  Sequence,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion"

export interface CompilationResult {
  Component: React.ComponentType | null
  error: string | null
}

function extractComponentBody(code: string): string {
  let cleaned = code
  // Strip all import statements (handles multi-line imports)
  cleaned = cleaned.replace(/import\s+type\s*\{[\s\S]*?\}\s*from\s*["'][^"']+["'];?/g, "")
  cleaned = cleaned.replace(/import\s+\w+\s*,\s*\{[\s\S]*?\}\s*from\s*["'][^"']+["'];?/g, "")
  cleaned = cleaned.replace(/import\s*\{[\s\S]*?\}\s*from\s*["'][^"']+["'];?/g, "")
  cleaned = cleaned.replace(/import\s+\*\s+as\s+\w+\s+from\s*["'][^"']+["'];?/g, "")
  cleaned = cleaned.replace(/import\s+\w+\s+from\s*["'][^"']+["'];?/g, "")
  cleaned = cleaned.replace(/import\s*["'][^"']+["'];?/g, "")
  cleaned = cleaned.trim()

  // Extract body from "export const MyComponent = () => { ... };"
  const match = cleaned.match(
    /^([\s\S]*?)export\s+const\s+\w+\s*=\s*\(\s*\)\s*=>\s*\{([\s\S]*)\};?\s*$/
  )
  if (match) {
    const helpers = (match[1] ?? "").trim()
    const body = (match[2] ?? "").trim()
    return helpers ? `${helpers}\n\n${body}` : body
  }

  return cleaned
}

export function compileCode(code: string): CompilationResult {
  if (!code?.trim()) {
    return { Component: null, error: "No code provided" }
  }

  try {
    const componentBody = extractComponentBody(code)
    const wrappedSource = `const DynamicOverlay = () => {\n${componentBody}\n};`

    const transpiled = Babel.transform(wrappedSource, {
      presets: ["react", "typescript"],
      filename: "dynamic-overlay.tsx",
    })

    if (!transpiled.code) {
      return { Component: null, error: "Transpilation failed" }
    }

    const Remotion = { AbsoluteFill, Audio, interpolate, useCurrentFrame, useVideoConfig, spring, Sequence, Img }

    const wrappedCode = `${transpiled.code}\nreturn DynamicOverlay;`

    const createComponent = new Function(
      "React",
      "Remotion",
      "RemotionShapes",
      "AbsoluteFill",
      "Audio",
      "Img",
      "Sequence",
      "interpolate",
      "useCurrentFrame",
      "useVideoConfig",
      "spring",
      "useState",
      "useEffect",
      "useMemo",
      "useRef",
      "preloadAudio",
      "preloadImage",
      "Rect",
      "Circle",
      "Triangle",
      "Star",
      "Polygon",
      "Ellipse",
      "Heart",
      "Pie",
      "TransitionSeries",
      "linearTiming",
      "springTiming",
      "fade",
      "slide",
      "wipe",
      "flip",
      "clockWipe",
      wrappedCode
    )

    const Component = createComponent(
      React,
      Remotion,
      RemotionShapes,
      AbsoluteFill,
      Audio,
      Img,
      Sequence,
      interpolate,
      useCurrentFrame,
      useVideoConfig,
      spring,
      useState,
      useEffect,
      useMemo,
      useRef,
      preloadAudio,
      preloadImage,
      RemotionShapes.Rect,
      RemotionShapes.Circle,
      RemotionShapes.Triangle,
      RemotionShapes.Star,
      RemotionShapes.Polygon,
      RemotionShapes.Ellipse,
      RemotionShapes.Heart,
      RemotionShapes.Pie,
      TransitionSeries,
      linearTiming,
      springTiming,
      fade,
      slide,
      wipe,
      flip,
      clockWipe
    )

    if (typeof Component !== "function") {
      return { Component: null, error: "Code must export a function component" }
    }

    return { Component, error: null }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown compilation error"
    return { Component: null, error: message }
  }
}
