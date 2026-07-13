import { and, desc, eq } from "drizzle-orm";
import type { DB } from "../../db/connection.js";
import { gameEngineState } from "../../db/schema/index.js";
import { canonicalJson, canonicalJsonHash } from "./canonical-json.js";
import type { CommitAuthority, GovernedStateAdapter, TargetIdentity } from "./governed-adapters.js";

export interface HumanOSRuntimeParityPatch {
  state: unknown;
  baseRevision: number;
}

export interface HumanOSRuntimeParityProjection {
  state: unknown;
}

function parseState(input: unknown): unknown {
  if (typeof input === "string") return JSON.parse(input) as unknown;
  return JSON.parse(canonicalJson(input)) as unknown;
}

export const humanOSRuntimeParityAdapter: GovernedStateAdapter<HumanOSRuntimeParityPatch, HumanOSRuntimeParityProjection> = {
  targetKind: "humanos_runtime",
  schemaVersion: 2,
  phaseRank: 0,
  targetKindRank: 0,

  normalizeTarget(input: unknown, authority: CommitAuthority): TargetIdentity {
    if (!input || typeof input !== "object" || typeof (input as { chatId?: unknown }).chatId !== "string") throw new Error("HumanOS Runtime target requires chatId");
    const chatId = (input as { chatId: string }).chatId;
    if (authority.evidence.kind === "canonical_turn" && authority.evidence.chatId !== chatId) throw new Error("HumanOS Runtime authority chat mismatch");
    return { kind: this.targetKind, scope: "chat", id: chatId, key: `${this.targetKind}:${chatId}` };
  },

  normalizePatch(operation: string, input: unknown): HumanOSRuntimeParityPatch {
    if (operation !== "humanos-runtime" || !input || typeof input !== "object") throw new Error("Invalid HumanOS Runtime parity patch");
    const value = input as { state?: unknown; baseRevision?: unknown };
    if (!Number.isInteger(value.baseRevision) || Number(value.baseRevision) < 0) throw new Error("HumanOS Runtime parity patch requires baseRevision");
    return { state: parseState(value.state), baseRevision: Number(value.baseRevision) };
  },

  validatePolicy({ operation, target, authority }) {
    if (operation !== "humanos-runtime" || target.kind !== this.targetKind) throw new Error("HumanOS Runtime parity policy mismatch");
    if (authority.evidence.kind !== "canonical_turn" || authority.actor.type !== "agent" || authority.actor.authorityPath !== "canonical_turn") throw new Error("HumanOS Runtime parity requires canonical agent authority");
  },

  async loadProjection(tx: DB, target: TargetIdentity, _operation: string, patch: HumanOSRuntimeParityPatch) {
    if (patch.baseRevision === 0) return null;
    const rows = await tx.select().from(gameEngineState).where(and(eq(gameEngineState.chatId, target.id), eq(gameEngineState.gameType, "humanos-v2"), eq(gameEngineState.committed, 1), eq(gameEngineState.revision, patch.baseRevision))).orderBy(desc(gameEngineState.createdAt)).limit(1);
    return rows[0] ? { state: parseState(rows[0].state) } : null;
  },

  applyPatch(_current, operation, patch) {
    if (operation !== "humanos-runtime") throw new Error("Unsupported HumanOS Runtime operation");
    return { state: parseState(patch.state) };
  },

  validateResult(_current, result) { canonicalJson(result.state); },
  async persistProjection() { throw new Error("Runtime parity adapter cannot persist projections during Phase A"); },
  hashProjection(result) { return canonicalJsonHash(result.state); },
};
