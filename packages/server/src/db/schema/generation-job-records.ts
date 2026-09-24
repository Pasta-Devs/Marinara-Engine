// ──────────────────────────────────────────────
// Schema: Generation job records (feature switch generationJobTracking)
//
// One row per media generation job accepted while the generationJobTracking
// switch is on. The row is a small index over the existing generation-jobs
// store (DATA_DIR/generation-jobs), which keeps the full result payload: the
// row holds status, timestamps, a result reference and the job's structured
// log trail, never prompts, message text or connection details.
//
// Rows go with their chat (cascade) and are pruned by the tracker's retention
// pass. See docs/development/generation-jobs.md.
// ──────────────────────────────────────────────
import { fileTable, text, integer } from "../file-schema.js";
import { chats } from "./chats.js";

export const generationJobRecords = fileTable("generation_job_records", {
  /** The generation-jobs store id, so records and result files share one key. */
  id: text("id").primaryKey(),
  /** Normalized media kind: "image" | "sprite" | "video". */
  kind: text("kind").notNull(),
  /** The store's own kind string, e.g. "gallery-selfie". */
  sourceKind: text("source_kind").notNull(),
  label: text("label").notNull().default(""),
  chatId: text("chat_id").references(() => chats.id, { onDelete: "cascade" }),
  /** "accepted" | "running" | "completed" | "failed" | "cancelled" | "interrupted". */
  status: text("status").notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
  startedAt: text("started_at"),
  finishedAt: text("finished_at"),
  elapsedMs: integer("elapsed_ms"),
  /** Stable diagnostic code (ME_*), never a raw provider message. */
  errorCode: text("error_code"),
  errorId: text("error_id"),
  /** An asset path found in the result, or the store's /result route. */
  resultRef: text("result_ref"),
  /** Set once a client has surfaced a finished job to the user. */
  seenAt: text("seen_at"),
  /** Serialized GenerationJobLogEvent[]: the job's lifecycle log trail (capped). */
  trail: text("trail").notNull().default("[]"),
});
