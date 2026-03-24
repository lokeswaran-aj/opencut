import { Hono } from "hono"
import { eq } from "drizzle-orm"
import { db, renderJobs } from "./db"
import { runRenderJob } from "./render"

const app = new Hono()

// Health check
app.get("/", (c) => c.json({ status: "ok", service: "opencut-render-worker" }))

// POST /render — start a render job
// Body: { jobId: string }
// The Next.js API creates the job row before calling this endpoint.
app.post("/render", async (c) => {
  const secret = c.req.header("x-render-secret")
  if (secret !== process.env.RENDER_WORKER_SECRET) {
    return c.json({ error: "Unauthorized" }, 401)
  }

  const body = await c.req.json<{ jobId: string }>()
  const { jobId } = body

  if (!jobId) {
    return c.json({ error: "jobId is required" }, 400)
  }

  // Fire-and-forget — the job status is tracked in the DB
  // We respond immediately so the Next.js caller doesn't time out
  runRenderJob(jobId).catch((err) => {
    console.error("[worker] Unhandled render error for job", jobId, err)
  })

  return c.json({ jobId, status: "queued" })
})

// GET /jobs/:jobId — poll job status
app.get("/jobs/:jobId", async (c) => {
  const secret = c.req.header("x-render-secret")
  if (secret !== process.env.RENDER_WORKER_SECRET) {
    return c.json({ error: "Unauthorized" }, 401)
  }

  const { jobId } = c.req.param()

  try {
    const [job] = await db
      .select()
      .from(renderJobs)
      .where(eq(renderJobs.id, jobId))
      .limit(1)

    if (!job) {
      console.warn(`[render-worker][jobs] job not found: jobId="${jobId}"`)
      return c.json({ error: "Not found" }, 404)
    }

    return c.json(job)
  } catch (err) {
    console.error(`[render-worker][jobs] DB query failed for jobId="${jobId}":`, err)
    return c.json({ error: "Failed to fetch job" }, 500)
  }
})

const PORT = Number(process.env.PORT ?? 8787)
console.log(`[render-worker] Listening on port ${PORT}`)

export default {
  port: PORT,
  fetch: app.fetch,
}
