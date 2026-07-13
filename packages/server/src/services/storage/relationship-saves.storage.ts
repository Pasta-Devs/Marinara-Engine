import { createHash } from "node:crypto";
import { and, desc, eq } from "drizzle-orm";
import type { DB } from "../../db/connection.js";
import { relationshipCheckpoints, relationshipSaves, stateCommitLedger } from "../../db/schema/index.js";
import { newId, now } from "../../utils/id-generator.js";
import { createGovernedStateStorage } from "./governed-state.storage.js";
import type { ExplicitAuthorityInput, GovernedActorType, GovernedAuthorityPath } from "./governed-authority.storage.js";

const SCHEMA_VERSION = 1;

function hashJson(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export function relationshipSaveTargetKey(chatId: string, characterId: string, personaId: string) {
  return `relationship_save:${chatId}:${characterId}:${personaId}`;
}

export function relationshipCheckpointTargetKey(chatId: string, characterId: string, personaId: string) {
  return `relationship_checkpoint:${chatId}:${characterId}:${personaId}`;
}

export function createRelationshipSavesStorage(db: DB) {
  const governed = createGovernedStateStorage(db);

  return {
    async getCommittedBaseRevision(idempotencyKey: string) {
      const rows = await db
        .select({ baseRevision: stateCommitLedger.baseRevision })
        .from(stateCommitLedger)
        .where(eq(stateCommitLedger.idempotencyKey, idempotencyKey))
        .limit(1);
      return rows[0]?.baseRevision ?? null;
    },

    async get(chatId: string, characterId: string, personaId: string) {
      const rows = await db
        .select()
        .from(relationshipSaves)
        .where(
          and(
            eq(relationshipSaves.chatId, chatId),
            eq(relationshipSaves.characterId, characterId),
            eq(relationshipSaves.personaId, personaId),
          ),
        )
        .limit(1);
      return rows[0] ?? null;
    },

    async listCheckpoints(chatId: string, characterId: string, personaId: string) {
      const targetKey = relationshipCheckpointTargetKey(chatId, characterId, personaId);
      return db
        .select()
        .from(relationshipCheckpoints)
        .where(eq(relationshipCheckpoints.targetKey, targetKey))
        .orderBy(desc(relationshipCheckpoints.revision), desc(relationshipCheckpoints.createdAt));
    },

    async commit(input: {
      chatId: string;
      characterId: string;
      personaId: string;
      state: string;
      activeTruthCount: number;
      milestoneCount: number;
      baseRevision: number;
      evidenceMessageId?: string | null;
      evidenceSwipeIndex?: number | null;
      evidenceContentHash?: string | null;
      actorType: GovernedActorType;
      actorId: string;
      authorityPath: GovernedAuthorityPath;
      explicitAuthority?: ExplicitAuthorityInput;
      idempotencyKey: string;
    }) {
      return db.transaction(async (tx) => {
        const targetKey = relationshipSaveTargetKey(input.chatId, input.characterId, input.personaId);
        const existing = await tx
          .select()
          .from(relationshipSaves)
          .where(eq(relationshipSaves.targetKey, targetKey))
          .limit(1);
        const current = existing[0] ?? null;
        const head = await governed.getHead(targetKey, tx);
        if ((current === null) !== (head === null)) {
          throw new Error(`Relationship Save projection/head mismatch for ${targetKey}`);
        }
        if (current && head && (current.revision !== head.revision || current.projectionHash !== head.stateHash)) {
          throw new Error(`Relationship Save projection/head mismatch for ${targetKey}`);
        }
        const beforeHash = current?.projectionHash ?? "";
        const patchJson = JSON.stringify({
          state: JSON.parse(input.state) as unknown,
          activeTruthCount: input.activeTruthCount,
          milestoneCount: input.milestoneCount,
        });
        const resultHash = hashJson(patchJson);
        const proposalId = createHash("sha256").update(`${targetKey}:${input.idempotencyKey}:proposal`).digest("hex");

        const ledger = await governed.commit(
          {
            proposalId,
            targetKey,
            targetKind: "relationship_save",
            targetScope: "chat",
            targetId: input.chatId,
            baseRevision: input.baseRevision,
            operation: input.baseRevision === 0 ? "create" : "replace",
            patchJson,
            patchHash: resultHash,
            beforeHash,
            resultHash,
            evidence: input.authorityPath === "canonical_turn"
              ? {
                  kind: "canonical_turn",
                  chatId: input.chatId,
                  turnId: "legacy-relationship-save",
                  messageId: input.evidenceMessageId ?? "",
                  swipeIndex: input.evidenceSwipeIndex ?? -1,
                  sourceContentHash: input.evidenceContentHash ?? "",
                }
              : {
                  kind: input.authorityPath,
                  authorityRecordId: input.explicitAuthority ? createHash("sha256").update(`authority:${input.explicitAuthority.authorizationKey}`).digest("hex") : "",
                  chatId: input.chatId,
                  reason: input.explicitAuthority?.reason ?? "",
                  sourceHash: input.evidenceContentHash ?? undefined,
                },
            actorType: input.actorType,
            actorId: input.actorId,
            authorityPath: input.authorityPath,
            explicitAuthority: input.explicitAuthority,
            batchId: input.idempotencyKey,
            commitOrder: 0,
            idempotencyKey: input.idempotencyKey,
          },
          tx,
        );
        if (ledger.status !== "committed" && ledger.status !== "replayed") return ledger;
        if (ledger.status === "replayed") {
          if (!current) {
            throw new Error(`Relationship Save projection missing for replayed commit ${ledger.row.id}`);
          }
          return { status: ledger.status, row: current, ledger: ledger.row };
        }

        const timestamp = now();
        if (current) {
          await tx
            .update(relationshipSaves)
            .set({
              revision: ledger.revision,
              state: input.state,
              activeTruthCount: input.activeTruthCount,
              milestoneCount: input.milestoneCount,
              projectionHash: resultHash,
              sourceCommitId: ledger.row.id,
              updatedAt: timestamp,
            })
            .where(eq(relationshipSaves.id, current.id));
          return { status: ledger.status, row: { ...current, revision: ledger.revision, state: input.state, activeTruthCount: input.activeTruthCount, milestoneCount: input.milestoneCount, projectionHash: resultHash, sourceCommitId: ledger.row.id, updatedAt: timestamp }, ledger: ledger.row };
        }

        const row: typeof relationshipSaves.$inferInsert = {
          id: newId(),
          targetKey,
          chatId: input.chatId,
          characterId: input.characterId,
          personaId: input.personaId,
          schemaVersion: SCHEMA_VERSION,
          revision: ledger.revision,
          state: input.state,
          activeTruthCount: input.activeTruthCount,
          milestoneCount: input.milestoneCount,
          lastCheckpointId: null,
          projectionHash: resultHash,
          sourceCommitId: ledger.row.id,
          createdAt: timestamp,
          updatedAt: timestamp,
        };
        await tx.insert(relationshipSaves).values(row);
        return { status: ledger.status, row: row as typeof relationshipSaves.$inferSelect, ledger: ledger.row };
      });
    },

    async createCheckpoint(input: {
      chatId: string;
      characterId: string;
      personaId: string;
      canonicalMessageCount: number;
      startMessageId: string;
      endMessageId: string;
      messageHashes: string[];
      policyVersion: string;
      characterTruthTokens: number;
      activeState: string;
      classifications: string;
      sourceCommitIds: string[];
      creationReason: string;
      baseRevision: number;
      idempotencyKey: string;
    }) {
      throw new Error("Relationship checkpoint commits require the Phase C internal scheduler authority path");
      /* istanbul ignore next -- retained prototype projection code is unreachable until Phase C authority exists. */
      return db.transaction(async (tx) => {
        const saveTargetKey = relationshipSaveTargetKey(input.chatId, input.characterId, input.personaId);
        const checkpointTargetKey = relationshipCheckpointTargetKey(input.chatId, input.characterId, input.personaId);
        const saveRows = await tx.select().from(relationshipSaves).where(eq(relationshipSaves.targetKey, saveTargetKey)).limit(1);
        const save = saveRows[0];
        if (!save) {
          return { status: "missing_save" as const };
        }
        const patchJson = JSON.stringify({
          canonicalMessageCount: input.canonicalMessageCount,
          startMessageId: input.startMessageId,
          endMessageId: input.endMessageId,
          messageHashes: input.messageHashes,
          policyVersion: input.policyVersion,
          characterTruthTokens: input.characterTruthTokens,
          activeState: JSON.parse(input.activeState) as unknown,
          classifications: JSON.parse(input.classifications),
          sourceCommitIds: input.sourceCommitIds,
          creationReason: input.creationReason,
        });
        const proposalId = createHash("sha256").update(`${checkpointTargetKey}:${input.idempotencyKey}:proposal`).digest("hex");
        const head = await governed.getHead(checkpointTargetKey, tx);
        const beforeHash = head?.stateHash ?? "";
        const ledger = await governed.commit(
          {
            proposalId,
            targetKey: checkpointTargetKey,
            targetKind: "relationship_checkpoint",
            targetScope: "chat",
            targetId: input.chatId,
            baseRevision: input.baseRevision,
            operation: "checkpoint",
            patchJson,
            patchHash: hashJson(patchJson),
            beforeHash,
            resultHash: hashJson(patchJson),
            evidence: {
              kind: "migration",
              authorityRecordId: "disabled-checkpoint-authority",
              chatId: input.chatId,
              reason: "disabled checkpoint prototype",
            },
            actorType: "system",
            actorId: "relationship-checkpoint-writer",
            authorityPath: "migration",
            batchId: input.idempotencyKey,
            commitOrder: 0,
            dependencyCommitIds: save.sourceCommitId ? [save.sourceCommitId] : [],
            idempotencyKey: input.idempotencyKey,
          },
          tx,
        );
        if (ledger.status !== "committed" && ledger.status !== "replayed") return ledger;
        if (ledger.status === "replayed") {
          const replayRows = await tx
            .select()
            .from(relationshipCheckpoints)
            .where(
              and(
                eq(relationshipCheckpoints.targetKey, checkpointTargetKey),
                eq(relationshipCheckpoints.revision, ledger.revision),
              ),
            )
            .limit(1);
          const replay = replayRows[0];
          if (!replay) {
            throw new Error(`Relationship checkpoint projection missing for replayed commit ${ledger.row.id}`);
          }
          return { status: ledger.status, row: replay, ledger: ledger.row };
        }

        const previous = await tx
          .select()
          .from(relationshipCheckpoints)
          .where(eq(relationshipCheckpoints.targetKey, checkpointTargetKey))
          .orderBy(desc(relationshipCheckpoints.revision), desc(relationshipCheckpoints.createdAt))
          .limit(1);
        const previousCheckpoint = previous[0] ?? null;
        const row: typeof relationshipCheckpoints.$inferInsert = {
          id: newId(),
          relationshipSaveId: save.id,
          targetKey: checkpointTargetKey,
          schemaVersion: SCHEMA_VERSION,
          revision: ledger.revision,
          canonicalMessageCount: input.canonicalMessageCount,
          startMessageId: input.startMessageId,
          endMessageId: input.endMessageId,
          messageHashes: JSON.stringify(input.messageHashes),
          previousCheckpointId: previousCheckpoint?.id ?? null,
          policyVersion: input.policyVersion,
          characterTruthTokens: input.characterTruthTokens,
          activeState: input.activeState,
          classifications: input.classifications,
          sourceCommitIds: JSON.stringify(input.sourceCommitIds),
          status: "valid",
          creationReason: input.creationReason,
          createdAt: now(),
        };
        await tx.insert(relationshipCheckpoints).values(row);
        await tx
          .update(relationshipSaves)
          .set({ lastCheckpointId: row.id, updatedAt: now() })
          .where(eq(relationshipSaves.id, save.id));
        return { status: ledger.status, row: row as typeof relationshipCheckpoints.$inferSelect, ledger: ledger.row };
      });
    },
  };
}
