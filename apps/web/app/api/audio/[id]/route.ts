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

  try {
    const [file] = await db
      .select()
      .from(audioFiles)
      .where(eq(audioFiles.id, id))
      .limit(1)

    if (!file) {
      console.warn(`[api/audio] file not found: id="${id}"`)
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    return NextResponse.redirect(file.publicUrl)
  } catch (err) {
    console.error(`[api/audio] GET failed for id="${id}":`, err)
    return NextResponse.json({ error: "Failed to fetch audio" }, { status: 500 })
  }
}
