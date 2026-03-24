import { neon } from "@neondatabase/serverless"
import { drizzle } from "drizzle-orm/neon-http"
import {
  pgTable,
  uuid,
  text,
  integer,
  jsonb,
  timestamp,
} from "drizzle-orm/pg-core"
import type { VideoConfig } from "@repo/types"

// Minimal schema — only the tables the render worker reads/writes

export const projects = pgTable("projects", {
  id: uuid("id").primaryKey(),
  userId: text("user_id").notNull(),
  status: text("status").notNull().default("draft"),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
})

export const videoConfigs = pgTable("video_configs", {
  id: uuid("id").primaryKey(),
  projectId: uuid("project_id").notNull(),
  config: jsonb("config").$type<VideoConfig>().notNull(),
  version: integer("version").notNull().default(1),
  createdAt: timestamp("created_at").notNull().defaultNow(),
})

export const renderJobs = pgTable("render_jobs", {
  id: uuid("id").primaryKey(),
  projectId: uuid("project_id").notNull(),
  status: text("status").notNull().default("queued"),
  progress: integer("progress").notNull().default(0),
  stage: text("stage"),
  outputUrl: text("output_url"),
  r2Key: text("r2_key"),
  error: text("error"),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
})

// Uses Neon's HTTP transport (HTTPS port 443) instead of raw TCP port 5432.
// This avoids firewall issues and works in any container environment.
const sql = neon(process.env.DATABASE_URL!)

export const db = drizzle(sql, { casing: "snake_case" })
