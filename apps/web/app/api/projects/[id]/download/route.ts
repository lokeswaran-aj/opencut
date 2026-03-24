import { NextResponse } from "next/server"
import { eq, desc } from "drizzle-orm"
import { GetObjectCommand } from "@aws-sdk/client-s3"
import { db } from "@/db"
import { projects, renderJobs } from "@/db/schema"
import { requireAuth } from "@/lib/auth"
import { r2 } from "@/lib/r2"

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

    if (!job || job.status !== "done" || !job.r2Key) {
      return NextResponse.json({ error: "No completed render found" }, { status: 404 })
    }

    console.log(`[api/download] fetching from R2`, { projectId, r2Key: job.r2Key })

    let obj
    try {
      obj = await r2.send(
        new GetObjectCommand({
          Bucket: process.env.CLOUDFLARE_R2_BUCKET_NAME!,
          Key: job.r2Key,
        })
      )
    } catch (r2Err) {
      console.error(`[api/download] R2 GetObject failed for key="${job.r2Key}":`, r2Err)
      return NextResponse.json({ error: "Failed to fetch video from storage" }, { status: 502 })
    }

    if (!obj.Body) {
      console.error(`[api/download] R2 object body is empty for key="${job.r2Key}"`)
      return NextResponse.json({ error: "File not found in storage" }, { status: 404 })
    }

    const filename = `opencut-${projectId}.mp4`
    console.log(`[api/download] streaming video to client`, { projectId, filename, bytes: obj.ContentLength })
    return new Response(obj.Body.transformToWebStream(), {
      headers: {
        "Content-Type": "video/mp4",
        "Content-Disposition": `attachment; filename="${filename}"`,
        ...(obj.ContentLength
          ? { "Content-Length": String(obj.ContentLength) }
          : {}),
      },
    })
  } catch (err) {
    console.error(`[api/download] GET failed for project="${projectId}":`, err)
    return NextResponse.json({ error: "Failed to download video" }, { status: 500 })
  }
}
