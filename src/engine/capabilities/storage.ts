export type StorageEntity =
  | "agents"
  | "app-settings"
  | "backgrounds"
  | "characters"
  | "character-groups"
  | "character-gallery"
  | "chat-folders"
  | "chat-presets"
  | "chats"
  | "connections"
  | "connection-folders"
  | "custom-tools"
  | "extensions"
  | "gallery"
  | "game-assets"
  | "game-checkpoints"
  | "game-state"
  | "game-state-snapshots"
  | "knowledge-sources"
  | "agent-memory"
  | "agent-runs"
  | "character-versions"
  | "lorebook-entries"
  | "lorebook-folders"
  | "lorebooks"
  | "messages"
  | "personas"
  | "persona-groups"
  | "prompt-groups"
  | "prompt-overrides"
  | "prompt-sections"
  | "prompt-variables"
  | "prompts"
  | "regex-scripts"
  | "themes";

export interface StorageListOptions {
  filters?: Record<string, unknown>;
  orderBy?: string;
  descending?: boolean;
  limit?: number;
  before?: string;
  fields?: string[];
  fieldSelections?: Record<string, string[]>;
  search?: string;
}

export interface AddChatMessageSwipeOptions {
  extra?: Record<string, unknown>;
  activate?: boolean;
}

export interface StorageGateway {
  list<T = unknown>(entity: StorageEntity | string, options?: StorageListOptions): Promise<T[]>;
  get<T = unknown>(
    entity: StorageEntity | string,
    id: string,
    options?: Pick<StorageListOptions, "fields" | "fieldSelections">,
  ): Promise<T | null>;
  create<T = unknown>(entity: StorageEntity | string, value: Record<string, unknown>): Promise<T>;
  update<T = unknown>(entity: StorageEntity | string, id: string, patch: Record<string, unknown>): Promise<T>;
  delete(entity: StorageEntity | string, id: string): Promise<{ deleted: boolean }>;
  listChatMessages<T = unknown>(chatId: string, options?: Omit<StorageListOptions, "filters">): Promise<T[]>;
  createChatMessage<T = unknown>(chatId: string, value: Record<string, unknown>): Promise<T>;
  updateChatMessage<T = unknown>(messageId: string, patch: Record<string, unknown>): Promise<T>;
  updateChatMessageContentIfUnchanged?<T = unknown>(
    chatId: string,
    messageId: string,
    expectedContent: string,
    content: string,
  ): Promise<{ updated: boolean; message?: T }>;
  deleteChatMessage(messageId: string): Promise<{ deleted: boolean }>;
  patchChatMessageExtra<T = unknown>(messageId: string, patch: Record<string, unknown>): Promise<T>;
  /**
   * Evict saved generation prompt snapshots from older assistant messages,
   * keeping only the most recent `keepLast` (default 2, matching v1.6.1). Bounds
   * per-chat storage growth; non-destructive to other message data. Optional so
   * lightweight/mock gateways need not implement it.
   */
  evictPromptSnapshots?(chatId: string, keepLast?: number): Promise<{ evicted: number }>;
  addChatMessageSwipe<T = unknown>(
    chatId: string,
    messageId: string,
    content: string,
    options?: AddChatMessageSwipeOptions,
  ): Promise<T>;
  patchChatMetadata<T = unknown>(chatId: string, patch: Record<string, unknown>): Promise<T>;
  patchChatSummaries<T = unknown>(chatId: string, patch: Record<string, unknown>): Promise<T>;
  listChatMemories<T = unknown>(chatId: string): Promise<T[]>;
  getWorldState<T = unknown>(chatId: string): Promise<T | null>;
  saveTrackerSnapshot<T = unknown>(chatId: string, snapshot: Record<string, unknown>): Promise<T>;
  listLorebookEntries<T = unknown>(lorebookId: string): Promise<T[]>;
  createLorebookEntries<T = unknown>(lorebookId: string, entries: Array<Record<string, unknown>>): Promise<T[]>;
  knowledgeSourceText?<T = unknown>(id: string): Promise<T | null>;
  promptFull<T = unknown>(presetId: string): Promise<T | null>;
}
