import type { SpatialContextDefinition, SpatialContextSnapshot } from "@marinara-engine/shared";
import type { DB } from "../../db/connection.js";
import { getCapabilityService } from "../capability-packages/capability-service-registry.service.js";

type SpatialReadConnection = Pick<DB, "select" | "insert" | "delete" | "update">;

export interface SpatialMessageAnchor {
  messageId: string;
  swipeIndex: number;
}

export interface EffectiveSpatialState {
  definition: SpatialContextDefinition | null;
  snapshot: SpatialContextSnapshot | null;
  currentLocationId: string | null;
  definitionRevision: number;
  visibleAnchor: SpatialMessageAnchor | null;
  virtual: boolean;
}

export interface ResolveSpatialStateOptions {
  exactAnchor?: SpatialMessageAnchor;
  throughMessageId?: string;
  beforeMessageId?: string;
}

interface StateResolutionService {
  parseStoredSpatialDefinition(rawMetadata: unknown): SpatialContextDefinition | null;
  resolveEffectiveSpatialState(chatId: string, options?: ResolveSpatialStateOptions): Promise<EffectiveSpatialState>;
  materializeAssistantSpatialState(input: {
    chatId: string;
    messageId: string;
    swipeIndex: number;
    regenerate: boolean;
    continuation: boolean;
  }): Promise<SpatialContextSnapshot | null>;
}

const service = () => getCapabilityService<StateResolutionService>("hierarchical-maps:state-resolution");

export function parseStoredSpatialDefinition(rawMetadata: unknown): SpatialContextDefinition | null {
  return service()?.parseStoredSpatialDefinition(rawMetadata) ?? null;
}

export async function resolveEffectiveSpatialState(
  _db: SpatialReadConnection,
  chatId: string,
  options: ResolveSpatialStateOptions = {},
): Promise<EffectiveSpatialState> {
  return (
    service()?.resolveEffectiveSpatialState(chatId, options) ?? {
      definition: null,
      snapshot: null,
      currentLocationId: null,
      definitionRevision: 0,
      visibleAnchor: null,
      virtual: false,
    }
  );
}

export async function materializeAssistantSpatialState(
  _db: DB,
  input: { chatId: string; messageId: string; swipeIndex: number; regenerate: boolean; continuation: boolean },
): Promise<SpatialContextSnapshot | null> {
  return service()?.materializeAssistantSpatialState(input) ?? null;
}
