import { eq } from "drizzle-orm";
import type { DB } from "../../db/connection.js";
import { stateAuthorityRecords, stateCommitLedger, stateTargetHeads } from "../../db/schema/index.js";
import type { CommitEvidence } from "./governed-proposals.storage.js";
import {
  createGovernedAuthorityStorage,
  explicitAuthorityRecordId,
  type ExplicitAuthorityInput,
  type GovernedActorType,
  type GovernedAuthorityPath,
} from "./governed-authority.storage.js";
import { now, newId } from "../../utils/id-generator.js";

type GovernedDB = DB;
type GovernedExecutor = Pick<DB, "select" | "insert" | "update">;

export interface GovernedCommitInput {
  proposalId: string;
  targetKey: string;
  targetKind: string;
  targetScope: string;
  targetId: string;
  baseRevision: number;
  operation: string;
  patchJson: string;
  patchHash: string;
  beforeHash: string;
  resultHash: string;
  evidence: CommitEvidence;
  actorType: GovernedActorType;
  actorId: string;
  authorityPath: GovernedAuthorityPath;
  explicitAuthority?: ExplicitAuthorityInput;
  batchId: string;
  commitOrder: number;
  commitGroupId?: string | null;
  dependencyCommitIds?: string[];
  compensatesCommitId?: string | null;
  idempotencyKey: string;
}

export type GovernedCommitResult =
  | { status: "committed" | "replayed"; row: typeof stateCommitLedger.$inferSelect; revision: number }
  | { status: "revision_conflict"; expectedRevision: number; currentRevision: number }
  | { status: "idempotency_conflict" };

export function createGovernedStateStorage(db: GovernedDB) {
  const authorities = createGovernedAuthorityStorage(db);
  return {
    async getHead(targetKey: string, tx: GovernedExecutor = db) {
      const rows = await tx.select().from(stateTargetHeads).where(eq(stateTargetHeads.targetKey, targetKey)).limit(1);
      return rows[0] ?? null;
    },

    async commit(input: GovernedCommitInput, tx: GovernedExecutor = db): Promise<GovernedCommitResult> {
      const canonicalEvidence = input.evidence.kind === "canonical_turn" ? input.evidence : null;
      const explicitEvidence = input.evidence.kind === "canonical_turn" ? null : input.evidence;
      const explicitInputValid = canonicalEvidence
        ? input.authorityPath === "canonical_turn" && input.actorType === "agent" && !input.explicitAuthority
        : Boolean(
            explicitEvidence &&
            input.authorityPath === explicitEvidence.kind &&
            input.actorType !== "agent" &&
            input.explicitAuthority &&
            input.explicitAuthority.actorType === input.actorType &&
            input.explicitAuthority.actorId === input.actorId &&
            input.explicitAuthority.authorityPath === input.authorityPath &&
            input.explicitAuthority.targetKey === input.targetKey &&
            explicitAuthorityRecordId(input.explicitAuthority.authorizationKey) === explicitEvidence.authorityRecordId &&
            input.explicitAuthority.reason === explicitEvidence.reason,
          );
      if (!explicitInputValid) throw new Error("Governed explicit authority input mismatch");

      const authorityRecordId = canonicalEvidence
        ? null
        : input.explicitAuthority
          ? explicitAuthorityRecordId(input.explicitAuthority.authorizationKey)
          : null;
      const retries = await tx.select().from(stateCommitLedger).where(eq(stateCommitLedger.idempotencyKey, input.idempotencyKey)).limit(1);
      const retry = retries[0];
      if (retry) {
        const authorityRows = authorityRecordId
          ? await tx.select().from(stateAuthorityRecords).where(eq(stateAuthorityRecords.id, authorityRecordId)).limit(1)
          : [];
        const authority = authorityRows[0] ?? null;
        const authorityExact = canonicalEvidence
          ? retry.authorityRecordId === null
          : Boolean(
              input.explicitAuthority &&
              authority &&
              authority.authorityKind === "explicit" &&
              authority.actorType === input.explicitAuthority.actorType &&
              authority.actorId === input.explicitAuthority.actorId &&
              authority.authorityPath === input.explicitAuthority.authorityPath &&
              authority.targetKey === input.explicitAuthority.targetKey &&
              authority.reason === input.explicitAuthority.reason &&
              authority.issuedBy === input.explicitAuthority.issuedBy &&
              authority.authorizationKey === input.explicitAuthority.authorizationKey,
            );
        const exact =
          authorityExact &&
          retry.proposalId === input.proposalId &&
          retry.targetKey === input.targetKey &&
          retry.targetKind === input.targetKind &&
          retry.targetScope === input.targetScope &&
          retry.targetId === input.targetId &&
          retry.baseRevision === input.baseRevision &&
          retry.operation === input.operation &&
          retry.patchJson === input.patchJson &&
          retry.patchHash === input.patchHash &&
          retry.resultHash === input.resultHash &&
          retry.evidenceKind === input.evidence.kind &&
          retry.evidenceChatId === (input.evidence.chatId ?? null) &&
          retry.evidenceTurnId === (canonicalEvidence?.turnId ?? null) &&
          retry.evidenceMessageId === (canonicalEvidence?.messageId ?? null) &&
          retry.evidenceSwipeIndex === (canonicalEvidence?.swipeIndex ?? null) &&
          retry.evidenceContentHash === (canonicalEvidence?.sourceContentHash ?? null) &&
          retry.evidenceCanonicalRevision === (canonicalEvidence?.canonicalRevision ?? null) &&
          retry.evidenceReason === (explicitEvidence?.reason ?? null) &&
          retry.evidenceSourceHash === (explicitEvidence?.sourceHash ?? null) &&
          retry.actorType === input.actorType &&
          retry.actorId === input.actorId &&
          retry.authorityPath === input.authorityPath &&
          retry.authorityRecordId === authorityRecordId &&
          retry.batchId === input.batchId &&
          retry.commitOrder === input.commitOrder &&
          retry.commitGroupId === (input.commitGroupId ?? null) &&
          retry.dependencyCommitIds === JSON.stringify(input.dependencyCommitIds ?? []) &&
          retry.compensatesCommitId === (input.compensatesCommitId ?? null);
        return exact ? { status: "replayed", row: retry, revision: retry.resultRevision } : { status: "idempotency_conflict" };
      }

      const head = await this.getHead(input.targetKey, tx);
      const currentRevision = head?.revision ?? 0;
      if (currentRevision !== input.baseRevision) {
        return { status: "revision_conflict", expectedRevision: input.baseRevision, currentRevision };
      }
      if (head && head.stateHash !== input.beforeHash) {
        throw new Error(`Governed projection hash mismatch for ${input.targetKey}`);
      }
      if (
        head &&
        (head.targetKind !== input.targetKind ||
          head.targetScope !== input.targetScope ||
          head.targetId !== input.targetId)
      ) {
        throw new Error(`Governed target identity mismatch for ${input.targetKey}`);
      }

      const authority = input.explicitAuthority
        ? await authorities.issueExplicit(input.explicitAuthority, tx)
        : null;
      const revision = currentRevision + 1;
      const row: typeof stateCommitLedger.$inferInsert = {
        id: newId(),
        proposalId: input.proposalId,
        targetKey: input.targetKey,
        targetKind: input.targetKind,
        targetScope: input.targetScope,
        targetId: input.targetId,
        baseRevision: input.baseRevision,
        resultRevision: revision,
        operation: input.operation,
        patchJson: input.patchJson,
        patchHash: input.patchHash,
        beforeHash: input.beforeHash,
        resultHash: input.resultHash,
        evidenceKind: input.evidence.kind,
        evidenceChatId: input.evidence.chatId ?? null,
        evidenceTurnId: canonicalEvidence?.turnId ?? null,
        evidenceMessageId: canonicalEvidence?.messageId ?? null,
        evidenceSwipeIndex: canonicalEvidence?.swipeIndex ?? null,
        evidenceContentHash: canonicalEvidence?.sourceContentHash ?? null,
        evidenceCanonicalRevision: canonicalEvidence?.canonicalRevision ?? null,
        evidenceReason: explicitEvidence?.reason ?? null,
        evidenceSourceHash: explicitEvidence?.sourceHash ?? null,
        actorType: input.actorType,
        actorId: input.actorId,
        authorityPath: input.authorityPath,
        authorityRecordId: authority?.id ?? null,
        batchId: input.batchId,
        commitOrder: input.commitOrder,
        commitGroupId: input.commitGroupId ?? null,
        dependencyCommitIds: JSON.stringify(input.dependencyCommitIds ?? []),
        compensatesCommitId: input.compensatesCommitId ?? null,
        idempotencyKey: input.idempotencyKey,
        committedAt: now(),
      };
      await tx.insert(stateCommitLedger).values(row);

      if (head) {
        await tx
          .update(stateTargetHeads)
          .set({ revision, lastCommitId: row.id, stateHash: input.resultHash, updatedAt: row.committedAt })
          .where(eq(stateTargetHeads.targetKey, input.targetKey));
      } else {
        await tx.insert(stateTargetHeads).values({
          targetKey: input.targetKey,
          targetKind: input.targetKind,
          targetScope: input.targetScope,
          targetId: input.targetId,
          revision,
          lastCommitId: row.id,
          stateHash: input.resultHash,
          updatedAt: row.committedAt,
        });
      }

      return { status: "committed", row: row as typeof stateCommitLedger.$inferSelect, revision };
    },
  };
}
