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
 * Storage-only Persona representation. JSON-backed fields and booleans remain
 * serialized text intentionally; do not cast these rows to the shared Persona
 * type. Public API responses must pass through `projectPersona()` in
 * `services/personas/persona-projector.ts`.
 */
export const personas = fileTable("personas", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  /** Short comment shown under the name (for disambiguation) */
  comment: text("comment").notNull().default(""),
  /** Creator/author of this persona card */
  creator: text("creator").notNull().default(""),
  /** Human-visible persona card version string */
  personaVersion: text("persona_version").notNull().default("1.0"),
  /** Whether edits retain snapshots and automatically advance the card version. */
  versioningEnabled: text("versioning_enabled").notNull().default("true"),
  /** Private notes about intended use, quirks, or recommended settings */
  creatorNotes: text("creator_notes").notNull().default(""),
  /** Pronunciation override used when sending this persona name to TTS */
  phoneticName: text("phonetic_name").notNull().default(""),
  description: text("description").notNull().default(""),
  personality: text("personality").notNull().default(""),
  scenario: text("scenario").notNull().default(""),
  backstory: text("backstory").notNull().default(""),
  appearance: text("appearance").notNull().default(""),
  avatarPath: text("avatar_path"),
  /** Persona gallery image selected as the optional visual identity sheet. */
  characterSheetImageId: text("character_sheet_image_id"),
  /** Whether image generation should prefer the selected sheet over the avatar. */
  useCharacterSheetAsReference: text("use_character_sheet_as_reference").notNull().default("false"),
  /** Avatar zoom/position settings (JSON of { zoom, offsetX, offsetY, fullImage? }). Empty string = unset. */
  avatarCrop: text("avatar_crop").notNull().default(""),
  isActive: text("is_active").notNull().default("false"),
  /** Name display color/gradient (CSS value) */
  nameColor: text("name_color").notNull().default(""),
  /** Dialogue highlight color */
  dialogueColor: text("dialogue_color").notNull().default(""),
  /** Chat bubble background color */
  boxColor: text("box_color").notNull().default(""),
  /** Tracker card color source + optional custom palette (JSON) */
  trackerCardColors: text("tracker_card_colors").notNull().default('{"mode":"chat"}'),
  /** Persona stats config (JSON) */
  personaStats: text("persona_stats").notNull().default(""),
  /** Tags for organizing personas (JSON array of strings) */
  tags: text("tags").notNull().default("[]"),
  /** Saved Conversation mode activity/status text options (JSON array of strings) */
  savedStatusOptions: text("saved_status_options").notNull().default("[]"),
  /** Conversation mode ONLY: display name shown in Convo (empty = fall back to name) */
  convoDisplayName: text("convo_display_name").notNull().default(""),
  /** Conversation mode ONLY: public "about me" profile (cross-chat default) */
  aboutMe: text("about_me").notNull().default(""),
  /** Conversation mode ONLY: behavior directive + insertion strategy (JSON, empty = unset) */
  convoBehavior: text("convo_behavior").notNull().default(""),
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
