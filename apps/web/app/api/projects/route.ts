import { NextResponse } from "next/server"
import { eq, desc } from "drizzle-orm"
import { db } from "@/db"
import { projects } from "@/db/schema"
import { requireAuth } from "@/lib/auth"
import { getUsage } from "@/lib/limits"

export async function GET() {
  let userId: string
  try {
    userId = await requireAuth()
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const rows = await db
    .select()
    .from(projects)
    .where(eq(projects.userId, userId))
    .orderBy(desc(projects.createdAt))

  return NextResponse.json(rows)
}

export async function POST(req: Request) {
  let userId: string
  try {
    userId = await requireAuth()
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const usage = await getUsage(userId)
  if (!usage.canGenerate) {
    return NextResponse.json(
      {
        error: "Video limit reached",
        message: `You've used ${usage.videosGenerated} of ${usage.maxVideos} free videos.`,
      },
      { status: 429 }
    )
  }

  const body = await req.json() as {
    title?: string
    topic?: string
    sourceUrl?: string
    aspectRatio?: string
  }

  const [project] = await db
    .insert(projects)
    .values({
      userId,
      title: body.title ?? "Untitled Video",
      topic: body.topic,
      sourceUrl: body.sourceUrl,
      aspectRatio: (body.aspectRatio as "9:16" | "16:9" | "1:1" | "4:5") ?? "9:16",
      status: "draft",
    })
    .returning()

  return NextResponse.json(project, { status: 201 })
}
