import type {
  CapabilityMessageRecord,
  MessageAttachment,
  PendingSpatialTransition,
  SpatialContextSnapshot,
  SpatialTransitionErrorCode,
} from "@marinara-engine/shared";
import { getCapabilityService } from "../capability-packages/capability-service-registry.service.js";

export type SpatialOwnerTurnErrorCode =
  | SpatialTransitionErrorCode
  | "chat_not_found"
  | "spatial_mode_unsupported"
  | "spatial_transition_requires_new_turn"
  | "spatial_transition_command_mismatch"
  | "spatial_transition_already_applied"
  | "spatial_feature_unavailable";

interface SpatialErrorShape {
  name: "SpatialOwnerTurnError";
  code: SpatialOwnerTurnErrorCode;
  statusCode: 400 | 404 | 409;
  details?: {
    snapshot?: SpatialContextSnapshot;
    messageId?: string;
    currentRevision?: number;
    currentLocationId?: string | null;
    currentBreadcrumb?: Array<{ id: string; name: string }>;
  };
}

export class SpatialOwnerTurnError extends Error implements SpatialErrorShape {
  readonly name = "SpatialOwnerTurnError";

  constructor(
    readonly code: SpatialOwnerTurnErrorCode,
    message: string,
    readonly statusCode: 400 | 404 | 409,
    readonly details?: SpatialErrorShape["details"],
  ) {
    super(message);
  }

  static [Symbol.hasInstance](value: unknown): boolean {
    return value instanceof Error && value.name === "SpatialOwnerTurnError";
  }
}

export interface CommitSpatialOwnerTurnInput {
  chatId: string;
  content: string;
  transition: PendingSpatialTransition;
  gameStateSnapshotId?: string | null;
  attachments?: MessageAttachment[];
}

type CommitResult = { message: CapabilityMessageRecord; snapshot: SpatialContextSnapshot };
interface OwnerTurnService {
  commitSpatialOwnerTurn(input: CommitSpatialOwnerTurnInput): Promise<CommitResult>;
}

export async function commitSpatialOwnerTurn(input: CommitSpatialOwnerTurnInput): Promise<CommitResult> {
  const provider = getCapabilityService<OwnerTurnService>("hierarchical-maps:owner-turn");
  if (!provider) throw new SpatialOwnerTurnError("spatial_feature_unavailable", "Hierarchical Maps is not active.", 409);
  return provider.commitSpatialOwnerTurn(input);
}
