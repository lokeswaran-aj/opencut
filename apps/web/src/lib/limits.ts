import { and, count, eq, inArray } from "drizzle-orm"
import { db } from "@/db"
import { projects } from "@/db/schema"

const MAX_VIDEOS = parseInt(process.env.FREE_TIER_MAX_VIDEOS ?? "5")

export async function getUsage(userId: string) {
  const [row] = await db
    .select({ generated: count() })
    .from(projects)
    .where(
      and(
        eq(projects.userId, userId),
        inArray(projects.status, ["ready", "rendering", "done"])
      )
    )

  const videosGenerated = row?.generated ?? 0
  return {
    videosGenerated,
    maxVideos: MAX_VIDEOS,
    canGenerate: videosGenerated < MAX_VIDEOS,
  }
}
