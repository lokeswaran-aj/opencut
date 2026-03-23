import path from "path"
import os from "os"
import fs from "fs"
import { bundle } from "@remotion/bundler"
import { renderMedia, selectComposition } from "@remotion/renderer"
import { eq, desc } from "drizzle-orm"
import { db, projects, videoConfigs, renderJobs } from "./db"
import { uploadVideoToR2, renderKey } from "./r2"
import type { VideoConfig } from "@repo/types"

// Path to the Remotion entry file in the web app
const REMOTION_ENTRY = path.resolve(
  import.meta.dir,
  "../../web/src/remotion/index.tsx"
)

// Bundle cache — reuse across requests in the same process
let bundleCache: string | null = null

async function getBundle(): Promise<string> {
  if (bundleCache) return bundleCache

  console.log("[render] Bundling Remotion composition…")
  bundleCache = await bundle({
    entryPoint: REMOTION_ENTRY,
    // Allow webpack to resolve workspace packages from the monorepo root
    webpackOverride: (config) => {
      config.resolve ??= {}
      config.resolve.modules = [
        ...(config.resolve.modules ?? ["node_modules"]),
        path.resolve(import.meta.dir, "../../../node_modules"),
        path.resolve(import.meta.dir, "../../web/node_modules"),
      ]
      return config
    },
  })
  console.log("[render] Bundle ready:", bundleCache)
  return bundleCache
}

async function setJobStage(
  jobId: string,
  stage: string,
  progress: number
): Promise<void> {
  await db
    .update(renderJobs)
    .set({ stage, progress })
    .where(eq(renderJobs.id, jobId))
}

export async function runRenderJob(jobId: string): Promise<void> {
  // Mark job as started
  await db
    .update(renderJobs)
    .set({ status: "bundling", startedAt: new Date(), progress: 5, stage: "Bundling composition" })
    .where(eq(renderJobs.id, jobId))

  const [job] = await db
    .select()
    .from(renderJobs)
    .where(eq(renderJobs.id, jobId))
    .limit(1)

  if (!job) throw new Error(`Job ${jobId} not found`)

  const projectId = job.projectId

  try {
    // 1. Load the latest VideoConfig for this project
    const [latestConfig] = await db
      .select()
      .from(videoConfigs)
      .where(eq(videoConfigs.projectId, projectId))
      .orderBy(desc(videoConfigs.createdAt))
      .limit(1)

    if (!latestConfig) throw new Error("No video config found for project")
    const config = latestConfig.config as VideoConfig

    // 2. Bundle the Remotion composition (cached after first call)
    const bundled = await getBundle()

    // 3. Select the composition with our config as input props
    await setJobStage(jobId, "Selecting composition", 20)
    const composition = await selectComposition({
      serveUrl: bundled,
      id: "VideoComposition",
      inputProps: config,
    })

    // 4. Render to a temp file
    await setJobStage(jobId, "Rendering video", 30)
    const tmpDir = os.tmpdir()
    const outFile = path.join(tmpDir, `${jobId}.mp4`)

    await renderMedia({
      composition,
      serveUrl: bundled,
      codec: "h264",
      outputLocation: outFile,
      inputProps: config,
      onProgress: async ({ progress: p }) => {
        // Map 0–1 render progress to 30–85 overall progress
        const pct = 30 + Math.round(p * 55)
        await db
          .update(renderJobs)
          .set({ progress: pct, stage: `Rendering ${Math.round(p * 100)}%` })
          .where(eq(renderJobs.id, jobId))
      },
    })

    // 5. Upload to R2
    await setJobStage(jobId, "Uploading to R2", 88)
    const videoBuffer = fs.readFileSync(outFile)
    const key = renderKey(projectId, jobId)
    const outputUrl = await uploadVideoToR2(key, videoBuffer)

    // 6. Clean up temp file
    fs.unlinkSync(outFile)

    // 7. Mark job done
    await db
      .update(renderJobs)
      .set({
        status: "done",
        progress: 100,
        stage: "Complete",
        outputUrl,
        r2Key: key,
        completedAt: new Date(),
      })
      .where(eq(renderJobs.id, jobId))

    // 8. Update project status
    await db
      .update(projects)
      .set({ status: "done" })
      .where(eq(projects.id, projectId))

    console.log(`[render] Job ${jobId} complete — ${outputUrl}`)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error(`[render] Job ${jobId} failed:`, message)

    await db
      .update(renderJobs)
      .set({
        status: "failed",
        error: message,
        completedAt: new Date(),
      })
      .where(eq(renderJobs.id, jobId))

    await db
      .update(projects)
      .set({ status: "failed" })
      .where(eq(projects.id, projectId))

    throw err
  }
}
