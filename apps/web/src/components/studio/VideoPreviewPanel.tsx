"use client"

import type { VideoConfig } from "@repo/types"
import { VideoPlayer } from "./VideoPlayer"
import { Button } from "@/components/ui/button"

interface VideoPreviewPanelProps {
  config: VideoConfig | null
  projectId: string
  isGenerating: boolean
}

function EmptyState({ isGenerating }: { isGenerating: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-4 text-center px-8">
      <div className="relative">
        <div
          className={`size-20 rounded-2xl bg-neutral-800 flex items-center justify-center text-3xl ${
            isGenerating ? "animate-pulse" : ""
          }`}
        >
          {isGenerating ? "✦" : "▶"}
        </div>
        {isGenerating && (
          <span className="absolute -bottom-1 -right-1 size-4 rounded-full bg-amber-400 animate-ping" />
        )}
      </div>
      <div className="space-y-1.5">
        <p className="text-sm font-medium text-neutral-200">
          {isGenerating ? "Generating your video…" : "No video yet"}
        </p>
        <p className="text-xs text-neutral-500 max-w-[220px]">
          {isGenerating
            ? "The AI is researching, scripting, and creating audio. This takes 30–60 seconds."
            : "Send a message in the chat to start generating."}
        </p>
      </div>
      {isGenerating && (
        <div className="flex gap-1">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="h-6 w-1 rounded-full bg-indigo-500 animate-pulse"
              style={{ animationDelay: `${i * 100}ms` }}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export function VideoPreviewPanel({
  config,
  projectId,
  isGenerating,
}: VideoPreviewPanelProps) {
  const aspectRatio = config?.aspectRatio ?? "9:16"

  const dimensionClass =
    aspectRatio === "9:16"
      ? "aspect-[9/16] h-[600px]"
      : aspectRatio === "16:9"
        ? "aspect-video w-full max-w-3xl"
        : aspectRatio === "1:1"
          ? "aspect-square h-[480px]"
          : "aspect-[4/5] h-[560px]"

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-neutral-925">
      <div className="flex items-center justify-between border-b border-neutral-800 px-5 py-3">
        <p className="text-xs font-medium text-neutral-400 uppercase tracking-wider">
          Preview
        </p>
        <div className="flex items-center gap-2">
          {config && (
            <span className="text-xs text-neutral-500">
              {aspectRatio} · {config.fps}fps
            </span>
          )}
          <Button
            size="sm"
            disabled={!config || isGenerating}
            className="h-7 px-3 text-xs bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-40"
            onClick={() => {
              // TODO: trigger render worker
              alert(`Render job for project ${projectId} — coming in Step 8!`)
            }}
          >
            Export
          </Button>
        </div>
      </div>

      <div className="flex flex-1 items-center justify-center overflow-auto p-8">
        {config ? (
          <VideoPlayer
            config={config}
            className={`${dimensionClass} overflow-hidden rounded-xl shadow-2xl ring-1 ring-neutral-700`}
          />
        ) : (
          <EmptyState isGenerating={isGenerating} />
        )}
      </div>
    </div>
  )
}
