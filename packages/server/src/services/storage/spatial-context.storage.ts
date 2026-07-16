import type { SpatialContextSnapshot, SpatialSnapshotSource } from "@marinara-engine/shared";
import { getCapabilityService } from "../capability-packages/capability-service-registry.service.js";

export interface CreateSpatialSnapshotInput {
  chatId: string;
  messageId?: string;
  swipeIndex?: number;
  currentLocationId: string | null;
  definitionRevision: number;
  source: SpatialSnapshotSource;
  transitionCommandId?: string | null;
  transitionPayloadHash?: string | null;
}

export interface SpatialContextStorage {
  getById(id: string): Promise<SpatialContextSnapshot | null>;
  getByAnchor(chatId: string, messageId: string, swipeIndex: number): Promise<SpatialContextSnapshot | null>;
  getByCommand(chatId: string, commandId: string): Promise<SpatialContextSnapshot | null>;
  listByAnchors(chatId: string, anchors: Array<{ messageId: string; swipeIndex: number }>): Promise<SpatialContextSnapshot[]>;
  listForChat(chatId: string): Promise<SpatialContextSnapshot[]>;
  hasMessageSnapshots(chatId: string): Promise<boolean>;
  getLatest(chatId: string): Promise<SpatialContextSnapshot | null>;
  getBootstrap(chatId: string): Promise<SpatialContextSnapshot | null>;
  create(input: CreateSpatialSnapshotInput): Promise<SpatialContextSnapshot>;
  replaceBootstrap(input: Omit<CreateSpatialSnapshotInput, "messageId" | "swipeIndex">): Promise<SpatialContextSnapshot>;
  replaceAtAnchor(input: CreateSpatialSnapshotInput): Promise<SpatialContextSnapshot>;
}

interface SpatialStorageProvider {
  create(): SpatialContextStorage;
}

function unavailableWrite(): never {
  throw new Error("Hierarchical Maps is not installed or active");
}

const unavailableStorage: SpatialContextStorage = {
  getById: async () => null,
  getByAnchor: async () => null,
  getByCommand: async () => null,
  listByAnchors: async () => [],
  listForChat: async () => [],
  hasMessageSnapshots: async () => false,
  getLatest: async () => null,
  getBootstrap: async () => null,
  create: async () => unavailableWrite(),
  replaceBootstrap: async () => unavailableWrite(),
  replaceAtAnchor: async () => unavailableWrite(),
};

/** Small compatibility bridge; all persistence code lives in the optional package. */
export function createSpatialContextStorage(): SpatialContextStorage {
  return getCapabilityService<SpatialStorageProvider>("hierarchical-maps:storage")?.create() ?? unavailableStorage;
}
