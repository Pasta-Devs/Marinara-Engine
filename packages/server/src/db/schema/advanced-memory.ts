import { fileTable, integer, text, vectorText } from "../file-schema.js";
import { chats } from "./chats.js";

/** Managed memory is separate from native transcript chunks and their pruning cursor. */
export const advancedMemoryRecords = fileTable("advanced_memory_records", {
  id: text("id").primaryKey(),
  chatId: text("chat_id")
    .notNull()
    .references(() => chats.id, { onDelete: "cascade" }),
  sceneId: text("scene_id").notNull(),
  kind: text("kind").notNull(),
  status: text("status").notNull(),
  startMessageId: text("start_message_id").notNull(),
  endMessageId: text("end_message_id").notNull(),
  messageIds: text("message_ids").notNull(),
  audienceCharacterIds: text("audience_character_ids").notNull(),
  content: text("content").notNull(),
  title: text("title").notNull(),
  timeline: text("timeline"),
  enabled: integer("enabled").notNull().default(1),
  manualOverride: integer("manual_override").notNull().default(0),
  sourceFingerprint: text("source_fingerprint").notNull(),
  dependencies: text("dependencies").notNull().default("[]"),
  // Internal resumable split/combine responses; omitted from public records and transfers.
  summaryWork: text("summary_work"),
  embedding: vectorText("embedding"),
  embeddingSpaceId: text("embedding_space_id"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});
