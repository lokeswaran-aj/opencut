import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3"
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"

// Cloudflare R2 is S3-compatible. The endpoint is account-scoped.
export const r2 = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.CLOUDFLARE_R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY!,
  },
})

const BUCKET = process.env.CLOUDFLARE_R2_BUCKET_NAME!

/**
 * Upload a file to R2 and return its public URL.
 *
 * If CLOUDFLARE_R2_PUBLIC_URL is set (a public bucket or custom domain),
 * the URL is constructed directly — no presigning needed and the URL never
 * expires. This is the recommended path for audio files served to Remotion.
 *
 * If CLOUDFLARE_R2_PUBLIC_URL is not set, a 1-hour presigned URL is returned
 * as a fallback (useful for private buckets during development).
 */
export async function uploadToR2(
  key: string,
  body: Buffer | Uint8Array,
  contentType: string
): Promise<{ r2Key: string; publicUrl: string }> {
  await r2.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: body,
      ContentType: contentType,
    })
  )

  const publicUrl = process.env.CLOUDFLARE_R2_PUBLIC_URL
    ? `${process.env.CLOUDFLARE_R2_PUBLIC_URL}/${key}`
    : await getPresignedUrl(key)

  return { r2Key: key, publicUrl }
}

/**
 * Generate a time-limited presigned GET URL for a private R2 object.
 * Default expiry: 1 hour. Use this when the bucket is not publicly accessible.
 */
export async function getPresignedUrl(key: string, expiresIn = 3600): Promise<string> {
  return getSignedUrl(
    r2,
    new GetObjectCommand({ Bucket: BUCKET, Key: key }),
    { expiresIn }
  )
}

/**
 * Delete an object from R2. Used when a project is deleted.
 */
export async function deleteFromR2(key: string): Promise<void> {
  await r2.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }))
}

/**
 * Build a deterministic R2 key for an audio segment.
 * Format: audio/<projectId>/<sceneId>/<type>-<hash>.mp3
 */
export function audioKey(
  projectId: string,
  sceneId: string,
  type: "narration" | "sound_effect",
  hash: string
): string {
  return `audio/${projectId}/${sceneId}/${type}-${hash}.mp3`
}

/**
 * Build a deterministic R2 key for a rendered video export.
 * Format: renders/<projectId>/<jobId>.mp4
 */
export function renderKey(projectId: string, jobId: string): string {
  return `renders/${projectId}/${jobId}.mp4`
}
