import type { ChatMode, MessageRole } from "./chat.js";
import type { SpatialContextSnapshot, SpatialSnapshotSource } from "./spatial-context.js";

export type CapabilityRuntimeLogArgument = unknown;

export interface CapabilityRuntimeLogger {
  debug(message: string, ...args: CapabilityRuntimeLogArgument[]): void;
  info(message: string, ...args: CapabilityRuntimeLogArgument[]): void;
  warn(message: string, ...args: CapabilityRuntimeLogArgument[]): void;
  error(error: unknown, message: string, ...args: CapabilityRuntimeLogArgument[]): void;
  debugOverride(overrideEnabled: boolean, message: string, ...args: CapabilityRuntimeLogArgument[]): void;
}

export interface CapabilityChatRecord {
  id: string;
  name: string;
  mode: ChatMode;
  characterIds: string[];
  groupId: string | null;
  personaId: string | null;
  connectionId: string | null;
  metadata: unknown;
  branch: {
    title: string | null;
    parentChatId: string | null;
    parentMessageId: string | null;
    childMessageId: string | null;
  } | null;
  lastMessageAt: string | null;
  updatedAt: string;
}

export interface CapabilityCharacterRecord {
  id: string;
  data: unknown;
  comment: string;
}

export interface CapabilityPersonaRecord {
  id: string;
  data: unknown;
}

export interface CapabilityLorebookRecord {
  id: string;
  data: unknown;
  entries: unknown[];
}

export interface CapabilityLorebookEntryRecord {
  id: string;
  lorebookId: string;
  lorebookName: string;
  name: string;
  content: string;
  description: string;
}

export interface CapabilityLorebookEntrySelection {
  lorebookIds: string[];
  entryIds: string[];
  excludedLorebookIds?: string[];
  excludedSourceAgentIds?: string[];
}

// Inputs for the resource write surface. Thin, storage-agnostic shapes the server impl maps to storage.
/** Fields accepted when a package creates the player persona. */
export interface CapabilityPersonaCreateInput {
  name: string;
  description: string;
  avatarPath?: string;
  comment?: string;
  appearance?: string;
  tags?: string;
}
/** Fields a package may revise on a persona it created. The name is fixed once stored. */
export interface CapabilityPersonaUpdateInput {
  description?: string;
  comment?: string;
  appearance?: string;
  tags?: string;
}
/** Lorebook categories the host understands. Spelled out here rather than left as a free string so a
 *  wrong value is a compile error in the package instead of a silent rejection at write time. */
export type CapabilityLorebookCategory = "uncategorized" | "world" | "character" | "npc" | "spellbook";

/** Fields accepted when a package creates a lorebook to hold its own world content. */
export interface CapabilityLorebookCreateInput {
  name: string;
  description?: string;
  category?: CapabilityLorebookCategory;
  scanDepth?: number;
  tokenBudget?: number;
  personaId?: string;
  enabled?: boolean;
}
/** The retrieval knobs a package may retune on a lorebook it owns. */
export interface CapabilityLorebookUpdateInput {
  scanDepth?: number;
  tokenBudget?: number;
}
/** One lorebook entry to store. Extra keys pass through to storage; see the index signature below. */
export interface CapabilityLorebookEntryInput {
  /** Required: an entry with no name cannot be stored, so accepting one here only defers the failure. */
  name: string;
  content?: string;
  keys?: string[];
  [key: string]: unknown;
}

export interface CapabilityResourceHost {
  listCharacters(characterIds?: string[]): Promise<CapabilityCharacterRecord[]>;
  listPersonas(personaIds?: string[]): Promise<CapabilityPersonaRecord[]>;
  listLorebooks(lorebookIds?: string[]): Promise<CapabilityLorebookRecord[]>;
  listEligibleLorebookEntries(selection: CapabilityLorebookEntrySelection): Promise<CapabilityLorebookEntryRecord[]>;
  // Write surface, used by a package's setup to find-or-create the player persona and its lorebook.
  // OPTIONAL on purpose: the engine's host implements all six, but requiring them would make adding them
  // a breaking change for any other implementation of this published interface. A package feature-detects
  // (`typeof resources.createPersona === "function"`) the way it already does for `registerPromptContext`.
  createPersona?(input: CapabilityPersonaCreateInput): Promise<CapabilityPersonaRecord>;
  updatePersona?(personaId: string, updates: CapabilityPersonaUpdateInput): Promise<void>;
  createLorebook?(input: CapabilityLorebookCreateInput): Promise<CapabilityLorebookRecord>;
  updateLorebook?(lorebookId: string, updates: CapabilityLorebookUpdateInput): Promise<void>;
  bulkCreateLorebookEntries?(lorebookId: string, entries: CapabilityLorebookEntryInput[]): Promise<void>;
  removeLorebookEntry?(entryId: string): Promise<void>;
}

export interface CapabilityLanguageModelMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
}

export interface CapabilityLanguageModelCompletionOptions {
  temperature?: number;
  maxTokens?: number;
  debugMode?: boolean;
  reasoningEffort?: "none" | "low" | "medium" | "high" | "xhigh" | "max";
  verbosity?: "low" | "medium" | "high";
  signal?: AbortSignal;
  responseFormat?: Readonly<{ type: string; [key: string]: unknown }>;
}

export interface CapabilityLanguageModelCompletion {
  content: string | null;
  finishReason: string;
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
    completionReasoningTokens?: number;
    totalTokens?: number;
  };
}

export interface CapabilityLanguageModelContextFit {
  messages: CapabilityLanguageModelMessage[];
  maxTokens?: number;
  estimatedTokensBefore: number;
  estimatedTokensAfter: number;
  trimmed: boolean;
}

export interface CapabilityResolvedLanguageModel {
  name: string;
  connectionId: string;
  model: string;
  maxContext: number | null;
  maxOutputTokens: number | null;
  chatComplete(
    messages: CapabilityLanguageModelMessage[],
    options?: CapabilityLanguageModelCompletionOptions,
  ): Promise<CapabilityLanguageModelCompletion>;
  fitContext(
    messages: CapabilityLanguageModelMessage[],
    options?: Pick<CapabilityLanguageModelCompletionOptions, "maxTokens">,
  ): CapabilityLanguageModelContextFit;
}

export interface CapabilityLanguageModelRequest {
  connectionId?: string | null;
  chatConnectionId?: string | null;
  model?: string;
}

export interface CapabilityLanguageModelHost {
  resolve(connectionId?: string | null): Promise<CapabilityResolvedLanguageModel>;
  resolveForRequest(request: CapabilityLanguageModelRequest): Promise<CapabilityResolvedLanguageModel>;
}

export interface CapabilityJsonHost {
  parseJsonish(raw: string): unknown;
}

export interface CapabilityMessageRecord {
  id: string;
  chatId: string;
  role: MessageRole;
  characterId: string | null;
  content: string;
  activeSwipeIndex: number;
  extra: string;
  createdAt: string;
}

export interface CapabilitySpatialSnapshotWrite {
  /**
   * Must be globally unique across ALL chats (use a UUID). The store rejects
   * an id that collides with a loaded chat's snapshot, but under lazy storage
   * (#5592) a collision with a chat that is not yet in memory cannot be
   * detected at write time — the duplicate is resolved later by dropping one
   * copy, so a package that reuses ids across chats loses data silently.
   */
  id: string;
  chatId: string;
  messageId: string;
  swipeIndex: number;
  currentLocationId: string | null;
  definitionRevision: number;
  source: SpatialSnapshotSource;
  transitionCommandId: string | null;
  transitionPayloadHash: string | null;
  createdAt: string;
}

export interface CapabilitySpatialSnapshotStore {
  /** chatId is optional but keeps the lazy file store from loading every chat's shards for a bare-id probe. */
  getById(id: string, chatId?: string): Promise<SpatialContextSnapshot | null>;
  getByAnchor(chatId: string, messageId: string, swipeIndex: number): Promise<SpatialContextSnapshot | null>;
  getByCommand(chatId: string, commandId: string): Promise<SpatialContextSnapshot | null>;
  listByAnchors(
    chatId: string,
    anchors: Array<{ messageId: string; swipeIndex: number }>,
  ): Promise<SpatialContextSnapshot[]>;
  listForChat(chatId: string): Promise<SpatialContextSnapshot[]>;
  hasMessageSnapshots(chatId: string): Promise<boolean>;
  getLatest(chatId: string): Promise<SpatialContextSnapshot | null>;
  getBootstrap(chatId: string): Promise<SpatialContextSnapshot | null>;
  create(input: CapabilitySpatialSnapshotWrite): Promise<SpatialContextSnapshot>;
  replaceBootstrap(input: CapabilitySpatialSnapshotWrite): Promise<SpatialContextSnapshot>;
  replaceAtAnchor(input: CapabilitySpatialSnapshotWrite): Promise<SpatialContextSnapshot>;
}

/** Package-owned JSON document stored independently from chats. */
export interface CapabilityDocumentRecord {
  id: string;
  packageId: string;
  kind: string;
  name: string;
  description: string;
  data: unknown;
  revision: number;
  createdAt: string;
  updatedAt: string;
}

export interface CapabilityDocumentWrite {
  id: string;
  packageId: string;
  kind: string;
  name: string;
  description: string;
  data: unknown;
  createdAt: string;
  updatedAt: string;
}

export interface CapabilityDocumentUpdate {
  id: string;
  packageId: string;
  expectedRevision: number;
  name: string;
  description: string;
  data: unknown;
  updatedAt: string;
}

/** Generic persistence for package-owned reusable records such as map templates. */
export interface CapabilityDocumentStore {
  list(packageId: string, kind: string): Promise<CapabilityDocumentRecord[]>;
  getById(packageId: string, id: string): Promise<CapabilityDocumentRecord | null>;
  create(input: CapabilityDocumentWrite): Promise<CapabilityDocumentRecord>;
  update(input: CapabilityDocumentUpdate): Promise<CapabilityDocumentRecord | null>;
  remove(packageId: string, id: string, expectedRevision: number): Promise<boolean>;
}

export interface CapabilityCreateMessageWithSwipeInput {
  id: string;
  swipeId: string;
  chatId: string;
  role: MessageRole;
  characterId: string | null;
  content: string;
  extra: Record<string, unknown>;
  createdAt: string;
}

export interface CapabilityChatActivityUpdate {
  chatId: string;
  lastMessageAt: string;
  updatedAt: string;
  metadata?: Record<string, unknown>;
}

export interface CapabilityChatMetadataUpdate {
  chatId: string;
  metadata: Record<string, unknown>;
  updatedAt: string;
}

/** Read-only snapshot of the latest committed World State for a chat. */
export interface CapabilityGameStateRecord {
  snapshotId: string;
  chatId: string;
  messageId: string;
  swipeIndex: number;
  date: string | null;
  time: string | null;
  location: string | null;
  weather: string | null;
  temperature: string | null;
  presentCharacterIds: string[];
}

export type CapabilityRoleplayEventAudience = "public" | "user-only" | { characterIds: string[] };

export interface CapabilityRoleplayEventInput {
  id: string;
  chatId: string;
  messageId: string;
  swipeIndex: number;
  sourcePackageId: string;
  eventType: string;
  subjectCharacterIds: string[];
  audience: CapabilityRoleplayEventAudience;
  text: string;
  data: unknown;
  createdAt: string;
  idempotencyKey: string;
}

export interface CapabilityRoleplayEventRecord extends CapabilityRoleplayEventInput {}

export interface CapabilityPersistenceSession {
  getChat(chatId: string): Promise<CapabilityChatRecord | null>;
  listChats(): Promise<CapabilityChatRecord[]>;
  listMessages(chatId: string): Promise<CapabilityMessageRecord[]>;
  /** Read-only. Optional so packages feature-detect and degrade on older Engines. */
  getGameState?(chatId: string): Promise<CapabilityGameStateRecord | null>;
  appendRoleplayEvent?(input: CapabilityRoleplayEventInput): Promise<CapabilityRoleplayEventRecord | null>;
  listExistingLorebookEntryIds(entryIds: string[]): Promise<string[]>;
  createMessageWithSwipe(input: CapabilityCreateMessageWithSwipeInput): Promise<CapabilityMessageRecord>;
  markGameStateSnapshotCommitted(chatId: string, snapshotId: string): Promise<void>;
  updateChatActivity(input: CapabilityChatActivityUpdate): Promise<void>;
  updateChatMetadata(input: CapabilityChatMetadataUpdate): Promise<void>;
  documents: CapabilityDocumentStore;
  spatialSnapshots: CapabilitySpatialSnapshotStore;
}

export interface CapabilityPersistenceHost extends CapabilityPersistenceSession {
  withChatLock<T>(chatId: string, operation: () => Promise<T>): Promise<T>;
  transaction<T>(operation: (session: CapabilityPersistenceSession) => Promise<T>): Promise<T>;
}

export interface CapabilityEmbeddingHost {
  spaceId: string;
  label: string;
  embed(texts: string[], signal?: AbortSignal): Promise<number[][] | null>;
}

export interface CapabilityRuntimeHost {
  embeddings: CapabilityEmbeddingHost;
  /** Resolve the package's current embedding configuration. Requires capability API 1.15. */
  resolveEmbeddings(): Promise<CapabilityEmbeddingHost>;
  getAgentConfig(): Promise<{ connectionId: string | null; settings: Record<string, unknown> } | null>;
  isDebugAgentsEnabled(): boolean;
  json: CapabilityJsonHost;
  languageModels: CapabilityLanguageModelHost;
  logger: CapabilityRuntimeLogger;
  persistence: CapabilityPersistenceHost;
  resources: CapabilityResourceHost;
}
