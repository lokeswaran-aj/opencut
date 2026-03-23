"use client"

import { useState, useRef, useEffect } from "react"
import type { UIMessage } from "ai"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"

// Human-readable labels for each tool call
const TOOL_LABELS: Record<string, { pending: string; done: string }> = {
  research_topic: { pending: "Researching topic…", done: "Research complete" },
  generate_video_script: { pending: "Writing video script…", done: "Script ready" },
  generate_audio_segment: { pending: "Generating audio…", done: "Audio created" },
  save_video_config: { pending: "Saving video…", done: "Video saved" },
  patch_scene: { pending: "Updating scene…", done: "Scene updated" },
  regenerate_audio_segment: { pending: "Regenerating audio…", done: "Audio updated" },
}

function ToolCallBubble({
  toolName,
  isDone,
}: {
  toolName: string
  isDone: boolean
}) {
  const labels = TOOL_LABELS[toolName] ?? {
    pending: `Running ${toolName}…`,
    done: toolName,
  }

  return (
    <div className="flex items-center gap-2 rounded-lg bg-neutral-800/60 px-3 py-2 text-xs">
      {isDone ? (
        <span className="flex size-4 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400">
          ✓
        </span>
      ) : (
        <span className="size-3 shrink-0 rounded-full border border-amber-400 border-t-transparent animate-spin" />
      )}
      <span className={isDone ? "text-neutral-400" : "text-amber-300"}>
        {isDone ? labels.done : labels.pending}
      </span>
    </div>
  )
}

function MessageBubble({ message }: { message: UIMessage }) {
  const isUser = message.role === "user"

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"} mb-4`}>
      <div
        className={`max-w-[85%] flex flex-col gap-1.5 ${isUser ? "items-end" : "items-start"}`}
      >
        <span className="px-1 text-[10px] font-medium uppercase tracking-wider text-neutral-500">
          {isUser ? "You" : "Opencut AI"}
        </span>

        {message.parts.map((part, i) => {
          // Text part
          if (part.type === "text") {
            const text = (part as { type: "text"; text: string }).text
            if (!text?.trim()) return null
            return (
              <div
                key={i}
                className={`rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${
                  isUser
                    ? "bg-indigo-600 text-white"
                    : "bg-neutral-800 text-neutral-100"
                }`}
              >
                {text}
              </div>
            )
          }

          // Dynamic tool invocation (server-side tools stream as dynamic-tool)
          if (part.type === "dynamic-tool") {
            const p = part as {
              type: "dynamic-tool"
              toolName: string
              state: string
            }
            return (
              <ToolCallBubble
                key={i}
                toolName={p.toolName}
                isDone={p.state === "output-available"}
              />
            )
          }

          // Typed tool parts (tool-{toolName})
          if (typeof part.type === "string" && part.type.startsWith("tool-")) {
            const toolName = part.type.slice(5)
            const p = part as { type: string; state: string }
            return (
              <ToolCallBubble
                key={i}
                toolName={toolName}
                isDone={p.state === "output-available"}
              />
            )
          }

          return null
        })}
      </div>
    </div>
  )
}

interface ChatPanelProps {
  messages: UIMessage[]
  onSend: (text: string) => void
  isStreaming: boolean
  error?: Error
}

export function ChatPanel({ messages, onSend, isStreaming, error }: ChatPanelProps) {
  const [input, setInput] = useState("")
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const formRef = useRef<HTMLFormElement>(null)

  useEffect(() => {
    const el = scrollContainerRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages, isStreaming])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const text = input.trim()
    if (!text || isStreaming) return
    onSend(text)
    setInput("")
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      formRef.current?.requestSubmit()
    }
  }

  const isEmpty = messages.length === 0

  return (
    <div className="flex w-[420px] shrink-0 flex-col border-r border-neutral-800 bg-neutral-950">
      <div className="border-b border-neutral-800 px-4 py-3">
        <p className="text-xs font-medium uppercase tracking-wider text-neutral-400">
          Chat
        </p>
      </div>

      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto min-h-0 px-4 py-4"
      >
        {isEmpty ? (
          <div className="flex flex-col items-center justify-center py-20 text-center gap-3">
            <div className="size-10 rounded-full bg-indigo-500/10 flex items-center justify-center text-xl">
              ✦
            </div>
            <p className="text-sm text-neutral-400 max-w-[260px]">
              Describe what video you want to create, or paste a URL to
              research.
            </p>
            <p className="text-xs text-neutral-600">
              Try: "Create a 60-second explainer about LLMs"
            </p>
          </div>
        ) : (
          <>
            {messages.map((m) => (
              <MessageBubble key={m.id} message={m} />
            ))}
            {isStreaming && (
              <div className="flex justify-start mb-4">
                <div className="rounded-2xl bg-neutral-800 px-3.5 py-2.5">
                  <span className="flex gap-1 items-center">
                    <span className="size-1.5 rounded-full bg-neutral-400 animate-bounce [animation-delay:0ms]" />
                    <span className="size-1.5 rounded-full bg-neutral-400 animate-bounce [animation-delay:150ms]" />
                    <span className="size-1.5 rounded-full bg-neutral-400 animate-bounce [animation-delay:300ms]" />
                  </span>
                </div>
              </div>
            )}
          </>
        )}
        {error && (
          <p className="text-xs text-red-400 px-2 pb-2">{error.message}</p>
        )}
      </div>

      <div className="border-t border-neutral-800 p-4">
        <form ref={formRef} onSubmit={handleSubmit} className="flex flex-col gap-2">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Describe your video… (⌘↵ to send)"
            className="min-h-[80px] resize-none bg-neutral-900 border-neutral-700 text-sm text-white placeholder:text-neutral-600 focus-visible:ring-indigo-500 focus-visible:border-indigo-500"
            disabled={isStreaming}
          />
          <Button
            type="submit"
            disabled={isStreaming || !input.trim()}
            className="w-full bg-indigo-600 hover:bg-indigo-500 text-white text-sm"
          >
            {isStreaming ? "Generating…" : "Generate"}
          </Button>
        </form>
      </div>
    </div>
  )
}
