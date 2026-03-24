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

function renderLog(tag: string, msg: string, data?: Record<string, unknown>) {
  const ts = new Date().toISOString()
  const extra = data ? ` ${JSON.stringify(data)}` : ""
  console.log(`[render][${tag}] ${ts} ${msg}${extra}`)
}
function renderError(tag: string, msg: string, err: unknown) {
  const detail = err instanceof Error ? err.stack ?? err.message : String(err)
  console.error(`[render][${tag}] ERROR ${new Date().toISOString()} ${msg}\n${detail}`)
}

async function getBundle(): Promise<string> {
  if (bundleCache) {
    renderLog("bundle", "using cached bundle", { path: bundleCache })
    return bundleCache
  }

  renderLog("bundle", "starting Remotion bundle", { entryPoint: REMOTION_ENTRY })
  try {
    bundleCache = await bundle({
      entryPoint: REMOTION_ENTRY,
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
    renderLog("bundle", "bundle ready", { path: bundleCache })
    return bundleCache
  } catch (err) {
    renderError("bundle", "Remotion bundle failed", err)
    throw err
  }
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
  renderLog("job", "starting render job", { jobId })

  try {
    await db
      .update(renderJobs)
      .set({ status: "bundling", startedAt: new Date(), progress: 5, stage: "Bundling composition" })
      .where(eq(renderJobs.id, jobId))
  } catch (err) {
    renderError("job", `failed to mark job as started — jobId="${jobId}"`, err)
    throw err
  }

  const [job] = await db
    .select()
    .from(renderJobs)
    .where(eq(renderJobs.id, jobId))
    .limit(1)

  if (!job) throw new Error(`Job ${jobId} not found in database`)

  const projectId = job.projectId
  const jobStart = Date.now()

  try {
    // 1. Load the latest VideoConfig for this project
    renderLog("job", "loading video config from DB", { jobId, projectId })
    const [latestConfig] = await db
      .select()
      .from(videoConfigs)
      .where(eq(videoConfigs.projectId, projectId))
      .orderBy(desc(videoConfigs.createdAt))
      .limit(1)

    if (!latestConfig) throw new Error(`No video config found for project "${projectId}"`)
    const config = latestConfig.config as VideoConfig
    renderLog("job", "video config loaded", { jobId, projectId, durationInFrames: config.durationInFrames, fps: config.fps })

    // 2. Bundle the Remotion composition (cached after first call)
    const bundled = await getBundle()

    // 3. Select the composition with our config as input props
    await setJobStage(jobId, "Selecting composition", 20)
    renderLog("job", "selecting Remotion composition", { jobId })
    let composition
    try {
      composition = await selectComposition({
        serveUrl: bundled,
        id: "VideoComposition",
        inputProps: config,
        timeoutInMilliseconds: 30000,
      })
      renderLog("job", "composition selected", { jobId, durationInFrames: composition.durationInFrames })
    } catch (err) {
      renderError("job", `selectComposition failed — jobId="${jobId}"`, err)
      throw err
    }

    // 4. Render to a temp file
    await setJobStage(jobId, "Rendering video", 30)
    const tmpDir = os.tmpdir()
    const outFile = path.join(tmpDir, `${jobId}.mp4`)
    renderLog("job", "starting renderMedia", { jobId, outFile })

    try {
      await renderMedia({
        composition,
        serveUrl: bundled,
        codec: "h264",
        outputLocation: outFile,
        inputProps: config,
        onProgress: async ({ progress: p }) => {
          const pct = 30 + Math.round(p * 55)
          await db
            .update(renderJobs)
            .set({ progress: pct, stage: `Rendering ${Math.round(p * 100)}%` })
            .where(eq(renderJobs.id, jobId))
        },
      })
      renderLog("job", "renderMedia complete", { jobId, outFile })
    } catch (err) {
      renderError("job", `renderMedia failed — jobId="${jobId}"`, err)
      throw err
    }

    // 5. Upload to R2
    await setJobStage(jobId, "Uploading to R2", 88)
    const videoBuffer = fs.readFileSync(outFile)
    const key = renderKey(projectId, jobId)
    renderLog("job", "uploading to R2", { jobId, key, bytes: videoBuffer.length })
    let outputUrl: string
    try {
      outputUrl = await uploadVideoToR2(key, videoBuffer)
      renderLog("job", "R2 upload done", { jobId, key, outputUrl })
    } catch (err) {
      renderError("job", `R2 upload failed — jobId="${jobId}", key="${key}"`, err)
      throw err
    }

    // 6. Clean up temp file
    fs.unlinkSync(outFile)

    // 7. Mark job done
    await db
      .update(renderJobs)
      .set({ status: "done", progress: 100, stage: "Complete", outputUrl, r2Key: key, completedAt: new Date() })
      .where(eq(renderJobs.id, jobId))

    // 8. Update project status
    await db
      .update(projects)
      .set({ status: "done" })
      .where(eq(projects.id, projectId))

    renderLog("job", "render job complete", { jobId, projectId, elapsedMs: Date.now() - jobStart, outputUrl })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    renderError("job", `render job failed — jobId="${jobId}", projectId="${projectId}"`, err)

    try {
      await db
        .update(renderJobs)
        .set({ status: "failed", error: message, completedAt: new Date() })
        .where(eq(renderJobs.id, jobId))

      await db
        .update(projects)
        .set({ status: "failed" })
        .where(eq(projects.id, projectId))
    } catch (dbErr) {
      renderError("job", `failed to write error status to DB — jobId="${jobId}"`, dbErr)
    }

    throw err
  }
}
