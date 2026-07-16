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
  connectionId: string | null;
  metadata: unknown;
  lastMessageAt: string | null;
  updatedAt: string;
}

export interface CapabilityCharacterRecord {
  id: string;
  data: unknown;
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
  listCharacters(characterIds: string[]): Promise<CapabilityCharacterRecord[]>;
  listEligibleLorebookEntries(selection: CapabilityLorebookEntrySelection): Promise<CapabilityLorebookEntryRecord[]>;
}

export interface CapabilityLanguageModelMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface CapabilityLanguageModelCompletionOptions {
  temperature?: number;
  maxTokens?: number;
  debugMode?: boolean;
}

export interface CapabilityLanguageModelCompletion {
  content: string | null;
  finishReason: string;
}

export interface CapabilityResolvedLanguageModel {
  connectionId: string;
  model: string;
  chatComplete(
    messages: CapabilityLanguageModelMessage[],
    options?: CapabilityLanguageModelCompletionOptions,
  ): Promise<CapabilityLanguageModelCompletion>;
}

export interface CapabilityLanguageModelHost {
  resolve(connectionId?: string | null): Promise<CapabilityResolvedLanguageModel>;
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
  listMessages(chatId: string): Promise<CapabilityMessageRecord[]>;
  listExistingLorebookEntryIds(entryIds: string[]): Promise<string[]>;
  createMessageWithSwipe(input: CapabilityCreateMessageWithSwipeInput): Promise<CapabilityMessageRecord>;
  markGameStateSnapshotCommitted(chatId: string, snapshotId: string): Promise<void>;
  updateChatActivity(input: CapabilityChatActivityUpdate): Promise<void>;
  updateChatMetadata(input: CapabilityChatMetadataUpdate): Promise<void>;
  spatialSnapshots: CapabilitySpatialSnapshotStore;
}

export interface CapabilityPersistenceHost extends CapabilityPersistenceSession {
  withChatLock<T>(chatId: string, operation: () => Promise<T>): Promise<T>;
  transaction<T>(operation: (session: CapabilityPersistenceSession) => Promise<T>): Promise<T>;
}

export interface CapabilityRuntimeHost {
  isDebugAgentsEnabled(): boolean;
  json: CapabilityJsonHost;
  languageModels: CapabilityLanguageModelHost;
  logger: CapabilityRuntimeLogger;
  persistence: CapabilityPersistenceHost;
  resources: CapabilityResourceHost;
}
