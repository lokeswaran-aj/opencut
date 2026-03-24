import { NextResponse } from "next/server"
import { eq, desc } from "drizzle-orm"
import { db } from "@/db"
import { projects, videoConfigs, chatMessages } from "@/db/schema"
import { requireAuth } from "@/lib/auth"
import type { VideoConfig } from "@repo/types"
import type { UIMessage } from "ai"

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  let userId: string
  try {
    userId = await requireAuth()
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params

  try {
    const [project] = await db
      .select()
      .from(projects)
      .where(eq(projects.id, id))
      .limit(1)

    if (!project || project.userId !== userId) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    const [latestConfig] = await db
      .select()
      .from(videoConfigs)
      .where(eq(videoConfigs.projectId, id))
      .orderBy(desc(videoConfigs.version))
      .limit(1)

    const storedMessages = await db
      .select()
      .from(chatMessages)
      .where(eq(chatMessages.projectId, id))
      .orderBy(chatMessages.createdAt)

    const uiMessages: UIMessage[] = storedMessages.map((m) => ({
      id: m.id,
      role: m.role as "user" | "assistant",
      parts: m.parts as UIMessage["parts"],
    }))

    return NextResponse.json({
      project,
      config: (latestConfig?.config as VideoConfig) ?? null,
      messages: uiMessages,
    })
  } catch (err) {
    console.error(`[api/projects/${id}] GET failed:`, err)
    return NextResponse.json({ error: "Failed to fetch project" }, { status: 500 })
  }
}
