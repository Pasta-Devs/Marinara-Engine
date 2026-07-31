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

export interface CapabilityResourceHost {
  listCharacters(characterIds?: string[]): Promise<CapabilityCharacterRecord[]>;
  listPersonas(personaIds?: string[]): Promise<CapabilityPersonaRecord[]>;
  listLorebooks(lorebookIds?: string[]): Promise<CapabilityLorebookRecord[]>;
  listEligibleLorebookEntries(selection: CapabilityLorebookEntrySelection): Promise<CapabilityLorebookEntryRecord[]>;
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
  getById(id: string): Promise<SpatialContextSnapshot | null>;
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

export interface CapabilityPersistenceSession {
  getChat(chatId: string): Promise<CapabilityChatRecord | null>;
  listChats(): Promise<CapabilityChatRecord[]>;
  listMessages(chatId: string): Promise<CapabilityMessageRecord[]>;
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
  getAgentConfig(): Promise<{ connectionId: string | null; settings: Record<string, unknown> } | null>;
  isDebugAgentsEnabled(): boolean;
  json: CapabilityJsonHost;
  languageModels: CapabilityLanguageModelHost;
  logger: CapabilityRuntimeLogger;
  persistence: CapabilityPersistenceHost;
  resources: CapabilityResourceHost;
}
