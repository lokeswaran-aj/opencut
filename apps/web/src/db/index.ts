import { neon } from "@neondatabase/serverless"
import { drizzle } from "drizzle-orm/neon-http"
import * as schema from "./schema"

// Uses Neon's HTTP transport — no TCP connection pool needed.
// This is safe for Vercel serverless where each invocation is short-lived.
const sql = neon(process.env.DATABASE_URL!)

export const db = drizzle(sql, { schema, casing: "snake_case" })
