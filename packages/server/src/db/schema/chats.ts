// ──────────────────────────────────────────────
// Schema: Chats, Messages & Folders
// ──────────────────────────────────────────────
import { fileTable, text, integer } from "../file-schema.js";

export const chatFolders = fileTable("chat_folders", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  mode: text("mode", { enum: ["conversation", "roleplay", "game"] }).notNull(),
  color: text("color").notNull().default(""),
  sortOrder: integer("sort_order").notNull().default(0),
  collapsed: text("collapsed").notNull().default("false"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const chats = fileTable("chats", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  mode: text("mode", { enum: ["conversation", "roleplay", "game"] }).notNull(),
  /** JSON array of character IDs */
  characterIds: text("character_ids").notNull().default("[]"),
  /** Groups related chats together (like ST "chat files" per character) */
  groupId: text("group_id"),
  personaId: text("persona_id"),
  promptPresetId: text("prompt_preset_id"),
  connectionId: text("connection_id"),
  /** JSON object for metadata */
  metadata: text("metadata").notNull().default("{}"),
  /** ID of a linked chat (conversation ↔ roleplay bidirectional link) */
  connectedChatId: text("connected_chat_id"),
  /** Folder this chat belongs to (null = root/unfiled) */
  folderId: text("folder_id"),
  /** Manual sort order within a folder (lower = higher). 0 = use default updatedAt sort. */
  sortOrder: integer("sort_order").notNull().default(0),
  /** Timestamp of the newest saved message; null until the chat has messages. */
  lastMessageAt: text("last_message_at"),
  /** Pre-computed semantic embedding of the chat's name/tags/summary (JSON float[]), null until vectorized (#4768) */
  embedding: text("embedding"),
  /**
   * High-water mark of the chat's monotonic write ordinal (#5406). Every ordinal handed to a
   * game_engine_state row (`write_ordinal`) or to the metadata mirror
   * (`metadata.metadataWriteOrdinals`) is allocated by bumping this one counter, so a client
   * holding a value from either store can totally order the two. Null until the chat's first
   * allocation.
   *
   * Not the sole floor: a metadata blob can be moved into a chat whose counter never handed its
   * stamps out (branching, a game session carry, a restore), so allocation takes the max of this
   * counter and the chat's own mirror. See `writeOrdinalFloor` / `allocateWriteOrdinal` in
   * chats.storage.ts for the monotonicity argument.
   */
  writeOrdinalCounter: integer("write_ordinal_counter"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const messages = fileTable("messages", {
  id: text("id").primaryKey(),
  chatId: text("chat_id")
    .notNull()
    .references(() => chats.id, { onDelete: "cascade" }),
  role: text("role", { enum: ["user", "assistant", "system", "narrator"] }).notNull(),
  characterId: text("character_id"),
  content: text("content").notNull().default(""),
  activeSwipeIndex: integer("active_swipe_index").notNull().default(0),
  /** JSON object for extra data */
  extra: text("extra").notNull().default("{}"),
  createdAt: text("created_at").notNull(),
});

export const messageSwipes = fileTable("message_swipes", {
  id: text("id").primaryKey(),
  messageId: text("message_id")
    .notNull()
    .references(() => messages.id, { onDelete: "cascade" }),
  index: integer("index").notNull(),
  content: text("content").notNull().default(""),
  /** JSON object for extra data */
  extra: text("extra").notNull().default("{}"),
  createdAt: text("created_at").notNull(),
});

export const oocInfluences = fileTable("ooc_influences", {
  id: text("id").primaryKey(),
  /** The conversation chat that created this influence */
  sourceChatId: text("source_chat_id")
    .notNull()
    .references(() => chats.id, { onDelete: "cascade" }),
  /** The roleplay chat where this influence will be injected */
  targetChatId: text("target_chat_id")
    .notNull()
    .references(() => chats.id, { onDelete: "cascade" }),
  /** The OOC text to inject */
  content: text("content").notNull(),
  /** The user message in the RP that this influence attaches to (persists through swipes) */
  anchorMessageId: text("anchor_message_id"),
  /** Whether this influence has been used in a generation */
  consumed: text("consumed").notNull().default("false"),
  createdAt: text("created_at").notNull(),
});

export const conversationNotes = fileTable("conversation_notes", {
  id: text("id").primaryKey(),
  /** The conversation chat that emitted this note */
  sourceChatId: text("source_chat_id")
    .notNull()
    .references(() => chats.id, { onDelete: "cascade" }),
  /** The roleplay chat where this note will be durably injected */
  targetChatId: text("target_chat_id")
    .notNull()
    .references(() => chats.id, { onDelete: "cascade" }),
  /** The note text to inject on every roleplay turn until cleared */
  content: text("content").notNull(),
  /** The conversation message that produced this note (for traceability) */
  anchorMessageId: text("anchor_message_id"),
  createdAt: text("created_at").notNull(),
});

// ── Memory Chunks: embedded conversation fragments for semantic recall ──
export const memoryChunks = fileTable("memory_chunks", {
  id: text("id").primaryKey(),
  chatId: text("chat_id")
    .notNull()
    .references(() => chats.id, { onDelete: "cascade" }),
  /** Formatted conversation text: "Name: message\n\nName: message\n\n..." */
  content: text("content").notNull(),
  /** JSON-serialized float[] embedding (null until vectorized) */
  embedding: text("embedding"),
  /** Stable provider/model/profile identity for the stored embedding */
  embeddingSpaceId: text("embedding_space_id"),
  /** How many messages were grouped into this chunk */
  messageCount: integer("message_count").notNull(),
  /** Non-null for imported chunks; they should not advance local chunk cursors. */
  sourceChatId: text("source_chat_id"),
  /** ISO timestamp of the first message in this chunk */
  firstMessageAt: text("first_message_at").notNull(),
  /** ISO timestamp of the last message in this chunk */
  lastMessageAt: text("last_message_at").notNull(),
  createdAt: text("created_at").notNull(),
});
