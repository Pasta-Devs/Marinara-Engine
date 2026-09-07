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
  parsedCommandCount: number;
  parsedRawCommandCount: number;
  /** Package-declared GM verbs parsed out of this turn (#5798). A game turn that is nothing but verb
   *  tags strips to empty, and the two command counts are both zero in game mode by construction —
   *  the Conversation command surface never runs there. Without this the turn takes the error branch
   *  and its already-validated writes are dropped on the floor. Optional so every non-game caller
   *  keeps its current shape. */
  gmVerbCallCount?: number;
  spatialDirectiveDetected: boolean;
}): boolean {
  return Boolean(
    input.spatialDirectiveDetected ||
    (!input.impersonate &&
      (input.parsedCommandCount > 0 || input.parsedRawCommandCount > 0 || (input.gmVerbCallCount ?? 0) > 0)),
  );
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
