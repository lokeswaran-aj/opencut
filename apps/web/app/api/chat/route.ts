import { streamText, convertToModelMessages, stepCountIs } from "ai"
import { NextResponse } from "next/server"
import { getGenerationModel, getEditModel } from "@/lib/ai/model"
import { eq, desc } from "drizzle-orm"
import type { UIMessage } from "ai"
import { db } from "@/db"
import { projects, videoConfigs, chatMessages } from "@/db/schema"
import { requireAuth } from "@/lib/auth"
import { canSendMessage } from "@/lib/limits"
import { makeTools } from "@/lib/ai/tools"
import { buildSystemPrompt } from "@/lib/ai/system-prompt"
import type { VideoConfig } from "@repo/types"

const log = (tag: string, msg: string, data?: Record<string, unknown>) => {
  const ts = new Date().toISOString()
  const extra = data ? ` ${JSON.stringify(data)}` : ""
  console.log(`[chat][${tag}] ${ts} ${msg}${extra}`)
}

export async function POST(req: Request) {
  const reqStart = Date.now()
  let userId: string
  try {
    userId = await requireAuth()
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await req.json() as { messages: UIMessage[]; projectId: string }
  const { messages, projectId } = body

  if (!projectId) {
    return NextResponse.json({ error: "projectId is required" }, { status: 400 })
  }

  log("request", "incoming", { projectId, userId, messageCount: messages.length })

  // Verify project ownership
  const [project] = await db
    .select()
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1)

  if (!project || project.userId !== userId) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 })
  }

  if (!(await canSendMessage(userId))) {
    return NextResponse.json(
      { error: "Message limit reached. Free tier allows up to 50 messages." },
      { status: 429 }
    )
  }

  // Load the latest VideoConfig for edit context
  const [latestConfig] = await db
    .select()
    .from(videoConfigs)
    .where(eq(videoConfigs.projectId, projectId))
    .orderBy(desc(videoConfigs.version))
    .limit(1)

  const existingConfig = (latestConfig?.config as VideoConfig) ?? null

  // Detect if this is an edit or new generation to pick the right model
  const lastUserMessage = [...messages].reverse().find((m) => m.role === "user")
  const isEdit = existingConfig !== null && messages.length > 2
  const model = isEdit ? getEditModel() : getGenerationModel()

  log("stream", "starting", { projectId, isEdit, model: isEdit ? "edit" : "generation" })

  // Mark project as actively generating BEFORE streaming starts so the UI
  // can show the loading state. save_timeline will set it back to "ready"
  // when done. We must NOT touch the status inside onFinish (it runs after
  // save_timeline has already written "ready").
  await db
    .update(projects)
    .set({ status: "generating", updatedAt: new Date() })
    .where(eq(projects.id, projectId))

  const result = streamText({
    model,
    system: buildSystemPrompt(existingConfig),
    messages: await convertToModelMessages(messages),
    tools: makeTools(projectId),
    // research + plan + (image + audio) × 8 scenes + style + save = ~20 steps max
    stopWhen: stepCountIs(25),
    onStepFinish: ({ toolResults, usage }) => {
      if (toolResults?.length) {
        for (const tr of toolResults) {
          log("tool:done", tr.toolName, {
            projectId,
            toolCallId: tr.toolCallId,
            tokens: usage?.totalTokens,
          })
        }
      }
    },
    onFinish: async ({ response, usage, finishReason }) => {
      log("stream", "finished", {
        projectId,
        finishReason,
        totalTokens: usage?.totalTokens,
        elapsedMs: Date.now() - reqStart,
      })

      // Persist the new user message
      if (lastUserMessage) {
        await db.insert(chatMessages).values({
          projectId,
          role: "user",
          parts: lastUserMessage.parts as object,
        })
      }

      // Persist assistant messages, converting raw model content to the
      // UI-message part format so they render correctly after a page refresh.
      const assistantMessages = response.messages.filter(
        (m) => m.role === "assistant"
      )
      for (const msg of assistantMessages) {
        const rawContent = Array.isArray(msg.content)
          ? msg.content
          : [{ type: "text", text: String(msg.content) }]

        // Convert model content blocks → UIMessage parts
        const uiParts = (rawContent as Record<string, unknown>[]).map((part) => {
          if (part.type === "tool-call") {
            // Store completed tool calls in dynamic-tool UI format
            return {
              type: "dynamic-tool",
              toolCallId: part.toolCallId,
              toolName: part.toolName,
              state: "output-available",
              input: part.args ?? {},
            }
          }
          // text parts pass through as-is
          return part
        })

        // Skip messages that carry no visible content
        const hasContent = uiParts.some(
          (p) =>
            (p.type === "text" && String(p.text ?? "").trim().length > 0) ||
            p.type === "dynamic-tool"
        )
        if (!hasContent) continue

        await db.insert(chatMessages).values({
          projectId,
          role: "assistant",
          parts: uiParts,
        })
      }

      log("persist", "messages saved", { projectId })
      // NOTE: do NOT update project status here — save_timeline already
      // set it to "ready", and touching it again would overwrite that.
    },
  })

  return result.toUIMessageStreamResponse()
}
