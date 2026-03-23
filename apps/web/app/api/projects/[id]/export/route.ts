import { NextResponse } from "next/server"
import { eq, desc } from "drizzle-orm"
import { db } from "@/db"
import { projects, renderJobs } from "@/db/schema"
import { requireAuth } from "@/lib/auth"

export async function POST(
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

  const [project] = await db
    .select()
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1)

  if (!project || project.userId !== userId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  if (project.status === "generating") {
    return NextResponse.json(
      { error: "Video is still generating, please wait." },
      { status: 409 }
    )
  }

  // If there's already a job in progress, return it
  const [existingJob] = await db
    .select()
    .from(renderJobs)
    .where(eq(renderJobs.projectId, projectId))
    .orderBy(desc(renderJobs.createdAt))
    .limit(1)

  if (
    existingJob &&
    (existingJob.status === "queued" ||
      existingJob.status === "bundling" ||
      existingJob.status === "rendering" ||
      existingJob.status === "uploading")
  ) {
    return NextResponse.json(existingJob, { status: 200 })
  }

  // Create a new render job
  const [job] = await db
    .insert(renderJobs)
    .values({ projectId })
    .returning()

  if (!job) {
    return NextResponse.json({ error: "Failed to create render job" }, { status: 500 })
  }

  // Update project status to "rendering"
  await db
    .update(projects)
    .set({ status: "rendering", updatedAt: new Date() })
    .where(eq(projects.id, projectId))

  // Fire render request to the worker (non-blocking)
  const workerUrl = process.env.RENDER_WORKER_URL
  if (!workerUrl) {
    // Dev fallback: return job as queued (worker must be started manually)
    console.warn("[export] RENDER_WORKER_URL not set — job created but worker not called")
    return NextResponse.json(job, { status: 202 })
  }

  try {
    const res = await fetch(`${workerUrl}/render`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-render-secret": process.env.RENDER_WORKER_SECRET ?? "",
      },
      body: JSON.stringify({ jobId: job.id }),
    })

    if (!res.ok) {
      const text = await res.text()
      console.error("[export] Worker rejected render request:", text)
    }
  } catch (err) {
    console.error("[export] Failed to contact render worker:", err)
  }

  return NextResponse.json(job, { status: 202 })
}
