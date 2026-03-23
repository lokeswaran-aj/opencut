"use client"

import { useChat } from "@ai-sdk/react"
import { useState, useEffect, useRef } from "react"
import { DefaultChatTransport } from "ai"
import type { UIMessage } from "ai"
import type { VideoConfig } from "@repo/types"
import { ChatPanel } from "@/components/studio/ChatPanel"
import { VideoPreviewPanel } from "@/components/studio/VideoPreviewPanel"

export interface StudioProject {
  id: string
  title: string
  status: string
  aspectRatio: string
  topic: string | null
  sourceUrl: string | null
}

interface StudioClientProps {
  project: StudioProject
  initialConfig: VideoConfig | null
  initialMessages: UIMessage[]
}

const STATUS_COLORS: Record<string, string> = {
  draft: "text-neutral-400",
  generating: "text-amber-400",
  ready: "text-emerald-400",
  rendering: "text-blue-400",
  done: "text-emerald-500",
  failed: "text-red-400",
}

export function StudioClient({
  project,
  initialConfig,
  initialMessages,
}: StudioClientProps) {
  const [config, setConfig] = useState<VideoConfig | null>(initialConfig)
  const [projectStatus, setProjectStatus] = useState(project.status)
  const wasActiveRef = useRef(false)

  const { messages, sendMessage, status, error } = useChat({
    messages: initialMessages,
    transport: new DefaultChatTransport({
      api: "/api/chat",
      body: { projectId: project.id },
    }),
  })

  // Track any active (streaming/submitted) state so we can poll when it ends,
  // regardless of which exact state sequence the AI SDK takes.
  useEffect(() => {
    if (status === "streaming" || status === "submitted") {
      wasActiveRef.current = true
      return
    }
    if (status === "ready" && wasActiveRef.current) {
      wasActiveRef.current = false
      // Small delay to ensure save_video_config DB write is visible before we read
      const timer = setTimeout(() => {
        fetch(`/api/projects/${project.id}`)
          .then((r) => r.json())
          .then((data: { config: VideoConfig | null; project: { status: string } }) => {
            if (data.config) setConfig(data.config)
            if (data.project?.status) setProjectStatus(data.project.status)
          })
          .catch(console.error)
      }, 600)
      return () => clearTimeout(timer)
    }
  }, [status, project.id])

  const isStreaming = status === "streaming" || status === "submitted"

  return (
    <div className="flex h-screen flex-col bg-neutral-950 text-white overflow-hidden">
      <header className="flex items-center justify-between border-b border-neutral-800 px-6 py-3 shrink-0">
        <div className="flex items-center gap-3">
          <span className="text-base font-bold tracking-tight text-white">
            opencut
          </span>
          <span className="text-neutral-600">/</span>
          <span className="text-sm text-neutral-300 truncate max-w-xs">
            {project.title}
          </span>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span
            className={`capitalize font-medium ${STATUS_COLORS[projectStatus] ?? "text-neutral-400"}`}
          >
            {projectStatus}
          </span>
          {isStreaming && (
            <span className="flex items-center gap-1 text-amber-400">
              <span className="size-1.5 rounded-full bg-amber-400 animate-pulse" />
              generating
            </span>
          )}
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <ChatPanel
          messages={messages}
          onSend={(text) => sendMessage({ text })}
          isStreaming={isStreaming}
          error={error}
        />
        <VideoPreviewPanel
          config={config}
          projectId={project.id}
          isGenerating={isStreaming}
        />
      </div>
    </div>
  )
}
