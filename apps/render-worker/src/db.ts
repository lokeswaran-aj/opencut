import { drizzle } from "drizzle-orm/postgres-js"
import postgres from "postgres"
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

const client = postgres(process.env.DATABASE_URL!, {
  max: 5,
  idle_timeout: 20,
  connect_timeout: 10,
  ssl: "require",
})

export const db = drizzle(client, { casing: "snake_case" })
