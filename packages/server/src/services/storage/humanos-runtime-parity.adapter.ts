import { and, desc, eq } from "drizzle-orm";
import { gameEngineState } from "../../db/schema/index.js";
import { now } from "../../utils/id-generator.js";
import { canonicalJson } from "./canonical-json.js";
import type { CommitAuthority, GovernedAdapterExecutor, GovernedStateAdapter, TargetIdentity } from "./governed-adapters.js";
import {
  canonicalHumanOSRuntimeProjectionHash,
  HUMANOS_RUNTIME_GAME_TYPE,
  HUMANOS_RUNTIME_SCHEMA_VERSION,
  humanOSRuntimeTargetIdentity,
  type HumanOSRuntimeGovernedPatch,
  type HumanOSRuntimeProjection,
} from "./humanos-runtime-governed.js";

function parseState(input: unknown): unknown {
  if (typeof input === "string") return JSON.parse(input) as unknown;
  return JSON.parse(canonicalJson(input)) as unknown;
}

export const humanOSRuntimeParityAdapter: GovernedStateAdapter<HumanOSRuntimeGovernedPatch, HumanOSRuntimeProjection> = {
  targetKind: "humanos_runtime",
  schemaVersion: 2,
  phaseRank: 0,
  targetKindRank: 0,

  normalizeTarget(input: unknown, authority: CommitAuthority): TargetIdentity {
    if (!input || typeof input !== "object" || typeof (input as { chatId?: unknown }).chatId !== "string") throw new Error("HumanOS Runtime target requires chatId");
    const chatId = (input as { chatId: string }).chatId;
    if (authority.evidence.kind === "canonical_turn" && authority.evidence.chatId !== chatId) throw new Error("HumanOS Runtime authority chat mismatch");
    return humanOSRuntimeTargetIdentity(chatId);
  },

  normalizePatch(operation: string, input: unknown): HumanOSRuntimeGovernedPatch {
    if (operation !== "humanos-runtime" || !input || typeof input !== "object") throw new Error("Invalid HumanOS Runtime parity patch");
    const value = input as { state?: unknown; baseRevision?: unknown; compatibility?: unknown };
    if (!Number.isInteger(value.baseRevision) || Number(value.baseRevision) < 0) throw new Error("HumanOS Runtime parity patch requires baseRevision");
    if (!value.compatibility || typeof value.compatibility !== "object") throw new Error("HumanOS Runtime parity patch requires compatibility metadata");
    const compatibility = value.compatibility as Record<string, unknown>;
    const keys = Object.keys(value).sort().join(",");
    if (keys !== "baseRevision,compatibility,state") throw new Error("Invalid HumanOS Runtime parity patch shape");
    if (compatibility.patchType !== "humanos-runtime") throw new Error("HumanOS Runtime parity patch requires patchType humanos-runtime");
    if (typeof compatibility.messageId !== "string" || !Number.isInteger(compatibility.swipeIndex) || Number(compatibility.swipeIndex) < 0 || typeof compatibility.turnId !== "string" || typeof compatibility.sourceContentHash !== "string" || !/^[a-f0-9]{64}$/i.test(String(compatibility.sourceContentHash)) || typeof compatibility.idempotencyKey !== "string" || !compatibility.idempotencyKey.trim()) {
      throw new Error("HumanOS Runtime parity patch requires complete compatibility metadata");
    }
    return {
      state: parseState(value.state),
      baseRevision: Number(value.baseRevision),
      compatibility: {
        messageId: compatibility.messageId,
        swipeIndex: Number(compatibility.swipeIndex),
        turnId: compatibility.turnId,
        sourceContentHash: compatibility.sourceContentHash,
        patchType: "humanos-runtime",
        idempotencyKey: compatibility.idempotencyKey,
      },
    };
  },

  validatePolicy({ operation, target, authority }) {
    if (operation !== "humanos-runtime" || target.kind !== this.targetKind) throw new Error("HumanOS Runtime parity policy mismatch");
    if (authority.evidence.kind !== "canonical_turn" || authority.actor.type !== "agent" || authority.actor.authorityPath !== "canonical_turn") throw new Error("HumanOS Runtime parity requires canonical agent authority");
  },

  async loadProjection(tx: GovernedAdapterExecutor, target: TargetIdentity, _operation: string, patch: HumanOSRuntimeGovernedPatch) {
    if (patch.baseRevision === 0) return null;
    const rows = await tx.select().from(gameEngineState).where(and(eq(gameEngineState.chatId, target.id), eq(gameEngineState.gameType, HUMANOS_RUNTIME_GAME_TYPE), eq(gameEngineState.committed, 1), eq(gameEngineState.revision, patch.baseRevision))).orderBy(desc(gameEngineState.createdAt)).limit(1);
    return rows[0] ? { state: parseState(rows[0].state) } : null;
  },

  applyPatch(_current, operation, patch) {
    if (operation !== "humanos-runtime") throw new Error("Unsupported HumanOS Runtime operation");
    return { state: parseState(patch.state) };
  },

  validateResult(_current, result) { canonicalJson(result.state); },
  async persistProjection(tx: GovernedAdapterExecutor, target, result, revision, _commitId, context) {
    await tx.insert(gameEngineState).values({
      id: context.proposalId,
      chatId: target.id,
      messageId: context.patch.compatibility.messageId,
      swipeIndex: context.patch.compatibility.swipeIndex,
      gameType: HUMANOS_RUNTIME_GAME_TYPE,
      schemaVersion: HUMANOS_RUNTIME_SCHEMA_VERSION,
      state: canonicalJson(result.state),
      committed: 1,
      revision,
      baseRevision: context.patch.baseRevision,
      turnId: context.patch.compatibility.turnId,
      sourceContentHash: context.patch.compatibility.sourceContentHash,
      patchType: context.patch.compatibility.patchType,
      idempotencyKey: context.idempotencyKey,
      createdAt: now(),
    });
  },
  hashProjection(result) { return canonicalHumanOSRuntimeProjectionHash(result.state); },
};
