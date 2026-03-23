import {
  pgTable,
  uuid,
  text,
  integer,
  jsonb,
  timestamp,
  index,
} from "drizzle-orm/pg-core"
import { relations } from "drizzle-orm"
import type { VideoConfig } from "@repo/types"

// projects

export const projects = pgTable(
  "projects",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id").notNull(),
    title: text("title").notNull(),
    status: text("status", {
      enum: ["draft", "generating", "ready", "rendering", "done", "failed"],
    })
      .notNull()
      .default("draft"),
    topic: text("topic"),
    sourceUrl: text("source_url"),
    aspectRatio: text("aspect_ratio", {
      enum: ["9:16", "16:9", "1:1", "4:5"],
    })
      .notNull()
      .default("9:16"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [index("projects_user_id_idx").on(t.userId)]
)

// video_configs

export const videoConfigs = pgTable("video_configs", {
  id: uuid("id").defaultRandom().primaryKey(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  config: jsonb("config").$type<VideoConfig>().notNull(),
  version: integer("version").notNull().default(1),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
})

// research_reports

export const researchReports = pgTable("research_reports", {
  id: uuid("id").defaultRandom().primaryKey(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  topic: text("topic"),
  sourceUrl: text("source_url"),
  content: text("content").notNull(),
  summary: text("summary"),
  keyFacts: jsonb("key_facts").$type<string[]>(),
  sources: jsonb("sources").$type<{ url: string; title: string }[]>(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
})

// audio_files

export const audioFiles = pgTable("audio_files", {
  id: uuid("id").defaultRandom().primaryKey(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  sceneId: text("scene_id").notNull(),
  type: text("type", { enum: ["narration", "sound_effect"] }).notNull(),
  r2Key: text("r2_key").notNull(),
  publicUrl: text("public_url").notNull(),
  durationMs: integer("duration_ms"),
  durationInFrames: integer("duration_in_frames"),
  voiceId: text("voice_id"),
  textHash: text("text_hash"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
})

// chat_messages

export const chatMessages = pgTable("chat_messages", {
  id: uuid("id").defaultRandom().primaryKey(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  role: text("role", { enum: ["user", "assistant"] }).notNull(),
  parts: jsonb("parts").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
})

// render_jobs

export const renderJobs = pgTable("render_jobs", {
  id: uuid("id").defaultRandom().primaryKey(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  status: text("status", {
    enum: ["queued", "bundling", "rendering", "uploading", "done", "failed"],
  })
    .notNull()
    .default("queued"),
  progress: integer("progress").notNull().default(0),
  stage: text("stage"),
  outputUrl: text("output_url"),
  r2Key: text("r2_key"),
  error: text("error"),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
})

// relations

export const projectsRelations = relations(projects, ({ many }) => ({
  videoConfigs: many(videoConfigs),
  researchReports: many(researchReports),
  audioFiles: many(audioFiles),
  chatMessages: many(chatMessages),
  renderJobs: many(renderJobs),
}))

export const videoConfigsRelations = relations(videoConfigs, ({ one }) => ({
  project: one(projects, {
    fields: [videoConfigs.projectId],
    references: [projects.id],
  }),
}))

export const researchReportsRelations = relations(
  researchReports,
  ({ one }) => ({
    project: one(projects, {
      fields: [researchReports.projectId],
      references: [projects.id],
    }),
  })
)

export const audioFilesRelations = relations(audioFiles, ({ one }) => ({
  project: one(projects, {
    fields: [audioFiles.projectId],
    references: [projects.id],
  }),
}))

export const chatMessagesRelations = relations(chatMessages, ({ one }) => ({
  project: one(projects, {
    fields: [chatMessages.projectId],
    references: [projects.id],
  }),
}))

export const renderJobsRelations = relations(renderJobs, ({ one }) => ({
  project: one(projects, {
    fields: [renderJobs.projectId],
    references: [projects.id],
  }),
}))
