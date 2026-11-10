// ──────────────────────────────────────────────
// Schema: Characters, Personas & Character Groups
// ──────────────────────────────────────────────
import { fileTable, text } from "../file-schema.js";

export const characters = fileTable("characters", {
  id: text("id").primaryKey(),
  /** Full CharacterData V2 as JSON */
  data: text("data").notNull(),
  /** User-only note shown under the character name for disambiguation */
  comment: text("comment").notNull().default(""),
  avatarPath: text("avatar_path"),
  spriteFolderPath: text("sprite_folder_path"),
  /** Pre-computed semantic embedding (JSON float[]), null until vectorized (#4768) */
  embedding: text("embedding"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const characterCardVersions = fileTable("character_card_versions", {
  id: text("id").primaryKey(),
  characterId: text("character_id")
    .notNull()
    .references(() => characters.id, { onDelete: "cascade" }),
  /** Full CharacterData V2 snapshot as JSON */
  data: text("data").notNull(),
  /** Snapshot of the user-only comment/title at the time of the version */
  comment: text("comment").notNull().default(""),
  avatarPath: text("avatar_path"),
  /** Human-visible card version string from data.character_version */
  version: text("version").notNull().default(""),
  /** What created this snapshot: manual, agent, command, restore, etc. */
  source: text("source").notNull().default("manual"),
  reason: text("reason").notNull().default(""),
  createdAt: text("created_at").notNull(),
});

/**
 * Storage-only Persona representation, shaped like `characters`: the authored
 * card lives in `data` as CharacterData JSON (`cardFromPersona`), and only
 * record metadata stays in columns. Storage methods rebuild the flat
 * serialized view (`PersonaStorageRow`) through
 * `services/personas/persona-card-storage.ts`; do not read `data` directly.
 * Public API responses must pass through `projectPersona()` in
 * `services/personas/persona-projector.ts`.
 */
export const personas = fileTable("personas", {
  id: text("id").primaryKey(),
  /** Authored persona card as CharacterData JSON (storage format 11+). */
  data: text("data").notNull(),
  /** Short comment shown under the name (for disambiguation) */
  comment: text("comment").notNull().default(""),
  avatarPath: text("avatar_path"),
  isActive: text("is_active").notNull().default("false"),
  /** Pre-computed semantic embedding (JSON float[]), null until vectorized (#4768) */
  embedding: text("embedding"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const personaCardVersions = fileTable("persona_card_versions", {
  id: text("id").primaryKey(),
  personaId: text("persona_id")
    .notNull()
    .references(() => personas.id, { onDelete: "cascade" }),
  /** Full persona card snapshot as JSON */
  data: text("data").notNull(),
  /** Snapshot of the user-only comment/title at the time of the version */
  comment: text("comment").notNull().default(""),
  avatarPath: text("avatar_path"),
  /** Human-visible card version string from persona_version */
  version: text("version").notNull().default(""),
  /** What created this snapshot: manual, agent, command, restore, etc. */
  source: text("source").notNull().default("manual"),
  reason: text("reason").notNull().default(""),
  createdAt: text("created_at").notNull(),
});

export const characterGroups = fileTable("character_groups", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  avatarPath: text("avatar_path"),
  /** JSON array of character IDs */
  characterIds: text("character_ids").notNull().default("[]"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const personaGroups = fileTable("persona_groups", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  /** JSON array of persona IDs */
  personaIds: text("persona_ids").notNull().default("[]"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});
