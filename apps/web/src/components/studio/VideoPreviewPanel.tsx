"use client"

import { useState, useEffect, useCallback } from "react"
import type { VideoConfig } from "@repo/types"
import { VideoPlayer } from "./VideoPlayer"
import { Button } from "@/components/ui/button"
import { Download, Loader2, XCircle } from "lucide-react"
import { toast } from "sonner"

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

  // The download URL always routes through our Next.js proxy to avoid CORS issues
  const downloadUrl = `/api/projects/${projectId}/download`

  // Poll for job status while rendering
  const pollJob = useCallback(
    async (jobId: string) => {
      try {
        const res = await fetch(`/api/projects/${projectId}/render-job`)
        if (!res.ok) return
        const job: RenderJob = await res.json()

        if (job.status === "done") {
          setExportState({ type: "done", outputUrl: downloadUrl })
          toast.success("Video rendered!", {
            description: "Your MP4 is ready to download.",
          })
          return
        }
        if (job.status === "failed") {
          const msg = job.error ?? "Render failed"
          setExportState({ type: "error", message: msg })
          toast.error("Render failed", { description: msg })
          return
        }
        setExportState({ type: "polling", job })
        setTimeout(() => pollJob(jobId), 2500)
      } catch {
        setTimeout(() => pollJob(jobId), 4000)
      }
    },
    [projectId, downloadUrl]
  )

  const handleExport = async () => {
    setExportState({ type: "requesting" })
    try {
      const res = await fetch(`/api/projects/${projectId}/export`, { method: "POST" })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        const message = (body as { error?: string }).error ?? "Failed to start export"
        const isLimit = res.status === 429
        setExportState({ type: "error", message })
        toast.error(isLimit ? "Render limit reached" : "Export failed", {
          description: message,
        })
        return
      }
      const job: RenderJob = await res.json()
      if (job.status === "done") {
        setExportState({ type: "done", outputUrl: downloadUrl })
        toast.success("Video rendered!", { description: "Your MP4 is ready to download." })
        return
      }
      toast.info("Rendering started", {
        description: "We'll notify you when the MP4 is ready.",
      })
      setExportState({ type: "polling", job })
      setTimeout(() => pollJob(job.id), 2500)
    } catch {
      const message = "Network error — please retry"
      setExportState({ type: "error", message })
      toast.error("Export failed", { description: message })
    }
  }

  // On mount (and whenever projectId changes): restore state from any existing render job
  useEffect(() => {
    let cancelled = false
    fetch(`/api/projects/${projectId}/render-job`)
      .then((r) => (r.ok ? r.json() : null))
      .then((job: RenderJob | null) => {
        if (cancelled || !job) return
        if (job.status === "done") {
          setExportState({ type: "done", outputUrl: downloadUrl })
        } else if (job.status === "failed") {
          setExportState({ type: "error", message: job.error ?? "Render failed" })
        } else if (
          job.status === "queued" ||
          job.status === "bundling" ||
          job.status === "rendering" ||
          job.status === "uploading"
        ) {
          setExportState({ type: "polling", job })
          setTimeout(() => pollJob(job.id), 2500)
        }
      })
      .catch(() => {})
    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId])

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
    <div className="flex w-full h-full flex-col overflow-hidden bg-neutral-925">
      <div className="flex items-center justify-between border-b border-neutral-800 px-3 sm:px-5 py-3 gap-2">
        <p className="text-xs font-medium text-neutral-400 uppercase tracking-wider shrink-0">
          Preview
        </p>
        <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
          {config && (
            <span className="hidden sm:inline text-xs text-neutral-500 shrink-0">
              {aspectRatio} · {config.fps ?? 30}fps
            </span>
          )}

          {/* Export button — morphs based on state */}
          {exportState.type === "done" ? (
            <a
              href={exportState.outputUrl}
              download={`opencut-${projectId}.mp4`}
              onClick={() => toast.success("Download started", { description: "opencut-video.mp4" })}
              className="inline-flex items-center gap-1.5 h-7 px-3 text-xs rounded-md font-medium bg-emerald-600 hover:bg-emerald-500 text-white transition-colors shrink-0"
            >
              <Download className="size-3" />
              Download
            </a>
          ) : exportState.type === "error" ? (
            <Button
              size="sm"
              onClick={() => setExportState({ type: "idle" })}
              className="h-7 px-3 text-xs bg-red-600 hover:bg-red-500 text-white shrink-0"
              title={exportState.message}
            >
              <XCircle className="size-3 mr-1" />
              Retry
            </Button>
          ) : isRendering ? (
            <div className="flex items-center gap-1.5 sm:gap-2">
              {progress > 0 && (
                <div className="flex items-center gap-1 sm:gap-1.5 text-xs text-neutral-400">
                  <div className="w-12 sm:w-16 h-1 rounded-full bg-neutral-700 overflow-hidden shrink-0">
                    <div
                      className="h-full rounded-full bg-indigo-500 transition-all duration-500"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  <span className="hidden sm:inline">{progress}%</span>
                </div>
              )}
              <Button
                size="sm"
                disabled
                className="h-7 px-2 sm:px-3 text-xs bg-indigo-600 text-white opacity-80 cursor-not-allowed shrink-0"
              >
                <Loader2 className="size-3 mr-1 animate-spin" />
                <span className="hidden xs:inline">{stage ?? "Rendering…"}</span>
              </Button>
            </div>
          ) : (
            <Button
              size="sm"
              disabled={!config || isGenerating}
              onClick={handleExport}
              className="h-7 px-3 text-xs bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-40 shrink-0"
            >
              Export
            </Button>
          )}
        </div>
      </div>

      <div className="relative flex-1 min-h-0 overflow-hidden">
        {config ? (
          // Fill the available space with a small inset for padding.
          // Remotion Player scales the composition to fit via transform:scale internally,
          // so it correctly letterboxes/pillarboxes for any container shape.
          <div className="absolute inset-3 overflow-hidden rounded-xl shadow-2xl ring-1 ring-neutral-700">
            <VideoPlayer config={config} className="w-full h-full" />
          </div>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <EmptyState isGenerating={isGenerating} />
          </div>
        )}
      </div>
    </div>
  )
}
