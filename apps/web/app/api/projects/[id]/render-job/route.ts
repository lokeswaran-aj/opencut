import { NextResponse } from "next/server"
import { eq, desc } from "drizzle-orm"
import { db } from "@/db"
import { projects, renderJobs } from "@/db/schema"
import { requireAuth } from "@/lib/auth"

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

  const { id: projectId } = await params

  try {
    const [project] = await db
      .select()
      .from(projects)
      .where(eq(projects.id, projectId))
      .limit(1)

    if (!project || project.userId !== userId) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    const [job] = await db
      .select()
      .from(renderJobs)
      .where(eq(renderJobs.projectId, projectId))
      .orderBy(desc(renderJobs.createdAt))
      .limit(1)

    if (!job) {
      return NextResponse.json({ error: "No render job found" }, { status: 404 })
    }

    return NextResponse.json(job)
  } catch (err) {
    console.error(`[api/render-job] GET failed for project="${projectId}":`, err)
    return NextResponse.json({ error: "Failed to fetch render job" }, { status: 500 })
  }
}
