// ──────────────────────────────────────────────
// Schema: Characters, Personas & Character Groups
// ──────────────────────────────────────────────
import { sqliteTable, text } from "drizzle-orm/sqlite-core";

export const characters = sqliteTable("characters", {
  id: text("id").primaryKey(),
  /** Full CharacterData V2 as JSON */
  data: text("data").notNull(),
  avatarPath: text("avatar_path"),
  spriteFolderPath: text("sprite_folder_path"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const personas = sqliteTable("personas", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  /** Short comment shown under the name (for disambiguation) */
  comment: text("comment").notNull().default(""),
  description: text("description").notNull().default(""),
  personality: text("personality").notNull().default(""),
  scenario: text("scenario").notNull().default(""),
  backstory: text("backstory").notNull().default(""),
  appearance: text("appearance").notNull().default(""),
  avatarPath: text("avatar_path"),
  isActive: text("is_active").notNull().default("false"),
  /** Name display color/gradient (CSS value) */
  nameColor: text("name_color").notNull().default(""),
  /** Dialogue highlight color */
  dialogueColor: text("dialogue_color").notNull().default(""),
  /** Chat bubble background color */
  boxColor: text("box_color").notNull().default(""),
  /** Persona stats config (JSON) */
  personaStats: text("persona_stats").notNull().default(""),
  /** Alternative descriptions (JSON array of {id, label, content, active}) */
  altDescriptions: text("alt_descriptions").notNull().default("[]"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const characterGroups = sqliteTable("character_groups", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  avatarPath: text("avatar_path"),
  /** JSON array of character IDs */
  characterIds: text("character_ids").notNull().default("[]"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});
