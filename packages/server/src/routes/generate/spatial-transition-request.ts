import type { PendingSpatialTransition, ResolvedSpatialTravel, SpatialContextSnapshot } from "@marinara-engine/shared";

type SpatialGenerationMode = "conversation" | "roleplay" | "game";
export type SpatialGenerationOrigin = "owner" | "guided" | "autonomous" | "turn_game";

export type SpatialGenerationRequestError = {
  statusCode: 400;
  error: string;
  code: "spatial_mode_unsupported" | "spatial_transition_requires_new_turn";
};

export type AlreadyAppliedSpatialTurn = {
  messageId: string;
  swipeIndex: number;
  currentLocationId: string | null;
  definitionRevision: number;
  travel?: ResolvedSpatialTravel;
};

export function resolveAlreadyAppliedSpatialTurn(error: {
  code: string;
  details?: { messageId?: string; snapshot?: SpatialContextSnapshot; travel?: ResolvedSpatialTravel };
}): AlreadyAppliedSpatialTurn | null {
  if (error.code !== "spatial_transition_already_applied") return null;
  const snapshot = error.details?.snapshot;
  const messageId = error.details?.messageId?.trim() || snapshot?.messageId.trim();
  if (!snapshot || !messageId) return null;
  return {
    messageId,
    swipeIndex: snapshot.swipeIndex,
    currentLocationId: snapshot.currentLocationId,
    definitionRevision: snapshot.definitionRevision,
    ...(error.details?.travel ? { travel: error.details.travel } : {}),
  };
}

export function shouldSuppressAssistantSpatialMutation(input: {
  impersonate?: boolean;
  pendingSpatialTransition?: PendingSpatialTransition | null;
}): boolean {
  return Boolean(input.impersonate || input.pendingSpatialTransition);
}

export function shouldSaveHiddenGenerationAnchor(input: {
  impersonate?: boolean;
  /** True only when a mode's parser produced commands or tool calls, not merely tag-like text. */
  hasActionableOutput: boolean;
  spatialDirectiveDetected: boolean;
}): boolean {
  return input.spatialDirectiveDetected || (!input.impersonate && input.hasActionableOutput);
}

export function resolveSpatialGenerationOrigin(input: {
  autonomous?: boolean;
  turnGameBots?: boolean;
  generationGuide?: string | null;
  generationGuideSource?: "narrator" | "guide" | "game_start" | null;
}): SpatialGenerationOrigin {
  if (input.autonomous) return "autonomous";
  if (input.turnGameBots) return "turn_game";
  if (input.generationGuideSource || input.generationGuide?.trim()) return "guided";
  return "owner";
}

export function validateSpatialGenerationRequest(input: {
  mode: SpatialGenerationMode;
  origin: SpatialGenerationOrigin;
  pendingSpatialTransition?: PendingSpatialTransition | null;
  impersonate?: boolean;
  regenerateMessageId?: string | null;
  continueMessageId?: string | null;
}): SpatialGenerationRequestError | null {
  if (!input.pendingSpatialTransition) return null;
  if (input.mode !== "roleplay" && input.mode !== "game") {
    return {
      statusCode: 400,
      error: "Only Roleplay and Game chats can change hierarchical location.",
      code: "spatial_mode_unsupported",
    };
  }
  if (input.regenerateMessageId || input.continueMessageId) {
    return {
      statusCode: 400,
      error: "A hierarchical location change must be submitted as a new owner turn.",
      code: "spatial_transition_requires_new_turn",
    };
  }
  if (input.impersonate && input.mode !== "roleplay") {
    return {
      statusCode: 400,
      error: "Impersonated hierarchical location changes are only available in Roleplay mode.",
      code: "spatial_mode_unsupported",
    };
  }
  if (input.origin !== "owner") {
    return {
      statusCode: 400,
      error: "A hierarchical location change must be submitted as a new owner turn.",
      code: "spatial_transition_requires_new_turn",
    };
  }
  return null;
}
