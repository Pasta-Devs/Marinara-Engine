const GENERIC_STORAGE_ENTITIES = [
  "characters",
  "character-groups",
  "character-versions",
  "personas",
  "persona-groups",
  "lorebooks",
  "lorebook-entries",
  "lorebook-folders",
  "prompts",
  "prompt-groups",
  "prompt-sections",
  "prompt-variables",
  "prompt-overrides",
  "chat-presets",
  "agents",
  "agent-runs",
  "agent-memory",
  "themes",
  "extensions",
  "connections",
  "connection-folders",
  "chats",
  "chat-folders",
  "messages",
  "custom-tools",
  "regex-scripts",
  "app-settings",
  "gallery",
  "character-gallery",
  "background-metadata",
  "sprites",
  "knowledge-sources",
  "game-state-snapshots",
  "game-checkpoints",
] as const;

export type StorageEntity = (typeof GENERIC_STORAGE_ENTITIES)[number];

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
  characterId?: string | null;
}

export interface StorageGateway {
  list<T = unknown>(entity: StorageEntity, options?: StorageListOptions): Promise<T[]>;
  get<T = unknown>(
    entity: StorageEntity,
    id: string,
    options?: Pick<StorageListOptions, "fields" | "fieldSelections">,
  ): Promise<T | null>;
  create<T = unknown>(entity: StorageEntity, value: Record<string, unknown>): Promise<T>;
  update<T = unknown>(entity: StorageEntity, id: string, patch: Record<string, unknown>): Promise<T>;
  delete(entity: StorageEntity, id: string): Promise<{ deleted: boolean }>;
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
  refreshChatMemories?<T = unknown>(chatId: string): Promise<T>;
  getWorldState<T = unknown>(chatId: string): Promise<T | null>;
  saveTrackerSnapshot<T = unknown>(chatId: string, snapshot: Record<string, unknown>): Promise<T>;
  listLorebookEntries<T = unknown>(lorebookId: string): Promise<T[]>;
  createLorebookEntries<T = unknown>(lorebookId: string, entries: Array<Record<string, unknown>>): Promise<T[]>;
  knowledgeSourceText?<T = unknown>(id: string): Promise<T | null>;
  promptFull<T = unknown>(presetId: string): Promise<T | null>;
}
