import { eq } from "drizzle-orm";
import type { DB } from "../../db/connection.js";
import { gameEngineState, stateCommitLedger } from "../../db/schema/index.js";
import type { CommitAuthority, TargetIdentity } from "./governed-adapters.js";
import { GovernedAdapterRegistry } from "./governed-adapters.js";
import { validateCommitEvidence } from "./governed-evidence.js";
import { createGovernedProposalStorage, type CommitEvidence } from "./governed-proposals.storage.js";
import { humanOSRuntimeParityAdapter } from "./humanos-runtime-parity.adapter.js";
import { createGovernedStateStorage } from "./governed-state.storage.js";
import type { GovernedActorType, GovernedAuthorityPath } from "./governed-authority.storage.js";
import type { HumanOSRuntimeGovernedPatch } from "./humanos-runtime-governed.js";

type StoredProposal = NonNullable<Awaited<ReturnType<ReturnType<typeof createGovernedProposalStorage>["get"]>>>;

function proposalEvidence(proposal: {
  evidenceKind: string;
  chatId: string | null;
  turnId: string | null;
  messageId: string | null;
  swipeIndex: number | null;
  sourceContentHash: string | null;
  canonicalRevision: number | null;
  authorityRecordId: string | null;
  authorityReason: string | null;
  authoritySourceHash: string | null;
}): CommitEvidence {
  if (proposal.evidenceKind === "canonical_turn") {
    return {
      kind: "canonical_turn",
      chatId: proposal.chatId ?? "",
      turnId: proposal.turnId ?? "",
      messageId: proposal.messageId ?? "",
      swipeIndex: proposal.swipeIndex ?? -1,
      sourceContentHash: proposal.sourceContentHash ?? "",
      canonicalRevision: proposal.canonicalRevision ?? undefined,
    };
  }
  return {
    kind: proposal.evidenceKind as "manual_edit" | "repair" | "migration",
    authorityRecordId: proposal.authorityRecordId ?? "",
    chatId: proposal.chatId ?? undefined,
    reason: proposal.authorityReason ?? "",
    sourceHash: proposal.authoritySourceHash ?? undefined,
  };
}

function proposalAuthority(proposal: {
  evidenceKind: string;
  chatId: string | null;
  turnId: string | null;
  messageId: string | null;
  swipeIndex: number | null;
  sourceContentHash: string | null;
  canonicalRevision: number | null;
  authorityRecordId: string | null;
  authorityReason: string | null;
  authoritySourceHash: string | null;
  actorType: string;
  actorId: string;
  authorityPath: string;
}): CommitAuthority {
  const evidence = proposalEvidence(proposal);
  return {
    evidence,
    actor: {
      type: proposal.actorType as GovernedActorType,
      id: proposal.actorId,
      authorityPath: proposal.authorityPath as GovernedAuthorityPath,
    },
  };
}

function normalizeProposalTarget(input: {
  targetKind: string;
  targetScope: string;
  targetId: string;
  targetKey: string;
}, authority: CommitAuthority) {
  if (input.targetKind === "humanos_runtime") {
    return humanOSRuntimeParityAdapter.normalizeTarget({ chatId: input.targetId }, authority);
  }
  return {
    kind: input.targetKind,
    scope: input.targetScope,
    id: input.targetId,
    key: input.targetKey,
  };
}

function assertNormalizedTargetMatchesProposal(target: TargetIdentity, proposal: {
  targetKind: string;
  targetScope: string;
  targetId: string;
  targetKey: string;
}) {
  if (
    target.kind !== proposal.targetKind ||
    target.scope !== proposal.targetScope ||
    target.id !== proposal.targetId ||
    target.key !== proposal.targetKey
  ) {
    throw new Error(`Governed target normalization mismatch for ${proposal.targetKey}`);
  }
}

function assertRuntimePatchBindings(patch: HumanOSRuntimeGovernedPatch, authority: CommitAuthority, proposal: {
  baseRevision: number;
}) {
  if (patch.baseRevision !== proposal.baseRevision) {
    throw new Error("HumanOS Runtime patch baseRevision does not match proposal baseRevision");
  }
  if (authority.evidence.kind !== "canonical_turn") {
    throw new Error("HumanOS Runtime governed commits require canonical turn evidence");
  }
  if (
    patch.compatibility.messageId !== authority.evidence.messageId ||
    patch.compatibility.swipeIndex !== authority.evidence.swipeIndex ||
    patch.compatibility.turnId !== authority.evidence.turnId ||
    patch.compatibility.sourceContentHash !== authority.evidence.sourceContentHash
  ) {
    throw new Error("HumanOS Runtime compatibility metadata must match canonical turn evidence");
  }
}

async function verifyRuntimeReplayIntegrity(args: {
  tx: Pick<DB, "select" | "insert" | "update">;
  governed: ReturnType<typeof createGovernedStateStorage>;
  adapter: typeof humanOSRuntimeParityAdapter;
  proposal: StoredProposal;
  authority: CommitAuthority;
  patch: HumanOSRuntimeGovernedPatch;
}) {
  const ledgerRows = await args.tx
    .select()
    .from(stateCommitLedger)
    .where(eq(stateCommitLedger.proposalId, args.proposal.id))
    .limit(1);
  const ledger = ledgerRows[0];
  if (!ledger) throw new Error(`Committed proposal ${args.proposal.id} is missing its ledger row`);
  const target = normalizeProposalTarget(args.proposal, args.authority);
  assertNormalizedTargetMatchesProposal(target, args.proposal);
  const head = await args.governed.getHead(args.proposal.targetKey, args.tx);
  if (!head) throw new Error(`Committed proposal ${args.proposal.id} is missing its target head`);
  if (
    ledger.proposalId !== args.proposal.id ||
    ledger.idempotencyKey !== args.proposal.idempotencyKey ||
    ledger.targetKind !== args.proposal.targetKind ||
    ledger.targetScope !== args.proposal.targetScope ||
    ledger.targetId !== args.proposal.targetId ||
    ledger.targetKey !== args.proposal.targetKey ||
    ledger.baseRevision !== args.proposal.baseRevision ||
    ledger.operation !== args.proposal.operation ||
    ledger.patchHash !== args.proposal.patchHash
  ) {
    throw new Error(`Committed proposal ${args.proposal.id} has divergent immutable ledger coordinates`);
  }
  if (head.revision < ledger.resultRevision) {
    throw new Error(`Committed proposal ${args.proposal.id} has regressed target head revision`);
  }
  const runtimeRows = await args.tx
    .select()
    .from(gameEngineState)
    .where(eq(gameEngineState.idempotencyKey, args.proposal.idempotencyKey))
    .limit(1);
  const runtimeRow = runtimeRows[0];
  if (!runtimeRow) throw new Error(`Committed proposal ${args.proposal.id} is missing its Runtime compatibility row`);
  if (
    runtimeRow.chatId !== target.id ||
    runtimeRow.messageId !== args.patch.compatibility.messageId ||
    runtimeRow.swipeIndex !== args.patch.compatibility.swipeIndex ||
    runtimeRow.turnId !== args.patch.compatibility.turnId ||
    runtimeRow.sourceContentHash !== args.patch.compatibility.sourceContentHash ||
    runtimeRow.revision !== ledger.resultRevision
  ) {
    throw new Error(`Committed proposal ${args.proposal.id} has divergent Runtime compatibility coordinates`);
  }
  const projection = { state: JSON.parse(runtimeRow.state) as unknown };
  const runtimeHash = args.adapter.hashProjection(projection);
  if (runtimeHash !== ledger.resultHash) {
    throw new Error(`Committed proposal ${args.proposal.id} has divergent historical Runtime projection hash`);
  }
  if (head.revision === ledger.resultRevision && (head.lastCommitId !== ledger.id || head.stateHash !== ledger.resultHash)) {
    throw new Error(`Committed proposal ${args.proposal.id} has divergent current-head replay integrity`);
  }
  return { ledger, runtimeRow };
}

export function createGovernedCommitService(db: DB, registry = new GovernedAdapterRegistry().register(humanOSRuntimeParityAdapter)) {
  const proposals = createGovernedProposalStorage(db);
  const governed = createGovernedStateStorage(db);

  return {
    async commitStoredProposal(proposalId: string) {
      return db.transaction(async (tx) => {
        const proposal = await proposals.get(proposalId, tx);
        if (!proposal) throw new Error(`Unknown proposal ${proposalId}`);
        if (proposal.status === "committed" || proposal.status === "replayed") {
          const authority = proposalAuthority(proposal);
          const adapter = registry.get(proposal.targetKind);
          const patch = adapter.normalizePatch(proposal.operation, JSON.parse(proposal.patchJson) as unknown);
          if (proposal.targetKind === "humanos_runtime") {
            assertRuntimePatchBindings(patch as HumanOSRuntimeGovernedPatch, authority, proposal);
            const replay = await verifyRuntimeReplayIntegrity({
              tx,
              governed,
              adapter: humanOSRuntimeParityAdapter,
              proposal,
              authority,
              patch: patch as HumanOSRuntimeGovernedPatch,
            });
            return { status: "replayed" as const, proposalId: proposal.id, ledger: replay.ledger, runtimeRow: replay.runtimeRow };
          }
          return { status: "replayed" as const, proposal };
        }
        if (proposal.status !== "proposed") {
          return { status: proposal.status, proposal } as const;
        }

        const authority = proposalAuthority(proposal);
        const evidenceStatus = await validateCommitEvidence(tx, authority.evidence);
        if (!evidenceStatus.valid) {
          await proposals.resolve(proposal.id, "rejected_evidence", { diagnostic: evidenceStatus }, tx);
          return { status: "rejected_evidence" as const, reason: evidenceStatus.reason };
        }

        const adapter = registry.get(proposal.targetKind);
        const target = normalizeProposalTarget(proposal, authority);
        assertNormalizedTargetMatchesProposal(target, proposal);
        const patch = adapter.normalizePatch(proposal.operation, JSON.parse(proposal.patchJson) as unknown);
        if (proposal.targetKind === "humanos_runtime") {
          assertRuntimePatchBindings(patch as HumanOSRuntimeGovernedPatch, authority, proposal);
        }
        adapter.validatePolicy({ operation: proposal.operation, target, patch, authority });
        const head = await governed.getHead(proposal.targetKey, tx);
        const currentRevision = head?.revision ?? 0;
        if (currentRevision !== proposal.baseRevision) {
          await proposals.resolve(proposal.id, "revision_conflict", { diagnostic: { expectedRevision: proposal.baseRevision, currentRevision } }, tx);
          return { status: "revision_conflict" as const, expectedRevision: proposal.baseRevision, currentRevision };
        }
        const current = await adapter.loadProjection(tx, target, proposal.operation, patch);
        const currentHash = current === null ? "" : adapter.hashProjection(current);
        if ((current === null) !== (head === null)) throw new Error(`Governed projection/head mismatch for ${proposal.targetKey}`);
        if (head && head.stateHash !== currentHash) throw new Error(`Governed projection hash mismatch for ${proposal.targetKey}`);

        const result = adapter.applyPatch(current, proposal.operation, patch);
        adapter.validateResult(current, result);
        const governedResult = await governed.commit(
          {
            proposalId: proposal.id,
            targetKey: proposal.targetKey,
            targetKind: proposal.targetKind,
            targetScope: proposal.targetScope,
            targetId: proposal.targetId,
            baseRevision: proposal.baseRevision,
            operation: proposal.operation,
            patchJson: proposal.patchJson,
            patchHash: proposal.patchHash,
            beforeHash: currentHash,
            resultHash: adapter.hashProjection(result),
            evidence: authority.evidence,
            actorType: proposal.actorType as GovernedActorType,
            actorId: proposal.actorId,
            authorityPath: proposal.authorityPath as GovernedAuthorityPath,
            batchId: proposal.commitGroupId,
            commitOrder: 0,
            commitGroupId: proposal.commitGroupId,
            idempotencyKey: proposal.idempotencyKey,
          },
          tx,
        );
        if (governedResult.status === "revision_conflict" || governedResult.status === "idempotency_conflict") {
          await proposals.resolve(proposal.id, governedResult.status, { diagnostic: governedResult }, tx);
          return governedResult;
        }

        await adapter.persistProjection(tx, target, result, governedResult.revision, governedResult.row.id, {
          proposalId: proposal.id,
          operation: proposal.operation,
          patch,
          authority,
          idempotencyKey: proposal.idempotencyKey,
        });
        await proposals.resolve(proposal.id, "committed", { commitId: governedResult.row.id }, tx);

        if (proposal.targetKind === "humanos_runtime") {
          const rows = await tx.select().from(gameEngineState).where(eq(gameEngineState.idempotencyKey, proposal.idempotencyKey)).limit(1);
          return { status: "committed" as const, proposalId: proposal.id, ledger: governedResult.row, runtimeRow: rows[0] ?? null };
        }

        return { status: "committed" as const, proposalId: proposal.id, ledger: governedResult.row };
      });
    },
  };
}
