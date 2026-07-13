// ──────────────────────────────────────────────
// Schema: HumanOS v2 Private Architecture
// ──────────────────────────────────────────────
// This table is deliberately absent from prompt assembly. It stores private
// authoring/provenance data for a character or user persona.
import { sqliteTable, text, integer, uniqueIndex } from "drizzle-orm/sqlite-core";

export const humanosArchitectures = sqliteTable(
  "humanos_architectures",
  {
    id: text("id").primaryKey(),
    subjectType: text("subject_type", { enum: ["CHARACTER", "USER_PERSONA"] }).notNull(),
    subjectId: text("subject_id").notNull(),
    schemaVersion: integer("schema_version").notNull().default(2),
    /** JSON-serialized HumanOS private architecture. */
    architecture: text("architecture").notNull(),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [uniqueIndex("idx_humanos_architectures_subject").on(table.subjectType, table.subjectId)],
);
