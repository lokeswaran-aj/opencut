import { streamText, convertToModelMessages, stepCountIs } from "ai"
import { anthropic } from "@ai-sdk/anthropic"
import { NextResponse } from "next/server"
import { eq, desc } from "drizzle-orm"
import type { UIMessage } from "ai"
import { db } from "@/db"
import { projects, videoConfigs, chatMessages } from "@/db/schema"
import { requireAuth } from "@/lib/auth"
import { makeTools } from "@/lib/ai/tools"
import { buildSystemPrompt } from "@/lib/ai/system-prompt"
import type { VideoConfig } from "@repo/types"

export async function POST(req: Request) {
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

  // Verify project ownership
  const [project] = await db
    .select()
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1)

  if (!project || project.userId !== userId) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 })
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
  const model = isEdit
    ? anthropic("claude-3-5-haiku-20241022")
    : anthropic("claude-3-5-sonnet-20241022")

  const result = streamText({
    model,
    system: buildSystemPrompt(existingConfig),
    messages: await convertToModelMessages(messages),
    tools: makeTools(projectId),
    stopWhen: stepCountIs(15),
    onFinish: async ({ response }) => {
      // Persist the new user message and assistant response
      const userMsg = lastUserMessage
      if (userMsg) {
        await db.insert(chatMessages).values({
          projectId,
          role: "user",
          parts: userMsg.parts as object,
        })
      }

      const assistantMessages = response.messages.filter(
        (m) => m.role === "assistant"
      )
      for (const msg of assistantMessages) {
        await db.insert(chatMessages).values({
          projectId,
          role: "assistant",
          parts: Array.isArray(msg.content) ? msg.content : [{ type: "text", text: String(msg.content) }],
        })
      }

      // Mark project as generating while tools run, reset on save_video_config
      if (!isEdit) {
        await db
          .update(projects)
          .set({ status: "generating", updatedAt: new Date() })
          .where(eq(projects.id, projectId))
      }
    },
  })

  return result.toUIMessageStreamResponse()
}
