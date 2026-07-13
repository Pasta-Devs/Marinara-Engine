import { and, eq } from "drizzle-orm";
import type { DB } from "../../db/connection.js";
import { statePatchProposals } from "../../db/schema/index.js";
import { newId, now } from "../../utils/id-generator.js";
import { canonicalJson, canonicalJsonHash, sha256Parts } from "./canonical-json.js";
import type { GovernedActorType, GovernedAuthorityPath } from "./governed-authority.storage.js";

export type ProposalStatus = "proposed" | "committed" | "replayed" | "rejected_policy" | "rejected_evidence" | "revision_conflict" | "idempotency_conflict" | "validation_failed" | "superseded" | "commit_failed" | "out_of_scope";
export type FailureBoundary = "proposal" | "target" | "group" | "turn";
export type FailureMode = "required" | "degradable" | "optional";

export interface CanonicalTurnEvidence {
  kind: "canonical_turn";
  chatId: string;
  turnId: string;
  messageId: string;
  swipeIndex: number;
  sourceContentHash: string;
  canonicalRevision?: number;
}
export interface ExplicitAuthorityEvidence {
  kind: "manual_edit" | "repair" | "migration";
  authorityRecordId: string;
  chatId?: string;
  reason: string;
  sourceHash?: string;
}
export type CommitEvidence = CanonicalTurnEvidence | ExplicitAuthorityEvidence;

export interface StatePatchProposalInput {
  schemaVersion: number;
  targetKind: string;
  targetScope: string;
  targetId: string;
  targetKey: string;
  operation: string;
  patch: unknown;
  baseRevision: number;
  evidence: CommitEvidence;
  actor: { type: GovernedActorType; id: string; authorityPath: GovernedAuthorityPath; agentRunId?: string; pipelineStage?: "post_canonical_tracking" | "post_canonical_commit"; priority: number };
  commitGroupId: string;
  dependencyIds: string[];
  failureBoundary: FailureBoundary;
  failureMode: FailureMode;
  logicalPatchSlot: string;
}

const terminalStatuses = new Set<ProposalStatus>(["committed", "replayed", "rejected_policy", "rejected_evidence", "revision_conflict", "idempotency_conflict", "validation_failed", "superseded", "commit_failed", "out_of_scope"]);

function assertEvidence(input: StatePatchProposalInput) {
  const { evidence, actor } = input;
  if (evidence.kind === "canonical_turn") {
    if (actor.authorityPath !== "canonical_turn" || actor.type !== "agent") throw new Error("Canonical evidence requires agent canonical_turn authority");
    if (!evidence.chatId || !evidence.turnId || !evidence.messageId || !Number.isInteger(evidence.swipeIndex) || evidence.swipeIndex < 0 || !/^[a-f0-9]{64}$/i.test(evidence.sourceContentHash)) throw new Error("Canonical evidence is incomplete");
  } else {
    if (actor.authorityPath !== evidence.kind || actor.type === "agent") throw new Error("Explicit evidence does not match actor authority");
    if (!evidence.authorityRecordId || !evidence.reason) throw new Error("Explicit authority evidence is incomplete");
  }
}

function evidenceFingerprint(evidence: CommitEvidence) { return canonicalJsonHash(evidence); }

export function createGovernedProposalStorage(db: DB) {
  return {
    async get(id: string) { return (await db.select().from(statePatchProposals).where(eq(statePatchProposals.id, id)).limit(1))[0] ?? null; },
    async getByIdempotencyKey(key: string) { return (await db.select().from(statePatchProposals).where(eq(statePatchProposals.idempotencyKey, key)).limit(1))[0] ?? null; },
    async listProposedByGroup(groupId: string) { return db.select().from(statePatchProposals).where(and(eq(statePatchProposals.commitGroupId, groupId), eq(statePatchProposals.status, "proposed"))); },
    async propose(input: StatePatchProposalInput) {
      assertEvidence(input);
      if (!Number.isInteger(input.schemaVersion) || input.schemaVersion < 1 || !Number.isInteger(input.baseRevision) || input.baseRevision < 0 || !Number.isInteger(input.actor.priority)) throw new Error("Invalid proposal coordinates");
      if (input.targetKey !== `${input.targetKind}:${input.targetScope}:${input.targetId}`) throw new Error("Proposal target identity mismatch");
      const patchJson = canonicalJson(input.patch);
      const patchHash = canonicalJsonHash(input.patch);
      const idempotencyKey = sha256Parts([input.schemaVersion, input.targetKey, input.operation, patchHash, evidenceFingerprint(input.evidence), input.actor.type, input.actor.id, input.actor.authorityPath, input.logicalPatchSlot]);
      const existing = await this.getByIdempotencyKey(idempotencyKey);
      const immutable = canonicalJson({ ...input, patch: JSON.parse(patchJson), dependencyIds: [...input.dependencyIds].sort() });
      if (existing) {
        const stored = canonicalJson({ schemaVersion: existing.schemaVersion, targetKind: existing.targetKind, targetScope: existing.targetScope, targetId: existing.targetId, targetKey: existing.targetKey, operation: existing.operation, patch: JSON.parse(existing.patchJson), baseRevision: existing.baseRevision, evidence: existing.evidenceKind === "canonical_turn" ? { kind: "canonical_turn", chatId: existing.chatId, turnId: existing.turnId, messageId: existing.messageId, swipeIndex: existing.swipeIndex, sourceContentHash: existing.sourceContentHash, ...(existing.canonicalRevision === null ? {} : { canonicalRevision: existing.canonicalRevision }) } : { kind: existing.evidenceKind, authorityRecordId: existing.authorityRecordId, ...(existing.chatId ? { chatId: existing.chatId } : {}), reason: existing.authorityReason, ...(existing.authoritySourceHash ? { sourceHash: existing.authoritySourceHash } : {}) }, actor: { type: existing.actorType, id: existing.actorId, authorityPath: existing.authorityPath, ...(existing.agentRunId ? { agentRunId: existing.agentRunId } : {}), ...(existing.pipelineStage ? { pipelineStage: existing.pipelineStage } : {}), priority: existing.writerPriority }, commitGroupId: existing.commitGroupId, dependencyIds: JSON.parse(existing.dependencyIdsJson), failureBoundary: existing.failureBoundary, failureMode: existing.failureMode, logicalPatchSlot: existing.logicalPatchSlot });
        return immutable === stored ? { status: "replayed" as const, row: existing } : { status: "idempotency_conflict" as const, row: existing };
      }
      const e = input.evidence;
      const row: typeof statePatchProposals.$inferInsert = { id: newId(), schemaVersion: input.schemaVersion, targetKind: input.targetKind, targetScope: input.targetScope, targetId: input.targetId, targetKey: input.targetKey, operation: input.operation, patchJson, patchHash, baseRevision: input.baseRevision, evidenceKind: e.kind, chatId: e.chatId ?? null, turnId: e.kind === "canonical_turn" ? e.turnId : null, messageId: e.kind === "canonical_turn" ? e.messageId : null, swipeIndex: e.kind === "canonical_turn" ? e.swipeIndex : null, sourceContentHash: e.kind === "canonical_turn" ? e.sourceContentHash : null, canonicalRevision: e.kind === "canonical_turn" ? e.canonicalRevision ?? null : null, authorityRecordId: e.kind === "canonical_turn" ? null : e.authorityRecordId, authorityReason: e.kind === "canonical_turn" ? null : e.reason, authoritySourceHash: e.kind === "canonical_turn" ? null : e.sourceHash ?? null, actorType: input.actor.type, actorId: input.actor.id, authorityPath: input.actor.authorityPath, agentRunId: input.actor.agentRunId ?? null, pipelineStage: input.actor.pipelineStage ?? null, writerPriority: input.actor.priority, commitGroupId: input.commitGroupId, dependencyIdsJson: canonicalJson([...input.dependencyIds].sort()), failureBoundary: input.failureBoundary, failureMode: input.failureMode, logicalPatchSlot: input.logicalPatchSlot, idempotencyKey, status: "proposed", createdAt: now() };
      await db.insert(statePatchProposals).values(row);
      return { status: "proposed" as const, row: row as typeof statePatchProposals.$inferSelect };
    },
    async resolve(id: string, status: Exclude<ProposalStatus, "proposed">, options: { diagnostic?: unknown; commitId?: string } = {}) {
      if (!terminalStatuses.has(status)) throw new Error("Proposal resolution must be terminal");
      const current = await this.get(id);
      if (!current) throw new Error(`Unknown proposal ${id}`);
      if (current.status !== "proposed") {
        if (current.status === status && current.commitId === (options.commitId ?? null)) return current;
        throw new Error(`Proposal ${id} is already resolved`);
      }
      await db.update(statePatchProposals).set({ status, diagnosticJson: options.diagnostic === undefined ? null : canonicalJson(options.diagnostic), commitId: options.commitId ?? null, resolvedAt: now() }).where(eq(statePatchProposals.id, id));
      return this.get(id);
    },
  };
}
