import { NextResponse } from "next/server"
import { eq } from "drizzle-orm"
import { db } from "@/db"
import { audioFiles } from "@/db/schema"
import { requireAuth } from "@/lib/auth"

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth()
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params
  const [file] = await db
    .select()
    .from(audioFiles)
    .where(eq(audioFiles.id, id))
    .limit(1)

  if (!file) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  // Redirect to the R2 public URL (or presigned URL if bucket is private).
  // Remotion's <Audio> component follows the redirect automatically.
  return NextResponse.redirect(file.publicUrl)
}
