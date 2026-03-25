import path from "path"
import { fileURLToPath } from "url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Produce a self-contained output for Docker / non-Vercel deployments.
  // Remove this line if you ever move back to Vercel (it still works there
  // but the standalone folder is redundant on Vercel's platform).
  output: "standalone",

  // Tell Next.js that the workspace root (two levels up) is where shared
  // node_modules live so the standalone bundle traces them correctly.
  outputFileTracingRoot: path.join(__dirname, "../../"),
}

export default nextConfig
