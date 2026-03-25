"use client"

import { useChat } from "@ai-sdk/react"
import { useState, useEffect, useRef } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { DefaultChatTransport } from "ai"
import type { UIMessage } from "ai"
import type { VideoConfig } from "@repo/types"
import { ChatPanel } from "@/components/studio/ChatPanel"
import { VideoPreviewPanel } from "@/components/studio/VideoPreviewPanel"
import { toast } from "sonner"

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
  initialQuery?: string
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
  initialQuery,
}: StudioClientProps) {
  const [config, setConfig] = useState<VideoConfig | null>(initialConfig)
  const [projectStatus, setProjectStatus] = useState(project.status)
  const [mobileTab, setMobileTab] = useState<"chat" | "preview">(
    initialConfig ? "preview" : "chat"
  )
  const [isMobile, setIsMobile] = useState(false)
  const wasActiveRef = useRef(false)
  const hasAutoSentRef = useRef(false)
  const prevConfigRef = useRef(initialConfig)
  const router = useRouter()

  const { messages, sendMessage, status, error } = useChat({
    onError: (err) => {
      const message = err.message ?? "Something went wrong"
      const isLimit = message.toLowerCase().includes("limit")
      toast.error(isLimit ? "Message limit reached" : "Generation failed", {
        description: message,
      })
    },
    messages: initialMessages,
    transport: new DefaultChatTransport({
      api: "/api/chat",
      body: { projectId: project.id },
    }),
  })

  // Auto-send the initial query passed via ?q= URL param (from the landing page)
  useEffect(() => {
    if (initialQuery && messages.length === 0 && !hasAutoSentRef.current) {
      hasAutoSentRef.current = true
      sendMessage({ text: initialQuery })
      // Remove ?q= from the URL to keep it clean
      router.replace(`/studio/${project.id}`, { scroll: false })
    }
  // Run only on mount — sendMessage and router are stable refs
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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

  // Detect mobile viewport — drives JS-conditional rendering to avoid duplicate players
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)")
    setIsMobile(mq.matches)
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches)
    mq.addEventListener("change", handler)
    return () => mq.removeEventListener("change", handler)
  }, [])

  // Auto-switch to preview tab on mobile when a video is first generated
  useEffect(() => {
    if (config && !prevConfigRef.current) {
      setMobileTab("preview")
    }
    prevConfigRef.current = config
  }, [config])

  const isStreaming = status === "streaming" || status === "submitted"
  const hasVideo = config !== null

  const videoAspectRatioCss =
    config?.aspectRatio === "16:9" ? "16/9" :
    config?.aspectRatio === "1:1"  ? "1/1"  :
    config?.aspectRatio === "4:5"  ? "4/5"  : "9/16"

  return (
    <div className="flex h-screen flex-col bg-neutral-950 text-white overflow-hidden">
      <header className="flex items-center justify-between border-b border-neutral-800 px-4 sm:px-6 py-3 shrink-0 gap-2">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <Link href="/" className="text-base font-bold tracking-tight text-white hover:opacity-80 transition-opacity shrink-0">
            opencut
          </Link>
          <span className="text-neutral-600 shrink-0">/</span>
          <span className="text-sm text-neutral-300 truncate">
            {project.title}
          </span>
        </div>
        <div className="flex items-center gap-2 text-xs shrink-0">
          <span
            className={`capitalize font-medium ${STATUS_COLORS[projectStatus] ?? "text-neutral-400"}`}
          >
            {projectStatus}
          </span>
          {isStreaming && (
            <span className="hidden sm:flex items-center gap-1 text-amber-400">
              <span className="size-1.5 rounded-full bg-amber-400 animate-pulse" />
              generating
            </span>
          )}
        </div>
      </header>

      {/* Mobile tab switcher — only rendered when JS confirms a mobile viewport */}
      {hasVideo && isMobile && (
        <div className="flex shrink-0 border-b border-neutral-800 bg-neutral-950">
          <button
            className={`flex-1 py-2.5 text-sm font-medium transition-colors ${
              mobileTab === "chat"
                ? "text-white border-b-2 border-indigo-500"
                : "text-neutral-500 hover:text-neutral-300"
            }`}
            onClick={() => setMobileTab("chat")}
          >
            Chat
          </button>
          <button
            className={`flex-1 py-2.5 text-sm font-medium transition-colors ${
              mobileTab === "preview"
                ? "text-white border-b-2 border-indigo-500"
                : "text-neutral-500 hover:text-neutral-300"
            }`}
            onClick={() => setMobileTab("preview")}
          >
            Preview
          </button>
        </div>
      )}

      {hasVideo ? (
        isMobile ? (
          // Mobile: one panel at a time — only the active tab is mounted,
          // preventing the hidden player from playing audio in the background.
          <div className="flex flex-1 overflow-hidden">
            {mobileTab === "chat" ? (
              <ChatPanel
                messages={messages}
                onSend={(text) => sendMessage({ text })}
                isStreaming={isStreaming}
                error={error}
              />
            ) : (
              <VideoPreviewPanel
                config={config}
                projectId={project.id}
                isGenerating={isStreaming}
              />
            )}
          </div>
        ) : config?.aspectRatio === "16:9" ? (
          // Desktop landscape: percentage split — chat 30%, video 70%
          <div className="flex flex-1 overflow-hidden">
            <div className="w-[30%] shrink-0 border-r border-neutral-800 flex flex-col animate-in slide-in-from-left-2 fade-in duration-400">
              <ChatPanel
                messages={messages}
                onSend={(text) => sendMessage({ text })}
                isStreaming={isStreaming}
                error={error}
              />
            </div>
            <div className="flex-1 min-w-0 flex flex-col animate-in slide-in-from-right-4 fade-in duration-500">
              <VideoPreviewPanel
                config={config}
                projectId={project.id}
                isGenerating={isStreaming}
              />
            </div>
          </div>
        ) : (
          // Desktop portrait / square: chat fills remaining space, video width = height × ratio
          <div className="flex flex-1 overflow-hidden">
            <div className="flex-1 min-w-[280px] border-r border-neutral-800 flex flex-col animate-in slide-in-from-left-2 fade-in duration-400">
              <ChatPanel
                messages={messages}
                onSend={(text) => sendMessage({ text })}
                isStreaming={isStreaming}
                error={error}
              />
            </div>
            <div
              className="shrink-0 h-full flex flex-col animate-in slide-in-from-right-4 fade-in duration-500"
              style={{ aspectRatio: videoAspectRatioCss }}
            >
              <VideoPreviewPanel
                config={config}
                projectId={project.id}
                isGenerating={isStreaming}
              />
            </div>
          </div>
        )
      ) : (
        // Full-width centered chat — no video yet
        <div className="flex flex-1 items-center justify-center overflow-hidden px-4 py-6">
          <div className="w-full max-w-2xl h-full flex flex-col">
            <ChatPanel
              messages={messages}
              onSend={(text) => sendMessage({ text })}
              isStreaming={isStreaming}
              error={error}
              hideHeader
            />
          </div>
        </div>
      )}
    </div>
  )
}
