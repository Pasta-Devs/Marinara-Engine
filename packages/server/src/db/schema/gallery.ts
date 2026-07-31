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
  /** Custom emoji/sticker tag: "emoji" | "sticker", or null when untagged */
  customKind: text("custom_kind"),
  /** Slugified custom emoji/sticker name, or null when untagged */
  customName: text("custom_name"),
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
  /** Custom emoji/sticker tag: "emoji" | "sticker", or null when untagged */
  customKind: text("custom_kind"),
  /** Slugified custom emoji/sticker name, or null when untagged */
  customName: text("custom_name"),
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
  /** Custom emoji/sticker tag: "emoji" | "sticker", or null when untagged */
  customKind: text("custom_kind"),
  /** Slugified custom emoji/sticker name, or null when untagged */
  customName: text("custom_name"),
  createdAt: text("created_at").notNull(),
});
