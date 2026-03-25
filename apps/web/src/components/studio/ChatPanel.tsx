"use client"

import type { UIMessage } from "ai"
import { MessageSquare, Search, Mic, Image, Code2, Save } from "lucide-react"
import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation"
import { Message, MessageContent, MessageResponse } from "@/components/ai-elements/message"
import {
  PromptInput,
  PromptInputTextarea,
  PromptInputFooter,
  PromptInputSubmit,
} from "@/components/ai-elements/prompt-input"

type ToolInput = Record<string, unknown>

interface ToolMeta {
  icon: React.ReactNode
  pendingLabel: string
  doneLabel: string
  detail: (input: ToolInput, isDone: boolean) => string | null
}

const TOOL_META: Record<string, ToolMeta> = {
  research_topic: {
    icon: <Search className="size-3" />,
    pendingLabel: "Researching…",
    doneLabel: "Research complete",
    detail: (input) => {
      const raw = (input.input as string | undefined) ?? ""
      if (!raw) return null
      const label = raw.startsWith("http") ? new URL(raw).hostname : raw
      return truncate(label, 60)
    },
  },
  generate_narration: {
    icon: <Mic className="size-3" />,
    pendingLabel: "Generating narration…",
    doneLabel: "Narration ready",
    detail: (input) => {
      const text = (input.text as string | undefined) ?? ""
      return text ? `"${truncate(text, 80)}"` : null
    },
  },
  generate_image: {
    icon: <Image className="size-3" />,
    pendingLabel: "Generating image…",
    doneLabel: "Image ready",
    detail: (input) => {
      const prompt = (input.prompt as string | undefined) ?? ""
      return prompt ? truncate(prompt, 72) : null
    },
  },
  generate_video_code: {
    icon: <Code2 className="size-3" />,
    pendingLabel: "Generating video…",
    doneLabel: "Video generated",
    detail: () => "Compiling audio + image assets into a full video composition",
  },
  save_video_code: {
    icon: <Save className="size-3" />,
    pendingLabel: "Saving video…",
    doneLabel: "Video saved",
    detail: () => null,
  },
}

function truncate(str: string, max: number) {
  return str.length > max ? str.slice(0, max) + "…" : str
}

function ToolCallBubble({
  toolName,
  isDone,
  input,
}: {
  toolName: string
  isDone: boolean
  input: ToolInput
}) {
  const meta = TOOL_META[toolName]
  const label = meta
    ? isDone ? meta.doneLabel : meta.pendingLabel
    : isDone ? toolName : `Running ${toolName}…`
  const detail = meta?.detail(input, isDone) ?? null
  const icon = meta?.icon ?? null

  return (
    <div className="flex items-start gap-2.5 rounded-lg bg-muted/40 border border-border/40 px-3 py-2.5 text-xs my-1">
      {/* Status indicator */}
      <div className="mt-0.5 shrink-0">
        {isDone ? (
          <span className="flex size-4 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400">
            ✓
          </span>
        ) : (
          <span className="size-3 mt-0.5 rounded-full border border-amber-400 border-t-transparent animate-spin block" />
        )}
      </div>

      <div className="flex flex-col gap-0.5 min-w-0">
        {/* Tool name + label row */}
        <div className="flex items-center gap-1.5">
          <span className={isDone ? "text-muted-foreground/60" : "text-amber-400/70"}>
            {icon}
          </span>
          <span className={`font-medium ${isDone ? "text-muted-foreground" : "text-amber-400"}`}>
            {label}
          </span>
        </div>

        {/* Contextual detail line */}
        {detail && (
          <p className="text-muted-foreground/50 leading-snug wrap-break-word">
            {detail}
          </p>
        )}
      </div>
    </div>
  )
}

/**
 * isLiveMessage: true only for the very last message while streaming is active.
 * For all other messages (past messages OR after streaming ends) tool calls should
 * always render as completed — they must have finished since the message was created.
 */
function MessageParts({
  message,
  isLiveMessage,
}: {
  message: UIMessage
  isLiveMessage: boolean
}) {
  return (
    <>
      {message.parts.map((part, i) => {
        if (part.type === "text") {
          const text = (part as { type: "text"; text: string }).text
          if (!text?.trim()) return null
          return <MessageResponse key={i}>{text}</MessageResponse>
        }

        if (part.type === "dynamic-tool") {
          const p = part as {
            type: "dynamic-tool"
            toolName: string
            state: string
            input?: ToolInput
          }
          const isDone = !isLiveMessage || p.state === "output-available"
          return (
            <ToolCallBubble
              key={i}
              toolName={p.toolName}
              isDone={isDone}
              input={p.input ?? {}}
            />
          )
        }

        // Fallback for any legacy "tool-{name}" typed parts
        if (typeof part.type === "string" && part.type.startsWith("tool-") && part.type !== "tool-call") {
          const toolName = part.type.slice(5)
          const p = part as { type: string; state?: string; input?: ToolInput }
          const isDone = !isLiveMessage || p.state === "output-available"
          return (
            <ToolCallBubble key={i} toolName={toolName} isDone={isDone} input={p.input ?? {}} />
          )
        }

        return null
      })}
    </>
  )
}

interface ChatPanelProps {
  messages: UIMessage[]
  onSend: (text: string) => void
  isStreaming: boolean
  error?: Error
  hideHeader?: boolean
}

export function ChatPanel({ messages, onSend, isStreaming, error, hideHeader }: ChatPanelProps) {
  const status = isStreaming ? "streaming" : "ready"

  return (
    <div className="flex w-full h-full flex-col bg-background">
      {!hideHeader && (
        <div className="border-b border-border px-4 py-3">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Chat
          </p>
        </div>
      )}

      <Conversation className="flex-1 min-h-0">
        <ConversationContent>
          {messages.length === 0 ? (
            <ConversationEmptyState
              icon={<MessageSquare className="size-8 opacity-40" />}
              title="Start generating"
              description="Describe a topic or paste a URL to create your video."
            />
          ) : (
            messages.map((message, idx) => {
              // Only the last message uses live tool-call state while streaming.
              // All earlier messages (and any message after streaming ends) are
              // considered complete so their tool-call bubbles show as done.
              const isLiveMessage = isStreaming && idx === messages.length - 1
              return (
                <Message from={message.role as "user" | "assistant"} key={message.id}>
                  <MessageContent>
                    <MessageParts message={message} isLiveMessage={isLiveMessage} />
                  </MessageContent>
                </Message>
              )
            })
          )}
          {isStreaming && messages.at(-1)?.role !== "assistant" && (
            <Message from="assistant">
              <MessageContent>
                <div className="flex gap-1 items-center px-1 py-0.5">
                  <span className="size-1.5 rounded-full bg-muted-foreground animate-bounce [animation-delay:0ms]" />
                  <span className="size-1.5 rounded-full bg-muted-foreground animate-bounce [animation-delay:150ms]" />
                  <span className="size-1.5 rounded-full bg-muted-foreground animate-bounce [animation-delay:300ms]" />
                </div>
              </MessageContent>
            </Message>
          )}
          {error && (
            <p className="text-xs text-destructive px-2">{error.message}</p>
          )}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>

      <div className="border-t border-border p-3">
        <PromptInput
          onSubmit={({ text }) => {
            if (text.trim() && !isStreaming) onSend(text)
          }}
        >
          <PromptInputTextarea
            placeholder="Describe your video… (Enter to send)"
            disabled={isStreaming}
            className="min-h-[64px] text-sm"
          />
          <PromptInputFooter>
            <span className="text-xs text-muted-foreground/60">⌘↵</span>
            <PromptInputSubmit status={status} disabled={isStreaming} />
          </PromptInputFooter>
        </PromptInput>
      </div>
    </div>
  )
}
