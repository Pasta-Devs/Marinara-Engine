import { fileTable, integer, text } from "../file-schema.js";

export const entitySummaryBatches = fileTable("entity_summary_batches", {
  id: text("id").primaryKey(),
  status: text("status", { enum: ["queued", "running", "completed", "cancelled"] }).notNull(),
  cancelRequested: text("cancel_requested").notNull().default("false"),
  timeoutMs: integer("timeout_ms").notNull(),
  debugMode: text("debug_mode").notNull().default("false"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
  completedAt: text("completed_at"),
});

export const entitySummaryBatchItems = fileTable("entity_summary_batch_items", {
  id: text("id").primaryKey(),
  batchId: text("batch_id")
    .notNull()
    .references(() => entitySummaryBatches.id, { onDelete: "cascade" }),
  kind: text("kind", { enum: ["character", "persona", "lorebook"] }).notNull(),
  entityId: text("entity_id").notNull(),
  status: text("status", {
    enum: ["queued", "running", "candidate", "failed", "cancelled", "applied", "stale"],
  }).notNull(),
  attempts: integer("attempts").notNull().default(0),
  sourceHash: text("source_hash"),
  sourceSummaryHash: text("source_summary_hash"),
  candidateSummary: text("candidate_summary"),
  error: text("error"),
  connectionId: text("connection_id"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});
