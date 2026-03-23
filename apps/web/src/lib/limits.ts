import { and, count, eq } from "drizzle-orm"
import { db } from "@/db"
import { projects, renderJobs, chatMessages } from "@/db/schema"

const MAX_PROJECTS = parseInt(process.env.FREE_TIER_MAX_PROJECTS ?? "5")
const MAX_RENDERS = parseInt(process.env.FREE_TIER_MAX_RENDERS ?? "10")
const MAX_MESSAGES = parseInt(process.env.FREE_TIER_MAX_MESSAGES ?? "50")

export interface Usage {
  projects: { used: number; max: number; allowed: boolean }
  renders: { used: number; max: number; allowed: boolean }
  messages: { used: number; max: number; allowed: boolean }
}

export async function getUsage(userId: string): Promise<Usage> {
  // Count all projects regardless of status
  const [projectRow] = await db
    .select({ total: count() })
    .from(projects)
    .where(eq(projects.userId, userId))

  // Count render jobs (done + in-progress) across all user projects
  // Join render_jobs → projects on project ownership
  const [renderRow] = await db
    .select({ total: count() })
    .from(renderJobs)
    .innerJoin(projects, eq(renderJobs.projectId, projects.id))
    .where(eq(projects.userId, userId))

  // Count all chat messages across all user projects
  const [messageRow] = await db
    .select({ total: count() })
    .from(chatMessages)
    .innerJoin(projects, eq(chatMessages.projectId, projects.id))
    .where(
      and(
        eq(projects.userId, userId),
        eq(chatMessages.role, "user") // only count user turns, not AI replies
      )
    )

  const projectsUsed = projectRow?.total ?? 0
  const rendersUsed = renderRow?.total ?? 0
  const messagesUsed = messageRow?.total ?? 0

  return {
    projects: {
      used: projectsUsed,
      max: MAX_PROJECTS,
      allowed: projectsUsed < MAX_PROJECTS,
    },
    renders: {
      used: rendersUsed,
      max: MAX_RENDERS,
      allowed: rendersUsed < MAX_RENDERS,
    },
    messages: {
      used: messagesUsed,
      max: MAX_MESSAGES,
      allowed: messagesUsed < MAX_MESSAGES,
    },
  }
}

// Convenience helpers for individual checks

export async function canCreateProject(userId: string): Promise<boolean> {
  const usage = await getUsage(userId)
  return usage.projects.allowed
}

export async function canRender(userId: string): Promise<boolean> {
  const usage = await getUsage(userId)
  return usage.renders.allowed
}

export async function canSendMessage(userId: string): Promise<boolean> {
  const usage = await getUsage(userId)
  return usage.messages.allowed
}
