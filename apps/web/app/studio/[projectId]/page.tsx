import { auth } from "@clerk/nextjs/server"
import { redirect } from "next/navigation"
import { eq, desc } from "drizzle-orm"
import { db } from "@/db"
import { projects, videoConfigs, chatMessages } from "@/db/schema"
import { StudioClient } from "./StudioClient"
import type { VideoConfig } from "@repo/types"
import type { UIMessage } from "ai"

export default async function StudioPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>
  searchParams: Promise<{ q?: string }>
}) {
  const { userId } = await auth()
  if (!userId) redirect("/sign-in")

  const { projectId } = await params
  const { q } = await searchParams
  const initialQuery = q ? decodeURIComponent(q) : undefined

  const [project] = await db
    .select()
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1)

  if (!project || project.userId !== userId) redirect("/dashboard")

  const [latestConfig] = await db
    .select()
    .from(videoConfigs)
    .where(eq(videoConfigs.projectId, projectId))
    .orderBy(desc(videoConfigs.version))
    .limit(1)

  const storedMessages = await db
    .select()
    .from(chatMessages)
    .where(eq(chatMessages.projectId, projectId))
    .orderBy(chatMessages.createdAt)

  const initialMessages: UIMessage[] = storedMessages.map((m) => ({
    id: m.id,
    role: m.role as "user" | "assistant",
    parts: m.parts as UIMessage["parts"],
  }))

  return (
    <StudioClient
      project={{
        id: project.id,
        title: project.title,
        status: project.status,
        aspectRatio: project.aspectRatio,
        topic: project.topic,
        sourceUrl: project.sourceUrl,
      }}
      initialConfig={(latestConfig?.config as VideoConfig) ?? null}
      initialMessages={initialMessages}
      initialQuery={initialQuery}
    />
  )
}
