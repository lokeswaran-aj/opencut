import { neon } from "@neondatabase/serverless";
import { drizzle as neonDrizzle } from "drizzle-orm/neon-http";
import postgres from "postgres";
import { drizzle as pgDrizzle } from "drizzle-orm/postgres-js";
import {
  pgTable,
  uuid,
  text,
  integer,
  jsonb,
  timestamp,
} from "drizzle-orm/pg-core";
import type { VideoConfig } from "@repo/types";

export const projects = pgTable("projects", {
  id: uuid("id").primaryKey(),
  userId: text("user_id").notNull(),
  status: text("status").notNull().default("draft"),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const videoConfigs = pgTable("video_configs", {
  id: uuid("id").primaryKey(),
  projectId: uuid("project_id").notNull(),
  config: jsonb("config").$type<VideoConfig>().notNull(),
  version: integer("version").notNull().default(1),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

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
});

const url = process.env.DATABASE_URL!;

export const db = url.includes("neon.tech")
  ? neonDrizzle(neon(url), { casing: "snake_case" })
  : pgDrizzle(postgres(url), { casing: "snake_case" });
