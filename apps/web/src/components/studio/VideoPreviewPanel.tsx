"use client"

import { useState, useEffect, useCallback } from "react"
import type { VideoConfig } from "@repo/types"
import { VideoPlayer } from "./VideoPlayer"
import { Button } from "@/components/ui/button"
import { Download, Loader2, CheckCircle, XCircle } from "lucide-react"

interface RenderJob {
  id: string
  status: string
  progress: number
  stage: string | null
  outputUrl: string | null
  error: string | null
}

type ExportState =
  | { type: "idle" }
  | { type: "requesting" }
  | { type: "polling"; job: RenderJob }
  | { type: "done"; outputUrl: string }
  | { type: "error"; message: string }

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
  const [exportState, setExportState] = useState<ExportState>({ type: "idle" })

  const aspectRatio = config?.aspectRatio ?? "9:16"
  const dimensionClass =
    aspectRatio === "9:16"
      ? "aspect-[9/16] h-[600px]"
      : aspectRatio === "16:9"
        ? "aspect-video w-full max-w-3xl"
        : aspectRatio === "1:1"
          ? "aspect-square h-[480px]"
          : "aspect-[4/5] h-[560px]"

  // Poll for job status while rendering
  const pollJob = useCallback(
    async (jobId: string) => {
      try {
        const res = await fetch(`/api/projects/${projectId}/render-job`)
        if (!res.ok) return
        const job: RenderJob = await res.json()

        if (job.status === "done" && job.outputUrl) {
          setExportState({ type: "done", outputUrl: job.outputUrl })
          return
        }
        if (job.status === "failed") {
          setExportState({
            type: "error",
            message: job.error ?? "Render failed",
          })
          return
        }
        // Still in progress — update displayed job and schedule next poll
        setExportState({ type: "polling", job })
        setTimeout(() => pollJob(jobId), 2500)
      } catch {
        setTimeout(() => pollJob(jobId), 4000)
      }
    },
    [projectId]
  )

  const handleExport = async () => {
    setExportState({ type: "requesting" })
    try {
      const res = await fetch(`/api/projects/${projectId}/export`, {
        method: "POST",
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        setExportState({
          type: "error",
          message: (body as { error?: string }).error ?? "Failed to start export",
        })
        return
      }
      const job: RenderJob = await res.json()

      if (job.status === "done" && job.outputUrl) {
        setExportState({ type: "done", outputUrl: job.outputUrl })
        return
      }

      setExportState({ type: "polling", job })
      setTimeout(() => pollJob(job.id), 2500)
    } catch {
      setExportState({ type: "error", message: "Network error — please retry" })
    }
  }

  // Reset export state when config changes (new video generated)
  useEffect(() => {
    setExportState({ type: "idle" })
  }, [config?.id])

  const isRendering =
    exportState.type === "requesting" || exportState.type === "polling"
  const progress =
    exportState.type === "polling" ? exportState.job.progress : 0
  const stage =
    exportState.type === "polling"
      ? exportState.job.stage
      : exportState.type === "requesting"
        ? "Starting…"
        : null

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-neutral-925">
      <div className="flex items-center justify-between border-b border-neutral-800 px-5 py-3">
        <p className="text-xs font-medium text-neutral-400 uppercase tracking-wider">
          Preview
        </p>
        <div className="flex items-center gap-2">
          {config && (
            <span className="text-xs text-neutral-500">
              {aspectRatio} · {config.fps ?? 30}fps
            </span>
          )}

          {/* Export button — morphs based on state */}
          {exportState.type === "done" ? (
            <a
              href={exportState.outputUrl}
              target="_blank"
              rel="noopener noreferrer"
              download
              className="inline-flex items-center gap-1.5 h-7 px-3 text-xs rounded-md font-medium bg-emerald-600 hover:bg-emerald-500 text-white transition-colors"
            >
              <Download className="size-3" />
              Download
            </a>
          ) : exportState.type === "error" ? (
            <Button
              size="sm"
              onClick={() => setExportState({ type: "idle" })}
              className="h-7 px-3 text-xs bg-red-600 hover:bg-red-500 text-white"
              title={exportState.message}
            >
              <XCircle className="size-3 mr-1" />
              Retry
            </Button>
          ) : isRendering ? (
            <div className="flex items-center gap-2">
              {progress > 0 && (
                <div className="flex items-center gap-1.5 text-xs text-neutral-400">
                  <div className="w-16 h-1 rounded-full bg-neutral-700 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-indigo-500 transition-all duration-500"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  <span>{progress}%</span>
                </div>
              )}
              <Button
                size="sm"
                disabled
                className="h-7 px-3 text-xs bg-indigo-600 text-white opacity-80 cursor-not-allowed"
              >
                <Loader2 className="size-3 mr-1 animate-spin" />
                {stage ?? "Rendering…"}
              </Button>
            </div>
          ) : (
            <Button
              size="sm"
              disabled={!config || isGenerating}
              onClick={handleExport}
              className="h-7 px-3 text-xs bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-40"
            >
              Export
            </Button>
          )}
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
