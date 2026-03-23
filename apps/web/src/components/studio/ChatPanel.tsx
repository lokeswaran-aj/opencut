"use client"

import type { UIMessage } from "ai"
import { MessageSquare } from "lucide-react"
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

const TOOL_LABELS: Record<string, { pending: string; done: string }> = {
  research_topic: { pending: "Researching topic…", done: "Research complete" },
  generate_video_script: { pending: "Writing video script…", done: "Script ready" },
  generate_audio_segment: { pending: "Generating audio…", done: "Audio created" },
  save_video_config: { pending: "Saving video…", done: "Video saved" },
  patch_scene: { pending: "Updating scene…", done: "Scene updated" },
  regenerate_audio_segment: { pending: "Regenerating audio…", done: "Audio updated" },
}

function ToolCallBubble({ toolName, isDone }: { toolName: string; isDone: boolean }) {
  const labels = TOOL_LABELS[toolName] ?? { pending: `Running ${toolName}…`, done: toolName }
  return (
    <div className="flex items-center gap-2 rounded-lg bg-muted/60 px-3 py-2 text-xs my-1">
      {isDone ? (
        <span className="flex size-4 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400">
          ✓
        </span>
      ) : (
        <span className="size-3 shrink-0 rounded-full border border-amber-400 border-t-transparent animate-spin" />
      )}
      <span className={isDone ? "text-muted-foreground" : "text-amber-400"}>
        {isDone ? labels.done : labels.pending}
      </span>
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
          const p = part as { type: "dynamic-tool"; toolName: string; state: string }
          // Only use live state for the actively-streaming message; otherwise always done
          const isDone = !isLiveMessage || p.state === "output-available"
          return (
            <ToolCallBubble key={i} toolName={p.toolName} isDone={isDone} />
          )
        }

        // Fallback for any legacy "tool-{name}" typed parts
        if (typeof part.type === "string" && part.type.startsWith("tool-") && part.type !== "tool-call") {
          const toolName = part.type.slice(5)
          const p = part as { type: string; state?: string }
          const isDone = !isLiveMessage || p.state === "output-available"
          return <ToolCallBubble key={i} toolName={toolName} isDone={isDone} />
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
}

export function ChatPanel({ messages, onSend, isStreaming, error }: ChatPanelProps) {
  const status = isStreaming ? "streaming" : "ready"

  return (
    <div className="flex w-[400px] shrink-0 flex-col border-r border-border bg-background">
      <div className="border-b border-border px-4 py-3">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Chat
        </p>
      </div>

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
