// ──────────────────────────────────────────────
// Schema: Chat Gallery Images
// ──────────────────────────────────────────────
import { fileTable, text, integer } from "../file-schema.js";
import { chats } from "./chats.js";
import { characters, personas } from "./characters.js";

export const chatImages = fileTable("chat_images", {
  id: text("id").primaryKey(),
  chatId: text("chat_id")
    .notNull()
    .references(() => chats.id, { onDelete: "cascade" }),
  /** File path relative to data/gallery/ */
  filePath: text("file_path").notNull(),
  /** The prompt used to generate this image */
  prompt: text("prompt").notNull().default(""),
  /** Which provider/service generated this image */
  provider: text("provider").notNull().default(""),
  /** Which model/service was used */
  model: text("model").notNull().default(""),
  /** Image width in pixels */
  width: integer("width"),
  /** Image height in pixels */
  height: integer("height"),
  /** JSON ChatImageGenerationRecord: the request this image was rendered from, for regeneration. Null on older rows. */
  generation: text("generation"),
  /** Stable version-stack identity; null on standalone and legacy pictures. */
  variantGroupId: text("variant_group_id"),
  /** One selected version per chat-scoped stack. */
  variantSelected: integer("variant_selected").notNull().default(0),
  /** Gallery label: "emoji" | "sticker" | "background", or null. Carried over when the picture is assigned to a character or persona. */
  customKind: text("custom_kind"),
  /** Emoji/sticker slug, or a background's place names. */
  customName: text("custom_name"),
  /** What the picture shows, written by hand or by the Image reading model. Null when none. */
  description: text("description"),
  createdAt: text("created_at").notNull(),
});

export const characterImages = fileTable("character_images", {
  id: text("id").primaryKey(),
  characterId: text("character_id")
    .notNull()
    .references(() => characters.id, { onDelete: "cascade" }),
  /** Originating chat-gallery row for generated references. Informational: deleting a chat keeps entity galleries. */
  sourceChatImageId: text("source_chat_image_id"),
  /** File path relative to data/gallery/ */
  filePath: text("file_path").notNull(),
  /** Owner-local stack and selection, independent of the source chat. */
  variantGroupId: text("variant_group_id"),
  variantSelected: integer("variant_selected").notNull().default(0),
  /** Chat history reconciliation is independent of owner-local selection and editing. */
  variantHistoryRecovered: integer("variant_history_recovered").notNull().default(0),
  /** Independent regeneration request; retained when the source chat is deleted. */
  generation: text("generation"),
  /** Optional prompt or note associated with this image */
  prompt: text("prompt").notNull().default(""),
  /** Which provider/service generated this image */
  provider: text("provider").notNull().default(""),
  /** Which model/service was used */
  model: text("model").notNull().default(""),
  /** Image width in pixels */
  width: integer("width"),
  /** Image height in pixels */
  height: integer("height"),
  /** Gallery label: "emoji" | "sticker" | "background" (characters and personas), or null when untagged */
  customKind: text("custom_kind"),
  /** Slugified custom emoji/sticker name, a background's place names, or null when untagged */
  customName: text("custom_name"),
  /** What the picture shows, written by hand or by the Image reading model. Null when none. */
  description: text("description"),
  createdAt: text("created_at").notNull(),
});

export const personaImages = fileTable("persona_images", {
  id: text("id").primaryKey(),
  personaId: text("persona_id")
    .notNull()
    .references(() => personas.id, { onDelete: "cascade" }),
  /** Originating chat-gallery row for generated references. Informational: deleting a chat keeps entity galleries. */
  sourceChatImageId: text("source_chat_image_id"),
  /** File path relative to data/gallery/ */
  filePath: text("file_path").notNull(),
  /** Owner-local stack and selection, independent of the source chat. */
  variantGroupId: text("variant_group_id"),
  variantSelected: integer("variant_selected").notNull().default(0),
  /** Chat history reconciliation is independent of owner-local selection and editing. */
  variantHistoryRecovered: integer("variant_history_recovered").notNull().default(0),
  /** Independent regeneration request; retained when the source chat is deleted. */
  generation: text("generation"),
  /** Optional prompt or note associated with this image */
  prompt: text("prompt").notNull().default(""),
  /** Which provider/service generated this image */
  provider: text("provider").notNull().default(""),
  /** Which model/service was used */
  model: text("model").notNull().default(""),
  /** Image width in pixels */
  width: integer("width"),
  /** Image height in pixels */
  height: integer("height"),
  /** Gallery label: "emoji" | "sticker" | "background" (characters and personas), or null when untagged */
  customKind: text("custom_kind"),
  /** Slugified custom emoji/sticker name, a background's place names, or null when untagged */
  customName: text("custom_name"),
  /** What the picture shows, written by hand or by the Image reading model. Null when none. */
  description: text("description"),
  createdAt: text("created_at").notNull(),
});

// ──────────────────────────────────────────────
// Schema: Global Gallery (profile-wide images + flat folders)
// ──────────────────────────────────────────────

export const galleryFolders = fileTable("gallery_folders", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  createdAt: text("created_at").notNull(),
});

export const globalImages = fileTable("global_images", {
  id: text("id").primaryKey(),
  /** Owning folder; null = root / "Unfiled". Set null when the folder is deleted. */
  folderId: text("folder_id").references(() => galleryFolders.id, { onDelete: "set null" }),
  /** File path relative to data/gallery/ */
  filePath: text("file_path").notNull(),
  /** Optional prompt or note associated with this image */
  prompt: text("prompt").notNull().default(""),
  /** Which provider/service generated this image */
  provider: text("provider").notNull().default(""),
  /** Which model/service was used */
  model: text("model").notNull().default(""),
  /** Image width in pixels */
  width: integer("width"),
  /** Image height in pixels */
  height: integer("height"),
  /** Gallery label: "emoji" | "sticker" | "background" (characters and personas), or null when untagged */
  customKind: text("custom_kind"),
  /** Slugified custom emoji/sticker name, a background's place names, or null when untagged */
  customName: text("custom_name"),
  /** What the picture shows, written by hand or by the Image reading model. Null when none. */
  description: text("description"),
  createdAt: text("created_at").notNull(),
});
