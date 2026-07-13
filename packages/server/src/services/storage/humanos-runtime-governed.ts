import { canonicalJson, canonicalJsonHash, sha256Parts } from "./canonical-json.js";
import type { StatePatchProposalInput } from "./governed-proposals.storage.js";

export const HUMANOS_RUNTIME_TARGET_KIND = "humanos_runtime";
export const HUMANOS_RUNTIME_TARGET_SCOPE = "chat";
export const HUMANOS_RUNTIME_GAME_TYPE = "humanos-v2";
export const HUMANOS_RUNTIME_SCHEMA_VERSION = 2;

export interface HumanOSRuntimeCompatibilityMetadata {
  messageId: string;
  swipeIndex: number;
  turnId: string;
  sourceContentHash: string;
  patchType: "humanos-runtime";
  idempotencyKey: string;
}

export interface HumanOSRuntimeGovernedPatch {
  state: unknown;
  baseRevision: number;
  compatibility: HumanOSRuntimeCompatibilityMetadata;
}

export interface HumanOSRuntimeProjection {
  state: unknown;
}

export function humanOSRuntimeTargetIdentity(chatId: string) {
  return {
    kind: HUMANOS_RUNTIME_TARGET_KIND,
    scope: HUMANOS_RUNTIME_TARGET_SCOPE,
    id: chatId,
    key: `${HUMANOS_RUNTIME_TARGET_KIND}:${HUMANOS_RUNTIME_TARGET_SCOPE}:${chatId}`,
  };
}

export function humanOSRuntimeLegacyTargetKey(chatId: string) {
  return `${HUMANOS_RUNTIME_TARGET_KIND}:${chatId}`;
}

export function parseHumanOSRuntimeState(state: string): unknown {
  return JSON.parse(state) as unknown;
}

export function normalizeHumanOSRuntimeProjection(state: string | unknown): HumanOSRuntimeProjection {
  return {
    state: typeof state === "string" ? parseHumanOSRuntimeState(state) : JSON.parse(canonicalJson(state)) as unknown,
  };
}

export function canonicalHumanOSRuntimeProjectionHash(state: string | unknown) {
  return canonicalJsonHash(normalizeHumanOSRuntimeProjection(state).state);
}

export function buildHumanOSRuntimeProposalInput(input: {
  chatId: string;
  state: string;
  baseRevision: number;
  messageId: string;
  swipeIndex: number;
  turnId: string;
  sourceContentHash: string;
  idempotencyKey: string;
}): StatePatchProposalInput {
  const evidence = {
    kind: "canonical_turn" as const,
    chatId: input.chatId,
    turnId: input.turnId,
    messageId: input.messageId,
    swipeIndex: input.swipeIndex,
    sourceContentHash: input.sourceContentHash,
  };
  const compatibility = {
    messageId: input.messageId,
    swipeIndex: input.swipeIndex,
    turnId: input.turnId,
    sourceContentHash: input.sourceContentHash,
    patchType: "humanos-runtime" as const,
    idempotencyKey: "",
  };
  const patch = {
    state: normalizeHumanOSRuntimeProjection(input.state).state,
    baseRevision: input.baseRevision,
    compatibility,
  };
  const patchHash = canonicalJsonHash(patch);
  compatibility.idempotencyKey = sha256Parts([
    HUMANOS_RUNTIME_SCHEMA_VERSION,
    humanOSRuntimeTargetIdentity(input.chatId).key,
    "humanos-runtime",
    patchHash,
    canonicalJsonHash(evidence),
    "agent",
    "humanos-runtime-updater",
    "canonical_turn",
    "humanos-runtime",
  ]);
  return {
    schemaVersion: HUMANOS_RUNTIME_SCHEMA_VERSION,
    targetKind: HUMANOS_RUNTIME_TARGET_KIND,
    targetScope: HUMANOS_RUNTIME_TARGET_SCOPE,
    targetId: input.chatId,
    targetKey: humanOSRuntimeTargetIdentity(input.chatId).key,
    operation: "humanos-runtime",
    patch,
    baseRevision: input.baseRevision,
    evidence,
    actor: {
      type: "agent",
      id: "humanos-runtime-updater",
      authorityPath: "canonical_turn",
      priority: 10,
      pipelineStage: "post_canonical_tracking",
    },
    commitGroupId: input.idempotencyKey,
    dependencyIds: [],
    failureBoundary: "target",
    failureMode: "required",
    logicalPatchSlot: "humanos-runtime",
  };
}
